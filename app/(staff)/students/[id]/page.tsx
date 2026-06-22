import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fmtDate, studentName } from "@/lib/format";
import { getTeacherScope, canTeach, canAdminister } from "@/lib/teacher-scope";
import StudentForm from "@/components/student-form";
import ParentSearchInput from "@/components/parent-search-input";
import { updateStudent, createPortalLogin, linkExistingParent, setStudentStatus } from "../actions";
import { ShowToast } from "@/components/show-toast";
import { PasswordInput } from "@/components/password-input";
import { TempPasswordBadge } from "@/components/temp-password-badge";

export const metadata = { title: "Student" };

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireStaff();
  const { id } = await params;
  const { error, saved } = await searchParams;

  const [student, classes] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: { classGroup: true, user: true, parentUser: true },
    }),
    prisma.classGroup.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
  ]);
  if (!student) notFound();

  const scope = await getTeacherScope(session);
  if (!scope.isAdmin && (!student.classGroupId || !canTeach(scope, student.classGroupId))) {
    notFound();
  }

  // Class teachers can edit and manage status for students in their own class
  const canEdit = scope.isAdmin || canAdminister(scope, student.classGroupId ?? "");
  const isAdmin = scope.isAdmin; // for portal-login sections that remain admin-only

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/students" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">← Students</Link>
          <h1 className="page-title">{studentName(student)}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {student.admissionNo} · {student.classGroup?.name ?? "No class"} ·{" "}
            <span
              className={
                student.status === "ACTIVE"
                  ? "badge-green"
                  : student.status === "SUSPENDED"
                    ? "badge-amber"
                    : "badge-gray"
              }
            >
              {student.status}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/reports/${student.id}`} className="btn-secondary">
            Report card
          </Link>
          <Link href={`/students/${student.id}/analytics`} className="btn-secondary">
            Analytics
          </Link>
          {isAdmin && (
            <>
              <Link href={`/fees/student/${student.id}`} className="btn-secondary">
                Fee statement
              </Link>
              <Link href={`/students/${student.id}/transcript`} className="btn-secondary">
                Transcript
              </Link>
            </>
          )}
          {canEdit && (
            <>
              {student.status === "ACTIVE" && (
                <>
                  <form action={setStudentStatus.bind(null, student.id, "SUSPENDED")}>
                    <button className="btn-secondary">Suspend</button>
                  </form>
                  <form action={setStudentStatus.bind(null, student.id, "WITHDRAWN")}>
                    <button className="btn-danger">Deactivate</button>
                  </form>
                </>
              )}
              {student.status === "SUSPENDED" && (
                <>
                  <form action={setStudentStatus.bind(null, student.id, "ACTIVE")}>
                    <button className="btn-secondary">Restore</button>
                  </form>
                  <form action={setStudentStatus.bind(null, student.id, "WITHDRAWN")}>
                    <button className="btn-danger">Withdraw</button>
                  </form>
                </>
              )}
              {(student.status === "WITHDRAWN" ||
                student.status === "TRANSFERRED" ||
                student.status === "GRADUATED") && (
                <form action={setStudentStatus.bind(null, student.id, "ACTIVE")}>
                  <button className="btn-secondary">Restore to Active</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {error === "login" && <ShowToast message="Username is required and the password must be at least 6 characters." type="error" />}
      {error === "username" && <ShowToast message="That username is already taken — choose another one." type="error" />}
      {error === "noparent" && <ShowToast message="No parent account found with that username." type="error" />}
      {error === "phone" && <ShowToast message="Phone number must be 10 digits starting with 0 (e.g. 0244123456)." type="error" />}
      {error === "ghanacard" && <ShowToast message="Ghana Card must be in the format GHA-XXXXXXXXX-X (e.g. GHA-123456789-0)." type="error" />}
      {saved === "login" && <ShowToast message="Portal login saved." />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <h2 className="mb-4 font-semibold text-gray-900">Student details</h2>
          {canEdit ? (
            <StudentForm
              action={updateStudent.bind(null, student.id)}
              classes={classes}
              student={student}
            />
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Gender</dt>
                <dd>{student.gender === "F" ? "Female" : "Male"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Date of birth</dt>
                <dd>{fmtDate(student.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Guardian</dt>
                <dd>{student.guardianName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Guardian phone</dt>
                <dd>{student.guardianPhone ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Address</dt>
                <dd>{student.address ?? "—"}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-1 font-semibold text-gray-900">Student portal login</h2>
            <p className="mb-4 text-xs text-gray-500">
              Lets the student check results, attendance and the timetable online.
            </p>
            {student.user ? (
              <p className="mb-3 text-sm">
                Username: <span className="font-mono font-medium">{student.user.username}</span>
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-500">No login yet.</p>
            )}
            {isAdmin && (
              <form action={createPortalLogin.bind(null, student.id, "STUDENT")} className="space-y-2">
                <input
                  name="username"
                  className="input"
                  placeholder="Username"
                  defaultValue={student.user?.username ?? student.admissionNo.toLowerCase()}
                />
                <PasswordInput name="password" />
                <button className="btn-secondary btn-sm w-full">
                  {student.user ? "Reset password" : "Create student login"}
                </button>
              </form>
            )}
            {student.user?.tempPassword && (
              <TempPasswordBadge password={student.user.tempPassword} />
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-1 font-semibold text-gray-900">Parent portal login</h2>
            <p className="mb-4 text-xs text-gray-500">
              Lets the parent see results and fee balances for all their children.
            </p>
            {student.parentUser ? (
              <p className="mb-3 text-sm">
                Username: <span className="font-mono font-medium">{student.parentUser.username}</span>
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-500">No parent login linked.</p>
            )}
            {isAdmin && (
              <>
                <form action={createPortalLogin.bind(null, student.id, "PARENT")} className="space-y-2">
                  <input
                    name="username"
                    className="input"
                    placeholder="Username"
                    defaultValue={student.parentUser?.username ?? ""}
                  />
                  <PasswordInput name="password" />
                  <button className="btn-secondary btn-sm w-full">
                    {student.parentUser ? "Reset password" : "Create parent login"}
                  </button>
                </form>
                {student.parentUser?.tempPassword && (
                  <TempPasswordBadge password={student.parentUser.tempPassword} />
                )}
                {!student.parentUser && (
                  <ParentSearchInput action={linkExistingParent.bind(null, student.id)} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
