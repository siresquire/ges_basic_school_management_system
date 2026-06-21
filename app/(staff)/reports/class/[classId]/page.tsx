import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getClassReportData } from "@/lib/reports";
import { getTeacherScope, canTeach } from "@/lib/teacher-scope";
import ReportCard from "@/components/report-card";
import PrintButton from "@/components/print-button";
import DownloadPdfButton from "@/components/download-pdf-button";

export const metadata = { title: "Class Report Cards" };

export default async function ClassReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const session = await requireStaff();
  const { classId } = await params;
  const sp = await searchParams;

  const scope = await getTeacherScope(session);
  if (!canTeach(scope, classId)) notFound();

  const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
  const termId = sp.term ?? currentTerm?.id;
  if (!termId) notFound();

  const data = await getClassReportData(classId, termId);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">
            {data.classGroup.name} — all report cards ({data.reports.length})
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {data.term.yearName} {data.term.name}. Each card prints on its own page.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/reports?class=${classId}&term=${termId}`} className="btn-secondary">
            ← Broadsheet
          </Link>
          <PrintButton label="Print all" />
          <DownloadPdfButton
            label="Download all PDF"
            filename={`${data.classGroup.name} — Report Cards — ${data.term.yearName} ${data.term.name}`}
            all
          />
        </div>
      </div>
      <div className="space-y-6">
        {data.reports.map((report) => (
          <ReportCard key={report.studentId} data={data} report={report} />
        ))}
      </div>
    </div>
  );
}
