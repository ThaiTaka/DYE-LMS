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
// MUST be first: config.ts and PrismaClient both read process.env at import
// time, so the root .env has to be loaded before either is evaluated.
import './env';

import {
  CHINH_SACH_THU_LAI,
  GIOI_HAN_CHAY_THU,
  HANG_CHAM_BAI,
  VIEC_CHAM_BAI,
  VIEC_CHAY_THU,
  type KetQuaChayThu,
  type ViecChamBai,
  type ViecChayThu,
} from '@dye/core';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker, type Job } from 'bullmq';

import { CAU_HINH } from './config';
import { BaiNopKhongTonTai, chamBai } from './judge';
import { ANH_CHAY, chayTrongHop, coDocker } from './sandbox';

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

/**
 * Run a student's code and hand back what it printed. No grading, no database.
 *
 * Every limit here is a constant rather than anything from the job body — see
 * `ViecChayThu` in @dye/core. The payload is the least trusted input the worker
 * takes, because it is the only one that is not re-read from a row.
 *
 * Failure is RETURNED, not thrown. A student pressing "Chạy thử" on code with a
 * syntax error has done nothing wrong, and a thrown job would be retried and
 * then logged as a worker fault. A non-zero exit with a traceback on stderr is
 * the normal, useful outcome of this button.
 */
async function chayThu(viec: ViecChayThu): Promise<KetQuaChayThu> {
  const code = viec.code.slice(0, GIOI_HAN_CHAY_THU.MA_TOI_DA_KY_TU);
  const stdin = (viec.stdin ?? '').slice(0, GIOI_HAN_CHAY_THU.STDIN_TOI_DA_KY_TU);

  const kq = await chayTrongHop({
    tep: { 'main.py': code },
    lenh: ['python', '/sandbox/main.py'],
    stdin,
    timeLimitMs: GIOI_HAN_CHAY_THU.THOI_GIAN_MS,
    memoryLimitMb: GIOI_HAN_CHAY_THU.BO_NHO_MB,
    image: ANH_CHAY['PY_BASE'] ?? 'python:3.12-alpine',
    mang: 'none',
  });

  return {
    ketThuc: kq.ketThuc,
    exitCode: kq.exitCode,
    stdout: kq.stdout,
    stderr: kq.stderr,
    thoiGianMs: kq.thoiGianMs,
    daCatBot: kq.daCatBot,
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

  const worker = new Worker<ViecChamBai | ViecChayThu>(
    HANG_CHAM_BAI,
    async (job: Job<ViecChamBai | ViecChayThu>) => {
      // Two job shapes share one queue so a deployment does not have to grow a
      // second worker process, a second connection and a second set of limits.
      // They are told apart by job NAME, never by inspecting the payload.
      if (job.name === VIEC_CHAY_THU) return chayThu(job.data as ViecChayThu);

      const { submissionId } = (job.data as ViecChamBai);
      const batDau = Date.now();

      let kq;
      try {
        kq = await chamBai(db, submissionId);
      } catch (err) {
        if (err instanceof BaiNopKhongTonTai) {
          // Complete the job rather than rethrowing. The row is gone, so there
          // is nothing a retry could accomplish.
          console.log(`[judge] ${submissionId} khong con ton tai, bo qua viec nay`);
          return null;
        }
        throw err;
      }

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
