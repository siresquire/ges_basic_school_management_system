import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { studentName } from "@/lib/format";
import { getEnabledClassList } from "@/lib/cached";
import { getTeacherScope, filterClasses } from "@/lib/teacher-scope";
import { getAdminLevels, levelStageFilter } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";
import Icon from "@/components/icon";
import { TempPasswordCell } from "@/components/temp-password-cell";
import { DownloadButton } from "@/components/download-button";

export const metadata = { title: "Students" };

const PER_PAGE = 25;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; status?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const session = await requireStaff();
  const {
    q = "",
    class: rawClassId = "",
    status = "ACTIVE",
    page: rawPage = "1",
    sort = "",
    dir = "asc",
  } = await searchParams;

  const [scope, adminLevels] = await Promise.all([
    getTeacherScope(session),
    getAdminLevels(session),
  ]);
  const classId = scope.isAdmin || scope.taughtClassIds.includes(rawClassId) ? rawClassId : "";

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const skip = (page - 1) * PER_PAGE;
  const sortDir = (dir === "desc" ? "desc" : "asc") as "asc" | "desc";

  const where = {
    ...(status ? { status } : {}),
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

  const orderBy =
    sort === "gender"
      ? [{ gender: sortDir }, { classGroup: { level: "asc" as const } }, { lastName: "asc" as const }]
      : [{ classGroup: { level: "asc" as const } }, { lastName: "asc" as const }];

  const [students, allClasses, total, noStudentLogin, noParentLogin] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        classGroup: true,
        user: { select: { tempPassword: true } },
        parentUser: { select: { tempPassword: true } },
      },
      orderBy,
      take: PER_PAGE,
      skip,
    }),
    getEnabledClassList(),
    prisma.student.count({ where }),
    scope.isAdmin ? prisma.student.count({ where: { userId: null, status: "ACTIVE" } }) : Promise.resolve(0),
    scope.isAdmin ? prisma.student.count({ where: { parentUserId: null, status: "ACTIVE", guardianName: { not: null } } }) : Promise.resolve(0),
  ]);

  const hasStudentTempPasswords = students.some((s) => s.user?.tempPassword);
  const hasParentTempPasswords = students.some((s) => s.parentUser?.tempPassword);

  const classes = filterClasses(scope, adminLevels
    ? allClasses.filter((c) => adminLevels.includes(c.stage))
    : allClasses);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Build href that preserves all current filters while overriding specific params
  const makeHref = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ q, class: classId, status, sort, dir, page: rawPage, ...overrides });
    return `?${p.toString()}`;
  };

  const genderSortDir = sort === "gender" && dir === "asc" ? "desc" : "asc";
  const genderHref = makeHref({ sort: "gender", dir: genderSortDir, page: "1" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Students</h1>
        {(scope.isAdmin || scope.classTeacherOf.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {scope.isAdmin && noStudentLogin > 0 && (
              <DownloadButton href="/students/bulk-logins" className="btn-secondary flex items-center gap-1.5" loadingText="Generating…">
                <Icon name="excel" />
                Student logins ({noStudentLogin})
              </DownloadButton>
            )}
            {scope.isAdmin && noParentLogin > 0 && (
              <DownloadButton href="/students/bulk-parent-logins" className="btn-secondary flex items-center gap-1.5" loadingText="Generating…">
                <Icon name="excel" />
                Parent logins ({noParentLogin})
              </DownloadButton>
            )}
            {scope.isAdmin && hasStudentTempPasswords && (
              <DownloadButton href="/students/current-passwords" className="btn-secondary flex items-center gap-1.5" loadingText="Preparing…">
                <Icon name="excel" />
                Student passwords
              </DownloadButton>
            )}
            {scope.isAdmin && hasParentTempPasswords && (
              <DownloadButton href="/students/parent-current-passwords" className="btn-secondary flex items-center gap-1.5" loadingText="Preparing…">
                <Icon name="excel" />
                Parent passwords
              </DownloadButton>
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
        {/* preserve sort/dir through filter changes */}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
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
              <th>
                <Link href={genderHref} className="inline-flex items-center gap-1 hover:text-emerald-700">
                  Gender
                  {sort === "gender" && (
                    <span className="text-emerald-600">{dir === "asc" ? " ↑" : " ↓"}</span>
                  )}
                </Link>
              </th>
              <th>Class</th>
              <th>Guardian phone</th>
              <th>Student pwd</th>
              <th>Parent pwd</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.admissionNo}</td>
                <td>
                  <Link href={`/students/${s.id}`} className="font-medium uppercase text-emerald-700 hover:underline">
                    {studentName(s)}
                  </Link>
                </td>
                <td>{s.gender === "F" ? "Female" : "Male"}</td>
                <td>{s.classGroup?.name ?? <span className="text-gray-400">—</span>}</td>
                <td>{s.guardianPhone ?? <span className="text-gray-400">—</span>}</td>
                <td>
                  {s.user?.tempPassword
                    ? <TempPasswordCell password={s.user.tempPassword} />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td>
                  {s.parentUser?.tempPassword
                    ? <TempPasswordCell password={s.parentUser.tempPassword} />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td>
                  <span className={s.status === "ACTIVE" ? "badge-green" : "badge-gray"}>{s.status}</span>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {total} student{total === 1 ? "" : "s"}
          {total > PER_PAGE && ` — page ${page} of ${totalPages}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Link
              href={makeHref({ page: String(page - 1) })}
              aria-disabled={page <= 1}
              className={`rounded px-2 py-1 hover:bg-gray-100 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              ‹ Prev
            </Link>
            <span className="px-1">{page} / {totalPages}</span>
            <Link
              href={makeHref({ page: String(page + 1) })}
              aria-disabled={page >= totalPages}
              className={`rounded px-2 py-1 hover:bg-gray-100 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            >
              Next ›
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
