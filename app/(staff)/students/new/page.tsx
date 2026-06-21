import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import StudentForm from "@/components/student-form";
import { createStudent } from "../actions";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "Admit Student" };

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaff();
  const { error } = await searchParams;

  // Only Admin/SuperAdmin/class teachers can admit students.
  let classes;
  if (session.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.userId },
      include: { classTeacherOf: { orderBy: [{ level: "asc" }, { name: "asc" }] } },
    });
    if (!teacher || teacher.classTeacherOf.length === 0) redirect("/");
    classes = teacher.classTeacherOf;
  } else {
    classes = await prisma.classGroup.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] });
  }

  const last = await prisma.student.findFirst({
    orderBy: { admissionNo: "desc" },
    where: { admissionNo: { startsWith: "AKW-" } },
  });
  const lastNum = last ? parseInt(last.admissionNo.replace("AKW-", ""), 10) : 0;
  const suggested = `AKW-${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(4, "0")}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">← Students</Link>
      <h1 className="page-title">Admit a new student</h1>
      {error === "admission" && <ShowToast message="That admission number is already in use." type="error" />}
      {error === "name" && <ShowToast message="First name and surname are required." type="error" />}
      {error === "phone" && <ShowToast message="Phone number must be 10 digits starting with 0 (e.g. 0244123456)." type="error" />}
      {error === "ghanacard" && <ShowToast message="Ghana Card must be in the format GHA-XXXXXXXXX-X (e.g. GHA-123456789-0)." type="error" />}
      <div className="card p-6">
        <StudentForm action={createStudent} classes={classes} suggestedAdmissionNo={suggested} />
      </div>
    </div>
  );
}
