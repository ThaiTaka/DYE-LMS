/**
 * Student account lifecycle, against a real database.
 *
 * ── Why these tests matter more than the staff ones ──────────────────────────
 * The staff flow is protected by the database itself: five RESTRICT foreign keys
 * make a careless `DELETE` fail loudly. The student flow has the opposite
 * shape — every row pointing at a child CASCADEs, so a careless delete succeeds
 * quietly and takes a term of their work with it.
 *
 * There is no constraint to catch a mistake here. The confirmation step IS the
 * constraint, which makes it the thing that has to be tested.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import {
  anhHuongXoaHocSinh,
  goHocSinhKhoiLop,
  khoiPhucHocSinh,
  STUDENT_AUDIT,
  voHieuHoaHocSinh,
  xepHocSinhVaoLop,
  xoaTaiKhoanHocSinh,
} from './hoc-sinh';
import { createSession, validateSession } from './session';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let admin: Actor;
let teacherA: Actor;
let teacherB: Actor;

let dungThem: string[] = [];

beforeAll(async () => {
  fx = await createFixture();
  admin = await actorFor(fx.db, fx.admin);
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
});

afterEach(async () => {
  if (dungThem.length > 0) {
    await fx.db.auditLog.deleteMany({ where: { entityId: { in: dungThem } } });
    await fx.db.user.deleteMany({ where: { id: { in: dungThem } } });
    dungThem = [];
  }
  // Leave the shared fixture students the way the suite found them.
  await fx.db.user.updateMany({
    where: { id: { in: [fx.studentA1, fx.studentA2] } },
    data: { isActive: true },
  });
  await fx.db.enrollment.updateMany({
    where: { classId: fx.classA, studentId: { in: [fx.studentA1, fx.studentA2] } },
    data: { isActive: true },
  });
});

afterAll(async () => {
  await fx.cleanup();
});

/** A throwaway student, so the shared fixture survives a delete test. */
async function hocSinhTam(ten: string, classId?: string): Promise<string> {
  const row = await fx.db.user.create({
    data: {
      username: `${fx.prefix}-${ten}`,
      displayName: `${fx.prefix} ${ten}`,
      role: 'STUDENT',
      passwordHash: fx.passwordHash,
      isActive: true,
    },
    select: { id: true },
  });
  dungThem.push(row.id);

  if (classId) {
    await fx.db.enrollment.create({ data: { classId, studentId: row.id, isActive: true } });
  }
  return row.id;
}

