-- CreateEnum
CREATE TYPE "SnapshotReason" AS ENUM ('AUTO', 'SUBMIT', 'RESTORE');

-- CreateTable
CREATE TABLE "CodeDraft" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSnapshot" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "reason" "SnapshotReason" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeDraft_blockId_idx" ON "CodeDraft"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeDraft_studentId_blockId_key" ON "CodeDraft"("studentId", "blockId");

-- CreateIndex
CREATE INDEX "CodeSnapshot_studentId_blockId_createdAt_idx" ON "CodeSnapshot"("studentId", "blockId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSnapshot_studentId_blockId_version_key" ON "CodeSnapshot"("studentId", "blockId", "version");

-- AddForeignKey
ALTER TABLE "CodeDraft" ADD CONSTRAINT "CodeDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeDraft" ADD CONSTRAINT "CodeDraft_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LessonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSnapshot" ADD CONSTRAINT "CodeSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSnapshot" ADD CONSTRAINT "CodeSnapshot_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "LessonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
