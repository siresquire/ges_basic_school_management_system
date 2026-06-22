import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { studentName, todayISO, dateFromISO, fmtDate } from "@/lib/format";
import { getEnabledClassList, getTermList, getCurrentTerm } from "@/lib/cached";
import { getTeacherScope, canAdminister } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";
import DraftForm from "@/components/draft-form";
import TermAttendanceTable, { type TermAttendanceRow } from "@/components/term-attendance-table";
import ExcelUpload from "@/components/excel-upload";
import Icon from "@/components/icon";
import { saveAttendance, saveTermAttendance } from "./actions";
import { importAttendanceAction } from "../excel/actions";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "Attendance" };

const OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
];

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string; date?: string; mode?: string; saved?: string; error?: string }>;
}) {
  const session = await requireStaff();
  const sp = await searchParams;
  const mode = sp.mode === "daily" ? "daily" : "term";

  // Only the class teacher / form master of a class handles its attendance.
  const [scope, adminLevels] = await Promise.all([
    getTeacherScope(session),
    getAdminLevels(session),
  ]);
  const classes = (await getEnabledClassList())
    .filter((c) => canAdminister(scope, c.id))
    .filter((c) => !adminLevels || adminLevels.includes(c.stage));
  const classId = sp.class && canAdminister(scope, sp.class) ? sp.class : "";

  if (!scope.isAdmin && classes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Attendance</h1>
        <p className="card p-6 text-sm text-gray-600">
          Attendance is handled by class teachers and form masters/mistresses. You are not assigned
          to administrate a class — if that&apos;s wrong, ask the administrator to set you as the
          class teacher under Classes.
        </p>
      </div>
    );
  }

  const tab = (m: string, label: string) => {
    const active = mode === m;
    const params = new URLSearchParams();
    if (classId) params.set("class", classId);
    params.set("mode", m);
    return (
      <Link
        href={`/attendance?${params.toString()}`}
        className={`rounded-md px-3 py-2 text-sm font-medium ${
          active ? "bg-emerald-700 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record each pupil&apos;s attendance for the term as a total from the register, online or
          by Excel. The daily register is also available for day-by-day marking.
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        {tab("term", "Term totals")}
        {tab("daily", "Daily register")}
      </div>

      {mode === "term" ? (
        <TermMode classes={classes} classId={classId} sp={sp} />
      ) : (
        <DailyMode classes={classes} classId={classId} sp={sp} />
      )}
    </div>
  );
}

// ---------- Term totals (primary) ----------

async function TermMode({
  classes,
  classId,
  sp,
}: {
  classes: { id: string; name: string }[];
  classId: string;
  sp: { term?: string; saved?: string };
}) {
  const [terms, currentTerm] = await Promise.all([getTermList(), getCurrentTerm()]);
  const termId = sp.term ?? currentTerm?.id ?? "";

  const existing = classId && termId
    ? await prisma.termAttendance.findMany({ where: { classGroupId: classId, termId } })
    : [];
  const students = classId
    ? await prisma.student.findMany({
        where: { classGroupId: classId, status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
    : [];
  const byStudent = new Map(existing.map((t) => [t.studentId, t]));
  const initialTotal = existing.find((t) => t.daysTotal != null)?.daysTotal ?? null;

  const rows: TermAttendanceRow[] = students.map((s) => {
    const t = byStudent.get(s.id);
    return {
      studentId: s.id,
      name: studentName(s),
      daysPresent: t?.daysPresent ?? null,
      recordedBy: t?.recordedBy ?? null,
      lastSaved: t ? fmtDate(t.updatedAt) : null,
    };
  });

  return (
    <>
      {sp.saved === "term" && <ShowToast message="Attendance totals saved — they now appear on report cards." />}

      <FilterForm className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="mode" value="term" />
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

      {classId && termId && rows.length > 0 && (
        <>
          <div className="card flex flex-wrap items-center gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Prefer Excel?</p>
              <p className="text-xs text-gray-500">
                Download the class list, fill the days present from your register, and upload it
                back.
              </p>
            </div>
            <a
              href={`/excel/templates/attendance?class=${classId}&term=${termId}`}
              className="btn-secondary btn-sm"
              download
            >
              <Icon name="download" /> Download attendance template
            </a>
            <div className="min-w-56 flex-1">
              <ExcelUpload action={importAttendanceAction} buttonLabel="Upload filled template" />
            </div>
          </div>

          <TermAttendanceTable
            action={saveTermAttendance.bind(null, classId, termId)}
            rows={rows}
            initialTotal={initialTotal}
            draftKey={`termatt:${classId}:${termId}`}
          />
        </>
      )}

      {classId && termId && rows.length === 0 && (
        <p className="card p-6 text-center text-sm text-gray-500">
          No active students in this class.
        </p>
      )}
    </>
  );
}

// ---------- Daily register (secondary; for future digital marking) ----------

async function DailyMode({
  classes,
  classId,
  sp,
}: {
  classes: { id: string; name: string }[];
  classId: string;
  sp: { date?: string; saved?: string; error?: string };
}) {
  const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO();
  const date = dateFromISO(dateISO);

  const [students, existing] = classId
    ? await Promise.all([
        prisma.student.findMany({
          where: { classGroupId: classId, status: "ACTIVE" },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        prisma.attendanceRecord.findMany({ where: { classGroupId: classId, date } }),
      ])
    : [[], []];
  const statusMap = new Map(existing.map((a) => [a.studentId, a.status]));
  const alreadyMarked = existing.length > 0;

  return (
    <>
      <p className="text-sm text-gray-500">
        Mark the register for a single day. (Day-by-day marking — most schools instead use “Term
        totals”.)
      </p>

      {sp.saved === "1" && <ShowToast message={`Attendance saved for ${fmtDate(date)}.`} />}
      {sp.error === "noterm" && <ShowToast message="No term covers that date — check the term dates in Settings." type="error" />}

      <FilterForm className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="mode" value="daily" />
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
          <label className="label">Date</label>
          <input type="date" name="date" className="input" defaultValue={dateISO} />
        </div>
        {classId && alreadyMarked && (
          <span className="badge-green ml-auto self-center">
            Already marked — you can adjust and re-save
          </span>
        )}
      </FilterForm>

      {classId && students.length > 0 && (
        <DraftForm
          draftKey={`attendance:${classId}:${dateISO}`}
          action={saveAttendance.bind(null, classId, dateISO)}
          className="card overflow-x-auto"
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                {OPTIONS.map((o) => (
                  <th key={o.value} className="text-center">
                    {o.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const current = statusMap.get(s.id) ?? "PRESENT";
                return (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td className="font-medium whitespace-nowrap">{studentName(s)}</td>
                    {OPTIONS.map((o) => (
                      <td key={o.value} className="text-center">
                        <input
                          type="radio"
                          name={`st_${s.id}`}
                          value={o.value}
                          defaultChecked={current === o.value}
                          className="h-4 w-4 accent-emerald-700"
                          aria-label={`${studentName(s)} ${o.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-200 p-4">
            <p className="text-xs text-gray-500">
              Unmarked students default to Present. {fmtDate(date)}.
            </p>
            <button className="btn-primary">Save register</button>
          </div>
        </DraftForm>
      )}

      {classId && students.length === 0 && (
        <p className="card p-6 text-center text-sm text-gray-500">
          No active students in this class.
        </p>
      )}
    </>
  );
}
