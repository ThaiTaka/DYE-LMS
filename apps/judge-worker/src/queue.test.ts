/**
 * The queue contract, exercised against a real Redis.
 *
 * These exist because a unit test that only reads the constants would have
 * missed the bug that actually shipped: `HANG_CHAM_BAI` contained a colon, and
 * BullMQ rejects such a name when the Queue is constructed. Nothing caught it
 * until the worker was started for real.
 *
 * ── Do NOT run these with a live worker attached ─────────────────────────────
 * They assert on what is SITTING in the queue. A running `npm run judge:dev`
 * shares this Redis and this queue name, so it consumes each job the moment it
 * is added and the assertions see an empty queue — a failure that looks like a
 * queueing bug and is really just a second consumer. Stop the worker first.
 */
import { CHINH_SACH_THU_LAI, HANG_CHAM_BAI, VIEC_CHAM_BAI, type ViecChamBai } from '@dye/core';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CAU_HINH } from './config';

let hang: Queue<ViecChamBai> | null = null;
let coRedis = false;

function ketNoi() {
  const url = new URL(CAU_HINH.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
    connectTimeout: 2000,
    enableOfflineQueue: false,
  };
}

beforeAll(async () => {
  try {
    hang = new Queue<ViecChamBai>(HANG_CHAM_BAI, { connection: ketNoi() });
    await hang.waitUntilReady();
    coRedis = true;
  } catch {
    throw new Error(
      'Cac test hang doi can Redis that. Chay: docker compose up -d redis',
    );
  }
}, 30_000);

afterAll(async () => {
  if (hang) {
    await hang.obliterate({ force: true }).catch(() => undefined);
    await hang.close();
  }
});

describe('Tên hàng đợi hợp lệ với BullMQ', () => {
  it('không chứa dấu hai chấm', () => {
    // BullMQ builds its keys as `bull:<name>:<id>` and refuses a name with `:`.
    expect(HANG_CHAM_BAI).not.toContain(':');
  });

  it('dựng được Queue thật', () => {
    expect(coRedis).toBe(true);
    expect(hang).not.toBeNull();
  });
});

describe('Xếp hàng', () => {
  it('thêm được việc và đọc lại đúng payload', async () => {
    const job = await hang!.add(VIEC_CHAM_BAI, { submissionId: 'sub-thu-1' }, {
      ...CHINH_SACH_THU_LAI,
      jobId: 'sub-thu-1',
    });

    expect(job.id).toBe('sub-thu-1');
    expect(job.data.submissionId).toBe('sub-thu-1');
  });

  it('cùng một bài nộp không vào hàng hai lần', async () => {
    await hang!.add(VIEC_CHAM_BAI, { submissionId: 'sub-thu-2' }, {
      ...CHINH_SACH_THU_LAI,
      jobId: 'sub-thu-2',
    });
    await hang!.add(VIEC_CHAM_BAI, { submissionId: 'sub-thu-2' }, {
      ...CHINH_SACH_THU_LAI,
      jobId: 'sub-thu-2',
    });

    const cho = await hang!.getWaiting();
    // A double-click must not queue the same attempt twice.
    expect(cho.filter((j) => j.id === 'sub-thu-2')).toHaveLength(1);
  });

  it('payload chỉ mang id, không mang mã nguồn', () => {
    // The queue is a doorbell, not a source of truth: the worker re-reads the
    // row, so a tampered job body cannot change what runs or how it is graded.
    const viec: ViecChamBai = { submissionId: 'x' };
    expect(Object.keys(viec)).toEqual(['submissionId']);
  });

  it('chính sách thử lại có backoff, không quay vòng tức thì', () => {
    expect(CHINH_SACH_THU_LAI.attempts).toBeGreaterThan(1);
    expect(CHINH_SACH_THU_LAI.backoff.type).toBe('exponential');
    expect(CHINH_SACH_THU_LAI.backoff.delay).toBeGreaterThanOrEqual(1000);
  });
});
