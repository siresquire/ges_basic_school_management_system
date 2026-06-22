"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { log } from "@/lib/activity";

const STAGES = ["CRECHE", "KG", "PRIMARY", "JHS"];

function classDataFrom(formData: FormData) {
  const stage = String(formData.get("stage") ?? "PRIMARY");
  return {
    name: String(formData.get("name") ?? "").trim(),
    stage: STAGES.includes(stage) ? stage : "PRIMARY",
  };
}

export async function createClass(formData: FormData) {
  const session = await requireAdmin();
  const { name, stage } = classDataFrom(formData);
  if (!name) redirect("/classes?error=name");

  const dup = await prisma.classGroup.findUnique({ where: { name } });
  if (dup) redirect("/classes?error=duplicate");

  // Auto-assign as last in list so users can drag it into position.
  const agg = await prisma.classGroup.aggregate({ _max: { level: true } });
  const level = (agg._max.level ?? 0) + 1;

  await prisma.classGroup.create({ data: { name, stage, level } });
  await log({ actorUserId: session.userId, actorName: session.name, action: "CLASS_CREATE", detail: `Added class "${name}" (${stage})` });
  revalidatePath("/classes");
  redirect("/classes?saved=created");
}

/** Updates name, stage and class teacher. Level is managed by drag-and-drop. */
export async function updateClass(classGroupId: string, formData: FormData) {
  const session = await requireAdmin();
  const { name, stage } = classDataFrom(formData);
  if (!name) redirect("/classes?error=name");

  const dup = await prisma.classGroup.findUnique({ where: { name } });
  if (dup && dup.id !== classGroupId) redirect("/classes?error=duplicate");

  const teacherId = String(formData.get("teacherId") ?? "") || null;
  await prisma.classGroup.update({
    where: { id: classGroupId },
    data: { name, stage, classTeacherId: teacherId },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "CLASS_UPDATE", detail: `Updated class "${name}" (${stage})` });
  revalidatePath("/classes");
  redirect("/classes?saved=updated");
}

/** Persists drag-and-drop order by assigning level = array index. */
export async function reorderClasses(orderedIds: string[]) {
  await requireAdmin();
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.classGroup.update({ where: { id }, data: { level: index } })
    )
  );
  revalidatePath("/classes");
}

/**
 * Deleting a class is only allowed when nothing depends on it:
 * students must be reassigned first, and classes with scores or attendance
 * are kept because old report cards are built from those records.
 * Timetable slots, subject assignments and class-specific fee items are
 * cleaned up automatically.
 */
export async function deleteClass(classGroupId: string) {
  const session = await requireAdmin();

  const [cls, studentCount, scoreCount, attendanceCount] = await Promise.all([
    prisma.classGroup.findUnique({ where: { id: classGroupId }, select: { name: true } }),
    prisma.student.count({ where: { classGroupId } }),
    prisma.score.count({ where: { classGroupId } }),
    prisma.attendanceRecord.count({ where: { classGroupId } }),
  ]);

  if (studentCount > 0) redirect("/classes?error=hasstudents");
  if (scoreCount > 0 || attendanceCount > 0) redirect("/classes?error=hashistory");

  await prisma.$transaction([
    prisma.timetableSlot.deleteMany({ where: { classGroupId } }),
    prisma.subjectAssignment.deleteMany({ where: { classGroupId } }),
    prisma.feeItem.deleteMany({ where: { classGroupId } }),
    prisma.classGroup.delete({ where: { id: classGroupId } }),
  ]);

  await log({ actorUserId: session.userId, actorName: session.name, action: "CLASS_DELETE", detail: `Deleted class "${cls?.name ?? classGroupId}"` });
  revalidatePath("/classes");
  redirect("/classes?saved=deleted");
}
