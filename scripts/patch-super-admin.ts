// One-time patch: adds SchoolConfig row + superadmin user to an existing database.
// Safe to run multiple times (uses upsert).
// Run with:  npx tsx scripts/patch-super-admin.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const cfg = await prisma.schoolConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, enabledLevels: "KG,PRIMARY,JHS" },
  });
  console.log("SchoolConfig:", cfg.enabledLevels, "(features all on)");

  const user = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      passwordHash: bcrypt.hashSync("super123", 10),
      name: "System Administrator",
      role: "SUPER_ADMIN",
    },
  });
  console.log("Super Admin user:", user.username, "(password: super123)");

  // Upsert the three Creche classes (safe — uses unique name constraint).
  const crecheClasses: [string, string, number][] = [
    ["Creche", "CRECHE", -3],
    ["Nursery 1", "CRECHE", -2],
    ["Nursery 2", "CRECHE", -1],
  ];
  for (const [name, stage, level] of crecheClasses) {
    await prisma.classGroup.upsert({
      where: { name },
      update: { stage, level },
      create: { name, stage, level },
    });
  }
  console.log("Creche classes added (Creche, Nursery 1, Nursery 2)");
  console.log("\nDone. Log in with superadmin / super123 and change the password.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
