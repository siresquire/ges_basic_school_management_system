import { prisma } from "@/lib/db";

export type AttendanceSummary = {
  present: number;
  total: number;
  /** "term" = entered as end-of-term totals; "daily" = counted from the register. */
  source: "term" | "daily" | "none";
};

/**
 * Resolves each pupil's attendance for a term. End-of-term totals entered by
 * the class teacher take precedence; where none exist, it falls back to
 * counting the daily register (distinct marked days; present = present + late).
 */
export async function getAttendanceForClass(
  classGroupId: string,
  termId: string
): Promise<Map<string, AttendanceSummary>> {
  const [termRows, daily] = await Promise.all([
    prisma.termAttendance.findMany({ where: { classGroupId, termId } }),
    prisma.attendanceRecord.findMany({
      where: { classGroupId, termId },
      select: { studentId: true, status: true, date: true },
    }),
  ]);

  const result = new Map<string, AttendanceSummary>();

  // Daily fallback first.
  const schoolDays = new Set(daily.map((a) => a.date.toISOString())).size;
  const presentByStudent = new Map<string, number>();
  for (const a of daily) {
    if (a.status === "PRESENT" || a.status === "LATE") {
      presentByStudent.set(a.studentId, (presentByStudent.get(a.studentId) ?? 0) + 1);
    }
  }
  for (const studentId of presentByStudent.keys()) {
    result.set(studentId, {
      present: presentByStudent.get(studentId) ?? 0,
      total: schoolDays,
      source: "daily",
    });
  }

  // Term totals override.
  for (const row of termRows) {
    if (row.daysPresent == null && row.daysTotal == null) continue;
    result.set(row.studentId, {
      present: row.daysPresent ?? 0,
      total: row.daysTotal ?? 0,
      source: "term",
    });
  }

  return result;
}
