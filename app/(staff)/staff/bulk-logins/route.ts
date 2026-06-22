import { getSession } from "@/lib/auth";
import { bulkGenerateStaffLogins } from "@/lib/bulk-logins";

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return new Response("Forbidden", { status: 403 });
  }
  const buffer = await bulkGenerateStaffLogins();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="staff-logins.xlsx"',
    },
  });
}
