import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { getTeacherScope, canTeach } from "@/lib/teacher-scope";

export const metadata = { title: "Class" };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;

  const scope = await getTeacherScope(session);
  if (!canTeach(scope, id)) notFound();

  const classGroup = await prisma.classGroup.findUnique({
    where: { id },
    include: {
      classTeacher: true,
      students: { where: { status: "ACTIVE" }, orderBy: { lastName: "asc" } },
      assignments: { include: { teacher: true, subject: true } },
    },
  });
  if (!classGroup) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/classes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">← Classes</Link>
          <h1 className="page-title">{classGroup.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Class teacher:{" "}
            {classGroup.classTeacher
              ? `${classGroup.classTeacher.firstName} ${classGroup.classTeacher.lastName}`
              : "not assigned"}{" "}
            · {classGroup.students.length} active students
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/reports/class/${classGroup.id}`} className="btn-secondary">
            Class report cards
          </Link>
          <Link href={`/timetable?class=${classGroup.id}`} className="btn-secondary">
            Timetable
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Class register</h2>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Admission No.</th>
                <th>Name</th>
                <th>Gender</th>
              </tr>
            </thead>
            <tbody>
              {classGroup.students.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td className="font-mono text-xs">{s.admissionNo}</td>
                  <td>
                    <Link href={`/students/${s.id}`} className="font-medium text-emerald-700 hover:underline">
                      {fullName(s)}
                    </Link>
                  </td>
                  <td>{s.gender === "F" ? "Female" : "Male"}</td>
                </tr>
              ))}
              {classGroup.students.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No active students in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Subject teachers</h2>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Teacher</th>
              </tr>
            </thead>
            <tbody>
              {classGroup.assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.subject.name}</td>
                  <td>
                    {a.teacher.firstName} {a.teacher.lastName}
                  </td>
                </tr>
              ))}
              {classGroup.assignments.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-sm text-gray-500">
                    No subject teachers assigned yet. Assign them under Staff.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
