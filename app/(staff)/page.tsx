import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { ghs, fmtDate, todayISO, dateFromISO } from "@/lib/format";
import { getTeacherScope } from "@/lib/teacher-scope";
import { getAdminLevels } from "@/lib/admin-scope";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireStaff();
  const today = dateFromISO(todayISO());

  // Teachers see numbers for their own classes only; admins are further scoped by assigned levels.
  const [scope, adminLevels, currentTerm] = await Promise.all([
    getTeacherScope(session),
    getAdminLevels(session),
    prisma.term.findFirst({ where: { isCurrent: true }, include: { academicYear: true } }),
  ]);

  const classWhere = scope.isAdmin
    ? (adminLevels ? { stage: { in: adminLevels } } : {})
    : { id: { in: scope.taughtClassIds } };

  const teacherLevelWhere = adminLevels
    ? { OR: adminLevels.map((l) => ({ levels: { contains: l } })) }
    : {};

  // Fetch classes first so we can derive class IDs for attendance query.
  const [classes, studentCount, teacherCount] = await Promise.all([
    prisma.classGroup.findMany({
      where: classWhere,
      orderBy: [{ level: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        classTeacher: true,
      },
    }),
    prisma.student.count({
      where: scope.isAdmin
        ? { status: "ACTIVE", ...(adminLevels ? { classGroup: { stage: { in: adminLevels } } } : {}) }
        : { status: "ACTIVE", classGroupId: { in: scope.taughtClassIds } },
    }),
    prisma.teacher.count({ where: { status: "ACTIVE", ...teacherLevelWhere } }),
  ]);

  const classIds = classes.map((c) => c.id);
  const attClassWhere = scope.isAdmin && !adminLevels
    ? { date: today }
    : { date: today, classGroupId: { in: classIds } };

  const [attendanceToday, feesCollected] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: attClassWhere,
      _count: true,
    }),
    currentTerm
      ? prisma.payment.aggregate({
          where: {
            termId: currentTerm.id,
            // Scope fees to the admin's level; classIds already reflects that scope.
            ...(adminLevels ? { student: { classGroupId: { in: classIds } } } : {}),
          },
          _sum: { amount: true },
        })
      : Promise.resolve(null),
  ]);

  const att = Object.fromEntries(attendanceToday.map((a) => [a.status, a._count]));
  const present = (att.PRESENT ?? 0) + (att.LATE ?? 0);
  const absent = att.ABSENT ?? 0;
  const marked = present + absent;

  const stats = [
    { label: "Active students", value: studentCount, href: "/students" },
    { label: "Teachers", value: teacherCount, href: "/staff" },
    {
      label: "Present today",
      value: marked > 0 ? `${present} / ${marked}` : "Not marked yet",
      href: "/attendance",
    },
    ...(session.role === "ADMIN" || session.role === "SUPER_ADMIN"
      ? [
          {
            label: "Fees collected this term",
            value: ghs(feesCollected?._sum.amount ?? 0),
            href: "/fees",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome, {session.name}.{" "}
            {currentTerm
              ? `${currentTerm.academicYear.name} — ${currentTerm.name} (ends ${fmtDate(currentTerm.endDate)})`
              : "No current term is set — go to Settings to set one."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition-shadow hover:shadow-md">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Classes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Students</th>
                  <th>Class teacher</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/classes/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td>{c._count.students}</td>
                    <td>
                      {c.classTeacher
                        ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}`
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-gray-900">Quick actions</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href="/attendance" className="btn-secondary justify-start">
              Mark today&apos;s attendance
            </Link>
            <Link href="/scores" className="btn-secondary justify-start">
              Enter scores
            </Link>
            <Link href="/reports" className="btn-secondary justify-start">
              Print report cards
            </Link>
            {(session.role === "ADMIN" || session.role === "SUPER_ADMIN") && (
              <>
                <Link href="/students/new" className="btn-secondary justify-start">
                  Admit a new student
                </Link>
                <Link href="/fees" className="btn-secondary justify-start">
                  Record a fee payment
                </Link>
                <Link href="/settings" className="btn-secondary justify-start">
                  School settings
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
