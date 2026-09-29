-- CreateTable
CREATE TABLE "GradeSemester" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeSemester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeCourse" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "units" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,

    CONSTRAINT "GradeCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeCourse_semesterId_code_key" ON "GradeCourse"("semesterId", "code");

-- AddForeignKey
ALTER TABLE "GradeSemester" ADD CONSTRAINT "GradeSemester_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeCourse" ADD CONSTRAINT "GradeCourse_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "GradeSemester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
