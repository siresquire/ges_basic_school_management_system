// Exports every table to a single JSON file in ./backups/.
// Run regularly (e.g. end of every week/term):  npm run db:backup
// Works against whichever database DATABASE_URL points at (local SQLite or Supabase).
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  const data = {
    exportedAt: new Date().toISOString(),
    schoolInfo: await prisma.schoolInfo.findMany(),
    users: await prisma.user.findMany(),
    teachers: await prisma.teacher.findMany(),
    classGroups: await prisma.classGroup.findMany(),
    students: await prisma.student.findMany(),
    academicYears: await prisma.academicYear.findMany(),
    terms: await prisma.term.findMany(),
    subjects: await prisma.subject.findMany(),
    subjectAssignments: await prisma.subjectAssignment.findMany(),
    scores: await prisma.score.findMany(),
    attendanceRecords: await prisma.attendanceRecord.findMany(),
    feeItems: await prisma.feeItem.findMany(),
    payments: await prisma.payment.findMany(),
    timetableSlots: await prisma.timetableSlot.findMany(),
  };

  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 1));

  const counts = Object.entries(data)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}: ${(v as unknown[]).length}`)
    .join(", ");
  console.log(`Backup saved to ${file}`);
  console.log(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
