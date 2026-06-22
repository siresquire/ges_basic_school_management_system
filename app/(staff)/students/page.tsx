import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { getEnabledClassList } from "@/lib/cached";
import { getTeacherScope, filterClasses } from "@/lib/teacher-scope";
import { getAdminLevels, levelStageFilter, classStageFilter } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";
import Icon from "@/components/icon";

export const metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; status?: string }>;
}) {
  const session = await requireStaff();
  const { q = "", class: rawClassId = "", status = "ACTIVE" } = await searchParams;

  const [scope, adminLevels] = await Promise.all([
    getTeacherScope(session),
    getAdminLevels(session),
  ]);
  const classId = scope.isAdmin || scope.taughtClassIds.includes(rawClassId) ? rawClassId : "";

  const where = {
    ...(status ? { status } : {}),
    // Admin level restriction (restricts to assigned school levels)
    ...levelStageFilter(adminLevels),
    ...(classId
      ? { classGroupId: classId }
      : scope.isAdmin
        ? {}
        : { classGroupId: { in: scope.taughtClassIds } }),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { otherNames: { contains: q } },
            { admissionNo: { contains: q } },
          ],
        }
      : {}),
  };

  const [students, allClasses, total, noStudentLogin, noParentLogin] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { classGroup: true },
      orderBy: [{ classGroup: { level: "asc" } }, { lastName: "asc" }],
      take: 400,
    }),
    getEnabledClassList(),
    prisma.student.count({ where }),
    scope.isAdmin ? prisma.student.count({ where: { userId: null, status: "ACTIVE" } }) : Promise.resolve(0),
    scope.isAdmin ? prisma.student.count({ where: { parentUserId: null, status: "ACTIVE", guardianName: { not: null } } }) : Promise.resolve(0),
  ]);
  // Filter class list by both teacher scope and admin levels
  const classes = filterClasses(scope, adminLevels
    ? allClasses.filter((c) => adminLevels.includes(c.stage))
    : allClasses);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Students</h1>
        {(scope.isAdmin || scope.classTeacherOf.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {scope.isAdmin && noStudentLogin > 0 && (
              <a href="/students/bulk-logins" className="btn-secondary flex items-center gap-1.5">
                <Icon name="excel" />
                Student logins ({noStudentLogin})
              </a>
            )}
            {scope.isAdmin && noParentLogin > 0 && (
              <a href="/students/bulk-parent-logins" className="btn-secondary flex items-center gap-1.5">
                <Icon name="excel" />
                Parent logins ({noParentLogin})
              </a>
            )}
            <Link href="/excel" className="btn-secondary">
              <Icon name="excel" />
              Bulk upload (Excel)
            </Link>
            <Link href="/students/new" className="btn-primary">
              <Icon name="plus" />
              Admit student
            </Link>
          </div>
        )}
      </div>

      <FilterForm className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-40 flex-1">
          <label className="label">Search</label>
          <input name="q" className="input" defaultValue={q} placeholder="Name or admission number" />
        </div>
        <div>
          <label className="label">Class</label>
          <select name="class" className="input" defaultValue={classId}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" className="input" defaultValue={status}>
            <option value="ACTIVE">Active</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="GRADUATED">Graduated</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="">All</option>
          </select>
        </div>
        <button className="btn-secondary">Search</button>
      </FilterForm>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Admission No.</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Class</th>
              <th>Guardian phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.admissionNo}</td>
                <td>
                  <Link href={`/students/${s.id}`} className="font-medium text-emerald-700 hover:underline">
                    {fullName(s)}
                  </Link>
                </td>
                <td>{s.gender === "F" ? "Female" : "Male"}</td>
                <td>{s.classGroup?.name ?? <span className="text-gray-400">—</span>}</td>
                <td>{s.guardianPhone ?? <span className="text-gray-400">—</span>}</td>
                <td>
                  <span className={s.status === "ACTIVE" ? "badge-green" : "badge-gray"}>{s.status}</span>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {total} student{total === 1 ? "" : "s"} match{total === 1 ? "es" : ""} the filter.
      </p>
    </div>
  );
}
