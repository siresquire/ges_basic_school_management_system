"use server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/activity";
import { redirect } from "next/navigation";

export async function deduplicateClass(formData: FormData) {
  const session = await requireSuperAdmin();
  const classId = formData.get("classId") as string;
  if (!classId) return;

  const cls = await prisma.classGroup.findUnique({ where: { id: classId }, select: { name: true } });

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", classGroupId: classId },
    select: {
      id: true,
      admissionNo: true,
      firstName: true,
      lastName: true,
      otherNames: true,
      userId: true,
      parentUserId: true,
      _count: {
        select: {
          scores: true,
          attendance: true,
          termAttendance: true,
          payments: true,
          reportRemarks: true,
        },
      },
    },
    orderBy: { admissionNo: "asc" },
  });

  // Group by normalized full name — keep the first entry (lowest admissionNo)
  const seen = new Map<string, string>(); // nameKey -> first student id
  const toDelete: { id: string; userId: string | null }[] = [];
  const blocked: string[] = [];

  for (const s of students) {
    const nameKey = `${s.firstName.trim()} ${s.lastName.trim()} ${s.otherNames?.trim() ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (!seen.has(nameKey)) {
      seen.set(nameKey, s.id);
      continue;
    }

    // Safe to remove if no academic data — auto-created portal login is also cleaned up.
    const safe =
      s._count.scores === 0 &&
      s._count.attendance === 0 &&
      s._count.termAttendance === 0 &&
      s._count.payments === 0 &&
      s._count.reportRemarks === 0 &&
      s.parentUserId === null;

    if (safe) toDelete.push({ id: s.id, userId: s.userId });
    else blocked.push(s.id);
  }

  if (toDelete.length > 0) {
    const ids = toDelete.map((s) => s.id);
    const userIds = toDelete.map((s) => s.userId).filter((id): id is string => id !== null);
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await log({ actorUserId: session.userId, actorName: session.name, action: "STUDENT_DEDUP", detail: `Removed ${ids.length} duplicate entries from class "${cls?.name ?? classId}"` });
  }

  redirect(`/super-admin/deduplicate?done=${toDelete.length}`);
}
