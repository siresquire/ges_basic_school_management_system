import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { studentName } from "@/lib/format";
import { getStudentAnalytics } from "@/lib/analytics";
import { getTeacherScope, canTeach } from "@/lib/teacher-scope";
import { TrendChart, BarsChart, CHART_COLORS } from "@/components/charts";

export const metadata = { title: "Student Analytics" };

export default async function StudentAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaff();
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: { classGroup: true },
  });
  if (!student) notFound();

  const scope = await getTeacherScope(session);
  if (!scope.isAdmin && (!student.classGroupId || !canTeach(scope, student.classGroupId))) {
    notFound();
  }

  const analytics = await getStudentAnalytics(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Analytics — {studentName(student)}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {student.admissionNo} · {student.classGroup?.name ?? "No class"} · trends across every
            recorded term
          </p>
        </div>
        <Link href={`/students/${student.id}`} className="btn-secondary">
          ← Back to profile
        </Link>
      </div>

      {!analytics.hasData ? (
        <p className="card p-6 text-center text-sm text-gray-500">
          No scores recorded for this learner yet — charts appear once scores are entered.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-2 font-semibold text-gray-900">Term average vs class average</h2>
              <TrendChart
                data={analytics.termTrend}
                series={[
                  { key: "Student", color: "#047857" },
                  { key: "Class average", color: "#94a3b8" },
                ]}
              />
            </div>
            <div className="card p-5">
              <h2 className="mb-2 font-semibold text-gray-900">Attendance rate per term</h2>
              <TrendChart
                data={analytics.attendanceTrend}
                series={[{ key: "Attendance %", color: "#0369a1" }]}
              />
            </div>
          </div>

          {analytics.latestSubjects.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-2 font-semibold text-gray-900">
                Subjects vs class average — {analytics.latestTermLabel}
              </h2>
              <p className="mb-2 text-xs text-gray-500">
                Bars above the grey class average show subject strengths; below it, where support
                is needed.
              </p>
              <BarsChart
                data={analytics.latestSubjects}
                series={[
                  { key: "Student", color: "#047857" },
                  { key: "Class average", color: "#94a3b8" },
                ]}
                height={340}
              />
            </div>
          )}

          {analytics.subjectTrend.length > 1 && (
            <div className="card p-5">
              <h2 className="mb-2 font-semibold text-gray-900">Subject trends across terms</h2>
              <p className="mb-2 text-xs text-gray-500">
                Hover a line (or the legend) to identify a subject and see exact scores.
              </p>
              <TrendChart
                data={analytics.subjectTrend}
                series={analytics.subjectKeys.map((key, i) => ({
                  key,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                }))}
                height={380}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
