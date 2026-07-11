/**
 * Per-subject credits, from the LICET R-2024 AI&DS Semester-V curriculum,
 * keyed by the subjectCode used in the class timetable. Static reference data —
 * the curriculum is fixed, so there's no need to store this in the DB.
 *
 * Credits can be fractional (labs are 1.5). Unknown codes return null and
 * should render as "—".
 */
export const SUBJECT_CREDITS: Record<string, number> = {
  AD24501: 3, // Big Data Analytics (BDA)
  AD24502: 3, // Neural Networks and Deep Learning (NNDL)
  GE24501: 2, // Project Management and Operations Management (PMOM)
  AD24412: 4, // Data Visualization and Story Telling (DVST)
  CS24512: 4, // Computer Networks (CN)
  "PAD2401/PCS2411": 3, // Professional Elective 1 (AE / FSWD)
  AD24521: 1.5, // Big Data Analytics Lab
  AD24522: 1.5, // Deep Learning Lab
  BS24502: 1, // Logical Reasoning and Aptitude Training (LRAT)
  FC24501: 1, // Universal Human Values and Service Learning (UHVSL)
};

/** Credits for a subject code, or null when unknown. */
export function creditsFor(code: string): number | null {
  return SUBJECT_CREDITS[code] ?? null;
}

/** "3" or "1.5" or "—" for display. */
export function formatCredits(code: string): string {
  const c = creditsFor(code);
  return c === null ? "—" : String(c);
}
