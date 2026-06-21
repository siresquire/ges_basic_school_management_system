"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PERIODS, WEEKDAYS } from "@/lib/format";

export async function saveTimetable(classGroupId: string, formData: FormData) {
  await requireAdmin();

  // Map subject → teacher for this class, so slots pick the right teacher automatically.
  const assignments = await prisma.subjectAssignment.findMany({ where: { classGroupId } });
  const teacherBySubject = new Map(assignments.map((a) => [a.subjectId, a.teacherId]));

  for (let day = 1; day <= WEEKDAYS.length; day++) {
    for (const period of PERIODS) {
      const value = String(formData.get(`slot_${day}_${period}`) ?? "");
      const where = { classGroupId_dayOfWeek_period: { classGroupId, dayOfWeek: day, period } };

      if (!value) {
        await prisma.timetableSlot.deleteMany({
          where: { classGroupId, dayOfWeek: day, period },
        });
      } else if (value.startsWith("L:")) {
        const label = value.slice(2);
        await prisma.timetableSlot.upsert({
          where,
          update: { label, subjectId: null, teacherId: null },
          create: { classGroupId, dayOfWeek: day, period, label },
        });
      } else {
        await prisma.timetableSlot.upsert({
          where,
          update: { subjectId: value, label: null, teacherId: teacherBySubject.get(value) ?? null },
          create: {
            classGroupId,
            dayOfWeek: day,
            period,
            subjectId: value,
            teacherId: teacherBySubject.get(value) ?? null,
          },
        });
      }
    }
  }

  revalidatePath("/timetable");
  redirect(`/timetable?class=${classGroupId}&saved=1`);
}
