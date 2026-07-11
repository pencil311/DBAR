"use client";

import { useState, useTransition } from "react";
import { PosterFrame, Heading } from "@/components/ui";
import { setTargetGrade, setInternalMarks } from "@/lib/actions/gradePlan";
import {
  realisticTargetMarks,
  requiredEndSem,
  internalTotal,
  CONCEPT_TEST_MAX,
  CAT_MAX,
  ASSIGNMENT_WEIGHT,
  ENDSEM_MAX,
  INTERNAL_MAX,
  INTERNAL_PASS_MIN,
  type GradeLetter,
} from "@/lib/grades";
import { cn } from "@/lib/cn";
import { formatCredits } from "@/lib/subjectCredits";
import type { IInternalMarks } from "@/lib/models/SubjectPlan";

const SELECTABLE: GradeLetter[] = ["O", "A+", "A", "B+", "B"];

export interface GradePlannerCardProps {
  code: string;
  name: string;
  targetGrade: GradeLetter | null;
  internals: IInternalMarks[];
}

function AimRow({ label, need, max, isActual }: { label: string; need: number; max: number; isActual: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-ledger text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={isActual ? "text-brass font-bold" : "text-ink"}>
        <span className="font-poster text-base">{Math.ceil(need)}</span>
        <span className="text-ink-muted"> / {max}</span>
      </span>
    </div>
  );
}

