import { cache } from "react";
import { prisma } from "@/lib/db";
import { getEnabledLevels } from "@/lib/school-config";

// Request-level deduplication: layouts and pages often need the same lookups
// (school info, current term, class list). React's cache() makes each of
// these hit the database at most once per request — fewer round trips,
// which matters most on hosted Postgres.

export const getSchoolInfo = cache(() =>
  prisma.schoolInfo.findUnique({ where: { id: 1 } })
);

export const getCurrentTerm = cache(() =>
  prisma.term.findFirst({
    where: { isCurrent: true },
    include: { academicYear: true },
  })
);

export const getTermList = cache(() =>
  prisma.term.findMany({
    include: { academicYear: true },
    orderBy: [{ academicYear: { name: "desc" } }, { name: "asc" }],
  })
);

export const getClassList = cache(() =>
  prisma.classGroup.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] })
);

// Like getClassList but omits classes whose stage has been disabled in SchoolConfig.
// Use this everywhere a teacher/admin picks a class; keep getClassList for
// super-admin pages that must show everything.
export const getEnabledClassList = cache(async () => {
  const [classes, levels] = await Promise.all([getClassList(), getEnabledLevels()]);
  return classes.filter((c) => levels.includes(c.stage));
});
