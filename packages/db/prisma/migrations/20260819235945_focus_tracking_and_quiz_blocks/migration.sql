-- CreateEnum
CREATE TYPE "FocusEventType" AS ENUM ('TAB_HIDDEN', 'WINDOW_BLUR', 'RETURNED', 'PASTE_BURST');

-- CreateEnum
CREATE TYPE "FocusAlertState" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BlockType" ADD VALUE 'MULTIPLE_CHOICE';
ALTER TYPE "BlockType" ADD VALUE 'FILL_IN_BLANK';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FOCUS_ALERT';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "hint" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "template" TEXT;

-- CreateTable
CREATE TABLE "FocusEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockId" TEXT,
    "type" "FocusEventType" NOT NULL,
    "awaySeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusAlert" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "classId" TEXT,
    "soLan" INTEGER NOT NULL,
    "nguong" INTEGER NOT NULL,
    "totalAwaySeconds" INTEGER NOT NULL DEFAULT 0,
    "state" "FocusAlertState" NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusEvent_studentId_lessonId_createdAt_idx" ON "FocusEvent"("studentId", "lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "FocusEvent_lessonId_createdAt_idx" ON "FocusEvent"("lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "FocusEvent_createdAt_idx" ON "FocusEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FocusAlert_classId_state_createdAt_idx" ON "FocusAlert"("classId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "FocusAlert_state_createdAt_idx" ON "FocusAlert"("state", "createdAt");

-- CreateIndex
CREATE INDEX "FocusAlert_studentId_createdAt_idx" ON "FocusAlert"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FocusAlert_studentId_lessonId_nguong_key" ON "FocusAlert"("studentId", "lessonId", "nguong");

-- AddForeignKey
ALTER TABLE "FocusEvent" ADD CONSTRAINT "FocusEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusEvent" ADD CONSTRAINT "FocusEvent_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusAlert" ADD CONSTRAINT "FocusAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusAlert" ADD CONSTRAINT "FocusAlert_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusAlert" ADD CONSTRAINT "FocusAlert_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusAlert" ADD CONSTRAINT "FocusAlert_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
