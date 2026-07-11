import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { SubjectPlan } from "@/lib/models/SubjectPlan";
import { displaySubjectName } from "@/lib/electiveDisplay";
import { WEEKDAYS } from "@/lib/weekday";
import { Heading, FlavorText } from "@/components/ui";
import { NoClassMessage } from "@/components/NoClassMessage";
import { GradePlannerCard } from "@/components/grades/GradePlannerCard";
import type { IClass } from "@/lib/models/Class";


function buildSubjectDirectory(
  cls: IClass,
  elective: "AE" | "FSWD" | null
): Map<string, { name: string }> {
  const directory = new Map<string, { name: string }>();
  for (const weekday of WEEKDAYS) {
    for (const period of cls.timetable[weekday]) {
      if (!period.countsForAttendance) continue;
      
      // Exclude labs and non-theory/1-credit subjects from the Grade Planner
      if (period.labGroupId) continue;
      if (period.subjectName.toLowerCase().includes("lab")) continue;
      
      const isExcludedCode = ["ABSL", "GE24501", "BS24502", "FC24501"].includes(period.subjectCode);
      const isExcludedName = ["PMOM", "LRAT", "ABSL", "UHVSL"].includes(period.subjectName.toUpperCase());
      if (isExcludedCode || isExcludedName) continue;

      if (!directory.has(period.subjectCode)) {
        directory.set(period.subjectCode, { name: displaySubjectName(period, elective) });
      }
    }
  }
  return directory;
}

export default async function GradesPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.classId) {
    return <NoClassMessage reason="before there are any bounties to chase" />;
  }

  await connectToDatabase();
  const cls = await Class.findById(session.user.classId).lean();
  if (!cls) {
    return <NoClassMessage reason="before there are any bounties to chase" />;
  }

  const plans = await SubjectPlan.find({ userId: session.user.id }).lean();
  const plansByCode = new Map(
    plans.map((p) => [p.subjectCode, p])
  );

  const directory = buildSubjectDirectory(cls, session.user.elective);
  const subjects = Array.from(directory.entries()).map(([code, info]) => {
    const plan = plansByCode.get(code);
    return {
      code,
      name: info.name,
      targetGrade: plan?.targetGrade ?? null,
      internals: plan?.internals ?? [],
    };
  });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <Heading size="lg" as="h1">
          Grades
        </Heading>
        <FlavorText>Name the grade you&apos;re gunning for. Here&apos;s the price.</FlavorText>
      </header>

      <div className="flex flex-col gap-3">
        {subjects.map((s) => (
          <GradePlannerCard key={s.code} {...s} />
        ))}
      </div>

      <FlavorText className="text-center text-sm">
        Internals bank 40 of the 100. The end-sem carries the other 60.
      </FlavorText>
    </main>
  );
}
