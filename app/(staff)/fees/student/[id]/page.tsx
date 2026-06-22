import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ghs, fmtDate, studentName } from "@/lib/format";
import { billedAmount } from "@/lib/fees";
import FilterForm from "@/components/filter-form";

export const metadata = { title: "Fee Statement" };

export default async function FeeStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const student = await prisma.student.findUnique({
    where: { id },
    include: { classGroup: true },
  });
  if (!student) notFound();

  const [terms, currentTerm] = await Promise.all([
    prisma.term.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { name: "desc" } }, { name: "asc" }],
    }),
    prisma.term.findFirst({ where: { isCurrent: true } }),
  ]);
  const termId = sp.term ?? currentTerm?.id ?? terms[0]?.id;
  const term = terms.find((t) => t.id === termId);
  if (!term) notFound();

  const [feeItems, payments] = await Promise.all([
    prisma.feeItem.findMany({ where: { termId }, include: { classGroup: true } }),
    prisma.payment.findMany({
      where: { studentId: id, termId },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  const applicable = feeItems.filter(
    (f) => f.classGroupId === null || f.classGroupId === student.classGroupId
  );
  const billed = billedAmount(feeItems, student.classGroupId);
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const balance = Math.round((billed - paid) * 100) / 100;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/fees" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">← Fees</Link>
          <h1 className="page-title">Fee statement — {studentName(student)}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {student.admissionNo} · {student.classGroup?.name ?? "No class"} ·{" "}
            {term.academicYear.name} {term.name}
          </p>
        </div>
        <FilterForm className="flex items-end gap-2">
          <select name="term" className="input" defaultValue={termId} aria-label="Term">
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYear.name} — {t.name}
              </option>
            ))}
          </select>
        </FilterForm>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Billed</p>
          <p className="mt-1 text-lg font-semibold">{ghs(billed)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Paid</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{ghs(paid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Balance</p>
          <p className={`mt-1 text-lg font-semibold ${balance > 0 ? "text-red-600" : "text-emerald-700"}`}>
            {ghs(Math.max(0, balance))}
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="font-semibold text-gray-900">Billed items</h2>
        </div>
        <table className="tbl">
          <tbody>
            {applicable.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td className="text-right">{ghs(f.amount)}</td>
              </tr>
            ))}
            {applicable.length === 0 && (
              <tr>
                <td className="py-6 text-center text-sm text-gray-500">
                  No fee items apply to this student for this term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="font-semibold text-gray-900">Payments</h2>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Receipt No.</th>
              <th>Date</th>
              <th>Method</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.receiptNo}</td>
                <td>{fmtDate(p.paidAt)}</td>
                <td>{p.method}</td>
                <td>{ghs(p.amount)}</td>
                <td>
                  <Link href={`/fees/receipt/${p.id}`} className="text-sm text-emerald-700 hover:underline">
                    Receipt
                  </Link>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                  No payments this term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Link href="/fees" className="btn-secondary">
        ← Back to fees
      </Link>
    </div>
  );
}
