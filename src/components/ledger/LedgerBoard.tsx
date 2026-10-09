"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { FlavorText, Stamp } from "@/components/ui";
import { LedgerDayRow, LedgerRowBody, type BulkStatus } from "@/components/ledger/LedgerDayRow";
import { bulkSaveDayLogs } from "@/lib/actions/saveDayLog";
import type { LedgerDayKind } from "@/lib/ledgerClassify";

export interface LedgerRow {
  date: string;
  info: LedgerDayKind;
  percentage: number | null;
  isToday: boolean;
}

export interface LedgerWeek {
  weekStart: string;
  items: LedgerRow[];
}

const MAX_SELECTED = 10;

// UNFILED -> PRESENT -> ABSENT -> OD -> UNFILED. MISSED is not in the cycle.
function nextBulkStatus(current: BulkStatus | undefined): BulkStatus | null {
  if (!current) return "PRESENT";
  if (current === "PRESENT") return "ABSENT";
  if (current === "ABSENT") return "OD";
  return null; // OD -> back to unfiled
}

/** Only unfiled school days (incl. override-covered weekends/holidays) are selectable. */
function isSelectable(info: LedgerDayKind): boolean {
  return info.kind === "unfiled";
}

function inertNote(info: LedgerDayKind): string {
  const isFiled =
    info.kind === "normal" || info.kind === "full_absent" || (info.kind === "holiday" && info.filed);
  return isFiled
    ? "Already on the books — edit this day from its mark screen."
    : "No court was in session. Open the day to declare it first.";
}

export function LedgerBoard({ weeks }: { weeks: LedgerWeek[] }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [pending, setPending] = useState<Record<string, BulkStatus>>({});
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const count = Object.keys(pending).length;

  function enterSelect() {
    setSelecting(true);
    setPending({});
    setNote(null);
    setError(null);
  }

  function cancel() {
    setSelecting(false);
    setPending({});
    setNote(null);
    setError(null);
  }

  function tapSelectable(date: string) {
    setNote(null);
    setError(null);
    setPending((prev) => {
      const current = prev[date];
      if (!current && Object.keys(prev).length >= MAX_SELECTED) {
        setNote(`That's ${MAX_SELECTED} rounded up — file this batch first, then start another.`);
        return prev;
      }
      const next = nextBulkStatus(current);
      const copy = { ...prev };
      if (next === null) delete copy[date];
      else copy[date] = next;
      return copy;
    });
  }

  function tapInert(info: LedgerDayKind) {
    setError(null);
    setNote(inertNote(info));
  }

  function handleDone() {
    setNote(null);
    setError(null);
    const days = Object.entries(pending).map(([date, status]) => ({ date, status }));
    if (days.length === 0) {
      setSelecting(false);
      return;
    }

    startSaving(async () => {
      try {
        const result = await bulkSaveDayLogs(days);
        if (result.failed.length === 0) {
          setPending({});
          setSelecting(false);
          router.refresh(); // filed rows + recomputed percentages + poster
          return;
        }

        // Keep only the failed days pending; successful ones become filed rows
        // once the refresh lands.
        const stillPending: Record<string, BulkStatus> = {};
        for (const f of result.failed) {
          const chosen = pending[f.date];
          if (chosen) stillPending[f.date] = chosen;
        }
        setPending(stillPending);
        setError(
          `Couldn't file ${result.failed.length} day${result.failed.length === 1 ? "" : "s"}: ` +
            `${result.failed.map((f) => formatShortDate(f.date)).join(", ")}. ` +
            "They're still marked — try again. The rest went through."
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Filing failed. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls: SELECT becomes DONE in place; cancel + counter flank it while selecting. */}
      <div className="flex min-h-9 items-center justify-between gap-2">
        {selecting ? (
          <>
            <button
              type="button"
              onClick={cancel}
              disabled={isSaving}
              className="font-ledger text-xs uppercase text-ink-muted underline disabled:opacity-50"
            >
              Cancel
            </button>
            <span className="font-ledger text-xs uppercase tracking-wide text-ink-muted">
              {count} of {MAX_SELECTED} chosen
            </span>
            <button type="button" onClick={handleDone} disabled={isSaving}>
              <Stamp variant="ink" className={cn("text-xs", isSaving && "opacity-50")}>
                {isSaving ? "Filing..." : "Done"}
              </Stamp>
            </button>
          </>
        ) : (
          <>
            <span className="font-ledger text-xs uppercase tracking-wide text-ink-muted">
              Mark several days at once
            </span>
            <button type="button" onClick={enterSelect}>
              <Stamp variant="ink" className="text-xs">
                Select
              </Stamp>
            </button>
          </>
        )}
      </div>

      {note && (
        <div className="border border-border-dark bg-paper-dark px-3 py-2">
          <FlavorText className="text-sm">{note}</FlavorText>
        </div>
      )}
      {error && (
        <div className="border border-blood bg-paper-dark px-3 py-2">
          <FlavorText className="text-sm text-blood">{error}</FlavorText>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {weeks.map((week) => (
          <div key={week.weekStart} className="flex flex-col gap-1">
            <p className="font-ledger text-xs uppercase tracking-wide text-ink-muted">
              Week of {formatShortDate(week.weekStart)}
            </p>
            <div className="flex flex-col">
              {week.items.map((row) =>
                !selecting ? (
                  <LedgerDayRow
                    key={row.date}
                    date={row.date}
                    info={row.info}
                    percentage={row.percentage}
                    isToday={row.isToday}
                  />
                ) : isSelectable(row.info) ? (
                  <button
                    key={row.date}
                    type="button"
                    onClick={() => tapSelectable(row.date)}
                    disabled={isSaving}
                    aria-pressed={row.date in pending}
                    className={cn(
                      "block w-full border-b border-l-4 border-border-dark py-2 pl-3 pr-2 text-left transition-colors hover:bg-paper-dark",
                      row.date in pending ? "border-l-brass bg-paper-dark" : "border-l-transparent"
                    )}
                  >
                    <LedgerRowBody
                      date={row.date}
                      info={row.info}
                      percentage={row.percentage}
                      pendingStatus={pending[row.date] ?? null}
                    />
                  </button>
                ) : (
                  <button
                    key={row.date}
                    type="button"
                    onClick={() => tapInert(row.info)}
                    className="block w-full cursor-not-allowed border-b border-l-4 border-l-transparent border-border-dark py-2 pl-3 pr-2 text-left opacity-40"
                  >
                    <LedgerRowBody date={row.date} info={row.info} percentage={row.percentage} />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
