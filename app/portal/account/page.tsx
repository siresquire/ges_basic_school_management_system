import Link from "next/link";
import { requirePortal } from "@/lib/auth";
import Avatar from "@/components/avatar";
import { updateOwnName, changeOwnPassword } from "@/app/(staff)/account/actions";

export const metadata = { title: "My Account" };

const SAVED_MESSAGES: Record<string, string> = {
  name: "Name updated.",
  password: "Password changed — use it the next time you sign in.",
};

const ERROR_MESSAGES: Record<string, string> = {
  name: "Enter your full name (at least 2 characters).",
  short: "The new password must be at least 6 characters.",
  match: "The new password and its confirmation do not match.",
  current: "Your current password is not correct.",
};

export default async function PortalAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requirePortal();
  const { saved, error } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={session.name} size="lg" />
        <div>
          <h1 className="page-title">{session.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Username <span className="font-mono">{session.username}</span> ·{" "}
            {session.role === "PARENT" ? "Parent" : "Student"}
          </p>
        </div>
      </div>

      {saved && SAVED_MESSAGES[saved] && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {SAVED_MESSAGES[saved]}
        </p>
      )}
      {error && ERROR_MESSAGES[error] && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{ERROR_MESSAGES[error]}</p>
      )}

      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Display name</h2>
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
        <p className="mb-3 text-xs text-gray-500">At least 6 characters.</p>
        <form action={changeOwnPassword} className="space-y-3">
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
          <button className="btn-primary">Change password</button>
        </form>
      </div>

      <Link href="/portal" className="btn-secondary">
        ← Back to portal
      </Link>
    </div>
  );
}
