import { getSession } from "@/lib/auth";
import { bulkGenerateParentLogins } from "@/lib/bulk-logins";

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return new Response("Forbidden", { status: 403 });
  }
  const buffer = await bulkGenerateParentLogins();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="parent-logins.xlsx"',
    },
  });
}
