"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Heading, FlavorText, PosterFrame, Stamp } from "@/components/ui";
import { setElective } from "@/lib/actions/settings";
import { cn } from "@/lib/cn";

type Elective = "AE" | "FSWD";

const OPTIONS: { value: Elective; label: string }[] = [
  { value: "AE", label: "AE — AI Engineering" },
  { value: "FSWD", label: "FSWD — Full Stack" },
];

export interface ElectiveCardProps {
  elective: Elective | null;
}

export function ElectiveCard({ elective }: ElectiveCardProps) {
  const { update } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState(elective);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(value: Elective) {
    if (value === current) return;
    setError(null);
    startTransition(async () => {
      try {
        await setElective(value);
        await update({ elective: value });
        setCurrent(value);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save. Try again.");
      }
    });
  }

  return (
    <PosterFrame>
      <Heading size="sm" as="h2">
        The Elective
      </Heading>
      <div className="mt-2 flex flex-col gap-2">
        {OPTIONS.map((opt) => (
          <button key={opt.value} type="button" onClick={() => choose(opt.value)} disabled={isPending}>
            <Stamp
              variant={current === opt.value ? "brass" : "ink"}
              className={cn("block w-full text-center", isPending && "opacity-50")}
            >
              {isPending && current !== opt.value ? "Saving..." : opt.label}
            </Stamp>
          </button>
        ))}
      </div>
      {error && <FlavorText className="mt-2 text-blood">{error}</FlavorText>}
    </PosterFrame>
  );
}
