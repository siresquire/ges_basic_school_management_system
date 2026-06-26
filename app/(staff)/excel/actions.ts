"use server";

// Extend the serverless function timeout (requires Vercel Pro/Enterprise).
export const maxDuration = 60;

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getTeacherScope } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";
import { prisma } from "@/lib/db";
import {
  importStudentsFromBuffer,
  importTeachersFromBuffer,
  importScoresFromBuffer,
  importAttendanceFromBuffer,
  type ImportResult,
  type ScoreImportRestriction,
} from "@/lib/excel";
import { log } from "@/lib/activity";

export type ExcelActionState = ImportResult | null;

const MAX_UPLOAD = 4 * 1024 * 1024;

async function fileBuffer(formData: FormData): Promise<Buffer | ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an Excel (.xlsx) file first.", details: [] };
  }
  if (file.size > MAX_UPLOAD) {
    return { ok: false, message: "That file is too large (over 4 MB).", details: [] };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: "Only Excel (.xlsx) files are accepted.", details: [] };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  // xlsx is a ZIP — verify magic bytes PK (0x50 0x4B)
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return { ok: false, message: "That does not look like a valid Excel file. Please use the .xlsx template downloaded from this page.", details: [] };
  }
  return buf;
}

const READ_ERROR: ImportResult = {
  ok: false,
  message: "Could not read that file — make sure it is the Excel template downloaded from this page.",
  details: [],
};

export async function importStudentsAction(
  _prev: ExcelActionState,
  formData: FormData
): Promise<ExcelActionState> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Not signed in.", details: [] };

  const buffer = await fileBuffer(formData);
  if (!Buffer.isBuffer(buffer)) return buffer;

  let allowedClassIds: string[] | undefined;

  if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
    // Admin: optionally restrict to their assigned school levels
    const adminLevels = await getAdminLevels(session);
    if (adminLevels) {
      const allowed = await prisma.classGroup.findMany({
        where: { stage: { in: adminLevels } },
        select: { id: true },
      });
      allowedClassIds = allowed.map((c) => c.id);
    }
  } else if (session.role === "TEACHER") {
    // Class teacher: may only import students into their own administered class(es)
    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.userId },
      select: { classTeacherOf: { select: { id: true } } },
    });
    if (!teacher || teacher.classTeacherOf.length === 0) {
      return { ok: false, message: "Only class teachers and administrators can bulk-upload learners.", details: [] };
    }
    allowedClassIds = teacher.classTeacherOf.map((c) => c.id);
  } else {
    return { ok: false, message: "Only administrators and class teachers can bulk-upload learners.", details: [] };
  }

  try {
    const result = await importStudentsFromBuffer(buffer, { allowedClassIds });
    revalidatePath("/students");
    return result;
  } catch {
    return READ_ERROR;
  }
}

export async function importTeachersAction(
  _prev: ExcelActionState,
  formData: FormData
): Promise<ExcelActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { ok: false, message: "Only administrators can bulk-upload staff.", details: [] };
  }
  const buffer = await fileBuffer(formData);
  if (!Buffer.isBuffer(buffer)) return buffer;
  try {
    const result = await importTeachersFromBuffer(buffer);
    revalidatePath("/staff");
    return result;
  } catch {
    return READ_ERROR;
  }
}

export async function importScoresAction(
  _prev: ExcelActionState,
  formData: FormData
): Promise<ExcelActionState> {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "TEACHER")) {
    return { ok: false, message: "Only staff can upload score sheets.", details: [] };
  }
  const buffer = await fileBuffer(formData);
  if (!Buffer.isBuffer(buffer)) return buffer;

  // Teachers may only import for their own classes/subjects.
  // Admins with assigned levels may only import for classes in those levels.
  let restrict: ScoreImportRestriction | undefined;
  if (session.role === "TEACHER") {
    const scope = await getTeacherScope(session);
    restrict = {
      taughtClassIds: scope.taughtClassIds,
      classTeacherOf: scope.classTeacherOf,
      subjectsByClass: scope.subjectsByClass,
    };
  } else if (session.role === "ADMIN") {
    const adminLevels = await getAdminLevels(session);
    if (adminLevels) {
      const allowed = await prisma.classGroup.findMany({
        where: { stage: { in: adminLevels } },
        select: { id: true },
      });
      const ids = allowed.map((c) => c.id);
      restrict = { taughtClassIds: ids, classTeacherOf: ids, subjectsByClass: {} };
    }
  }

  try {
    const result = await importScoresFromBuffer(buffer, {
      restrict,
      override: formData.get("override") === "1",
      recordedBy: session.name,
    });
    if (result.ok) {
      await log({
        actorUserId: session.userId,
        actorName: session.name,
        action: "SCORE_IMPORT",
        detail: `Excel scores import by ${session.name}: ${result.message}`,
      });
    }
    revalidatePath("/scores");
    revalidatePath("/reports");
    return result;
  } catch {
    return READ_ERROR;
  }
}

export async function importAttendanceAction(
  _prev: ExcelActionState,
  formData: FormData
): Promise<ExcelActionState> {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "TEACHER")) {
    return { ok: false, message: "Only staff can upload attendance.", details: [] };
  }
  const buffer = await fileBuffer(formData);
  if (!Buffer.isBuffer(buffer)) return buffer;

  // Teachers may only import attendance for classes they administrate.
  // Admins with assigned levels may only import for classes in those levels.
  let allowedClassIds: string[] | undefined;
  if (session.role === "TEACHER") {
    const scope = await getTeacherScope(session);
    allowedClassIds = scope.classTeacherOf;
  } else if (session.role === "ADMIN") {
    const adminLevels = await getAdminLevels(session);
    if (adminLevels) {
      const allowed = await prisma.classGroup.findMany({
        where: { stage: { in: adminLevels } },
        select: { id: true },
      });
      allowedClassIds = allowed.map((c) => c.id);
    }
  }

  try {
    const result = await importAttendanceFromBuffer(buffer, {
      allowedClassIds,
      recordedBy: session.name,
    });
    revalidatePath("/attendance");
    revalidatePath("/reports");
    return result;
  } catch {
    return READ_ERROR;
  }
}
