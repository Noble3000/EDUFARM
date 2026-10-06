-- AI usage log (§11): every assistant call recorded for safety review and budgets.
CREATE TABLE "AiQueryLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "grounded" BOOLEAN NOT NULL DEFAULT false,
    "refusalCode" TEXT,
    "citationsCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiQueryLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AiQueryLog" ADD CONSTRAINT "AiQueryLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AiQueryLog_studentId_createdAt_idx" ON "AiQueryLog"("studentId", "createdAt");
