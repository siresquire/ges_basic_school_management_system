"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaff, homeFor } from "@/lib/auth";
import { getTeacherScope, canTeach, allowedSubjectIds } from "@/lib/teacher-scope";
import { classWorkTotal, classWorkToScore, CLASSWORK_MAX } from "@/lib/grading";
import { fullName } from "@/lib/format";
import { log } from "@/lib/activity";

/** Parse a class-work cell: 0..60, blank → null. */
function parseCw(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (isNaN(n)) return null;
  return Math.min(CLASSWORK_MAX, Math.max(0, n));
}

/** Parse an exam cell: blank → null. Out-of-range values are kept as-is so
 *  the caller can flag them rather than silently clamping (e.g. 120). */
function parseExam(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  if (isNaN(n)) return null;
  return Math.max(0, n);
}

const same = (a: number | null, b: number | null) =>
  (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.05);

const fmtScore = (cs: number | null, es: number | null) =>
  cs == null && es == null ? "empty" : `class ${cs ?? "—"} / exam ${es ?? "—"}`;

const fmtWhen = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export type ScoreConflict = {
  pupil: string;
  by: string;
  when: string;
  theirs: string;
  yours: string;
};

export type SaveScoresState = {
  ok: boolean;
  message: string;
  needsConfirm?: boolean;
  conflicts?: ScoreConflict[];
} | null;

/**
 * Saves a class's scores for one subject+term. Each pupil has four class works
 * (cw1–cw4, summing to ≤ 60) plus an exam out of 100; the canonical classScore
 * is the class-work total scaled to 100. If any pupil's score changed in the
 * system AFTER this form was loaded (someone else saved in between), the save
 * is REJECTED with the details — nothing is written until the teacher
 * explicitly confirms they want to replace the newer data.
 */
