"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { dateFromISO } from "@/lib/format";
import { readImageFile, setSingletonImage, deleteSingletonImage } from "@/lib/images";
import { getAdminLevels } from "@/lib/admin-scope";
import { log } from "@/lib/activity";

const PRIMARY_STAGES = ["CRECHE", "KG", "PRIMARY"];

function canPrimary(adminLevels: string[] | null) {
  return !adminLevels || adminLevels.some((l) => PRIMARY_STAGES.includes(l));
}
function canJHS(adminLevels: string[] | null) {
  return !adminLevels || adminLevels.includes("JHS");
}

export async function saveSchoolInfo(formData: FormData) {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);
  const showPrimary = canPrimary(adminLevels);
  const showJHS = canJHS(adminLevels);

  const jhsHeadTitle = String(formData.get("jhsHeadTitle") ?? "Headmaster");
  const base = {
    name: String(formData.get("name") ?? "").trim() || "School",
    address: String(formData.get("address") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    motto: String(formData.get("motto") ?? "").trim() || null,
  };
  // Only update section-specific fields the admin has access to — prevents overwriting
  // the other section's data when the field is absent from the form.
  const data = {
    ...base,
    ...(showPrimary ? {
      headTeacherName: String(formData.get("headTeacherName") ?? "").trim() || null,
      headTeacherPhone: String(formData.get("headTeacherPhone") ?? "").trim() || null,
    } : {}),
    ...(showJHS ? {
      jhsHeadName: String(formData.get("jhsHeadName") ?? "").trim() || null,
      jhsHeadTitle: ["Headmaster", "Headmistress"].includes(jhsHeadTitle) ? jhsHeadTitle : "Headmaster",
      jhsHeadPhone: String(formData.get("jhsHeadPhone") ?? "").trim() || null,
    } : {}),
  };
  await prisma.schoolInfo.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "SCHOOL_INFO", detail: `Updated school information (name: "${data.name}")` });
  revalidatePath("/", "layout");
  redirect("/settings?saved=school");
}

export async function addAcademicYear(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!/^\d{4}\/\d{4}$/.test(name)) redirect("/settings?error=year");

  const year = await prisma.academicYear.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  // Convenience: create the three standard terms with placeholder dates if none exist.
  const termCount = await prisma.term.count({ where: { academicYearId: year.id } });
  if (termCount === 0) {
    const [startYear, endYear] = name.split("/").map(Number);
    await prisma.term.createMany({
      data: [
        { academicYearId: year.id, name: "Term 1", startDate: new Date(`${startYear}-09-01`), endDate: new Date(`${startYear}-12-15`) },
        { academicYearId: year.id, name: "Term 2", startDate: new Date(`${endYear}-01-08`), endDate: new Date(`${endYear}-04-01`) },
        { academicYearId: year.id, name: "Term 3", startDate: new Date(`${endYear}-05-01`), endDate: new Date(`${endYear}-07-30`) },
      ],
    });
  }
  revalidatePath("/settings");
  redirect("/settings?saved=year");
}

export async function updateTerm(termId: string, formData: FormData) {
  await requireAdmin();
  const start = String(formData.get("startDate") ?? "");
  const end = String(formData.get("endDate") ?? "");
  const next = String(formData.get("nextTermBegins") ?? "");
  await prisma.term.update({
    where: { id: termId },
    data: {
      startDate: start ? dateFromISO(start) : undefined,
      endDate: end ? dateFromISO(end) : undefined,
      nextTermBegins: next ? dateFromISO(next) : null,
    },
  });
  revalidatePath("/settings");
  redirect("/settings?saved=term");
}

export async function setCurrentTerm(termId: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.term.updateMany({ data: { isCurrent: false } }),
    prisma.term.update({ where: { id: termId }, data: { isCurrent: true } }),
  ]);
  revalidatePath("/", "layout");
  redirect("/settings?saved=current");
}

export async function uploadLogo(formData: FormData) {
  await requireAdmin();
  const image = await readImageFile(formData, "file", 2048);
  if (typeof image === "string") redirect(`/settings?error=img_${image}`);
  await setSingletonImage("LOGO", image);
  revalidatePath("/", "layout");
  redirect("/settings?saved=logo");
}

