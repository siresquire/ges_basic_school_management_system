import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Icon from "@/components/icon";

export const metadata = { title: "Activity Log" };

const ACTION_LABEL: Record<string, string> = {
  SCORE_SAVE: "Scores saved",
  SCORE_OVERRIDE: "Score override",
  SCORE_IMPORT: "Scores imported",
  STUDENT_CREATE: "Student added",
  STUDENT_STATUS: "Student status",
  PAYMENT_RECORD: "Payment recorded",
  TEACHER_CREATE: "Teacher added",
  IMPERSONATE: "Impersonation",
};

const ACTION_COLOR: Record<string, string> = {
  SCORE_OVERRIDE: "text-amber-700 bg-amber-50",
  IMPERSONATE: "text-violet-700 bg-violet-50",
  STUDENT_CREATE: "text-emerald-700 bg-emerald-50",
  PAYMENT_RECORD: "text-blue-700 bg-blue-50",
};

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const take = 50;
  const skip = (page - 1) * take;

  const [total, logs] = await Promise.all([
    prisma.activityLog.count(),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/super-admin" className="text-sm text-gray-500 hover:text-gray-700">
          ← System Configuration
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
          <Icon name="history" />
        </span>
        <div>
          <h1 className="page-title mb-0">Activity Log</h1>
          <p className="text-sm text-gray-500">
            All significant actions across the system — {total.toLocaleString()} total entries.
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-36">When</th>
              <th className="w-36">By</th>
              <th className="w-40">Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry) => {
              const color = ACTION_COLOR[entry.action] ?? "text-gray-600 bg-gray-100";
              return (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs text-gray-500">
                    {entry.createdAt.toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="text-sm font-medium">{entry.actorName}</td>
                  <td>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="text-sm text-gray-700">{entry.detail}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                  No activity recorded yet. Actions will appear here as staff use the system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="btn-secondary btn-sm">
              ← Previous
            </Link>
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`?page=${page + 1}`} className="btn-secondary btn-sm">
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
