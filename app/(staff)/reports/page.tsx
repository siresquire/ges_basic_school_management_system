import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getClassReportData } from "@/lib/reports";
import { getEnabledClassList, getTermList, getCurrentTerm } from "@/lib/cached";
import { getTeacherScope, filterClasses, canAdminister } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";

export const metadata = { title: "Report Cards" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  const session = await requireStaff();
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

  const classId = classes.some((c) => c.id === sp.class) ? sp.class! : "";
  const termId = sp.term ?? currentTerm?.id ?? "";
  const data = classId && termId ? await getClassReportData(classId, termId) : null;
  const mayEditRemarks = classId ? canAdminister(scope, classId) : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Report cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick a class and term to see the broadsheet, then print individual or whole-class report
          cards.
        </p>
      </div>

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
        {data && data.reports.length > 0 && (
          <div className="ml-auto flex gap-2">
            {mayEditRemarks && (
              <Link href={`/reports/remarks?class=${classId}&term=${termId}`} className="btn-secondary">
                Remarks &amp; conduct
              </Link>
            )}
            <Link href={`/reports/class/${classId}?term=${termId}`} className="btn-primary">
              Print all report cards
            </Link>
          </div>
        )}
      </FilterForm>

      {data && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              {data.classGroup.name} broadsheet — {data.term.yearName} {data.term.name}
            </h2>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Position</th>
                <th>Student</th>
                <th>Subjects scored</th>
                <th>Total</th>
                <th>Average</th>
                <th>Attendance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...data.reports]
                .sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
                .map((r) => (
                  <tr key={r.studentId}>
                    <td className="font-semibold">{r.position ?? "—"}</td>
                    <td className="font-medium">{r.name}</td>
                    <td>{r.rows.length}</td>
                    <td>{r.grandTotal || "—"}</td>
                    <td>{r.average ?? "—"}</td>
                    <td>
                      {r.attendanceTotal > 0
                        ? `${r.attendancePresent}/${r.attendanceTotal}`
                        : "—"}
                    </td>
                    <td>
                      <Link
                        href={`/reports/${r.studentId}?term=${termId}`}
                        className="text-sm font-medium text-emerald-700 hover:underline"
                      >
                        View report card
                      </Link>
                    </td>
                  </tr>
                ))}
              {data.reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No active students in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
