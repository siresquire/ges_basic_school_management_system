import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getClassReportData } from "@/lib/reports";
import { getTeacherScope, canTeach } from "@/lib/teacher-scope";
import ReportCard from "@/components/report-card";
import PrintButton from "@/components/print-button";
import DownloadPdfButton from "@/components/download-pdf-button";

export const metadata = { title: "Report Card" };

export default async function StudentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const session = await requireStaff();
  const { studentId } = await params;
  const sp = await searchParams;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) notFound();

  const scope = await getTeacherScope(session);
  if (student.classGroupId && !canTeach(scope, student.classGroupId)) notFound();

  const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
  const termId = sp.term ?? currentTerm?.id;

  if (!student.classGroupId || !termId) {
    return (
      <p className="card p-6 text-sm text-gray-600">
        This student has no class assigned (or no term selected), so a report card can&apos;t be
        generated. <Link href={`/students/${studentId}`} className="text-emerald-700 underline">Back to profile</Link>
      </p>
    );
  }

  const data = await getClassReportData(student.classGroupId, termId);
  const report = data?.reports.find((r) => r.studentId === studentId);
  if (!data || !report) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/reports?class=${student.classGroupId}&term=${termId}`} className="btn-secondary">
          ← Back to broadsheet
        </Link>
        <div className="flex gap-2">
          <PrintButton label="Print" />
          <DownloadPdfButton filename={`Report Card — ${student.firstName} ${student.lastName}`} />
        </div>
      </div>
      <ReportCard data={data} report={report} />
    </div>
  );
}
