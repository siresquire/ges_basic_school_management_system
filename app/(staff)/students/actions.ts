"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { log } from "@/lib/activity";
import { parsePhone, parseGhanaCard, FieldError } from "@/lib/validate";

function studentDataFrom(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const dob = str("dateOfBirth");
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    otherNames: str("otherNames"),
    gender: String(formData.get("gender") ?? "M"),
    dateOfBirth: dob ? new Date(`${dob}T00:00:00.000Z`) : null,
    classGroupId: str("classGroupId"),
    guardianName: str("guardianName"),
    guardianPhone: str("guardianPhone"),
    address: str("address"),
    legacyAdmissionNo: str("legacyAdmissionNo"),
    residence: str("residence"),
    hometown: str("hometown"),
    healthInsuranceType: str("healthInsuranceType"),
    healthInsuranceNo: str("healthInsuranceNo"),
    ghanaCardNo: str("ghanaCardNo"),
    ec1Name: str("ec1Name"), ec1Phone: str("ec1Phone"), ec1Relation: str("ec1Relation"),
    ec2Name: str("ec2Name"), ec2Phone: str("ec2Phone"), ec2Relation: str("ec2Relation"),
    ec3Name: str("ec3Name"), ec3Phone: str("ec3Phone"), ec3Relation: str("ec3Relation"),
  };
}

async function nextAdmissionNo() {
  const last = await prisma.student.findFirst({
    orderBy: { admissionNo: "desc" },
    where: { admissionNo: { startsWith: "AKW-" } },
  });
  const lastNum = last ? parseInt(last.admissionNo.replace("AKW-", ""), 10) : 0;
  return `AKW-${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(4, "0")}`;
}

async function requireAdminOrClassTeacher() {
  const session = await requireStaff();
  if (session.role === "SUPER_ADMIN" || session.role === "ADMIN") return session;
  // TEACHER: must be a class teacher
  const teacher = await prisma.teacher.findFirst({
    where: { userId: session.userId },
    select: { id: true, classTeacherOf: { select: { id: true } } },
  });
  if (!teacher || teacher.classTeacherOf.length === 0) redirect("/");
  return session;
}

export async function createStudent(formData: FormData) {
  const session = await requireAdminOrClassTeacher();
  const rawData = studentDataFrom(formData);
  if (!rawData.firstName || !rawData.lastName) redirect("/students/new?error=name");

  // If teacher, verify they're assigning to their own class
  if (session.role === "TEACHER") {
    const classGroupId = rawData.classGroupId;
    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.userId },
      select: { classTeacherOf: { select: { id: true } } },
    });
    if (!teacher?.classTeacherOf.some((c) => c.id === classGroupId)) redirect("/");
  }

  let data: ReturnType<typeof studentDataFrom>;
  try {
    data = {
      ...rawData,
      guardianPhone: parsePhone(rawData.guardianPhone),
      ec1Phone: parsePhone(rawData.ec1Phone),
      ec2Phone: parsePhone(rawData.ec2Phone),
      ec3Phone: parsePhone(rawData.ec3Phone),
      ghanaCardNo: parseGhanaCard(rawData.ghanaCardNo),
    };
  } catch (e) {
    if (e instanceof FieldError) redirect(`/students/new?error=${e.code}`);
    throw e;
  }

  let admissionNo = String(formData.get("admissionNo") ?? "").trim();
  if (!admissionNo) admissionNo = await nextAdmissionNo();

  const existing = await prisma.student.findUnique({ where: { admissionNo } });
  if (existing) redirect("/students/new?error=admission");

  const student = await prisma.student.create({ data: { ...data, admissionNo } });
  await log({
    actorUserId: session.userId,
    actorName: session.name,
    action: "STUDENT_CREATE",
    detail: `Added student ${data.firstName} ${data.lastName} (${admissionNo})`,
  });
  revalidatePath("/students");
  redirect(`/students/${student.id}`);
}

