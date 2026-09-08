/**
 * The contract between the web app and the judge worker.
 *
 * Deliberately holds NO queue library. `@dye/core` is imported by the Next.js
 * app, and pulling BullMQ (and therefore ioredis) into that bundle graph to
 * share three constants would be a poor trade. Both sides import the names from
 * here and construct their own Queue / Worker.
 */

/**
 * BullMQ queue name. Changing it strands every job already enqueued.
 *
 * No colon: BullMQ builds its own Redis keys as `bull:<name>:<id>` and rejects a
 * name containing `:` at construction time.
 */
export const HANG_CHAM_BAI = 'dye-cham-bai';

/** Job name inside that queue. */
export const VIEC_CHAM_BAI = 'cham-mot-bai';

/**
 * Job payload.
 *
 * Carries the submission id and nothing else. The worker re-reads the row and
 * the problem from the database, so a stale or tampered job body cannot change
 * what gets executed or how it is graded — the queue is a doorbell, not a
 * source of truth.
 */
export interface ViecChamBai {
  submissionId: string;
}

/** Retry policy. Judging is idempotent, so a retry is safe. */
export const CHINH_SACH_THU_LAI = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

// ═══════════════════════════════════════════════════════════════════════════
// "Chạy thử" — run the editor's code and show its output, without grading
// ═══════════════════════════════════════════════════════════════════════════

/** Job name for a plain run. Shares the queue with grading. */
export const VIEC_CHAY_THU = 'chay-thu';

/**
 * Run payload.
 *
 * This one BREAKS the doorbell rule above, and the difference matters enough to
 * write down. A grading job names a `Submission` row, so the worker re-reads
 * everything and a tampered body changes nothing. A run has no row — the code
 * being run is what the student is typing right now — so the code has to travel
 * in the job itself.
 *
 * The invariant is preserved a different way: the payload carries ONLY the code
 * and its stdin. Every limit — time, memory, image, network — is a constant the
 * worker applies itself and never reads from here. So the worst a forged job can
 * do is run its own code inside the same sandbox any student already gets, which
 * is the thing the sandbox was built to contain.
 */
export interface ViecChayThu {
  code: string;
  stdin: string;
}

/** What the worker returns for a run. */
export interface KetQuaChayThu {
  ketThuc: 'binh-thuong' | 'het-gio' | 'het-bo-nho' | 'qua-nhieu-dau-ra' | 'khong-chay-duoc';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  thoiGianMs: number;
  daCatBot: boolean;
}

/**
 * Ceilings for a run, applied by the worker regardless of the payload.
 *
 * Tighter than grading on purpose. A run is triggered by a keystroke rather than
 * by a deliberate submit, so it is the cheapest way for a page to ask the server
 * for a container — the budget is sized for "did my loop print what I expected",
 * not for a performance exercise.
 */
export const GIOI_HAN_CHAY_THU = {
  MA_TOI_DA_KY_TU: 20_000,
  STDIN_TOI_DA_KY_TU: 4_000,
  THOI_GIAN_MS: 5_000,
  BO_NHO_MB: 128,
  /** How long the web request waits for a worker before giving up. */
  CHO_KET_QUA_MS: 20_000,
} as const;

/**
 * Run retry policy: none.
 *
 * Judging retries because it is idempotent and nobody is watching. A student IS
 * watching this one, and a retry would hand them a second container for the same
 * press while they still stare at a spinner. Results are kept only minutes —
 * long enough for the waiting request to read them, not as a record.
 */
export const CHINH_SACH_CHAY_THU = {
  attempts: 1,
  removeOnComplete: { age: 300, count: 200 },
  removeOnFail: { age: 300, count: 200 },
};
