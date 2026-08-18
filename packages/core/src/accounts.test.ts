/**
 * Staff account retirement, against a real database.
 *
 * These run against Postgres deliberately: the whole point is the RESTRICT
 * foreign keys, and an in-memory double would not have them. A test that
 * "passes" without the constraint present proves nothing about the flow it is
 * meant to protect.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anhHuongXoaTaiKhoan,
  chuyenGiaoHoSoGiangDay,
  khoiPhucNhanVien,
  nguoiCoTheNhanBanGiao,
  voHieuHoaNhanVien,
  xoaTaiKhoanNhanVien,
} from './accounts';
import { ForbiddenError } from './errors';
import { createSession, validateSession, type Actor } from './session';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

let fx: Fixture;
let admin: Actor;
let teacherAActor: Actor;

beforeAll(async () => {
  fx = await createFixture();
  admin = await actorFor(fx.db, fx.admin);
  teacherAActor = await actorFor(fx.db, fx.teacherA);
});

afterAll(async () => {
  await fx.cleanup();
});

/** Give teacher A a realistic footprint: decisions about real children. */
async function giveTeacherAHistory(): Promise<void> {
  await fx.db.trackAssignment.upsert({
    where: { studentId_courseId: { studentId: fx.studentA1, courseId: fx.courseId } },
    create: {
      studentId: fx.studentA1,
      courseId: fx.courseId,
      tier: 'NANG_CAO',
      assignedBy: fx.teacherA,
      note: 'đang tăng tốc',
    },
    update: { assignedBy: fx.teacherA, tier: 'NANG_CAO' },
  });

  await fx.db.lessonOverride.create({
    data: {
      lessonId: fx.lessonId,
      studentId: fx.studentA1,
      isUnlocked: true,
      reason: 'em đã học trước ở nhà',
      createdBy: fx.teacherA,
    },
  });

  await fx.db.announcement.create({
    data: {
      classId: fx.classA,
      authorId: fx.teacherA,
      title: 'Nhắc lịch học',
      body: 'Buổi tới các em mang máy tính nhé.',
    },
  });

  await fx.db.feedback.create({
    data: {
      authorId: fx.teacherA,
      submissionId: fx.submissionA1,
      comment: 'Em làm tốt phần vòng lặp.',
    },
  });
}

describe('anhHuongXoaTaiKhoan — đo trước khi phá', () => {
  it('đếm đủ năm loại ràng buộc RESTRICT', async () => {
    await giveTeacherAHistory();

    const anhHuong = await anhHuongXoaTaiKhoan(fx.db, fx.teacherA);

    expect(anhHuong.rangBuoc.lop).toBeGreaterThanOrEqual(1);
    expect(anhHuong.rangBuoc.nhanhDaGiao).toBeGreaterThanOrEqual(1);
    expect(anhHuong.rangBuoc.canThiepBaiHoc).toBeGreaterThanOrEqual(1);
    expect(anhHuong.rangBuoc.thongBao).toBeGreaterThanOrEqual(1);
    expect(anhHuong.rangBuoc.nhanXet).toBeGreaterThanOrEqual(1);
    expect(anhHuong.xoaTrucTiepDuoc).toBe(false);
  });

  it('báo số học sinh bị ảnh hưởng mà không tính đó là ràng buộc riêng', async () => {
    const anhHuong = await anhHuongXoaTaiKhoan(fx.db, fx.teacherA);

    // Students are a consequence of the classes, so they are reported for the
    // human cost but must not be double-counted as blockers.
    expect(anhHuong.rangBuoc.hocSinh).toBeGreaterThanOrEqual(2);
    const tongCong =
      anhHuong.rangBuoc.lop +
      anhHuong.rangBuoc.nhanhDaGiao +
      anhHuong.rangBuoc.canThiepBaiHoc +
      anhHuong.rangBuoc.thongBao +
      anhHuong.rangBuoc.nhanXet;
    expect(anhHuong.tongRangBuoc).toBe(tongCong);
  });

  it('tài khoản chưa làm gì thì xoá thẳng được', async () => {
    const troi = await fx.db.user.create({
      data: {
        username: `${fx.prefix}-gv-moi`,
        displayName: 'Giáo viên mới',
        role: 'TEACHER',
        passwordHash: fx.passwordHash,
      },
      select: { id: true },
    });

    const anhHuong = await anhHuongXoaTaiKhoan(fx.db, troi.id);
    expect(anhHuong.tongRangBuoc).toBe(0);
    expect(anhHuong.xoaTrucTiepDuoc).toBe(true);

    await fx.db.user.delete({ where: { id: troi.id } });
  });
});

describe('Postgres thật sự chặn — không phải chỉ tầng ứng dụng tự nhận', () => {
  it('DELETE thẳng vào giáo viên có hồ sơ sẽ thất bại', async () => {
    // The constraint this whole module exists for. If this ever stops throwing,
    // the schema lost its RESTRICT and the safe flow became optional.
    await expect(fx.db.user.delete({ where: { id: fx.teacherA } })).rejects.toThrow();
  });
});

