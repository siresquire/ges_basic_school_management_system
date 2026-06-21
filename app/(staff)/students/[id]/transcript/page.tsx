import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDateLong, fullName, todayISO } from "@/lib/format";
import { getGradeBands, gradeFor, totalScore, sectionForStage } from "@/lib/grading";
import { dataUrl, getSingletonImage } from "@/lib/images";
import PrintButton from "@/components/print-button";
import DownloadPdfButton from "@/components/download-pdf-button";

export const metadata = { title: "Transcript" };

export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [student, school, scores, primaryBands, jhsBands] = await Promise.all([
    prisma.student.findUnique({ where: { id }, include: { classGroup: true } }),
    prisma.schoolInfo.findUnique({ where: { id: 1 } }),
    prisma.score.findMany({
      where: { studentId: id },
      include: {
        subject: true,
        classGroup: true,
        term: { include: { academicYear: true } },
      },
      orderBy: { subject: { name: "asc" } },
    }),
    getGradeBands("PRIMARY"),
    getGradeBands("JHS"),
  ]);
  if (!student) notFound();

  const isJhsNow = student.classGroup?.stage === "JHS";
  const [logoAsset, headSigAsset, attendance, studentAttendance] = await Promise.all([
    getSingletonImage("LOGO"),
    getSingletonImage(isJhsNow ? "HEAD_SIGNATURE_JHS" : "HEAD_SIGNATURE_PRIMARY"),
    // Distinct school days per class+term the student has attendance in.
    prisma.attendanceRecord.findMany({
      where: {
        OR: [...new Set(scores.map((s) => `${s.classGroupId}|${s.termId}`))].map((key) => {
          const [classGroupId, termId] = key.split("|");
          return { classGroupId, termId };
        }),
      },
      select: { classGroupId: true, termId: true, date: true },
      distinct: ["classGroupId", "termId", "date"],
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: id, status: { in: ["PRESENT", "LATE"] } },
      select: { termId: true },
    }),
  ]);
  const logoUrl = dataUrl(logoAsset);
  const headSigUrl = dataUrl(headSigAsset);

  // End-of-term totals take precedence over the daily register.
  const termTotals = await prisma.termAttendance.findMany({
    where: { studentId: id },
    select: { termId: true, daysPresent: true, daysTotal: true },
  });
  const termTotalByTerm = new Map(termTotals.map((t) => [t.termId, t]));

  const schoolDaysByTerm = new Map<string, number>();
  for (const a of attendance) {
    const key = `${a.classGroupId}|${a.termId}`;
    schoolDaysByTerm.set(key, (schoolDaysByTerm.get(key) ?? 0) + 1);
  }
  const presentByTerm = new Map<string, number>();
  for (const a of studentAttendance) {
    presentByTerm.set(a.termId, (presentByTerm.get(a.termId) ?? 0) + 1);
  }

  // Group scores by term, ordered chronologically.
  const byTerm = new Map<string, typeof scores>();
  for (const s of scores) {
    (byTerm.get(s.termId) ?? byTerm.set(s.termId, []).get(s.termId)!).push(s);
  }
  const termBlocks = [...byTerm.values()]
    .map((termScores) => {
      const first = termScores[0];
      const bands = sectionForStage(first.classGroup.stage) === "JHS" ? jhsBands : primaryBands;
      const rows = termScores
        .map((s) => {
          const total = totalScore(s.classScore, s.examScore);
          if (total == null) return null;
          const band = gradeFor(bands, total);
          return {
            subject: s.subject.name,
            classPct: s.classScore != null ? Math.round(s.classScore * 0.5 * 10) / 10 : null,
            examPct: s.examScore != null ? Math.round(s.examScore * 0.5 * 10) / 10 : null,
            total: Math.round(total * 10) / 10,
            grade: band.grade,
            remark: band.remark,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      const average = rows.length
        ? Math.round((rows.reduce((a, r) => a + r.total, 0) / rows.length) * 10) / 10
        : null;
      const termTotal = termTotalByTerm.get(first.termId);
      const schoolDays =
        termTotal && termTotal.daysTotal != null
          ? termTotal.daysTotal
          : (schoolDaysByTerm.get(`${first.classGroupId}|${first.termId}`) ?? 0);
      const present =
        termTotal && termTotal.daysTotal != null
          ? (termTotal.daysPresent ?? 0)
          : (presentByTerm.get(first.termId) ?? 0);
      return {
        termId: first.termId,
        yearName: first.term.academicYear.name,
        termName: first.term.name,
        className: first.classGroup.name,
        schoolDays,
        present,
        rows,
        average,
      };
    })
    .filter((b) => b.rows.length > 0)
    .sort((a, b) =>
      a.yearName === b.yearName
        ? a.termName.localeCompare(b.termName)
        : a.yearName.localeCompare(b.yearName)
    );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/students/${student.id}`} className="btn-secondary">
          ← Back to profile
        </Link>
        <div className="flex gap-2">
          <PrintButton label="Print" />
          <DownloadPdfButton filename={`Transcript — ${fullName(student)}`} />
        </div>
      </div>

      <div className="print-area card mx-auto max-w-3xl bg-white p-8 text-[13px] leading-relaxed text-gray-900">
        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-3 text-center">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="School logo" className="mx-auto mb-2 h-16 w-16 object-contain" />
          )}
          <h1 className="text-xl font-bold tracking-wide uppercase">{school?.name}</h1>
          {school?.address && <p className="text-xs">{school.address}</p>}
          {school?.phone && <p className="text-xs">Tel: {school.phone}</p>}
          <p className="mt-2 text-sm font-semibold tracking-widest uppercase">
            Student Transcript
          </p>
        </div>

        {/* Student details */}
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-semibold">Name: </span>{fullName(student)}</p>
          <p><span className="font-semibold">Admission No.: </span>{student.admissionNo}</p>
          <p><span className="font-semibold">Gender: </span>{student.gender === "F" ? "Female" : "Male"}</p>
          <p>
            <span className="font-semibold">Date of birth: </span>
            {student.dateOfBirth ? fmtDateLong(student.dateOfBirth) : "—"}
          </p>
          <p>
            <span className="font-semibold">Current/last class: </span>
            {student.classGroup?.name ?? "—"}
          </p>
          <p>
            <span className="font-semibold">Status: </span>
            {student.status.charAt(0) + student.status.slice(1).toLowerCase()}
          </p>
        </div>

        {/* Per-term records */}
        {termBlocks.length === 0 && (
          <p className="mt-6 text-center text-sm text-gray-500">
            No academic records found for this learner.
          </p>
        )}
        {termBlocks.map((block) => (
          <div key={block.termId} className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-700 pb-1">
              <h2 className="text-sm font-bold">
                {block.yearName} — {block.termName} · {block.className}
              </h2>
              <p className="text-xs">
                Average: <span className="font-semibold">{block.average ?? "—"}</span>
                {block.schoolDays > 0 && (
                  <>
                    {" "}· Attendance:{" "}
                    <span className="font-semibold">
                      {block.present}/{block.schoolDays} days
                    </span>
                  </>
                )}
              </p>
            </div>
            <table className="mt-1 w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1 text-left">Subject</th>
                  <th className="border border-gray-400 px-2 py-1">Class (50%)</th>
                  <th className="border border-gray-400 px-2 py-1">Exam (50%)</th>
                  <th className="border border-gray-400 px-2 py-1">Total (100%)</th>
                  <th className="border border-gray-400 px-2 py-1">Grade</th>
                  <th className="border border-gray-400 px-2 py-1 text-left">Remark</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r) => (
                  <tr key={r.subject}>
                    <td className="border border-gray-400 px-2 py-1">{r.subject}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{r.classPct ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{r.examPct ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center font-semibold">{r.total}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{r.grade}</td>
                    <td className="border border-gray-400 px-2 py-1">{r.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Signature */}
        <div className="mt-8 flex items-end justify-between gap-8 text-xs">
          <p>
            <span className="font-semibold">Date issued: </span>
            {fmtDateLong(todayISO())}
          </p>
          <div className="w-64 text-center">
            {headSigUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headSigUrl} alt="Head signature" className="mx-auto mb-0.5 h-12 object-contain" />
            ) : (
              <div className="h-12" />
            )}
            <div className="border-t border-gray-400 pt-1">
              {isJhsNow ? (school?.jhsHeadTitle ?? "Headmaster") : "Headteacher"}
              {(isJhsNow ? school?.jhsHeadName : school?.headTeacherName)
                ? `: ${isJhsNow ? school?.jhsHeadName : school?.headTeacherName}`
                : ""}
            </div>
          </div>
        </div>
        {school?.motto && (
          <p className="mt-4 text-center text-xs text-gray-500 italic">“{school.motto}”</p>
        )}
      </div>
    </div>
  );
}
