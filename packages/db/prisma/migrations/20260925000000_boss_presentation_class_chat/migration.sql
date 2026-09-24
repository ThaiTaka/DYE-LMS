-- Review milestones and the class chat.
--
-- `BlockType`               — two new block kinds: MINIGAME_BOSS (the review
--                             fight that closes every fifth session) and
--                             PRESENTATION (the eight-slide summary at every
--                             fifteenth). The seed appends them; no existing
--                             block changes type.
-- `PresentationSubmission`  — one per (student, block). Exactly eight slides,
--                             enforced by the only writer in @dye/core.
-- `ClassMessage`            — the class chat. Every row has already passed the
--                             tutor's moderation filter; a message that fails
--                             it is never inserted.
-- `AiViolationAlert.channel`— where the offending message was typed. Every
--                             existing alert came from the tutor, so the
--                             default back-fills them correctly.
--
-- Additive; no existing row is touched.
--
-- Two `ADD VALUE`s in one migration need PostgreSQL 12+ (the stack pins 16):
-- the values are added inside the migration's transaction and not used in it.

-- CreateEnum
CREATE TYPE "AiViolationChannel" AS ENUM ('TUTOR', 'CLASS_CHAT');

-- AlterEnum
ALTER TYPE "BlockType" ADD VALUE 'MINIGAME_BOSS';
ALTER TYPE "BlockType" ADD VALUE 'PRESENTATION';

-- AlterTable
ALTER TABLE "AiViolationAlert" ADD COLUMN     "channel" "AiViolationChannel" NOT NULL DEFAULT 'TUTOR';

-- CreateTable
CREATE TABLE "PresentationSubmission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "slides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMessage" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresentationSubmission_studentId_createdAt_idx" ON "PresentationSubmission"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "PresentationSubmission_blockId_idx" ON "PresentationSubmission"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationSubmission_studentId_blockId_key" ON "PresentationSubmission"("studentId", "blockId");

-- CreateIndex
CREATE INDEX "ClassMessage_classId_createdAt_idx" ON "ClassMessage"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassMessage_studentId_idx" ON "ClassMessage"("studentId");

-- AddForeignKey
ALTER TABLE "PresentationSubmission" ADD CONSTRAINT "PresentationSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationSubmission" ADD CONSTRAINT "PresentationSubmission_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LessonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMessage" ADD CONSTRAINT "ClassMessage_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMessage" ADD CONSTRAINT "ClassMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
