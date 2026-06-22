// Excel template generation and import (bulk learners/staff, score sheets).
//
// Score sheets follow the school's marking practice:
//   4 class works totalling 60  →  converted to 50%
//   exam out of 100             →  converted to 50%
//   final = class 50% + exam 50% = 100%
// The database stores classScore out of 100 (= classwork total ÷ 60 × 100)
// and examScore out of 100, weighted 50/50 — mathematically identical.
//
// Uses relative imports so maintenance scripts can run it with tsx directly.
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { fullName } from "./format";
import { genPassword, uniqueUsername } from "./passwords";

export type ImportResult = {
  ok: boolean;
  message: string;
  details: string[];
  /** Set when newer data exists — the user must explicitly confirm replacement. */
  needsConfirm?: boolean;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD1FAE5" }, // emerald-100
};

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin" } };
  });
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Excel reserves some sheet names for itself ("History" is used internally
// for change tracking) — a subject with that name gets a suffix instead.
const RESERVED_SHEET_NAMES = new Set(["history", "meta"]);

/** Excel sheet names: max 31 chars, no \ / ? * [ ] : and not a reserved name. */
function sheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  if (RESERVED_SHEET_NAMES.has(base.toLowerCase())) {
    base = `${base} (Subject)`.slice(0, 31);
  }
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n++}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ---------- cell readers (handle numbers, strings, formula results, dates) ----------

type CellValue = ExcelJS.CellValue;

function numVal(value: CellValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return isNaN(n) ? null : n;
  }
  if (typeof value === "object" && "result" in value && typeof value.result === "number") {
    return value.result;
  }
  return null;
}

function strVal(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("result" in value && value.result != null) return strVal(value.result as CellValue);
    if ("text" in value && typeof value.text === "string") return value.text.trim();
  }
  return "";
}

