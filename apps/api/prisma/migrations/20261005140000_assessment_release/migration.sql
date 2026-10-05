-- Assessment release + grading audit (§10.1): scores/feedback visible to
-- students only after the lecturer releases grades; who graded and when
-- is recorded on every attempt.
ALTER TABLE "Assessment" ADD COLUMN "gradesReleased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssessmentAttempt" ADD COLUMN "feedback" TEXT;
ALTER TABLE "AssessmentAttempt" ADD COLUMN "gradedBy" TEXT;
ALTER TABLE "AssessmentAttempt" ADD COLUMN "gradedAt" TIMESTAMP(3);
