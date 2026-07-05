import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog } from "@/lib/models/DayLog";
import { computeStats } from "@/lib/engine";
import { todayIST } from "@/lib/dates";
import { displaySubjectName } from "@/lib/electiveDisplay";
import { WEEKDAYS } from "@/lib/weekday";
import { Heading, FlavorText } from "@/components/ui";
import { NoClassMessage } from "@/components/NoClassMessage";
import { SubjectCard } from "@/components/subjects/SubjectCard";
import type { IClass } from "@/lib/models/Class";

function buildSubjectDirectory(
  cls: IClass,
  elective: "AE" | "FSWD" | null
): Map<string, { name: string }> {
  const directory = new Map<string, { name: string }>();
  for (const weekday of WEEKDAYS) {
    for (const period of cls.timetable[weekday]) {
      if (!period.countsForAttendance) continue;
      if (!directory.has(period.subjectCode)) {
        directory.set(period.subjectCode, { name: displaySubjectName(period, elective) });
      }
    }
  }
  return directory;
}

export default async function SubjectsPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.classId) {
    return <NoClassMessage reason="before the docket has anything to show" />;
  }

  await connectToDatabase();
  const cls = await Class.findById(session.user.classId).lean();
  if (!cls) {
    return <NoClassMessage reason="before the docket has anything to show" />;
  }

  const allLogs = await DayLog.find({ userId: session.user.id }).lean();
  const stats = computeStats(cls, allLogs, todayIST());
  const directory = buildSubjectDirectory(cls, session.user.elective);

  const subjects = Array.from(directory.entries()).map(([code, info]) => {
    const stat = stats.perSubject[code];
    return {
      code,
      name: info.name,
      occurred: stat?.occurred ?? 0,
      attended: stat?.attended ?? 0,
      percentage: stat?.percentage ?? 100,
    };
  });

  const withData = subjects.filter((s) => s.occurred > 0).sort((a, b) => a.percentage - b.percentage);
  const noData = subjects.filter((s) => s.occurred === 0);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <Heading size="lg" as="h1">
          The Docket
        </Heading>
        <FlavorText>Charges filed, subject by subject.</FlavorText>
      </header>

      <div className="flex flex-col gap-3">
        {withData.map((s) => (
          <SubjectCard key={s.code} {...s} />
        ))}
        {noData.map((s) => (
          <SubjectCard key={s.code} {...s} />
        ))}
      </div>

      <FlavorText className="text-center text-sm">
        The county counts the total. These are the trails that got you here.
      </FlavorText>
    </main>
  );
}
