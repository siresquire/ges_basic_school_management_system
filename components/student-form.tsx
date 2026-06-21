import type { ClassGroup, Student } from "@prisma/client";
import DraftForm from "@/components/draft-form";
import { CopyContactsButton } from "@/components/copy-contacts";

const TODAY = new Date().toISOString().slice(0, 10);

function s(student: Student | undefined, f: keyof Student): string {
  if (!student) return "";
  const v = student[f];
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v != null ? String(v) : "";
}

/** Shared create/edit student form (server-rendered). */
export default function StudentForm({
  action,
  classes,
  student,
  suggestedAdmissionNo,
}: {
  action: (formData: FormData) => Promise<void>;
  classes: ClassGroup[];
  student?: Student;
  suggestedAdmissionNo?: string;
}) {
  return (
    <DraftForm
      draftKey={`student:${student?.id ?? "new"}`}
      action={action}
      className="space-y-4"
    >
      {/* ── Mandatory fields ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!student && (
          <div className="sm:col-span-2">
            <label className="label">System admission number</label>
            <input
              name="admissionNo"
              className="input"
              defaultValue={suggestedAdmissionNo}
              placeholder="e.g. AKW-0001"
            />
            <p className="mt-1 text-xs text-gray-500">Auto-generated — leave as-is for new admissions.</p>
          </div>
        )}
        <div>
          <label className="label">First name *</label>
          <input name="firstName" className="input" required defaultValue={student?.firstName} />
        </div>
        <div>
          <label className="label">Surname *</label>
          <input name="lastName" className="input" required defaultValue={student?.lastName} />
        </div>
        <div>
          <label className="label">Gender *</label>
          <select name="gender" className="input" defaultValue={student?.gender ?? "M"}>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="label">Class *</label>
          <select name="classGroupId" className="input" defaultValue={student?.classGroupId ?? ""}>
            <option value="">— Not assigned —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {student && (
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue={student.status}>
              <option value="ACTIVE">Active</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="GRADUATED">Graduated</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Additional Information (optional) ── */}
      <details className="group overflow-hidden rounded-lg border border-gray-200">
        <summary className="flex cursor-pointer list-none items-center justify-between bg-gray-50 px-4 py-3 hover:bg-gray-100">
          <span className="text-sm font-semibold text-gray-800">Additional Information <span className="font-normal text-gray-500">(all optional)</span></span>
          <svg className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">

          {/* Other names & DOB */}
          <div>
            <label className="label">Other names</label>
            <input name="otherNames" className="input" defaultValue={s(student, "otherNames")} />
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input type="date" name="dateOfBirth" className="input" max={TODAY} defaultValue={s(student, "dateOfBirth")} />
          </div>

          {/* Legacy admission no */}
          <div className="sm:col-span-2">
            <label className="label">School&apos;s internal admission number <span className="text-xs text-gray-400">(legacy / migration)</span></label>
            <input name="legacyAdmissionNo" className="input" defaultValue={s(student, "legacyAdmissionNo")} placeholder="The number the school uses internally" />
            <p className="mt-1 text-xs text-gray-500">Only needed when migrating existing records. Future students use the system number above.</p>
          </div>

          {/* Location */}
          <div>
            <label className="label">Residence <span className="text-xs text-gray-400">(where they stay)</span></label>
            <input name="residence" className="input" defaultValue={s(student, "residence")} placeholder="Town / community" />
          </div>
          <div>
            <label className="label">Hometown <span className="text-xs text-gray-400">(where they come from)</span></label>
            <input name="hometown" className="input" defaultValue={s(student, "hometown")} placeholder="Town / region" />
          </div>

          {/* Guardian (kept for backward compat) */}
          <div>
            <label className="label">Guardian name</label>
            <input name="guardianName" className="input" defaultValue={s(student, "guardianName")} />
          </div>
          <div>
            <label className="label">Guardian phone</label>
            <input name="guardianPhone" className="input" defaultValue={s(student, "guardianPhone")} pattern="0[0-9]{9}" title="Enter a valid 10-digit Ghana phone number starting with 0 (e.g. 0244123456)" />
          </div>

          {/* Health & ID */}
          <div>
            <label className="label">Health insurance type</label>
            <select name="healthInsuranceType" className="input" defaultValue={s(student, "healthInsuranceType")}>
              <option value="">— Not specified —</option>
              <option value="NHIS">NHIS (National)</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <div>
            <label className="label">Health insurance number</label>
            <input name="healthInsuranceNo" className="input" defaultValue={s(student, "healthInsuranceNo")} />
          </div>
          <div>
            <label className="label">Ghana Card number</label>
            <input name="ghanaCardNo" className="input" defaultValue={s(student, "ghanaCardNo")} placeholder="GHA-XXXXXXXXX-X" pattern="GHA-[0-9]{9}-[0-9]" title="Ghana Card format: GHA-XXXXXXXXX-X (e.g. GHA-123456789-0)" />
          </div>

          {/* Emergency contacts */}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emergency Contacts</p>
              <CopyContactsButton contacts={[
                { name: s(student, "ec1Name"), phone: s(student, "ec1Phone"), relation: s(student, "ec1Relation") },
                { name: s(student, "ec2Name"), phone: s(student, "ec2Phone"), relation: s(student, "ec2Relation") },
                { name: s(student, "ec3Name"), phone: s(student, "ec3Phone"), relation: s(student, "ec3Relation") },
              ]} />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-3">
                  <div>
                    <label className="label text-xs">Contact {n} — Name</label>
                    <input name={`ec${n}Name`} className="input" defaultValue={s(student, `ec${n}Name` as keyof Student)} />
                  </div>
                  <div>
                    <label className="label text-xs">Phone</label>
                    <input name={`ec${n}Phone`} className="input" defaultValue={s(student, `ec${n}Phone` as keyof Student)} pattern="0[0-9]{9}" title="Enter a valid 10-digit Ghana phone number starting with 0 (e.g. 0244123456)" />
                  </div>
                  <div>
                    <label className="label text-xs">Relation</label>
                    <input name={`ec${n}Relation`} className="input" defaultValue={s(student, `ec${n}Relation` as keyof Student)} placeholder="e.g. Parent" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </details>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">
          {student ? "Save changes" : "Admit student"}
        </button>
      </div>
    </DraftForm>
  );
}
