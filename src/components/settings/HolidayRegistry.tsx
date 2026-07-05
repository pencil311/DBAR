"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlavorText, Stamp } from "@/components/ui";
import { addHoliday, removeHoliday } from "@/lib/actions/settings";
import { formatDisplayDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

export interface HolidayEntry {
  date: string;
  name: string;
}

export interface HolidayRegistryProps {
  classId: string;
  holidays: HolidayEntry[];
}

export function HolidayRegistry({ classId, holidays }: HolidayRegistryProps) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removingDate, setRemovingDate] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await addHoliday(classId, date, name);
        setDate("");
        setName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add holiday.");
      }
    });
  }

  function handleRemove(d: string) {
    setError(null);
    setRemovingDate(d);
    startTransition(async () => {
      try {
        await removeHoliday(classId, d);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove holiday.");
      } finally {
        setRemovingDate(null);
      }
    });
  }

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-2 border-t border-dotted border-ink-muted pt-3">
      <p className="font-ledger text-xs uppercase tracking-wide text-ink-muted">Holiday Registry</p>

      {sorted.length === 0 ? (
        <FlavorText className="text-sm">No holidays recorded.</FlavorText>
      ) : (
        sorted.map((h) => (
          <div key={h.date} className="flex items-center justify-between gap-2">
            <span className="font-ledger text-sm text-ink">
              {formatDisplayDate(h.date)} — {h.name}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(h.date)}
              disabled={isPending}
              aria-label={`Remove ${h.name}`}
              className="shrink-0 font-ledger text-blood disabled:opacity-50"
            >
              {removingDate === h.date ? "..." : "✕"}
            </button>
          </div>
        ))
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-ink bg-paper px-2 py-1 font-ledger text-sm"
        />
        <input
          type="text"
          placeholder="Holiday name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 border border-ink bg-paper px-2 py-1 font-ledger text-sm"
        />
        <button type="button" onClick={handleAdd} disabled={isPending || !date || !name.trim()}>
          <Stamp
            variant="ink"
            className={cn("block w-full text-center text-xs sm:w-auto", isPending && "opacity-50")}
          >
            {isPending && removingDate === null ? "Adding..." : "Add"}
          </Stamp>
        </button>
      </div>

      {error && <FlavorText className="text-sm text-blood">{error}</FlavorText>}
    </div>
  );
}
