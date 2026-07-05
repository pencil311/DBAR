import { PosterFrame } from "@/components/ui";
import { StarBadge } from "@/components/poster/StarBadge";

export interface MarshalNoticeProps {
  days: number;
  dateLabel: string;
  showWarning: boolean;
}

export function MarshalNotice({ days, dateLabel, showWarning }: MarshalNoticeProps) {
  return (
    <PosterFrame variant="paper-dark">
      <div className="flex items-center gap-3">
        <StarBadge />
        <div className="flex flex-col gap-0.5">
          <p className="font-ledger text-sm uppercase tracking-wide text-ink">
            YOU HAVE {days} Days LEFT — Attendance Verification, {dateLabel}
          </p>
          {showWarning && (
            <p className="font-ledger text-xs uppercase tracking-wide text-blood">
              Get your ATTENDANCE in order.
            </p>
          )}
        </div>
      </div>
    </PosterFrame>
  );
}
