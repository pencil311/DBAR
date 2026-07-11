/**
 * Grade planner engine — the single source of truth for turning a subject's
 * internal (out of 200) and end-semester (out of 100) marks into a final mark
 * and letter grade, and for solving the inverse: "what do I still need on the
 * end-sem to reach a target grade?"
 *
 * Pure and DB-free, like {@link file://./engine.ts}. All the numbers below are
 * the LICET R-2024 combination the user confirmed:
 *   final(/100) = internal(/200) * 40  +  endSem(/100) * 60
 * The letter-grade thresholds are carried over from Anna University
 * Regulation-2017 (§15.1) as a documented assumption until the R-2024
 * regulation is supplied — change GRADE_TABLE in one place if they differ.
 */

/** How the raw component maxima map into the final 100. */
export const INTERNAL_MAX = 200;
export const ENDSEM_MAX = 100;
export const INTERNAL_WEIGHT = 40; // internal /200 contributes 40 of the final 100
export const ENDSEM_WEIGHT = 60; // end-sem /100 contributes 60 of the final 100

/**
 * Breakdown of a single internal (out of {@link INTERNAL_UNIT_MAX} = 100).
 * There are {@link INTERNALS_COUNT} of these per subject, summing to
 * {@link INTERNAL_MAX} = 200.
 *
 * Confirmed scaling: Concept Test is marked out of 30 and scaled to 20; CAT
 * out of 60 scaled to 40; Assignments count directly for 40.
 */
export const CONCEPT_TEST_MAX = 30;
export const CONCEPT_TEST_WEIGHT = 20;
export const CAT_MAX = 60;
export const CAT_WEIGHT = 40;
export const ASSIGNMENT_WEIGHT = 40; // counts directly, no scaling
export const INTERNAL_UNIT_MAX = CONCEPT_TEST_WEIGHT + CAT_WEIGHT + ASSIGNMENT_WEIGHT; // 100
export const INTERNALS_COUNT = 2;

/**
 * Hard pass gate: the combined internal (internals 1 + 2, out of
 * {@link INTERNAL_MAX} = 200) must reach this floor or the subject is a fail
 * (RA) regardless of the end-sem mark.
 */
export const INTERNAL_PASS_MIN = 90;

/**
 * Hard pass gate: the end-semester mark (out of {@link ENDSEM_MAX}) must reach
 * this floor or the subject is a fail (RA) regardless of internals.
 */
export const ENDSEM_PASS_MIN = 45;

/** Whether a combined internal total clears the pass floor. */
export function internalFloorMet(internalTotal: number): boolean {
  return clamp(internalTotal, INTERNAL_MAX) >= INTERNAL_PASS_MIN;
}

export interface InternalComponents {
  /** Concept Test raw mark, out of {@link CONCEPT_TEST_MAX}. */
  conceptTest: number;
  /** CAT raw mark, out of {@link CAT_MAX}. */
  cat: number;
  /** Assignment mark, out of {@link ASSIGNMENT_WEIGHT} (no scaling). */
  assignment: number;
}

/**
 * Scale one internal's raw components into its mark out of
 * {@link INTERNAL_UNIT_MAX} (100). Pure; clamps each raw input.
 */
export function scoreInternal(c: InternalComponents): number {
  const concept = (clamp(c.conceptTest, CONCEPT_TEST_MAX) / CONCEPT_TEST_MAX) * CONCEPT_TEST_WEIGHT;
  const cat = (clamp(c.cat, CAT_MAX) / CAT_MAX) * CAT_WEIGHT;
  const assignment = clamp(c.assignment, ASSIGNMENT_WEIGHT);
  return concept + cat + assignment;
}

/**
 * Sum the per-internal scores into the subject's internal total out of
 * {@link INTERNAL_MAX} (200). Pass one {@link InternalComponents} per internal.
 */
export function internalTotal(internals: InternalComponents[]): number {
  return internals.reduce((sum, c) => sum + scoreInternal(c), 0);
}

