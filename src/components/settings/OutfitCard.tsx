"use client";

import { useState } from "react";
import { Heading, FlavorText, PosterFrame, Stamp } from "@/components/ui";
import { JoinOutfitFlow, type JoinableClass } from "@/components/settings/JoinOutfitFlow";
import { ForgeOutfitForm } from "@/components/settings/ForgeOutfitForm";
import { HolidayRegistry, type HolidayEntry } from "@/components/settings/HolidayRegistry";

export interface OutfitCardProps {
  currentClassId: string | null;
  currentClassName: string | null;
  holidays: HolidayEntry[];
  joinableClasses: JoinableClass[];
}

type Mode = "view" | "join" | "forge";

export function OutfitCard({ currentClassId, currentClassName, holidays, joinableClasses }: OutfitCardProps) {
  const [mode, setMode] = useState<Mode>("view");

  return (
    <PosterFrame>
      <Heading size="sm" as="h2">
        The Outfit
      </Heading>

      <div className="mt-2 flex flex-col gap-3">
        {currentClassName ? (
          <>
            <p className="font-ledger text-ink">Riding with: {currentClassName}</p>
            {currentClassId && <HolidayRegistry classId={currentClassId} holidays={holidays} />}
          </>
        ) : (
          <FlavorText className="text-sm">You haven&rsquo;t joined an outfit yet.</FlavorText>
        )}

        {mode === "view" && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("join")} className="flex-1">
              <Stamp variant="ink" className="block w-full text-center text-xs">
                {currentClassName ? "Switch Outfit" : "Join an Outfit"}
              </Stamp>
            </button>
            <button type="button" onClick={() => setMode("forge")} className="flex-1">
              <Stamp variant="ink" className="block w-full text-center text-xs">
                Forge a New Outfit
              </Stamp>
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="flex flex-col gap-2">
            <JoinOutfitFlow
              classes={joinableClasses}
              currentClassId={currentClassId}
              onDone={() => setMode("view")}
            />
            <button type="button" onClick={() => setMode("view")} className="self-start">
              <Stamp variant="ink" className="!border-ink-muted !text-ink-muted text-xs">
                Back
              </Stamp>
            </button>
          </div>
        )}

        {mode === "forge" && <ForgeOutfitForm onDone={() => setMode("view")} />}
      </div>
    </PosterFrame>
  );
}
