/**
 * Focus tracking, against a real database.
 *
 * Two things are actually being protected here, and both are easy to lose in a
 * refactor without any test noticing:
 *
 *   1. A student can only ever log events against THEMSELVES, and the alert
 *      feed is scoped by the same `Class.teacherId → Enrollment → student`
 *      relationship as everything else. An alert about another teacher's child
 *      leaking into this teacher's feed is a privacy failure about a minor.
 *   2. The threshold notifies ONCE per crossing. Without the unique key, a
 *      student on their tenth tab-out sends eight notifications, the teacher
 *      turns the feature off, and the signal is gone.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import {
  canhBaoTapTrung,
  DEDUP_MS,
  ghiNhanSuKienTapTrung,
  NGUONG_CANH_BAO,
  soCanhBaoChuaXuLy,
  tomTatTapTrung,
  xuLyCanhBao,
} from './giam-sat';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let admin: Actor;
let teacherA: Actor;
let teacherB: Actor;
let studentA1: Actor;

beforeAll(async () => {
  fx = await createFixture();
  admin = await actorFor(fx.db, fx.admin);
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  studentA1 = await actorFor(fx.db, fx.studentA1);
});

afterAll(async () => {
  await fx.cleanup();
});

beforeEach(async () => {
  const ids = [fx.studentA1, fx.studentA2, fx.studentB1];
  await fx.db.focusAlert.deleteMany({ where: { studentId: { in: ids } } });
  await fx.db.focusEvent.deleteMany({ where: { studentId: { in: ids } } });
  await fx.db.notification.deleteMany({
    where: { type: 'FOCUS_ALERT', userId: { in: [fx.teacherA, fx.teacherB, fx.admin] } },
  });
});

/**
 * Log `n` tab-outs, spaced past the dedupe window.
 *
 * The spacing is done by back-dating the rows rather than by sleeping: the
 * dedupe compares against the most recent event's `createdAt`, and a test that
 * slept 1.5 s per event would take half a minute to reach a threshold.
 */
async function roiTab(studentId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await ghiNhanSuKienTapTrung(fx.db, studentId, {
      lessonId: fx.lessonId,
      type: 'TAB_HIDDEN',
      awaySeconds: 0,
    });
    await fx.db.focusEvent.updateMany({
      where: { studentId, lessonId: fx.lessonId },
      data: { createdAt: new Date(Date.now() - (DEDUP_MS + 1000) * (n - i)) },
    });
  }
}

describe('Ghi nhận sự kiện tập trung', () => {
  it('ghi lại một lần rời tab', async () => {
    const kq = await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: fx.lessonId,
      type: 'TAB_HIDDEN',
    });

    expect(kq.daGhi).toBe(true);
    expect(kq.soLanRoi).toBe(1);
    expect(kq.canhBaoMoi).toBeNull();
  });

  it('gộp hai sự kiện trùng nhau trong tích tắc thành một', async () => {
    // A single alt-tab fires blur AND visibilitychange in most browsers.
    // Counting it twice would put a student over a threshold of three after
    // leaving the page twice.
    await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: fx.lessonId,
      type: 'TAB_HIDDEN',
    });
    const lai = await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: fx.lessonId,
      type: 'TAB_HIDDEN',
    });

    expect(lai.daGhi).toBe(false);
    expect(lai.soLanRoi).toBe(1);
  });

  it('cắt bớt thời gian vắng phi lý — laptop gập lại qua đêm không phải tra cứu', async () => {
    await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: fx.lessonId,
      type: 'RETURNED',
      awaySeconds: 99_999,
    });

    const row = await fx.db.focusEvent.findFirstOrThrow({
      where: { studentId: fx.studentA1, type: 'RETURNED' },
      select: { awaySeconds: true },
    });
    expect(row.awaySeconds).toBe(30 * 60);
  });

  it('bài học không tồn tại thì im lặng bỏ qua, không ném lỗi', async () => {
    // Called from a visibilitychange handler: an exception there surfaces as a
    // crashed page over a background signal that does not matter.
    const kq = await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: 'khong-co-that',
      type: 'TAB_HIDDEN',
    });
    expect(kq.daGhi).toBe(false);
  });

  it('RETURNED không tính là một lần rời đi', async () => {
    await roiTab(fx.studentA1, 1);
    const kq = await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: fx.lessonId,
      type: 'RETURNED',
      awaySeconds: 30,
    });

    expect(kq.daGhi).toBe(true);
    // Still one departure; the return closed it rather than adding to it.
    expect(kq.soLanRoi).toBe(1);
  });
});

