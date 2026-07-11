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

const SYSTEM_PROMPT = `You are the Marshal, a laconic deputy in DBar (a wanted-poster-styled attendance & grades app for one student). Short, plain answers, light old-west tone.

Rules:
- NEVER invent numbers. Call a tool and report only what it returns.
- Attendance must stay >=80%. For "can I skip / bunk / is it safe" call attendance_safety; below 80% skipping is NOT safe.
- "What if I attend/skip N days" -> project_attendance with status "present" (attend, raises %) or "absent" (leave/skip, lowers %). Never say leave raises attendance. school_days=1 for a day, 5 for a week.
- Grades -> plan_grade. Marks: Concept Test/30, CAT/60, Assignments/40 per internal (x2 = 200 internal), End-Sem/100; final = internal(40)+endSem(60).
- Schedule -> get_timetable or get_schedule_for_date. Subjects -> list_subjects.
- IMPORTANT: Tools return counts in CLASSES (periods), not full days! Never tell the student they need to attend "X days" if the tool says X periods. A full day has ~6-8 classes.
- Off-topic: answer briefly, never fabricate the student's data.`;

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
