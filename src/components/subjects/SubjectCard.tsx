import { Heading, PosterFrame } from "@/components/ui";
import { MeterTrack } from "@/components/poster/MeterTrack";
import { cn } from "@/lib/cn";
import { formatCredits } from "@/lib/subjectCredits";

export interface SubjectCardProps {
  code: string;
  name: string;
  occurred: number;
  attended: number;
  percentage: number;
}

export function SubjectCard({ code, name, occurred, attended, percentage }: SubjectCardProps) {
  if (occurred === 0) {
    return (
      <PosterFrame variant="paper-dark">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-ledger text-ink-muted">{name}</span>
            <span className="font-ledger text-xs text-ink-muted">
              {code} · {formatCredits(code)} cr
            </span>
          </div>
          <span className="shrink-0 font-ledger text-xs uppercase tracking-wide text-ink-muted">
            No sessions yet.
          </span>
        </div>
      </PosterFrame>
    );
  }

  const danger = percentage < 80;

  return (
    <PosterFrame>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-ledger text-ink">{name}</span>
            <span className="font-ledger text-xs text-ink-muted">
              {code} · {formatCredits(code)} cr
            </span>
          </div>
          <Heading size="lg" as="p" className={cn(danger && "!text-blood")}>
            {percentage.toFixed(1)}%
          </Heading>
        </div>
        <p className="font-ledger text-sm text-ink-muted">
          {attended} of {occurred} periods answered
        </p>
        <MeterTrack percent={percentage} colorClass={danger ? "bg-blood" : "bg-lawful"} />
      </div>
    </PosterFrame>
  );
}
