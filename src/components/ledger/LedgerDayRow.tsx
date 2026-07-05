import Link from "next/link";
import { FlavorText, Stamp } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDisplayDate } from "@/lib/dates";

export type LedgerDayKind =
  | { kind: "weekend" }
  | { kind: "holiday"; name: string | null }
  | { kind: "unfiled" }
  | { kind: "full_absent" }
  | { kind: "normal"; present: number; absent: number; od: number; cancelled: number };

export interface LedgerDayRowProps {
  date: string;
  info: LedgerDayKind;
  isToday: boolean;
}

export function LedgerDayRow({ date, info, isToday }: LedgerDayRowProps) {
  const row = (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-l-4 border-border-dark py-2 pl-3 pr-2",
        isToday ? "border-l-brass" : "border-l-transparent"
      )}
    >
      <span className="font-ledger text-sm text-ink">{formatDisplayDate(date)}</span>
      <RightSide info={info} />
    </div>
  );

  if (info.kind === "weekend") {
    return row;
  }

  return (
    <Link href={`/mark/${date}`} className="block">
      {row}
    </Link>
  );
}

function RightSide({ info }: { info: LedgerDayKind }) {
  switch (info.kind) {
    case "weekend":
      return <span className="font-ledger text-sm text-ink-muted">—</span>;
    case "holiday":
      return <FlavorText className="text-sm">{info.name ?? "Holiday"}</FlavorText>;
    case "unfiled":
      return (
        <Stamp variant="blood" className="!px-2 !py-0.5 text-xs">
          Unfiled
        </Stamp>
      );
    case "full_absent":
      return (
        <span className="font-ledger text-sm uppercase tracking-wide text-blood">Full Day Absent</span>
      );
    case "normal":
      return (
        <div className="flex items-center gap-1 font-ledger text-sm">
          <span className="text-ink">P {info.present}</span>
          {info.absent > 0 && <span className="text-blood">· A {info.absent}</span>}
          {info.od > 0 && <span className="text-brass">· OD {info.od}</span>}
          {info.cancelled > 0 && <span className="text-ink-muted">· C {info.cancelled}</span>}
        </div>
      );
  }
}