export async function removeLogo() {
  await requireAdmin();
  await deleteSingletonImage("LOGO");
  revalidatePath("/", "layout");
  redirect("/settings?saved=logoremoved");
}

export async function uploadHeadSignature(section: "PRIMARY" | "JHS", formData: FormData) {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);
  if (section === "PRIMARY" && !canPrimary(adminLevels)) redirect("/settings?error=protected");
  if (section === "JHS" && !canJHS(adminLevels)) redirect("/settings?error=protected");
  const image = await readImageFile(formData, "file", 1024);
  if (typeof image === "string") redirect(`/settings?error=img_${image}`);
  await setSingletonImage(section === "JHS" ? "HEAD_SIGNATURE_JHS" : "HEAD_SIGNATURE_PRIMARY", image);
  revalidatePath("/settings");
  redirect("/settings?saved=headsig");
}

export async function removeHeadSignature(section: "PRIMARY" | "JHS") {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);
  if (section === "PRIMARY" && !canPrimary(adminLevels)) redirect("/settings?error=protected");
  if (section === "JHS" && !canJHS(adminLevels)) redirect("/settings?error=protected");
  await deleteSingletonImage(section === "JHS" ? "HEAD_SIGNATURE_JHS" : "HEAD_SIGNATURE_PRIMARY");
  revalidatePath("/settings");
  redirect("/settings?saved=headsigremoved");
}

/**
 * Replaces the grading scale for one section (KG/Primary or JHS) with the
 * rows submitted from the editor. Rows with an empty grade are dropped —
 * that's also how a band is deleted.
 */
export async function saveGradeBands(section: "PRIMARY" | "JHS", formData: FormData) {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);
  if (section === "PRIMARY" && !canPrimary(adminLevels)) redirect("/settings?error=protected");
  if (section === "JHS" && !canJHS(adminLevels)) redirect("/settings?error=protected");

  const bands: { section: string; minScore: number; grade: string; remark: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const grade = String(formData.get(`grade_${i}`) ?? "").trim();
    const remark = String(formData.get(`remark_${i}`) ?? "").trim();
    const min = Number(formData.get(`min_${i}`));
    if (!grade || isNaN(min) || min < 0 || min > 100) continue;
    bands.push({ section, minScore: min, grade, remark });
  }
  if (bands.length === 0) redirect("/settings?error=bands");
  if (!bands.some((b) => b.minScore === 0)) {
    // Make sure every score earns a grade.
    redirect("/settings?error=bandszero");
  }

  await prisma.$transaction([
    prisma.gradeBand.deleteMany({ where: { section } }),
    prisma.gradeBand.createMany({ data: bands }),
  ]);
  revalidatePath("/settings");
  redirect("/settings?saved=bands");
}

const STAGES = ["CRECHE", "KG", "PRIMARY", "JHS"];

function stagesFrom(formData: FormData) {
  return formData
    .getAll("stages")
    .map(String)
    .filter((s) => STAGES.includes(s))
    .join(",");
}

export async function addSubject(formData: FormData) {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/settings?error=subjectname");

  const dup = await prisma.subject.findUnique({ where: { name } });
  if (dup) redirect("/settings?error=subjectdup");

  // Level-restricted admins can only assign stages within their levels.
  // Default to all their levels if they submitted none — prevents invisible subjects.
  let stages = stagesFrom(formData);
  if (adminLevels) {
    stages = stages.split(",").filter((s) => adminLevels.includes(s)).join(",");
    if (!stages) stages = adminLevels.join(",");
  }

  await prisma.subject.create({ data: { name, stages } });
  await log({ actorUserId: session.userId, actorName: session.name, action: "SUBJECT_CREATE", detail: `Added subject "${name}" (stages: ${stages || "none"})` });
  revalidatePath("/settings");
  redirect("/settings?saved=subject");
}

