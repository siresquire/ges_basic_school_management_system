import type { Teacher } from "@prisma/client";
import DraftForm from "@/components/draft-form";
import { CopyContactsButton } from "@/components/copy-contacts";

const REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
  "Greater Accra", "North East", "Northern", "Oti", "Savannah",
  "Upper East", "Upper West", "Volta", "Western", "Western North",
];

const QUAL_OPTIONS = ["Certificate", "Diploma", "First Degree", "Masters", "PhD"];

const LEVEL_OPTIONS = [
  { value: "CRECHE", label: "Creche" },
  { value: "KG", label: "KG" },
  { value: "PRIMARY", label: "Primary" },
  { value: "JHS", label: "JHS" },
];

const GES_RANKS = [
  "Director General",
  "Deputy Director General",
  "Director I",
  "Director II",
  "Deputy Director",
  "Assistant Director I",
  "Assistant Director II",
  "Principal Superintendent",
  "Senior Superintendent I",
  "Senior Superintendent II",
  "Superintendent I",
  "Superintendent II",
  "Pupil Teacher",
];

function d(t: Teacher, f: keyof Teacher): string {
  const v = t[f];
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v != null ? String(v) : "";
}

function Section({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group overflow-hidden rounded-lg border border-gray-200">
      <summary className="flex cursor-pointer list-none items-center justify-between bg-gray-50 px-4 py-3 hover:bg-gray-100">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <svg className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        {children}
      </div>
    </details>
  );
}

function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

const TODAY = new Date().toISOString().slice(0, 10);

