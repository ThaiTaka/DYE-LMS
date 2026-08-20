/**
 * Class lifecycle and curriculum assignment, against a real database.
 *
 * The interesting cases here are the ones where the database will happily do the
 * wrong thing:
 *
 *   • `DELETE FROM "Class"` succeeds silently on a class with thirty children
 *     in it, because every dependent row CASCADEs. Nothing in Postgres will
 *     stop that, so the refusal has to live in code and has to be tested.
 *   • A student's work is keyed on lessons and blocks, never on the class — so
 *     detaching a course must not destroy anything. That is easy to assert and
 *     easy to break, since "clean up when a course is removed" sounds tidy.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import {
  anhHuongXoaLop,
  CLASS_AUDIT,
  ganKhoaHocVaoLop,
  goKhoaHocKhoiLop,
  khoaHocChoLop,
  luuTruLopHoc,
  xoaLopHoc,
} from './lop';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let admin: Actor;
let teacherA: Actor;
let teacherB: Actor;
let studentA1: Actor;

/** Ids of classes created by a test, torn down afterwards. */
let dungThem: string[] = [];

beforeAll(async () => {
  fx = await createFixture();
  admin = await actorFor(fx.db, fx.admin);
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  studentA1 = await actorFor(fx.db, fx.studentA1);
});

afterEach(async () => {
  if (dungThem.length > 0) {
    await fx.db.class.deleteMany({ where: { id: { in: dungThem } } });
    dungThem = [];
  }
});

afterAll(async () => {
  await fx.cleanup();
});

/** A throwaway class owned by teacher A, so the shared fixture survives. */
async function lopTam(ten: string, hocSinh: string[] = []): Promise<string> {
  const klass = await fx.db.class.create({
    data: {
      code: `${fx.prefix}-${ten}`.toUpperCase().slice(0, 31),
      name: `${fx.prefix} ${ten}`,
      teacherId: fx.teacherA,
    },
    select: { id: true },
  });
  dungThem.push(klass.id);

  if (hocSinh.length > 0) {
    await fx.db.enrollment.createMany({
      data: hocSinh.map((studentId) => ({ classId: klass.id, studentId, isActive: true })),
    });
  }
  return klass.id;
}

