import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePortal } from "@/lib/auth";
import { getPortalStudents } from "@/lib/portal";
import { getClassReportData } from "@/lib/reports";
import { billedAmount } from "@/lib/fees";
import { ghs, fullName, studentName, PERIODS, WEEKDAYS } from "@/lib/format";
import FilterForm from "@/components/filter-form";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Portal" };

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; term?: string }>;
}) {
  const session = await requirePortal();
  const sp = await searchParams;

  const students = await getPortalStudents(session);
  if (students.length === 0) {
    return (
      <p className="card p-6 text-sm text-gray-600">
        Your account is not linked to any student yet. Please contact the school office.
      </p>
    );
  }

  const student = students.find((s) => s.id === sp.child) ?? students[0];

  const [terms, currentTerm] = await Promise.all([
    prisma.term.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { name: "desc" } }, { name: "asc" }],
    }),
    prisma.term.findFirst({ where: { isCurrent: true } }),
  ]);
  const termId = sp.term && terms.some((t) => t.id === sp.term) ? sp.term : currentTerm?.id;
  const term = terms.find((t) => t.id === termId);

  const reportData =
    student.classGroupId && termId
      ? await getClassReportData(student.classGroupId, termId)
      : null;
  const report = reportData?.reports.find((r) => r.studentId === student.id);

  const isStudent = session.role === "STUDENT";
  const isJHS = student.classGroup?.stage === "JHS";

  const [feeItems, payments, timetableSlots, school, subjectAssignments] = await Promise.all([
    termId ? prisma.feeItem.findMany({ where: { termId } }) : Promise.resolve([]),
    termId
      ? prisma.payment.findMany({ where: { studentId: student.id, termId } })
      : Promise.resolve([]),
    student.classGroupId
      ? prisma.timetableSlot.findMany({
          where: { classGroupId: student.classGroupId },
          include: { subject: true },
        })
      : Promise.resolve([]),
    prisma.schoolInfo.findUnique({ where: { id: 1 } }),
    !isStudent && student.classGroupId
      ? prisma.subjectAssignment.findMany({
          where: { classGroupId: student.classGroupId },
          include: {
            teacher: { select: { firstName: true, lastName: true, phone: true } },
            subject: { select: { name: true } },
          },
          orderBy: { subject: { name: "asc" } },
        })
      : Promise.resolve([]),
  ]);

  const billed = billedAmount(feeItems, student.classGroupId);
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const balance = Math.max(0, Math.round((billed - paid) * 100) / 100);
  const slotMap = new Map(timetableSlots.map((s) => [`${s.dayOfWeek}_${s.period}`, s]));
  const hasTimetable = timetableSlots.length > 0;

  // Contact details
  const headTitle = isJHS ? (school?.jhsHeadTitle ?? "Headmaster") : "Headteacher";
  const headName = isJHS ? school?.jhsHeadName : school?.headTeacherName;
  const headPhone = isJHS ? school?.jhsHeadPhone : school?.headTeacherPhone;
  const classTeacher = student.classGroup?.classTeacher ?? null;
  const ctTitle = isJHS ? "Form master/mistress" : "Class teacher";
  const subjectTeachers = subjectAssignments.filter((a) => a.teacher.phone);
  const hasContacts = !!headPhone || (!isStudent && (!!classTeacher?.phone || subjectTeachers.length > 0));

  return (
    <div className="space-y-6">
      {/* Child switcher + term selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{studentName(student)}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {student.admissionNo} · {student.classGroup?.name ?? "No class assigned"}
            {term ? ` · ${term.academicYear.name} ${term.name}` : ""}
          </p>
        </div>
        <FilterForm className="flex flex-wrap items-end gap-2">
          {students.length > 1 && (
            <div>
              <label className="label">Child</label>
              <select name="child" className="input" defaultValue={student.id}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Term</label>
            <select name="term" className="input" defaultValue={termId ?? ""}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.academicYear.name} — {t.name}
                  {t.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </FilterForm>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Term average</p>
          <p className="mt-1 text-2xl font-semibold">
            {report?.average ?? "—"}
            {report?.position && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({report.position} of {reportData?.classSize})
              </span>
            )}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Attendance</p>
          <p className="mt-1 text-2xl font-semibold">
            {report && report.attendanceTotal > 0
              ? `${report.attendancePresent}/${report.attendanceTotal} days`
              : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Fees balance</p>
          <p className={`mt-1 text-2xl font-semibold ${balance > 0 ? "text-red-600" : "text-emerald-700"}`}>
            {ghs(balance)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Billed {ghs(billed)} · Paid {ghs(paid)}
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Results</h2>
          {report && report.rows.length > 0 && (
            <Link
              href={`/portal/report?child=${student.id}&term=${termId}`}
              className="btn-secondary btn-sm"
            >
              Printable report card
            </Link>
          )}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Class score (50%)</th>
              <th>Exam score (50%)</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(report?.rows ?? []).map((row) => (
              <tr key={row.subjectName}>
                <td className="font-medium">{row.subjectName}</td>
                <td>{row.scaledClass ?? "—"}</td>
                <td>{row.scaledExam ?? "—"}</td>
                <td className="font-semibold">{row.total ?? "—"}</td>
                <td>{row.grade ?? "—"}</td>
                <td>{row.remark ?? "—"}</td>
              </tr>
            ))}
            {(!report || report.rows.length === 0) && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                  Results for this term have not been published yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Timetable */}
      {hasTimetable && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              {student.classGroup?.name} weekly timetable
            </h2>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-14">Period</th>
                {WEEKDAYS.map((d) => (
                  <th key={d}>{d.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p}>
                  <td className="text-center font-semibold">{p}</td>
                  {WEEKDAYS.map((_, di) => {
                    const slot = slotMap.get(`${di + 1}_${p}`);
                    return (
                      <td key={di} className="text-xs">
                        {slot?.label ? (
                          <span className="text-gray-500 italic">{slot.label}</span>
                        ) : (
                          (slot?.subject?.name ?? <span className="text-gray-300">—</span>)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contacts */}
      {hasContacts && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-gray-900">Contacts</h2>
          <div className="divide-y divide-gray-100">
            {headPhone && (
              <div className="flex items-center justify-between py-3 first:pt-0">
                <div>
                  <p className="text-sm font-medium">{headTitle}</p>
                  {headName && <p className="text-xs text-gray-500">{headName}</p>}
                </div>
                <div className="flex items-center">
                  <a href={`tel:${headPhone}`} className="text-sm font-medium text-emerald-700 hover:underline">
                    {headPhone}
                  </a>
                  <CopyButton value={headPhone} />
                </div>
              </div>
            )}
            {!isStudent && classTeacher?.phone && (
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{ctTitle}</p>
                  <p className="text-xs text-gray-500">{fullName(classTeacher)}</p>
                </div>
                <div className="flex items-center">
                  <a href={`tel:${classTeacher.phone}`} className="text-sm font-medium text-emerald-700 hover:underline">
                    {classTeacher.phone}
                  </a>
                  <CopyButton value={classTeacher.phone} />
                </div>
              </div>
            )}
            {!isStudent && subjectTeachers.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{a.subject.name}</p>
                  <p className="text-xs text-gray-500">{fullName(a.teacher)}</p>
                </div>
                <div className="flex items-center">
                  <a href={`tel:${a.teacher.phone!}`} className="text-sm font-medium text-emerald-700 hover:underline">
                    {a.teacher.phone}
                  </a>
                  <CopyButton value={a.teacher.phone!} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
