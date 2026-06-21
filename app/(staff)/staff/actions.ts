"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, requireStaff, homeFor } from "@/lib/auth";
import { readImageFile } from "@/lib/images";

function teacherDataFrom(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const dt = (k: string) => { const v = str(k); return v ? new Date(`${v}T00:00:00.000Z`) : null; };
  const num = (k: string) => { const v = str(k); return v ? (parseInt(v, 10) || null) : null; };
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    otherNames: str("otherNames"),
    gender: String(formData.get("gender") ?? "M"),
    phone: str("phone"),
    email: str("email"),
    staffId: str("staffId"),
    // Personal
    dateOfBirth: dt("dateOfBirth"),
    religion: str("religion"),
    maritalStatus: str("maritalStatus"),
    teacherUnion: str("teacherUnion"),
    // Hometown
    hometown: str("hometown"),
    hometownDistrict: str("hometownDistrict"),
    hometownRegion: str("hometownRegion"),
    // Residence
    townOfResidence: str("townOfResidence"),
    residenceDistrict: str("residenceDistrict"),
    residenceRegion: str("residenceRegion"),
    ghanaPostCode: str("ghanaPostCode"),
    // Identity
    ghanaCardNumber: str("ghanaCardNumber"),
    // Professional
    dateOfFirstAppointment: dt("dateOfFirstAppointment"),
    areaOfSpecialization: str("areaOfSpecialization"),
    ntcLicenseNumber: str("ntcLicenseNumber"),
    ssnitNumber: str("ssnitNumber"),
    currentRank: str("currentRank"),
    salaryGradeType: str("salaryGradeType"),
    gradeNumber: num("gradeNumber"),
    stepNumber: num("stepNumber"),
    dateOfLastPromotion: dt("dateOfLastPromotion"),
    datePostedToStation: dt("datePostedToStation"),
    periodsPerWeek: num("periodsPerWeek"),
    emisCode: str("emisCode"),
    emisPassword: str("emisPassword"),
    // Academic qualification
    highestAcademicQual: str("highestAcademicQual"),
    highestAcademicCourse: str("highestAcademicCourse"),
    highestAcademicYear: str("highestAcademicYear"),
    // Professional qualification
    highestProfQual: str("highestProfQual"),
    highestProfCourse: str("highestProfCourse"),
    highestProfYear: str("highestProfYear"),
    collegeOfEducation: str("collegeOfEducation"),
    // Bank
    bankName: str("bankName"),
    bankBranch: str("bankBranch"),
    bankAccountNumber: str("bankAccountNumber"),
    // Emergency contacts
    ec1Name: str("ec1Name"), ec1Phone: str("ec1Phone"), ec1Relation: str("ec1Relation"),
    ec2Name: str("ec2Name"), ec2Phone: str("ec2Phone"), ec2Relation: str("ec2Relation"),
    ec3Name: str("ec3Name"), ec3Phone: str("ec3Phone"), ec3Relation: str("ec3Relation"),
  };
}

export async function createTeacher(formData: FormData) {
  await requireAdmin();
  const data = teacherDataFrom(formData);
  if (!data.firstName || !data.lastName) redirect("/staff/new?error=name");

  if (data.staffId) {
    const dup = await prisma.teacher.findUnique({ where: { staffId: data.staffId } });
    if (dup) redirect("/staff/new?error=staffid");
  }

  const teacher = await prisma.teacher.create({ data });
  revalidatePath("/staff");
  redirect(`/staff/${teacher.id}`);
}

export async function updateTeacher(teacherId: string, formData: FormData) {
  await requireAdmin();
  const data = teacherDataFrom(formData);
  const status = String(formData.get("status") ?? "ACTIVE");

  if (data.staffId) {
    const dup = await prisma.teacher.findUnique({ where: { staffId: data.staffId } });
    if (dup && dup.id !== teacherId) redirect(`/staff/${teacherId}?error=staffid`);
  }

  await prisma.teacher.update({ where: { id: teacherId }, data: { ...data, status } });
  revalidatePath("/staff");
  redirect(`/staff/${teacherId}?saved=1`);
}

/** Creates a login for the teacher, or resets the password if one exists. */
export async function setTeacherLogin(teacherId: string, formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || password.length < 6) redirect(`/staff/${teacherId}?error=login`);

  const teacher = await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId } });
  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken && taken.id !== teacher.userId) redirect(`/staff/${teacherId}?error=username`);

  if (teacher.userId) {
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { username, passwordHash: bcrypt.hashSync(password, 10), active: true },
    });
  } else {
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: bcrypt.hashSync(password, 10),
        name: `${teacher.firstName} ${teacher.lastName}`,
        role: "TEACHER",
      },
    });
    await prisma.teacher.update({ where: { id: teacherId }, data: { userId: user.id } });
  }
  revalidatePath(`/staff/${teacherId}`);
  redirect(`/staff/${teacherId}?saved=login`);
}

/**
 * Admins may manage any teacher's signature; a teacher may only manage their own.
 * Returns where to send the user back to (staff page for admins, account page for teachers).
 */
async function signaturePermission(teacherId: string): Promise<string> {
  const session = await requireStaff();
  if (session.role === "ADMIN") return `/staff/${teacherId}`;
  const own = await prisma.teacher.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!own || own.id !== teacherId) redirect(homeFor(session.role));
  return "/account";
}

export async function uploadTeacherSignature(teacherId: string, formData: FormData) {
  const dest = await signaturePermission(teacherId);
  const image = await readImageFile(formData, "file", 1024);
  if (typeof image === "string") redirect(`${dest}?error=img_${image}`);

  await prisma.imageAsset.upsert({
    where: { teacherId },
    update: { bytes: image.bytes, mime: image.mime },
    create: { kind: "TEACHER_SIGNATURE", teacherId, bytes: image.bytes, mime: image.mime },
  });
  revalidatePath(dest);
  redirect(`${dest}?saved=signature`);
}

export async function removeTeacherSignature(teacherId: string) {
  const dest = await signaturePermission(teacherId);
  await prisma.imageAsset.deleteMany({ where: { teacherId } });
  revalidatePath(dest);
  redirect(`${dest}?saved=sigremoved`);
}

export async function addAssignment(teacherId: string, formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId") ?? "");
  const classGroupId = String(formData.get("classGroupId") ?? "");
  if (!subjectId || !classGroupId) redirect(`/staff/${teacherId}`);

  // Warn if another teacher already teaches this subject in this class —
  // both would be able to enter its scores.
  const others = await prisma.subjectAssignment.findMany({
    where: { subjectId, classGroupId, teacherId: { not: teacherId } },
    include: { teacher: true },
  });

  await prisma.subjectAssignment.upsert({
    where: { teacherId_subjectId_classGroupId: { teacherId, subjectId, classGroupId } },
    update: {},
    create: { teacherId, subjectId, classGroupId },
  });
  revalidatePath(`/staff/${teacherId}`);
  if (others.length > 0) {
    const names = others.map((o) => `${o.teacher.firstName} ${o.teacher.lastName}`).join(", ");
    redirect(`/staff/${teacherId}?warn=shared&with=${encodeURIComponent(names)}`);
  }
  redirect(`/staff/${teacherId}`);
}

export async function removeAssignment(assignmentId: string, teacherId: string) {
  await requireAdmin();
  await prisma.subjectAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/staff/${teacherId}`);
  redirect(`/staff/${teacherId}`);
}
