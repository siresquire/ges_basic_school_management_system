import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dataUrl, getSingletonImage } from "@/lib/images";
import { getGradeBands, SECTION_LABELS, sectionForStage, type Section } from "@/lib/grading";
import { getAdminLevels } from "@/lib/admin-scope";
import FileInput from "@/components/file-input";
import {
  saveSchoolInfo,
  addAcademicYear,
  updateTerm,
  setCurrentTerm,
  addSubject,
  updateSubject,
  deleteSubject,
  createAdminUser,
  uploadLogo,
  removeLogo,
  uploadHeadSignature,
  removeHeadSignature,
  saveGradeBands,
} from "./actions";
import { ShowToast } from "@/components/show-toast";
import { PasswordInput } from "@/components/password-input";
import { AccountsTable, type AccountRow } from "@/components/accounts-table";

export const metadata = { title: "Settings" };

const SAVED_MESSAGES: Record<string, string> = {
  school: "School information saved.",
  year: "Academic year saved (three terms created with placeholder dates — adjust them below).",
  term: "Term dates saved.",
  current: "Current term updated.",
  password: "Password reset.",
  user: "User updated.",
  subject: "Subject saved.",
  subjectdeleted: "Subject deleted.",
  admin: "Administrator account created.",
  logo: "Logo uploaded — it now appears on the login page, report cards and receipts.",
  logoremoved: "Logo removed.",
  headsig: "Signature uploaded — it now appears on report cards for that section.",
  headsigremoved: "Signature removed.",
  bands: "Grading scale saved — report cards and the Scores page use it immediately.",
};

