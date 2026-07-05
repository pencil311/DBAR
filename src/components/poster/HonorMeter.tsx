"use client";

import { useEffect, useState } from "react";
import { Heading, FlavorText } from "@/components/ui";
import { CowboyHat } from "@/components/poster/CowboyHat";
import { MeterTrack } from "@/components/poster/MeterTrack";

const HAT_WIDTH = 34;

function scoreWord(score: number): string {
  if (score >= 80) return "Upstanding";
  if (score >= 60) return "Respected";
  if (score >= 40) return "Drifter";
  if (score >= 20) return "Outlaw";
  return "Ruthless";
}

function fillColorClass(score: number): string {
  if (score >= 60) return "bg-lawful";
  if (score >= 40) return "bg-brass";
  return "bg-blood";
}

export interface HonorMeterProps {
  score: number;
  flavorLine: string;
}

export function HonorMeter({ score, flavorLine }: HonorMeterProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplayScore(score));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Heading size="sm" as="h2">
          Honor
        </Heading>
        <span className="font-ledger text-sm uppercase tracking-wide text-ink">{scoreWord(score)}</span>
      </div>

      <MeterTrack percent={displayScore} colorClass={fillColorClass(score)} className="mt-4">
        <div
          className="meter-hat absolute top-1/2 -translate-y-1/2 transition-[left] duration-300 ease-out"
          style={{ left: `calc(${displayScore}% - ${HAT_WIDTH / 2}px)` }}
        >
          <CowboyHat size={HAT_WIDTH} />
        </div>
      </MeterTrack>

      <FlavorText className="text-sm">{flavorLine}</FlavorText>
    </div>
  );
}
