import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Class } from "@/lib/models/Class";
import { DayLog } from "@/lib/models/DayLog";
import { getExpectedDay } from "@/lib/schedule";
import {
  computeBunkBudget,
  computeStats,
  honorScore,
  posterState,
} from "@/lib/engine";
import { addDays, todayIST } from "@/lib/dates";
import { tallyDayPeriods } from "@/lib/dayTally";
import { Heading } from "@/components/ui";
import { NoClassMessage } from "@/components/NoClassMessage";
import { UnfiledWarrantsStrip } from "@/components/mark/UnfiledWarrantsStrip";
import { WantedPoster } from "@/components/poster/WantedPoster";
import { HonorMeter } from "@/components/poster/HonorMeter";
import { type QuickDrawState } from "@/components/poster/QuickDraw";
import { HomeQuickDraw } from "@/components/poster/HomeQuickDraw";
import { HeaderSettingsLink } from "@/components/HeaderSettingsLink";

export default async function Home() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return <NoClassMessage reason="before the county can judge you" />;
  }

  if (!session.user.classId) {
    return <NoClassMessage reason="before the county can judge you" />;
  }

  await connectToDatabase();
  const cls = await Class.findById(session.user.classId).lean();

  if (!cls) {
    return <NoClassMessage reason="before the county can judge you" />;
  }

  const allLogs = await DayLog.find({ userId: session.user.id }).lean();

  const today = todayIST();
  const stats = computeStats(cls, allLogs, today);
  const budget = computeBunkBudget(stats);
  const poster = posterState(stats.percentage);
  const honor = honorScore(allLogs, today);
  const warrants = stats.unmarkedDays.filter((d) => d < today);

  const sevenDaysAgo = addDays(today, -6);
  const recentLogs = allLogs.filter((l) => l.date >= sevenDaysAgo && l.date <= today);
  const bunkDays = recentLogs.filter(
    (l) => l.dayType === "FULL_ABSENT" || l.periods.some((p) => p.status === "ABSENT")
  ).length;
  const honorFlavor =
    bunkDays === 0
      ? "A clean week's ride."
      : `${bunkDays} bunk${bunkDays === 1 ? "" : "s"} this week. Your honor fades, partner.`;

  const todayLog = allLogs.find((l) => l.date === today) ?? null;
  const expectedToday = getExpectedDay(cls, today);

  let quickDraw: QuickDrawState;
  if (todayLog) {
    let label: string;
    if (todayLog.dayType === "HOLIDAY") {
      label = "Holiday";
    } else if (todayLog.dayType === "FULL_ABSENT") {
      label = "Full Day Absent";
    } else {
      const dayPeriods = cls.timetable[todayLog.followedWeekday] ?? [];
      const { present, absent } = tallyDayPeriods(dayPeriods, todayLog.periods);
      label = `Present ${present} · Absent ${absent}`;
    }
    quickDraw = { kind: "filed", label };
  } else if (!expectedToday) {
    quickDraw = { kind: "noschool" };
  } else {
    quickDraw = { kind: "unfiled" };
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 p-4 pb-8">
      <header className="relative flex flex-col items-center gap-1 pt-4 text-center">
        <div className="absolute right-0 top-4">
          <HeaderSettingsLink />
        </div>
        <Heading size="xl" as="h1">
          DBAR
        </Heading>
        <p className="font-ledger text-xs uppercase tracking-[0.2em] text-ink-muted">
          County Attendance Register
        </p>
      </header>

      <WantedPoster
        poster={poster}
        percentage={stats.percentage}
        totalAttended={stats.totalAttended}
        totalOccurred={stats.totalOccurred}
        budget={budget}
      />

      <HonorMeter score={honor} flavorLine={honorFlavor} />

      {warrants.length > 0 && <UnfiledWarrantsStrip dates={warrants} />}

      <HomeQuickDraw today={today} state={quickDraw} />
    </main>
  );
}
