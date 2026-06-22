import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { dataUrl, getSingletonImage } from "@/lib/images";
import { getSchoolInfo } from "@/lib/cached";
import { SubmitButton } from "@/components/submit-button";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  const { error, expired } = await searchParams;
  const [school, logoAsset] = await Promise.all([getSchoolInfo(), getSingletonImage("LOGO")]);
  const logoUrl = dataUrl(logoAsset);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-800 to-emerald-950 p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-6 text-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="School logo"
                className="mx-auto mb-3 h-16 w-16 rounded-full bg-white object-contain"
              />
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-800">
                {(school?.name ?? "S").charAt(0)}
              </div>
            )}
            <h1 className="text-lg font-semibold text-gray-900">
              {school?.name ?? "School Management System"}
            </h1>
            {school?.motto && (
              <p className="mt-1 text-sm text-gray-500 italic">“{school.motto}”</p>
            )}
          </div>

          {expired && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your session has expired. Please sign in again.
            </p>
          )}
          {error === "rate" && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Too many failed sign-in attempts. Please wait 15 minutes before trying again.
            </p>
          )}
          {error && error !== "rate" && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Wrong username or password. Please try again.
            </p>
          )}

          <form action={login} className="space-y-4">
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="input"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                autoComplete="current-password"
                required
              />
            </div>
            <SubmitButton className="btn-primary w-full" loadingText="Signing in…">
              Sign in
            </SubmitButton>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-emerald-100/70">
          Students and parents: use the login given to you by the school office.
        </p>
      </div>
    </div>
  );
}
