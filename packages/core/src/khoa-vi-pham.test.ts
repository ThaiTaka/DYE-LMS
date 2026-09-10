/**
 * The auto-zero lock, against a real database.
 *
 * Four properties are being protected, and every one of them is the kind that a
 * refactor breaks silently while every other test stays green:
 *
 *   1. THE THRESHOLD IS THE SERVER'S. A request to lock is refused unless the
 *      server's OWN count of FocusEvent rows has reached it. Lose this and the
 *      lock becomes a button any student can press on themselves — and the next
 *      change to the signature is the one that accepts a studentId too.
 *   2. IT IS IDEMPOTENT. Calling twice must not zero the lesson twice. Lose this
 *      and a retry fills a child's attempt history with rows no teacher can read.
 *   3. IT BLOCKS THE WRITE PATHS. `moKhoiCode` is the single gate every code
 *      action passes through; if the lock is only in the UI it is decoration,
 *      because the server action is reachable from a console.
 *   4. IT IS REVERSIBLE, EXACTLY. Unlocking restores the scores it voided and
 *      touches nothing else — in particular it must never delete a submission
 *      the student actually made.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { moKhoiCode } from './code';
import { ForbiddenError } from './errors';
import {
  biKhoaViPham,
  danhSachKhoa,
  demSoLanRoi,
  khoaBaiViPham,
  khoaHienTai,
  moKhoaViPham,
  NGUONG_CANH_BAO_NANG,
  NGUONG_KHOA,
} from './khoa-vi-pham';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let studentA1: Actor;

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  studentA1 = await actorFor(fx.db, fx.studentA1);
});

afterAll(async () => {
  await fx.cleanup();
});

beforeEach(async () => {
  await fx.db.focusLock.deleteMany({ where: { studentId: { in: [fx.studentA1] } } });
  await fx.db.focusEvent.deleteMany({ where: { studentId: { in: [fx.studentA1] } } });
  await fx.db.submission.deleteMany({
    where: { studentId: fx.studentA1, runnerError: { startsWith: 'focus-lock:' } },
  });
});

/** Post `n` genuine tab-outs, bypassing the dedupe window the action applies. */
async function roiTab(n: number): Promise<void> {
  const now = Date.now();
  await fx.db.focusEvent.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      studentId: fx.studentA1,
      lessonId: fx.lessonId,
      type: 'TAB_HIDDEN' as const,
      awaySeconds: 5,
      // Spread across time so nothing here looks like one alt-tab double-counted.
      createdAt: new Date(now - (n - i) * 10_000),
    })),
  });
}

describe('ngưỡng', () => {
  it('cảnh báo nặng đứng dưới ngưỡng khoá, và cách nó một khoảng đáng kể', () => {
    // If these ever met, a student would be locked by the same event that first
    // warned them — the warning exists precisely to be actionable.
    expect(NGUONG_CANH_BAO_NANG).toBeLessThan(NGUONG_KHOA);
    expect(NGUONG_KHOA - NGUONG_CANH_BAO_NANG).toBeGreaterThanOrEqual(10);
  });

  it('chỉ đếm sự kiện RỜI ĐI, không đếm lượt quay lại', async () => {
    await roiTab(3);
    await fx.db.focusEvent.create({
      data: {
        studentId: fx.studentA1,
        lessonId: fx.lessonId,
        type: 'RETURNED',
        awaySeconds: 30,
      },
    });

    // A RETURNED row closes a departure; counting it would double every trip.
    expect(await demSoLanRoi(fx.db, fx.studentA1, fx.lessonId)).toBe(3);
  });
});

describe('máy chủ tự đếm, không tin trình duyệt', () => {
  it('từ chối khoá khi số lần thật chưa tới ngưỡng', async () => {
    await roiTab(NGUONG_KHOA - 1);

    const kq = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    expect(kq.daKhoa).toBe(false);
    expect(kq.dangKhoa).toBe(false);
    expect(kq.lyDoTuChoi).toBe('chua-du-nguong');
    expect(await khoaHienTai(fx.db, fx.studentA1, fx.lessonId)).toBeNull();
  });

  it('từ chối khoá khi chưa có sự kiện nào', async () => {
    const kq = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);
    expect(kq.daKhoa).toBe(false);
    expect(kq.soLan).toBe(0);
  });

  it('khoá khi số lần thật đạt ngưỡng', async () => {
    await roiTab(NGUONG_KHOA);

    const kq = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    expect(kq.daKhoa).toBe(true);
    expect(kq.dangKhoa).toBe(true);
    expect(kq.soLan).toBe(NGUONG_KHOA);

    const khoa = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    expect(khoa?.state).toBe('LOCKED');
    // The threshold is stored, not re-read, so changing the constant later
    // cannot rewrite why an old lock was applied.
    expect(khoa?.nguong).toBe(NGUONG_KHOA);
  });
});

