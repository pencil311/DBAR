import type { IClass } from "@/lib/models/Class";
import type { IDayLog } from "@/lib/models/DayLog";
import { computeStats } from "@/lib/engine";
import { displaySubjectName } from "@/lib/electiveDisplay";
import { WEEKDAYS } from "@/lib/weekday";
import { getExpectedDay } from "@/lib/schedule";
import { realisticTargetMarks, GRADE_TABLE, type GradeLetter } from "@/lib/grades";
import { creditsFor } from "@/lib/subjectCredits";

/**
 * Everything the chat tools are allowed to see — already scoped to the
 * signed-in user server-side. The LLM never touches the DB or does math; it
 * only calls these executors, which run the pure engine over this context.
 */
export interface ChatContext {
  cls: IClass;
  logs: IDayLog[];
  elective: "AE" | "FSWD" | null;
  asOf: string; // today's date (IST), for attendance as-of
}

function subjectDirectory(ctx: ChatContext): { code: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const weekday of WEEKDAYS) {
    for (const period of ctx.cls.timetable[weekday]) {
      if (!period.countsForAttendance) continue;
      if (!seen.has(period.subjectCode)) {
        seen.set(period.subjectCode, displaySubjectName(period, ctx.elective));
      }
    }
  }
  return Array.from(seen, ([code, name]) => ({ code, name }));
}

/** Resolve a user-typed subject reference (code or partial name) to one entry. */
function resolveSubject(ctx: ChatContext, query: string): { code: string; name: string } | null {
  const dir = subjectDirectory(ctx);
  const q = query.trim().toLowerCase();
  return (
    dir.find((s) => s.code.toLowerCase() === q) ??
    dir.find((s) => s.name.toLowerCase() === q) ??
    dir.find((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) ??
    null
  );
}

const SELECTABLE_GRADES = GRADE_TABLE.filter((b) => b.letter !== "RA").map((b) => b.letter);

/** The tool schemas advertised to the model (OpenAI-compatible function format). */
export const CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_subjects",
      description: "List the student's subjects this semester (code and name). Use before other tools if you need a subject code.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance",
      description:
        "Get the student's attendance. Returns the overall percentage and, if a subject is given, that subject's numbers. Use for any question about attendance, classes attended, or how many classes can be skipped.",
      parameters: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "Optional subject code or name to scope to. Omit for overall attendance.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_grade",
      description:
        "For a target grade in a subject, return the mark to aim for on every assessment (Concept Test /30, CAT /60, Assignments /40 — per internal — and the End-Sem /100). Use for any question about what marks are needed to hit a grade.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Subject code or name." },
          target_grade: {
            type: "string",
            enum: SELECTABLE_GRADES,
            description: "The grade the student wants (O, A+, A, B+, or B).",
          },
        },
        required: ["subject", "target_grade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_timetable",
      description: "Get the student's weekly class timetable/schedule (Monday to Friday). Use for any questions about when classes occur.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_schedule_for_date",
      description: "Get the student's specific schedule for a given date. Resolves holidays, weekends, and day-order overrides. Use for questions like 'what classes do I have tomorrow?'.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date to check in YYYY-MM-DD format." }
        },
        required: ["date"],
      },
    },
  },
] as const;

/** Run a tool call by name. Returns a JSON-serializable result for the model. */
export function runTool(ctx: ChatContext, name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "list_subjects":
      return {
        subjects: subjectDirectory(ctx).map((s) => ({ ...s, credits: creditsFor(s.code) })),
      };

    case "get_attendance": {
      const stats = computeStats(ctx.cls, ctx.logs, ctx.asOf);
      const subjectArg = typeof args.subject === "string" ? args.subject : "";
      if (!subjectArg) {
        return {
          overall_percentage: Number(stats.percentage.toFixed(1)),
          attended: stats.totalAttended,
          occurred: stats.totalOccurred,
          unmarked_days: stats.unmarkedDays.length,
        };
      }
      const subject = resolveSubject(ctx, subjectArg);
      if (!subject) return { error: `No subject matching "${subjectArg}".` };
      const s = stats.perSubject[subject.code];
      if (!s || s.occurred === 0) {
        return { subject: subject.name, code: subject.code, note: "No sessions recorded yet." };
      }
      return {
        subject: subject.name,
        code: subject.code,
        percentage: Number(s.percentage.toFixed(1)),
        attended: s.attended,
        occurred: s.occurred,
      };
    }

    case "plan_grade": {
      const subjectArg = typeof args.subject === "string" ? args.subject : "";
      const target = args.target_grade as GradeLetter;
      if (!SELECTABLE_GRADES.includes(target)) {
        return { error: `Invalid target grade "${String(args.target_grade)}". Pick one of ${SELECTABLE_GRADES.join(", ")}.` };
      }
      const subject = resolveSubject(ctx, subjectArg);
      if (!subject) return { error: `No subject matching "${subjectArg}".` };
      const plan = realisticTargetMarks(target);
      const ceil = (n: number) => Math.ceil(n);
      const internalAim = {
        concept_test: `${ceil(plan.perInternal.conceptTest)}/30`,
        cat: `${ceil(plan.perInternal.cat)}/60`,
        assignments: `${ceil(plan.perInternal.assignment)}/40`,
      };
      return {
        subject: subject.name,
        code: subject.code,
        credits: creditsFor(subject.code),
        target_grade: target,
        final_needed_out_of_100: plan.finalNeeded,
        achievable: plan.achievable,
        internal_1: internalAim,
        internal_2: internalAim,
        internal_total: `${ceil(plan.internalTotal)}/200`,
        pass_floor: "Internals must total at least 90/200 to pass at all — below that it's a fail (RA) no matter the end-sem.",
        end_sem: `${ceil(plan.endSem)}/100`,
        note: "Realistic plan: assignments high, CATs strong, concept tests lighter; the end-sem covers the rest. No marks are recorded yet.",
      };
    }

    case "get_timetable": {
      const schedule: Record<string, string[]> = {};
      for (const weekday of WEEKDAYS) {
        schedule[weekday] = ctx.cls.timetable[weekday]
          .filter(p => p.countsForAttendance)
          .map(p => `Period ${p.periodNo}: ${displaySubjectName(p, ctx.elective)}`);
      }
      return { timetable: schedule };
    }

    case "get_schedule_for_date": {
      if (typeof args.date !== "string") return { error: "Invalid date format." };
      const expected = getExpectedDay(ctx.cls, args.date);
      if (!expected) {
        return { note: `There are no classes scheduled for ${args.date} (it's either a weekend, a holiday, or outside the semester).` };
      }
      return {
        date: args.date,
        follows_timetable_for: expected.followedWeekday,
        classes: expected.periods
          .filter(p => p.countsForAttendance)
          .map(p => `Period ${p.periodNo}: ${displaySubjectName(p, ctx.elective)}`)
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
