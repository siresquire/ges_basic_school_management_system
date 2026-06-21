import { prisma } from "@/lib/db";

export async function log(entry: {
  actorUserId?: string | null;
  actorName: string;
  action: string;
  detail: string;
  notifyUserId?: string | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        ...(entry.actorUserId ? { actorUserId: entry.actorUserId } : {}),
        actorName: entry.actorName,
        action: entry.action,
        detail: entry.detail,
        ...(entry.notifyUserId ? { notifyUserId: entry.notifyUserId } : {}),
      },
    });
  } catch {
    // Logging must never break the main operation
  }
}