describe('bất biến khi gọi lại', () => {
  it('gọi hai lần chỉ tạo một khoá và một lần trừ điểm', async () => {
    await roiTab(NGUONG_KHOA);

    const lan1 = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);
    const lan2 = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    expect(lan1.daKhoa).toBe(true);
    // The second call reports the lock without creating anything.
    expect(lan2.daKhoa).toBe(false);
    expect(lan2.dangKhoa).toBe(true);

    const soKhoa = await fx.db.focusLock.count({
      where: { studentId: fx.studentA1, lessonId: fx.lessonId },
    });
    expect(soKhoa).toBe(1);

    const soBai = await fx.db.submission.count({
      where: { studentId: fx.studentA1, runnerError: { startsWith: 'focus-lock:' } },
    });
    expect(soBai).toBe(lan1.soBaiKhongDiem);
  });

  it('mười lần gọi song song vẫn chỉ ra một khoá', async () => {
    await roiTab(NGUONG_KHOA);

    await Promise.all(
      Array.from({ length: 10 }, () => khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId)),
    );

    const soKhoa = await fx.db.focusLock.count({
      where: { studentId: fx.studentA1, lessonId: fx.lessonId },
    });
    expect(soKhoa).toBe(1);
  });
});

describe('bài đã nộp mang đúng phán quyết', () => {
  it('mọi bài do khoá sinh ra đều là WRONG_ANSWER, 0 điểm, có dấu vết', async () => {
    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId, { blockId: undefined });

    const rows = await fx.db.submission.findMany({
      where: { studentId: fx.studentA1, runnerError: { startsWith: 'focus-lock:' } },
      select: { verdict: true, score: true, judgedAt: true, runnerError: true },
    });

    for (const r of rows) {
      expect(r.verdict).toBe('WRONG_ANSWER');
      expect(r.score).toBe(0);
      // Judged, not queued: no worker is ever going to pick these up.
      expect(r.judgedAt).not.toBeNull();
      // The marker is what makes the unlock able to delete exactly these rows
      // and never a real attempt.
      expect(r.runnerError).toContain('focus-lock:');
    }
  });
});

