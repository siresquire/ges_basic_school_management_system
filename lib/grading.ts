import { prisma } from "@/lib/db";

// Each school level has its own grading scale.
// Scales are edited in Settings (stored in the GradeBand table);
// if a section has no saved scale yet, the defaults below are used.

export type Section = "CRECHE" | "KG" | "PRIMARY" | "JHS";

export type GradeBand = { min: number; grade: string; remark: string };

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { min: 80, grade: "A", remark: "Excellent" },
  { min: 70, grade: "B", remark: "Very Good" },
  { min: 60, grade: "C", remark: "Good" },
  { min: 50, grade: "D", remark: "Credit" },
  { min: 40, grade: "E", remark: "Pass" },
  { min: 0, grade: "F", remark: "Fail" },
];

/** Each stage has its own grading section. */
export function sectionForStage(stage: string): Section {
  switch (stage) {
    case "JHS": return "JHS";
    case "PRIMARY": return "PRIMARY";
    case "KG": return "KG";
    default: return "CRECHE";
  }
}

export const SECTION_LABELS: Record<Section, string> = {
  CRECHE: "Creche & Nursery",
  KG: "Kindergarten",
  PRIMARY: "Primary",
  JHS: "JHS",
};

/** The grading scale for a section — saved scale if one exists, else the default. */
export async function getGradeBands(section: Section): Promise<GradeBand[]> {
  const saved = await prisma.gradeBand.findMany({
    where: { section },
    orderBy: { minScore: "desc" },
  });
  if (saved.length === 0) return DEFAULT_GRADE_BANDS;
  return saved.map((b) => ({ min: b.minScore, grade: b.grade, remark: b.remark }));
}

export function gradeFor(bands: GradeBand[], total: number): GradeBand {
  return bands.find((b) => total >= b.min) ?? bands[bands.length - 1];
}

/**
 * Class score and exam score are both recorded out of 100.
 * The terminal total weights them 50/50 (GES School-Based Assessment split).
 */
export function totalScore(
  classScore: number | null | undefined,
  examScore: number | null | undefined
): number | null {
  if (classScore == null && examScore == null) return null;
  return 0.5 * (classScore ?? 0) + 0.5 * (examScore ?? 0);
}

/** Class works total out of 60 (the GES practice: 4 class works summing to 60). */
export const CLASSWORK_MAX = 60;

/** Sum of the entered class works, or null when none are entered. */
export function classWorkTotal(cws: (number | null | undefined)[]): number | null {
  const entered = cws.filter((v): v is number => v != null);
  if (entered.length === 0) return null;
  return Math.round(entered.reduce((a, b) => a + b, 0) * 100) / 100;
}

/**
 * Converts a class-work total (out of 60) to the canonical class score out of
 * 100 stored on the Score record. e.g. 54/60 → 90.
 */
export function classWorkToScore(total: number | null): number | null {
  if (total == null) return null;
  return Math.round((total / CLASSWORK_MAX) * 100 * 100) / 100;
}

export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/** Auto class-teacher remark from the term average (used when none is typed). */
export function autoTeacherRemark(average: number): string {
  if (average >= 80) return "An excellent performance. Keep it up!";
  if (average >= 70) return "A very good performance. Keep working hard.";
  if (average >= 60) return "A good performance, but there is room for improvement.";
  if (average >= 50) return "A fair performance. More effort is needed.";
  if (average >= 40) return "Performance is below average. Serious effort is required.";
  return "A poor performance. Needs close attention and support.";
}

/** Auto head's remark from the term average (used when none is typed). */
export function autoHeadRemark(average: number): string {
  if (average >= 80) return "An outstanding result. Keep up the hard work.";
  if (average >= 70) return "A very good result. Aim even higher.";
  if (average >= 60) return "A good result. There is room to do better.";
  if (average >= 50) return "A fair result. More effort is required.";
  if (average >= 40) return "A weak result. Extra effort and support are needed.";
  return "A very weak result. Serious attention is required.";
}
