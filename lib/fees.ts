import { prisma } from "@/lib/db";
import { studentName } from "@/lib/format";

export type FeeRow = {
  studentId: string;
  name: string;
  admissionNo: string;
  className: string;
  billed: number;
  paid: number;
  balance: number;
};

/** Amount billed to one student = term fee items that are school-wide or for their class. */
export function billedAmount(
  feeItems: { amount: number; classGroupId: string | null }[],
  classGroupId: string | null
): number {
  return feeItems
    .filter((f) => f.classGroupId === null || f.classGroupId === classGroupId)
    .reduce((sum, f) => sum + f.amount, 0);
}

export async function getTermFeeOverview(termId: string) {
  const [feeItems, students, paymentGroups] = await Promise.all([
    prisma.feeItem.findMany({
      where: { termId },
      include: { classGroup: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      include: { classGroup: true },
      orderBy: [{ classGroup: { level: "asc" } }, { lastName: "asc" }],
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: { termId },
      _sum: { amount: true },
    }),
  ]);

  const paidByStudent = new Map(paymentGroups.map((p) => [p.studentId, p._sum.amount ?? 0]));

  const rows: FeeRow[] = students.map((s) => {
    const billed = billedAmount(feeItems, s.classGroupId);
    const paid = paidByStudent.get(s.id) ?? 0;
    return {
      studentId: s.id,
      name: studentName(s),
      admissionNo: s.admissionNo,
      className: s.classGroup?.name ?? "—",
      billed,
      paid,
      balance: Math.round((billed - paid) * 100) / 100,
    };
  });

  const totals = {
    expected: rows.reduce((a, r) => a + r.billed, 0),
    collected: rows.reduce((a, r) => a + r.paid, 0),
    outstanding: rows.reduce((a, r) => a + Math.max(0, r.balance), 0),
  };

  return { feeItems, rows, totals, students };
}
