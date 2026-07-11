import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog } from "@/lib/models/DayLog";
import { todayIST } from "@/lib/dates";
import { CHAT_TOOLS, runTool, type ChatContext } from "@/lib/ai/tools";

// The AI model id. Set AI_MODEL to whichever model your Groq account serves.
const MODEL = process.env.AI_MODEL ?? "llama-3.1-8b-instant";
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `You are the Marshal — a laconic, dependable deputy inside DBar, a Red Dead Redemption-styled attendance-and-grades tracker for one college student. Speak plainly, with a light old-west drawl; keep answers short.

Hard rules:
- NEVER invent numbers. For anything about attendance or grades, call a tool and report only what it returns. If a tool returns an error or "no marks recorded yet", say so honestly.
- Marks are out of: Concept Test 30, CAT 60, Assignments 40 (per internal, two internals = 200), End-Sem 100. The final grade combines internal (as 40) and end-sem (as 60) out of 100.
- If the student names a subject loosely, pass what they said to the tool — it will resolve it.
- You have access to their weekly timetable. If they ask about their schedule or classes, use the get_timetable tool.
- The student must keep attendance at or above 80%. NEVER tell them skipping is fine without checking — for any "can I skip / bunk / is it safe" question, call attendance_safety and report its verdict. Below 80% means skipping is NOT safe.
- For "what if" attendance questions, use project_attendance and pick status correctly: taking leave / skipping / bunking / being absent → status="absent" (this LOWERS attendance); attending / going to class → status="present" (this RAISES it). Report the tool's projected_percentage exactly, and never claim leave raises attendance. Use school_days=1 for a single day, 5 for a week.
- If a question isn't about attendance, schedule, or grades, answer briefly from general knowledge, but don't fabricate the student's data.`;

// A minimal shape for the OpenAI-compatible messages we accept from the client.
interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.user.classId) {
    return NextResponse.json({ error: "You aren't riding with an outfit yet." }, { status: 400 });
  }

  const apiKey = process.env.AI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The telegraph line is down (AI_KEY not set)." }, { status: 503 });
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (history.length === 0) {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });
  }

  await connectToDatabase();
  const cls = await Class.findById(session.user.classId).lean();
  if (!cls) {
    return NextResponse.json({ error: "Your outfit's records are missing." }, { status: 400 });
  }
  const logs = await DayLog.find({ userId: session.user.id }).lean();

  const ctx: ChatContext = {
    cls,
    logs,
    elective: session.user.elective,
    asOf: todayIST(),
  };

  const groq = new Groq({ apiKey });

  const dynamicPrompt = `${SYSTEM_PROMPT}\n\nToday's Date: ${todayIST()}\nClass: ${cls.name}\nEnrolled Subjects: ${cls.timetable.MON.filter(p => p.countsForAttendance).map(p => p.subjectCode).join(", ")} (and others, use list_subjects to see all).`;

  // OpenAI-compatible chat messages; tool results are pushed as role "tool".
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: dynamicPrompt },
    ...history.map((m) => ({ role: m.role, content: String(m.content) })),
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: CHAT_TOOLS as unknown as Groq.Chat.ChatCompletionTool[],
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 700,
      });

      const choice = completion.choices[0]?.message;
      if (!choice) {
        return NextResponse.json({ error: "The Marshal had nothing to say." }, { status: 502 });
      }

      const toolCalls = choice.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return NextResponse.json({ reply: choice.content ?? "" });
      }

      // Record the assistant's tool-call turn, then answer each call.
      messages.push(choice);
      for (const call of toolCalls) {
        let parsed: Record<string, unknown> = {};
        try {
          // Llama sometimes emits "null" or a bare value instead of an object.
          const raw: unknown = JSON.parse(call.function.arguments || "{}");
          if (raw && typeof raw === "object") parsed = raw as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        const result = runTool(ctx, call.function.name, parsed);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Ran out of tool rounds without a final answer.
    return NextResponse.json({ reply: "Couldn't wrap that up — try asking a mite plainer." });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : "unknown";

    // Groq rate limit (free tier is ~6000 tokens/min) — give a calm message.
    if (status === 429 || /rate.?limit/i.test(message)) {
      const wait = message.match(/try again in ([\d.]+)s/i)?.[1];
      return NextResponse.json(
        {
          error: wait
            ? `The Marshal's catching his breath — try again in about ${Math.ceil(Number(wait))}s.`
            : "The Marshal's catching his breath — the wire's busy. Try again in a moment.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: `The Marshal's line broke: ${message}` }, { status: 502 });
  }
}
