/**
 * The tutor's moderation lock, against a real database.
 *
 * What would break silently:
 *
 *   1. THE LOCK AND ITS REASON LAND TOGETHER. A flag with no alert behind it is
 *      a punishment no teacher can see or explain.
 *   2. ONLY STUDENTS ARE LOCKED. Nobody sits above a teacher to lift one.
 *   3. ONLY THEIR TEACHER CAN LIFT IT — and never the student themself, whom
 *      `authorize(student: manage)` would otherwise admit for their own id.
 *   4. THE FEED IS SCOPED like every other teacher view.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';
import {
  biKhoaTroLy,
  canhBaoTroLy,
  khoaTroLyViPham,
  moKhoaTroLy,
  soCanhBaoTroLyChuaXuLy,
} from './tro-ly-vi-pham';

import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let admin: Actor;
let studentA1: Actor;

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  admin = await actorFor(fx.db, fx.admin);
  studentA1 = await actorFor(fx.db, fx.studentA1);
});

afterAll(async () => {
  await fx.cleanup();
});

beforeEach(async () => {
  const ids = [fx.studentA1, fx.studentA2, fx.studentB1, fx.teacherA];
  await fx.db.aiViolationAlert.deleteMany({ where: { studentId: { in: ids } } });
  await fx.db.user.updateMany({ where: { id: { in: ids } }, data: { isAiLocked: false } });
});

const VI_PHAM = { noiDung: 'đm bài này', loai: 'PROFANITY', nguon: 'tu-khoa' } as const;

describe('khoaTroLyViPham', () => {
  it('khoá và ghi cảnh báo cùng lúc', async () => {
    const { alertId } = await khoaTroLyViPham(fx.db, fx.studentA1, VI_PHAM);

    expect(await biKhoaTroLy(fx.db, fx.studentA1)).toBe(true);
    const alert = await fx.db.aiViolationAlert.findUniqueOrThrow({ where: { id: alertId } });
    expect(alert).toMatchObject({
      studentId: fx.studentA1,
      promptText: 'đm bài này',
      violationType: 'PROFANITY',
      detectedBy: 'tu-khoa',
      resolved: false,
    });
  });

  it('không khoá tài khoản giáo viên — và không để lại cảnh báo mồ côi', async () => {
    await expect(khoaTroLyViPham(fx.db, fx.teacherA, VI_PHAM)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await biKhoaTroLy(fx.db, fx.teacherA)).toBe(false);
    expect(await fx.db.aiViolationAlert.count({ where: { studentId: fx.teacherA } })).toBe(0);
  });

  it('nội dung quá dài được cắt, không làm hỏng việc khoá', async () => {
    const { alertId } = await khoaTroLyViPham(fx.db, fx.studentA1, {
      ...VI_PHAM,
      noiDung: 'x'.repeat(5000),
    });
    const alert = await fx.db.aiViolationAlert.findUniqueOrThrow({ where: { id: alertId } });
    expect(alert.promptText).toHaveLength(2000);
  });
});

describe('phạm vi xem cảnh báo', () => {
  beforeEach(async () => {
    await khoaTroLyViPham(fx.db, fx.studentA1, VI_PHAM);
    await khoaTroLyViPham(fx.db, fx.studentB1, { ...VI_PHAM, loai: 'NSFW', nguon: 'mo-hinh' });
  });

  it('giáo viên chỉ thấy học sinh mình dạy', async () => {
    const a = await canhBaoTroLy(fx.db, teacherA);
    expect(a.map((c) => c.studentId)).toEqual([fx.studentA1]);
    expect(a[0]).toMatchObject({ conKhoa: true, daXuLy: false, nguon: 'tu-khoa' });

    const b = await canhBaoTroLy(fx.db, teacherB);
    expect(b.map((c) => c.studentId)).toEqual([fx.studentB1]);
  });

  it('quản trị thấy tất cả', async () => {
    const ids = (await canhBaoTroLy(fx.db, admin)).map((c) => c.studentId);
    expect(ids).toEqual(expect.arrayContaining([fx.studentA1, fx.studentB1]));
  });

  it('học sinh không đọc được danh sách', async () => {
    await expect(canhBaoTroLy(fx.db, studentA1)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await soCanhBaoTroLyChuaXuLy(fx.db, studentA1)).toBe(0);
  });

  it('đếm đúng số chưa xử lý cho huy hiệu', async () => {
    expect(await soCanhBaoTroLyChuaXuLy(fx.db, teacherA)).toBe(1);
  });
});

describe('moKhoaTroLy', () => {
  beforeEach(async () => {
    await khoaTroLyViPham(fx.db, fx.studentA1, VI_PHAM);
    await khoaTroLyViPham(fx.db, fx.studentA1, { ...VI_PHAM, loai: 'INSULT' });
  });

  it('giáo viên của em mở được: bỏ khoá, đóng mọi cảnh báo, ghi tên và lý do', async () => {
    const kq = await moKhoaTroLy(fx.db, teacherA, fx.studentA1, 'Đã nói chuyện với em');

    expect(kq.soCanhBaoDaXuLy).toBe(2);
    expect(await biKhoaTroLy(fx.db, fx.studentA1)).toBe(false);

    const alerts = await fx.db.aiViolationAlert.findMany({ where: { studentId: fx.studentA1 } });
    expect(alerts.every((a) => a.resolved && a.resolvedById === fx.teacherA && a.resolvedAt)).toBe(
      true,
    );

    const log = await fx.db.auditLog.findFirst({
      where: { action: 'ai.unlocked', entityId: fx.studentA1 },
      orderBy: { createdAt: 'desc' },
    });
    expect(log?.actorId).toBe(fx.teacherA);
    expect(log?.meta).toMatchObject({ ghiChu: 'Đã nói chuyện với em', soCanhBao: 2 });
  });

  it('giáo viên KHÔNG dạy em bị từ chối, khoá vẫn giữ', async () => {
    await expect(moKhoaTroLy(fx.db, teacherB, fx.studentA1, 'thử')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await biKhoaTroLy(fx.db, fx.studentA1)).toBe(true);
  });

  it('học sinh tự mở khoá cho mình bị từ chối', async () => {
    await expect(moKhoaTroLy(fx.db, studentA1, fx.studentA1, 'tự mở')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await biKhoaTroLy(fx.db, fx.studentA1)).toBe(true);
  });
});
