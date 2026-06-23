import { prisma } from "@/lib/db";
import type { Session } from "@/lib/auth";

// Teachers only see the classes assigned to them:
//  - the class they administrate (class teacher in Primary/KG, form master or
//    mistress in JHS — the ClassGroup.classTeacher link), and
//  - classes where they have a subject assignment.
// Only the class teacher / form master of a class marks its attendance and
// fills conduct & remarks. Admins are unrestricted.

export type TeacherScope = {
  isAdmin: boolean;
  teacherId: string | null;
  /** Classes this teacher administrates (class teacher / form master). */
  classTeacherOf: string[];
  /** All classes the teacher is connected to (administrates or teaches in). */
  taughtClassIds: string[];
  /** Subject assignments per class. */
  subjectsByClass: Record<string, string[]>;
  /** The teacher's own assigned levels (empty for admins). */
  ownLevels: string[];
};

export async function getTeacherScope(session: Session): Promise<TeacherScope> {
  if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
    return { isAdmin: true, teacherId: null, classTeacherOf: [], taughtClassIds: [], subjectsByClass: {}, ownLevels: [] };
  }
  const teacher = await prisma.teacher.findFirst({
    where: { userId: session.userId },
    include: { classTeacherOf: { select: { id: true } }, assignments: true },
  });
  const classTeacherOf = teacher?.classTeacherOf.map((c) => c.id) ?? [];
  const subjectsByClass: Record<string, string[]> = {};
  for (const a of teacher?.assignments ?? []) {
    (subjectsByClass[a.classGroupId] ??= []).push(a.subjectId);
  }
  const taughtClassIds = [...new Set([...classTeacherOf, ...Object.keys(subjectsByClass)])];
  const ownLevels = (teacher?.levels ?? "").split(",").filter(Boolean);
  return { isAdmin: false, teacherId: teacher?.id ?? null, classTeacherOf, taughtClassIds, subjectsByClass, ownLevels };
}

/** May see this class and its data (scores, reports, students…). */
export function canTeach(scope: TeacherScope, classGroupId: string): boolean {
  return scope.isAdmin || scope.taughtClassIds.includes(classGroupId);
}

/** May administrate this class (attendance, conduct, remarks). */
export function canAdminister(scope: TeacherScope, classGroupId: string): boolean {
  return scope.isAdmin || scope.classTeacherOf.includes(classGroupId);
}

/** Subjects this teacher may enter scores for in a class. null = all subjects. */
export function allowedSubjectIds(scope: TeacherScope, classGroupId: string): string[] | null {
  if (scope.isAdmin || scope.classTeacherOf.includes(classGroupId)) return null;
  return scope.subjectsByClass[classGroupId] ?? [];
}

export function filterClasses<T extends { id: string }>(scope: TeacherScope, classes: T[]): T[] {
  return scope.isAdmin ? classes : classes.filter((c) => scope.taughtClassIds.includes(c.id));
}

/** The title used for the class administrator, per GES convention. */
export function classTeacherTitle(stage: string, teacherGender?: string | null): string {
  if (stage === "JHS") return teacherGender === "F" ? "Form Mistress" : "Form Master";
  return "Class Teacher";
}
