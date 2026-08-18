/**
 * Teacher data layer, against real Postgres.
 *
 * The question these answer is the one the brief makes non-negotiable: can a
 * teacher reach a child they do not teach? Everything else here is secondary.
 */
import { ForbiddenError } from '@dye/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  danhSachKhoaHoc,
  duLieuBangGiaoVien,
  duLieuGiaoTrinh,
  duLieuHocSinh,
  duLieuLop,
  duLieuNhanVien,
  nhanhKeTiep,
} from './teacher-data';

import type { Actor } from '@dye/core';
import type { PrismaClient } from '@prisma/client';

const { PrismaClient: Client } = await import('@prisma/client');

const db = new Client({
  datasources: { db: { url: process.env['DATABASE_URL'] ?? '' } },
  log: ['error'],
}) as PrismaClient;

const prefix = `p6-${Math.random().toString(36).slice(2, 8)}`;

interface Boi {
  giaoVienA: Actor;
  giaoVienB: Actor;
  quanTri: Actor;
  hsA1: string;
  hsA2: string;
  hsB1: string;
  lopA: string;
  lopB: string;
  courseId: string;
}

let boi: Boi;
const userIds: string[] = [];
const classIds: string[] = [];

async function taoNguoi(
  suffix: string,
  role: 'ADMIN' | 'TEACHER' | 'STUDENT',
): Promise<Actor> {
  const row = await db.user.create({
    data: {
      username: `${prefix}-${suffix}`,
      displayName: `${prefix} ${suffix}`,
      role,
      passwordHash: 'x',
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });
  userIds.push(row.id);
  return row;
}

beforeAll(async () => {
  const giaoVienA = await taoNguoi('gv-a', 'TEACHER');
  const giaoVienB = await taoNguoi('gv-b', 'TEACHER');
  const quanTri = await taoNguoi('admin', 'ADMIN');
  const a1 = await taoNguoi('hs-a1', 'STUDENT');
  const a2 = await taoNguoi('hs-a2', 'STUDENT');
  const b1 = await taoNguoi('hs-b1', 'STUDENT');

  const course = await db.course.findUniqueOrThrow({
    where: { slug: 'python-co-ban' },
    select: { id: true },
  });

  const lopA = await db.class.create({
    data: { code: `${prefix}-A`, name: `${prefix} Lớp A`, teacherId: giaoVienA.id },
    select: { id: true },
  });
  const lopB = await db.class.create({
    data: { code: `${prefix}-B`, name: `${prefix} Lớp B`, teacherId: giaoVienB.id },
    select: { id: true },
  });
  classIds.push(lopA.id, lopB.id);

  await db.classCourse.createMany({
    data: [
      { classId: lopA.id, courseId: course.id },
      { classId: lopB.id, courseId: course.id },
    ],
  });

  await db.enrollment.createMany({
    data: [
      { classId: lopA.id, studentId: a1.id, isActive: true },
      { classId: lopA.id, studentId: a2.id, isActive: true },
      { classId: lopB.id, studentId: b1.id, isActive: true },
    ],
  });

  // Give A1 a real footprint so the analytics have something to compute on.
  const lessons = await db.lesson.findMany({
    where: { courseId: course.id, order: { lte: 6 } },
    select: { id: true },
    orderBy: { order: 'asc' },
  });
  for (const l of lessons) {
    await db.lessonProgress.create({
      data: {
        studentId: a1.id,
        lessonId: l.id,
        state: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  boi = {
    giaoVienA,
    giaoVienB,
    quanTri,
    hsA1: a1.id,
    hsA2: a2.id,
    hsB1: b1.id,
    lopA: lopA.id,
    lopB: lopB.id,
    courseId: course.id,
  };
});

afterAll(async () => {
  // Same RESTRICT constraints as the core fixtures: pedagogical decisions
  // outlive their author, so they must be cleared before the users go.
  await db.trackAssignment.deleteMany({
    where: { OR: [{ studentId: { in: userIds } }, { assignedBy: { in: userIds } }] },
  });
  await db.lessonOverride.deleteMany({
    where: { OR: [{ studentId: { in: userIds } }, { createdBy: { in: userIds } }] },
  });
  await db.feedback.deleteMany({ where: { authorId: { in: userIds } } });
  await db.announcement.deleteMany({ where: { authorId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
  await db.class.deleteMany({ where: { id: { in: classIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Ranh giới dữ liệu giữa hai giáo viên', () => {
  it('giáo viên A KHÔNG mở được lớp của giáo viên B', async () => {
    await expect(duLieuLop(boi.giaoVienA, boi.lopB)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('giáo viên A KHÔNG xem được học sinh của giáo viên B', async () => {
    await expect(duLieuHocSinh(boi.giaoVienA, boi.hsB1)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('bảng tổng quan của A chỉ chứa lớp của A', async () => {
    const data = await duLieuBangGiaoVien(boi.giaoVienA);
    const ma = data.lop.map((l) => l.classId);

    expect(ma).toContain(boi.lopA);
    expect(ma).not.toContain(boi.lopB);
  });

  it('không có học sinh của B lọt vào danh sách chú ý của A', async () => {
    const data = await duLieuBangGiaoVien(boi.giaoVienA);
    const ids = [...data.canHoTro, ...data.diNhanh].map((h) => h.studentId);
    expect(ids).not.toContain(boi.hsB1);
  });

  it('giáo viên A mở được lớp của chính mình', async () => {
    const lop = await duLieuLop(boi.giaoVienA, boi.lopA);
    expect(lop).not.toBeNull();
    expect(lop?.hocSinh.map((h) => h.studentId).sort()).toEqual([boi.hsA1, boi.hsA2].sort());
  });

  it('quản trị viên xem được mọi lớp', async () => {
    const a = await duLieuLop(boi.quanTri, boi.lopA);
    const b = await duLieuLop(boi.quanTri, boi.lopB);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it('tài khoản bị vô hiệu hoá mất quyền ngay lập tức', async () => {
    const treo: Actor = { ...boi.giaoVienA, isActive: false };
    await expect(duLieuLop(treo, boi.lopA)).rejects.toThrow();
  });
});

describe('Phân tích lớp', () => {
  it('tiến độ tính theo mẫu số riêng của từng em, không phải toàn khoá', async () => {
    const lop = await duLieuLop(boi.giaoVienA, boi.lopA, boi.courseId);
    const a1 = lop?.hocSinh.find((h) => h.studentId === boi.hsA1);

    expect(a1).toBeDefined();
    // A1 finished 6 lessons. The denominator is A1's required work on their own
    // tier — never the raw 30 sessions in the course.
    expect(a1?.progress.required.completed).toBe(6);
    expect(a1?.progress.required.total).toBeLessThan(30);
  });

  it('em chưa học buổi nào vẫn xuất hiện trong danh sách, ở mức 0%', async () => {
    const lop = await duLieuLop(boi.giaoVienA, boi.lopA, boi.courseId);
    const a2 = lop?.hocSinh.find((h) => h.studentId === boi.hsA2);

    expect(a2).toBeDefined();
    expect(a2?.progress.required.completed).toBe(0);
  });

  it('danh sách được sắp theo tên, không theo thứ hạng', async () => {
    // Ranking children by progress is exactly what the brief forbids. The
    // roster is alphabetical so the table cannot be read as a league table.
    const lop = await duLieuLop(boi.giaoVienA, boi.lopA, boi.courseId);
    const ten = lop?.hocSinh.map((h) => h.displayName) ?? [];
    expect(ten).toEqual([...ten].sort((a, b) => a.localeCompare(b, 'vi')));
  });
});

describe('Chi tiết học sinh & can thiệp', () => {
  it('trả về lộ trình đã giải theo engine Phase 4', async () => {
    const hs = await duLieuHocSinh(boi.giaoVienA, boi.hsA1, boi.courseId);

    expect(hs).not.toBeNull();
    expect(hs?.baiHoc.length).toBe(30);
    // Six done, so lesson 7 is the first still open.
    expect(hs?.baiHoc.filter((b) => b.completed).length).toBe(6);
  });

  it('can thiệp của giáo viên mở được bài đang khoá', async () => {
    const truoc = await duLieuHocSinh(boi.giaoVienA, boi.hsA2, boi.courseId);
    const baiKhoa = truoc?.baiHoc.find((b) => !b.unlocked);
    expect(baiKhoa).toBeDefined();

    await db.lessonOverride.create({
      data: {
        lessonId: baiKhoa!.lessonId,
        studentId: boi.hsA2,
        isUnlocked: true,
        waivePrerequisites: true,
        reason: 'em đã học trước ở nhà',
        createdBy: boi.giaoVienA.id,
      },
    });

    const sau = await duLieuHocSinh(boi.giaoVienA, boi.hsA2, boi.courseId);
    const baiSau = sau?.baiHoc.find((b) => b.lessonId === baiKhoa!.lessonId);

    expect(baiSau?.unlocked).toBe(true);
    expect(baiSau?.teacherOverridden).toBe(true);
    expect(sau?.canThiep.some((c) => c.lessonId === baiKhoa!.lessonId)).toBe(true);
  });

  it('tiêu đề bài học trong danh sách can thiệp đã gỡ markdown', async () => {
    const hs = await duLieuHocSinh(boi.giaoVienA, boi.hsA2, boi.courseId);
    for (const c of hs?.canThiep ?? []) {
      // The Phase 5 defect, asserted at the data layer so it cannot come back.
      expect(c.lessonTitle).not.toContain('`');
      expect(c.lessonTitle).not.toContain('**');
    }
  });

  it('đổi nhánh học làm đổi mẫu số bắt buộc của em đó', async () => {
    const coBan = await duLieuHocSinh(boi.giaoVienA, boi.hsA1, boi.courseId);
    const tongCoBan = coBan?.progress.required.total ?? 0;

    await db.trackAssignment.upsert({
      where: { studentId_courseId: { studentId: boi.hsA1, courseId: boi.courseId } },
      create: {
        studentId: boi.hsA1,
        courseId: boi.courseId,
        tier: 'NANG_CAO',
        assignedBy: boi.giaoVienA.id,
      },
      update: { tier: 'NANG_CAO', assignedBy: boi.giaoVienA.id },
    });

    const nangCao = await duLieuHocSinh(boi.giaoVienA, boi.hsA1, boi.courseId);

    // The core promise of Phase 4, visible from the teacher side: the same
    // course asks different amounts of two students.
    expect(nangCao?.tier).toBe('NANG_CAO');
    expect(nangCao?.progress.required.total).toBeGreaterThan(tongCoBan);
  });
});

describe('Giáo trình — góc nhìn giáo viên', () => {
  it('giáo viên đọc được ghi chú giáo án', async () => {
    const gt = await duLieuGiaoTrinh(boi.giaoVienA, 'python-co-ban');

    expect(gt).not.toBeNull();
    expect(gt?.soBuoiCoGhiChu).toBeGreaterThan(0);

    const coGhiChu = gt?.modules.flatMap((m) => m.baiHoc).filter((b) => b.teacherNotes);
    expect(coGhiChu?.length).toBeGreaterThan(0);
  });

  it('học sinh KHÔNG đọc được giáo trình ở góc nhìn này', async () => {
    const hocSinh: Actor = {
      id: boi.hsA1,
      username: 'x',
      displayName: 'x',
      role: 'STUDENT',
      isActive: true,
      mustChangePassword: false,
    };
    await expect(duLieuGiaoTrinh(hocSinh, 'python-co-ban')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('hiện đủ 30 buổi, chia theo chương', async () => {
    const gt = await duLieuGiaoTrinh(boi.giaoVienA, 'python-co-ban');
    const tong = gt?.modules.reduce((n, m) => n + m.baiHoc.length, 0) ?? 0;
    expect(tong).toBe(30);
  });

  it('đếm khối theo nhánh để thấy phân hoá nằm ở đâu', async () => {
    const gt = await duLieuGiaoTrinh(boi.giaoVienA, 'python-co-ban');
    const bai = gt?.modules.flatMap((m) => m.baiHoc) ?? [];
    // At least one session carries content above CO_BAN — that is what makes
    // one URL serve four audiences.
    expect(
      bai.some((b) => b.soKhoiTheoNhanh.NANG_CAO > 0 || b.soKhoiTheoNhanh.MO_RONG > 0),
    ).toBe(true);
  });

  it('liệt kê đủ các khoá đang có, kể cả khoá Micro:bit mới thêm', async () => {
    const khoa = await danhSachKhoaHoc();
    const slug = khoa.map((k) => k.slug);

    // Asserted by membership, not by count: adding a course is a normal event
    // and must not require editing an unrelated test.
    expect(slug).toEqual(
      expect.arrayContaining([
        'python-co-ban',
        'lap-trinh-game-pygame',
        'python-nang-cao',
        'microbit-co-ban',
      ]),
    );
  });
});

describe('Quản lý nhân sự', () => {
  it('giáo viên không lấy được danh sách nhân sự', async () => {
    const data = await duLieuNhanVien(boi.giaoVienA);
    expect(data.nhanVien).toEqual([]);
  });

  it('quản trị viên thấy danh sách và biết dòng nào là chính mình', async () => {
    const data = await duLieuNhanVien(boi.quanTri);
    const toi = data.nhanVien.find((n) => n.id === boi.quanTri.id);

    expect(toi?.laToi).toBe(true);
    expect(data.nhanVien.every((n) => n.role !== 'STUDENT')).toBe(true);
  });
});

describe('nhanhKeTiep', () => {
  it('đi lên đúng thang bốn bậc', () => {
    expect(nhanhKeTiep('CO_BAN')).toBe('THU_THACH');
    expect(nhanhKeTiep('THU_THACH')).toBe('NANG_CAO');
    expect(nhanhKeTiep('NANG_CAO')).toBe('MO_RONG');
  });

  it('trả null ở bậc cao nhất, không vòng lại', () => {
    expect(nhanhKeTiep('MO_RONG')).toBeNull();
  });
});
