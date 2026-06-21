import { prisma } from "@/lib/db";
import { totalScore } from "@/lib/grading";
import { getTermFeeOverview } from "@/lib/fees";

// Shared quartile helper — input must be sorted ascending.
function quartiles(sorted: number[]) {
  const n = sorted.length;
  if (n < 3) return null;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const lower = sorted.slice(0, mid);
  const upper = sorted.slice(n % 2 === 0 ? mid : mid + 1);
  const q1 = lower.length ? lower[Math.floor(lower.length / 2)] : median;
  const q3 = upper.length ? upper[Math.floor(upper.length / 2)] : median;
  return {
    min: round1(sorted[0]),
    q1: round1(q1),
    median: round1(median),
    q3: round1(q3),
    max: round1(sorted[n - 1]),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function termLabel(yearName: string, termName: string): string {
  // "2025/2026" + "Term 3" → "T3 25/26"
  const [a, b] = yearName.split("/");
  return `${termName.replace("Term ", "T")} ${a?.slice(2) ?? ""}/${b?.slice(2) ?? ""}`;
}

// ====================================================================
// Per-student analytics
// ====================================================================

export type StudentAnalytics = {
  hasData: boolean;
  termTrend: { label: string; Student: number | null; "Class average": number | null }[];
  attendanceTrend: { label: string; "Attendance %": number | null }[];
  subjectTrend: Record<string, string | number | null>[];
  subjectKeys: string[];
  latestTermLabel: string | null;
  latestSubjects: { label: string; Student: number; "Class average": number | null }[];
};

export async function getStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
  const scores = await prisma.score.findMany({
    where: { studentId },
    include: { subject: true, term: { include: { academicYear: true } } },
  });

  const pairs = [...new Set(scores.map((s) => `${s.classGroupId}|${s.termId}`))].map((key) => {
    const [classGroupId, termId] = key.split("|");
    return { classGroupId, termId };
  });

  const [classScores, myAttendance, classDays, termTotals] = await Promise.all([
    pairs.length
      ? prisma.score.findMany({
          where: { OR: pairs },
          select: { classGroupId: true, termId: true, subjectId: true, classScore: true, examScore: true },
        })
      : Promise.resolve([]),
    prisma.attendanceRecord.findMany({
      where: { studentId },
      select: { termId: true, status: true },
    }),
    pairs.length
      ? prisma.attendanceRecord.findMany({
          where: { OR: pairs },
          select: { classGroupId: true, termId: true, date: true },
          distinct: ["classGroupId", "termId", "date"],
        })
      : Promise.resolve([]),
    // End-of-term totals take precedence over the daily register.
    prisma.termAttendance.findMany({
      where: { studentId },
      select: { termId: true, daysPresent: true, daysTotal: true },
    }),
  ]);
  const termTotalByTerm = new Map(termTotals.map((t) => [t.termId, t]));

  // Chronological term blocks.
  const termMeta = new Map<string, { label: string; sort: string; classGroupId: string }>();
  for (const s of scores) {
    if (!termMeta.has(s.termId)) {
      termMeta.set(s.termId, {
        label: termLabel(s.term.academicYear.name, s.term.name),
        sort: `${s.term.academicYear.name}|${s.term.name}`,
        classGroupId: s.classGroupId,
      });
    }
  }
  const orderedTerms = [...termMeta.entries()].sort((a, b) => a[1].sort.localeCompare(b[1].sort));

  const daysByPair = new Map<string, number>();
  for (const d of classDays) {
    const key = `${d.classGroupId}|${d.termId}`;
    daysByPair.set(key, (daysByPair.get(key) ?? 0) + 1);
  }
  const presentByTerm = new Map<string, number>();
  for (const a of myAttendance) {
    if (a.status === "PRESENT" || a.status === "LATE") {
      presentByTerm.set(a.termId, (presentByTerm.get(a.termId) ?? 0) + 1);
    }
  }

  const subjectKeys = [...new Set(scores.map((s) => s.subject.name))].sort();

  const termTrend: StudentAnalytics["termTrend"] = [];
  const attendanceTrend: StudentAnalytics["attendanceTrend"] = [];
  const subjectTrend: StudentAnalytics["subjectTrend"] = [];

  for (const [termId, meta] of orderedTerms) {
    const mine = scores.filter((s) => s.termId === termId);
    const myTotals = mine
      .map((s) => totalScore(s.classScore, s.examScore))
      .filter((t): t is number => t != null);
    const classTotals = classScores
      .filter((s) => s.termId === termId)
      .map((s) => totalScore(s.classScore, s.examScore))
      .filter((t): t is number => t != null);

    termTrend.push({ label: meta.label, Student: mean(myTotals), "Class average": mean(classTotals) });

    const summary = termTotalByTerm.get(termId);
    let attendancePct: number | null = null;
    if (summary && summary.daysTotal && summary.daysTotal > 0) {
      attendancePct = round1(((summary.daysPresent ?? 0) / summary.daysTotal) * 100);
    } else {
      const days = daysByPair.get(`${meta.classGroupId}|${termId}`) ?? 0;
      attendancePct = days > 0 ? round1(((presentByTerm.get(termId) ?? 0) / days) * 100) : null;
    }
    attendanceTrend.push({ label: meta.label, "Attendance %": attendancePct });

    const row: Record<string, string | number | null> = { label: meta.label };
    for (const s of mine) {
      const t = totalScore(s.classScore, s.examScore);
      if (t != null) row[s.subject.name] = round1(t);
    }
    subjectTrend.push(row);
  }

  // Latest term: per-subject comparison with the class.
  const latest = orderedTerms.at(-1);
  let latestSubjects: StudentAnalytics["latestSubjects"] = [];
  if (latest) {
    const [termId] = latest;
    const classBySubject = new Map<string, number[]>();
    for (const s of classScores.filter((s) => s.termId === termId)) {
      const t = totalScore(s.classScore, s.examScore);
      if (t != null) (classBySubject.get(s.subjectId) ?? classBySubject.set(s.subjectId, []).get(s.subjectId)!).push(t);
    }
    latestSubjects = scores
      .filter((s) => s.termId === termId)
      .map((s) => {
        const t = totalScore(s.classScore, s.examScore);
        return t == null
          ? null
          : {
              label: s.subject.name,
              Student: round1(t),
              "Class average": mean(classBySubject.get(s.subjectId) ?? []),
            };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return {
    hasData: scores.length > 0,
    termTrend,
    attendanceTrend,
    subjectTrend,
    subjectKeys,
    latestTermLabel: latest?.[1].label ?? null,
    latestSubjects,
  };
}

// ====================================================================
// School-wide analytics
// ====================================================================

export type SchoolAnalytics = {
  termName: string | null;
  headline: {
    students: number;
    boys: number;
    girls: number;
    teachers: number;
    classes: number;
    overallAverage: number | null;
    attendancePct: number | null;
  };
  enrollment: { label: string; Boys: number; Girls: number }[];
  classAverages: { label: string; Average: number | null }[];
  subjectAverages: { label: string; Average: number | null }[];
  attendanceByClass: { label: string; "Attendance %": number | null }[];
  attendanceTrend: { label: string; "Attendance %": number }[];
  feesByTerm: { label: string; Expected: number; Collected: number }[];
};

export async function getSchoolAnalytics(): Promise<SchoolAnalytics> {
  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true },
    include: { academicYear: true },
  });

  const [students, teachers, classes, subjects, scores, attendance, termAtt] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { classGroupId: true, gender: true } }),
    prisma.teacher.count({ where: { status: "ACTIVE" } }),
    prisma.classGroup.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
    prisma.subject.findMany(),
    currentTerm
      ? prisma.score.findMany({
          where: { termId: currentTerm.id },
          select: { classGroupId: true, subjectId: true, classScore: true, examScore: true },
        })
      : Promise.resolve([]),
    currentTerm
      ? prisma.attendanceRecord.findMany({
          where: { termId: currentTerm.id },
          select: { classGroupId: true, status: true, date: true },
        })
      : Promise.resolve([]),
    currentTerm
      ? prisma.termAttendance.findMany({
          where: { termId: currentTerm.id },
          select: { classGroupId: true, daysPresent: true, daysTotal: true },
        })
      : Promise.resolve([]),
  ]);

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  // Enrollment by class & gender.
  const enrollment = classes.map((c) => {
    const inClass = students.filter((s) => s.classGroupId === c.id);
    return {
      label: c.name,
      Boys: inClass.filter((s) => s.gender !== "F").length,
      Girls: inClass.filter((s) => s.gender === "F").length,
    };
  });

  // Score totals.
  const allTotals: number[] = [];
  const totalsByClass = new Map<string, number[]>();
  const totalsBySubject = new Map<string, number[]>();
  for (const s of scores) {
    const t = totalScore(s.classScore, s.examScore);
    if (t == null) continue;
    allTotals.push(t);
    (totalsByClass.get(s.classGroupId) ?? totalsByClass.set(s.classGroupId, []).get(s.classGroupId)!).push(t);
    (totalsBySubject.get(s.subjectId) ?? totalsBySubject.set(s.subjectId, []).get(s.subjectId)!).push(t);
  }
  const classAverages = classes
    .map((c) => ({ label: c.name, Average: mean(totalsByClass.get(c.id) ?? []) }))
    .filter((r) => r.Average !== null);
  const subjectAverages = [...totalsBySubject.entries()]
    .map(([id, ts]) => ({ label: subjectName.get(id) ?? "?", Average: mean(ts) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Attendance.
  let presentAll = 0;
  const byClassAtt = new Map<string, { present: number; total: number }>();
  const byDate = new Map<string, { present: number; total: number }>();
  for (const a of attendance) {
    const present = a.status === "PRESENT" || a.status === "LATE";
    if (present) presentAll++;
    const c = byClassAtt.get(a.classGroupId) ?? { present: 0, total: 0 };
    c.total++;
    if (present) c.present++;
    byClassAtt.set(a.classGroupId, c);
    const dateKey = a.date.toISOString().slice(0, 10);
    const d = byDate.get(dateKey) ?? { present: 0, total: 0 };
    d.total++;
    if (present) d.present++;
    byDate.set(dateKey, d);
  }
  // End-of-term totals take precedence over the daily register, per class.
  const termByClass = new Map<string, { present: number; total: number }>();
  let termPresentAll = 0;
  let termTotalAll = 0;
  for (const t of termAtt) {
    if (t.daysTotal == null || t.daysTotal <= 0) continue;
    const c = termByClass.get(t.classGroupId) ?? { present: 0, total: 0 };
    c.present += t.daysPresent ?? 0;
    c.total += t.daysTotal;
    termByClass.set(t.classGroupId, c);
    termPresentAll += t.daysPresent ?? 0;
    termTotalAll += t.daysTotal;
  }
  const attendanceByClass = classes
    .map((c) => {
      const term = termByClass.get(c.id);
      if (term) return { label: c.name, "Attendance %": round1((term.present / term.total) * 100) };
      const v = byClassAtt.get(c.id);
      return { label: c.name, "Attendance %": v ? round1((v.present / v.total) * 100) : null };
    })
    .filter((r) => r["Attendance %"] !== null);
  const attendanceTrend = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      "Attendance %": round1((v.present / v.total) * 100),
    }));

  // Fees for every term of the current academic year.
  const feesByTerm: SchoolAnalytics["feesByTerm"] = [];
  if (currentTerm) {
    const yearTerms = await prisma.term.findMany({
      where: { academicYearId: currentTerm.academicYearId },
      orderBy: { name: "asc" },
    });
    for (const t of yearTerms) {
      const { totals } = await getTermFeeOverview(t.id);
      feesByTerm.push({
        label: t.name,
        Expected: Math.round(totals.expected),
        Collected: Math.round(totals.collected),
      });
    }
  }

  return {
    termName: currentTerm ? `${currentTerm.academicYear.name} ${currentTerm.name}` : null,
    headline: {
      students: students.length,
      boys: students.filter((s) => s.gender !== "F").length,
      girls: students.filter((s) => s.gender === "F").length,
      teachers,
      classes: classes.length,
      overallAverage: mean(allTotals),
      attendancePct:
        termTotalAll > 0
          ? round1((termPresentAll / termTotalAll) * 100)
          : attendance.length
            ? round1((presentAll / attendance.length) * 100)
            : null,
    },
    enrollment,
    classAverages,
    subjectAverages,
    attendanceByClass,
    attendanceTrend,
    feesByTerm,
  };
}

