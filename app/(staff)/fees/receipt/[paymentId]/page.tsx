import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ghs, fmtDate, fullName } from "@/lib/format";
import { cedisInWords } from "@/lib/words";
import { dataUrl, getSingletonImage } from "@/lib/images";
import PrintButton from "@/components/print-button";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  await requireAdmin();
  const { paymentId } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: { include: { classGroup: true } },
      term: { include: { academicYear: true } },
    },
  });
  if (!payment) notFound();

  const [school, logoAsset] = await Promise.all([
    prisma.schoolInfo.findUnique({ where: { id: 1 } }),
    getSingletonImage("LOGO"),
  ]);
  const logoUrl = dataUrl(logoAsset);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href="/fees" className="btn-secondary">
          ← Back to fees
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      <div className="print-area card bg-white p-8 text-sm">
        <div className="border-b-2 border-gray-900 pb-3 text-center">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="School logo" className="mx-auto mb-2 h-14 w-14 object-contain" />
          )}
          <h1 className="text-lg font-bold tracking-wide uppercase">{school?.name}</h1>
          {school?.address && <p className="text-xs">{school.address}</p>}
          {school?.phone && <p className="text-xs">Tel: {school.phone}</p>}
          <p className="mt-2 text-sm font-semibold tracking-widest uppercase">Official Receipt</p>
        </div>

        <div className="mt-4 flex justify-between text-sm">
          <p>
            <span className="font-semibold">Receipt No.: </span>
            <span className="font-mono">{payment.receiptNo}</span>
          </p>
          <p>
            <span className="font-semibold">Date: </span>
            {fmtDate(payment.paidAt)}
          </p>
        </div>

        <div className="mt-4 space-y-2 leading-relaxed">
          <p>
            <span className="font-semibold">Received from: </span>
            {fullName(payment.student)} ({payment.student.admissionNo},{" "}
            {payment.student.classGroup?.name ?? "no class"})
          </p>
          <p>
            <span className="font-semibold">The sum of: </span>
            {cedisInWords(payment.amount)}
          </p>
          <p>
            <span className="font-semibold">Being payment of: </span>
            {payment.note || `School fees — ${payment.term.academicYear.name} ${payment.term.name}`}
          </p>
          <p>
            <span className="font-semibold">Payment method: </span>
            {payment.method === "MOMO" ? "Mobile Money" : payment.method === "BANK" ? "Bank" : "Cash"}
            {payment.reference ? ` (Ref: ${payment.reference})` : ""}
          </p>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div className="rounded-md border-2 border-gray-900 px-4 py-2 text-lg font-bold">
            {ghs(payment.amount)}
          </div>
          <div className="w-48 border-t border-gray-400 pt-1 text-center text-xs">
            Received by{payment.receivedBy ? `: ${payment.receivedBy}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
