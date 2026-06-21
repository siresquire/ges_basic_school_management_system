import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import Avatar from "@/components/avatar";
import SignatureCard from "@/components/signature-card";
import { updateOwnName, changeOwnPassword } from "./actions";
import { ShowToast } from "@/components/show-toast";

export const metadata = { title: "My Account" };

const SAVED_MESSAGES: Record<string, string> = {
  name: "Name updated.",
  password: "Password changed — use it the next time you sign in.",
  signature: "Signature saved.",
  sigremoved: "Signature removed.",
};

const ERROR_MESSAGES: Record<string, string> = {
  name: "Enter your full name (at least 2 characters).",
  short: "The new password must be at least 6 characters.",
  match: "The new password and its confirmation do not match.",
  current: "Your current password is not correct.",
  img_missing: "Choose an image file first.",
  img_toobig: "That image is too large — use one under 1 MB.",
  img_badtype: "Only PNG, JPEG or WebP images are supported.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireStaff();
  const { saved, error } = await searchParams;

  const teacher = await prisma.teacher.findFirst({
    where: { userId: session.userId },
    include: { signatureAsset: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={session.name} size="lg" />
        <div>
          <h1 className="page-title">{session.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Username <span className="font-mono">{session.username}</span> ·{" "}
            {session.role === "ADMIN" ? "Administrator" : "Teacher"}
          </p>
        </div>
      </div>

      {saved && SAVED_MESSAGES[saved] && <ShowToast message={SAVED_MESSAGES[saved]} />}
      {error && ERROR_MESSAGES[error] && <ShowToast message={ERROR_MESSAGES[error]} type="error" />}

      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Display name</h2>
        <p className="mb-3 text-xs text-gray-500">Shown in the sidebar and on receipts you issue.</p>
        <form action={updateOwnName} className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label className="label">Full name</label>
            <input name="name" className="input" defaultValue={session.name} required minLength={2} />
          </div>
          <button className="btn-primary">Save name</button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Change password</h2>
        <p className="mb-3 text-xs text-gray-500">
          At least 6 characters. You stay signed in after changing it.
        </p>
        <form action={changeOwnPassword} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Current password</label>
            <input name="current" type="password" className="input" autoComplete="current-password" required />
          </div>
          <div>
            <label className="label">New password</label>
            <input name="next" type="password" className="input" autoComplete="new-password" required minLength={6} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input name="confirm" type="password" className="input" autoComplete="new-password" required minLength={6} />
          </div>
          <div className="sm:col-span-3">
            <button className="btn-primary">Change password</button>
          </div>
        </form>
      </div>

      {teacher && <SignatureCard teacherId={teacher.id} asset={teacher.signatureAsset} />}
    </div>
  );
}
