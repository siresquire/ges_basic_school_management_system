import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import TeacherForm from "@/components/teacher-form";
import SignatureCard from "@/components/signature-card";
import { updateTeacher, setTeacherLogin, addAssignment, removeAssignment } from "../actions";
import { ShowToast } from "@/components/show-toast";
import { PasswordInput } from "@/components/password-input";

export const metadata = { title: "Teacher" };

export default async function TeacherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; warn?: string; with?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error, saved, warn, with: sharedWith } = await searchParams;

  const [teacher, subjects, classes] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id },
      include: {
        user: true,
        classTeacherOf: true,
        signatureAsset: true,
        assignments: {
          include: { subject: true, classGroup: true },
          orderBy: [{ classGroup: { level: "asc" } }, { subject: { name: "asc" } }],
        },
      },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    prisma.classGroup.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
  ]);
  if (!teacher) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">← Staff</Link>
        <h1 className="page-title">
          {teacher.firstName} {teacher.lastName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {teacher.staffId ?? "No staff ID"} ·{" "}
          {teacher.classTeacherOf.length > 0
            ? `Class teacher of ${teacher.classTeacherOf.map((c) => c.name).join(", ")}`
            : "Not a class teacher (assign under Classes)"}
        </p>
      </div>

      {error === "staffid" && <ShowToast message="That staff ID is already in use." type="error" />}
      {error === "login" && <ShowToast message="Username is required and the password must be at least 6 characters." type="error" />}
      {error === "username" && <ShowToast message="That username is already taken." type="error" />}
      {error === "img_toobig" && <ShowToast message="That image is too large — use one under 1 MB." type="error" />}
      {error === "img_badtype" && <ShowToast message="Only PNG, JPEG or WebP images are supported." type="error" />}
      {error === "img_missing" && <ShowToast message="Choose an image file first." type="error" />}
      {saved && <ShowToast message="Saved." />}
      {warn === "shared" && <ShowToast message={`Assigned — but note that ${sharedWith} also teaches this subject in this class. Both teachers can enter scores.`} type="warn" />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <h2 className="mb-4 font-semibold text-gray-900">Teacher details</h2>
          <TeacherForm action={updateTeacher.bind(null, teacher.id)} teacher={teacher} />
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-1 font-semibold text-gray-900">Login</h2>
            <p className="mb-4 text-xs text-gray-500">
              Lets the teacher sign in to mark attendance and enter scores.
            </p>
            {teacher.user ? (
              <p className="mb-3 text-sm">
                Username: <span className="font-mono font-medium">{teacher.user.username}</span>
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-500">No login yet.</p>
            )}
            <form action={setTeacherLogin.bind(null, teacher.id)} className="space-y-2">
              <input
                name="username"
                className="input"
                placeholder="Username"
                defaultValue={teacher.user?.username ?? ""}
              />
              <PasswordInput name="password" />
              <button className="btn-secondary btn-sm w-full">
                {teacher.user ? "Reset password" : "Create login"}
              </button>
            </form>
          </div>

          <SignatureCard teacherId={teacher.id} asset={teacher.signatureAsset} />
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Subjects taught</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            These assignments show on class pages and pick the teacher automatically on timetables.
          </p>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Class</th>
              <th>Subject</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teacher.assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.classGroup.name}</td>
                <td>{a.subject.name}</td>
                <td className="text-right">
                  <form action={removeAssignment.bind(null, a.id, teacher.id)}>
                    <button className="text-xs text-red-600 hover:underline cursor-pointer">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {teacher.assignments.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-gray-500">
                  No subject assignments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={addAssignment.bind(null, teacher.id)} className="flex flex-wrap items-end gap-2 border-t border-gray-200 p-4">
          <div>
            <label className="label">Class</label>
            <select name="classGroupId" className="input">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select name="subjectId" className="input min-w-48">
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary">Assign</button>
        </form>
      </div>
    </div>
  );
}