export async function updateSubject(subjectId: string, formData: FormData) {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/settings?error=subjectname");

  const dup = await prisma.subject.findUnique({ where: { name } });
  if (dup && dup.id !== subjectId) redirect("/settings?error=subjectdup");

  let stages: string;
  if (adminLevels) {
    // Preserve stages from levels this admin cannot manage; only update their own.
    const current = await prisma.subject.findUnique({ where: { id: subjectId }, select: { stages: true } });
    const preserved = (current?.stages ?? "").split(",").filter((s) => s && !adminLevels.includes(s));
    const submitted = stagesFrom(formData).split(",").filter((s) => s && adminLevels.includes(s));
    stages = [...preserved, ...submitted].join(",");
  } else {
    stages = stagesFrom(formData);
  }

  await prisma.subject.update({
    where: { id: subjectId },
    data: { name, stages },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "SUBJECT_UPDATE", detail: `Updated subject "${name}" (stages: ${stages || "none"})` });
  revalidatePath("/settings");
  redirect("/settings?saved=subject");
}

/**
 * A subject with recorded scores can't be deleted (old report cards are built
 * from them) — untick all its stages instead to retire it from new score entry.
 * Level-restricted admins only remove their own stages; full delete only happens
 * when no stages from other levels remain.
 */
export async function deleteSubject(subjectId: string) {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);

  const scoreCount = await prisma.score.count({ where: { subjectId } });
  if (scoreCount > 0) redirect("/settings?error=subjectscores");

  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { name: true, stages: true } });

  if (adminLevels) {
    const remaining = subject.stages.split(",").filter((s) => s && !adminLevels.includes(s));
    if (remaining.length > 0) {
      // Subject belongs to other levels too — strip only this admin's stages.
      await prisma.subject.update({ where: { id: subjectId }, data: { stages: remaining.join(",") } });
      await log({ actorUserId: session.userId, actorName: session.name, action: "SUBJECT_UPDATE", detail: `Removed "${subject.name}" from levels: ${adminLevels.join(", ")}` });
      revalidatePath("/settings");
      redirect("/settings?saved=subjectdeleted");
    }
    // Falls through: subject is entirely within this admin's levels — fully delete below.
  }

  await prisma.$transaction([
    prisma.subjectAssignment.deleteMany({ where: { subjectId } }),
    prisma.timetableSlot.deleteMany({ where: { subjectId } }),
    prisma.subject.delete({ where: { id: subjectId } }),
  ]);
  await log({ actorUserId: session.userId, actorName: session.name, action: "SUBJECT_DELETE", detail: `Deleted subject "${subject.name}"` });
  revalidatePath("/settings");
  redirect("/settings?saved=subjectdeleted");
}

/** Creates an additional administrator account (e.g. head teacher + office clerk). */
export async function createAdminUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !name || password.length < 6) redirect("/settings?error=adminfields");

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) redirect("/settings?error=adminusername");

  await prisma.user.create({
    data: { username, name, passwordHash: bcrypt.hashSync(password, 10), role: "ADMIN", tempPassword: password },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_CREATE", detail: `Created admin account "${username}" (${name})` });
  revalidatePath("/settings");
  redirect("/settings?saved=admin");
}

export async function adminResetPassword(userId: string, formData: FormData) {
  const session = await requireAdmin();
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if ((target.role === "SUPER_ADMIN" || target.role === "ADMIN") && session.role !== "SUPER_ADMIN") {
    redirect("/settings?error=protected");
  }
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) redirect("/settings?error=password");
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: bcrypt.hashSync(password, 10), tempPassword: password },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_UPDATE", detail: `Reset password for "${target.username}" (${target.name})` });
  redirect("/settings?saved=password");
}

export async function toggleUserActive(userId: string) {
  const session = await requireAdmin();
  if (session.userId === userId) redirect("/settings?error=self");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if ((user.role === "SUPER_ADMIN" || user.role === "ADMIN") && session.role !== "SUPER_ADMIN") {
    redirect("/settings?error=protected");
  }
  const nextActive = !user.active;
  await prisma.user.update({ where: { id: userId }, data: { active: nextActive } });
  await log({ actorUserId: session.userId, actorName: session.name, action: "USER_TOGGLE", detail: `${nextActive ? "Activated" : "Deactivated"} account "${user.username}" (${user.name})` });
  revalidatePath("/settings");
  redirect("/settings?saved=user");
}
