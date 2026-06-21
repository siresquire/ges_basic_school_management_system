import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildScoreWorkbook } from "@/lib/excel";
import { getTeacherScope, canTeach, allowedSubjectIds } from "@/lib/teacher-scope";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "TEACHER")) {
    return new Response("Not allowed", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const classGroupId = params.get("class") ?? "";
  const termId = params.get("term") ?? "";
  let subjectIds = params.getAll("subjects").filter(Boolean);

  if (!classGroupId || !termId) return new Response("Pick a class and term first", { status: 400 });

  // Teachers only download sheets for their classes — and subject teachers
  // only for their own subjects in that class.
  const scope = await getTeacherScope(session);
  if (!canTeach(scope, classGroupId)) return new Response("Not your class", { status: 403 });
  const allowed = allowedSubjectIds(scope, classGroupId);
  if (allowed !== null) {
    subjectIds = (subjectIds.length > 0 ? subjectIds : allowed).filter((id) => allowed.includes(id));
    if (subjectIds.length === 0) return new Response("No subjects assigned to you in this class", { status: 403 });
  }

  const result = await buildScoreWorkbook(classGroupId, termId, subjectIds);
  if (!result) return new Response("No subjects found for that class", { status: 404 });

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