export default function TeacherForm({
  action,
  teacher,
}: {
  action: (formData: FormData) => Promise<void>;
  teacher?: Teacher;
}) {
  return (
    <DraftForm draftKey={`teacher:${teacher?.id ?? "new"}`} action={action} className="space-y-4">

      {/* ── Basic Info ── */}
      <Section title="Basic Details" open>
        <Field label="First name *">
          <input name="firstName" className="input" required defaultValue={teacher?.firstName} />
        </Field>
        <Field label="Surname *">
          <input name="lastName" className="input" required defaultValue={teacher?.lastName} />
        </Field>
        <Field label="Other names">
          <input name="otherNames" className="input" defaultValue={teacher ? d(teacher, "otherNames") : ""} />
        </Field>
        <Field label="Gender">
          <select name="gender" className="input" defaultValue={teacher?.gender ?? "M"}>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </Field>
        <Field label="Staff ID">
          <input name="staffId" className="input" defaultValue={teacher ? d(teacher, "staffId") : ""} placeholder="e.g. GES-12345" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" defaultValue={teacher ? d(teacher, "phone") : ""} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="input" defaultValue={teacher ? d(teacher, "email") : ""} />
        </Field>
        {teacher && (
          <Field label="Status">
            <select name="status" className="input" defaultValue={teacher.status}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="RETIRED">Retired</option>
              <option value="POSTED_OUT">Posted Out</option>
            </select>
          </Field>
        )}
        <Field label="Level(s) taught" span>
          <div className="flex flex-wrap gap-5 pt-1">
            {LEVEL_OPTIONS.map((o) => {
              const assigned = (teacher?.levels ?? "").split(",");
              return (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="levels"
                    value={o.value}
                    defaultChecked={assigned.includes(o.value)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Select all sections this teacher works in. Admins only see staff assigned to their section.
          </p>
        </Field>
      </Section>

      {/* ── Personal ── */}
      <Section title="Personal Details">
        <Field label="Date of birth">
          <input type="date" name="dateOfBirth" className="input" max={TODAY} defaultValue={teacher ? d(teacher, "dateOfBirth") : ""} />
        </Field>
        <Field label="Marital status">
          <select name="maritalStatus" className="input" defaultValue={teacher ? d(teacher, "maritalStatus") : ""}>
            <option value="">— Select —</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </Field>
        <Field label="Religion / Faith">
          <input name="religion" className="input" defaultValue={teacher ? d(teacher, "religion") : ""} placeholder="e.g. Christianity, Islam" />
        </Field>
        <Field label="Teacher union">
          <select name="teacherUnion" className="input" defaultValue={teacher ? d(teacher, "teacherUnion") : ""}>
            <option value="">— Select —</option>
            <option value="GNAT">GNAT</option>
            <option value="NAGRAT">NAGRAT</option>
            <option value="CCT">CCT</option>
            <option value="TEWU">TEWU</option>
            <option value="None">None</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Ghana Card number">
          <input name="ghanaCardNumber" className="input" defaultValue={teacher ? d(teacher, "ghanaCardNumber") : ""} placeholder="GHA-XXXXXXXXX-X" />
        </Field>
      </Section>

      {/* ── Professional ── */}
      <Section title="Professional Details">
        <Field label="Date of first appointment (GES)">
          <input type="date" name="dateOfFirstAppointment" className="input" max={TODAY} defaultValue={teacher ? d(teacher, "dateOfFirstAppointment") : ""} />
        </Field>
        <Field label="Area of specialization">
          <input name="areaOfSpecialization" className="input" defaultValue={teacher ? d(teacher, "areaOfSpecialization") : ""} placeholder="e.g. Mathematics, Class Teacher (Primary)" />
        </Field>
        <Field label="NTC License number">
          <input name="ntcLicenseNumber" className="input" defaultValue={teacher ? d(teacher, "ntcLicenseNumber") : ""} />
        </Field>
        <Field label="SSNIT number">
          <input name="ssnitNumber" className="input" defaultValue={teacher ? d(teacher, "ssnitNumber") : ""} />
        </Field>
        <Field label="Current rank (as on payslip)">
          <select name="currentRank" className="input" defaultValue={teacher ? d(teacher, "currentRank") : ""}>
            <option value="">— Select rank —</option>
            {GES_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Salary grade type">
          <select name="salaryGradeType" className="input" defaultValue={teacher ? d(teacher, "salaryGradeType") : ""}>
            <option value="">— Select —</option>
            <option value="PSH">PSH</option>
            <option value="PSL">PSL</option>
          </select>
        </Field>
        <Field label="Grade number (1–30)">
          <input type="number" name="gradeNumber" min={1} max={30} className="input" defaultValue={teacher?.gradeNumber ?? ""} />
        </Field>
        <Field label="Step / Point (1–10)">
          <input type="number" name="stepNumber" min={1} max={10} className="input" defaultValue={teacher?.stepNumber ?? ""} />
        </Field>
        <Field label="Date of last promotion">
          <input type="date" name="dateOfLastPromotion" className="input" max={TODAY} defaultValue={teacher ? d(teacher, "dateOfLastPromotion") : ""} />
        </Field>
        <Field label="Date posted to present station">
          <input type="date" name="datePostedToStation" className="input" max={TODAY} defaultValue={teacher ? d(teacher, "datePostedToStation") : ""} />
        </Field>
        <Field label="Periods taught per week">
          <input type="number" name="periodsPerWeek" min={0} max={50} className="input" defaultValue={teacher?.periodsPerWeek ?? ""} />
        </Field>
        <Field label="EMIS code">
          <input name="emisCode" className="input" defaultValue={teacher ? d(teacher, "emisCode") : ""} />
        </Field>
        <Field label="EMIS password">
          <input name="emisPassword" className="input" defaultValue={teacher ? d(teacher, "emisPassword") : ""} placeholder="Stored for reference only" />
        </Field>
      </Section>

      {/* ── Education & Qualifications ── */}
      <Section title="Education & Qualifications">
        <div className="sm:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Highest Academic Qualification</p>
        </div>
        <Field label="Level">
          <select name="highestAcademicQual" className="input" defaultValue={teacher ? d(teacher, "highestAcademicQual") : ""}>
            <option value="">— Select —</option>
            {QUAL_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Field>
        <Field label="Course / Programme (as on certificate)">
          <input name="highestAcademicCourse" className="input" defaultValue={teacher ? d(teacher, "highestAcademicCourse") : ""} />
        </Field>
        <Field label="Year completed">
          <input name="highestAcademicYear" className="input" placeholder="e.g. 2015" defaultValue={teacher ? d(teacher, "highestAcademicYear") : ""} />
        </Field>

        <div className="sm:col-span-2">
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Highest Professional Qualification</p>
        </div>
        <Field label="Level">
          <select name="highestProfQual" className="input" defaultValue={teacher ? d(teacher, "highestProfQual") : ""}>
            <option value="">— Select —</option>
            {QUAL_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </Field>
        <Field label="Course / Programme (as on certificate)">
          <input name="highestProfCourse" className="input" defaultValue={teacher ? d(teacher, "highestProfCourse") : ""} />
        </Field>
        <Field label="Year completed">
          <input name="highestProfYear" className="input" placeholder="e.g. 2018" defaultValue={teacher ? d(teacher, "highestProfYear") : ""} />
        </Field>
        <Field label="College of Education attended (if any)" span>
          <input name="collegeOfEducation" className="input" defaultValue={teacher ? d(teacher, "collegeOfEducation") : ""} placeholder="e.g. Komenda College of Education" />
        </Field>
      </Section>

      {/* ── Location ── */}
      <Section title="Hometown & Residence">
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hometown</p>
        </div>
        <Field label="Town">
          <input name="hometown" className="input" defaultValue={teacher ? d(teacher, "hometown") : ""} />
        </Field>
        <Field label="District">
          <input name="hometownDistrict" className="input" defaultValue={teacher ? d(teacher, "hometownDistrict") : ""} />
        </Field>
        <Field label="Region">
          <select name="hometownRegion" className="input" defaultValue={teacher ? d(teacher, "hometownRegion") : ""}>
            <option value="">— Select —</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Current Residence</p>
        </div>
        <Field label="Town">
          <input name="townOfResidence" className="input" defaultValue={teacher ? d(teacher, "townOfResidence") : ""} />
        </Field>
        <Field label="District">
          <input name="residenceDistrict" className="input" defaultValue={teacher ? d(teacher, "residenceDistrict") : ""} />
        </Field>
        <Field label="Region">
          <select name="residenceRegion" className="input" defaultValue={teacher ? d(teacher, "residenceRegion") : ""}>
            <option value="">— Select —</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Ghana Post Code / GPS Address">
          <input name="ghanaPostCode" className="input" defaultValue={teacher ? d(teacher, "ghanaPostCode") : ""} placeholder="e.g. AK-039-1234" />
        </Field>
      </Section>

      {/* ── Bank ── */}
      <Section title="Bank Details">
        <Field label="Bank name">
          <input name="bankName" className="input" defaultValue={teacher ? d(teacher, "bankName") : ""} />
        </Field>
        <Field label="Branch">
          <input name="bankBranch" className="input" defaultValue={teacher ? d(teacher, "bankBranch") : ""} />
        </Field>
        <Field label="Account number">
          <input name="bankAccountNumber" className="input" defaultValue={teacher ? d(teacher, "bankAccountNumber") : ""} />
        </Field>
      </Section>

      {/* ── Emergency Contacts ── */}
      <Section title="Emergency Contacts">
        <div className="sm:col-span-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">Up to 3 emergency contacts. Use the copy button to get all numbers at once.</p>
          <CopyContactsButton contacts={[
            { name: teacher ? d(teacher, "ec1Name") : "", phone: teacher ? d(teacher, "ec1Phone") : "", relation: teacher ? d(teacher, "ec1Relation") : "" },
            { name: teacher ? d(teacher, "ec2Name") : "", phone: teacher ? d(teacher, "ec2Phone") : "", relation: teacher ? d(teacher, "ec2Relation") : "" },
            { name: teacher ? d(teacher, "ec3Name") : "", phone: teacher ? d(teacher, "ec3Phone") : "", relation: teacher ? d(teacher, "ec3Relation") : "" },
          ]} />
        </div>
        {[1, 2, 3].map((n) => (
          <div key={n} className="sm:col-span-2 grid grid-cols-3 gap-3 rounded-md bg-gray-50 p-3">
            <div>
              <label className="label text-xs">Contact {n} — Name</label>
              <input name={`ec${n}Name`} className="input" defaultValue={teacher ? d(teacher, `ec${n}Name` as keyof Teacher) : ""} />
            </div>
            <div>
              <label className="label text-xs">Phone</label>
              <input name={`ec${n}Phone`} className="input" defaultValue={teacher ? d(teacher, `ec${n}Phone` as keyof Teacher) : ""} />
            </div>
            <div>
              <label className="label text-xs">Relation</label>
              <input name={`ec${n}Relation`} className="input" defaultValue={teacher ? d(teacher, `ec${n}Relation` as keyof Teacher) : ""} placeholder="e.g. Spouse" />
            </div>
          </div>
        ))}
      </Section>

      <button className="btn-primary">{teacher ? "Save changes" : "Add teacher"}</button>
    </DraftForm>
  );
}
