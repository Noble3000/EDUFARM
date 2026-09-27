// Seed: 1 demo university → faculty → department → level → course (UNILAG example).
// Run: pnpm db:seed (after migrate). Uses local Postgres only.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const uni = await prisma.university.upsert({
    where: { slug: "demo-university" },
    update: {},
    create: { name: "Demo University", slug: "demo-university", verified: true },
  });
  const fac = await prisma.faculty.create({
    data: { universityId: uni.id, name: "Faculty of Science" },
  });
  const dept = await prisma.department.create({
    data: { facultyId: fac.id, name: "Biological Sciences" },
  });
  const level = await prisma.level.create({
    data: { departmentId: dept.id, name: "200" },
  });
  await prisma.course.create({
    data: {
      departmentId: dept.id,
      levelId: level.id,
      code: "BIO 201",
      title: "Cell Biology",
      isOfficial: true,
    },
  });
  console.log("Seeded demo hierarchy:", uni.slug);
}

main().finally(() => prisma.$disconnect());
