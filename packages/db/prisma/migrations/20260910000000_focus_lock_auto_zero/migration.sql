-- Auto-zero lock for repeated tab-outs.
--
-- Adds the artefact a lock leaves behind (FocusLock), the reason column that
-- keeps a voided quiz answer distinguishable from a wrong one, and the
-- notification type the teacher feed reads.
--
-- Nothing here is destructive: every column is additive with a default, so an
-- existing row keeps its current meaning and no student's stored score moves.

-- A lock is either in force or was lifted by someone whose name is on the row.
CREATE TYPE "FocusLockState" AS ENUM ('LOCKED', 'CLEARED');

-- Postgres will not let a new enum value be used in the same transaction that
-- adds it. Prisma runs each migration file in one transaction, so this value is
-- first written by application code in a LATER transaction — which is the case
-- here: nothing in this file inserts a Notification.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOCUS_LOCK';

-- A zero imposed by the system, kept apart from a zero the student earned. A
-- teacher lifting a lock has to be able to tell the two apart.
ALTER TABLE "Answer" ADD COLUMN "khoaViPham" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FocusLock" (
    "id"             TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "lessonId"       TEXT NOT NULL,
    "classId"        TEXT,
    "soLan"          INTEGER NOT NULL,
    "nguong"         INTEGER NOT NULL,
    "soBaiKhongDiem" INTEGER NOT NULL DEFAULT 0,
    "soCauKhongDiem" INTEGER NOT NULL DEFAULT 0,
    "state"          "FocusLockState" NOT NULL DEFAULT 'LOCKED',
    "clearedById"    TEXT,
    "clearedAt"      TIMESTAMP(3),
    "ghiChuMoKhoa"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusLock_pkey" PRIMARY KEY ("id")
);

-- The key that makes khoaBaiViPham idempotent. Without it a looping client
-- mints a fresh zeroed Submission on every call.
CREATE UNIQUE INDEX "FocusLock_studentId_lessonId_key" ON "FocusLock"("studentId", "lessonId");

-- Teacher feed, scoped by class then by recency.
CREATE INDEX "FocusLock_classId_state_createdAt_idx" ON "FocusLock"("classId", "state", "createdAt");
CREATE INDEX "FocusLock_state_createdAt_idx" ON "FocusLock"("state", "createdAt");
CREATE INDEX "FocusLock_studentId_createdAt_idx" ON "FocusLock"("studentId", "createdAt");

ALTER TABLE "FocusLock" ADD CONSTRAINT "FocusLock_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FocusLock" ADD CONSTRAINT "FocusLock_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL, not CASCADE: a class being reorganised must not delete the record
-- of a student having been locked out of a lesson.
ALTER TABLE "FocusLock" ADD CONSTRAINT "FocusLock_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FocusLock" ADD CONSTRAINT "FocusLock_clearedById_fkey"
    FOREIGN KEY ("clearedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
