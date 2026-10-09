"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import type { PeriodGroup } from "@/lib/periodGroups";
import type { PeriodStatus } from "@/lib/models/DayLog";

const LONG_PRESS_MS = 500;

export const STATUS_LABEL: Record<PeriodStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  OD: "OD",
  MISSED: "Missed",
  CANCELLED: "Cancelled",
};

const STATUS_CLASSES: Record<PeriodStatus, string> = {
  PRESENT: "border-ink text-ink",
  ABSENT: "border-blood text-blood",
  OD: "border-brass text-brass",
  // Counted as present officially (ink text), but something's off: a dashed
  // blood border. The "Missed" text label carries the meaning, never colour alone.
  MISSED: "border-dashed border-blood text-ink",
  CANCELLED: "border-ink-muted text-ink-muted",
};

export interface PeriodChipProps {
  group: PeriodGroup;
  status: PeriodStatus;
  /**
   * Visually (and functionally) forces a single status look across the chip,
   * e.g. ABSENT during a pending Full Day Absent, or OD during a pending Full
   * Day OD. The chip is non-interactive while forced.
   */
  forcedStatus?: PeriodStatus | null;
  onTap: () => void;
  onLongPress: () => void;
}

function periodRangeLabel(periodNos: number[]): string {
  return periodNos.length > 1
    ? `P${periodNos[0]}–P${periodNos[periodNos.length - 1]}`
    : `P${periodNos[0]}`;
}

export function PeriodChip({ group, status, forcedStatus = null, onTap, onLongPress }: PeriodChipProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  if (!group.countsForAttendance) {
    return (
      <div className="no-callout flex items-center justify-between border border-border-dark bg-paper-dark px-3 py-3 opacity-60">
        <span className="font-ledger text-ink-muted">
          {periodRangeLabel(group.periodNos)} · {group.subjectName}
        </span>
        <span className="font-ledger text-xs uppercase text-ink-muted">Not counted</span>
      </div>
    );
  }

  const interactive = forcedStatus === null;
  const effectiveStatus: PeriodStatus = forcedStatus ?? status;

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown() {
    if (!interactive) return;
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function handleClick() {
    if (!interactive) return;
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onTap();
  }

  return (
    <button
      type="button"
      disabled={!interactive}
      onPointerDown={handlePointerDown}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "no-callout flex items-center justify-between border-2 px-3 py-3 text-left transition-colors",
        STATUS_CLASSES[effectiveStatus],
        !interactive && "cursor-default"
      )}
    >
      <span className={cn("font-ledger", effectiveStatus === "CANCELLED" && "line-through decoration-2")}>
        {periodRangeLabel(group.periodNos)} · {group.subjectName}
      </span>
      <span className="font-ledger text-xs uppercase">{STATUS_LABEL[effectiveStatus]}</span>
    </button>
  );
}
