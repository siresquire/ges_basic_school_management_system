"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, startImpersonation, stopImpersonation, type Role } from "@/lib/auth";
import { log } from "@/lib/activity";

const ALL_LEVELS = ["CRECHE", "KG", "PRIMARY", "JHS"] as const;

export async function saveSchoolConfig(formData: FormData) {
  const session = await requireSuperAdmin();

  const enabledLevels = ALL_LEVELS.filter(
    (l) => formData.get(`level_${l}`) === "on"
  ).join(",");

  const data = {
    enabledLevels: enabledLevels || "KG,PRIMARY,JHS",
    feesEnabled: formData.get("feesEnabled") === "on",
    timetableEnabled: formData.get("timetableEnabled") === "on",
    analyticsEnabled: formData.get("analyticsEnabled") === "on",
    portalEnabled: formData.get("portalEnabled") === "on",
    transcriptsEnabled: formData.get("transcriptsEnabled") === "on",
    attendanceEnabled: formData.get("attendanceEnabled") === "on",
  };

  await prisma.schoolConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  await log({ actorUserId: session.userId, actorName: session.name, action: "SYSTEM_CONFIG", detail: `Updated system configuration (levels: ${data.enabledLevels})` });
  revalidatePath("/", "layout");
  redirect("/super-admin?saved=config");
}

export async function createSuperAdmin(formData: FormData) {
  const session = await requireSuperAdmin();

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !name || password.length < 6) {
    redirect("/super-admin?error=fields");
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) redirect("/super-admin?error=username");

  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "SUPER_ADMIN",
      tempPassword: password,
    },
  });

  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_CREATE", detail: `Created Super Admin account "${username}" (${name})` });
  revalidatePath("/super-admin");
  redirect("/super-admin?saved=superadmin");
}

export async function impersonateUser(formData: FormData) {
  const session = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, role: true, active: true },
  });
  if (!user || !user.active || user.role === "SUPER_ADMIN") redirect("/super-admin");

  await log({
    actorUserId: session.userId,
    actorName: session.name,
    action: "IMPERSONATE",
    detail: `${session.name} assumed the identity of ${user.name} (${user.role})`,
  });
  await startImpersonation({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
  });
  redirect("/");
}

export async function endImpersonation() {
  await stopImpersonation();
  redirect("/super-admin");
}

export async function resetSuperAdminPassword(userId: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) redirect("/super-admin?error=password");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, name: true } });
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: bcrypt.hashSync(password, 10), tempPassword: password },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_UPDATE", detail: `Reset password for Super Admin "${target.username}" (${target.name})` });
  redirect("/super-admin?saved=password");
}

export async function createAdminAccount(formData: FormData) {
  const session = await requireSuperAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !name || password.length < 6) redirect("/super-admin?error=admin_fields");

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) redirect("/super-admin?error=admin_username");

  const assignedLevels = ALL_LEVELS.filter(
    (l) => formData.get(`admin_level_${l}`) === "on"
  ).join(",");

  await prisma.user.create({
    data: { username, name, passwordHash: bcrypt.hashSync(password, 10), role: "ADMIN", assignedLevels, tempPassword: password },
  });
  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_CREATE", detail: `Created Admin account "${username}" (${name})${assignedLevels ? ` — levels: ${assignedLevels}` : ""}` });
  revalidatePath("/super-admin");
  redirect("/super-admin?saved=admin");
}

export async function updateAdminLevels(userId: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const assignedLevels = ALL_LEVELS.filter(
    (l) => formData.get(`admin_level_${l}`) === "on"
  ).join(",");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, name: true } });
  await prisma.user.update({ where: { id: userId }, data: { assignedLevels } });
  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_UPDATE", detail: `Updated levels for "${target.username}" → ${assignedLevels || "all levels"}` });
  revalidatePath("/super-admin");
  redirect("/super-admin?saved=admin_levels");
}

export async function resetAdminPassword(userId: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) redirect("/super-admin?error=password");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true, name: true } });
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: bcrypt.hashSync(password, 10), tempPassword: password } });
  await log({ actorUserId: session.userId, actorName: session.name, action: "ADMIN_UPDATE", detail: `Reset password for Admin "${target.username}" (${target.name})` });
  redirect("/super-admin?saved=password");
}

export async function toggleAdminActive(userId: string, formData: FormData) {
  const session = await requireSuperAdmin();
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { active: true, username: true, name: true } });
  const nextActive = !current.active;
  await prisma.user.update({ where: { id: userId }, data: { active: nextActive } });
  await log({ actorUserId: session.userId, actorName: session.name, action: "USER_TOGGLE", detail: `${nextActive ? "Activated" : "Deactivated"} account "${current.username}" (${current.name})` });
  revalidatePath("/super-admin");
  redirect("/super-admin");
}
