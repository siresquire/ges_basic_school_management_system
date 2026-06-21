"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, homeFor, type Role } from "@/lib/auth";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function getIdentifier(username: string): Promise<string> {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";
  return `${ip}:${username}`;
}

async function isRateLimited(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await prisma.loginAttempt.count({
    where: { identifier, createdAt: { gte: since } },
  });
  return count >= MAX_ATTEMPTS;
}

async function recordFailedAttempt(identifier: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { identifier } });
  // Prune stale rows — fire-and-forget so it never blocks the response
  prisma.loginAttempt
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS) } } })
    .catch(() => {});
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username) redirect("/login?error=1");

  const identifier = await getIdentifier(username);

  if (await isRateLimited(identifier)) {
    redirect("/login?error=rate");
  }

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !user.active || !bcrypt.compareSync(password, user.passwordHash)) {
    await recordFailedAttempt(identifier);
    redirect("/login?error=1");
  }

  await createSession({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
  });
  redirect(homeFor(user.role as Role));
}