describe('Ngưỡng cảnh báo', () => {
  it(`chưa báo khi còn dưới ${NGUONG_CANH_BAO} lần`, async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO - 1);

    const canhBao = await fx.db.focusAlert.count({ where: { studentId: fx.studentA1 } });
    expect(canhBao).toBe(0);
  });

  it(`báo đúng một lần khi chạm ${NGUONG_CANH_BAO} lần`, async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO);

    const canhBao = await fx.db.focusAlert.findMany({ where: { studentId: fx.studentA1 } });
    expect(canhBao).toHaveLength(1);
    expect(canhBao[0]?.nguong).toBe(NGUONG_CANH_BAO);
    expect(canhBao[0]?.classId).toBe(fx.classA);
  });

  it('không báo lại ở lần thứ 4 và thứ 5 — chỉ báo lại ở bội số tiếp theo', async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO * 2 - 1);
    expect(await fx.db.focusAlert.count({ where: { studentId: fx.studentA1 } })).toBe(1);

    await roiTab(fx.studentA1, 1);
    expect(await fx.db.focusAlert.count({ where: { studentId: fx.studentA1 } })).toBe(2);
  });

  it('báo cho giáo viên phụ trách lớp và cho quản trị viên — KHÔNG báo cho học sinh', async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO);

    const thongBao = await fx.db.notification.findMany({
      where: { type: 'FOCUS_ALERT' },
      select: { userId: true, title: true },
    });

    const nguoiNhan = thongBao.map((t) => t.userId);
    expect(nguoiNhan).toContain(fx.teacherA);
    expect(nguoiNhan).toContain(fx.admin);

    // The teacher of the OTHER class has no relationship with this child.
    expect(nguoiNhan).not.toContain(fx.teacherB);
    // Telling the student turns a prompt for a conversation into an accusation.
    expect(nguoiNhan).not.toContain(fx.studentA1);
  });

  it('nội dung thông báo mời hỏi thăm, không kết tội', async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO);

    const thongBao = await fx.db.notification.findFirstOrThrow({
      where: { type: 'FOCUS_ALERT', userId: fx.teacherA },
      select: { title: true, body: true },
    });

    const chu = `${thongBao.title} ${thongBao.body}`;
    expect(chu).toMatch(/hỏi thăm/i);
    // The system cannot know why, and must not claim to.
    expect(chu).not.toMatch(/gian lận|cheat|vi phạm|quay cóp/i);
  });
});

describe('Phạm vi xem cảnh báo', () => {
  beforeEach(async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO);
  });

  it('giáo viên chỉ thấy cảnh báo của học sinh mình dạy', async () => {
    const cuaA = await canhBaoTapTrung(fx.db, teacherA);
    expect(cuaA.map((c) => c.studentId)).toContain(fx.studentA1);

    // Teacher B teaches a disjoint set of children.
    const cuaB = await canhBaoTapTrung(fx.db, teacherB);
    expect(cuaB.map((c) => c.studentId)).not.toContain(fx.studentA1);
  });

  it('quản trị viên thấy toàn hệ thống', async () => {
    const cua = await canhBaoTapTrung(fx.db, admin);
    expect(cua.map((c) => c.studentId)).toContain(fx.studentA1);
  });

  it('học sinh không được đọc cảnh báo', async () => {
    await expect(canhBaoTapTrung(fx.db, studentA1)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('đếm cảnh báo chưa xử lý theo đúng phạm vi', async () => {
    expect(await soCanhBaoChuaXuLy(fx.db, teacherA)).toBeGreaterThan(0);
    expect(await soCanhBaoChuaXuLy(fx.db, teacherB)).toBe(0);
    // A student never sees a badge at all.
    expect(await soCanhBaoChuaXuLy(fx.db, studentA1)).toBe(0);
  });
});

describe('Xử lý cảnh báo', () => {
  it('ghi lại ai đã xử lý và lúc nào — không xoá bản ghi', async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO);
    const [canhBao] = await canhBaoTapTrung(fx.db, teacherA);

    await xuLyCanhBao(fx.db, teacherA, canhBao!.id, 'ACKNOWLEDGED');

    const sau = await fx.db.focusAlert.findUniqueOrThrow({ where: { id: canhBao!.id } });
    expect(sau.state).toBe('ACKNOWLEDGED');
    expect(sau.reviewedById).toBe(fx.teacherA);
    expect(sau.reviewedAt).not.toBeNull();
  });

  it('giáo viên khác không xử lý được cảnh báo ngoài phạm vi, kể cả khi đoán đúng id', async () => {
    await roiTab(fx.studentA1, NGUONG_CANH_BAO);
    const [canhBao] = await canhBaoTapTrung(fx.db, teacherA);

    await expect(
      xuLyCanhBao(fx.db, teacherB, canhBao!.id, 'DISMISSED'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('Tóm tắt cho trang chi tiết học sinh', () => {
  it('gộp theo buổi và cộng thời gian vắng', async () => {
    await roiTab(fx.studentA1, 2);
    await ghiNhanSuKienTapTrung(fx.db, fx.studentA1, {
      lessonId: fx.lessonId,
      type: 'RETURNED',
      awaySeconds: 45,
    });

    const tom = await tomTatTapTrung(fx.db, fx.studentA1);

    expect(tom.soLanRoi).toBe(2);
    expect(tom.tongVangGiay).toBe(45);
    expect(tom.theoBai).toHaveLength(1);
    expect(tom.theoBai[0]?.soLanRoi).toBe(2);
    expect(tom.theoBai[0]?.tongVangGiay).toBe(45);
  });
});
