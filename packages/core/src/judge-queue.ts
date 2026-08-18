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
