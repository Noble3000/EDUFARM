// Seed: demo hierarchy + demo users + sample content (idempotent via upserts).
// Run: pnpm db:seed (DATABASE_URL=local edufarm). Users log in via demo/login with email.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(email: string, name: string, role: never) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role },
  });
}

async function main() {
  const uni = await prisma.university.upsert({
    where: { slug: "demo-university" },
    update: { verified: true },
    create: { name: "Demo University", slug: "demo-university", verified: true },
  });
  let fac = await prisma.faculty.findFirst({ where: { universityId: uni.id, name: "Faculty of Science" } });
  if (!fac) fac = await prisma.faculty.create({ data: { universityId: uni.id, name: "Faculty of Science" } });
  let dept = await prisma.department.findFirst({ where: { facultyId: fac.id, name: "Biological Sciences" } });
  if (!dept) dept = await prisma.department.create({ data: { facultyId: fac.id, name: "Biological Sciences" } });
  let level = await prisma.level.findFirst({ where: { departmentId: dept.id, name: "200" } });
  if (!level) level = await prisma.level.create({ data: { departmentId: dept.id, name: "200" } });
  let course = await prisma.course.findFirst({ where: { departmentId: dept.id, code: "BIO 201" } });
  if (!course) {
    course = await prisma.course.create({
      data: { departmentId: dept.id, levelId: level.id, code: "BIO 201", title: "Cell Biology", isOfficial: true },
    });
  }

  // verified lecturer
  const lectUser = await upsertUser("bello@demo-university.edu", "Dr. A. Bello", "lecturer" as never);
  let lect = await prisma.lecturerProfile.findUnique({ where: { userId: lectUser.id } });
  if (!lect) {
    lect = await prisma.lecturerProfile.create({
      data: { userId: lectUser.id, departmentId: dept.id, staffId: "STAFF-001", bio: "Cell Biology lecturer", verificationStatus: "verified", verifiedAt: new Date() },
    });
  }

  // verified student (approved enrollment)
  const stuUser = await upsertUser("ada@student.demo-university.edu", "Ada Student", "student" as never);
  let stu = await prisma.studentProfile.findUnique({ where: { userId: stuUser.id } });
  if (!stu) {
    stu = await prisma.studentProfile.create({
      data: {
        userId: stuUser.id, universityId: uni.id, facultyId: fac.id, departmentId: dept.id,
        levelId: level.id, matricNo: "STU-042", verificationStatus: "verified", verifiedAt: new Date(),
      },
    });
  }
  await prisma.enrollment.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId: stu.id } },
    update: { status: "approved" },
    create: { courseId: course.id, studentId: stu.id, status: "approved" },
  });

  // pending student (for verification queue demo)
  const pendUser = await upsertUser("pending@student.demo-university.edu", "Pending Student", "student" as never);
  const pend = await prisma.studentProfile.findUnique({ where: { userId: pendUser.id } });
  if (!pend) {
    await prisma.studentProfile.create({
      data: {
        userId: pendUser.id, universityId: uni.id, facultyId: fac.id, departmentId: dept.id,
        levelId: level.id, matricNo: "STU-099", verificationStatus: "pending",
      },
    });
  }

  // platform admin
  await upsertUser("admin@edufarm.ng", "Platform Admin", "platformAdmin" as never);

  // sample published free material
  let mat = await prisma.material.findFirst({ where: { courseId: course.id, title: "Course Outline — Cell Biology" } });
  if (!mat) {
    mat = await prisma.material.create({
      data: {
        courseId: course.id, lecturerId: lect.id, title: "Course Outline — Cell Biology",
        type: "course-pack", description: "Syllabus, schedule, and reading list.", isFree: true, priceKobo: 0,
        status: "published", version: 1,
      },
    });
    await prisma.materialVersion.create({
      data: { materialId: mat.id, version: 1, fileKey: "seed/outline.pdf", checksum: "seed", pageCount: 10 },
    });
  }

  // sample paid material (published)
  let paid = await prisma.material.findFirst({ where: { courseId: course.id, title: "Detailed Lecture Notes — Mitosis" } });
  if (!paid) {
    paid = await prisma.material.create({
      data: {
        courseId: course.id, lecturerId: lect.id, title: "Detailed Lecture Notes — Mitosis",
        type: "lecture-notes", description: "Full mitosis notes with diagrams.", isFree: false,
        priceKobo: 50000, accessDurationDays: 90, status: "published", version: 1,
      },
    });
    await prisma.materialVersion.create({
      data: { materialId: paid.id, version: 1, fileKey: "seed/mitosis.pdf", checksum: "seed", pageCount: 10 },
    });
  }

  // sample announcement + question
  const annCount = await prisma.announcement.count({ where: { courseId: course.id } });
  if (!annCount) {
    await prisma.announcement.create({
      data: { courseId: course.id, lecturerId: lect.id, category: "course-notice", title: "Welcome to BIO 201", body: "First lecture holds Monday 10am, Hall B. Read the course outline.", isUrgent: false },
    });
  }
  const qCount = await prisma.question.count({ where: { courseId: course.id } });
  if (!qCount) {
    const q = await prisma.question.create({
      data: { courseId: course.id, authorId: stuUser.id, title: "Why does crossing over matter?", body: "I want to understand its role in variation.", status: "answered" },
    });
    await prisma.answer.create({
      data: { questionId: q.id, authorId: lectUser.id, isLecturer: true, body: "It exchanges segments between homologous chromosomes, creating new combinations." },
    });
  }

  console.log("Seeded:", uni.slug, course.code, "| users: bello, ada, pending, admin");
}

main().finally(() => prisma.$disconnect());
