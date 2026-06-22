import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getTeacherScope, filterClasses } from "@/lib/teacher-scope";
import { getEnabledLevels } from "@/lib/school-config";
import { getAdminLevels } from "@/lib/admin-scope";
import { createClass } from "./actions";
import DraggableClassList from "@/components/draggable-class-list";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "Classes" };

const SAVED_MESSAGES: Record<string, string> = {
  created: "Class added.",
  updated: "Class saved.",
  deleted: "Class deleted.",
};

const ERROR_MESSAGES: Record<string, string> = {
  name: "The class needs a name.",
  duplicate: "A class with that name already exists.",
  hasstudents: "This class still has students — move them to another class first (or mark them transferred/graduated and reassign).",
  hashistory: "This class has scores or attendance records, so it can't be deleted — old report cards depend on them. Rename it instead, or simply stop assigning students to it.",
};

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireStaff();
  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  const { saved, error } = await searchParams;

  const [allClasses, teachers, scope, enabledLevels, adminLevels] = await Promise.all([
    prisma.classGroup.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        classTeacher: true,
      },
    }),
    prisma.teacher.findMany({
      where: { status: "ACTIVE" },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, levels: true },
    }),
    getTeacherScope(session),
    getEnabledLevels(),
    getAdminLevels(session),
  ]);
  const allowedStages = adminLevels ?? enabledLevels;
  const classes = filterClasses(scope, allClasses).filter((c) => allowedStages.includes(c.stage));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Classes</h1>
        {isAdmin && (
          <p className="mt-1 text-sm text-gray-500">
            Drag rows to reorder. Running two streams? Add e.g. "Basic 5B" right after "Basic 5A"
            and drag it into position — they will appear side by side everywhere.
          </p>
        )}
      </div>

      {saved && SAVED_MESSAGES[saved] && <ShowToast message={SAVED_MESSAGES[saved]} />}
      {error && ERROR_MESSAGES[error] && <ShowToast message={ERROR_MESSAGES[error]} type="error" />}

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              {isAdmin && <th className="w-8"></th>}
              <th>Class</th>
              <th>Stage</th>
              <th>Students</th>
              <th>Class teacher / Form master</th>
              {isAdmin && <th></th>}
              <th></th>
            </tr>
          </thead>
          {isAdmin ? (
            <DraggableClassList initialClasses={classes} teachers={teachers} enabledStages={allowedStages} />
          ) : (
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/classes/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.stage}</td>
                  <td className="text-center">{c._count.students}</td>
                  <td>
                    {c.classTeacher
                      ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}`
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {isAdmin && (
          <form action={createClass} className="flex flex-wrap items-end gap-2 border-t border-gray-200 p-4">
            <div className="min-w-36">
              <label className="label">New class name</label>
              <input name="name" className="input" placeholder="e.g. Basic 5B" />
            </div>
            <div>
              <label className="label">Stage</label>
              <select name="stage" className="input">
                {[
                  { value: "CRECHE", label: "Creche" },
                  { value: "KG", label: "KG" },
                  { value: "PRIMARY", label: "Primary" },
                  { value: "JHS", label: "JHS" },
                ]
                  .filter((s) => allowedStages.includes(s.value))
                  .map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </div>
            <button className="btn-primary">Add class</button>
            <p className="basis-full text-xs text-gray-500">
              New classes are added at the bottom — drag them into position afterwards.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
