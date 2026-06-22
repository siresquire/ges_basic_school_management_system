// Bulk credential generation for staff, students, and parents.
// Each function creates User records for those without logins,
// stores the plain-text temp password, and returns an Excel buffer.
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const PW_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function genPassword(): string {
  let pw = "";
  while (pw.length < 8) pw += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
  return pw;
}

function uniqueUsername(base: string, taken: Set<string>): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  if (!taken.has(clean)) { taken.add(clean); return clean; }
  let n = 2;
  while (taken.has(`${clean}${n}`)) n++;
  const un = `${clean}${n}`;
  taken.add(un);
  return un;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD1FAE5" },
};

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin" } };
  });
}

// ── Staff ──────────────────────────────────────────────────────────────────

export async function bulkGenerateStaffLogins(): Promise<Buffer> {
  const existing = await prisma.user.findMany({ select: { username: true } });
  const taken = new Set(existing.map((u) => u.username));

  const teachers = await prisma.teacher.findMany({
    where: { userId: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows: { staffId: string; name: string; phone: string; username: string; password: string }[] = [];

  for (const t of teachers) {
    const base = t.staffId ?? `${t.firstName}${t.lastName}`;
    const username = uniqueUsername(base, taken);
    const password = genPassword();

    const user = await prisma.user.create({
      data: {
        username,
        name: `${t.firstName} ${t.lastName}`,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "TEACHER",
        tempPassword: password,
      },
    });
    await prisma.teacher.update({ where: { id: t.id }, data: { userId: user.id } });

    rows.push({
      staffId: t.staffId ?? "—",
      name: `${t.firstName} ${t.lastName}`,
      phone: t.phone ?? "—",
      username,
      password,
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Staff Logins");
  ws.columns = [
    { header: "Staff ID", key: "staffId", width: 14 },
    { header: "Full Name", key: "name", width: 30 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Username", key: "username", width: 22 },
    { header: "Password", key: "password", width: 14 },
  ];
  styleHeader(ws);
  rows.forEach((r) => ws.addRow(r));
  if (rows.length === 0) {
    ws.addRow({ staffId: "—", name: "No new accounts to create", phone: "—", username: "—", password: "—" });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Students ───────────────────────────────────────────────────────────────

export async function bulkGenerateStudentLogins(): Promise<Buffer> {
  const existing = await prisma.user.findMany({ select: { username: true } });
  const taken = new Set(existing.map((u) => u.username));

  const students = await prisma.student.findMany({
    where: { userId: null, status: "ACTIVE" },
    include: { classGroup: { select: { name: true } } },
    orderBy: [{ classGroup: { level: "asc" } }, { lastName: "asc" }],
  });

  const rows: { admissionNo: string; name: string; className: string; username: string; password: string }[] = [];

  for (const s of students) {
    const username = uniqueUsername(s.admissionNo, taken);
    const password = genPassword();

    const user = await prisma.user.create({
      data: {
        username,
        name: `${s.lastName} ${s.firstName}${s.otherNames ? " " + s.otherNames : ""}`,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "STUDENT",
        tempPassword: password,
      },
    });
    await prisma.student.update({ where: { id: s.id }, data: { userId: user.id } });

    rows.push({
      admissionNo: s.admissionNo,
      name: `${s.lastName} ${s.firstName}${s.otherNames ? " " + s.otherNames : ""}`,
      className: s.classGroup?.name ?? "—",
      username,
      password,
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Student Logins");
  ws.columns = [
    { header: "Admission No", key: "admissionNo", width: 16 },
    { header: "Full Name", key: "name", width: 30 },
    { header: "Class", key: "className", width: 14 },
    { header: "Username", key: "username", width: 22 },
    { header: "Password", key: "password", width: 14 },
  ];
  styleHeader(ws);
  rows.forEach((r) => ws.addRow(r));
  if (rows.length === 0) {
    ws.addRow({ admissionNo: "—", name: "No new accounts to create", className: "—", username: "—", password: "—" });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Parents ────────────────────────────────────────────────────────────────

export async function bulkGenerateParentLogins(): Promise<Buffer> {
  const existing = await prisma.user.findMany({ select: { username: true } });
  const taken = new Set(existing.map((u) => u.username));

  const students = await prisma.student.findMany({
    where: { parentUserId: null, status: "ACTIVE", guardianName: { not: null } },
    orderBy: [{ lastName: "asc" }],
  });

  const rows: {
    guardianName: string;
    studentName: string;
    admissionNo: string;
    phone: string;
    username: string;
    password: string;
  }[] = [];

  for (const s of students) {
    const guardianName = s.guardianName!;
    const username = uniqueUsername(`parent${s.admissionNo}`, taken);
    const password = genPassword();

    const user = await prisma.user.create({
      data: {
        username,
        name: guardianName,
        passwordHash: bcrypt.hashSync(password, 10),
        role: "PARENT",
        tempPassword: password,
      },
    });
    await prisma.student.update({ where: { id: s.id }, data: { parentUserId: user.id } });

    rows.push({
      guardianName,
      studentName: `${s.lastName} ${s.firstName}${s.otherNames ? " " + s.otherNames : ""}`,
      admissionNo: s.admissionNo,
      phone: s.guardianPhone ?? "—",
      username,
      password,
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Parent Logins");
  ws.columns = [
    { header: "Guardian Name", key: "guardianName", width: 28 },
    { header: "Student Name", key: "studentName", width: 28 },
    { header: "Admission No", key: "admissionNo", width: 16 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Username", key: "username", width: 22 },
    { header: "Password", key: "password", width: 14 },
  ];
  styleHeader(ws);
  rows.forEach((r) => ws.addRow(r));
  if (rows.length === 0) {
    ws.addRow({ guardianName: "—", studentName: "No new accounts to create", admissionNo: "—", phone: "—", username: "—", password: "—" });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── Export current temp passwords (all users who still have one set) ─────────

export async function exportCurrentStaffPasswords(): Promise<Buffer> {
  const teachers = await prisma.teacher.findMany({
    where: { user: { tempPassword: { not: null } } },
    include: { user: { select: { username: true, tempPassword: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Staff Passwords");
  ws.columns = [
    { header: "Staff ID", key: "staffId", width: 14 },
    { header: "Full Name", key: "name", width: 30 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Username", key: "username", width: 22 },
    { header: "Temp Password", key: "password", width: 16 },
  ];
  styleHeader(ws);
  if (teachers.length === 0) {
    ws.addRow({ staffId: "—", name: "No temp passwords currently set", phone: "—", username: "—", password: "—" });
  } else {
    teachers.forEach((t) =>
      ws.addRow({
        staffId: t.staffId ?? "—",
        name: `${t.firstName} ${t.lastName}`,
        phone: t.phone ?? "—",
        username: t.user!.username,
        password: t.user!.tempPassword!,
      })
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportCurrentStudentPasswords(): Promise<Buffer> {
  const students = await prisma.student.findMany({
    where: { user: { tempPassword: { not: null } } },
    include: {
      classGroup: { select: { name: true } },
      user: { select: { username: true, tempPassword: true } },
    },
    orderBy: [{ classGroup: { level: "asc" } }, { lastName: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Student Passwords");
  ws.columns = [
    { header: "Admission No", key: "admissionNo", width: 16 },
    { header: "Full Name", key: "name", width: 30 },
    { header: "Class", key: "className", width: 14 },
    { header: "Username", key: "username", width: 22 },
    { header: "Temp Password", key: "password", width: 16 },
  ];
  styleHeader(ws);
  if (students.length === 0) {
    ws.addRow({ admissionNo: "—", name: "No temp passwords currently set", className: "—", username: "—", password: "—" });
  } else {
    students.forEach((s) =>
      ws.addRow({
        admissionNo: s.admissionNo,
        name: `${s.lastName} ${s.firstName}${s.otherNames ? " " + s.otherNames : ""}`,
        className: s.classGroup?.name ?? "—",
        username: s.user!.username,
        password: s.user!.tempPassword!,
      })
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportCurrentParentPasswords(): Promise<Buffer> {
  const students = await prisma.student.findMany({
    where: { parentUser: { tempPassword: { not: null } } },
    include: {
      parentUser: { select: { username: true, name: true, tempPassword: true } },
    },
    orderBy: [{ lastName: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Parent Passwords");
  ws.columns = [
    { header: "Guardian Name", key: "guardianName", width: 28 },
    { header: "Student Name", key: "studentName", width: 28 },
    { header: "Admission No", key: "admissionNo", width: 16 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Username", key: "username", width: 22 },
    { header: "Temp Password", key: "password", width: 16 },
  ];
  styleHeader(ws);
  if (students.length === 0) {
    ws.addRow({ guardianName: "—", studentName: "No temp passwords currently set", admissionNo: "—", phone: "—", username: "—", password: "—" });
  } else {
    students.forEach((s) =>
      ws.addRow({
        guardianName: s.parentUser!.name,
        studentName: `${s.lastName} ${s.firstName}${s.otherNames ? " " + s.otherNames : ""}`,
        admissionNo: s.admissionNo,
        phone: s.guardianPhone ?? "—",
        username: s.parentUser!.username,
        password: s.parentUser!.tempPassword!,
      })
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
