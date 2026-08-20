/**
 * Teaching analytics, against a real database.
 *
 * ── The one thing these tests exist to prevent ───────────────────────────────
 * An aggregate is a leak with extra steps. A teacher's dashboard showing a mean
 * computed over children they have no relationship with is not obviously wrong
 * on screen — it is a plausible-looking number — and no page will ever complain.
 *
 * So the assertions below are mostly about ABSENCE: teacher A's report must not
 * contain teacher B's class, must not contain teacher B's students, and must
 * refuse outright when asked for a class id outside that scope.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';
import { thongKeGiangDay } from './thong-ke';

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

describe('Phạm vi thống kê', () => {
  it('giáo viên chỉ thấy lớp mình phụ trách', async () => {
    const tk = await thongKeGiangDay(fx.db, teacherA);
    const ids = tk.lop.map((l) => l.classId);

    expect(ids).toContain(fx.classA);
    expect(ids).not.toContain(fx.classB);
    expect(tk.toanHeThong).toBe(false);
  });

  it('giáo viên không thấy học sinh của giáo viên khác trong bất kỳ bảng nào', async () => {
    const tk = await thongKeGiangDay(fx.db, teacherA);
    const hocSinh = tk.lop.flatMap((l) => l.hocSinh.map((h) => h.studentId));

    expect(hocSinh).toContain(fx.studentA1);
    expect(hocSinh).not.toContain(fx.studentB1);
  });

  it('phạm vi đối xứng — giáo viên B cũng chỉ thấy lớp của B', async () => {
    // Asserted from both sides on purpose. A filter accidentally hard-wired to
    // one teacher, or one that silently returns everything, passes the test
    // above and fails this one.
    const tk = await thongKeGiangDay(fx.db, teacherB);
    const ids = tk.lop.map((l) => l.classId);

    expect(ids).toContain(fx.classB);
    expect(ids).not.toContain(fx.classA);
  });

  it('quản trị viên thấy toàn hệ thống', async () => {
    const tk = await thongKeGiangDay(fx.db, admin);
    const ids = tk.lop.map((l) => l.classId);

    expect(ids).toContain(fx.classA);
    expect(ids).toContain(fx.classB);
    expect(tk.toanHeThong).toBe(true);
  });

  it('học sinh không đọc được thống kê', async () => {
    await expect(thongKeGiangDay(fx.db, studentA1)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lọc theo classId vẫn bị chặn bởi cùng một phạm vi', async () => {
    // The narrowing parameter must not become a way around the scope.
    await expect(
      thongKeGiangDay(fx.db, teacherA, { classId: fx.classB }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const cuaMinh = await thongKeGiangDay(fx.db, teacherA, { classId: fx.classA });
    expect(cuaMinh.lop.map((l) => l.classId)).toEqual([fx.classA]);
  });
});

describe('Số liệu', () => {
  it('chỉ đếm học sinh đang theo học, không đếm em đã rời lớp', async () => {
    const tk = await thongKeGiangDay(fx.db, teacherA, { classId: fx.classA });
    const lopA = tk.lop.find((l) => l.classId === fx.classA);

    const ids = lopA?.hocSinh.map((h) => h.studentId) ?? [];
    expect(ids).toContain(fx.studentA1);
    // Access ends when the relationship ends; so does the reporting.
    expect(ids).not.toContain(fx.studentWithdrawn);
  });

  it('sắp xếp học sinh theo TÊN, không theo điểm', async () => {
    // The table answers "who do I sit with next lesson?". Sorting by score
    // answers a different, worse question.
    const tk = await thongKeGiangDay(fx.db, teacherA, { classId: fx.classA });
    const ten = tk.lop[0]?.hocSinh.map((h) => h.displayName) ?? [];

    expect(ten.length).toBeGreaterThan(1);
    expect([...ten].sort((a, b) => a.localeCompare(b, 'vi'))).toEqual(ten);
  });

  it('báo cáo tỉ lệ hoàn thành và số bài nộp của lớp', async () => {
    const tk = await thongKeGiangDay(fx.db, teacherA, { classId: fx.classA });
    const lopA = tk.lop.find((l) => l.classId === fx.classA);

    expect(lopA).toBeDefined();
    expect(lopA!.khoaHoc.length).toBeGreaterThan(0);
    expect(lopA!.tiLeHoanThanh).toBeGreaterThanOrEqual(0);
    expect(lopA!.tiLeHoanThanh).toBeLessThanOrEqual(100);
    expect(lopA!.soBaiNop).toBeGreaterThan(0);
  });

  it('điểm trung bình là null khi chưa có bài nộp nào, không phải 0', async () => {
    // Zero and "nothing handed in yet" are different facts, and rendering the
    // second as the first tells a teacher a class is failing when it has not
    // started.
    const klass = await fx.db.class.create({
      data: {
        code: `${fx.prefix}-TK-TRONG`,
        name: `${fx.prefix} Lớp trống`,
        teacherId: fx.teacherA,
      },
      select: { id: true },
    });

    const tk = await thongKeGiangDay(fx.db, teacherA, { classId: klass.id });
    expect(tk.lop[0]?.diemTrungBinh).toBeNull();
    expect(tk.lop[0]?.tiLeDat).toBeNull();
    expect(tk.lop[0]?.siSo).toBe(0);

    await fx.db.class.delete({ where: { id: klass.id } });
  });

  it('mặc định bỏ qua lớp đã lưu trữ, và bật lên được', async () => {
    const klass = await fx.db.class.create({
      data: {
        code: `${fx.prefix}-TK-LUU`,
        name: `${fx.prefix} Lớp lưu trữ`,
        teacherId: fx.teacherA,
        isArchived: true,
      },
      select: { id: true },
    });

    const mac = await thongKeGiangDay(fx.db, teacherA);
    expect(mac.lop.map((l) => l.classId)).not.toContain(klass.id);

    const keCa = await thongKeGiangDay(fx.db, teacherA, { keCaLuuTru: true });
    expect(keCa.lop.map((l) => l.classId)).toContain(klass.id);

    await fx.db.class.delete({ where: { id: klass.id } });
  });
});
