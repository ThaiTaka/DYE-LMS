import 'server-only';

/**
 * Enqueueing a submission for judging.
 *
 * ── Failure here must not lose a student's work ──────────────────────────────
 * The `Submission` row is written first, by `nopBai` in @dye/core. This function
 * only rings the doorbell. If Redis is down, the row still exists at PENDING and
 * the worker's periodic sweep picks it up — so a queue outage delays judging
 * rather than discarding an attempt.
 *
 * That is why this never throws: a student who pressed "Nộp bài" has done their
 * part, and an infrastructure problem is not something to report to them as a
 * failure of their submission.
 */
import { CHINH_SACH_THU_LAI, HANG_CHAM_BAI, VIEC_CHAM_BAI, type ViecChamBai } from '@dye/core';
import { Queue } from 'bullmq';

let hang: Queue<ViecChamBai> | null = null;

function moHang(): Queue<ViecChamBai> {
  if (hang) return hang;

  const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6389');
  hang = new Queue<ViecChamBai>(HANG_CHAM_BAI, {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      ...(url.password ? { password: url.password } : {}),
      maxRetriesPerRequest: null,
      // The request that enqueues is on a student's critical path, so it fails
      // fast rather than holding the response open while Redis is unreachable.
      connectTimeout: 2000,
      enableOfflineQueue: false,
    },
  });
  return hang;
}

export async function xepHangChamBai(submissionId: string): Promise<{ daXepHang: boolean }> {
  try {
    await moHang().add(
      VIEC_CHAM_BAI,
      { submissionId },
      // Job id derived from the submission: a double-click cannot queue the
      // same attempt twice.
      { ...CHINH_SACH_THU_LAI, jobId: `sub-${submissionId}` },
    );
    return { daXepHang: true };
  } catch (error) {
    // Logged for operations, invisible to the student. The sweep is the
    // safety net, and it is tested.
    console.error('[judge-queue] khong xep hang duoc, se doi quet lai:', error);
    return { daXepHang: false };
  }
}
