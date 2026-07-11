import { describe, expect, it } from "vitest";
import {
  finalMark,
  gradeFor,
  gradeForMarks,
  gradeForMarksGated,
  internalFloorMet,
  internalTotal,
  realisticTargetMarks,
  requiredEndSem,
  scoreInternal,
  uniformTargetMarks,
} from "@/lib/grades";

describe("finalMark", () => {
  it("weights internal /200 to 40 and end-sem /100 to 60", () => {
    // full marks everywhere → 100
    expect(finalMark(200, 100)).toBe(100);
    // full internal, zero end-sem → 40
    expect(finalMark(200, 0)).toBe(40);
    // zero internal, full end-sem → 60
    expect(finalMark(0, 100)).toBe(60);
    // half of each → 20 + 30 = 50
    expect(finalMark(100, 50)).toBe(50);
  });

  it("clamps out-of-range and NaN inputs", () => {
    expect(finalMark(500, 200)).toBe(100); // over max clamps down
    expect(finalMark(-50, -10)).toBe(0); // negatives clamp to 0
    expect(finalMark(NaN, 100)).toBe(60); // NaN internal → 0 contribution
  });
});

describe("scoreInternal", () => {
  it("scales concept test /30→20, cat /60→40, assignment /40 direct", () => {
    // full marks → 100
    expect(scoreInternal({ conceptTest: 30, cat: 60, assignment: 40 })).toBe(100);
    // concept test alone, full → 20
    expect(scoreInternal({ conceptTest: 30, cat: 0, assignment: 0 })).toBe(20);
    // cat alone, full → 40
    expect(scoreInternal({ conceptTest: 0, cat: 60, assignment: 0 })).toBe(40);
    // half concept (15/30→10) + half cat (30/60→20) + half assignment (20) = 50
    expect(scoreInternal({ conceptTest: 15, cat: 30, assignment: 20 })).toBe(50);
  });
});

describe("internalTotal", () => {
  it("sums two internals into a mark out of 200", () => {
    const full = { conceptTest: 30, cat: 60, assignment: 40 };
    expect(internalTotal([full, full])).toBe(200);
    expect(internalTotal([full, { conceptTest: 0, cat: 0, assignment: 0 }])).toBe(100);
  });
});

describe("internalFloorMet", () => {
  it("requires the combined internal to reach 90/200", () => {
    expect(internalFloorMet(90)).toBe(true);
    expect(internalFloorMet(89)).toBe(false);
    expect(internalFloorMet(0)).toBe(false);
    expect(internalFloorMet(200)).toBe(true);
  });
});

describe("gradeForMarksGated", () => {
  it("fails (RA) below the internal floor even with a perfect end-sem", () => {
    // internal 80/200 → would be a passing final on paper, but < 90 floor.
    expect(gradeForMarks(80, 100).letter).not.toBe("RA"); // ungated: passes
    expect(gradeForMarksGated(80, 100).letter).toBe("RA"); // gated: fails
  });

  it("matches the normal grade once the floor is cleared", () => {
    // internal 172/200, end-sem 78 → A+ (the realistic A+ plan).
    expect(gradeForMarksGated(172, 78).letter).toBe(gradeForMarks(172, 78).letter);
  });
});

describe("gradeFor", () => {
  it("maps final marks to the R-2017 letter bands", () => {
    expect(gradeFor(100).letter).toBe("O");
    expect(gradeFor(91).letter).toBe("O");
    expect(gradeFor(90).letter).toBe("A+");
    expect(gradeFor(81).letter).toBe("A+");
    expect(gradeFor(80).letter).toBe("A");
    expect(gradeFor(71).letter).toBe("A");
    expect(gradeFor(61).letter).toBe("B+");
    expect(gradeFor(50).letter).toBe("B");
    expect(gradeFor(49.9).letter).toBe("RA");
    expect(gradeFor(0).letter).toBe("RA");
  });

  it("carries the grade points", () => {
    expect(gradeFor(95).points).toBe(10);
    expect(gradeFor(85).points).toBe(9);
    expect(gradeFor(40).points).toBe(0);
  });
});

