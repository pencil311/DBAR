"use client";

import Link from "next/link";
import { FlavorText, Stamp } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDisplayDate } from "@/lib/dates";
import type { LedgerDayKind } from "@/lib/ledgerClassify";

/** The three statuses a whole day can be bulk-filed with from the Ledger. */
export type BulkStatus = "PRESENT" | "ABSENT" | "OD";

const BULK_STATUS_LABEL: Record<BulkStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  OD: "OD",
};

// Reuse the mark-screen chip palette so a pending bulk choice reads the same.
const BULK_STATUS_CLASS: Record<BulkStatus, string> = {
  PRESENT: "border-ink text-ink",
  ABSENT: "border-blood text-blood",
  OD: "border-brass text-brass",
};

/** The cumulative overall percentage as it stood after this day was counted. */
function CumulativePct({ percentage }: { percentage: number }) {
  return (
    <span
      className={cn(
        "shrink-0 font-ledger text-sm tabular-nums",
        percentage < 80 ? "text-blood" : "text-ink"
      )}
    >
      {percentage.toFixed(1)}%
    </span>
  );
}

function RightSide({ info, percentage }: { info: LedgerDayKind; percentage: number | null }) {
  switch (info.kind) {
    case "weekend":
      return <span className="font-ledger text-sm text-ink-muted">—</span>;
    case "holiday":
      return (
        <div className="flex items-center gap-2">
          <FlavorText className="text-sm">{info.name ?? "Holiday"}</FlavorText>
          {info.filed && (
            <Stamp variant="ink" className="!border-ink-muted !px-2 !py-0.5 text-xs !text-ink-muted">
              Filed
            </Stamp>
          )}
        </div>
      );
    case "unfiled":
      return (
        <Stamp variant="blood" className="!px-2 !py-0.5 text-xs">
          Unfiled
        </Stamp>
      );
    case "full_absent":
      return (
        <div className="flex items-center gap-2">
          <span className="font-ledger text-sm uppercase tracking-wide text-blood">Full Day Absent</span>
          {percentage !== null && <CumulativePct percentage={percentage} />}
        </div>
      );
    case "normal":
      return (
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap items-center justify-end gap-x-1 font-ledger text-sm">
            <span className="text-ink">P {info.present}</span>
            {info.absent > 0 && <span className="text-blood">· A {info.absent}</span>}
            {info.missed > 0 && (
              <span className="text-ink underline decoration-dashed decoration-blood underline-offset-2">
                · M {info.missed}
              </span>
            )}
            {info.od > 0 && <span className="text-brass">· OD {info.od}</span>}
            {info.cancelled > 0 && <span className="text-ink-muted">· C {info.cancelled}</span>}
          </div>
          {percentage !== null && <CumulativePct percentage={percentage} />}
        </div>
      );
  }
}

export interface LedgerRowBodyProps {
  date: string;
  info: LedgerDayKind;
  percentage: number | null;
  /** When set (selection mode), show the pending bulk choice instead of the tally. */
  pendingStatus?: BulkStatus | null;
}

/** The inner date + right-hand status/percentage; shared by link rows and selection rows. */
export function LedgerRowBody({ date, info, percentage, pendingStatus = null }: LedgerRowBodyProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="shrink-0 font-ledger text-sm text-ink">{formatDisplayDate(date)}</span>
      {pendingStatus ? (
        <span
          className={cn(
            "shrink-0 border px-2 py-0.5 font-ledger text-xs uppercase",
            BULK_STATUS_CLASS[pendingStatus]
          )}
        >
          {BULK_STATUS_LABEL[pendingStatus]}
        </span>
      ) : (
        <RightSide info={info} percentage={percentage} />
      )}
    </div>
  );
}

export interface LedgerDayRowProps {
  date: string;
  info: LedgerDayKind;
  percentage: number | null;
  isToday: boolean;
}

export function LedgerDayRow({ date, info, percentage, isToday }: LedgerDayRowProps) {
  return (
    <Link href={`/mark/${date}`} className="block">
      <div
        className={cn(
          "border-b border-l-4 border-border-dark py-2 pl-3 pr-2 transition-colors hover:bg-paper-dark",
          isToday ? "border-l-brass" : "border-l-transparent"
        )}
      >
        <LedgerRowBody date={date} info={info} percentage={percentage} />
      </div>
    </Link>
  );
}