export async function updateStudent(studentId: string, formData: FormData) {
  const session = await requireAdminOrClassTeacher();

  // IDOR guard: teachers may only update students in their own classes
  if (session.role === "TEACHER") {
    const [student, teacher] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { classGroupId: true } }),
      prisma.teacher.findFirst({
        where: { userId: session.userId },
        select: { classTeacherOf: { select: { id: true } } },
      }),
    ]);
    if (!student?.classGroupId || !teacher?.classTeacherOf.some((c) => c.id === student.classGroupId)) {
      redirect("/");
    }
  }

  const rawData = studentDataFrom(formData);
  const status = String(formData.get("status") ?? "ACTIVE");

  let data: ReturnType<typeof studentDataFrom>;
  try {
    data = {
      ...rawData,
      guardianPhone: parsePhone(rawData.guardianPhone),
      ec1Phone: parsePhone(rawData.ec1Phone),
      ec2Phone: parsePhone(rawData.ec2Phone),
      ec3Phone: parsePhone(rawData.ec3Phone),
      ghanaCardNo: parseGhanaCard(rawData.ghanaCardNo),
    };
  } catch (e) {
    if (e instanceof FieldError) redirect(`/students/${studentId}?error=${e.code}`);
    throw e;
  }

  await prisma.student.update({ where: { id: studentId }, data: { ...data, status } });
  revalidatePath("/students");
  redirect(`/students/${studentId}`);
}

/**
 * Creates (or replaces the password of) a portal login for a student or their parent.
 * kind = "STUDENT" links to Student.userId; "PARENT" links to Student.parentUserId.
 */
export async function createPortalLogin(
  studentId: string,
  kind: "STUDENT" | "PARENT",
  formData: FormData
) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || password.length < 6) {
    redirect(`/students/${studentId}?error=login`);
  }

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { user: true, parentUser: true },
  });

  const taken = await prisma.user.findUnique({ where: { username } });

  if (kind === "STUDENT") {
    if (taken && taken.id !== student.userId) redirect(`/students/${studentId}?error=username`);
    if (student.userId) {
      await prisma.user.update({
        where: { id: student.userId },
        data: { username, passwordHash: bcrypt.hashSync(password, 10), active: true },
      });
    } else {
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          name: `${student.firstName} ${student.lastName}`,
          role: "STUDENT",
        },
      });
      await prisma.student.update({ where: { id: studentId }, data: { userId: user.id } });
    }
  } else {
    if (taken && taken.id !== student.parentUserId) redirect(`/students/${studentId}?error=username`);
    if (student.parentUserId) {
      await prisma.user.update({
        where: { id: student.parentUserId },
        data: { username, passwordHash: bcrypt.hashSync(password, 10), active: true },
      });
    } else {
      // Re-use an existing parent account if a sibling already has this username linked.
      const user = await prisma.user.create({
        data: {
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          name: student.guardianName ?? `Parent of ${student.firstName} ${student.lastName}`,
          role: "PARENT",
        },
      });
      await prisma.student.update({ where: { id: studentId }, data: { parentUserId: user.id } });
    }
  }
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}?saved=login`);
}

/** Links this student to an existing parent account (for siblings). */
export async function linkExistingParent(studentId: string, formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("parentUsername") ?? "").trim().toLowerCase();
  const parent = await prisma.user.findUnique({ where: { username } });
  if (!parent || parent.role !== "PARENT") {
    redirect(`/students/${studentId}?error=noparent`);
  }
  await prisma.student.update({
    where: { id: studentId },
    data: { parentUserId: parent.id },
  });
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}?saved=login`);
}

/** Quick status change (Suspend / Withdraw / Restore). */
export async function setStudentStatus(studentId: string, status: string, _formData: FormData) {
  const session = await requireAdminOrClassTeacher();
  if (session.role === "TEACHER") {
    const [student, teacher] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { classGroupId: true } }),
      prisma.teacher.findFirst({
        where: { userId: session.userId },
        select: { classTeacherOf: { select: { id: true } } },
      }),
    ]);
    if (!student?.classGroupId || !teacher?.classTeacherOf.some((c) => c.id === student.classGroupId)) {
      redirect("/");
    }
  }
  await prisma.student.update({ where: { id: studentId }, data: { status } });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  redirect(`/students/${studentId}`);
}

/** Live search of parent accounts for sibling-linking autocomplete. */
export async function searchParentAccounts(q: string): Promise<
  Array<{ username: string; name: string; children: string[] }>
> {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) return [];
  if (!q || q.trim().length < 2) return [];
  const term = q.trim().toLowerCase();
  const parents = await prisma.user.findMany({
    where: {
      role: "PARENT",
      OR: [{ username: { contains: term } }, { name: { contains: term } }],
    },
    include: {
      children: {
        select: { firstName: true, lastName: true, classGroup: { select: { name: true } } },
      },
    },
    take: 8,
  });
  return parents.map((p) => ({
    username: p.username,
    name: p.name,
    children: p.children.map(
      (c) => `${c.firstName} ${c.lastName}${c.classGroup ? ` · ${c.classGroup.name}` : ""}`
    ),
  }));
}