describe('khoá chặn được đường ghi, không chỉ giao diện', () => {
  it('moKhoiCode từ chối khi bài đang bị khoá', async () => {
    const block = await fx.db.lessonBlock.findFirst({
      where: { lessonId: fx.lessonId, problemId: { not: null } },
      select: { id: true },
    });
    if (!block) return; // Seeded lesson has no code block; nothing to assert.

    // Reachable before the lock…
    await expect(moKhoiCode(fx.db, fx.studentA1, block.id)).resolves.toBeTruthy();

    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    // …and refused after it. This is the check that makes the lock real: the
    // server action is reachable from a devtools console whatever the UI shows.
    await expect(moKhoiCode(fx.db, fx.studentA1, block.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('biKhoaViPham chỉ đúng với đúng học sinh và đúng bài', async () => {
    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    expect(await biKhoaViPham(fx.db, fx.studentA1, fx.lessonId)).toBe(true);
    // A lock is about one child. It must never spill onto a classmate.
    expect(await biKhoaViPham(fx.db, fx.studentA2, fx.lessonId)).toBe(false);
  });
});

describe('phạm vi của giáo viên', () => {
  it('giáo viên khác lớp không thấy và không mở được khoá', async () => {
    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    const khoa = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    expect(khoa).not.toBeNull();

    const cuaA = await danhSachKhoa(fx.db, teacherA, { gioiHan: 100 });
    const cuaB = await danhSachKhoa(fx.db, teacherB, { gioiHan: 100 });

    expect(cuaA.some((k) => k.id === khoa?.id)).toBe(true);
    expect(cuaB.some((k) => k.id === khoa?.id)).toBe(false);

    // Guessing the id is not enough: the unlock re-reads through the same scope.
    await expect(moKhoaViPham(fx.db, teacherB, khoa!.id, 'thử vượt quyền')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('học sinh không đọc được danh sách khoá', async () => {
    await expect(danhSachKhoa(fx.db, studentA1)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('mở khoá trả lại đúng những gì đã lấy đi', () => {
  it('xoá bài 0 điểm do khoá sinh ra và mở lại đường nộp', async () => {
    await roiTab(NGUONG_KHOA);
    const daKhoa = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    const khoa = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    const kq = await moKhoaViPham(fx.db, teacherA, khoa!.id, 'Em đang tra cứu, đã hỏi em rồi.');

    expect(kq.soBaiHoanLai).toBe(daKhoa.soBaiKhongDiem);
    expect(await biKhoaViPham(fx.db, fx.studentA1, fx.lessonId)).toBe(false);

    const conLai = await fx.db.submission.count({
      where: { studentId: fx.studentA1, runnerError: { startsWith: 'focus-lock:' } },
    });
    expect(conLai).toBe(0);

    const sau = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    expect(sau?.state).toBe('CLEARED');
    // Recorded, not erased: a zero that appeared for a reason and vanished for
    // none is the shape a parent asks about and nobody can answer.
    expect(sau?.nguoiMoKhoa).toBeTruthy();
    expect(sau?.ghiChuMoKhoa).toContain('tra cứu');
  });

  it('không đụng vào bài học sinh thật sự đã nộp', async () => {
    const that = await fx.db.submission.create({
      data: {
        studentId: fx.studentA1,
        problemId: fx.problemId,
        lessonId: fx.lessonId,
        code: 'print("bài thật của em")',
        verdict: 'WRONG_ANSWER',
        score: 0,
        attemptNo: 99,
      },
      select: { id: true },
    });

    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);
    const khoa = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    await moKhoaViPham(fx.db, teacherA, khoa!.id, 'Nhầm, mở lại cho em.');

    /*
     * The one that must not be caught in the sweep.
     *
     * It has the same verdict and the same score as the rows the lock created;
     * the ONLY thing separating them is the `focus-lock:` marker, which is why
     * the delete is scoped on it rather than on verdict and score.
     */
    const van = await fx.db.submission.findUnique({ where: { id: that.id } });
    expect(van, 'bài thật của học sinh bị xoá nhầm khi mở khoá').not.toBeNull();

    await fx.db.submission.delete({ where: { id: that.id } });
  });

  it('ghi nhật ký cả lúc khoá lẫn lúc mở', async () => {
    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);
    const khoa = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    await moKhoaViPham(fx.db, teacherA, khoa!.id, 'Đã hỏi em, cho làm lại.');

    const nhatKy = await fx.db.auditLog.findMany({
      where: {
        action: { in: ['focus.lock_applied', 'focus.lock_cleared'] },
        OR: [{ actorId: fx.studentA1 }, { actorId: fx.teacherA }],
      },
      select: { action: true },
    });

    expect(nhatKy.map((n) => n.action)).toEqual(
      expect.arrayContaining(['focus.lock_applied', 'focus.lock_cleared']),
    );
  });

  it('khoá lại được sau khi đã mở, và là một khoá mới', async () => {
    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);
    const dau = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    await moKhoaViPham(fx.db, teacherA, dau!.id, 'Mở lần một.');

    await roiTab(NGUONG_KHOA);
    const lai = await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    expect(lai.daKhoa).toBe(true);
    const sau = await khoaHienTai(fx.db, fx.studentA1, fx.lessonId);
    expect(sau?.state).toBe('LOCKED');
    // The old teacher's note described a decision about different events.
    expect(sau?.ghiChuMoKhoa).toBeNull();
    expect(sau?.nguoiMoKhoa).toBeNull();
  });
});

describe('thông báo', () => {
  it('báo cho giáo viên phụ trách, không bao giờ báo cho học sinh', async () => {
    await roiTab(NGUONG_KHOA);
    await khoaBaiViPham(fx.db, fx.studentA1, fx.lessonId);

    const tb = await fx.db.notification.findMany({
      where: { type: 'FOCUS_LOCK' },
      select: { userId: true },
    });

    const nguoiNhan = tb.map((t) => t.userId);
    expect(nguoiNhan).toContain(fx.teacherA);
    // Telling a child "we have flagged you" turns a conversation into an
    // accusation before any adult has asked a question.
    expect(nguoiNhan).not.toContain(fx.studentA1);
  });
});
