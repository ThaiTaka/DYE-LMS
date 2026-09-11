-- Milestone exams ("Bài kiểm tra lớn") with the strike-based soft lockdown.
--
-- Additive only. No existing table changes shape; the one enum extension
-- (NotificationType) is a new value, not a rename.

CREATE TYPE "ExamAttemptState" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'LOCKED_CHEATING', 'VOIDED');
CREATE TYPE "ExamStrikeKind"   AS ENUM ('FULLSCREEN_EXIT', 'TAB_HIDDEN', 'WINDOW_BLUR');

-- Used only by application code in later transactions; nothing in this file
-- inserts a Notification, which is what lets Postgres accept the ADD VALUE
-- inside the migration's transaction.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXAM_LOCKED';

CREATE TABLE "Exam" (
    "id"               TEXT NOT NULL,
    "slug"             TEXT NOT NULL,
    "courseId"         TEXT NOT NULL,
    "quizId"           TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "afterLessonOrder" INTEGER NOT NULL,
    "durationMinutes"  INTEGER NOT NULL,
    "passingScore"     INTEGER NOT NULL DEFAULT 60,
    "maxStrikes"       INTEGER NOT NULL DEFAULT 2,
    "isPublished"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Exam_slug_key" ON "Exam"("slug");
CREATE UNIQUE INDEX "Exam_courseId_afterLessonOrder_key" ON "Exam"("courseId", "afterLessonOrder");
CREATE INDEX "Exam_courseId_isPublished_idx" ON "Exam"("courseId", "isPublished");

ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT, not CASCADE: deleting a question bank must not silently delete
-- the exams (and every student's results) that were built on it.
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ExamAttempt" (
    "id"           TEXT NOT NULL,
    "examId"       TEXT NOT NULL,
    "studentId"    TEXT NOT NULL,
    "attemptNo"    INTEGER NOT NULL DEFAULT 1,
    "state"        "ExamAttemptState" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt"   TIMESTAMP(3) NOT NULL,
    "submittedAt"  TIMESTAMP(3),
    "answers"      JSONB NOT NULL DEFAULT '{}',
    "score"        INTEGER NOT NULL DEFAULT 0,
    "maxScore"     INTEGER NOT NULL DEFAULT 0,
    "isPassed"     BOOLEAN NOT NULL DEFAULT false,
    "cheatStrikes" INTEGER NOT NULL DEFAULT 0,
    "lockedAt"     TIMESTAMP(3),
    "lockReason"   TEXT,
    "voidedById"   TEXT,
    "voidedAt"     TIMESTAMP(3),
    "voidNote"     TEXT,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamAttempt_examId_studentId_attemptNo_key" ON "ExamAttempt"("examId", "studentId", "attemptNo");
CREATE INDEX "ExamAttempt_studentId_state_idx" ON "ExamAttempt"("studentId", "state");
CREATE INDEX "ExamAttempt_examId_state_startedAt_idx" ON "ExamAttempt"("examId", "state", "startedAt");

ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExamStrike" (
    "id"        TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "kind"      "ExamStrikeKind" NOT NULL,
    "strikeNo"  INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamStrike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamStrike_attemptId_createdAt_idx" ON "ExamStrike"("attemptId", "createdAt");

ALTER TABLE "ExamStrike" ADD CONSTRAINT "ExamStrike_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
