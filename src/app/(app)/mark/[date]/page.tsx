import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog } from "@/lib/models/DayLog";
import { isSemesterDay, resolveMarkDay } from "@/lib/schedule";
import { computeStats } from "@/lib/engine";
import { formatDisplayDate, isValidDateString, todayIST } from "@/lib/dates";
import { applyElectiveDisplay } from "@/lib/electiveDisplay";
import { Heading } from "@/components/ui";
import { ThemedMessage } from "@/components/ThemedMessage";
import { NoClassMessage } from "@/components/NoClassMessage";
import { UnfiledWarrantsStrip } from "@/components/mark/UnfiledWarrantsStrip";
import { MarkDayClient, type ExistingLogSummary } from "./MarkDayClient";

interface PageProps {
  params: { date: string };
}

export default async function MarkDatePage({ params }: PageProps) {
  const { date } = params;

  if (!isValidDateString(date)) {
    return (
      <ThemedMessage title="Bad Trail Map">
        &ldquo;{date}&rdquo; isn&rsquo;t a date this outfit recognizes.
      </ThemedMessage>
    );
  }

  const session = await getServerAuthSession();
  if (!session?.user) {
    return <NoClassMessage reason="before you can file a report" />;
  }

  if (!session.user.classId) {
    return <NoClassMessage reason="before you can file a report" />;
  }

  await connectToDatabase();
  const cls = await Class.findById(session.user.classId).lean();

  if (!cls) {
    return <NoClassMessage reason="before you can file a report" />;
  }

  if (!isSemesterDay(cls, date)) {
    return (
      <ThemedMessage title="Outside the Territory">
        {date} falls outside this semester ({cls.semesterStart} to {cls.semesterEnd}).
      </ThemedMessage>
    );
  }

  const userId = session.user.id;

  const [existingLogDoc, allLogs] = await Promise.all([
    DayLog.findOne({ userId, date }).lean(),
    DayLog.find({ userId }).lean(),
  ]);

  // A DayLog's own stored followedWeekday always wins over the class's
  // shared dayOrderOverrides — see resolveMarkDay for why.
  const { followedWeekday, periods, isNonSchoolDay } = resolveMarkDay(
    cls,
    date,
    existingLogDoc?.followedWeekday ?? null
  );
  const expected = followedWeekday ? { followedWeekday, periods } : null;

  const today = todayIST();
  const stats = computeStats(cls, allLogs, today);
  const warrants = stats.unmarkedDays.filter((d) => d < today);

  const existingLog: ExistingLogSummary | null = existingLogDoc
    ? {
        dayType: existingLogDoc.dayType,
        followedWeekday: existingLogDoc.followedWeekday,
        periods: existingLogDoc.periods.map((p) => ({ periodNo: p.periodNo, status: p.status })),
      }
    : null;

  const holidayName = cls.holidays.find((h) => h.date === date)?.name ?? null;

  const displayTimetable = applyElectiveDisplay(cls.timetable, session.user.elective);
  const displayExpected = expected
    ? { followedWeekday: expected.followedWeekday, periods: displayTimetable[expected.followedWeekday] }
    : null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <Heading size="lg" as="h1">
          {expected ? "File Today's Report" : "No Court Today"}
        </Heading>
        <p className="font-ledger text-sm text-ink-muted">{formatDisplayDate(date)}</p>
      </header>

      {warrants.length > 0 && <UnfiledWarrantsStrip dates={warrants} />}

      <MarkDayClient
        date={date}
        timetable={displayTimetable}
        expected={displayExpected}
        existingLog={existingLog}
        isNonSchoolDay={isNonSchoolDay}
        holidayName={holidayName}
      />
    </main>
  );
}
