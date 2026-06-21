import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fullName, fmtDate } from "@/lib/format";
import { getGradeBands, sectionForStage } from "@/lib/grading";
import { getEnabledClassList, getTermList, getCurrentTerm } from "@/lib/cached";
import { getTeacherScope, filterClasses, allowedSubjectIds } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";
import ScoreEntryTable, { type ScoreRowData } from "@/components/score-entry-table";
import { saveScores, dismissNotifications } from "./actions";

export const metadata = { title: "Scores" };

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; subject?: string; term?: string }>;
}) {
  const session = await requireStaff();
  const sp = await searchParams;

  const [allClasses, terms, currentTerm, scope, adminLevels, notifications] = await Promise.all([
    getEnabledClassList(),
    getTermList(),
    getCurrentTerm(),
    getTeacherScope(session),
    getAdminLevels(session),
    session.role === "TEACHER"
      ? prisma.activityLog.findMany({
          where: { notifyUserId: session.userId, seenAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);
  const classes = filterClasses(scope, allClasses)
    .filter((c) => !adminLevels || adminLevels.includes(c.stage));

  const termId = sp.term ?? currentTerm?.id ?? "";
  const selectedClass = classes.find((c) => c.id === sp.class);
  const classId = selectedClass?.id ?? "";

  // Subjects relevant to the selected class's stage — and, for subject
  // teachers, only the ones assigned to them (class teachers see all).
  const allowed = selectedClass ? allowedSubjectIds(scope, selectedClass.id) : null;
  const subjects = selectedClass
    ? (await prisma.subject.findMany({ orderBy: { name: "asc" } })).filter(
        (s) =>
          s.stages.split(",").includes(selectedClass.stage) &&
          (allowed === null || allowed.includes(s.id))
      )
    : [];
  const subjectId = subjects.some((s) => s.id === sp.subject) ? sp.subject! : "";

  const ready = classId && subjectId && termId;
  const [students, existing] = ready
    ? await Promise.all([
        prisma.student.findMany({
          where: { classGroupId: classId, status: "ACTIVE" },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        prisma.score.findMany({ where: { classGroupId: classId, subjectId, termId } }),
      ])
    : [[], []];
  const bands = selectedClass ? await getGradeBands(sectionForStage(selectedClass.stage)) : [];
  const scoreMap = new Map(existing.map((s) => [s.studentId, s]));

  const rows: ScoreRowData[] = students.map((s) => {
    const sc = scoreMap.get(s.id);
    // Scores saved before class works were tracked individually carry only a
    // combined class score (/100). Show it as a single class-work figure (/60)
    // so the columns aren't blank — it converts back to the same value on save.
    const hasCw = sc && (sc.cw1 != null || sc.cw2 != null || sc.cw3 != null || sc.cw4 != null);
    const legacyCw1 =
      sc && !hasCw && sc.classScore != null ? Math.round((sc.classScore / 100) * 60 * 10) / 10 : null;
    return {
      studentId: s.id,
      name: fullName(s),
      cw1: hasCw ? sc!.cw1 : legacyCw1,
      cw2: hasCw ? sc!.cw2 : null,
      cw3: hasCw ? sc!.cw3 : null,
      cw4: hasCw ? sc!.cw4 : null,
      examScore: sc?.examScore ?? null,
      recordedBy: sc?.recordedBy ?? null,
      lastSaved: sc ? fmtDate(sc.updatedAt) : null,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Enter scores</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter the four class works (each out of {`<=`} 60 total) and the exam out of 100 — the
          50% conversions, final mark, grade and remark are worked out as you type, exactly like the{" "}
          <a href="/excel" className="font-medium text-emerald-700 hover:underline">
            Excel score sheet
          </a>
          . Prefer to work offline? Download the sheet and upload it later — either way works.
        </p>
      </div>

      {notifications.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Your scores were modified</p>
              <ul className="mt-1.5 space-y-1 text-sm text-amber-800">
                {notifications.map((n) => (
                  <li key={n.id}>
                    {n.detail}
                    <span className="ml-1.5 text-amber-600/80">
                      — {n.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <form action={dismissNotifications}>
              <button type="submit" className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-100">
                Dismiss
              </button>
            </form>
          </div>
        </div>
      )}

      <FilterForm className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Class</label>
          <select name="class" className="input" defaultValue={classId}>
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Subject</label>
          <select name="subject" className="input min-w-48" defaultValue={subjectId} disabled={!classId}>
            <option value="">{classId ? "Select subject…" : "Pick a class first"}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Term</label>
          <select name="term" className="input" defaultValue={termId}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYear.name} — {t.name}
                {t.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </FilterForm>

      {ready && rows.length > 0 && (
        <ScoreEntryTable
          action={saveScores.bind(null, classId, subjectId, termId)}
          rows={rows}
          bands={bands.map((b) => ({ min: b.min, grade: b.grade, remark: b.remark }))}
          draftKey={`scores:${classId}:${subjectId}:${termId}`}
        />
      )}

      {ready && rows.length === 0 && (
        <p className="card p-6 text-center text-sm text-gray-500">
          No active students in this class.
        </p>
      )}
    </div>
  );
}