// ====================================================================
// Filter-aware analytics (term / year / class selection)
// ====================================================================

export type FilterMeta = {
  years: { id: string; name: string }[];
  terms: { id: string; name: string; yearId: string }[];
  classes: { id: string; name: string }[];
  selectedYear: { id: string; name: string } | null;
  selectedTerm: { id: string; name: string } | null;
  selectedClass: { id: string; name: string } | null;
  multiTerm: boolean;
  termLabel: string;
};

export type FilteredBoxPoint = {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  avg: number | null;
};

export type FilteredHeatCell = { week: number; day: number; pct: number | null };
export type FilteredScatterPoint = { x: number; y: number; name: string };

export type TeacherCompRow = {
  subject: string;
  teacher: string;
  avg: number | null;
  count: number;
};

export type FilteredAnalytics = FilterMeta & {
  headline: {
    students: number;
    boys: number;
    girls: number;
    overallAverage: number | null;
    attendancePct: number | null;
  };
  enrollment: { label: string; Boys: number; Girls: number }[];
  genderSplit: { label: string; value: number }[];
  classAverages: { label: string; Average: number | null }[];
  subjectAverages: { label: string; Average: number | null }[];
  attendanceByClass: { label: string; "Attendance %": number | null }[];
  scoreTrend: { label: string; Average: number | null }[];
  attendanceTrend: { label: string; "Attendance %": number | null }[];
  boxPlots: FilteredBoxPoint[];
  histogram: { label: string; count: number }[];
  heatmap: FilteredHeatCell[];
  scatter: FilteredScatterPoint[];
  teacherComparison: TeacherCompRow[];
  feesByTerm: { label: string; Expected: number; Collected: number }[];
};

