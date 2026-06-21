import { getSession } from "@/lib/auth";
import { buildStudentsTemplate } from "@/lib/excel";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return new Response("Not allowed", { status: 403 });
  }
  const buffer = await buildStudentsTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="learners-template.xlsx"',
    },
  });
}
