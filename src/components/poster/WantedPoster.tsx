import { Heading, FlavorText, PosterFrame } from "@/components/ui";
import type { BunkBudget, PosterState } from "@/lib/engine";

export interface WantedPosterProps {
  poster: PosterState;
  percentage: number;
  totalAttended: number;
  totalOccurred: number;
  budget: BunkBudget;
}

export function WantedPoster({
  poster,
  percentage,
  totalAttended,
  totalOccurred,
  budget,
}: WantedPosterProps) {
  const pctLabel = `${percentage.toFixed(1)}%`;
  const subLabel = `${totalAttended} of ${totalOccurred} periods answered`;
  const isEmpty = totalOccurred === 0;

  return (
    <PosterFrame>
      <div className="flex flex-col items-center gap-2 text-center">
        {poster === "LAWFUL" && (
          <>
            <Heading size="md" as="h2">
              Lawful Citizen
            </Heading>
            <Heading size="xl" as="p" className="animate-ink-settle">
              {pctLabel}
            </Heading>
            <p className="font-ledger text-sm text-ink-muted">{subLabel}</p>
            <FlavorText className="mt-2">
              {isEmpty ? "No record on file. Keep it that way." : "The county has no quarrel with you."}
            </FlavorText>
          </>
        )}

        {poster === "WANTED" && (
          <>
            <Heading size="lg" as="h2">
              Wanted
            </Heading>
            <Heading size="xl" as="p" className="!text-blood animate-ink-settle">
              {pctLabel}
            </Heading>
            <p className="font-ledger text-sm text-ink-muted">{subLabel}</p>
            <FlavorText className="mt-2">For creeping absenteeism.</FlavorText>
            <p className="mt-1 font-ledger text-sm uppercase tracking-wide text-blood">
              Bounty: {budget.canBunk} periods of freedom remain
            </p>
          </>
        )}

        {poster === "DEAD_OR_ALIVE" && (
          <>
            <Heading size="lg" as="h2">
              Wanted
            </Heading>
            <div className="-mx-4 self-stretch bg-blood py-1.5">
              <p className="text-center font-poster text-xl uppercase tracking-widest text-paper">
                Dead or Alive
              </p>
            </div>
            <Heading size="xl" as="p" className="!text-blood animate-ink-settle">
              {pctLabel}
            </Heading>
            <p className="font-ledger text-sm text-ink-muted">{subLabel}</p>
            <p className="mt-1 font-ledger text-sm uppercase tracking-wide text-blood">
              Attend {budget.mustAttend} straight periods to clear your name.
            </p>
          </>
        )}
      </div>
    </PosterFrame>
  );
}