const ERROR_MESSAGES: Record<string, string> = {
  year: "Academic year must look like 2026/2027.",
  password: "Password must be at least 6 characters.",
  self: "You cannot deactivate your own account.",
  protected: "Super Admin accounts can only be managed from the System page by a Super Admin.",
  subjectname: "The subject needs a name.",
  subjectdup: "A subject with that name already exists.",
  subjectscores:
    "This subject has recorded scores, so it can't be deleted — old report cards depend on them. Untick all its stages instead to retire it.",
  adminfields: "Username, full name and a password of at least 6 characters are required.",
  adminusername: "That username is already taken.",
  img_missing: "Choose an image file first.",
  img_toobig: "That image is too large — use one under 2 MB (1 MB for signatures).",
  img_badtype: "Only PNG, JPEG or WebP images are supported.",
  bands: "The grading scale needs at least one row with a grade and a valid 'from' score.",
  bandszero: "One band must start from 0 so that every score earns a grade.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const { saved, error } = await searchParams;

  const [school, years, allUsers, subjects, logoAsset, headSigAsset, adminLevels] = await Promise.all([
    prisma.schoolInfo.findUnique({ where: { id: 1 } }),
    prisma.academicYear.findMany({
      include: { terms: { orderBy: { name: "asc" } } },
      orderBy: { name: "desc" },
    }),
    prisma.user.findMany({
      where: session.role === "SUPER_ADMIN"
        ? {}
        : { role: { notIn: ["SUPER_ADMIN", "ADMIN"] } },
      include: { teacher: { select: { levels: true } } },
      orderBy: [{ role: "asc" }, { username: "asc" }],
    }),
    prisma.subject.findMany({
      include: { _count: { select: { scores: true } } },
      orderBy: { name: "asc" },
    }),
    getSingletonImage("LOGO"),
    getSingletonImage("HEAD_SIGNATURE_PRIMARY"),
    getAdminLevels(session),
  ]);
  // Level-restricted admins only see teacher accounts for their sections.
  // Admin/Student/Parent accounts are always visible.
  const users = adminLevels
    ? allUsers.filter((u) => {
        if (u.role !== "TEACHER") return true;
        const lvl = u.teacher?.levels ?? "";
        return !lvl || lvl.split(",").some((l) => adminLevels.includes(l));
      })
    : allUsers;
  const ALL_SECTIONS: Section[] = ["CRECHE", "KG", "PRIMARY", "JHS"];
  const [jhsSigAsset, ...allBands] = await Promise.all([
    getSingletonImage("HEAD_SIGNATURE_JHS"),
    ...ALL_SECTIONS.map((s) => getGradeBands(s)),
  ]);

  // Which sections this admin can manage.
  const PRIMARY_STAGES = ["CRECHE", "KG", "PRIMARY"];
  const showPrimarySection = !adminLevels || adminLevels.some((l) => PRIMARY_STAGES.includes(l));
  const showJHSSection = !adminLevels || adminLevels.includes("JHS");

  const logoUrl = dataUrl(logoAsset);
  const headSigUrl = dataUrl(headSigAsset);
  const jhsSigUrl = dataUrl(jhsSigAsset);

  type BandRow = { min: number; grade: string; remark: string };
  const bandsBySection: [Section, BandRow[]][] = ALL_SECTIONS.map(
    (s, i) => [s, allBands[i]] as [Section, BandRow[]]
  ).filter(([s]) => !adminLevels || adminLevels.includes(s));

  const ALL_STAGE_OPTIONS = [
    { value: "CRECHE", label: "Creche" },
    { value: "KG", label: "KG" },
    { value: "PRIMARY", label: "Primary" },
    { value: "JHS", label: "JHS" },
  ];
  // Stage checkboxes shown to this admin — only their assigned levels.
  const STAGE_OPTIONS = adminLevels
    ? ALL_STAGE_OPTIONS.filter((o) => adminLevels.includes(o.value))
    : ALL_STAGE_OPTIONS;
  // Subjects visible to this admin — only those assigned to at least one of their levels.
  const visibleSubjects = adminLevels
    ? subjects.filter((s) => s.stages.split(",").some((st) => adminLevels.includes(st)))
    : subjects;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Settings</h1>

      {saved && SAVED_MESSAGES[saved] && <ShowToast message={SAVED_MESSAGES[saved]} />}
      {error && ERROR_MESSAGES[error] && <ShowToast message={ERROR_MESSAGES[error]} type="error" />}

      {/* School info */}
      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">School information</h2>
        <p className="mb-4 text-xs text-gray-500">Appears on report cards, receipts and the login page.</p>
        <form action={saveSchoolInfo} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">School name</label>
            <input name="name" className="input" defaultValue={school?.name ?? ""} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input name="address" className="input" defaultValue={school?.address ?? ""} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" defaultValue={school?.phone ?? ""} />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" className="input" defaultValue={school?.email ?? ""} />
          </div>
          <div>
            <label className="label">Motto</label>
            <input name="motto" className="input" defaultValue={school?.motto ?? ""} />
          </div>
          {showPrimarySection && (
            <div>
              <label className="label">Headteacher — KG &amp; Primary</label>
              <input
                name="headTeacherName"
                className="input"
                placeholder="Name"
                defaultValue={school?.headTeacherName ?? ""}
              />
            </div>
          )}
          {showPrimarySection && (
            <div>
              <label className="label">Headteacher phone (KG &amp; Primary)</label>
              <input
                name="headTeacherPhone"
                className="input"
                placeholder="e.g. 0244123456"
                defaultValue={school?.headTeacherPhone ?? ""}
              />
            </div>
          )}
          {showJHSSection && (
            <div>
              <label className="label">JHS head — name</label>
              <input
                name="jhsHeadName"
                className="input"
                placeholder="Name"
                defaultValue={school?.jhsHeadName ?? ""}
              />
            </div>
          )}
          {showJHSSection && (
            <div>
              <label className="label">JHS head — phone</label>
              <input
                name="jhsHeadPhone"
                className="input"
                placeholder="e.g. 0244123456"
                defaultValue={school?.jhsHeadPhone ?? ""}
              />
            </div>
          )}
          {showJHSSection && (
            <div>
              <label className="label">JHS head — title</label>
              <select name="jhsHeadTitle" className="input" defaultValue={school?.jhsHeadTitle ?? "Headmaster"}>
                <option value="Headmaster">Headmaster (male)</option>
                <option value="Headmistress">Headmistress (female)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Used on JHS report cards: "Headmaster&apos;s Remarks" / "Headmistress&apos;s Remarks".
              </p>
            </div>
          )}
          <div className="sm:col-span-2">
            <button className="btn-primary">Save school information</button>
          </div>
        </form>
      </div>

      {/* Logo & head teacher signature */}
      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Logo &amp; signatures</h2>
        <p className="mb-4 text-xs text-gray-500">
          PNG, JPEG or WebP. The logo appears on the login page, dashboards, report cards and
          receipts. The head teacher&apos;s scanned signature appears on every report card.
          Teachers&apos; own signatures are uploaded on their Staff pages (or by the teachers
          themselves under "My Signature").
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-800">School logo</h3>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="School logo" className="mb-3 h-20 w-20 rounded-md border border-gray-200 bg-white object-contain p-1" />
            ) : (
              <p className="mb-3 text-sm text-gray-500">No logo uploaded yet.</p>
            )}
            <form action={uploadLogo} className="flex flex-wrap items-center gap-2">
              <FileInput name="file" accept="image/png,image/jpeg,image/webp" />
              <button className="btn-primary btn-sm">Upload logo</button>
            </form>
            {logoUrl && (
              <form action={removeLogo} className="mt-2">
                <button className="text-xs text-red-600 hover:underline cursor-pointer">Remove logo</button>
              </form>
            )}
          </div>
          {showPrimarySection && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-800">
                Headteacher&apos;s signature (KG &amp; Primary)
              </h3>
              {headSigUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headSigUrl} alt="Headteacher signature" className="mb-3 h-16 rounded-md border border-gray-200 bg-white object-contain p-1" />
              ) : (
                <p className="mb-3 text-sm text-gray-500">No signature uploaded yet.</p>
              )}
              <form action={uploadHeadSignature.bind(null, "PRIMARY")} className="flex flex-wrap items-center gap-2">
                <FileInput name="file" accept="image/png,image/jpeg,image/webp" />
                <button className="btn-primary btn-sm">Upload</button>
              </form>
              {headSigUrl && (
                <form action={removeHeadSignature.bind(null, "PRIMARY")} className="mt-2">
                  <button className="text-xs text-red-600 hover:underline cursor-pointer">Remove signature</button>
                </form>
              )}
            </div>
          )}
          {showJHSSection && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-800">
                {school?.jhsHeadTitle ?? "Headmaster"}&apos;s signature (JHS)
              </h3>
              {jhsSigUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={jhsSigUrl} alt="JHS head signature" className="mb-3 h-16 rounded-md border border-gray-200 bg-white object-contain p-1" />
              ) : (
                <p className="mb-3 text-sm text-gray-500">No signature uploaded yet.</p>
              )}
              <form action={uploadHeadSignature.bind(null, "JHS")} className="flex flex-wrap items-center gap-2">
                <FileInput name="file" accept="image/png,image/jpeg,image/webp" />
                <button className="btn-primary btn-sm">Upload</button>
              </form>
              {jhsSigUrl && (
                <form action={removeHeadSignature.bind(null, "JHS")} className="mt-2">
                  <button className="text-xs text-red-600 hover:underline cursor-pointer">Remove signature</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grading scales */}
      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-gray-900">Grading scales</h2>
        <p className="mb-4 text-xs text-gray-500">
          {`Each level has its own grading scale. A score earns the band with the highest "From" score it reaches (e.g. with "From 80 → A", a 85 is an A). One band must start from 0. To remove a band, clear its grade and save.`}
        </p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {bandsBySection.map(([section, bands]) => (
            <form key={section} action={saveGradeBands.bind(null, section)}>
              <h3 className="mb-2 text-sm font-medium text-gray-800">{SECTION_LABELS[section]}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="w-24 pb-1">From (%)</th>
                    <th className="w-24 pb-1">Grade</th>
                    <th className="pb-1">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bands, { min: "", grade: "", remark: "" }, { min: "", grade: "", remark: "" }].map(
                    (band, i) => (
                      <tr key={i}>
                        <td className="pr-2 pb-2">
                          <input
                            type="number"
                            name={`min_${i}`}
                            min={0}
                            max={100}
                            step="1"
                            className="input py-1 text-sm"
                            defaultValue={band.min}
                          />
                        </td>
                        <td className="pr-2 pb-2">
                          <input
                            name={`grade_${i}`}
                            className="input py-1 text-sm"
                            defaultValue={band.grade}
                          />
                        </td>
                        <td className="pb-2">
                          <input
                            name={`remark_${i}`}
                            className="input py-1 text-sm"
                            defaultValue={band.remark}
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <button className="btn-primary btn-sm">Save {SECTION_LABELS[section]} scale</button>
            </form>
          ))}
        </div>
      </div>

      {/* Academic years & terms */}
      <div className="card">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Academic years &amp; terms</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            The current term is used everywhere by default — scores, attendance, fees and the
            portals.
          </p>
        </div>
        <div className="space-y-4 p-5">
          {years.map((year) => (
            <div key={year.id}>
              <h3 className="mb-2 text-sm font-semibold text-gray-800">{year.name}</h3>
              <div className="space-y-2">
                {year.terms.map((term) => (
                  <form
                    key={term.id}
                    action={updateTerm.bind(null, term.id)}
                    className="flex flex-wrap items-end gap-2 rounded-md border border-gray-200 p-3"
                  >
                    <span className="w-16 pb-2 text-sm font-medium">
                      {term.name}
                      {term.isCurrent && <span className="badge-green ml-1">current</span>}
                    </span>
                    <div>
                      <label className="label text-xs">Starts</label>
                      <input
                        type="date"
                        name="startDate"
                        className="input py-1 text-xs"
                        defaultValue={term.startDate.toISOString().slice(0, 10)}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Ends</label>
                      <input
                        type="date"
                        name="endDate"
                        className="input py-1 text-xs"
                        defaultValue={term.endDate.toISOString().slice(0, 10)}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Next term begins</label>
                      <input
                        type="date"
                        name="nextTermBegins"
                        className="input py-1 text-xs"
                        defaultValue={term.nextTermBegins?.toISOString().slice(0, 10) ?? ""}
                      />
                    </div>
                    <button className="btn-secondary btn-sm">Save dates</button>
                    {!term.isCurrent && (
                      <button
                        formAction={setCurrentTerm.bind(null, term.id)}
                        className="btn-primary btn-sm"
                      >
                        Make current
                      </button>
                    )}
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
        <form action={addAcademicYear} className="flex flex-wrap items-end gap-2 border-t border-gray-200 p-4">
          <div>
            <label className="label">New academic year</label>
            <input name="name" className="input" placeholder="2026/2027" />
          </div>
          <button className="btn-primary">Add year</button>
        </form>
      </div>

      {/* Subjects */}
      <div className="card overflow-x-auto">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Subjects</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Tick the stages each subject is taught at — that controls which subjects appear for
            each class on the Scores and Timetable pages. A subject that already has scores cannot
            be deleted (old report cards need it); untick all its stages to retire it instead.
          </p>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Taught at</th>
              <th>Scores recorded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleSubjects.map((s) => {
              const stages = s.stages.split(",");
              return (
                <tr key={s.id}>
                  <td>
                    <form action={updateSubject.bind(null, s.id)} id={`subject-${s.id}`}>
                      <input name="name" className="input min-w-48 py-1 text-sm" defaultValue={s.name} />
                    </form>
                  </td>
                  <td>
                    <div className="flex gap-3">
                      {STAGE_OPTIONS.map((o) => (
                        <label key={o.value} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            name="stages"
                            value={o.value}
                            form={`subject-${s.id}`}
                            defaultChecked={stages.includes(o.value)}
                            className="h-3.5 w-3.5 accent-emerald-700"
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="text-center">{s._count.scores}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button form={`subject-${s.id}`} className="btn-secondary btn-sm">
                        Save
                      </button>
                      <button
                        form={`subject-${s.id}`}
                        formAction={deleteSubject.bind(null, s.id)}
                        className="btn-danger btn-sm"
                        disabled={s._count.scores > 0}
                        title={s._count.scores > 0 ? "Has recorded scores — untick its stages to retire it" : undefined}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <form action={addSubject} className="flex flex-wrap items-end gap-3 border-t border-gray-200 p-4">
          <div className="min-w-48">
            <label className="label">New subject</label>
            <input name="name" className="input" placeholder="e.g. French" />
          </div>
          <div className="flex gap-3 pb-2">
            {STAGE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="stages"
                  value={o.value}
                  className="h-4 w-4 accent-emerald-700"
                />
                {o.label}
              </label>
            ))}
          </div>
          <button className="btn-primary">Add subject</button>
        </form>
      </div>

      {/* User accounts */}
      <div className="card" id="login-accounts">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Login accounts</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Reset a forgotten password or deactivate an account here. Student and parent logins are
            created from each student&apos;s page.
          </p>
        </div>
        <AccountsTable
          users={users.map((u): AccountRow => ({
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            active: u.active,
            tempPassword: u.tempPassword ?? null,
          }))}
          sessionUserId={session.userId}
          sessionRole={session.role}
        />
        {session.role === "SUPER_ADMIN" && (
          <form action={createAdminUser} className="flex flex-wrap items-end gap-2 border-t border-gray-200 p-4">
            <p className="basis-full text-sm font-medium text-gray-800">
              Create an additional administrator
            </p>
            <div>
              <label className="label">Username</label>
              <input name="username" className="input" placeholder="e.g. headteacher" />
            </div>
            <div className="min-w-48">
              <label className="label">Full name</label>
              <input name="name" className="input" placeholder="e.g. Mr Kofi Asare" />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput name="password" required minLength={6} />
            </div>
            <button className="btn-primary">Create admin</button>
            <p className="basis-full text-xs text-gray-500">
              For level-restricted admins, use the <strong>System</strong> page — it lets you assign which school levels each admin can access.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
