"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Heading, FlavorText, PosterFrame, Stamp } from "@/components/ui";
import { cn } from "@/lib/cn";
import { saveDayLog, revertWorkingDay, type SaveDayLogPayload } from "@/lib/actions/saveDayLog";
import { groupPeriods, type PeriodGroup } from "@/lib/periodGroups";
import { PeriodChip, STATUS_LABEL } from "@/components/mark/PeriodChip";
import { fullWeekdayName } from "@/lib/dates";
import { tallyDayPeriods } from "@/lib/dayTally";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";
import { getQueuedFiling, queueFiling, QUEUE_SYNCED_EVENT } from "@/lib/offlineQueue";
import type { IPeriod, Timetable } from "@/lib/models/Class";
import type { DayType, PeriodStatus } from "@/lib/models/DayLog";

export interface ExistingLogSummary {
  dayType: DayType;
  periods: { periodNo: number; status: PeriodStatus }[];
}

interface MarkDayClientProps {
  date: string;
  timetable: Timetable;
  expected: { followedWeekday: Weekday; periods: IPeriod[] } | null;
  existingLog: ExistingLogSummary | null;
  isOverrideDay: boolean;
  holidayName: string | null;
}

type Mode = "noschool" | "picking" | "form" | "marked";

const HINT_KEY = "dbar.mark.longPressHintDismissed";
type ShortcutType = "FULL_ABSENT" | "HOLIDAY";

function nextTapStatus(status: PeriodStatus): PeriodStatus {
  switch (status) {
    case "PRESENT":
      return "ABSENT";
    case "ABSENT":
      return "OD";
    case "OD":
      return "PRESENT";
    case "CANCELLED":
      return "PRESENT";
  }
}

function defaultStatuses(
  periods: IPeriod[],
  existingLog: ExistingLogSummary | null
): Record<number, PeriodStatus> {
  const map: Record<number, PeriodStatus> = {};
  for (const period of periods) {
    map[period.periodNo] = "PRESENT";
  }
  if (existingLog?.dayType === "NORMAL") {
    for (const entry of existingLog.periods) {
      map[entry.periodNo] = entry.status;
    }
  }
  return map;
}

