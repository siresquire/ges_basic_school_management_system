import { endImpersonation } from "@/app/(staff)/super-admin/actions";
import { type Session } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
};

export function ImpersonationBanner({
  impersonated,
  impersonator,
}: {
  impersonated: Session;
  impersonator: Session;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 shadow-md">
      <span>
        Viewing as{" "}
        <strong>{impersonated.name}</strong>{" "}
        <span className="opacity-70">({ROLE_LABEL[impersonated.role] ?? impersonated.role})</span>
        {" — "}
        <span className="opacity-70">changes are real</span>
      </span>
      <form action={endImpersonation}>
        <button
          type="submit"
          className="rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-800"
        >
          Return to {impersonator.name}
        </button>
      </form>
    </div>
  );
}
