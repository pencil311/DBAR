"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FlavorText, Stamp } from "@/components/ui";
import { createClass } from "@/lib/actions/settings";
import { type CreatePeriodInput } from "@/lib/classValidation";
import { addDays, todayIST } from "@/lib/dates";
import { WEEKDAYS, type Weekday } from "@/lib/weekday";

interface PeriodDraft {
  subjectCode: string;
  subjectName: string;
  isElectiveSlot: boolean;
  countsForAttendance: boolean;
  mergeWithNext: boolean;
}

function blankPeriod(): PeriodDraft {
  return {
    subjectCode: "",
    subjectName: "",
    isElectiveSlot: false,
    countsForAttendance: true,
    mergeWithNext: false,
  };
}

function blankTimetable(): Record<Weekday, PeriodDraft[]> {
  const result = {} as Record<Weekday, PeriodDraft[]>;
  for (const weekday of WEEKDAYS) {
    result[weekday] = Array.from({ length: 8 }, blankPeriod);
  }
  return result;
}

/** Chains consecutive "merge with next" toggles into one shared labGroupId per run. */
function assignLabGroupIds(periods: PeriodDraft[], weekday: Weekday): (string | null)[] {
  const ids: (string | null)[] = new Array(periods.length).fill(null);
  let counter = 0;
  let i = 0;
  while (i < periods.length) {
    if (periods[i].mergeWithNext && i + 1 < periods.length) {
      const groupId = `${weekday}-LAB${++counter}`;
      let j = i;
      ids[j] = groupId;
      while (periods[j]?.mergeWithNext && j + 1 < periods.length) {
        j += 1;
        ids[j] = groupId;
      }
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return ids;
}

export function ForgeOutfitForm({ onDone }: { onDone: () => void }) {
  const { update } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [semesterStart, setSemesterStart] = useState(todayIST());
  const [semesterEnd, setSemesterEnd] = useState(addDays(todayIST(), 150));
  const [timetable, setTimetable] = useState<Record<Weekday, PeriodDraft[]>>(blankTimetable);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updatePeriod(weekday: Weekday, index: number, patch: Partial<PeriodDraft>) {
    setTimetable((prev) => ({
      ...prev,
      [weekday]: prev[weekday].map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Give this outfit a name.");
      return;
    }
    if (semesterStart > semesterEnd) {
      setError("Semester start must be on or before semester end.");
      return;
    }
    for (const weekday of WEEKDAYS) {
      for (const p of timetable[weekday]) {
        if (!p.subjectCode.trim() || !p.subjectName.trim()) {
          setError(`Fill in every period's code and name — ${weekday} is missing one.`);
          return;
        }
      }
    }

    const payloadTimetable = {} as Record<Weekday, CreatePeriodInput[]>;
    for (const weekday of WEEKDAYS) {
      const labIds = assignLabGroupIds(timetable[weekday], weekday);
      payloadTimetable[weekday] = timetable[weekday].map((p, i) => ({
        periodNo: i + 1,
        subjectCode: p.subjectCode.trim(),
        subjectName: p.subjectName.trim(),
        isElectiveSlot: p.isElectiveSlot,
        countsForAttendance: p.countsForAttendance,
        labGroupId: labIds[i],
      }));
    }

    startTransition(async () => {
      try {
        const { classId } = await createClass({
          name: name.trim(),
          semesterStart,
          semesterEnd,
          timetable: payloadTimetable,
        });
        await update({ classId });
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the outfit.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Outfit name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border border-ink bg-paper px-2 py-1 font-ledger text-sm"
      />

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-ledger text-xs uppercase text-ink-muted">Semester start</span>
          <input
            type="date"
            value={semesterStart}
            onChange={(e) => setSemesterStart(e.target.value)}
            className="border border-ink bg-paper px-2 py-1 font-ledger text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-ledger text-xs uppercase text-ink-muted">Semester end</span>
          <input
            type="date"
            value={semesterEnd}
            onChange={(e) => setSemesterEnd(e.target.value)}
            className="border border-ink bg-paper px-2 py-1 font-ledger text-sm"
          />
        </label>
      </div>

      {WEEKDAYS.map((weekday) => (
        <details key={weekday} className="border border-border-dark">
          <summary className="cursor-pointer bg-paper-dark px-2 py-1 font-ledger text-sm uppercase tracking-wide text-ink">
            {weekday}
          </summary>
          <div className="flex flex-col gap-2 p-2">
            {timetable[weekday].map((p, i) => (
              <div key={i} className="flex flex-col gap-1 border border-border-dark p-2">
                <div className="flex items-center gap-1">
                  <span className="w-6 shrink-0 font-ledger text-xs text-ink-muted">P{i + 1}</span>
                  <input
                    type="text"
                    placeholder="Code"
                    value={p.subjectCode}
                    onChange={(e) => updatePeriod(weekday, i, { subjectCode: e.target.value })}
                    className="w-20 border border-ink bg-paper px-1 py-0.5 font-ledger text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Name"
                    value={p.subjectName}
                    onChange={(e) => updatePeriod(weekday, i, { subjectName: e.target.value })}
                    className="min-w-0 flex-1 border border-ink bg-paper px-1 py-0.5 font-ledger text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-3 font-ledger text-xs text-ink-muted">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={p.isElectiveSlot}
                      onChange={(e) => updatePeriod(weekday, i, { isElectiveSlot: e.target.checked })}
                    />
                    Elective
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!p.countsForAttendance}
                      onChange={(e) => updatePeriod(weekday, i, { countsForAttendance: !e.target.checked })}
                    />
                    Not counted
                  </label>
                  {i < 7 && (
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={p.mergeWithNext}
                        onChange={(e) => updatePeriod(weekday, i, { mergeWithNext: e.target.checked })}
                      />
                      Merge with next
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}

      {error && <FlavorText className="text-sm text-blood">{error}</FlavorText>}

      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={isPending} className="flex-1">
          <Stamp variant="ink" className="block w-full text-center disabled:opacity-50">
            {isPending ? "Forging..." : "Forge Outfit"}
          </Stamp>
        </button>
        <button type="button" onClick={onDone} disabled={isPending}>
          <Stamp variant="ink" className="!border-ink-muted !text-ink-muted text-center disabled:opacity-50">
            Cancel
          </Stamp>
        </button>
      </div>
    </div>
  );
}
