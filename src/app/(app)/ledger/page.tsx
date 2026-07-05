import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog } from "@/lib/models/DayLog";
import { enumerateDates, formatShortDate, todayIST } from "@/lib/dates";
import { groupByWeek } from "@/lib/weekGrouping";
import { classifyDay } from "@/lib/ledgerClassify";
import { Heading, FlavorText } from "@/components/ui";
import { NoClassMessage } from "@/components/NoClassMessage";
import { LedgerDayRow } from "@/components/ledger/LedgerDayRow";

export default async function LedgerPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.classId) {
    return <NoClassMessage reason="before the ledger has anything to show" />;
  }

  await connectToDatabase();
  const cls = await Class.findById(session.user.classId).lean();
  if (!cls) {
    return <NoClassMessage reason="before the ledger has anything to show" />;
  }

  const allLogs = await DayLog.find({ userId: session.user.id }).lean();
  const logsByDate = new Map(allLogs.map((l) => [l.date, l]));

  const today = todayIST();
  const dates = enumerateDates(cls.semesterStart, today).reverse();
  const rows = dates.map((date) => ({ date, info: classifyDay(cls, logsByDate.get(date), date) }));
  const weeks = groupByWeek(rows);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-8">
      <header className="flex flex-col items-center gap-1 pt-4 text-center">
        <Heading size="lg" as="h1">
          The Ledger
        </Heading>
        <FlavorText>Every day answered for.</FlavorText>
      </header>

      {dates.length === 0 ? (
        <FlavorText className="text-center">The ledger opens once the semester starts.</FlavorText>
      ) : (
        <div className="flex flex-col gap-4">
          {weeks.map((week) => (
            <div key={week.weekStart} className="flex flex-col gap-1">
              <p className="font-ledger text-xs uppercase tracking-wide text-ink-muted">
                Week of {formatShortDate(week.weekStart)}
              </p>
              <div className="flex flex-col">
                {week.items.map((row) => (
                  <LedgerDayRow key={row.date} date={row.date} info={row.info} isToday={row.date === today} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
