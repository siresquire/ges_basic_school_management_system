import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth";

/**
 * The students a portal user is allowed to see:
 * a STUDENT sees themselves, a PARENT sees all linked children.
 */
export async function getPortalStudents(session: Session) {
  if (session.role === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: session.userId },
      include: { classGroup: { include: { classTeacher: { select: { firstName: true, lastName: true, phone: true } } } } },
    });
    return student ? [student] : [];
  }
  return prisma.student.findMany({
    where: { parentUserId: session.userId },
    include: { classGroup: { include: { classTeacher: { select: { firstName: true, lastName: true, phone: true } } } } },
    orderBy: [{ classGroup: { level: "asc" } }, { firstName: "asc" }],
  });
}
