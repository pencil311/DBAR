import Link from "next/link";
import { formatShortDate } from "@/lib/dates";

const MAX_VISIBLE = 5;

export function UnfiledWarrantsStrip({ dates }: { dates: string[] }) {
  const visible = dates.slice(0, MAX_VISIBLE);
  const overflow = dates.length - visible.length;

  return (
    <div className="flex items-center gap-2 overflow-x-auto border border-border-dark bg-paper-dark px-3 py-2 font-ledger text-xs uppercase tracking-wide">
      <span className="shrink-0 text-ink">Unfiled:</span>
      {visible.map((date, i) => (
        <span key={date} className="flex shrink-0 items-center gap-2">
          <Link href={`/mark/${date}`} className="text-blood underline underline-offset-2">
            {formatShortDate(date)}
          </Link>
          {i < visible.length - 1 && <span className="text-ink-muted">·</span>}
        </span>
      ))}
      {overflow > 0 && <span className="shrink-0 text-ink-muted">+{overflow} more</span>}
    </div>
  );
}
