import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminLevels } from "@/lib/admin-scope";
import Icon from "@/components/icon";
import { TempPasswordCell } from "@/components/temp-password-cell";
import { DownloadButton } from "@/components/download-button";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await requireAdmin();
  const adminLevels = await getAdminLevels(session);

  // Level-restricted admins see only teachers explicitly assigned to their levels.
  // Unrestricted admins (Super Admin or all-levels admin) see everyone including
  // teachers whose levels haven't been set yet.
  const levelWhere = adminLevels
    ? { OR: adminLevels.map((l) => ({ levels: { contains: l } })) }
    : {};

  const teachers = await prisma.teacher.findMany({
    where: levelWhere,
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
    include: {
      user: true,
      classTeacherOf: true,
      _count: { select: { assignments: true } },
    },
  });

  const noLoginCount = teachers.filter((t) => !t.user).length;
  const hasTempPasswords = teachers.some((t) => t.user?.tempPassword);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Staff</h1>
        <div className="flex flex-wrap gap-2">
          {noLoginCount > 0 && (
            <DownloadButton
              href="/staff/bulk-logins"
              className="btn-secondary flex items-center gap-1.5"
              loadingText="Generating…"
            >
              <Icon name="excel" />
              Generate logins ({noLoginCount})
            </DownloadButton>
          )}
          {hasTempPasswords && (
            <DownloadButton
              href="/staff/current-passwords"
              className="btn-secondary flex items-center gap-1.5"
              loadingText="Preparing…"
            >
              <Icon name="excel" />
              Download passwords
            </DownloadButton>
          )}
          <Link href="/excel" className="btn-secondary">
            <Icon name="excel" />
            Bulk upload (Excel)
          </Link>
          <Link href="/staff/new" className="btn-primary">
            <Icon name="plus" />
            Add teacher
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Class teacher of</th>
              <th>Subjects</th>
              <th>Login</th>
              <th>Temp password</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs">{t.staffId ?? "—"}</td>
                <td>
                  <Link href={`/staff/${t.id}`} className="font-medium text-emerald-700 hover:underline">
                    {t.firstName} {t.lastName}
                  </Link>
                </td>
                <td>{t.phone ?? "—"}</td>
                <td>{t.classTeacherOf.map((c) => c.name).join(", ") || "—"}</td>
                <td>{t._count.assignments}</td>
                <td className="font-mono text-xs">{t.user?.username ?? "—"}</td>
                <td>
                  {t.user?.tempPassword
                    ? <TempPasswordCell password={t.user.tempPassword} />
                    : <span className="text-gray-300">—</span>}
                </td>
                <td>
                  <span className={t.status === "ACTIVE" ? "badge-green" : "badge-gray"}>{t.status}</span>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  No teachers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
