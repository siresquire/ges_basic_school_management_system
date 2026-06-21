import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getClassReportData } from "@/lib/reports";
import { autoTeacherRemark, autoHeadRemark } from "@/lib/grading";
import { getTeacherScope, canAdminister } from "@/lib/teacher-scope";
import DraftForm from "@/components/draft-form";
import { saveRemarks } from "../actions";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "Remarks & Conduct" };

export default async function RemarksPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string; saved?: string }>;
}) {
  const session = await requireStaff();
  const sp = await searchParams;

  const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
  const classId = sp.class ?? "";
  const termId = sp.term ?? currentTerm?.id ?? "";
  if (!classId || !termId) notFound();

  // Conduct & remarks belong to the class teacher / form master (or admin).
  const scope = await getTeacherScope(session);
  if (!canAdminister(scope, classId)) redirect("/reports");

  const [data, overrides] = await Promise.all([
    getClassReportData(classId, termId),
    prisma.reportRemark.findMany({ where: { termId, student: { classGroupId: classId } } }),
  ]);
  if (!data) notFound();
  const overrideMap = new Map(overrides.map((o) => [o.studentId, o]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">
            Remarks &amp; conduct — {data.classGroup.name}, {data.term.yearName} {data.term.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Anything left empty uses the automatic remark (shown in grey) based on the pupil&apos;s
            average. Conduct is left blank on the card if not filled.
          </p>
        </div>
        <Link href={`/reports?class=${classId}&term=${termId}`} className="btn-secondary">
          ← Back to broadsheet
        </Link>
      </div>

      {sp.saved && <ShowToast message="Remarks saved — report cards updated." />}

      <DraftForm
        draftKey={`remarks:${classId}:${termId}`}
        action={saveRemarks.bind(null, classId, termId)}
        className="card overflow-x-auto"
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Student</th>
              <th>Average</th>
              <th className="min-w-40">Conduct</th>
              <th className="min-w-60">{data.classGroup.teacherTitle}&apos;s remarks</th>
              <th className="min-w-60">{data.school.headTitle}&apos;s remarks</th>
            </tr>
          </thead>
          <tbody>
            {data.reports.map((r) => {
              const o = overrideMap.get(r.studentId);
              return (
                <tr key={r.studentId}>
                  <td className="font-medium whitespace-nowrap">{r.name}</td>
                  <td>{r.average ?? "—"}</td>
                  <td>
                    <input
                      name={`conduct_${r.studentId}`}
                      className="input py-1 text-sm"
                      defaultValue={o?.conduct ?? ""}
                      placeholder="e.g. Respectful and hardworking"
                    />
                  </td>
                  <td>
                    <input
                      name={`tr_${r.studentId}`}
                      className="input py-1 text-sm"
                      defaultValue={o?.teacherRemark ?? ""}
                      placeholder={r.average != null ? autoTeacherRemark(r.average) : "No scores yet"}
                    />
                  </td>
                  <td>
                    <input
                      name={`hr_${r.studentId}`}
                      className="input py-1 text-sm"
                      defaultValue={o?.headRemark ?? ""}
                      placeholder={r.average != null ? autoHeadRemark(r.average) : "No scores yet"}
                    />
                  </td>
                </tr>
              );
            })}
            {data.reports.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No active students in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {data.reports.length > 0 && (
          <div className="flex justify-end border-t border-gray-200 p-4">
            <button className="btn-primary">Save all remarks</button>
          </div>
        )}
      </DraftForm>
    </div>
  );
}
