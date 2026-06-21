import { prisma } from "@/lib/db";
import { getEnabledLevels } from "@/lib/school-config";
import type { Session } from "@/lib/auth";

/**
 * For ADMIN role: returns the subset of school-enabled levels this admin can access.
 * Returns null for SUPER_ADMIN and TEACHER (no extra level restriction — teacher scope handles teachers).
 * Returns null for admins with no assigned levels (they see all enabled levels).
 */
export async function getAdminLevels(session: Session): Promise<string[] | null> {
  if (session.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { assignedLevels: true },
  });

  const assigned = (user?.assignedLevels ?? "").split(",").filter(Boolean);
  if (assigned.length === 0) return null; // no restriction

  const enabledLevels = await getEnabledLevels();
  const levels = enabledLevels.filter((l) => assigned.includes(l));
  return levels.length > 0 ? levels : null;
}

/** Prisma `where` fragment for filtering students/scores/etc. by stage via classGroup relation. */
export function levelStageFilter(adminLevels: string[] | null) {
  if (!adminLevels) return {};
  return { classGroup: { stage: { in: adminLevels } } };
}

/** Prisma `where` fragment for filtering ClassGroup records directly by stage. */
export function classStageFilter(adminLevels: string[] | null) {
  if (!adminLevels) return {};
  return { stage: { in: adminLevels } };
}
