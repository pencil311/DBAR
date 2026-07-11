import type { IClass } from "@/lib/models/Class";
import type { IDayLog } from "@/lib/models/DayLog";
import { computeStats, computeBunkBudget } from "@/lib/engine";
import { displaySubjectName } from "@/lib/electiveDisplay";
import { WEEKDAYS } from "@/lib/weekday";
import { getExpectedDay } from "@/lib/schedule";
import { addDays } from "@/lib/dates";
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
            type: ["string", "null"],
            description: "Optional subject code or name to scope to. Omit (or null) for overall attendance.",
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
      name: "attendance_safety",
      description:
        "Check whether the student can skip/bunk classes while staying at or above a target attendance percentage. Returns how many more periods they can miss (0 if none), and — if already below the target — how many periods they must attend in a row to get back to safe. Use for ANY 'can I skip', 'is it safe to bunk', 'how many can I miss', or 'how many must I attend to reach X%' question.",
      parameters: { 
        type: "object", 
        properties: {
          target_percentage: {
            type: "number",
            description: "The target percentage to check against. Defaults to 80.",
          }
        }, 
        required: [] 
      },
    },
  },
  {
    type: "function",
    function: {
      name: "project_attendance",
      description:
        "Project the student's attendance percentage over the next N upcoming school days, assuming they are either PRESENT for all of them (attend) or ABSENT for all of them (take leave/skip). Weekends, holidays, and non-semester days are skipped automatically. Use status='absent' for 'what if I take leave / skip / bunk' questions (this LOWERS attendance) and status='present' for 'what if I attend' questions (this RAISES it). One school day ≈ a full day of classes.",
      parameters: {
        type: "object",
        properties: {
          school_days: {
            type: "number",
            description: "How many upcoming school days this covers. Use 1 for a single day (e.g. 'Monday'), 5 for a full week. Defaults to 1.",
          },
          status: {
            type: "string",
            enum: ["present", "absent"],
            description: "'present' = the student attends those days; 'absent' = the student takes leave/skips them. Defaults to 'present'.",
          },
        },
        required: [],
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

    case "attendance_safety": {
      const stats = computeStats(ctx.cls, ctx.logs, ctx.asOf);
      const target = typeof args.target_percentage === "number" ? args.target_percentage : 80;
      const { canBunk, mustAttend } = computeBunkBudget(stats, target);
      const isSafe = stats.percentage >= target;
      return {
        current_percentage: Number(stats.percentage.toFixed(1)),
        required_minimum: target,
        is_safe: isSafe,
        periods_you_can_still_skip: canBunk,
        periods_to_attend_to_reach_target: mustAttend,
        verdict: isSafe
          ? canBunk > 0
            ? `Safe: can miss up to ${canBunk} more INDIVIDUAL CLASS PERIODS and stay at/above ${target}%. (Note to AI: do NOT say days)`
            : `On the edge: skipping even one period drops below ${target}%.`
          : `NOT safe: below ${target}%, can skip 0. Must attend ${mustAttend} INDIVIDUAL CLASS PERIODS straight to reach ${target}%. (Note to AI: do NOT say days, a day has ~7 classes!)`,
      };
    }

    case "project_attendance": {
      const stats = computeStats(ctx.cls, ctx.logs, ctx.asOf);
      const n =
        typeof args.school_days === "number" && args.school_days > 0
          ? Math.min(Math.floor(args.school_days), 60)
          : 1;
      const absent = args.status === "absent";

      let counted = 0;
      let periods = 0;
      const dates: string[] = [];
      // Walk forward from today until we've gathered N actual school days.
      for (let i = 1; i <= 400 && counted < n; i++) {
        const date = addDays(ctx.asOf, i);
        const expected = getExpectedDay(ctx.cls, date);
        if (!expected) continue; // weekend, holiday, or outside the semester
        counted += 1;
        dates.push(date);
        periods += expected.periods.filter((p) => p.countsForAttendance).length;
      }

      // Present → those periods count as attended AND occurred (raises %).
      // Absent → they count as occurred only (lowers %).
      const projAttended = stats.totalAttended + (absent ? 0 : periods);
      const projOccurred = stats.totalOccurred + periods;
      const projPct = projOccurred === 0 ? 100 : (projAttended / projOccurred) * 100;

      return {
        assumption: absent ? "student takes leave (absent) on those days" : "student attends those days",
        current_percentage: Number(stats.percentage.toFixed(1)),
        current_attended: stats.totalAttended,
        current_occurred: stats.totalOccurred,
        school_days: counted,
        dates,
        periods_affected: periods,
        projected_percentage: Number(projPct.toFixed(1)),
        note:
          counted < n
            ? `Only ${counted} school day(s) remain before the semester ends.`
            : absent
              ? "Assumes every period on those days is missed."
              : "Assumes every period on those days is attended.",
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
