import { fmtDateLong } from "@/lib/format";
import type { ClassReportData, StudentReport } from "@/lib/reports";

/** One A4 terminal report card, in the familiar GES basic-school format. */
export default function ReportCard({
  data,
  report,
}: {
  data: ClassReportData;
  report: StudentReport;
}) {
  const { school, term, classGroup, classSize } = data;

  return (
    <div className="print-area print-page card mx-auto max-w-3xl bg-white p-8 text-[13px] leading-relaxed text-gray-900">
      {/* School header */}
      <div className="border-b-2 border-gray-900 pb-3 text-center">
        {school.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={school.logoUrl}
            alt="School logo"
            className="mx-auto mb-2 h-16 w-16 object-contain"
          />
        )}
        <h1 className="text-xl font-bold tracking-wide uppercase">{school.name}</h1>
        {school.address && <p className="text-xs">{school.address}</p>}
        {school.phone && <p className="text-xs">Tel: {school.phone}</p>}
        <p className="mt-2 text-sm font-semibold tracking-widest uppercase">
          Terminal Report — {term.yearName}, {term.name}
        </p>
      </div>

      {/* Student details */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <Field label="Name of Pupil" value={report.name} />
        <Field label="Admission No." value={report.admissionNo} />
        <Field label="Class" value={classGroup.name} />
        <Field
          label="Position in Class"
          value={report.position ? `${report.position} out of ${classSize}` : "—"}
        />
        <Field
          label="Attendance"
          value={
            report.attendanceTotal > 0
              ? `${report.attendancePresent} out of ${report.attendanceTotal} days`
              : "—"
          }
        />
        <Field label="Number on Roll" value={String(classSize)} />
        <Field label="Term Ended" value={fmtDateLong(term.endDate)} />
        <Field
          label="Next Term Begins"
          value={term.nextTermBegins ? fmtDateLong(term.nextTermBegins) : "To be announced"}
        />
      </div>

      {/* Scores table */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <Th className="text-left">Subject</Th>
            <Th>
              Class Score
              <br />
              (50%)
            </Th>
            <Th>
              Exam Score
              <br />
              (50%)
            </Th>
            <Th>
              Total
              <br />
              (100%)
            </Th>
            <Th>Grade</Th>
            <Th className="text-left">Remarks</Th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.subjectName}>
              <Td className="text-left font-medium">{row.subjectName}</Td>
              <Td>{row.scaledClass ?? "—"}</Td>
              <Td>{row.scaledExam ?? "—"}</Td>
              <Td className="font-semibold">{row.total ?? "—"}</Td>
              <Td>{row.grade ?? "—"}</Td>
              <Td className="text-left">{row.remark ?? "—"}</Td>
            </tr>
          ))}
          {report.rows.length === 0 && (
            <tr>
              <Td className="py-6 text-center text-gray-500" colSpan={6}>
                No scores entered for this term yet.
              </Td>
            </tr>
          )}
        </tbody>
        {report.rows.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <Td className="text-left">Overall</Td>
              <Td colSpan={2}>Total: {report.grandTotal}</Td>
              <Td colSpan={3} className="text-left">
                Average: {report.average ?? "—"}
              </Td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Conduct, remarks & signatures */}
      <div className="mt-5 space-y-2 text-sm">
        <p>
          <span className="font-semibold">Conduct: </span>
          {report.conduct ?? <span className="text-gray-400">______________________________</span>}
        </p>
        <p>
          <span className="font-semibold">{classGroup.teacherTitle}&apos;s Remarks: </span>
          {report.teacherRemark ?? "—"}
        </p>
        <p>
          <span className="font-semibold">{school.headTitle}&apos;s Remarks: </span>
          {report.headRemark ?? "—"}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-12">
          <div className="text-center text-xs">
            {classGroup.teacherSignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={classGroup.teacherSignatureUrl}
                alt={`${classGroup.teacherTitle} signature`}
                className="mx-auto mb-0.5 h-12 object-contain"
              />
            ) : (
              <div className="h-12" />
            )}
            <div className="border-t border-gray-400 pt-1">
              {classGroup.teacherTitle}
              {classGroup.teacherName ? `: ${classGroup.teacherName}` : ""}
            </div>
          </div>
          <div className="text-center text-xs">
            {school.headSignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={school.headSignatureUrl}
                alt={`${school.headTitle} signature`}
                className="mx-auto mb-0.5 h-12 object-contain"
              />
            ) : (
              <div className="h-12" />
            )}
            <div className="border-t border-gray-400 pt-1">
              {school.headTitle}
              {school.headName ? `: ${school.headName}` : ""}
            </div>
          </div>
        </div>
        {school.motto && (
          <p className="pt-2 text-center text-xs text-gray-500 italic">“{school.motto}”</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold">{label}: </span>
      {value}
    </p>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-gray-400 px-2 py-1.5 text-center align-bottom ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`border border-gray-400 px-2 py-1.5 text-center ${className}`}>
      {children}
    </td>
  );
}
