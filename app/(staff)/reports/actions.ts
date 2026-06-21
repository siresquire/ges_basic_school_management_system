"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff, homeFor } from "@/lib/auth";
import { getTeacherScope, canAdminister } from "@/lib/teacher-scope";

/** Saves conduct + remarks — only the class teacher / form master (or admin). */
export async function saveRemarks(classGroupId: string, termId: string, formData: FormData) {
  const session = await requireStaff();
  const scope = await getTeacherScope(session);
  if (!canAdminister(scope, classGroupId)) redirect(homeFor(session.role));

  const students = await prisma.student.findMany({
    where: { classGroupId, status: "ACTIVE" },
    select: { id: true },
  });

  for (const { id: studentId } of students) {
    const conduct = String(formData.get(`conduct_${studentId}`) ?? "").trim() || null;
    const teacherRemark = String(formData.get(`tr_${studentId}`) ?? "").trim() || null;
    const headRemark = String(formData.get(`hr_${studentId}`) ?? "").trim() || null;

    if (!conduct && !teacherRemark && !headRemark) {
      // Nothing typed — drop the row so the auto remarks apply.
      await prisma.reportRemark.deleteMany({ where: { studentId, termId } });
      continue;
    }

    await prisma.reportRemark.upsert({
      where: { studentId_termId: { studentId, termId } },
      update: { conduct, teacherRemark, headRemark },
      create: { studentId, termId, conduct, teacherRemark, headRemark },
    });
  }

  revalidatePath("/reports");
  redirect(`/reports/remarks?class=${classGroupId}&term=${termId}&saved=1`);
}
