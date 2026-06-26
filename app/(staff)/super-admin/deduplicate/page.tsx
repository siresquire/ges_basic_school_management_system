import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deduplicateClass } from "./actions";
import { ConfirmForm } from "@/components/confirm-form";

export const metadata = { title: "Deduplicate Students" };

export default async function DeduplicatePage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  await requireSuperAdmin();
  const { done } = await searchParams;

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", classGroupId: { not: null } },
    select: {
      id: true,
      admissionNo: true,
      firstName: true,
      lastName: true,
      otherNames: true,
      classGroupId: true,
      classGroup: { select: { name: true } },
      userId: true,
      parentUserId: true,
      _count: {
        select: {
          scores: true,
          attendance: true,
          termAttendance: true,
          payments: true,
          reportRemarks: true,
        },
      },
    },
    orderBy: { admissionNo: "asc" },
  });

  type Student = typeof students[number];

  // Group by classGroupId + normalized full name
  const groupMap = new Map<string, Student[]>();
  for (const s of students) {
    const nameKey = `${s.firstName.trim()} ${s.lastName.trim()} ${s.otherNames?.trim() ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const key = `${s.classGroupId}::${nameKey}`;
    const arr = groupMap.get(key) ?? [];
    arr.push(s);
    groupMap.set(key, arr);
  }

  // Summarise per class
  type Summary = {
    classId: string;
    className: string;
    totalEntries: number;
    uniqueNames: number;
    safeToRemove: number;
    blocked: number;
  };
  const summaryMap = new Map<string, Summary>();

  for (const group of groupMap.values()) {
    if (group.length <= 1) continue;
    const [, ...duplicates] = group;
    const classId = group[0].classGroupId!;
    const className = group[0].classGroup?.name ?? classId;

    if (!summaryMap.has(classId)) {
      summaryMap.set(classId, { classId, className, totalEntries: 0, uniqueNames: 0, safeToRemove: 0, blocked: 0 });
    }
    const row = summaryMap.get(classId)!;
    row.totalEntries += group.length;
    row.uniqueNames += 1;

    for (const d of duplicates) {
      const safe =
        d._count.scores === 0 &&
        d._count.attendance === 0 &&
        d._count.termAttendance === 0 &&
        d._count.payments === 0 &&
        d._count.reportRemarks === 0 &&
        d.parentUserId === null;
      if (safe) row.safeToRemove++;
      else row.blocked++;
    }
  }

  const summaries = Array.from(summaryMap.values()).sort((a, b) =>
    a.className.localeCompare(b.className)
  );

  return (
    <div className="space-y-6">
      <Link href="/super-admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← System Configuration
      </Link>

      <div>
        <h1 className="page-title">Deduplicate Students</h1>
        <p className="mt-1 text-sm text-gray-500">
          Removes duplicate entries caused by uploading the same class Excel sheet multiple times.
          Duplicates with no scores, attendance, payments, or report data are removed (including
          their auto-created portal logins). Duplicates that have academic data recorded against
          them are skipped — those must be resolved manually.
        </p>
      </div>

      {done !== undefined && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Done — removed {done} duplicate entr{Number(done) === 1 ? "y" : "ies"} successfully.
        </div>
      )}

      {summaries.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          No duplicate student entries detected across any class.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Class</th>
                <th className="text-right">Total entries</th>
                <th className="text-right">Unique students</th>
                <th className="text-right">Safe to remove</th>
                <th className="text-right">Has scores/payments (skipped)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.classId}>
                  <td className="font-medium">{s.className}</td>
                  <td className="text-right">{s.totalEntries}</td>
                  <td className="text-right">{s.uniqueNames}</td>
                  <td className="text-right font-semibold text-red-600">{s.safeToRemove}</td>
                  <td className="text-right">
                    {s.blocked > 0 ? (
                      <span className="text-amber-600">{s.blocked}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    {s.safeToRemove > 0 && (
                      <ConfirmForm
                        action={deduplicateClass}
                        confirmTitle="Remove duplicates?"
                        confirmText={`Remove ${s.safeToRemove} duplicate ${s.safeToRemove === 1 ? "entry" : "entries"} from ${s.className}? This cannot be undone.`}
                        confirmButtonText="Yes, remove them"
                        loadingTitle="Removing duplicates…"
                      >
                        <input type="hidden" name="classId" value={s.classId} />
                        <button type="submit" className="btn-danger btn-sm">
                          Remove {s.safeToRemove}
                        </button>
                      </ConfirmForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