describe('Xoá lớp', () => {
  it('xoá thẳng được khi lớp còn trống', async () => {
    const id = await lopTam('trong');

    const kq = await xoaLopHoc(fx.db, admin, id);

    expect(kq.trangThai).toBe('da-xoa');
    expect(await fx.db.class.findUnique({ where: { id } })).toBeNull();
  });

  it('TỪ CHỐI lần đầu khi lớp còn học sinh, và báo rõ con số', async () => {
    const id = await lopTam('con-hoc-sinh', [fx.studentA1, fx.studentA2]);

    const kq = await xoaLopHoc(fx.db, admin, id);

    expect(kq.trangThai).toBe('can-xac-nhan');
    if (kq.trangThai !== 'can-xac-nhan') throw new Error('unreachable');
    expect(kq.anhHuong.hocSinhDangHoc).toBe(2);

    // Nothing was written. A refusal that half-deleted would be worse than none.
    expect(await fx.db.class.findUnique({ where: { id } })).not.toBeNull();
  });

  it('xoá được sau khi xác nhận — và tài khoản học sinh vẫn còn nguyên', async () => {
    const id = await lopTam('xac-nhan', [fx.studentA1]);

    const kq = await xoaLopHoc(fx.db, admin, id, { xacNhan: true });
    expect(kq.trangThai).toBe('da-xoa');

    // The enrolment row goes; the CHILD does not. This is the distinction the
    // whole confirmation copy rests on, so it is asserted rather than assumed.
    expect(await fx.db.class.findUnique({ where: { id } })).toBeNull();
    expect(await fx.db.user.findUnique({ where: { id: fx.studentA1 } })).not.toBeNull();
    expect(
      await fx.db.submission.count({ where: { studentId: fx.studentA1 } }),
    ).toBeGreaterThan(0);
  });

  it('giáo viên không xoá được lớp, kể cả lớp của chính mình', async () => {
    const id = await lopTam('cua-gv');

    // Creating a class is admin-only; ending one must be at least as strict.
    await expect(xoaLopHoc(fx.db, teacherA, id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await fx.db.class.findUnique({ where: { id } })).not.toBeNull();
  });

  it('ghi nhật ký kiểm toán TRƯỚC khi xoá, nên bản ghi sống lâu hơn đối tượng', async () => {
    const id = await lopTam('nhat-ky');
    await xoaLopHoc(fx.db, admin, id);

    const log = await fx.db.auditLog.findFirst({
      where: { action: CLASS_AUDIT.DELETED, entityId: id },
    });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(fx.admin);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });

  it('lưu trữ là đường lùi: giữ nguyên mọi thứ và bật lại được', async () => {
    const id = await lopTam('luu-tru', [fx.studentA1]);

    await luuTruLopHoc(fx.db, admin, id, true);
    expect((await fx.db.class.findUniqueOrThrow({ where: { id } })).isArchived).toBe(true);
    expect(await fx.db.enrollment.count({ where: { classId: id } })).toBe(1);

    await luuTruLopHoc(fx.db, admin, id, false);
    expect((await fx.db.class.findUniqueOrThrow({ where: { id } })).isArchived).toBe(false);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });

  it('đếm đúng ảnh hưởng trước khi xoá', async () => {
    const id = await lopTam('anh-huong', [fx.studentA1, fx.studentA2]);
    await ganKhoaHocVaoLop(fx.db, admin, id, fx.courseId);

    const a = await anhHuongXoaLop(fx.db, id);
    expect(a.hocSinhDangHoc).toBe(2);
    expect(a.khoaHoc).toBe(1);
    expect(a.trong).toBe(false);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });
});

describe('Gắn khoá học vào lớp', () => {
  it('quản trị viên gắn được', async () => {
    const id = await lopTam('gan-admin');

    const kq = await ganKhoaHocVaoLop(fx.db, admin, id, fx.courseId);
    expect(kq.trangThai).toBe('da-gan');
    expect(await fx.db.classCourse.count({ where: { classId: id } })).toBe(1);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });

  it('giáo viên phụ trách lớp cũng gắn được — đây là việc dạy học bình thường', async () => {
    const id = await lopTam('gan-gv');

    const kq = await ganKhoaHocVaoLop(fx.db, teacherA, id, fx.courseId);
    expect(kq.trangThai).toBe('da-gan');

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });

  it('giáo viên KHÁC thì không — quan hệ mới là thứ quyết định, không phải vai trò', async () => {
    const id = await lopTam('gan-gv-khac');

    await expect(ganKhoaHocVaoLop(fx.db, teacherB, id, fx.courseId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await fx.db.classCourse.count({ where: { classId: id } })).toBe(0);
  });

  it('học sinh thì không, kể cả lớp mình đang học', async () => {
    await expect(
      ganKhoaHocVaoLop(fx.db, studentA1, fx.classA, fx.courseId),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('gắn lại lần hai là không-thao-tác, không phải lỗi', async () => {
    const id = await lopTam('gan-hai-lan');
    await ganKhoaHocVaoLop(fx.db, admin, id, fx.courseId);

    const lai = await ganKhoaHocVaoLop(fx.db, admin, id, fx.courseId);
    expect(lai.trangThai).toBe('da-co');
    expect(await fx.db.classCourse.count({ where: { classId: id } })).toBe(1);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });

  it('gỡ khoá học KHÔNG đụng tới bài làm của học sinh', async () => {
    const id = await lopTam('go-khoa', [fx.studentA1]);
    await ganKhoaHocVaoLop(fx.db, admin, id, fx.courseId);

    const truoc = await fx.db.submission.count({ where: { studentId: fx.studentA1 } });
    await goKhoaHocKhoiLop(fx.db, admin, id, fx.courseId);

    expect(await fx.db.classCourse.count({ where: { classId: id } })).toBe(0);
    // Progress, drafts and submissions hang off lessons and blocks, never off
    // the class — which is what makes re-attaching safe.
    expect(await fx.db.submission.count({ where: { studentId: fx.studentA1 } })).toBe(truoc);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });

  it('danh sách khoá học đánh dấu đúng cái đã gắn', async () => {
    const id = await lopTam('danh-sach');
    await ganKhoaHocVaoLop(fx.db, admin, id, fx.courseId);

    const ds = await khoaHocChoLop(fx.db, id);
    expect(ds.length).toBeGreaterThan(1);
    expect(ds.find((k) => k.courseId === fx.courseId)?.daGan).toBe(true);
    expect(ds.filter((k) => !k.daGan).length).toBeGreaterThan(0);

    await fx.db.auditLog.deleteMany({ where: { entityId: id } });
  });
});