export type GradeLetter = "O" | "A+" | "A" | "B+" | "B" | "RA";

export interface GradeBand {
  letter: GradeLetter;
  points: number;
  /** Inclusive lower bound of the final mark (out of 100) for this grade. */
  min: number;
}

/**
 * Ordered high → low. A final mark earns the first band whose `min` it meets.
 * `RA` (min 0) is the catch-all fail band, so `gradeFor` is always total.
 */
export const GRADE_TABLE: readonly GradeBand[] = [
  { letter: "O", points: 10, min: 91 },
  { letter: "A+", points: 9, min: 81 },
  { letter: "A", points: 8, min: 71 },
  { letter: "B+", points: 7, min: 61 },
  { letter: "B", points: 6, min: 50 },
  { letter: "RA", points: 0, min: 0 },
];

function bandFor(letter: GradeLetter): GradeBand {
  const band = GRADE_TABLE.find((b) => b.letter === letter);
  if (!band) throw new Error(`Unknown grade letter: ${letter}`);
  return band;
}

/** Clamp a raw score into [0, max]; guards against dirty spreadsheet cells. */
function clamp(value: number, max: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

/**
 * Combine a subject's internal (out of {@link INTERNAL_MAX}) and end-sem (out
 * of {@link ENDSEM_MAX}) into the final mark out of 100. Raw floats in, raw
 * float out — round only where displayed.
 */
export function finalMark(internal: number, endSem: number): number {
  const i = clamp(internal, INTERNAL_MAX) / INTERNAL_MAX;
  const e = clamp(endSem, ENDSEM_MAX) / ENDSEM_MAX;
  return i * INTERNAL_WEIGHT + e * ENDSEM_WEIGHT;
}

/** The letter grade for a final mark (out of 100). Always resolves (→ RA). */
export function gradeFor(final: number): GradeBand {
  // GRADE_TABLE is high → low, so the first match is the best earned grade.
  return GRADE_TABLE.find((b) => final >= b.min) ?? bandFor("RA");
}

/** Convenience: internal + end-sem straight through to a letter grade. */
export function gradeForMarks(internal: number, endSem: number): GradeBand {
  return gradeFor(finalMark(internal, endSem));
}

/**
 * Like {@link gradeForMarks} but enforces the {@link INTERNAL_PASS_MIN} and
 * {@link ENDSEM_PASS_MIN} floors: a combined internal below 90 or an end-sem
 * below 45 is an automatic RA. Use this for the real pass/fail verdict once
 * actual marks exist.
 */
export function gradeForMarksGated(internal: number, endSem: number): GradeBand {
  if (!internalFloorMet(internal) || endSem < ENDSEM_PASS_MIN) return bandFor("RA");
  return gradeForMarks(internal, endSem);
}

export interface EndSemTarget {
  /** Can the target still be reached with a legal end-sem score (≤ 100)? */
  achievable: boolean;
  /** Already meeting the target on internals alone, before any end-sem. */
  alreadyMet: boolean;
  /**
   * Minimum raw end-sem mark (out of {@link ENDSEM_MAX}) needed to reach the
   * target grade, given the internal already earned. Exact float; ceil it for
   * display ("you need 73"). 0 when already met; > 100 (and achievable=false)
   * when even a perfect end-sem falls short.
   */
  needed: number;
}

/**
 * The core planner: given the internal mark already banked (out of
 * {@link INTERNAL_MAX}) and a target grade, how much is still needed on the
 * end-sem exam (out of {@link ENDSEM_MAX})?
 */
export function requiredEndSem(internal: number, target: GradeLetter): EndSemTarget {
  const targetMin = bandFor(target).min;
  const internalContribution = (clamp(internal, INTERNAL_MAX) / INTERNAL_MAX) * INTERNAL_WEIGHT;
  const endSemContributionNeeded = targetMin - internalContribution;

  if (endSemContributionNeeded <= 0) {
    return { achievable: true, alreadyMet: false, needed: ENDSEM_PASS_MIN };
  }

  // endSemContribution = (endSem / ENDSEM_MAX) * ENDSEM_WEIGHT  ⇒ solve for endSem
  const neededRaw = (endSemContributionNeeded / ENDSEM_WEIGHT) * ENDSEM_MAX;
  const neededCapped = Math.max(neededRaw, ENDSEM_PASS_MIN);
  return { achievable: neededRaw <= ENDSEM_MAX, alreadyMet: false, needed: neededCapped };
}

export interface UniformTarget {
  /** The final mark (out of 100) this grade needs. */
  finalNeeded: number;
  /** Fraction to score on every assessment, i.e. finalNeeded / 100. */
  fraction: number;
  /** Raw mark to aim for on each assessment, per internal and on the end-sem. */
  perAssessment: {
    conceptTest: number; // out of CONCEPT_TEST_MAX
    cat: number; // out of CAT_MAX
    assignment: number; // out of ASSIGNMENT_WEIGHT
    endSem: number; // out of ENDSEM_MAX
  };
}



export interface RealisticPlan {
  /** The final mark (out of 100) this grade needs. */
  finalNeeded: number;
  /** Raw per-internal targets (both internals share the same shape). */
  perInternal: { conceptTest: number; cat: number; assignment: number };
  /** Combined internal target across both internals, out of {@link INTERNAL_MAX}. */
  internalTotal: number;
  /** Raw end-sem mark to aim for, out of {@link ENDSEM_MAX}. */
  endSem: number;
  /** False when even a perfect end-sem can't reach the grade with this internal plan. */
  achievable: boolean;
}

/**
 * The recommended semester-start planner. Calculates a dynamic internal shape
 * based on the target grade (assignments high, CATs on-target, concept tests lighter)
 * and solves the end-sem needed to land the target grade. Both
 * internals get the same per-component targets. Exact floats — round up for
 * display.
 */
export function realisticTargetMarks(target: GradeLetter): RealisticPlan {
  const finalNeeded = bandFor(target).min;
  const baseFraction = finalNeeded / 100;
  
  // Tune the fractions based on the base target, clamping to [0, 1]
  const conceptTest = Math.max(baseFraction - 0.1, 0) * CONCEPT_TEST_MAX;
  const cat = Math.min(baseFraction, 1.0) * CAT_MAX;
  const assignmentRaw = Math.min(baseFraction + 0.1, 1.0) * ASSIGNMENT_WEIGHT;
  const assignment = Math.max(assignmentRaw, 30);

  const internalTotalMark = scoreInternal({ conceptTest, cat, assignment }) * INTERNALS_COUNT;
  const internalContribution = (internalTotalMark / INTERNAL_MAX) * INTERNAL_WEIGHT;
  const endSemRaw = ((finalNeeded - internalContribution) / ENDSEM_WEIGHT) * ENDSEM_MAX;
  const endSemFloor = Math.max(endSemRaw, ENDSEM_PASS_MIN);

  return {
    finalNeeded,
    perInternal: { conceptTest, cat, assignment },
    internalTotal: internalTotalMark,
    endSem: Math.min(endSemFloor, ENDSEM_MAX),
    achievable: endSemRaw <= ENDSEM_MAX,
  };
}

/**
 * The simplest planner: score the *same fraction* on everything. Kept as an
 * alternative to {@link realisticTargetMarks}; both internals share the same
 * per-component target. Exact floats — round up for display.
 */
export function uniformTargetMarks(target: GradeLetter): UniformTarget {
  const finalNeeded = bandFor(target).min;
  const fraction = finalNeeded / 100;
  return {
    finalNeeded,
    fraction,
    perAssessment: {
      conceptTest: fraction * CONCEPT_TEST_MAX,
      cat: fraction * CAT_MAX,
      assignment: fraction * ASSIGNMENT_WEIGHT,
      endSem: fraction * ENDSEM_MAX,
    },
  };
}