export async function saveScores(
  classGroupId: string,
  subjectId: string,
  termId: string,
  _prev: SaveScoresState,
  formData: FormData
): Promise<SaveScoresState> {
  const session = await requireStaff();
  const scope = await getTeacherScope(session);
  if (!canTeach(scope, classGroupId)) redirect(homeFor(session.role));
  const allowed = allowedSubjectIds(scope, classGroupId);
  if (allowed !== null && !allowed.includes(subjectId)) redirect(homeFor(session.role));

  const loadedAtRaw = String(formData.get("loadedAt") ?? "");
  const loadedAt = loadedAtRaw ? new Date(loadedAtRaw) : new Date(0);
  const override = formData.get("override") === "1";

  const [students, existing, classGroup, subject] = await Promise.all([
    prisma.student.findMany({
      where: { classGroupId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, otherNames: true },
    }),
    prisma.score.findMany({ where: { classGroupId, subjectId, termId } }),
    prisma.classGroup.findUnique({ where: { id: classGroupId }, select: { name: true } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
  ]);
  const existingByStudent = new Map(existing.map((s) => [s.studentId, s]));

  type Cells = {
    cw1: number | null;
    cw2: number | null;
    cw3: number | null;
    cw4: number | null;
    classScore: number | null;
    examScore: number | null;
  };
  type Write =
    | { kind: "delete"; studentId: string }
    | ({ kind: "upsert"; studentId: string } & Cells);
  const writes: Write[] = [];
  const conflicts: ScoreConflict[] = [];
  const invalid: string[] = [];

  for (const student of students) {
    const cw1 = parseCw(formData.get(`cw1_${student.id}`));
    const cw2 = parseCw(formData.get(`cw2_${student.id}`));
    const cw3 = parseCw(formData.get(`cw3_${student.id}`));
    const cw4 = parseCw(formData.get(`cw4_${student.id}`));
    const examScore = parseExam(formData.get(`es_${student.id}`));
    const cwTotal = classWorkTotal([cw1, cw2, cw3, cw4]);

    if (cwTotal != null && cwTotal > CLASSWORK_MAX) {
      invalid.push(`${fullName(student)} (class work total ${cwTotal} is above ${CLASSWORK_MAX})`);
      continue;
    }
    if (examScore != null && examScore > 100) {
      invalid.push(`${fullName(student)} (exam score ${examScore} is above 100)`);
      continue;
    }
    const classScore = classWorkToScore(cwTotal);
    const prior = existingByStudent.get(student.id);

    const allEmpty = cw1 == null && cw2 == null && cw3 == null && cw4 == null && examScore == null;
    const unchanged = prior
      ? same(classScore, prior.classScore) && same(examScore, prior.examScore)
      : allEmpty;
    if (unchanged) continue;

    if (prior && prior.updatedAt > loadedAt) {
      conflicts.push({
        pupil: fullName(student),
        by: prior.recordedBy ?? "someone else",
        when: fmtWhen(prior.updatedAt),
        theirs: fmtScore(prior.classScore, prior.examScore),
        yours: fmtScore(classScore, examScore),
      });
    }

    writes.push(
      allEmpty
        ? { kind: "delete", studentId: student.id }
        : { kind: "upsert", studentId: student.id, cw1, cw2, cw3, cw4, classScore, examScore }
    );
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Not saved — please correct: ${invalid.slice(0, 5).join("; ")}${
        invalid.length > 5 ? `; and ${invalid.length - 5} more` : ""
      }.`,
    };
  }

  if (conflicts.length > 0 && !override) {
    return {
      ok: false,
      needsConfirm: true,
      message: `Not saved: ${conflicts.length} pupil${conflicts.length === 1 ? "'s score was" : "s' scores were"} updated by someone else after you opened this page. Review below, then either reload to see the newer data or replace it with yours.`,
      conflicts,
    };
  }

  // Detect teachers whose scores we're about to overwrite (for override notifications)
  const overrideVictims = new Set<string>();
  for (const w of writes) {
    if (w.kind === "upsert") {
      const prior = existingByStudent.get(w.studentId);
      if (prior?.recordedByUserId && prior.recordedByUserId !== session.userId) {
        overrideVictims.add(prior.recordedByUserId);
      }
    }
  }

  for (const w of writes) {
    if (w.kind === "delete") {
      await prisma.score.deleteMany({ where: { studentId: w.studentId, subjectId, termId } });
    } else {
      await prisma.score.upsert({
        where: { studentId_subjectId_termId: { studentId: w.studentId, subjectId, termId } },
        update: {
          cw1: w.cw1,
          cw2: w.cw2,
          cw3: w.cw3,
          cw4: w.cw4,
          classScore: w.classScore,
          examScore: w.examScore,
          classGroupId,
          recordedBy: session.name,
          recordedByUserId: session.userId,
        },
        create: {
          studentId: w.studentId,
          subjectId,
          termId,
          classGroupId,
          cw1: w.cw1,
          cw2: w.cw2,
          cw3: w.cw3,
          cw4: w.cw4,
          classScore: w.classScore,
          examScore: w.examScore,
          recordedBy: session.name,
          recordedByUserId: session.userId,
        },
      });
    }
  }

  const className = classGroup?.name ?? classGroupId;
  const subjectName = subject?.name ?? subjectId;
  if (writes.length > 0) {
    await log({
      actorUserId: session.userId,
      actorName: session.name,
      action: "SCORE_SAVE",
      detail: `Saved ${writes.length} score(s) for ${subjectName} in ${className}`,
    });
    for (const victimUserId of overrideVictims) {
      await log({
        actorUserId: session.userId,
        actorName: session.name,
        action: "SCORE_OVERRIDE",
        detail: `${session.name} modified your ${subjectName} scores in ${className}`,
        notifyUserId: victimUserId,
      });
    }
  }

  revalidatePath("/scores");
  revalidatePath("/reports");
  return {
    ok: true,
    message:
      writes.length === 0
        ? "Nothing changed — scores are already up to date."
        : `${writes.length} pupil${writes.length === 1 ? "'s" : "s'"} scores saved${
            override && conflicts.length ? " (newer data replaced as you confirmed)" : ""
          }.`,
  };
}

/** Mark all unread score-override notifications for the current user as seen. */
export async function dismissNotifications() {
  const session = await requireStaff();
  await prisma.activityLog.updateMany({
    where: { notifyUserId: session.userId, seenAt: null },
    data: { seenAt: new Date() },
  });
  revalidatePath("/scores");
}
