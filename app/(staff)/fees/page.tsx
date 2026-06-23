import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ghs, fmtDate } from "@/lib/format";
import { getTermFeeOverview } from "@/lib/fees";
import { getEnabledClassList, getTermList, getCurrentTerm } from "@/lib/cached";
import { getAdminLevels } from "@/lib/admin-scope";
import FilterForm from "@/components/filter-form";
import { addFeeItem, deleteFeeItem, recordPayment } from "./actions";
import { ShowToast } from "@/components/show-toast";
import { ConfirmForm } from "@/components/confirm-form";

export const metadata = { title: "Fees" };

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;

  const [terms, currentTerm, allClasses, adminLevels] = await Promise.all([
    getTermList(),
    getCurrentTerm(),
    getEnabledClassList(),
    getAdminLevels(session),
  ]);
  const classes = adminLevels
    ? allClasses.filter((c) => adminLevels.includes(c.stage))
    : allClasses;

  const termId = sp.term ?? currentTerm?.id ?? terms[0]?.id ?? "";
  if (!termId) {
    return (
      <p className="card p-6 text-sm text-gray-600">
        Create an academic year and term in Settings before managing fees.
      </p>
    );
  }

  const overview = await getTermFeeOverview(termId);
  let { feeItems, rows, totals } = overview;
  // Scope students to admin's assigned levels.
  const students = adminLevels
    ? overview.students.filter((s) => s.classGroup && adminLevels.includes(s.classGroup.stage))
    : overview.students;
  if (adminLevels) {
    const allowedIds = new Set(students.map((s) => s.id));
    rows = rows.filter((r) => allowedIds.has(r.studentId));
    totals = {
      expected: rows.reduce((a, r) => a + r.billed, 0),
      collected: rows.reduce((a, r) => a + r.paid, 0),
      outstanding: rows.reduce((a, r) => a + Math.max(0, r.balance), 0),
    };
  }
  const debtors = rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  const allowedStudentIds = adminLevels ? new Set(students.map((s) => s.id)) : null;
  const recentPayments = await prisma.payment.findMany({
    where: {
      termId,
      ...(allowedStudentIds ? { studentId: { in: [...allowedStudentIds] } } : {}),
    },
    include: { student: true },
    orderBy: { paidAt: "desc" },
    take: 10,
  });

  // Group students by class for the payment form dropdown.
  const byClass = new Map<string, typeof students>();
  for (const s of students) {
    const key = s.classGroup?.name ?? "No class";
    byClass.set(key, [...(byClass.get(key) ?? []), s]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">Fees &amp; payments</h1>
        <FilterForm className="flex items-end gap-2">
          <div>
            <label className="label">Term</label>
            <select name="term" className="input" defaultValue={termId}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.academicYear.name} — {t.name}
                  {t.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </FilterForm>
      </div>

      {sp.error === "item" && <ShowToast message="Fee item needs a name and an amount greater than zero." type="error" />}
      {sp.error === "payment" && <ShowToast message="Payment needs a student and an amount greater than zero." type="error" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Expected this term</p>
          <p className="mt-1 text-2xl font-semibold">{ghs(totals.expected)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Collected</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{ghs(totals.collected)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{ghs(totals.outstanding)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fee items */}
        <div className="card">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Fee items for this term</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Items apply to every class unless you pick a specific class.
            </p>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Applies to</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {feeItems.map((f) => (
                <tr key={f.id}>
                  <td className="font-medium">{f.name}</td>
                  <td>{f.classGroup?.name ?? "All classes"}</td>
                  <td>{ghs(f.amount)}</td>
                  <td className="text-right">
                    <ConfirmForm
                      action={deleteFeeItem.bind(null, f.id, termId)}
                      confirmTitle="Remove this fee item?"
                      confirmText={`"${f.name}" will be removed from this term's fee schedule.`}
                      confirmButtonText="Yes, remove it"
                    >
                      <button className="text-xs text-red-600 hover:underline cursor-pointer">
                        Remove
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
              {feeItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                    No fee items yet — add the term&apos;s levies below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <form action={addFeeItem} className="flex flex-wrap items-end gap-2 border-t border-gray-200 p-4">
            <input type="hidden" name="termId" value={termId} />
            <div className="min-w-32 flex-1">
              <label className="label">Item name</label>
              <input name="name" className="input" placeholder="e.g. PTA Levy" />
            </div>
            <div className="w-28">
              <label className="label">Amount</label>
              <input name="amount" type="number" step="0.01" min="0" className="input" />
            </div>
            <div>
              <label className="label">Class</label>
              <select name="classGroupId" className="input">
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary">Add</button>
          </form>
        </div>

        {/* Record payment */}
        <div className="card">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Record a payment</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              A printable receipt is generated automatically.
            </p>
          </div>
          <form action={recordPayment} className="space-y-3 p-5">
            <input type="hidden" name="termId" value={termId} />
            <div>
              <label className="label">Student</label>
              <select name="studentId" className="input" required>
                <option value="">Select student…</option>
                {[...byClass.entries()].map(([className, classStudents]) => (
                  <optgroup key={className} label={className}>
                    {classStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.lastName} {s.firstName} ({s.admissionNo})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (GH₵)</label>
                <input name="amount" type="number" step="0.01" min="0.01" className="input" required />
              </div>
              <div>
                <label className="label">Method</label>
                <select name="method" className="input">
                  <option value="CASH">Cash</option>
                  <option value="MOMO">Mobile Money</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Reference (MoMo/bank ref, optional)</label>
              <input name="reference" className="input" />
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input name="note" className="input" placeholder="e.g. Part payment of Term 3 levies" />
            </div>
            <button className="btn-primary w-full">Save payment &amp; open receipt</button>
          </form>
        </div>
      </div>

      {/* Debtors */}
      <div className="card overflow-x-auto">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Outstanding balances ({debtors.length})</h2>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Billed</th>
              <th>Paid</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {debtors.map((r) => (
              <tr key={r.studentId}>
                <td className="font-medium">{r.name}</td>
                <td>{r.className}</td>
                <td>{ghs(r.billed)}</td>
                <td>{ghs(r.paid)}</td>
                <td className="font-semibold text-red-600">{ghs(r.balance)}</td>
                <td>
                  <Link
                    href={`/fees/student/${r.studentId}?term=${termId}`}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                  >
                    Statement
                  </Link>
                </td>
              </tr>
            ))}
            {debtors.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                  No outstanding balances for this term. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent payments */}
      <div className="card overflow-x-auto">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Recent payments</h2>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Receipt No.</th>
              <th>Date</th>
              <th>Student</th>
              <th>Amount</th>
              <th>Method</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.receiptNo}</td>
                <td>{fmtDate(p.paidAt)}</td>
                <td>
                  {p.student.firstName} {p.student.lastName}
                </td>
                <td>{ghs(p.amount)}</td>
                <td>{p.method}</td>
                <td>
                  <Link
                    href={`/fees/receipt/${p.id}`}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                  >
                    Receipt
                  </Link>
                </td>
              </tr>
            ))}
            {recentPayments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                  No payments recorded for this term yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