describe("gradeForMarks", () => {
  it("combines then grades", () => {
    // 180/200 → 36, 90/100 → 54, total 90 → A+
    expect(gradeForMarks(180, 90).letter).toBe("A+");
  });
});

describe("requiredEndSem", () => {
  it("solves the minimum end-sem for a target grade", () => {
    // internal 160/200 → 32 of 40. A+ needs 81. end-sem must add 49 of 60.
    // 49/60*100 = 81.666...
    const r = requiredEndSem(160, "A+");
    expect(r.achievable).toBe(true);
    expect(r.alreadyMet).toBe(false);
    expect(r.needed).toBeCloseTo(81.6667, 3);
  });

  it("never reports alreadyMet — internal caps at 40, below B's 50", () => {
    // The internal contribution maxes at INTERNAL_WEIGHT (40), and the lowest
    // passing grade B needs 50, so the end-sem is always required.
    const r = requiredEndSem(200, "B");
    expect(r.alreadyMet).toBe(false);
    expect(r.needed).toBeGreaterThan(0); // full internal → still needs 10 of 60
  });

  it("flags an unreachable target", () => {
    // internal 0 → 0 contribution. O needs 91, but end-sem maxes the final at
    // 60. Even a perfect end-sem can't reach O.
    const r = requiredEndSem(0, "O");
    expect(r.achievable).toBe(false);
    expect(r.needed).toBeGreaterThan(100);
  });

  it("never returns a negative requirement", () => {
    const r = requiredEndSem(160, "B");
    expect(r.needed).toBeGreaterThanOrEqual(0);
  });
});

describe("uniformTargetMarks", () => {
  it("gives the per-assessment mark to score consistently for a grade", () => {
    // A+ needs final 81 → score 81% everywhere.
    const t = uniformTargetMarks("A+");
    expect(t.finalNeeded).toBe(81);
    expect(t.fraction).toBeCloseTo(0.81, 5);
    expect(t.perAssessment.conceptTest).toBeCloseTo(0.81 * 30, 5); // 24.3
    expect(t.perAssessment.cat).toBeCloseTo(0.81 * 60, 5); // 48.6
    expect(t.perAssessment.assignment).toBeCloseTo(0.81 * 40, 5); // 32.4
    expect(t.perAssessment.endSem).toBeCloseTo(81, 5);
  });

  it("a uniform score reproduces the target grade end to end", () => {
    const t = uniformTargetMarks("O"); // needs 91
    const internal = internalTotal([
      { conceptTest: t.perAssessment.conceptTest, cat: t.perAssessment.cat, assignment: t.perAssessment.assignment },
      { conceptTest: t.perAssessment.conceptTest, cat: t.perAssessment.cat, assignment: t.perAssessment.assignment },
    ]);
    expect(gradeForMarks(internal, t.perAssessment.endSem).letter).toBe("O");
  });
});

describe("realisticTargetMarks", () => {
  it("uses a dynamic internal shape based on the target grade (e.g. A+ needs ~81%)", () => {
    const p = realisticTargetMarks("A+");
    expect(p.perInternal.conceptTest).toBeCloseTo(0.71 * 30, 5); // 21.3
    expect(p.perInternal.cat).toBeCloseTo(0.81 * 60, 5); // 48.6
    expect(p.perInternal.assignment).toBeCloseTo(0.91 * 40, 5); // 36.4
    expect(p.internalTotal).toBeCloseTo(166, 2); 
  });

  it("solves the end-sem so the whole plan lands on the target grade's floor", () => {
    for (const grade of ["O", "A+", "A", "B+", "B"] as const) {
      const p = realisticTargetMarks(grade);
      expect(p.achievable).toBe(true);
      const internal = internalTotal([p.perInternal, p.perInternal]);
      // The exact solved marks put the final right at the grade's minimum.
      // (The UI ceils each mark, which clears the boundary safely.)
      expect(finalMark(internal, p.endSem)).toBeGreaterThanOrEqual(p.finalNeeded - 0.0001);
    }
  });

  it("for A+ the end-sem works out to ~79.7/100", () => {
    const p = realisticTargetMarks("A+");
    expect(p.endSem).toBeCloseTo(79.67, 1); 
  });
});