describe('Xoá tài khoản học sinh', () => {
  it('tài khoản chưa dùng gì thì xoá luôn — không bắt xác nhận vô nghĩa', async () => {
    // Making an admin click twice to remove a typo'd username teaches them to
    // click twice without reading, which is exactly what breaks the real case.
    const id = await hocSinhTam('moi-tinh');

    const kq = await xoaTaiKhoanHocSinh(fx.db, admin, id);

    expect(kq.trangThai).toBe('da-xoa');
    expect(await fx.db.user.findUnique({ where: { id } })).toBeNull();
  });

  it('TỪ CHỐI lần đầu khi em đã có bài làm, và liệt kê những gì sẽ mất', async () => {
    const kq = await xoaTaiKhoanHocSinh(fx.db, admin, fx.studentA1);

    expect(kq.trangThai).toBe('can-xac-nhan');
    if (kq.trangThai !== 'can-xac-nhan') throw new Error('unreachable');
    expect(kq.anhHuong.baiNop).toBeGreaterThan(0);
    expect(kq.anhHuong.tongBanGhi).toBeGreaterThan(0);

    // Still there. Nothing about a refusal may be partial.
    expect(await fx.db.user.findUnique({ where: { id: fx.studentA1 } })).not.toBeNull();
  });

  it('xoá được sau khi xác nhận, và kéo theo mọi bản ghi của em', async () => {
    const id = await hocSinhTam('co-bai-lam', fx.classA);
    await fx.db.submission.create({
      data: { studentId: id, problemId: fx.problemId, code: '# tam', verdict: 'ACCEPTED' },
    });

    const truoc = await xoaTaiKhoanHocSinh(fx.db, admin, id);
    expect(truoc.trangThai).toBe('can-xac-nhan');

    const kq = await xoaTaiKhoanHocSinh(fx.db, admin, id, { xacNhan: true });
    expect(kq.trangThai).toBe('da-xoa');

    expect(await fx.db.user.findUnique({ where: { id } })).toBeNull();
    expect(await fx.db.submission.count({ where: { studentId: id } })).toBe(0);
    expect(await fx.db.enrollment.count({ where: { studentId: id } })).toBe(0);
  });

  it('giáo viên KHÔNG xoá được học sinh, kể cả em mình đang dạy', async () => {
    await expect(
      xoaTaiKhoanHocSinh(fx.db, teacherA, fx.studentA1, { xacNhan: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await fx.db.user.findUnique({ where: { id: fx.studentA1 } })).not.toBeNull();
  });

  it('từ chối dùng luồng học sinh cho tài khoản nhân sự', async () => {
    // The two flows guard different things and must not be interchangeable.
    await expect(anhHuongXoaHocSinh(fx.db, fx.teacherA)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('ghi nhật ký TRƯỚC khi xoá, kèm những gì đã mất', async () => {
    const id = await hocSinhTam('nhat-ky');
    await xoaTaiKhoanHocSinh(fx.db, admin, id, { xacNhan: true });

    const log = await fx.db.auditLog.findFirst({
      where: { action: STUDENT_AUDIT.DELETED, entityId: id },
    });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(fx.admin);
  });
});

describe('Ngưng và mở lại truy cập', () => {
  it('cắt truy cập ngay lập tức, không chờ phiên hết hạn', async () => {
    const phien = await createSession(fx.db, fx.studentA2);
    expect(await validateSession(fx.db, phien.token)).not.toBeNull();

    await voHieuHoaHocSinh(fx.db, teacherA, fx.studentA2);

    // Both halves or neither: an account flagged inactive whose sessions
    // survive is the exact gap this closes.
    expect(await validateSession(fx.db, phien.token)).toBeNull();
    expect(await fx.db.session.count({ where: { userId: fx.studentA2 } })).toBe(0);

    await fx.db.auditLog.deleteMany({ where: { entityId: fx.studentA2 } });
  });

  it('giáo viên dạy em thì làm được — không phải đi tìm quản trị viên giữa giờ', async () => {
    const kq = await voHieuHoaHocSinh(fx.db, teacherA, fx.studentA1);
    expect(kq.displayName).toContain(fx.prefix);

    await khoiPhucHocSinh(fx.db, teacherA, fx.studentA1);
    expect((await fx.db.user.findUniqueOrThrow({ where: { id: fx.studentA1 } })).isActive).toBe(
      true,
    );

    await fx.db.auditLog.deleteMany({ where: { entityId: fx.studentA1 } });
  });

  it('giáo viên KHÔNG dạy em thì không làm được', async () => {
    await expect(voHieuHoaHocSinh(fx.db, teacherB, fx.studentA1)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('ngưng truy cập KHÔNG đụng tới bài làm', async () => {
    const truoc = await fx.db.submission.count({ where: { studentId: fx.studentA1 } });
    await voHieuHoaHocSinh(fx.db, teacherA, fx.studentA1);

    expect(await fx.db.submission.count({ where: { studentId: fx.studentA1 } })).toBe(truoc);

    await fx.db.auditLog.deleteMany({ where: { entityId: fx.studentA1 } });
  });
});

describe('Gỡ khỏi lớp', () => {
  it('đánh dấu ghi danh là không hoạt động, không xoá bản ghi', async () => {
    // Marking it inactive rather than deleting keeps the child's work in that
    // class attributable to the time they were in it.
    const kq = await goHocSinhKhoiLop(fx.db, admin, fx.studentA2, fx.classA);
    expect(kq.daGo).toBe(true);

    const ghiDanh = await fx.db.enrollment.findUniqueOrThrow({
      where: { classId_studentId: { classId: fx.classA, studentId: fx.studentA2 } },
    });
    expect(ghiDanh.isActive).toBe(false);

    await fx.db.auditLog.deleteMany({ where: { entityId: fx.studentA2 } });
  });

  it('giáo viên lớp khác không gỡ được', async () => {
    await expect(
      goHocSinhKhoiLop(fx.db, teacherB, fx.studentA1, fx.classA),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('Xếp vào lớp', () => {
  /** Audit rows and enrolments this block invented, cleaned up after each test. */
  async function donDep(studentId: string, classId: string) {
    await fx.db.auditLog.deleteMany({
      where: { entityId: studentId, action: STUDENT_AUDIT.ENROLLED },
    });
    await fx.db.enrollment.deleteMany({ where: { classId, studentId } });
  }

  it('tạo ghi danh mới và ghi audit', async () => {
    const kq = await xepHocSinhVaoLop(fx.db, admin, fx.studentB1, fx.classA);
    expect(kq.trangThai).toBe('da-xep');

    const ghiDanh = await fx.db.enrollment.findUniqueOrThrow({
      where: { classId_studentId: { classId: fx.classA, studentId: fx.studentB1 } },
    });
    expect(ghiDanh.isActive).toBe(true);

    const nhatKy = await fx.db.auditLog.findFirst({
      where: { entityId: fx.studentB1, action: STUDENT_AUDIT.ENROLLED },
    });
    expect(nhatKy).not.toBeNull();
    expect(nhatKy?.actorId).toBe(fx.admin);

    await donDep(fx.studentB1, fx.classA);
  });

  it('không gỡ em ra khỏi các lớp đang học', async () => {
    // Additive by design: a transfer is enrol-then-remove, two explicit steps.
    // If this ever starts failing, someone has taught the function to empty a
    // child out of their other classes as a side effect.
    await xepHocSinhVaoLop(fx.db, admin, fx.studentB1, fx.classA);

    const cu = await fx.db.enrollment.findUniqueOrThrow({
      where: { classId_studentId: { classId: fx.classB, studentId: fx.studentB1 } },
    });
    expect(cu.isActive).toBe(true);

    await donDep(fx.studentB1, fx.classA);
  });

  it('em quay lại lớp cũ thì dùng lại bản ghi, không tạo bản ghi thứ hai', async () => {
    // @@unique([classId, studentId]) makes a second row impossible, so the only
    // question is whether the original is reused honestly: enrolledAt must not
    // move, or the record would claim the child had never been there before.
    const truoc = await fx.db.enrollment.findUniqueOrThrow({
      where: { classId_studentId: { classId: fx.classA, studentId: fx.studentWithdrawn } },
    });
    expect(truoc.isActive).toBe(false);

    const kq = await xepHocSinhVaoLop(fx.db, admin, fx.studentWithdrawn, fx.classA);
    expect(kq.trangThai).toBe('da-khoi-phuc');

    const sau = await fx.db.enrollment.findUniqueOrThrow({
      where: { classId_studentId: { classId: fx.classA, studentId: fx.studentWithdrawn } },
    });
    expect(sau.id).toBe(truoc.id);
    expect(sau.enrolledAt.getTime()).toBe(truoc.enrolledAt.getTime());
    expect(sau.isActive).toBe(true);

    // Put the fixture back the way the rest of the suite expects it.
    await fx.db.enrollment.update({ where: { id: truoc.id }, data: { isActive: false } });
    await fx.db.auditLog.deleteMany({
      where: { entityId: fx.studentWithdrawn, action: STUDENT_AUDIT.ENROLLED },
    });
  });

  it('bấm hai lần không ghi thêm audit', async () => {
    // Clicking twice is not an error, and a no-op must not leave a trail
    // implying something changed.
    await xepHocSinhVaoLop(fx.db, admin, fx.studentB1, fx.classA);
    const lan2 = await xepHocSinhVaoLop(fx.db, admin, fx.studentB1, fx.classA);
    expect(lan2.trangThai).toBe('da-o-trong-lop');

    const soDong = await fx.db.auditLog.count({
      where: { entityId: fx.studentB1, action: STUDENT_AUDIT.ENROLLED },
    });
    expect(soDong).toBe(1);

    await donDep(fx.studentB1, fx.classA);
  });

  it('giáo viên xếp được vào lớp mình phụ trách', async () => {
    const kq = await xepHocSinhVaoLop(fx.db, teacherA, fx.studentB1, fx.classA);
    expect(kq.trangThai).toBe('da-xep');
    await donDep(fx.studentB1, fx.classA);
  });

  it('giáo viên lớp khác không xếp được', async () => {
    await expect(
      xepHocSinhVaoLop(fx.db, teacherB, fx.studentB1, fx.classA),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const co = await fx.db.enrollment.findUnique({
      where: { classId_studentId: { classId: fx.classA, studentId: fx.studentB1 } },
    });
    expect(co).toBeNull();
  });

  it('không xếp được tài khoản không phải học sinh', async () => {
    // Otherwise a teacher id in the student field creates an enrolment that
    // every roster query then has to know to ignore.
    await expect(
      xepHocSinhVaoLop(fx.db, admin, fx.teacherB, fx.classA),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('không xếp được vào lớp đã lưu trữ', async () => {
    const luuTru = await fx.db.class.create({
      data: {
        code: `XEP-LOP-ARCHIVED-${Date.now()}`,
        name: 'Lớp đã lưu trữ',
        teacherId: fx.teacherA,
        isArchived: true,
      },
      select: { id: true },
    });

    await expect(
      xepHocSinhVaoLop(fx.db, admin, fx.studentB1, luuTru.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await fx.db.class.delete({ where: { id: luuTru.id } });
  });
});