function EditRow({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  max: number;
  onChange: (val: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 font-ledger text-sm">
      <span className="text-ink-muted">{label}</span>
      <div className="flex items-baseline">
        <input
          type="number"
          min={0}
          max={max}
          step={0.1}
          value={value === null ? "" : value}
          onChange={(e) => {
            if (e.target.value === "") onChange(null);
            else onChange(Math.min(Math.max(Number(e.target.value), 0), max));
          }}
          className="w-16 border-b-2 border-border-dark bg-transparent text-right font-poster text-base text-ink outline-none focus:border-brass"
        />
        <span className="ml-1 text-ink-muted">/ {max}</span>
      </div>
    </div>
  );
}

export function GradePlannerCard({ code, name, targetGrade, internals }: GradePlannerCardProps) {
  const [target, setTarget] = useState<GradeLetter | null>(targetGrade);
  const [actualInternals, setActualInternals] = useState<IInternalMarks[]>(internals);
  
  const [isEditing, setIsEditing] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [draft, setDraft] = useState<IInternalMarks[]>([
    actualInternals[0] ?? { conceptTest: null, cat: null, assignment: null },
    actualInternals[1] ?? { conceptTest: null, cat: null, assignment: null },
  ]);

  const [isPending, startTransition] = useTransition();

  function choose(grade: GradeLetter) {
    setTarget(grade); // optimistic
    startTransition(() => {
      void setTargetGrade(code, grade);
    });
  }

  function handleSave() {
    setIsEditing(false);
    setActualInternals(draft);
    startTransition(() => {
      void setInternalMarks(code, draft);
    });
  }

  function handleCancel() {
    setIsEditing(false);
    setDraft([
      actualInternals[0] ?? { conceptTest: null, cat: null, assignment: null },
      actualInternals[1] ?? { conceptTest: null, cat: null, assignment: null },
    ]);
  }

  const plan = target ? realisticTargetMarks(target) : null;
  
  const blendedInternals = [0, 1].map((n) => {
    const actual = actualInternals[n] ?? { conceptTest: null, cat: null, assignment: null };
    const planned = plan?.perInternal ?? { conceptTest: 0, cat: 0, assignment: 0 };
    return {
      conceptTest: actual.conceptTest ?? planned.conceptTest,
      cat: actual.cat ?? planned.cat,
      assignment: actual.assignment ?? planned.assignment,
      isActualCT: actual.conceptTest !== null,
      isActualCAT: actual.cat !== null,
      isActualAssign: actual.assignment !== null,
    };
  });

  const blendedTotal = internalTotal(blendedInternals);
  const endSemReq = target ? requiredEndSem(blendedTotal, target) : null;

  async function handleAskAI(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuery.trim() || isAiLoading) return;
    
    setIsAiLoading(true);
    setAiError(null);
    setAiResponse(null);
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: `Context: Subject ${name} (${code}). ${aiQuery}` }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "The Marshal's gone quiet.");
      } else {
        setAiResponse(data.reply ?? "");
      }
    } catch {
      setAiError("Couldn't reach the Marshal.");
    } finally {
      setIsAiLoading(false);
      setAiQuery("");
    }
  }

  return (
    <PosterFrame>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-ledger text-ink">{name}</span>
            <span className="font-ledger text-xs text-ink-muted">
              {code} · {formatCredits(code)} {formatCredits(code) === "1" ? "credit" : "credits"}
            </span>
          </div>
          {target && (
            <Heading size="lg" as="p" className="!text-brass">
              {target}
            </Heading>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-ledger text-xs uppercase tracking-wide text-ink-muted">
            Name your bounty
          </span>
          <div className="flex gap-1">
            {SELECTABLE.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => choose(grade)}
                disabled={isPending || isEditing}
                className={cn(
                  "flex-1 border-[3px] py-1 font-poster text-sm uppercase tracking-widest transition-colors disabled:opacity-100 disabled:cursor-wait",
                  grade === target
                    ? "border-brass text-brass"
                    : "border-border-dark text-ink-muted hover:text-ink disabled:hover:text-ink-muted"
                )}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>

        {plan && (
          <div className="flex flex-col gap-3 border-t border-border-dark pt-3">
            <div className="flex items-center justify-between">
              <p className="font-ledger text-sm text-ink-muted">
                Land a final of <span className="text-ink">{plan.finalNeeded}%</span> and it&apos;s yours.
              </p>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="font-ledger text-xs uppercase tracking-wide text-brass hover:underline"
                >
                  ✎ Edit Marks
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1].map((n) => (
                <div key={n} className="flex flex-col gap-1 border border-border-dark p-2 rounded-sm bg-paper-dark">
                  <span className="font-ledger text-xs uppercase tracking-wide text-brass">
                    Internal {n + 1}
                  </span>
                  
                  {isEditing ? (
                    <>
                      <EditRow
                        label="Concept Test"
                        value={draft[n].conceptTest}
                        max={CONCEPT_TEST_MAX}
                        onChange={(v) => {
                          const d = [...draft];
                          d[n] = { ...d[n], conceptTest: v };
                          setDraft(d);
                        }}
                      />
                      <EditRow
                        label="CAT"
                        value={draft[n].cat}
                        max={CAT_MAX}
                        onChange={(v) => {
                          const d = [...draft];
                          d[n] = { ...d[n], cat: v };
                          setDraft(d);
                        }}
                      />
                      <EditRow
                        label="Assignments"
                        value={draft[n].assignment}
                        max={ASSIGNMENT_WEIGHT}
                        onChange={(v) => {
                          const d = [...draft];
                          d[n] = { ...d[n], assignment: v };
                          setDraft(d);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <AimRow
                        label="Concept Test"
                        need={blendedInternals[n].conceptTest}
                        max={CONCEPT_TEST_MAX}
                        isActual={blendedInternals[n].isActualCT}
                      />
                      <AimRow
                        label="CAT"
                        need={blendedInternals[n].cat}
                        max={CAT_MAX}
                        isActual={blendedInternals[n].isActualCAT}
                      />
                      <AimRow
                        label="Assignments"
                        need={blendedInternals[n].assignment}
                        max={ASSIGNMENT_WEIGHT}
                        isActual={blendedInternals[n].isActualAssign}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {isEditing && (
              <div className="flex justify-end gap-2 mt-2 border-b border-border-dark pb-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1 font-ledger text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-1 font-ledger text-sm bg-brass text-paper font-bold transition-colors hover:opacity-90"
                >
                  Save Marks
                </button>
              </div>
            )}

            {!isEditing && endSemReq && (
              <div className="border-t border-border-dark pt-2">
                <AimRow 
                  label="End-Sem Exam" 
                  need={endSemReq.needed} 
                  max={ENDSEM_MAX} 
                  isActual={false} 
                />
              </div>
            )}

            <p className="font-ledger text-xs text-ink-muted">
              {endSemReq ? (
                <>
                  You need to score <span className="text-ink">{Math.ceil(endSemReq.needed)}</span> in end sem to get <span className="text-ink font-bold">{target}</span> grade.
                </>
              ) : (
                <>Internals must total ≥ {INTERNAL_PASS_MIN}/{INTERNAL_MAX} to pass at all.</>
              )}
            </p>
          </div>
        )}

        <div className="border-t border-border-dark pt-3 mt-1 flex flex-col gap-2">
          {aiResponse && (
            <div className="p-2 border-l-2 border-brass bg-paper-dark font-ledger text-sm text-ink whitespace-pre-wrap">
              {aiResponse}
            </div>
          )}
          {aiError && (
            <div className="font-ledger text-sm text-blood">
              {aiError}
            </div>
          )}
          <form 
            onSubmit={handleAskAI}
            className="flex items-center gap-2 border border-border-dark bg-paper-dark px-2 py-1 focus-within:border-brass transition-colors"
          >
            <span className="font-poster text-[10px] text-brass uppercase border border-brass px-1 rounded-sm shrink-0">AI</span>
            <input 
              type="text" 
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              placeholder={`Ask Marshal about ${code}...`}
              disabled={isAiLoading}
              className="flex-1 bg-transparent border-none outline-none font-ledger text-sm text-ink placeholder:text-ink-muted min-w-0"
            />
            {isAiLoading && <span className="font-ledger text-xs text-ink-muted shrink-0">Asking...</span>}
          </form>
        </div>
      </div>
    </PosterFrame>
  );
}
