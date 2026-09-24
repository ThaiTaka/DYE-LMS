/**
 * Post-lesson reflections: the 150-word floor, the one-per-lesson lock, and
 * who may read them.
 *
 * The negative cases are the point. The browser disables its button below 150
 * words, and none of that matters if the server would take 149 — so the floor
 * is asserted here, against the real write path, with nothing in front of it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { resolveLessonAccess } from './curriculum/gating';
import { SO_CHU_TOI_THIEU_SUY_NGAM, SUY_NGAM_TOI_DA_KY_TU } from './dem-chu';
import { ForbiddenError } from './errors';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';
import { nopTuLuanHocTap, tuLuanHocTapCuaBai, tuLuanHocTapCuaHocSinh } from './tu-luan-hoc-tap';

import type { Actor } from './session';

let fx: Fixture;
let admin: Actor;
let teacherA: Actor;
let teacherB: Actor;
let hsA1: Actor;

/** `n` distinct words. */
function vanBan(n: number): string {
  return Array.from({ length: n }, (_, i) => `chữ${i}`).join(' ');
}

beforeAll(async () => {
  fx = await createFixture();
  admin = await actorFor(fx.db, fx.admin);
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  hsA1 = await actorFor(fx.db, fx.studentA1);
});

afterEach(async () => {
  await fx.db.lessonReflection.deleteMany({
    where: { studentId: { in: [fx.studentA1, fx.studentA2, fx.admin] } },
  });
});

afterAll(async () => {
  await fx.cleanup();
});

describe('Nộp tự luận học tập', () => {
  it('dưới 150 chữ bị máy chủ từ chối và không ghi gì', async () => {
    const kq = await nopTuLuanHocTap(
      fx.db,
      hsA1,
      fx.lessonId,
      vanBan(SO_CHU_TOI_THIEU_SUY_NGAM - 1),
    );

    expect(kq).toEqual({
      trangThai: 'chua-du-chu',
      soChu: SO_CHU_TOI_THIEU_SUY_NGAM - 1,
      toiThieu: SO_CHU_TOI_THIEU_SUY_NGAM,
    });
    expect(await tuLuanHocTapCuaBai(fx.db, fx.studentA1, fx.lessonId)).toBeNull();
  });

  it('đủ 150 chữ thì được lưu, kèm số chữ máy chủ đã đếm', async () => {
    const kq = await nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, `  ${vanBan(160)}  `);
    expect(kq).toEqual({ trangThai: 'da-nhan', soChu: 160 });

    const daLuu = await tuLuanHocTapCuaBai(fx.db, fx.studentA1, fx.lessonId);
    expect(daLuu?.soChu).toBe(160);
    // Trimmed, not otherwise altered.
    expect(daLuu?.noiDung).toBe(vanBan(160));
  });

  it('dấu câu đứng riêng không giúp vượt mức tối thiểu', async () => {
    const lachLuat = `${vanBan(100)} ${Array.from({ length: 80 }, () => '-').join(' ')}`;
    const kq = await nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, lachLuat);
    expect(kq.trangThai).toBe('chua-du-chu');
  });

  it('mỗi bài chỉ một lần — lần nộp thứ hai bị khoá duy nhất từ chối', async () => {
    await nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, vanBan(150));
    const lan2 = await nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, vanBan(200));

    expect(lan2).toEqual({ trangThai: 'da-nop-roi' });
    // The first one stands.
    expect((await tuLuanHocTapCuaBai(fx.db, fx.studentA1, fx.lessonId))?.soChu).toBe(150);
  });

  it('hai lần nộp cùng lúc chỉ ghi một dòng', async () => {
    const [a, b] = await Promise.all([
      nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, vanBan(150)),
      nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, vanBan(151)),
    ]);

    expect([a.trangThai, b.trangThai].sort()).toEqual(['da-nhan', 'da-nop-roi']);
    expect(
      await fx.db.lessonReflection.count({
        where: { studentId: fx.studentA1, lessonId: fx.lessonId },
      }),
    ).toBe(1);
  });

  it('quá dài thì bị từ chối, không cắt bớt', async () => {
    const dai = `${vanBan(150)} ${'a'.repeat(SUY_NGAM_TOI_DA_KY_TU)}`;
    const kq = await nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, dai);

    expect(kq).toEqual({ trangThai: 'qua-dai', toiDa: SUY_NGAM_TOI_DA_KY_TU });
    expect(await tuLuanHocTapCuaBai(fx.db, fx.studentA1, fx.lessonId)).toBeNull();
  });

  it('chỉ học sinh mới nộp — giáo viên và quản trị xem thử bài thì bị từ chối', async () => {
    await expect(nopTuLuanHocTap(fx.db, teacherA, fx.lessonId, vanBan(150))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(nopTuLuanHocTap(fx.db, admin, fx.lessonId, vanBan(150))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('bài học chưa mở thì từ chối, dù đủ chữ', async () => {
    const khoa = await fx.db.lesson.findFirstOrThrow({
      where: { courseId: fx.courseId, order: 28 },
      select: { id: true },
    });
    // If this ever stops being locked the assertion below proves nothing.
    expect((await resolveLessonAccess(fx.db, fx.studentA1, khoa.id))?.unlocked).toBe(false);

    await expect(nopTuLuanHocTap(fx.db, hsA1, khoa.id, vanBan(150))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('Giáo viên đọc tự luận học tập', () => {
  it('giáo viên dạy em đó đọc được, kèm tên buổi học', async () => {
    await nopTuLuanHocTap(fx.db, hsA1, fx.lessonId, vanBan(150));

    const ds = await tuLuanHocTapCuaHocSinh(fx.db, teacherA, fx.studentA1);
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ lessonId: fx.lessonId, buoi: 1, soChu: 150 });
  });

  it('giáo viên không dạy em đó bị từ chối trước khi đọc dòng nào', async () => {
    await expect(tuLuanHocTapCuaHocSinh(fx.db, teacherB, fx.studentA1)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
