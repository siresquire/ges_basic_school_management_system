import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PERIODS, WEEKDAYS } from "@/lib/format";
import { getEnabledClassList } from "@/lib/cached";
import { getTeacherScope, filterClasses } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";
import PrintButton from "@/components/print-button";
import FilterForm from "@/components/filter-form";
import { saveTimetable } from "./actions";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "Timetable" };

const LABELS = ["Break", "Lunch", "Assembly", "Worship", "Library", "Sports"];

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; saved?: string }>;
}) {
  const session = await requireStaff();
  const sp = await searchParams;
  const isAdmin = session.role === "ADMIN";

  const [scope, adminLevels] = await Promise.all([
    getTeacherScope(session),
    getAdminLevels(session),
  ]);
  const classes = filterClasses(scope, await getEnabledClassList())
    .filter((c) => !adminLevels || adminLevels.includes(c.stage));
  const classId = sp.class ?? "";
  const selectedClass = classes.find((c) => c.id === classId);

  const [slots, subjects] = selectedClass
    ? await Promise.all([
        prisma.timetableSlot.findMany({
          where: { classGroupId: classId },
          include: { subject: true, teacher: true },
        }),
        prisma.subject.findMany({ orderBy: { name: "asc" } }),
      ])
    : [[], []];

  const classSubjects = selectedClass
    ? subjects.filter((s) => s.stages.split(",").includes(selectedClass.stage))
    : [];
  const slotMap = new Map(slots.map((s) => [`${s.dayOfWeek}_${s.period}`, s]));

  const grid = (
    <table className="tbl min-w-200">
      <thead>
        <tr>
          <th className="w-16">Period</th>
          {WEEKDAYS.map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PERIODS.map((period) => (
          <tr key={period}>
            <td className="text-center font-semibold">{period}</td>
            {WEEKDAYS.map((_, di) => {
              const day = di + 1;
              const slot = slotMap.get(`${day}_${period}`);
              const value = slot?.label ? `L:${slot.label}` : (slot?.subjectId ?? "");
              return (
                <td key={day} className="min-w-36">
                  {isAdmin ? (
                    <select
                      name={`slot_${day}_${period}`}
                      defaultValue={value}
                      className="input px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      <optgroup label="Subjects">
                        {classSubjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Other">
                        {LABELS.map((l) => (
                          <option key={l} value={`L:${l}`}>
                            {l}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  ) : slot?.label ? (
                    <span className="text-xs text-gray-500 italic">{slot.label}</span>
                  ) : slot?.subject ? (
                    <div className="text-xs">
                      <p className="font-medium">{slot.subject.name}</p>
                      {slot.teacher && (
                        <p className="text-gray-500">
                          {slot.teacher.firstName} {slot.teacher.lastName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin
              ? "Set each period, then save. Subject teachers are filled in from staff assignments."
              : "Weekly timetable per class."}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <FilterForm className="flex items-end gap-2">
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
          </FilterForm>
          {selectedClass && <PrintButton label="Print" />}
        </div>
      </div>

      {sp.saved && <ShowToast message="Timetable saved." />}

      {selectedClass && (
        <div className="print-area card overflow-x-auto">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">{selectedClass.name} — weekly timetable</h2>
          </div>
          {isAdmin ? (
            <form action={saveTimetable.bind(null, selectedClass.id)}>
              {grid}
              <div className="no-print flex justify-end border-t border-gray-200 p-4">
                <button className="btn-primary">Save timetable</button>
              </div>
            </form>
          ) : (
            grid
          )}
        </div>
      )}
    </div>
  );
}
