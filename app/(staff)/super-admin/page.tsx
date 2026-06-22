import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchoolConfig } from "@/lib/school-config";
import Icon from "@/components/icon";
import { FeatureToggle } from "@/components/feature-toggle";
import { ConfigSavedRefresh } from "./config-saved-refresh";
import { saveSchoolConfig, createSuperAdmin, resetSuperAdminPassword, impersonateUser, createAdminAccount, updateAdminLevels, resetAdminPassword, toggleAdminActive } from "./actions";
import { ShowToast } from "@/components/show-toast";
import { PasswordInput } from "@/components/password-input";
import { ObserveAsSection } from "@/components/observe-as-section";
import { TempPasswordBadge } from "@/components/temp-password-badge";

export const metadata = { title: "System Configuration" };

const ALL_LEVELS: { id: string; label: string; description: string }[] = [
  { id: "CRECHE", label: "Creche", description: "3 months – 2 years (Creche, Nursery 1, Nursery 2)" },
  { id: "KG", label: "Kindergarten", description: "KG 1 and KG 2" },
  { id: "PRIMARY", label: "Primary / Basic", description: "Basic 1 – Basic 6" },
  { id: "JHS", label: "Junior High School", description: "JHS 1 – JHS 3" },
];

const ALL_FEATURES: { key: string; label: string; description: string }[] = [
  { key: "feesEnabled", label: "Fees & Payments", description: "Fee items, payment recording and receipts" },
  { key: "timetableEnabled", label: "Timetable", description: "Weekly class timetables" },
  { key: "analyticsEnabled", label: "Analytics", description: "School-wide charts and dashboards" },
  { key: "portalEnabled", label: "Student / Parent Portal", description: "Self-service login for students and parents" },
  { key: "transcriptsEnabled", label: "Transcripts", description: "Printable full-history transcripts for leavers" },
  { key: "attendanceEnabled", label: "Attendance", description: "Daily register and end-of-term totals" },
];

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { saved, error } = await searchParams;

  const [config, superAdmins, adminUsers, staffUsers] = await Promise.all([
    getSchoolConfig(),
    prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] }, active: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  const enabledLevels = config.enabledLevels.split(",").filter(Boolean);
  const features = config as Record<string, boolean | number | string>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Icon name="shield" />
          </span>
          <div>
            <h1 className="page-title mb-0">System Configuration</h1>
            <p className="text-sm text-gray-500">Super Admin only — changes apply across the entire system immediately.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href="/super-admin/deduplicate" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Icon name="trash" />
            Deduplicate students
          </a>
          <a href="/super-admin/activity" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Icon name="history" />
            Activity log
          </a>
        </div>
      </div>

      {saved === "config" && <ConfigSavedRefresh triggered />}
      {saved === "superadmin" && <ShowToast message="Super Admin account created." />}
      {saved === "admin" && <ShowToast message="Admin account created." />}
      {saved === "admin_levels" && <ShowToast message="Admin level access updated." />}
      {saved === "password" && <ShowToast message="Password updated." />}
      {error === "fields" && <ShowToast message="All fields are required and password must be at least 6 characters." type="error" />}
      {error === "username" && <ShowToast message="That username is already taken." type="error" />}
      {error === "password" && <ShowToast message="Password must be at least 6 characters." type="error" />}
      {error === "admin_fields" && <ShowToast message="All fields are required and password must be at least 6 characters." type="error" />}
      {error === "admin_username" && <ShowToast message="That username is already taken." type="error" />}

      <form action={saveSchoolConfig}>
        {/* ── Active school levels ── */}
        <div className="card mb-6 p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Active School Levels</h2>
          <p className="mb-5 text-sm text-gray-500">
            Enable only the levels this school actually runs. Disabled levels are hidden
            throughout the system — no data is deleted and levels can be re-enabled at any time.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ALL_LEVELS.map((level) => {
              const checked = enabledLevels.includes(level.id);
              return (
                <label
                  key={level.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    checked
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name={`level_${level.id}`}
                    defaultChecked={checked}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-emerald-600"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">{level.label}</span>
                    <span className="block text-xs text-gray-500">{level.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Feature toggles ── */}
        <div className="card mb-6 p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Active Features</h2>
          <p className="mb-5 text-sm text-gray-500">
            Turn off features your school does not use — they will disappear from the navigation
            and from all pages. They can be switched back on at any time.
          </p>
          <div className="divide-y divide-gray-100">
            {ALL_FEATURES.map((feat) => (
              <FeatureToggle
                key={feat.key}
                name={feat.key}
                label={feat.label}
                description={feat.description}
                defaultChecked={!!features[feat.key]}
              />
            ))}
          </div>
        </div>

        <button className="btn-primary">
          Save configuration
        </button>
      </form>

      {/* ── Super Admin accounts ── */}
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Super Admin Accounts</h2>
        <div className="mb-6 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Created</th>
                <th>Reset password</th>
              </tr>
            </thead>
            <tbody>
              {superAdmins.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-xs">{u.username}</td>
                  <td>{u.name}</td>
                  <td className="text-xs text-gray-500">
                    {u.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td>
                    <form action={resetSuperAdminPassword.bind(null, u.id)} className="flex items-center gap-2">
                      <PasswordInput name="password" compact minLength={6} />
                      <button className="btn-secondary btn-sm">Set</button>
                    </form>
                    {u.tempPassword && <TempPasswordBadge password={u.tempPassword} />}
                  </td>
                </tr>
              ))}
              {superAdmins.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No super admin accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <details className="group">
          <summary className="cursor-pointer list-none">
            <span className="btn-secondary btn-sm inline-flex items-center gap-2">
              <Icon name="plus" />
              Create new Super Admin account
            </span>
          </summary>
          <form action={createSuperAdmin} className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Username</label>
              <input name="username" className="input" required placeholder="e.g. superadmin2" />
            </div>
            <div>
              <label className="label">Full name</label>
              <input name="name" className="input" required placeholder="e.g. District IT Officer" />
            </div>
            <div>
              <label className="label">Password (min. 6 chars)</label>
              <PasswordInput name="password" required minLength={6} />
            </div>
            <div className="sm:col-span-3">
              <button className="btn-primary">Create Super Admin</button>
            </div>
          </form>
        </details>
      </div>

      {/* ── Admin Accounts ── */}
      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Admin Accounts</h2>
        <p className="mb-5 text-sm text-gray-500">
          Admins can manage students, staff, fees, scores, attendance, and more — but only for
          the school levels you assign here. Leave all levels unchecked to grant access to all
          enabled levels.
        </p>

        {adminUsers.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Levels</th>
                  <th>Status</th>
                  <th>Update levels</th>
                  <th>Password</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => {
                  const levels = u.assignedLevels.split(",").filter(Boolean);
                  return (
                    <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                      <td className="font-mono text-xs">{u.username}</td>
                      <td>{u.name}</td>
                      <td>
                        {levels.length === 0
                          ? <span className="text-xs text-gray-400">All enabled levels</span>
                          : levels.map((l) => (
                            <span key={l} className="badge-purple mr-1 text-xs">{l}</span>
                          ))}
                      </td>
                      <td>
                        <span className={u.active ? "badge-green" : "badge-gray"}>
                          {u.active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td>
                        <form action={updateAdminLevels.bind(null, u.id)} className="flex flex-wrap items-center gap-2">
                          {ALL_LEVELS.map((lv) => (
                            <label key={lv.id} className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                name={`admin_level_${lv.id}`}
                                defaultChecked={levels.includes(lv.id)}
                                className="h-3 w-3 accent-emerald-600"
                              />
                              {lv.label}
                            </label>
                          ))}
                          <button className="btn-secondary btn-sm">Save</button>
                        </form>
                      </td>
                      <td>
                        <form action={resetAdminPassword.bind(null, u.id)} className="flex items-center gap-1">
                          <PasswordInput name="password" compact minLength={6} />
                          <button className="btn-secondary btn-sm">Set</button>
                        </form>
                        {u.tempPassword && <TempPasswordBadge password={u.tempPassword} />}
                      </td>
                      <td>
                        <form action={toggleAdminActive.bind(null, u.id)}>
                          <button className="text-xs text-gray-500 hover:underline">
                            {u.active ? "Suspend" : "Restore"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details className="group">
          <summary className="cursor-pointer list-none">
            <span className="btn-secondary btn-sm inline-flex items-center gap-2">
              <Icon name="plus" />
              Create new Admin account
            </span>
          </summary>
          <form action={createAdminAccount} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Username</label>
                <input name="username" className="input" required placeholder="e.g. admin_primary" />
              </div>
              <div>
                <label className="label">Full name</label>
                <input name="name" className="input" required placeholder="e.g. Primary School Admin" />
              </div>
              <div>
                <label className="label">Password (min. 6 chars)</label>
                <PasswordInput name="password" required minLength={6} />
              </div>
            </div>
            <div>
              <label className="label mb-2 block">Level access <span className="font-normal text-gray-500">(leave all unchecked for access to all enabled levels)</span></label>
              <div className="flex flex-wrap gap-4">
                {ALL_LEVELS.map((lv) => (
                  <label key={lv.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`admin_level_${lv.id}`} className="h-4 w-4 accent-emerald-600" />
                    {lv.label}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-primary">Create Admin</button>
          </form>
        </details>
      </div>

      {/* ── Assume role ── */}
      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Observe as Another Role</h2>
        <p className="mb-5 text-sm text-gray-500">
          Browse the system as any user to see exactly what they see. An amber banner appears while
          you are observing — click it to return instantly. Changes you make are real.
        </p>
        <ObserveAsSection
          users={staffUsers.map((u) => ({
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
          }))}
        />
      </div>
    </div>
  );
}
