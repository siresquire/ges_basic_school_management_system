"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { log } from "@/lib/activity";

export async function addFeeItem(formData: FormData) {
  await requireAdmin();
  const termId = String(formData.get("termId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const classGroupId = String(formData.get("classGroupId") ?? "") || null;

  if (!termId || !name || !(amount > 0)) {
    redirect(`/fees?term=${termId}&error=item`);
  }
  await prisma.feeItem.create({ data: { termId, name, amount, classGroupId } });
  revalidatePath("/fees");
  redirect(`/fees?term=${termId}`);
}

export async function deleteFeeItem(feeItemId: string, termId: string) {
  await requireAdmin();
  await prisma.feeItem.delete({ where: { id: feeItemId } });
  revalidatePath("/fees");
  redirect(`/fees?term=${termId}`);
}

export async function recordPayment(formData: FormData) {
  const session = await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "CASH");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!studentId || !termId || !(amount > 0)) {
    redirect(`/fees?term=${termId}&error=payment`);
  }

  // Sequential receipt numbers; retry if two payments land at the same moment.
  let payment = null;
  for (let attempt = 0; attempt < 5 && !payment; attempt++) {
    const count = await prisma.payment.count();
    const receiptNo = `RCP-${String(count + 1 + attempt).padStart(5, "0")}`;
    try {
      payment = await prisma.payment.create({
        data: {
          receiptNo,
          studentId,
          termId,
          amount,
          method,
          reference,
          note,
          receivedBy: session.name,
        },
      });
    } catch {
      // receipt number taken — try the next one
    }
  }
  if (!payment) redirect(`/fees?term=${termId}&error=payment`);

  await log({
    actorUserId: session.userId,
    actorName: session.name,
    action: "PAYMENT_RECORD",
    detail: `${session.name} recorded payment GHS ${amount.toFixed(2)} via ${method} (${payment.receiptNo})`,
  });
  revalidatePath("/fees");
  redirect(`/fees/receipt/${payment.id}`);
}