describe('voHieuHoaNhanVien — đường mặc định', () => {
  it('cắt truy cập ngay và huỷ mọi phiên đang mở', async () => {
    const teacherB = await actorFor(fx.db, fx.teacherB);
    const { token } = await createSession(fx.db, teacherB.id);

    expect(await validateSession(fx.db, token)).not.toBeNull();

    const ketQua = await voHieuHoaNhanVien(fx.db, admin, fx.teacherB);
    expect(ketQua.sessionsRevoked).toBeGreaterThanOrEqual(1);

    // Both mechanisms, checked separately: the row is gone AND isActive is false.
    expect(await validateSession(fx.db, token)).toBeNull();
    const sau = await fx.db.user.findUniqueOrThrow({
      where: { id: fx.teacherB },
      select: { isActive: true },
    });
    expect(sau.isActive).toBe(false);
  });

  it('giữ nguyên toàn bộ hồ sơ sư phạm', async () => {
    const anhHuong = await anhHuongXoaTaiKhoan(fx.db, fx.teacherB);
    // Deactivation destroys nothing — that is the entire reason to prefer it.
    expect(anhHuong.rangBuoc.lop).toBeGreaterThanOrEqual(1);
  });

  it('khoiPhucNhanVien đưa tài khoản trở lại', async () => {
    await khoiPhucNhanVien(fx.db, admin, fx.teacherB);
    const sau = await fx.db.user.findUniqueOrThrow({
      where: { id: fx.teacherB },
      select: { isActive: true },
    });
    expect(sau.isActive).toBe(true);
  });
});

