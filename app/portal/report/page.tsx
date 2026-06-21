import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePortal } from "@/lib/auth";
import { getPortalStudents } from "@/lib/portal";
import { getClassReportData } from "@/lib/reports";
import ReportCard from "@/components/report-card";
import PrintButton from "@/components/print-button";
import DownloadPdfButton from "@/components/download-pdf-button";

export const metadata = { title: "Report Card" };

export default async function PortalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; term?: string }>;
}) {
  const session = await requirePortal();
  const sp = await searchParams;

  const students = await getPortalStudents(session);
  const student = students.find((s) => s.id === sp.child) ?? students[0];
  if (!student || !student.classGroupId) notFound();

  const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
  const termId = sp.term ?? currentTerm?.id;
  if (!termId) notFound();

  const data = await getClassReportData(student.classGroupId, termId);
  const report = data?.reports.find((r) => r.studentId === student.id);
  if (!data || !report) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href={`/portal?child=${student.id}&term=${termId}`} className="btn-secondary">
          ← Back to portal
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
