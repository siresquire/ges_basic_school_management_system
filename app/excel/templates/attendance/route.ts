import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAttendanceTemplate } from "@/lib/excel";
import { getTeacherScope, canAdminister } from "@/lib/teacher-scope";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "TEACHER")) {
    return new Response("Not allowed", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const classGroupId = params.get("class") ?? "";
  const termId = params.get("term") ?? "";
  if (!classGroupId || !termId) return new Response("Pick a class and term first", { status: 400 });

  // Only the class teacher / form master (or admin) administrates attendance.
  const scope = await getTeacherScope(session);
  if (!canAdminister(scope, classGroupId)) return new Response("Not your class", { status: 403 });

  const result = await buildAttendanceTemplate(classGroupId, termId);
  if (!result) return new Response("No students found for that class", { status: 404 });

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
