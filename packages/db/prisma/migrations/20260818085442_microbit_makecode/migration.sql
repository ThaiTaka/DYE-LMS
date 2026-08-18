-- AlterEnum
ALTER TYPE "BlockType" ADD VALUE 'MICROBIT_WORKSPACE';

-- AlterEnum
ALTER TYPE "JudgeMode" ADD VALUE 'MAKECODE';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "blocksXml" TEXT,
ADD COLUMN     "hexKey" TEXT;
