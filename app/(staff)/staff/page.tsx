import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Icon from "@/components/icon";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  await requireAdmin();

  const teachers = await prisma.teacher.findMany({
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
    include: {
      user: true,
      classTeacherOf: true,
      _count: { select: { assignments: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Staff</h1>
        <div className="flex gap-2">
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
                  <span className={t.status === "ACTIVE" ? "badge-green" : "badge-gray"}>{t.status}</span>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
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
