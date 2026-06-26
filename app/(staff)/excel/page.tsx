import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getEnabledClassList, getTermList, getCurrentTerm } from "@/lib/cached";
import { getTeacherScope, filterClasses, allowedSubjectIds } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";
import ExcelUpload from "@/components/excel-upload";
import Icon from "@/components/icon";
import { importStudentsAction, importTeachersAction, importScoresAction } from "./actions";

export const maxDuration = 60; // Vercel Pro/Enterprise: extends serverless timeout for large uploads
export const metadata = { title: "Excel Sheets" };

export default async function ExcelPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  const session = await requireStaff();
  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  const sp = await searchParams;

  const [allClasses, terms, currentTerm, scope, adminLevels] = await Promise.all([
    getEnabledClassList(),
    getTermList(),
    getCurrentTerm(),
    getTeacherScope(session),
    getAdminLevels(session),
  ]);
  const classes = filterClasses(scope, allClasses)
    .filter((c) => !adminLevels || adminLevels.includes(c.stage));
  const termId = sp.term ?? currentTerm?.id ?? "";
  const selectedClass = classes.find((c) => c.id === sp.class);
  const classId = selectedClass?.id ?? "";

  // Subjects for the selected class — subject teachers only see their own;
  // class teachers / form masters and admins see all.
  const allowed = selectedClass ? allowedSubjectIds(scope, selectedClass.id) : null;
  const subjects = selectedClass
    ? (await prisma.subject.findMany({ orderBy: { name: "asc" } })).filter(
        (s) =>
          s.stages.split(",").includes(selectedClass.stage) &&
          (allowed === null || allowed.includes(s.id))
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Excel sheets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Download templates, fill them in Excel (or on a phone with an Excel app), then upload
          them back — nothing is saved until the upload succeeds.
        </p>
      </div>

      {(isAdmin || scope.classTeacherOf.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="mb-1 font-semibold text-gray-900">Bulk admit learners</h2>
            <p className="mb-3 text-xs text-gray-500">
              One row per learner. Class and gender are dropdowns; admission numbers are
              auto-generated when left blank. Existing admission numbers are skipped, so it&apos;s
              safe to re-upload after fixing problems.
              {!isAdmin && " Only students assigned to your class will be accepted."}
            </p>
            <a href="/excel/templates/students" className="btn-secondary btn-sm mb-3" download>
              <Icon name="download" /> Download learners template
            </a>
            <ExcelUpload action={importStudentsAction} buttonLabel="Upload filled template" />
          </div>

          {isAdmin && (
            <div className="card p-6">
              <h2 className="mb-1 font-semibold text-gray-900">Bulk add staff</h2>
              <p className="mb-3 text-xs text-gray-500">
                One row per teacher. After uploading, create logins and assign subjects from each
                teacher&apos;s Staff page.
              </p>
              <a href="/excel/templates/staff" className="btn-secondary btn-sm mb-3" download>
                <Icon name="download" /> Download staff template
              </a>
              <ExcelUpload action={importTeachersAction} buttonLabel="Upload filled template" />
            </div>
          )}
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Score sheets</h2>
        <p className="mb-4 text-xs text-gray-500">
          One sheet per subject with the class list pre-filled. Teachers enter the 4 class works
          (the total of 60 is flagged red if exceeded and converted to 50% automatically) and the
          exam score out of 100 (converted to 50%); the final 100% is computed in the sheet.
          Upload the same file here when done.
        </p>

        <FilterForm className="flex flex-wrap items-end gap-3">
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

        {selectedClass && termId && (
          <form action="/excel/templates/scores" method="get" className="mt-4 border-t border-gray-100 pt-4">
            <input type="hidden" name="class" value={classId} />
            <input type="hidden" name="term" value={termId} />
            <p className="label">Subjects to include</p>
            <div className="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="subjects"
                    value={s.id}
                    defaultChecked
                    className="h-4 w-4 accent-emerald-700"
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <button className="btn-primary btn-sm">
              <Icon name="download" /> Download score sheets for {selectedClass.name}
            </button>
          </form>
        )}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="label">Upload filled score sheets</p>
          <ExcelUpload action={importScoresAction} buttonLabel="Upload & save scores" />
        </div>
      </div>
    </div>
  );
}
