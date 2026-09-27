-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'quiz',
    "instructions" TEXT,
    "timeLimitMin" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'mcq',
    "options" TEXT[],
    "correctIndex" INTEGER,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in-progress',
    "score" INTEGER,
    "maxScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedIndex" INTEGER,
    "body" TEXT,
    "isCorrect" BOOLEAN,
    "marksAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_assessmentId_studentId_attemptNo_key" ON "AssessmentAttempt"("assessmentId", "studentId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_attemptId_questionId_key" ON "AssessmentAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
