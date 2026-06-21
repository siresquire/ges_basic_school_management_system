import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import TeacherForm from "@/components/teacher-form";
import { createTeacher } from "../actions";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "Add Teacher" };

export default async function NewTeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/staff" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">← Staff</Link>
      <h1 className="page-title">Add a teacher</h1>
      {error === "name" && <ShowToast message="First name and surname are required." type="error" />}
      {error === "staffid" && <ShowToast message="That staff ID is already in use." type="error" />}
      <div className="card p-6">
        <TeacherForm action={createTeacher} />
      </div>
    </div>
  );
}
