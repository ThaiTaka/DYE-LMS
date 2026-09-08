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
import {
  CHINH_SACH_CHAY_THU,
  CHINH_SACH_THU_LAI,
  GIOI_HAN_CHAY_THU,
  HANG_CHAM_BAI,
  VIEC_CHAM_BAI,
  VIEC_CHAY_THU,
  type KetQuaChayThu,
  type ViecChamBai,
  type ViecChayThu,
} from '@dye/core';
import { Queue } from 'bullmq';

let hang: Queue<ViecChamBai | ViecChayThu> | null = null;

function moHang(): Queue<ViecChamBai | ViecChayThu> {
  if (hang) return hang;

  const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6389');
  hang = new Queue<ViecChamBai | ViecChayThu>(HANG_CHAM_BAI, {
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

/**
 * Run code in the sandbox and wait for what it printed.
 *
 * ── Why this one waits, when judging does not ────────────────────────────────
 * `xepHangChamBai` rings a doorbell and returns: the row is already safe and the
 * student gets their verdict when it is ready. A run has no row and no later
 * moment to deliver into — the student pressed a button and is watching the
 * spot where the output goes. So this call holds the request open until the
 * worker answers or the budget runs out.
 *
 * ── Polling rather than waitUntilFinished ────────────────────────────────────
 * BullMQ's `waitUntilFinished` needs a `QueueEvents` instance, which opens a
 * second Redis connection per call and subscribes to a stream. In a serverless
 * request that is a connection leak waiting to happen. Polling a job by id costs
 * one round trip per tick against a connection that is already open.
 *
 * Never throws. Redis being down is not the student's problem to read as a
 * stack trace, and the editor renders whatever `loi` says instead.
 */
export async function chayThuTrongSandbox(
  code: string,
  stdin: string,
): Promise<{ ok: true; ketQua: KetQuaChayThu } | { ok: false; loi: string }> {
  // A run is anonymous by design — nothing keys off the student — so the id has
  // to be unique per press, or BullMQ would dedupe two presses into one job and
  // the second would read the first's output.
  const jobId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let job;
  try {
    job = await moHang().add(
      VIEC_CHAY_THU,
      {
        code: code.slice(0, GIOI_HAN_CHAY_THU.MA_TOI_DA_KY_TU),
        stdin: stdin.slice(0, GIOI_HAN_CHAY_THU.STDIN_TOI_DA_KY_TU),
      },
      { ...CHINH_SACH_CHAY_THU, jobId },
    );
  } catch (error) {
    console.error('[judge-queue] khong xep hang chay thu duoc:', error);
    return { ok: false, loi: 'Chưa gửi được bài chạy. Em thử lại sau một chút nhé.' };
  }

  const han = Date.now() + GIOI_HAN_CHAY_THU.CHO_KET_QUA_MS;
  while (Date.now() < han) {
    await new Promise((r) => setTimeout(r, 250));

    let trangThai: string;
    try {
      trangThai = await job.getState();
    } catch {
      continue;
    }

    if (trangThai === 'completed') {
      const xong = await moHang().getJob(jobId);
      const kq = xong?.returnvalue as KetQuaChayThu | undefined;
      if (kq) return { ok: true, ketQua: kq };
      return { ok: false, loi: 'Chạy xong nhưng không đọc được kết quả. Em thử lại nhé.' };
    }

    if (trangThai === 'failed') {
      return { ok: false, loi: 'Sandbox không chạy được đoạn này. Thầy cô sẽ được báo.' };
    }
  }

  // Almost always means no worker is consuming the queue, not that the code is
  // slow: the sandbox kills a run at its own time limit well inside this budget.
  return {
    ok: false,
    loi: 'Chờ hơi lâu mà chưa có kết quả. Có thể máy chấm đang bận — em thử lại nhé.',
  };
}