describe('Ai được phép làm việc này', () => {
  it('giáo viên không được vô hiệu hoá giáo viên khác', async () => {
    await expect(voHieuHoaNhanVien(fx.db, teacherAActor, fx.teacherB)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('không ai tự xoá tài khoản của chính mình', async () => {
    await expect(xoaTaiKhoanNhanVien(fx.db, admin, admin.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('không xoá được admin hoạt động cuối cùng', async () => {
    const admin2 = await fx.db.user.create({
      data: {
        username: `${fx.prefix}-admin-2`,
        displayName: 'Quản trị 2',
        role: 'ADMIN',
        passwordHash: fx.passwordHash,
      },
      select: { id: true, username: true, displayName: true, role: true, isActive: true },
    });

    // Every other admin in the database is inactive for the duration of this
    // check, so admin2 really is the last way in.
    const conLai = await fx.db.user.findMany({
      where: { role: 'ADMIN', isActive: true, id: { notIn: [admin2.id] } },
      select: { id: true },
    });
    await fx.db.user.updateMany({
      where: { id: { in: conLai.map((u) => u.id) } },
      data: { isActive: false },
    });

    const actor2: Actor = { ...admin2, mustChangePassword: false };
    const admin3 = await fx.db.user.create({
      data: {
        username: `${fx.prefix}-admin-3`,
        displayName: 'Quản trị 3',
        role: 'ADMIN',
        passwordHash: fx.passwordHash,
        isActive: false,
      },
      select: { id: true },
    });

    // admin3 exists but is inactive, so removing admin2 would lock everyone out.
    await expect(
      xoaTaiKhoanNhanVien(fx.db, actor2, admin2.id).catch((e: unknown) => {
        throw e;
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await fx.db.user.updateMany({
      where: { id: { in: conLai.map((u) => u.id) } },
      data: { isActive: true },
    });
    await fx.db.user.deleteMany({ where: { id: { in: [admin2.id, admin3.id] } } });
  });

  it('không dùng luồng này cho học sinh', async () => {
    await expect(voHieuHoaNhanVien(fx.db, admin, fx.studentA1)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('chuyenGiaoHoSoGiangDay', () => {
  it('chuyển trọn hồ sơ sang người kế nhiệm', async () => {
    const truoc = await anhHuongXoaTaiKhoan(fx.db, fx.teacherA);
    expect(truoc.tongRangBuoc).toBeGreaterThan(0);

    const ketQua = await chuyenGiaoHoSoGiangDay(fx.db, admin, fx.teacherA, fx.teacherB);

    expect(ketQua.lop).toBeGreaterThanOrEqual(1);
    expect(ketQua.nhanhDaGiao).toBeGreaterThanOrEqual(1);
    expect(ketQua.canThiepBaiHoc).toBeGreaterThanOrEqual(1);
    expect(ketQua.thongBao).toBeGreaterThanOrEqual(1);
    expect(ketQua.nhanXet).toBeGreaterThanOrEqual(1);

    const sau = await anhHuongXoaTaiKhoan(fx.db, fx.teacherA);
    expect(sau.tongRangBuoc).toBe(0);
  });

  it('người kế nhiệm thật sự thừa hưởng quyền dạy các em đó', async () => {
    // The consequence that matters: this is a grant of access to children, not
    // a filing change. Teacher B can now reach teacher A's former students.
    const enrolment = await fx.db.enrollment.findFirst({
      where: { studentId: fx.studentA1, isActive: true, class: { teacherId: fx.teacherB } },
      select: { id: true },
    });
    expect(enrolment).not.toBeNull();
  });

  it('từ chối chuyển cho chính mình', async () => {
    await expect(
      chuyenGiaoHoSoGiangDay(fx.db, admin, fx.teacherB, fx.teacherB),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('từ chối người kế nhiệm là học sinh', async () => {
    await expect(
      chuyenGiaoHoSoGiangDay(fx.db, admin, fx.teacherB, fx.studentA1),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('từ chối người kế nhiệm đang bị vô hiệu hoá', async () => {
    const nghi = await fx.db.user.create({
      data: {
        username: `${fx.prefix}-gv-nghi`,
        displayName: 'Giáo viên đã nghỉ',
        role: 'TEACHER',
        passwordHash: fx.passwordHash,
        isActive: false,
      },
      select: { id: true },
    });

    // Handing classes to a disabled account would leave those students with no
    // teacher who can actually reach them.
    await expect(
      chuyenGiaoHoSoGiangDay(fx.db, admin, fx.teacherB, nghi.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await fx.db.user.delete({ where: { id: nghi.id } });
  });
});

describe('xoaTaiKhoanNhanVien', () => {
  it('trả về "còn ràng buộc" như DỮ LIỆU, không ném lỗi', async () => {
    // A blocked deletion is an expected step in the workflow, so the caller gets
    // the impact back and renders a transfer form — not an error page.
    const ketQua = await xoaTaiKhoanNhanVien(fx.db, admin, fx.teacherB);

    expect(ketQua.trangThai).toBe('con-rang-buoc');
    if (ketQua.trangThai === 'con-rang-buoc') {
      expect(ketQua.anhHuong.tongRangBuoc).toBeGreaterThan(0);
      expect(ketQua.anhHuong.rangBuoc.lop).toBeGreaterThanOrEqual(1);
    }

    // Nothing was destroyed on the way to that answer.
    const vanCon = await fx.db.user.findUnique({ where: { id: fx.teacherB } });
    expect(vanCon).not.toBeNull();
  });

  it('chuyển giao rồi xoá trong một lần gọi', async () => {
    const tam = await fx.db.user.create({
      data: {
        username: `${fx.prefix}-gv-tam`,
        displayName: 'Giáo viên tạm',
        role: 'TEACHER',
        passwordHash: fx.passwordHash,
      },
      select: { id: true },
    });
    const lopTam = await fx.db.class.create({
      data: { code: `${fx.prefix}-CLASS-TAM`, name: 'Lớp tạm', teacherId: tam.id },
      select: { id: true },
    });

    const ketQua = await xoaTaiKhoanNhanVien(fx.db, admin, tam.id, {
      chuyenGiaoCho: fx.teacherB,
    });

    expect(ketQua.trangThai).toBe('da-xoa');
    expect(await fx.db.user.findUnique({ where: { id: tam.id } })).toBeNull();

    // The class survived and now belongs to the successor.
    const lop = await fx.db.class.findUniqueOrThrow({
      where: { id: lopTam.id },
      select: { teacherId: true },
    });
    expect(lop.teacherId).toBe(fx.teacherB);

    await fx.db.class.delete({ where: { id: lopTam.id } });
  });

  it('ghi nhật ký kiểm toán TRƯỚC khi xoá, nên bản ghi sống sót', async () => {
    const tam = await fx.db.user.create({
      data: {
        username: `${fx.prefix}-gv-nhatky`,
        displayName: 'Giáo viên nhật ký',
        role: 'TEACHER',
        passwordHash: fx.passwordHash,
      },
      select: { id: true },
    });

    await xoaTaiKhoanNhanVien(fx.db, admin, tam.id);

    const log = await fx.db.auditLog.findFirst({
      where: { action: 'account.deleted', entityId: tam.id },
    });
    // AuditLog.actorId is SET NULL on delete but entityId is a plain string, so
    // "who was removed" outlives the row it describes.
    expect(log).not.toBeNull();

    await fx.db.auditLog.deleteMany({ where: { entityId: tam.id } });
  });
});

describe('nguoiCoTheNhanBanGiao', () => {
  it('chỉ liệt kê nhân sự đang hoạt động, trừ chính người bị thay', async () => {
    const danhSach = await nguoiCoTheNhanBanGiao(fx.db, fx.teacherB);

    expect(danhSach.every((n) => n.role !== 'STUDENT')).toBe(true);
    expect(danhSach.some((n) => n.id === fx.teacherB)).toBe(false);
    expect(danhSach.some((n) => n.id === fx.admin)).toBe(true);
  });
});
