// Seeds the database with the school structure (classes, subjects, terms)
// plus demo logins and sample data so every screen has something to show.
// Run with:  npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hashSync(pw, 10);

const CLASSES: [string, string, number][] = [
  // Creche level (disabled by default — Super Admin can enable per school)
  ["Creche", "CRECHE", -3],
  ["Nursery 1", "CRECHE", -2],
  ["Nursery 2", "CRECHE", -1],
  // KG / Primary / JHS
  ["KG 1", "KG", 0],
  ["KG 2", "KG", 1],
  ["Basic 1", "PRIMARY", 2],
  ["Basic 2", "PRIMARY", 3],
  ["Basic 3", "PRIMARY", 4],
  ["Basic 4", "PRIMARY", 5],
  ["Basic 5", "PRIMARY", 6],
  ["Basic 6", "PRIMARY", 7],
  ["JHS 1", "JHS", 8],
  ["JHS 2", "JHS", 9],
  ["JHS 3", "JHS", 10],
];

// GES standard-based curriculum subjects and the stages they are taught at.
const SUBJECTS: [string, string][] = [
  ["Language & Literacy", "KG"],
  ["Numeracy", "KG"],
  ["English Language", "PRIMARY,JHS"],
  ["Mathematics", "PRIMARY,JHS"],
  ["Science", "PRIMARY,JHS"],
  ["Ghanaian Language (Asante Twi)", "KG,PRIMARY,JHS"],
  ["Our World Our People", "KG,PRIMARY"],
  ["Religious & Moral Education", "PRIMARY,JHS"],
  ["History", "PRIMARY"],
  ["Creative Arts", "KG,PRIMARY"],
  ["Computing", "PRIMARY,JHS"],
  ["Physical Education", "PRIMARY,JHS"],
  ["Social Studies", "JHS"],
  ["Career Technology", "JHS"],
  ["Creative Arts & Design", "JHS"],
  ["French", "JHS"],
];

const P5_STUDENTS: [string, string, string][] = [
  ["Abena", "Owusu", "F"],
  ["Kwame", "Asante", "M"],
  ["Akosua", "Mensah", "F"],
  ["Yaw", "Boakye", "M"],
  ["Adwoa", "Sarpong", "F"],
  ["Kofi", "Agyemang", "M"],
  ["Ama", "Acheampong", "F"],
  ["Kwabena", "Osei", "M"],
];

const JHS1_STUDENTS: [string, string, string][] = [
  ["Esi", "Appiah", "F"],
  ["Kwaku", "Frimpong", "M"],
  ["Afia", "Antwi", "F"],
  ["Yaa", "Darko", "F"],
];

