"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FlavorText, Stamp } from "@/components/ui";
import { assignClassToUser } from "@/lib/actions/assignClass";

export interface JoinableClass {
  id: string;
  name: string;
  memberCount: number;
}

export interface JoinOutfitFlowProps {
  classes: JoinableClass[];
  currentClassId: string | null;
  onDone: () => void;
}

export function JoinOutfitFlow({ classes, currentClassId, onDone }: JoinOutfitFlowProps) {
  const { update } = useSession();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isJoining, startJoining] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const others = classes.filter((c) => c.id !== currentClassId);

  function selectRow(id: string) {
    setError(null);
    if (currentClassId) {
      setPendingId(id);
    } else {
      commit(id);
    }
  }

  function commit(id: string) {
    setError(null);
    startJoining(async () => {
      try {
        await assignClassToUser(id);
        await update({ classId: id });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not join. Try again.");
      }
    });
  }

  if (others.length === 0) {
    return <FlavorText className="text-sm">No other outfits exist yet.</FlavorText>;
  }

  return (
    <div className="flex flex-col gap-2">
      {others.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 border border-border-dark p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-ledger text-ink">{c.name}</span>
              <span className="font-ledger text-xs text-ink-muted">
                {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
              </span>
            </div>
            <button type="button" onClick={() => selectRow(c.id)} disabled={isJoining}>
              <Stamp variant="ink" className="text-xs">
                Join
              </Stamp>
            </button>
          </div>

          {pendingId === c.id && (
            <div className="flex flex-col gap-2 border-t border-dotted border-ink-muted pt-2">
              <FlavorText className="text-sm text-blood">
                Switching outfits keeps your logged days attached to you, but they&rsquo;ll be checked
                against {c.name}&rsquo;s timetable from now on — past stats may become unreliable.
              </FlavorText>
              <div className="flex gap-2">
                <button type="button" onClick={() => commit(c.id)} disabled={isJoining}>
                  <Stamp variant="blood" className="text-xs">
                    {isJoining ? "Switching..." : "Confirm Switch"}
                  </Stamp>
                </button>
                <button type="button" onClick={() => setPendingId(null)} disabled={isJoining}>
                  <Stamp variant="ink" className="text-xs">
                    Cancel
                  </Stamp>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {error && <FlavorText className="text-sm text-blood">{error}</FlavorText>}
    </div>
  );
}
