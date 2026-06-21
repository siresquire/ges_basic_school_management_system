import { prisma } from "@/lib/db";
import {
  getGradeBands,
  gradeFor,
  totalScore,
  ordinal,
  sectionForStage,
  autoTeacherRemark,
  autoHeadRemark,
} from "@/lib/grading";
import { fullName } from "@/lib/format";
import { dataUrl, getSingletonImage } from "@/lib/images";
import { classTeacherTitle } from "@/lib/teacher-scope";
import { getAttendanceForClass } from "@/lib/attendance";

export type ReportRow = {
  subjectName: string;
  classScore: number | null; // raw, out of 100
  examScore: number | null; // raw, out of 100
  scaledClass: number | null; // out of 50
  scaledExam: number | null; // out of 50
  total: number | null; // out of 100
  grade: string | null;
  remark: string | null;
};

export type StudentReport = {
  studentId: string;
  name: string;
  admissionNo: string;
  gender: string;
  rows: ReportRow[];
  grandTotal: number;
  average: number | null;
  position: string | null; // "3rd"
  attendancePresent: number;
  attendanceTotal: number;
  conduct: string | null;
  teacherRemark: string | null; // typed override, else auto from average
  headRemark: string | null; // typed override, else auto from average
};

export type ClassReportData = {
  school: {
    name: string;
    address: string | null;
    phone: string | null;
    motto: string | null;
    logoUrl: string | null;
    // Resolved for this class's section: "Headteacher" for KG/Primary,
    // "Headmaster"/"Headmistress" for JHS.
    headTitle: string;
    headName: string | null;
    headSignatureUrl: string | null;
  };
  term: { id: string; name: string; yearName: string; startDate: Date; endDate: Date; nextTermBegins: Date | null };
  classGroup: {
    id: string;
    name: string;
    teacherName: string | null;
    /** "Class Teacher" for KG/Primary; "Form Master"/"Form Mistress" for JHS. */
    teacherTitle: string;
    teacherSignatureUrl: string | null;
  };
  classSize: number;
  reports: StudentReport[];
};

/**
 * Builds report-card data for every active student in a class for a term —
 * scores graded on the section's scale, 50/50 weighted totals, class
 * positions, attendance counts, conduct and remarks.
 */
export async function getClassReportData(
  classGroupId: string,
  termId: string
): Promise<ClassReportData | null> {
  const [school, term, classGroup] = await Promise.all([
    prisma.schoolInfo.findUnique({ where: { id: 1 } }),
    prisma.term.findUnique({ where: { id: termId }, include: { academicYear: true } }),
    prisma.classGroup.findUnique({ where: { id: classGroupId }, include: { classTeacher: true } }),
  ]);
  if (!term || !classGroup) return null;

  const section = sectionForStage(classGroup.stage);
  const isJhs = section === "JHS";

  const [students, scores, attendanceMap, remarks, bands, logoAsset, headSigAsset, teacherSigAsset] =
    await Promise.all([
      prisma.student.findMany({
        where: { classGroupId, status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.score.findMany({
        where: { classGroupId, termId },
        include: { subject: true },
        orderBy: { subject: { name: "asc" } },
      }),
      // Prefers end-of-term totals; falls back to the daily register.
      getAttendanceForClass(classGroupId, termId),
      prisma.reportRemark.findMany({
        where: { termId, student: { classGroupId } },
      }),
      getGradeBands(section),
      getSingletonImage("LOGO"),
      getSingletonImage(isJhs ? "HEAD_SIGNATURE_JHS" : "HEAD_SIGNATURE_PRIMARY"),
      classGroup.classTeacherId
        ? prisma.imageAsset.findUnique({ where: { teacherId: classGroup.classTeacherId } })
        : Promise.resolve(null),
    ]);

  const scoresByStudent = new Map<string, typeof scores>();
  for (const s of scores) {
    const list = scoresByStudent.get(s.studentId) ?? [];
    list.push(s);
    scoresByStudent.set(s.studentId, list);
  }
  const remarkByStudent = new Map(remarks.map((r) => [r.studentId, r]));

  const draft = students.map((student) => {
    const rows: ReportRow[] = (scoresByStudent.get(student.id) ?? []).map((s) => {
      const total = totalScore(s.classScore, s.examScore);
      const band = total != null ? gradeFor(bands, total) : null;
      return {
        subjectName: s.subject.name,
        classScore: s.classScore,
        examScore: s.examScore,
        scaledClass: s.classScore != null ? round1(s.classScore * 0.5) : null,
        scaledExam: s.examScore != null ? round1(s.examScore * 0.5) : null,
        total: total != null ? round1(total) : null,
        grade: band?.grade ?? null,
        remark: band?.remark ?? null,
      };
    });
    const totals = rows.map((r) => r.total).filter((t): t is number => t != null);
    const grandTotal = round1(totals.reduce((a, b) => a + b, 0));
    const average = totals.length ? round1(grandTotal / totals.length) : null;

    const extra = remarkByStudent.get(student.id);
    const teacherRemark =
      extra?.teacherRemark?.trim() || (average != null ? autoTeacherRemark(average) : null);
    const headRemark =
      extra?.headRemark?.trim() || (average != null ? autoHeadRemark(average) : null);

    return {
      studentId: student.id,
      name: fullName(student),
      admissionNo: student.admissionNo,
      gender: student.gender,
      rows,
      grandTotal,
      average,
      attendancePresent: attendanceMap.get(student.id)?.present ?? 0,
      attendanceTotal: attendanceMap.get(student.id)?.total ?? 0,
      conduct: extra?.conduct?.trim() || null,
      teacherRemark,
      headRemark,
    };
  });

  // Positions (standard competition ranking — ties share a position).
  const ranked = [...draft]
    .filter((d) => d.average != null)
    .sort((a, b) => b.average! - a.average!);
  const positionByStudent = new Map<string, string>();
  let lastAvg: number | null = null;
  let lastPos = 0;
  ranked.forEach((d, i) => {
    const pos = d.average === lastAvg ? lastPos : i + 1;
    lastAvg = d.average;
    lastPos = pos;
    positionByStudent.set(d.studentId, ordinal(pos));
  });

  const reports: StudentReport[] = draft.map((d) => ({
    ...d,
    position: positionByStudent.get(d.studentId) ?? null,
  }));

  return {
    school: {
      name: school?.name ?? "School",
      address: school?.address ?? null,
      phone: school?.phone ?? null,
      motto: school?.motto ?? null,
      logoUrl: dataUrl(logoAsset),
      headTitle: isJhs ? (school?.jhsHeadTitle ?? "Headmaster") : "Headteacher",
      headName: (isJhs ? school?.jhsHeadName : school?.headTeacherName) || null,
      headSignatureUrl: dataUrl(headSigAsset),
    },
    term: {
      id: term.id,
      name: term.name,
      yearName: term.academicYear.name,
      startDate: term.startDate,
      endDate: term.endDate,
      nextTermBegins: term.nextTermBegins,
    },
    classGroup: {
      id: classGroup.id,
      name: classGroup.name,
      teacherName: classGroup.classTeacher
        ? `${classGroup.classTeacher.firstName} ${classGroup.classTeacher.lastName}`
        : null,
      teacherTitle: classTeacherTitle(classGroup.stage, classGroup.classTeacher?.gender),
      teacherSignatureUrl: dataUrl(teacherSigAsset),
    },
    classSize: students.length,
    reports,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
