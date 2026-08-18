/**
 * The judge worker process.
 *
 * Consumes `PENDING` submissions from Redis and judges them in isolated
 * containers. Runs as its own process so a runaway container cannot take the web
 * app down with it, and so judging capacity can be scaled independently of page
 * traffic.
 *
 * ── The orphan sweep ─────────────────────────────────────────────────────────
 * The web app enqueues after writing the submission row. If Redis is briefly
 * unreachable at that moment, the row exists and no job does — a student's work
 * would sit at PENDING forever with nothing to notice.
 *
 * So the queue is treated as an optimisation, not as the source of truth. A
 * periodic sweep re-enqueues any submission that has been PENDING longer than a
 * grace period. The database is what says work exists; Redis only says it is
 * urgent.
 */
import { CHINH_SACH_THU_LAI, HANG_CHAM_BAI, VIEC_CHAM_BAI, type ViecChamBai } from '@dye/core';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker, type Job } from 'bullmq';

import { CAU_HINH } from './config';
import { chamBai } from './judge';
import { coDocker } from './sandbox';

const db = new PrismaClient({ log: ['error', 'warn'] });

function ketNoiRedis() {
  const url = new URL(CAU_HINH.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
    // BullMQ requires this; without it a blocked command can retry forever.
    maxRetriesPerRequest: null,
  };
}

async function main(): Promise<void> {
  if (!(await coDocker())) {
    // Refuse to start rather than accept jobs and fail every one of them: a
    // worker that marks every submission INTERNAL_ERROR is worse than no worker,
    // because the rows look judged.
    console.error(
      '[judge] Khong ket noi duoc Docker daemon.\n' +
        'Worker can Docker de chay code trong container cach ly. Kiem tra Docker dang chay.',
    );
    process.exit(1);
  }

  const connection = ketNoiRedis();
  const hang = new Queue<ViecChamBai>(HANG_CHAM_BAI, { connection });

  const worker = new Worker<ViecChamBai>(
    HANG_CHAM_BAI,
    async (job: Job<ViecChamBai>) => {
      const { submissionId } = job.data;
      const batDau = Date.now();

      const kq = await chamBai(db, submissionId);

      console.log(
        `[judge] ${submissionId} → ${kq.verdict} ` +
          `(${kq.passedTests}/${kq.totalTests}, ${Date.now() - batDau}ms)`,
      );
      return kq;
    },
    { connection, concurrency: CAU_HINH.soViecSongSong },
  );

  worker.on('failed', (job, err) => {
    // The row is left at RUNNING deliberately: BullMQ will retry, and a
    // submission stuck at RUNNING is visible evidence that something is wrong.
    console.error(`[judge] viec ${job?.id} that bai:`, err.message);
  });

  const quet = setInterval(() => {
    void quetBaiBoSot(db, hang);
  }, CAU_HINH.quetOrphanMs);

  const dong = async (tinHieu: string): Promise<void> => {
    console.log(`[judge] nhan ${tinHieu}, dang dong...`);
    clearInterval(quet);
    // `close()` waits for in-flight jobs, so a container being judged is not
    // abandoned mid-run.
    await worker.close();
    await hang.close();
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void dong('SIGTERM'));
  process.on('SIGINT', () => void dong('SIGINT'));

  console.log(
    `[judge] san sang · ${CAU_HINH.soViecSongSong} viec song song · hang "${HANG_CHAM_BAI}"`,
  );
  await quetBaiBoSot(db, hang);
}

/** Re-enqueue submissions that never made it onto the queue. */
export async function quetBaiBoSot(db: PrismaClient, hang: Queue<ViecChamBai>): Promise<number> {
  // The grace period keeps the sweep from racing a job that was enqueued
  // moments ago and is simply waiting its turn.
  const truoc = new Date(Date.now() - 2 * 60 * 1000);

  const boSot = await db.submission.findMany({
    where: { verdict: 'PENDING', createdAt: { lt: truoc } },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  for (const s of boSot) {
    await hang.add(
      VIEC_CHAM_BAI,
      { submissionId: s.id },
      // Deduplicated by job id: a submission already queued is not queued twice.
      { ...CHINH_SACH_THU_LAI, jobId: `sweep-${s.id}` },
    );
  }

  if (boSot.length > 0) {
    console.log(`[judge] quet lai ${boSot.length} bai nop bi bo sot`);
  }
  return boSot.length;
}

main().catch((err: unknown) => {
  console.error('[judge] khong khoi dong duoc:', err);
  process.exit(1);
});
