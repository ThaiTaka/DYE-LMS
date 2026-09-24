-- The tutor's moderation lock, the alert that explains it, and one missing
-- index on Submission.
--
-- `User.isAiLocked`     — Bí refuses this user until a teacher lifts it. Only
--                         the moderation trap sets it, only on students.
-- `AiViolationAlert`    — the message that caused the lock, what it was judged
--                         to be and by which check, and who lifted it.
-- `Submission(studentId, lessonId)` — the integrity lock reads and deletes
--                         submissions by student + lesson; no index served it.
--
-- `LessonProgress` / `BlockProgress` already carry @@unique on
-- (studentId, lessonId) / (studentId, blockId), which Postgres backs with a
-- unique index — a second, non-unique copy would only slow every write.
--
-- Additive; no row loses data. Every existing user starts unlocked.

-- CreateEnum
CREATE TYPE "AiViolationType" AS ENUM ('PROFANITY', 'INSULT', 'NSFW');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAiLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiViolationAlert" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "violationType" "AiViolationType" NOT NULL,
    "detectedBy" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiViolationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiViolationAlert_resolved_createdAt_idx" ON "AiViolationAlert"("resolved", "createdAt");

-- CreateIndex
CREATE INDEX "AiViolationAlert_studentId_resolved_idx" ON "AiViolationAlert"("studentId", "resolved");

-- CreateIndex
CREATE INDEX "Submission_studentId_lessonId_idx" ON "Submission"("studentId", "lessonId");

-- AddForeignKey
ALTER TABLE "AiViolationAlert" ADD CONSTRAINT "AiViolationAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiViolationAlert" ADD CONSTRAINT "AiViolationAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
