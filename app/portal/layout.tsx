import Link from "next/link";
import { requirePortal, getImpersonatorSession } from "@/lib/auth";
import { hasLogo } from "@/lib/images";
import { getSchoolInfo } from "@/lib/cached";
import { logout } from "@/app/actions";
import Avatar from "@/components/avatar";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, impersonator] = await Promise.all([requirePortal(), getImpersonatorSession()]);
  const [school, showLogo] = await Promise.all([getSchoolInfo(), hasLogo()]);

  return (
    <div className={`min-h-screen${impersonator ? " pt-10" : ""}`}>
      {impersonator && <ImpersonationBanner impersonated={session} impersonator={impersonator} />}
      <header className="no-print bg-emerald-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          {showLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo" alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold sm:text-base">{school?.name}</p>
            <p className="text-xs text-emerald-200/80">
              {session.role === "PARENT" ? "Parent portal" : "Student portal"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/portal/account"
              title="My account — change your name or password"
              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-emerald-800"
            >
              <Avatar name={session.name} size="sm" />
              <span className="hidden text-sm sm:block">{session.name}</span>
            </Link>
            <form action={logout}>
              <button className="cursor-pointer rounded-md border border-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
