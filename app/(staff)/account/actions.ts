"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSession, createSession } from "@/lib/auth";

function accountPathFor(role: string) {
  return role === "STUDENT" || role === "PARENT" ? "/portal/account" : "/account";
}

export async function updateOwnName(formData: FormData) {
  const session = await requireSession();
  const dest = accountPathFor(session.role);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) redirect(`${dest}?error=name`);

  await prisma.user.update({ where: { id: session.userId }, data: { name } });
  // Refresh the session cookie so the sidebar shows the new name immediately.
  await createSession({ ...session, name });
  revalidatePath("/", "layout");
  redirect(`${dest}?saved=name`);
}

export async function changeOwnPassword(formData: FormData) {
  const session = await requireSession();
  const dest = accountPathFor(session.role);
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) redirect(`${dest}?error=short`);
  if (next !== confirm) redirect(`${dest}?error=match`);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!bcrypt.compareSync(current, user.passwordHash)) redirect(`${dest}?error=current`);

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: bcrypt.hashSync(next, 10), tempPassword: null },
  });
  redirect(`${dest}?saved=password`);
}