async function main() {
  console.log("Seeding database…");

  // Safety: never seed into a database that's already in use — the school may
  // have renamed classes (e.g. Basic 1A/1B streams) and re-seeding would
  // re-create the default list alongside them.
  const existingClasses = await prisma.classGroup.count();
  if (existingClasses > 0) {
    console.log("Database already contains classes — seeding skipped.");
    console.log("(db:seed is only for a fresh, empty database.)");
    return;
  }

  await prisma.schoolInfo.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Atwima Kwanwoma M/A Basic School",
      address: "Atwima Kwanwoma Municipality, Ashanti Region, Ghana",
      phone: "024 000 0000",
      motto: "Knowledge is Light",
      headTeacherName: "",
    },
  });

  // Default config: CRECHE is seeded but disabled — most schools don't have a creche.
  // Super Admin can enable it from /super-admin.
  await prisma.schoolConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, enabledLevels: "KG,PRIMARY,JHS" },
  });

  // ----- Academic structure -----
  const classMap = new Map<string, string>();
  for (const [name, stage, level] of CLASSES) {
    const c = await prisma.classGroup.upsert({
      where: { name },
      update: { stage, level },
      create: { name, stage, level },
    });
    classMap.set(name, c.id);
  }

  const subjectMap = new Map<string, string>();
  for (const [name, stages] of SUBJECTS) {
    const s = await prisma.subject.upsert({
      where: { name },
      update: { stages },
      create: { name, stages },
    });
    subjectMap.set(name, s.id);
  }

  // ----- Grading scales (same defaults for both sections; editable in Settings) -----
  const DEFAULT_BANDS: [number, string, string][] = [
    [80, "A", "Excellent"],
    [70, "B", "Very Good"],
    [60, "C", "Good"],
    [50, "D", "Credit"],
    [40, "E", "Pass"],
    [0, "F", "Fail"],
  ];
  for (const section of ["PRIMARY", "JHS"]) {
    for (const [minScore, grade, remark] of DEFAULT_BANDS) {
      await prisma.gradeBand.create({ data: { section, minScore, grade, remark } });
    }
  }

  const year = await prisma.academicYear.upsert({
    where: { name: "2025/2026" },
    update: {},
    create: { name: "2025/2026" },
  });

  const termData = [
    { name: "Term 1", startDate: new Date("2025-09-08"), endDate: new Date("2025-12-18"), nextTermBegins: new Date("2026-01-08"), isCurrent: false },
    { name: "Term 2", startDate: new Date("2026-01-08"), endDate: new Date("2026-04-02"), nextTermBegins: new Date("2026-05-05"), isCurrent: false },
    { name: "Term 3", startDate: new Date("2026-05-05"), endDate: new Date("2026-07-30"), nextTermBegins: new Date("2026-09-08"), isCurrent: true },
  ];
  const termMap = new Map<string, string>();
  for (const t of termData) {
    const term = await prisma.term.upsert({
      where: { academicYearId_name: { academicYearId: year.id, name: t.name } },
      update: { ...t, academicYearId: year.id },
      create: { ...t, academicYearId: year.id },
    });
    termMap.set(t.name, term.id);
  }
  const currentTermId = termMap.get("Term 3")!;

  // ----- Users & teachers -----
  // Super Admin — system-level account for deployment/configuration.
  // Change this password immediately after the first deployment.
  await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      passwordHash: hash("super123"),
      name: "System Administrator",
      role: "SUPER_ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: hash("admin123"),
      name: "School Administrator",
      role: "ADMIN",
    },
  });

  async function createTeacher(
    username: string,
    firstName: string,
    lastName: string,
    gender: string,
    phone: string,
    staffId: string
  ) {
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        passwordHash: hash("teacher123"),
        name: `${firstName} ${lastName}`,
        role: "TEACHER",
      },
    });
    return prisma.teacher.upsert({
      where: { staffId },
      update: {},
      create: { userId: user.id, staffId, firstName, lastName, gender, phone },
    });
  }

  const teacher1 = await createTeacher("teacher1", "Akosua", "Boateng", "F", "024 111 1111", "STF-001");
  const teacher2 = await createTeacher("teacher2", "Kwame", "Owusu", "M", "024 222 2222", "STF-002");

  await prisma.classGroup.update({
    where: { name: "Basic 5" },
    data: { classTeacherId: teacher1.id },
  });
  await prisma.classGroup.update({
    where: { name: "JHS 1" },
    data: { classTeacherId: teacher2.id },
  });

  const p5Id = classMap.get("Basic 5")!;
  const jhs1Id = classMap.get("JHS 1")!;

  const assign = async (teacherId: string, subjectName: string, classGroupId: string) => {
    const subjectId = subjectMap.get(subjectName)!;
    await prisma.subjectAssignment.upsert({
      where: { teacherId_subjectId_classGroupId: { teacherId, subjectId, classGroupId } },
      update: {},
      create: { teacherId, subjectId, classGroupId },
    });
  };
  for (const s of ["English Language", "Mathematics", "Science"]) await assign(teacher1.id, s, p5Id);
  for (const s of ["English Language", "Mathematics", "Social Studies"]) await assign(teacher2.id, s, jhs1Id);

  // ----- Students -----
  let admission = 1;
  const studentIds: { id: string; classId: string; index: number }[] = [];

  async function createStudent(
    [firstName, lastName, gender]: [string, string, string],
    classId: string,
    index: number
  ) {
    const admissionNo = `AKW-${String(admission++).padStart(4, "0")}`;
    const student = await prisma.student.upsert({
      where: { admissionNo },
      update: {},
      create: {
        admissionNo,
        firstName,
        lastName,
        gender,
        classGroupId: classId,
        guardianName: `Mr/Mrs ${lastName}`,
        guardianPhone: `024 ${String(300 + index).padStart(3, "0")} ${String(1000 + index * 7).slice(0, 4)}`,
        address: "Atwima Kwanwoma, Ashanti Region",
      },
    });
    studentIds.push({ id: student.id, classId, index });
    return student;
  }

  const p5Students = [];
  for (let i = 0; i < P5_STUDENTS.length; i++) p5Students.push(await createStudent(P5_STUDENTS[i], p5Id, i));
  const jhs1Students = [];
  for (let i = 0; i < JHS1_STUDENTS.length; i++) jhs1Students.push(await createStudent(JHS1_STUDENTS[i], jhs1Id, i + 8));

  // Demo portal logins: one student account, one parent account with two children.
  const studentUser = await prisma.user.upsert({
    where: { username: "student1" },
    update: {},
    create: {
      username: "student1",
      passwordHash: hash("student123"),
      name: `${JHS1_STUDENTS[0][0]} ${JHS1_STUDENTS[0][1]}`,
      role: "STUDENT",
    },
  });
  await prisma.student.update({ where: { id: jhs1Students[0].id }, data: { userId: studentUser.id } });

  const parentUser = await prisma.user.upsert({
    where: { username: "parent1" },
    update: {},
    create: {
      username: "parent1",
      passwordHash: hash("parent123"),
      name: "Mr Owusu (Parent)",
      role: "PARENT",
    },
  });
  await prisma.student.update({ where: { id: p5Students[0].id }, data: { parentUserId: parentUser.id } });
  await prisma.student.update({ where: { id: p5Students[1].id }, data: { parentUserId: parentUser.id } });

  // ----- Sample scores (Term 3) -----
  const primarySubjects = SUBJECTS.filter(([, st]) => st.includes("PRIMARY")).map(([n]) => n);
  const jhsSubjects = SUBJECTS.filter(([, st]) => st.includes("JHS")).map(([n]) => n);

  // Deterministic pseudo-random scores so re-seeding is stable.
  const score = (a: number, b: number) => 35 + ((a * 17 + b * 31) % 60);

  async function seedScores(students: { id: string }[], classId: string, subjects: string[]) {
    for (let si = 0; si < students.length; si++) {
      for (let bi = 0; bi < subjects.length; bi++) {
        const subjectId = subjectMap.get(subjects[bi])!;
        await prisma.score.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId: students[si].id,
              subjectId,
              termId: currentTermId,
            },
          },
          update: {},
          create: {
            studentId: students[si].id,
            subjectId,
            termId: currentTermId,
            classGroupId: classId,
            classScore: score(si + 1, bi + 2),
            examScore: score(si + 3, bi + 5),
          },
        });
      }
    }
  }
  await seedScores(p5Students, p5Id, primarySubjects);
  await seedScores(jhs1Students, jhs1Id, jhsSubjects.filter((s) => s !== "French"));

  // ----- Sample attendance (recent school days) -----
  const dates = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-08", "2026-06-09", "2026-06-10"];
  for (const { id, classId, index } of studentIds) {
    for (let di = 0; di < dates.length; di++) {
      const roll = (index * 13 + di * 7) % 20;
      const status = roll === 0 ? "ABSENT" : roll === 1 ? "LATE" : "PRESENT";
      const date = new Date(`${dates[di]}T00:00:00.000Z`);
      await prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: id, date } },
        update: {},
        create: { studentId: id, classGroupId: classId, termId: currentTermId, date, status },
      });
    }
  }

  // ----- Fees (Term 3) -----
  const existingFees = await prisma.feeItem.count({ where: { termId: currentTermId } });
  if (existingFees === 0) {
    await prisma.feeItem.createMany({
      data: [
        { name: "PTA Levy", amount: 30, termId: currentTermId },
        { name: "Examination Fee", amount: 20, termId: currentTermId },
        { name: "ICT Levy", amount: 10, termId: currentTermId },
        { name: "Mock Examination Fee", amount: 25, termId: currentTermId, classGroupId: classMap.get("JHS 3")! },
      ],
    });
  }

  const existingPayments = await prisma.payment.count();
  if (existingPayments === 0) {
    const payments = [
      { student: p5Students[0], amount: 60, method: "MOMO", reference: "MM-7781234" },
      { student: p5Students[1], amount: 30, method: "CASH", reference: null },
      { student: jhs1Students[0], amount: 60, method: "CASH", reference: null },
    ];
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      await prisma.payment.create({
        data: {
          receiptNo: `RCP-${String(i + 1).padStart(5, "0")}`,
          studentId: p.student.id,
          termId: currentTermId,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          receivedBy: "School Administrator",
          paidAt: new Date("2026-05-15T09:00:00.000Z"),
        },
      });
    }
  }

  // ----- Sample timetable for Basic 5 (Monday) -----
  const p5Monday: [number, string | null, string | null][] = [
    [1, "English Language", null],
    [2, "Mathematics", null],
    [3, null, "Break"],
    [4, "Science", null],
    [5, "Ghanaian Language (Asante Twi)", null],
    [6, null, "Lunch"],
    [7, "Our World Our People", null],
    [8, "Physical Education", null],
  ];
  for (const [period, subjectName, label] of p5Monday) {
    await prisma.timetableSlot.upsert({
      where: { classGroupId_dayOfWeek_period: { classGroupId: p5Id, dayOfWeek: 1, period } },
      update: {},
      create: {
        classGroupId: p5Id,
        dayOfWeek: 1,
        period,
        subjectId: subjectName ? subjectMap.get(subjectName)! : null,
        teacherId: subjectName && ["English Language", "Mathematics", "Science"].includes(subjectName) ? teacher1.id : null,
        label,
      },
    });
  }

  console.log("Done. Demo logins:");
  console.log("  superadmin / super123    (super admin — change immediately)");
  console.log("  admin      / admin123    (administrator)");
  console.log("  teacher1   / teacher123  (class teacher, Basic 5)");
  console.log("  teacher2   / teacher123  (class teacher, JHS 1)");
  console.log("  student1   / student123  (student, JHS 1)");
  console.log("  parent1    / parent123   (parent of two Basic 5 pupils)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