export async function getFilteredAnalytics(params: {
  yearId?: string;
  termId?: string;
  classId?: string;
  adminLevels?: string[] | null;
}): Promise<FilteredAnalytics> {
  // ── 1. Metadata ──────────────────────────────────────────────────
  const levelWhere = params.adminLevels ? { stage: { in: params.adminLevels } } : {};
  const [allYears, allTermsRaw, allClasses] = await Promise.all([
    prisma.academicYear.findMany({ orderBy: { name: "desc" } }),
    prisma.term.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.classGroup.findMany({ where: levelWhere, orderBy: [{ level: "asc" }, { name: "asc" }] }),
  ]);

  // ── 2. Resolve selections ────────────────────────────────────────
  const fallbackTerm = allTermsRaw.find((t) => t.isCurrent) ?? allTermsRaw.at(-1) ?? null;
  const fallbackYear = fallbackTerm?.academicYear ?? allYears[0] ?? null;

  const rawTerm = params.termId ? (allTermsRaw.find((t) => t.id === params.termId) ?? null) : null;
  const rawYear = params.yearId
    ? (allYears.find((y) => y.id === params.yearId) ?? null)
    : rawTerm?.academicYear ?? fallbackYear;

  // multiTerm = showing a whole academic year (no specific term)
  const multiTerm = !!rawYear && !rawTerm;
  const selectedYear = rawYear ?? fallbackYear;
  const selectedTerm = rawTerm ?? (multiTerm ? null : fallbackTerm ?? null);
  const selectedClass = params.classId ? (allClasses.find((c) => c.id === params.classId) ?? null) : null;

  const termIds: string[] = selectedTerm
    ? [selectedTerm.id]
    : selectedYear
      ? allTermsRaw.filter((t) => t.academicYearId === selectedYear.id).map((t) => t.id)
      : fallbackTerm
        ? [fallbackTerm.id]
        : [];

  // Ordered terms for this year (for trend data)
  const yearTerms = allTermsRaw
    .filter((t) => t.academicYearId === (selectedYear?.id ?? fallbackYear?.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tLabel = selectedTerm
    ? `${selectedYear?.name ?? ""} ${selectedTerm.name}`
    : selectedYear?.name ?? "No data";

  const filterMeta: FilterMeta = {
    years: allYears.map((y) => ({ id: y.id, name: y.name })),
    terms: allTermsRaw.map((t) => ({ id: t.id, name: t.name, yearId: t.academicYearId })),
    classes: allClasses.map((c) => ({ id: c.id, name: c.name })),
    selectedYear: selectedYear ? { id: selectedYear.id, name: selectedYear.name } : null,
    selectedTerm: selectedTerm ? { id: selectedTerm.id, name: selectedTerm.name } : null,
    selectedClass: selectedClass ? { id: selectedClass.id, name: selectedClass.name } : null,
    multiTerm,
    termLabel: tLabel,
  };

  const empty: FilteredAnalytics = {
    ...filterMeta,
    headline: { students: 0, boys: 0, girls: 0, overallAverage: null, attendancePct: null },
    enrollment: [], genderSplit: [], classAverages: [], subjectAverages: [],
    attendanceByClass: [], scoreTrend: [], attendanceTrend: [], boxPlots: [],
    histogram: [], heatmap: [], scatter: [], teacherComparison: [], feesByTerm: [],
  };
  if (!termIds.length) return empty;

  // ── 3. Queries ───────────────────────────────────────────────────
  const classFilter = selectedClass ? { classGroupId: selectedClass.id } : {};
  // When no specific class is selected, apply level restriction via relation.
  const stageFilt = !selectedClass && params.adminLevels
    ? { classGroup: { stage: { in: params.adminLevels } } }
    : {};

  const [students, scores, termAttRaw, dailyAtt, subjectAssignments] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ACTIVE", ...classFilter, ...stageFilt },
      select: { id: true, classGroupId: true, gender: true, firstName: true, lastName: true },
    }),
    prisma.score.findMany({
      where: { termId: { in: termIds }, ...classFilter, ...stageFilt },
      select: {
        studentId: true, classGroupId: true, subjectId: true, termId: true,
        classScore: true, examScore: true, subject: { select: { name: true } },
      },
    }),
    prisma.termAttendance.findMany({
      where: { termId: { in: termIds }, ...classFilter, ...stageFilt },
      select: { studentId: true, classGroupId: true, termId: true, daysPresent: true, daysTotal: true },
    }),
    // Daily records only needed for heatmap (single term)
    selectedTerm
      ? prisma.attendanceRecord.findMany({
          where: { termId: selectedTerm.id, ...classFilter, ...stageFilt },
          select: { studentId: true, classGroupId: true, date: true, status: true },
        })
      : Promise.resolve([] as { studentId: string; classGroupId: string; date: Date; status: string }[]),
    prisma.subjectAssignment.findMany({
      where: selectedClass ? { classGroupId: selectedClass.id } : {},
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
      },
    }),
  ]);

  // ── 4. Score aggregations ────────────────────────────────────────
  const allTotals: number[] = [];
  const totalsByClass = new Map<string, number[]>();
  const totalsBySubject = new Map<string, number[]>();
  const totalsByTerm = new Map<string, number[]>();
  const totalsByStudent = new Map<string, number[]>();
  const scoresBySubjectClass = new Map<string, number[]>();

  for (const s of scores) {
    const t = totalScore(s.classScore, s.examScore);
    if (t == null) continue;
    allTotals.push(t);
    (totalsByClass.get(s.classGroupId) ?? totalsByClass.set(s.classGroupId, []).get(s.classGroupId)!).push(t);
    (totalsBySubject.get(s.subjectId) ?? totalsBySubject.set(s.subjectId, []).get(s.subjectId)!).push(t);
    (totalsByTerm.get(s.termId) ?? totalsByTerm.set(s.termId, []).get(s.termId)!).push(t);
    (totalsByStudent.get(s.studentId) ?? totalsByStudent.set(s.studentId, []).get(s.studentId)!).push(t);
    const scKey = `${s.subjectId}|${s.classGroupId}`;
    (scoresBySubjectClass.get(scKey) ?? scoresBySubjectClass.set(scKey, []).get(scKey)!).push(t);
  }

  const subjectNames = new Map(scores.map((s) => [s.subjectId, s.subject.name]));

  const classAverages = allClasses
    .filter((c) => !selectedClass || c.id === selectedClass.id)
    .map((c) => ({ label: c.name, Average: mean(totalsByClass.get(c.id) ?? []) }))
    .filter((r) => r.Average !== null);

  const subjectAverages = [...totalsBySubject.entries()]
    .map(([id, ts]) => ({ label: subjectNames.get(id) ?? "?", Average: mean(ts) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // ── 5. Attendance aggregations ───────────────────────────────────
  const attByClass = new Map<string, { present: number; total: number }>();
  const attByStudent = new Map<string, { present: number; total: number }>();
  const attByTerm = new Map<string, { present: number; total: number }>();
  let totalPresent = 0, totalDays = 0;

  for (const t of termAttRaw) {
    if (!t.daysTotal || t.daysTotal <= 0) continue;
    const p = t.daysPresent ?? 0;
    const c = attByClass.get(t.classGroupId) ?? { present: 0, total: 0 };
    c.present += p; c.total += t.daysTotal; attByClass.set(t.classGroupId, c);
    const s = attByStudent.get(t.studentId) ?? { present: 0, total: 0 };
    s.present += p; s.total += t.daysTotal; attByStudent.set(t.studentId, s);
    const tm = attByTerm.get(t.termId) ?? { present: 0, total: 0 };
    tm.present += p; tm.total += t.daysTotal; attByTerm.set(t.termId, tm);
    totalPresent += p; totalDays += t.daysTotal;
  }

  const attendanceByClass = allClasses
    .filter((c) => !selectedClass || c.id === selectedClass.id)
    .map((c) => {
      const v = attByClass.get(c.id);
      return { label: c.name, "Attendance %": v && v.total > 0 ? round1((v.present / v.total) * 100) : null };
    })
    .filter((r) => r["Attendance %"] !== null);

  // ── 6. Trends (for the year) ─────────────────────────────────────
  const scoreTrend = yearTerms.map((t) => ({
    label: termLabel(t.academicYear.name, t.name),
    Average: mean(totalsByTerm.get(t.id) ?? []),
  }));

  const attendanceTrend = yearTerms.map((t) => {
    const v = attByTerm.get(t.id);
    return {
      label: termLabel(t.academicYear.name, t.name),
      "Attendance %": v && v.total > 0 ? round1((v.present / v.total) * 100) : null,
    };
  });

  // ── 7. Box plots ─────────────────────────────────────────────────
  const classesToPlot = selectedClass
    ? allClasses.filter((c) => c.id === selectedClass.id)
    : allClasses;

  const boxPlots: FilteredBoxPoint[] = classesToPlot
    .map((c) => {
      const ts = (totalsByClass.get(c.id) ?? []).slice().sort((a, b) => a - b);
      const q = quartiles(ts);
      if (!q) return null;
      return { label: c.name, ...q, avg: mean(ts) };
    })
    .filter((r): r is FilteredBoxPoint => r !== null);

  // ── 8. Histogram ─────────────────────────────────────────────────
  const histBuckets = Array.from({ length: 10 }, (_, i) => ({
    label: i === 9 ? "90-100" : `${i * 10}–${i * 10 + 9}`,
    count: 0,
  }));
  for (const t of allTotals) {
    histBuckets[Math.min(9, Math.floor(t / 10))].count++;
  }

  // ── 9. Heatmap (single term only) ────────────────────────────────
  const heatmap: FilteredHeatCell[] = [];
  if (selectedTerm && dailyAtt.length > 0) {
    const start = new Date(selectedTerm.startDate);
    const cellMap = new Map<string, { p: number; t: number }>();
    for (const r of dailyAtt) {
      const d = new Date(r.date);
      const day = (d.getUTCDay() + 6) % 7; // 0=Mon
      if (day > 4) continue;
      const week = Math.floor((d.getTime() - start.getTime()) / (7 * 86400_000));
      if (week < 0 || week > 19) continue;
      const key = `${week}:${day}`;
      const cell = cellMap.get(key) ?? { p: 0, t: 0 };
      cell.t++;
      if (r.status === "PRESENT" || r.status === "LATE") cell.p++;
      cellMap.set(key, cell);
    }
    for (const [key, cell] of cellMap) {
      const [week, day] = key.split(":").map(Number);
      heatmap.push({ week, day, pct: cell.t > 0 ? round1((cell.p / cell.t) * 100) : null });
    }
    heatmap.sort((a, b) => a.week - b.week || a.day - b.day);
  }

  // ── 10. Scatter (per-student, class view only) ───────────────────
  const scatter: FilteredScatterPoint[] = [];
  if (selectedClass) {
    for (const st of students) {
      const att = attByStudent.get(st.id);
      const sc = totalsByStudent.get(st.id) ?? [];
      if (!att || att.total === 0 || !sc.length) continue;
      scatter.push({
        x: round1((att.present / att.total) * 100),
        y: round1(mean(sc) ?? 0),
        name: `${st.firstName} ${st.lastName}`,
      });
    }
  }

  // ── 11. Teacher comparison ────────────────────────────────────────
  const seenRows = new Set<string>();
  const teacherComparison: TeacherCompRow[] = [];
  for (const a of subjectAssignments) {
    const key = `${a.subjectId}|${a.classGroupId}`;
    const rowKey = `${a.subject.name}|${a.teacher.firstName} ${a.teacher.lastName}`;
    if (seenRows.has(rowKey)) continue;
    seenRows.add(rowKey);
    const scores = scoresBySubjectClass.get(key) ?? [];
    teacherComparison.push({
      subject: a.subject.name,
      teacher: `${a.teacher.firstName} ${a.teacher.lastName}`,
      avg: mean(scores),
      count: scores.length,
    });
  }
  teacherComparison.sort((a, b) => a.subject.localeCompare(b.subject) || a.teacher.localeCompare(b.teacher));

  // ── 12. Demographics ─────────────────────────────────────────────
  const boys = students.filter((s) => s.gender !== "F").length;
  const girls = students.filter((s) => s.gender === "F").length;

  const enrollment = allClasses
    .filter((c) => !selectedClass || c.id === selectedClass.id)
    .map((c) => {
      const inClass = students.filter((s) => s.classGroupId === c.id);
      return {
        label: c.name,
        Boys: inClass.filter((s) => s.gender !== "F").length,
        Girls: inClass.filter((s) => s.gender === "F").length,
      };
    })
    .filter((r) => r.Boys + r.Girls > 0);

  // ── 13. Fees ─────────────────────────────────────────────────────
  const feesByTerm: FilteredAnalytics["feesByTerm"] = [];
  for (const t of yearTerms) {
    if (!termIds.includes(t.id) && !multiTerm) continue;
    if (multiTerm || t.id === selectedTerm?.id) {
      const { totals } = await getTermFeeOverview(t.id);
      feesByTerm.push({
        label: termLabel(t.academicYear.name, t.name),
        Expected: Math.round(totals.expected),
        Collected: Math.round(totals.collected),
      });
    }
  }

  return {
    ...filterMeta,
    headline: {
      students: students.length, boys, girls,
      overallAverage: mean(allTotals),
      attendancePct: totalDays > 0 ? round1((totalPresent / totalDays) * 100) : null,
    },
    enrollment, genderSplit: [{ label: "Boys", value: boys }, { label: "Girls", value: girls }],
    classAverages, subjectAverages, attendanceByClass,
    scoreTrend, attendanceTrend,
    boxPlots, histogram: histBuckets, heatmap, scatter, teacherComparison, feesByTerm,
  };
}