export function MarkDayClient({
  date,
  timetable,
  expected,
  existingLog,
  isOverrideDay,
  holidayName,
}: MarkDayClientProps) {
  const [mode, setMode] = useState<Mode>(existingLog ? "marked" : expected ? "form" : "noschool");
  const [workingDayWeekday, setWorkingDayWeekday] = useState<Weekday | null>(
    isOverrideDay ? (expected?.followedWeekday ?? null) : null
  );

  const activePeriods = useMemo(
    () => (workingDayWeekday ? timetable[workingDayWeekday] : (expected?.periods ?? [])),
    [workingDayWeekday, timetable, expected]
  );

  const [statuses, setStatuses] = useState<Record<number, PeriodStatus>>(() =>
    defaultStatuses(activePeriods, existingLog)
  );
  const [pendingDayType, setPendingDayType] = useState<DayType>(
    existingLog && existingLog.dayType !== "NORMAL" ? existingLog.dayType : "NORMAL"
  );
  const [savedSummary, setSavedSummary] = useState<ExistingLogSummary | null>(existingLog);
  const [hintDismissed, setHintDismissed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isReverting, startReverting] = useTransition();
  const [pendingWire, setPendingWire] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const groups = useMemo(() => groupPeriods(activePeriods), [activePeriods]);

  useEffect(() => {
    if (!existingLog) {
      setHintDismissed(window.localStorage.getItem(HINT_KEY) === "1");
    }
  }, [existingLog]);

  useEffect(() => {
    const queued = getQueuedFiling(date);
    if (queued && !existingLog) {
      setSavedSummary({ dayType: queued.dayType, periods: queued.periods });
      setPendingWire(true);
      setMode("marked");
    } else {
      setPendingWire(queued !== null);
    }

    function onSync(e: Event) {
      const detail = (e as CustomEvent<{ date: string }>).detail;
      if (detail?.date === date) setPendingWire(false);
    }
    window.addEventListener(QUEUE_SYNCED_EVENT, onSync);
    return () => window.removeEventListener(QUEUE_SYNCED_EVENT, onSync);
    // Only re-check on the date/existingLog identity this component was mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function dismissHint() {
    window.localStorage.setItem(HINT_KEY, "1");
    setHintDismissed(true);
  }

  function cycleStatus(group: PeriodGroup) {
    if (pendingDayType !== "NORMAL") return;
    const periodNos = group.periodNos;
    setStatuses((prev) => {
      const cycled = nextTapStatus(prev[periodNos[0]]);
      const next = { ...prev };
      for (const no of periodNos) next[no] = cycled;
      setAnnouncement(`${group.subjectName} marked ${STATUS_LABEL[cycled]}`);
      return next;
    });
  }

  function toggleCancelled(group: PeriodGroup) {
    if (pendingDayType !== "NORMAL") return;
    const periodNos = group.periodNos;
    setStatuses((prev) => {
      const toggled = prev[periodNos[0]] === "CANCELLED" ? "PRESENT" : "CANCELLED";
      const next = { ...prev };
      for (const no of periodNos) next[no] = toggled;
      setAnnouncement(`${group.subjectName} marked ${STATUS_LABEL[toggled]}`);
      return next;
    });
  }

  function toggleShortcut(type: ShortcutType) {
    setPendingDayType((prev) => (prev === type ? "NORMAL" : type));
  }

  function handleEdit() {
    setStatuses(defaultStatuses(activePeriods, savedSummary));
    setPendingDayType(savedSummary && savedSummary.dayType !== "NORMAL" ? savedSummary.dayType : "NORMAL");
    setError(null);
    setMode("form");
  }

  function handlePickWeekday(weekday: Weekday) {
    setWorkingDayWeekday(weekday);
    setStatuses(defaultStatuses(timetable[weekday], null));
    setPendingDayType("NORMAL");
    setError(null);
    setMode("form");
  }

  function handleCancelPick() {
    setWorkingDayWeekday(null);
    setPendingDayType("NORMAL");
    setError(null);
    setMode("noschool");
  }

  function handleRevert() {
    setError(null);
    startReverting(async () => {
      try {
        await revertWorkingDay(date);
        setSavedSummary(null);
        setWorkingDayWeekday(null);
        setPendingDayType("NORMAL");
        setMode("noschool");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not revert. Try again.");
      }
    });
  }

  function handleDone() {
    setError(null);
    const payloadPeriods =
      pendingDayType === "NORMAL"
        ? activePeriods.map((period) => ({
            periodNo: period.periodNo,
            status: statuses[period.periodNo] ?? "PRESENT",
          }))
        : [];

    const payload: SaveDayLogPayload = {
      dayType: pendingDayType,
      periods: payloadPeriods,
      ...(workingDayWeekday ? { overrideWeekday: workingDayWeekday } : {}),
    };

    startSaving(async () => {
      try {
        await saveDayLog(date, payload);
        setSavedSummary({ dayType: pendingDayType, periods: payloadPeriods });
        setPendingWire(false);
        setMode("marked");
      } catch (err) {
        const isNetworkError = err instanceof TypeError || !navigator.onLine;
        if (isNetworkError) {
          queueFiling(date, payload);
          setSavedSummary({ dayType: pendingDayType, periods: payloadPeriods });
          setPendingWire(true);
          setMode("marked");
        } else {
          setError(err instanceof Error ? err.message : "Filing failed. Try again.");
        }
      }
    });
  }

  const bannerDayLabel = holidayName ?? fullWeekdayName(date);
  const showBanner = workingDayWeekday !== null;

  function WorkingDayBanner({ interactive }: { interactive: boolean }) {
    if (!showBanner || !workingDayWeekday) return null;
    return (
      <div className="flex items-center justify-between gap-2 border border-border-dark bg-paper-dark px-3 py-2">
        <FlavorText className="text-sm">
          Working {bannerDayLabel} — running {workingDayWeekday} timetable
        </FlavorText>
        {interactive &&
          (savedSummary !== null ? (
            <button
              type="button"
              onClick={handleRevert}
              disabled={isReverting}
              className="shrink-0 font-ledger text-xs uppercase text-blood underline disabled:opacity-50"
            >
              {isReverting ? "Reverting..." : "Not a working day after all?"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelPick}
              className="shrink-0 font-ledger text-xs uppercase text-ink-muted underline"
            >
              Cancel
            </button>
          ))}
      </div>
    );
  }

  if (mode === "noschool") {
    return (
      <div className="flex flex-col gap-4">
        <PosterFrame>
          <FlavorText className="text-center">
            No court in session today{holidayName ? ` — ${holidayName}.` : "."}
          </FlavorText>
        </PosterFrame>
        <div className="flex justify-center">
          <button type="button" onClick={() => setMode("picking")}>
            <Stamp variant="ink" className="!border-ink-muted !text-ink-muted text-xs opacity-70">
              Court in Session? — Log this Day
            </Stamp>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "picking") {
    return (
      <PosterFrame>
        <div className="flex flex-col items-center gap-3">
          <FlavorText>Which day&rsquo;s timetable ran?</FlavorText>
          <div className="flex w-full flex-col gap-2">
            {WEEKDAYS.map((weekday) => (
              <button
                key={weekday}
                type="button"
                onClick={() => handlePickWeekday(weekday)}
                className="border border-ink px-3 py-2 text-center font-ledger uppercase tracking-wide text-ink"
              >
                {weekday}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMode("noschool")}
            className="font-ledger text-xs uppercase text-ink-muted underline"
          >
            Cancel
          </button>
        </div>
      </PosterFrame>
    );
  }

  if (mode === "marked" && savedSummary) {
    const label =
      savedSummary.dayType === "HOLIDAY"
        ? "Filed — Holiday"
        : savedSummary.dayType === "FULL_ABSENT"
          ? "Filed — Full Day Absent"
          : (() => {
              const { present, absent } = tallyDayPeriods(activePeriods, savedSummary.periods);
              return `Filed — Present ${present} · Absent ${absent}`;
            })();

    return (
      <div className="flex flex-col gap-4">
        <WorkingDayBanner interactive={false} />
        <PosterFrame>
          <div className="flex flex-col items-center gap-3 text-center">
            <Heading size="md" as="p">
              {label}
            </Heading>
            {pendingWire && (
              <Stamp variant="ink" className="!border-ink-muted !text-ink-muted text-xs">
                Pending Wire — will file when back on the grid
              </Stamp>
            )}
            <button type="button" onClick={handleEdit}>
              <Stamp variant="ink" className="transition-colors hover:border-blood hover:text-blood">
                Edit
              </Stamp>
            </button>
          </div>
        </PosterFrame>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <WorkingDayBanner interactive={true} />

      {!hintDismissed && (
        <div className="flex items-center justify-between gap-2 border border-border-dark bg-paper-dark px-3 py-2">
          <FlavorText className="text-sm">Hold a period to mark it cancelled.</FlavorText>
          <button
            type="button"
            onClick={dismissHint}
            className="shrink-0 font-ledger text-xs uppercase text-ink-muted underline"
          >
            Got it
          </button>
        </div>
      )}

      {pendingDayType === "HOLIDAY" ? (
        <PosterFrame variant="paper-dark">
          <FlavorText className="text-center">
            Marking this whole day as a holiday. No periods will be logged.
          </FlavorText>
        </PosterFrame>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <PeriodChip
              key={group.periodNos.join("-")}
              group={group}
              status={statuses[group.periodNos[0]]}
              forcedAbsent={pendingDayType === "FULL_ABSENT"}
              onTap={() => cycleStatus(group)}
              onLongPress={() => toggleCancelled(group)}
            />
          ))}
        </div>
      )}

      {error && <FlavorText className="text-center text-blood">{error}</FlavorText>}

      <div className="flex gap-3">
        <button type="button" onClick={() => toggleShortcut("FULL_ABSENT")} className="flex-1">
          <Stamp
            variant={pendingDayType === "FULL_ABSENT" ? "blood" : "ink"}
            className="block w-full text-center text-xs"
          >
            Full Day Absent
          </Stamp>
        </button>
        <button type="button" onClick={() => toggleShortcut("HOLIDAY")} className="flex-1">
          <Stamp
            variant={pendingDayType === "HOLIDAY" ? "brass" : "ink"}
            className="block w-full text-center text-xs"
          >
            Holiday
          </Stamp>
        </button>
      </div>

      <button type="button" onClick={handleDone} disabled={isSaving} className="w-full">
        <Stamp variant="ink" className={cn("block w-full text-center", isSaving && "opacity-50")}>
          {isSaving ? "Filing..." : "Done"}
        </Stamp>
      </button>
    </div>
  );
}
