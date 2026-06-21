"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff, homeFor } from "@/lib/auth";
import { dateFromISO } from "@/lib/format";
import { getTeacherScope, canAdminister } from "@/lib/teacher-scope";

const STATUSES = ["PRESENT", "ABSENT", "LATE"];

export async function saveAttendance(
  classGroupId: string,
  dateISO: string,
  formData: FormData
) {
  const session = await requireStaff();
  const scope = await getTeacherScope(session);
  if (!canAdminister(scope, classGroupId)) redirect(homeFor(session.role));
  const date = dateFromISO(dateISO);

  // Attach the record to the term containing this date (falls back to the current term).
  const term =
    (await prisma.term.findFirst({
      where: { startDate: { lte: date }, endDate: { gte: date } },
    })) ?? (await prisma.term.findFirst({ where: { isCurrent: true } }));
  if (!term) redirect(`/attendance?mode=daily&class=${classGroupId}&date=${dateISO}&error=noterm`);

  const students = await prisma.student.findMany({
    where: { classGroupId, status: "ACTIVE" },
    select: { id: true },
  });

  for (const { id: studentId } of students) {
    const status = String(formData.get(`st_${studentId}`) ?? "");
    if (!STATUSES.includes(status)) continue;
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId, date } },
      update: { status, classGroupId, termId: term.id },
      create: { studentId, classGroupId, termId: term.id, date, status },
    });
  }

  revalidatePath("/attendance");
  redirect(`/attendance?mode=daily&class=${classGroupId}&date=${dateISO}&saved=1`);
}

/** End-of-term attendance totals entered from the paper register. */
function parseDays(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n);
}

export async function saveTermAttendance(
  classGroupId: string,
  termId: string,
  formData: FormData
) {
  const session = await requireStaff();
  const scope = await getTeacherScope(session);
  if (!canAdminister(scope, classGroupId)) redirect(homeFor(session.role));

  const daysTotal = parseDays(formData.get("daysTotal"));
  const students = await prisma.student.findMany({
    where: { classGroupId, status: "ACTIVE" },
    select: { id: true },
  });

  for (const { id: studentId } of students) {
    const daysPresent = parseDays(formData.get(`present_${studentId}`));

    if (daysPresent == null && daysTotal == null) {
      await prisma.termAttendance.deleteMany({ where: { studentId, termId } });
      continue;
    }
    await prisma.termAttendance.upsert({
      where: { studentId_termId: { studentId, termId } },
      update: { daysPresent, daysTotal, classGroupId, recordedBy: session.name },
      create: { studentId, classGroupId, termId, daysPresent, daysTotal, recordedBy: session.name },
    });
  }

  revalidatePath("/attendance");
  revalidatePath("/reports");
  redirect(`/attendance?class=${classGroupId}&term=${termId}&saved=term`);
}