function dateVal(value: CellValue): Date | null {
  if (value instanceof Date) {
    // Normalise to UTC midnight (Excel dates carry a time component).
    return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }
  const s = strVal(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return null;
}

function genderVal(value: CellValue): string | null {
  const s = strVal(value).toUpperCase();
  if (s === "M" || s === "MALE") return "M";
  if (s === "F" || s === "FEMALE") return "F";
  return null;
}

// Restore the leading zero that Excel strips from Ghana phone numbers (0XX XXXX XXX).
// Excel saves 0244123456 as the number 244123456 — we get a 9-digit string.
// Also handles international prefix 233XXXXXXXXX → 0XXXXXXXXX.
function phoneVal(value: CellValue): string | null {
  const raw = strVal(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 12 && digits.startsWith("233")) return `0${digits.slice(3)}`;
  return raw;
}

// ====================================================================
// Learners
// ====================================================================

export async function buildStudentsTemplate(): Promise<Buffer> {
  const classes = await prisma.classGroup.findMany({
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Learners");
  ws.columns = [
    { header: "Admission No. (leave blank to auto-generate)", key: "adm", width: 34 },
    { header: "First name *", key: "fn", width: 16 },
    { header: "Surname *", key: "ln", width: 16 },
    { header: "Other names", key: "on", width: 16 },
    { header: "Gender (M/F) *", key: "g", width: 14 },
    { header: "Date of birth (YYYY-MM-DD)", key: "dob", width: 24 },
    { header: "Class *", key: "cls", width: 14 },
    { header: "Guardian name", key: "gn", width: 20 },
    { header: "Guardian phone", key: "gp", width: 16 },
    { header: "Home town / address", key: "addr", width: 24 },
  ];
  styleHeaderRow(ws);
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Reference sheet for the class dropdown.
  const ref = wb.addWorksheet("Classes");
  classes.forEach((c, i) => {
    ref.getCell(i + 1, 1).value = c.name;
  });
  ref.state = "hidden";

  for (let r = 2; r <= 501; r++) {
    ws.getCell(r, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"M,F"'],
      showErrorMessage: true,
      error: "Enter M or F",
    };
    if (classes.length > 0) {
      ws.getCell(r, 7).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Classes!$A$1:$A$${classes.length}`],
        showErrorMessage: true,
        error: "Pick a class from the list",
      };
    }
  }

  return toBuffer(wb);
}

export async function importStudentsFromBuffer(
  buffer: Buffer,
  options?: { allowedClassIds?: string[] }
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("Learners") ?? wb.worksheets[0];
  if (!ws) return { ok: false, message: "No worksheet found in that file.", details: [] };

  const classes = await prisma.classGroup.findMany();
  const classByName = new Map(classes.map((c) => [c.name.toLowerCase(), c]));

  // Next auto admission number.
  const last = await prisma.student.findFirst({
    orderBy: { admissionNo: "desc" },
    where: { admissionNo: { startsWith: "AKW-" } },
  });
  let nextNum = last ? parseInt(last.admissionNo.replace("AKW-", ""), 10) : 0;
  if (isNaN(nextNum)) nextNum = 0;

  // Pre-load taken usernames once so per-row lookups are O(1).
  const takenUsernames = new Set(
    (await prisma.user.findMany({ select: { username: true } })).map((u) => u.username)
  );

  let created = 0;
  let skipped = 0;
  const details: string[] = [];
  const seenAdmission = new Set<string>();

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const firstName = strVal(row.getCell(2).value).toUpperCase();
    const lastName = strVal(row.getCell(3).value).toUpperCase();
    const anything =
      firstName || lastName || strVal(row.getCell(1).value) || strVal(row.getCell(7).value);
    if (!anything) continue; // blank row

    if (!firstName || !lastName) {
      details.push(`Row ${r}: first name and surname are required — skipped.`);
      continue;
    }
    const gender = genderVal(row.getCell(5).value);
    if (!gender) {
      details.push(`Row ${r} (${firstName} ${lastName}): gender must be M or F — skipped.`);
      continue;
    }
    const classNameRaw = strVal(row.getCell(7).value);
    const classGroup = classNameRaw ? classByName.get(classNameRaw.toLowerCase()) : null;
    if (classNameRaw && !classGroup) {
      details.push(`Row ${r} (${firstName} ${lastName}): class "${classNameRaw}" not found — skipped.`);
      continue;
    }
    if (classGroup && options?.allowedClassIds && !options.allowedClassIds.includes(classGroup.id)) {
      details.push(`Row ${r} (${firstName} ${lastName}): class "${classNameRaw}" is outside your assigned level access — skipped.`);
      continue;
    }

    let admissionNo = strVal(row.getCell(1).value);
    if (!admissionNo) admissionNo = `AKW-${String(++nextNum).padStart(4, "0")}`;
    if (seenAdmission.has(admissionNo)) {
      details.push(`Row ${r}: admission number ${admissionNo} appears twice in the file — skipped.`);
      continue;
    }
    seenAdmission.add(admissionNo);

    const existing = await prisma.student.findUnique({ where: { admissionNo } });
    if (existing) {
      skipped++;
      details.push(`Row ${r}: ${admissionNo} already exists (${fullName(existing)}) — skipped.`);
      continue;
    }

    const student = await prisma.student.create({
      data: {
        admissionNo,
        firstName,
        lastName,
        otherNames: strVal(row.getCell(4).value).toUpperCase() || null,
        gender,
        dateOfBirth: dateVal(row.getCell(6).value),
        classGroupId: classGroup?.id ?? null,
        guardianName: strVal(row.getCell(8).value) || null,
        guardianPhone: phoneVal(row.getCell(9).value),
        address: strVal(row.getCell(10).value) || null,
      },
    });

    // Auto-create portal login with temp password
    const base = admissionNo.toLowerCase().replace(/-/g, "");
    const username = uniqueUsername(base, takenUsernames);
    const password = genPassword();
    const autoUser = await prisma.user.create({
      data: {
        username,
        name: `${firstName} ${lastName}`,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "STUDENT",
        tempPassword: password,
      },
    });
    await prisma.student.update({ where: { id: student.id }, data: { userId: autoUser.id } });

    created++;
  }

  return {
    ok: created > 0 || (skipped === 0 && details.length === 0),
    message: `${created} learner${created === 1 ? "" : "s"} admitted${
      skipped ? `, ${skipped} already existed` : ""
    }${details.length > skipped ? `, ${details.length - skipped} row(s) had problems` : ""}.`,
    details: details.slice(0, 20),
  };
}

// ====================================================================
// Staff
// ====================================================================

export async function buildStaffTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Staff");
  ws.columns = [
    { header: "Staff ID (optional)", key: "sid", width: 18 },
    { header: "First name *", key: "fn", width: 16 },
    { header: "Surname *", key: "ln", width: 16 },
    { header: "Gender (M/F) *", key: "g", width: 14 },
    { header: "Phone", key: "ph", width: 16 },
    { header: "Email", key: "em", width: 24 },
  ];
  styleHeaderRow(ws);
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (let r = 2; r <= 101; r++) {
    ws.getCell(r, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"M,F"'],
      showErrorMessage: true,
      error: "Enter M or F",
    };
  }
  return toBuffer(wb);
}

export async function importTeachersFromBuffer(buffer: Buffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("Staff") ?? wb.worksheets[0];
  if (!ws) return { ok: false, message: "No worksheet found in that file.", details: [] };

  // Pre-load taken usernames once so per-row lookups are O(1).
  const takenTeacherUsernames = new Set(
    (await prisma.user.findMany({ select: { username: true } })).map((u) => u.username)
  );

  let created = 0;
  const details: string[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const firstName = strVal(row.getCell(2).value).toUpperCase();
    const lastName = strVal(row.getCell(3).value).toUpperCase();
    if (!firstName && !lastName && !strVal(row.getCell(1).value)) continue;

    if (!firstName || !lastName) {
      details.push(`Row ${r}: first name and surname are required — skipped.`);
      continue;
    }
    const gender = genderVal(row.getCell(4).value);
    if (!gender) {
      details.push(`Row ${r} (${firstName} ${lastName}): gender must be M or F — skipped.`);
      continue;
    }
    const staffId = strVal(row.getCell(1).value) || null;
    if (staffId) {
      const dup = await prisma.teacher.findUnique({ where: { staffId } });
      if (dup) {
        details.push(`Row ${r}: staff ID ${staffId} already exists — skipped.`);
        continue;
      }
    }
    const teacher = await prisma.teacher.create({
      data: {
        staffId,
        firstName,
        lastName,
        gender,
        phone: phoneVal(row.getCell(5).value),
        email: strVal(row.getCell(6).value) || null,
      },
    });

    // Auto-create login with temp password
    const base = staffId ?? `${firstName}${lastName}`;
    const username = uniqueUsername(base, takenTeacherUsernames);
    const password = genPassword();
    const autoUser = await prisma.user.create({
      data: {
        username,
        name: `${firstName} ${lastName}`,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "TEACHER",
        tempPassword: password,
      },
    });
    await prisma.teacher.update({ where: { id: teacher.id }, data: { userId: autoUser.id } });

    created++;
  }

  return {
    ok: created > 0 || details.length === 0,
    message: `${created} teacher${created === 1 ? "" : "s"} added with auto-generated logins${
      details.length ? `, ${details.length} row(s) had problems` : ""
    }. Download passwords from the Staff page.`,
    details: details.slice(0, 20),
  };
}

// ====================================================================
// Score sheets
// ====================================================================

const SCORE_COLUMNS = [
  { header: "Admission No.", width: 14 },
  { header: "Student name", width: 26 },
  { header: "CW 1", width: 9 },
  { header: "CW 2", width: 9 },
  { header: "CW 3", width: 9 },
  { header: "CW 4", width: 9 },
  { header: "Class work total (60)", width: 18 },
  { header: "Class score (50%)", width: 16 },
  { header: "Exam score (100)", width: 16 },
  { header: "Exam (50%)", width: 12 },
  { header: "Final (100%)", width: 12 },
];

/**
 * One workbook for a class+term, one sheet per subject, names pre-filled.
 * Teachers fill CW1–CW4 (total ≤ 60, flagged red if over) and the exam
 * score (/100); the conversion columns are locked formulas.
 */
export async function buildScoreWorkbook(
  classGroupId: string,
  termId: string,
  subjectIds?: string[]
): Promise<{ buffer: Buffer; filename: string } | null> {
  const [classGroup, term, students, allSubjects] = await Promise.all([
    prisma.classGroup.findUnique({ where: { id: classGroupId } }),
    prisma.term.findUnique({ where: { id: termId }, include: { academicYear: true } }),
    prisma.student.findMany({
      where: { classGroupId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!classGroup || !term) return null;

  let subjects = allSubjects.filter((s) => s.stages.split(",").includes(classGroup.stage));
  if (subjectIds && subjectIds.length > 0) {
    subjects = subjects.filter((s) => subjectIds.includes(s.id));
  }
  if (subjects.length === 0) return null;

  // Pre-fill any scores already in the system (classScore/100 → classwork/60).
  const existing = await prisma.score.findMany({ where: { classGroupId, termId } });
  const existingMap = new Map(existing.map((s) => [`${s.studentId}|${s.subjectId}`, s]));

  const wb = new ExcelJS.Workbook();
  const used = new Set<string>(["meta"]);
  const meta: [string, string, string][] = [];

  for (const subject of subjects) {
    const name = sheetName(subject.name, used);
    meta.push(["subject", name, subject.id]);
    const ws = wb.addWorksheet(name);

    ws.columns = SCORE_COLUMNS.map((c) => ({ header: c.header, width: c.width }));
    styleHeaderRow(ws);
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

    students.forEach((st, i) => {
      const r = i + 2;
      const prior = existingMap.get(`${st.id}|${subject.id}`);
      ws.getCell(r, 1).value = st.admissionNo;
      ws.getCell(r, 2).value = fullName(st);
      // Pre-fill the four class works exactly as last saved. For scores saved
      // before class works were tracked individually, fall back to showing the
      // combined class score (/100 → /60) as a single CW entry.
      const cws = [prior?.cw1, prior?.cw2, prior?.cw3, prior?.cw4];
      if (cws.some((v) => v != null)) {
        cws.forEach((v, idx) => {
          if (v != null) ws.getCell(r, 3 + idx).value = v;
        });
      } else if (prior?.classScore != null) {
        ws.getCell(r, 3).value = Math.round((prior.classScore / 100) * 60 * 10) / 10;
      }
      ws.getCell(r, 7).value = { formula: `IF(COUNT(C${r}:F${r})=0,"",SUM(C${r}:F${r}))` };
      ws.getCell(r, 8).value = { formula: `IF(G${r}="","",ROUND(G${r}/60*50,1))` };
      if (prior?.examScore != null) ws.getCell(r, 9).value = prior.examScore;
      ws.getCell(r, 10).value = { formula: `IF(I${r}="","",ROUND(I${r}/2,1))` };
      ws.getCell(r, 11).value = {
        formula: `IF(AND(H${r}="",J${r}=""),"",ROUND(IF(H${r}="",0,H${r})+IF(J${r}="",0,J${r}),1))`,
      };

      for (const col of [3, 4, 5, 6]) {
        const cell = ws.getCell(r, col);
        cell.protection = { locked: false };
        cell.dataValidation = {
          type: "decimal",
          operator: "between",
          formulae: [0, 60],
          allowBlank: true,
          showErrorMessage: true,
          error: "Class work scores must be between 0 and 60",
        };
      }
      const examCell = ws.getCell(r, 9);
      examCell.protection = { locked: false };
      examCell.dataValidation = {
        type: "decimal",
        operator: "between",
        formulae: [0, 100],
        allowBlank: true,
        showErrorMessage: true,
        error: "Exam score must be between 0 and 100",
      };
      ws.getCell(r, 7).font = { bold: true };
      ws.getCell(r, 11).font = { bold: true };
    });

    // Flag class-work totals above 60 in red.
    ws.addConditionalFormatting({
      ref: `G2:G${students.length + 1}`,
      rules: [
        {
          type: "cellIs",
          operator: "greaterThan",
          formulae: ["60"],
          priority: 1,
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
            font: { color: { argb: "FF9C0006" }, bold: true },
          },
        },
      ],
    });

    await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
  }

  // Hidden metadata so the upload knows exactly which class/term/subjects this
  // is — and when it was downloaded, to detect newer data at upload time.
  const metaWs = wb.addWorksheet("Meta");
  metaWs.addRow(["meta", "v1"]);
  metaWs.addRow(["classGroupId", classGroupId]);
  metaWs.addRow(["termId", termId]);
  metaWs.addRow(["downloadedAt", new Date().toISOString()]);
  for (const m of meta) metaWs.addRow(m);
  metaWs.state = "veryHidden";

  const filename = `score-sheets-${classGroup.name}-${term.academicYear.name.replace("/", "-")}-${term.name}.xlsx`
    .replace(/\s+/g, "-");
  return { buffer: await toBuffer(wb), filename };
}

/** Limits what a teacher's upload may touch; admins pass nothing. */
export type ScoreImportRestriction = {
  taughtClassIds: string[];
  classTeacherOf: string[];
  subjectsByClass: Record<string, string[]>;
};

const sameScore = (a: number | null, b: number | null) =>
  (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.05);

const fmtScorePair = (cs: number | null, es: number | null) =>
  cs == null && es == null ? "empty" : `class ${cs ?? "—"} / exam ${es ?? "—"}`;

export async function importScoresFromBuffer(
  buffer: Buffer,
  options?: {
    restrict?: ScoreImportRestriction;
    /** Set after the user explicitly confirms replacing newer data. */
    override?: boolean;
    /** Who is importing — recorded on every saved score. */
    recordedBy?: string;
  }
): Promise<ImportResult> {
  const restrict = options?.restrict;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const metaWs = wb.getWorksheet("Meta");
  if (!metaWs) {
    return {
      ok: false,
      message:
        "This file has no score-sheet information. Download the score sheets from this page, fill them, and upload that same file.",
      details: [],
    };
  }
  let classGroupId = "";
  let termId = "";
  let downloadedAt = new Date(0); // old workbooks without a timestamp: be cautious
  const sheetSubjects: { sheet: string; subjectId: string }[] = [];
  metaWs.eachRow((row) => {
    const key = strVal(row.getCell(1).value);
    if (key === "classGroupId") classGroupId = strVal(row.getCell(2).value);
    if (key === "termId") termId = strVal(row.getCell(2).value);
    if (key === "downloadedAt") {
      const d = new Date(strVal(row.getCell(2).value));
      if (!isNaN(d.getTime())) downloadedAt = d;
    }
    if (key === "subject") {
      sheetSubjects.push({ sheet: strVal(row.getCell(2).value), subjectId: strVal(row.getCell(3).value) });
    }
  });

  const [classGroup, term] = await Promise.all([
    prisma.classGroup.findUnique({ where: { id: classGroupId } }),
    prisma.term.findUnique({ where: { id: termId } }),
  ]);
  if (!classGroup || !term) {
    return { ok: false, message: "The class or term in this file no longer exists.", details: [] };
  }

  if (restrict && !restrict.taughtClassIds.includes(classGroupId)) {
    return {
      ok: false,
      message: `These score sheets are for ${classGroup.name}, which is not assigned to you.`,
      details: [],
    };
  }
  const allowedSubjects =
    !restrict || restrict.classTeacherOf.includes(classGroupId)
      ? null
      : new Set(restrict.subjectsByClass[classGroupId] ?? []);

  const [students, existing] = await Promise.all([
    prisma.student.findMany({ where: { classGroupId } }),
    prisma.score.findMany({ where: { classGroupId, termId } }),
  ]);
  const byAdmission = new Map(students.map((s) => [s.admissionNo.toLowerCase(), s]));
  const existingByKey = new Map(existing.map((s) => [`${s.studentId}|${s.subjectId}`, s]));

  const details: string[] = [];
  const conflicts: string[] = [];
  const writes: {
    studentId: string;
    subjectId: string;
    cw1: number | null;
    cw2: number | null;
    cw3: number | null;
    cw4: number | null;
    classScore: number | null;
    examScore: number | null;
  }[] = [];

  // Pass 1: read every sheet, validate, and detect rows where the system has
  // newer data than this workbook. Nothing is written yet.
  for (const { sheet, subjectId } of sheetSubjects) {
    const ws = wb.getWorksheet(sheet);
    if (!ws) continue;
    if (allowedSubjects && !allowedSubjects.has(subjectId)) {
      details.push(`Sheet "${sheet}" skipped — that subject is not assigned to you.`);
      continue;
    }
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) continue;

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const admissionNo = strVal(row.getCell(1).value);
      if (!admissionNo) continue;
      const student = byAdmission.get(admissionNo.toLowerCase());
      if (!student) {
        details.push(`${sheet} row ${r}: ${admissionNo} is not in ${classGroup.name} — skipped.`);
        continue;
      }

      const cwCells = [3, 4, 5, 6].map((c) => numVal(row.getCell(c).value));
      const cw = cwCells.filter((v): v is number => v != null);
      const exam = numVal(row.getCell(9).value);
      if (cw.length === 0 && exam == null) continue; // nothing entered

      const cwTotal = cw.reduce((a, b) => a + b, 0);
      if (cwTotal > 60) {
        details.push(
          `${sheet} row ${r} (${fullName(student)}): class work total ${cwTotal} is over 60 — skipped.`
        );
        continue;
      }
      if (exam != null && (exam < 0 || exam > 100)) {
        details.push(`${sheet} row ${r} (${fullName(student)}): exam score ${exam} is not 0–100 — skipped.`);
        continue;
      }

      const classScore = cw.length > 0 ? Math.round((cwTotal / 60) * 100 * 100) / 100 : null;
      const prior = existingByKey.get(`${student.id}|${subjectId}`);

      if (prior && sameScore(classScore, prior.classScore) && sameScore(exam, prior.examScore)) {
        continue; // identical to what's saved — nothing to do
      }
      if (prior && prior.updatedAt > downloadedAt) {
        conflicts.push(
          `${subject.name} — ${fullName(student)}: changed by ${prior.recordedBy ?? "someone else"} after this file was downloaded. In the system now: ${fmtScorePair(prior.classScore, prior.examScore)}; in your file: ${fmtScorePair(classScore, exam)}.`
        );
      }
      writes.push({
        studentId: student.id,
        subjectId,
        cw1: cwCells[0],
        cw2: cwCells[1],
        cw3: cwCells[2],
        cw4: cwCells[3],
        classScore,
        examScore: exam,
      });
    }
  }

  if (conflicts.length > 0 && !options?.override) {
    return {
      ok: false,
      needsConfirm: true,
      message: `Nothing was saved: ${conflicts.length} score${conflicts.length === 1 ? " was" : "s were"} updated in the system after this file was downloaded. Review the list, then either download a fresh file or confirm replacing the newer data with your file.`,
      details: conflicts.slice(0, 20),
    };
  }

  // Pass 2: apply.
  for (const w of writes) {
    await prisma.score.upsert({
      where: {
        studentId_subjectId_termId: { studentId: w.studentId, subjectId: w.subjectId, termId },
      },
      update: {
        cw1: w.cw1,
        cw2: w.cw2,
        cw3: w.cw3,
        cw4: w.cw4,
        classScore: w.classScore,
        examScore: w.examScore,
        classGroupId,
        recordedBy: options?.recordedBy ?? null,
      },
      create: {
        studentId: w.studentId,
        subjectId: w.subjectId,
        termId,
        classGroupId,
        cw1: w.cw1,
        cw2: w.cw2,
        cw3: w.cw3,
        cw4: w.cw4,
        classScore: w.classScore,
        examScore: w.examScore,
        recordedBy: options?.recordedBy ?? null,
      },
    });
  }

  return {
    ok: writes.length > 0,
    message:
      writes.length > 0
        ? `${writes.length} score entr${writes.length === 1 ? "y" : "ies"} saved for ${classGroup.name}${
            options?.override && conflicts.length ? " (newer data replaced as you confirmed)" : ""
          }${details.length ? `; ${details.length} row(s) skipped` : ""}. Check the broadsheet under Report Cards.`
        : `No new or changed scores found in the file${details.length ? ` (${details.length} row(s) had problems)` : ""}.`,
    details: details.slice(0, 20),
  };
}

// ====================================================================
// End-of-term attendance totals
// ====================================================================

export async function buildAttendanceTemplate(
  classGroupId: string,
  termId: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  const [classGroup, term, students, existing] = await Promise.all([
    prisma.classGroup.findUnique({ where: { id: classGroupId } }),
    prisma.term.findUnique({ where: { id: termId }, include: { academicYear: true } }),
    prisma.student.findMany({
      where: { classGroupId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.termAttendance.findMany({ where: { classGroupId, termId } }),
  ]);
  if (!classGroup || !term) return null;
  const existingMap = new Map(existing.map((t) => [t.studentId, t]));
  const priorTotal = existing.find((t) => t.daysTotal != null)?.daysTotal ?? null;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");
  ws.columns = [
    { header: "", key: "a", width: 16 },
    { header: "", key: "b", width: 30 },
    { header: "", key: "c", width: 16 },
  ];

  ws.getCell("A1").value = "Total school days this term:";
  ws.getCell("A1").font = { bold: true };
  if (priorTotal != null) ws.getCell("C1").value = priorTotal;
  ws.getCell("C1").border = { bottom: { style: "thin" }, top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  ws.mergeCells("A1:B1");

  const headerRow = ws.getRow(3);
  headerRow.values = ["Admission No.", "Student name", "Days present"];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin" } };
  });
  ws.views = [{ state: "frozen", ySplit: 3 }];

  students.forEach((st, i) => {
    const r = i + 4;
    ws.getCell(r, 1).value = st.admissionNo;
    ws.getCell(r, 2).value = fullName(st);
    const prior = existingMap.get(st.id);
    if (prior?.daysPresent != null) ws.getCell(r, 3).value = prior.daysPresent;
    const cell = ws.getCell(r, 3);
    cell.protection = { locked: false };
    cell.dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      error: "Days present must be a whole number, 0 or more",
    };
  });

  const metaWs = wb.addWorksheet("Meta");
  metaWs.addRow(["meta", "attendance-v1"]);
  metaWs.addRow(["classGroupId", classGroupId]);
  metaWs.addRow(["termId", termId]);
  metaWs.addRow(["downloadedAt", new Date().toISOString()]);
  metaWs.state = "veryHidden";

  const filename = `attendance-${classGroup.name}-${term.academicYear.name.replace("/", "-")}-${term.name}.xlsx`.replace(
    /\s+/g,
    "-"
  );
  return { buffer: await toBuffer(wb), filename };
}

export async function importAttendanceFromBuffer(
  buffer: Buffer,
  options?: { allowedClassIds?: string[]; recordedBy?: string }
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const metaWs = wb.getWorksheet("Meta");
  if (!metaWs) {
    return {
      ok: false,
      message:
        "This file has no attendance template information. Download the attendance template from this page, fill it, and upload that same file.",
      details: [],
    };
  }
  let classGroupId = "";
  let termId = "";
  metaWs.eachRow((row) => {
    const key = strVal(row.getCell(1).value);
    if (key === "classGroupId") classGroupId = strVal(row.getCell(2).value);
    if (key === "termId") termId = strVal(row.getCell(2).value);
  });

  const [classGroup, term] = await Promise.all([
    prisma.classGroup.findUnique({ where: { id: classGroupId } }),
    prisma.term.findUnique({ where: { id: termId } }),
  ]);
  if (!classGroup || !term) {
    return { ok: false, message: "The class or term in this file no longer exists.", details: [] };
  }
  if (options?.allowedClassIds && !options.allowedClassIds.includes(classGroupId)) {
    return {
      ok: false,
      message: `This attendance file is for ${classGroup.name}, which you don't administrate.`,
      details: [],
    };
  }

  const ws = wb.getWorksheet("Attendance") ?? wb.worksheets[0];
  const daysTotal = numVal(ws.getCell("C1").value);

  const students = await prisma.student.findMany({ where: { classGroupId } });
  const byAdmission = new Map(students.map((s) => [s.admissionNo.toLowerCase(), s]));

  let saved = 0;
  const details: string[] = [];

  for (let r = 4; r <= ws.rowCount; r++) {
    const admissionNo = strVal(ws.getCell(r, 1).value);
    if (!admissionNo) continue;
    const student = byAdmission.get(admissionNo.toLowerCase());
    if (!student) {
      details.push(`Row ${r}: ${admissionNo} is not in ${classGroup.name} — skipped.`);
      continue;
    }
    const daysPresent = numVal(ws.getCell(r, 3).value);
    if (daysPresent == null) continue;
    if (daysPresent < 0) {
      details.push(`Row ${r} (${fullName(student)}): days present cannot be negative — skipped.`);
      continue;
    }
    if (daysTotal != null && daysPresent > daysTotal) {
      details.push(
        `Row ${r} (${fullName(student)}): days present ${daysPresent} is more than the ${daysTotal} school days — skipped.`
      );
      continue;
    }
    await prisma.termAttendance.upsert({
      where: { studentId_termId: { studentId: student.id, termId } },
      update: {
        daysPresent: Math.round(daysPresent),
        daysTotal: daysTotal != null ? Math.round(daysTotal) : null,
        classGroupId,
        recordedBy: options?.recordedBy ?? null,
      },
      create: {
        studentId: student.id,
        classGroupId,
        termId,
        daysPresent: Math.round(daysPresent),
        daysTotal: daysTotal != null ? Math.round(daysTotal) : null,
        recordedBy: options?.recordedBy ?? null,
      },
    });
    saved++;
  }

  return {
    ok: saved > 0,
    message:
      saved > 0
        ? `Attendance saved for ${saved} pupil${saved === 1 ? "" : "s"} in ${classGroup.name}${
            daysTotal != null ? ` (out of ${daysTotal} school days)` : ""
          }${details.length ? `; ${details.length} row(s) skipped` : ""}.`
        : `No attendance entries found in the file${details.length ? ` (${details.length} row(s) had problems)` : ""}.`,
    details: details.slice(0, 20),
  };
}
