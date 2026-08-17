/**
 * Student data pipeline — integration test against real PostgreSQL.
 *
 * Walks the exact path a student takes:
 *
 *     dashboard → "Học tiếp" target → lesson player → blocks
 *
 * and asserts that what the view model hands the UI matches what the Phase 4
 * engine decided — including the parts that must NOT be handed over, such as
 * quiz answers and hidden test cases.
 */
import { randomBytes } from 'node:crypto';

import { hashPassword } from '@dye/core';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { duLieuBaiHoc, duLieuBangDieuKhien, duLieuBanDoKhoaHoc } from './student-data';

import type { Tier } from '@prisma/client';

const db = new PrismaClient();

const prefix = `p5-${randomBytes(4).toString('hex')}`;
let coBanId = '';
let nangCaoId = '';
let teacherId = '';
let classId = '';
let courseId = '';
let lessonByOrder = new Map<number, { id: string; slug: string }>();

beforeAll(async () => {
  const passwordHash = await hashPassword('PhaseNamTest#2026');

  const mk = async (suffix: string, role: 'TEACHER' | 'STUDENT'): Promise<string> =>
    (
      await db.user.create({
        data: {
          username: `${prefix}-${suffix}`,
          displayName: `${prefix} ${suffix}`,
          role,
          passwordHash,
        },
        select: { id: true },
      })
    ).id;

  teacherId = await mk('gv', 'TEACHER');
  coBanId = await mk('hs-co-ban', 'STUDENT');
  nangCaoId = await mk('hs-nang-cao', 'STUDENT');

  const course = await db.course.findUniqueOrThrow({
    where: { slug: 'python-co-ban' },
    select: { id: true },
  });
  courseId = course.id;

  classId = (
    await db.class.create({
      data: { code: `${prefix}-LOP`, name: `${prefix} Lớp`, teacherId },
      select: { id: true },
    })
  ).id;

  await db.classCourse.create({ data: { classId, courseId } });
  await db.enrollment.createMany({
    data: [
      { classId, studentId: coBanId },
      { classId, studentId: nangCaoId },
    ],
  });

  const tier = async (studentId: string, t: Tier): Promise<void> => {
    await db.trackAssignment.create({
      data: { studentId, courseId, tier: t, assignedBy: teacherId },
    });
  };
  await tier(coBanId, 'CO_BAN');
  await tier(nangCaoId, 'NANG_CAO');

  const lessons = await db.lesson.findMany({
    where: { courseId },
    select: { id: true, slug: true, order: true },
    orderBy: { order: 'asc' },
  });
  lessonByOrder = new Map(lessons.map((l) => [l.order, { id: l.id, slug: l.slug }]));
});

afterAll(async () => {
  const ids = [teacherId, coBanId, nangCaoId].filter(Boolean);

  // `TrackAssignment.assignedBy` and `LessonOverride.createdBy` reference the
  // teacher with RESTRICT, not CASCADE — deleting a teacher who has made
  // pedagogical decisions is deliberately blocked. Clear those rows first.
  await db.trackAssignment.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { assignedBy: { in: ids } }] } });
  await db.lessonOverride.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { createdBy: { in: ids } }] } });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });

  if (classId) await db.class.deleteMany({ where: { id: classId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

async function hoanThanhToi(studentId: string, den: number): Promise<void> {
  for (let order = 1; order <= den; order += 1) {
    const l = lessonByOrder.get(order);
    if (!l) continue;
    await db.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId: l.id } },
      create: { studentId, lessonId: l.id, state: 'COMPLETED', completedAt: new Date() },
      update: { state: 'COMPLETED', completedAt: new Date() },
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Luồng "Học tiếp"
// ═══════════════════════════════════════════════════════════════════════════

describe('Luồng Học tiếp → bài học', () => {
  it('bảng điều khiển chỉ đúng bài kế tiếp của em', async () => {
    const data = await duLieuBangDieuKhien(coBanId);

    expect(data.courses).toHaveLength(1);
    expect(data.tiepTuc).not.toBeNull();
    // Chưa học gì thì bài kế tiếp là buổi 1.
    expect(data.tiepTuc?.lessonOrder).toBe(1);
    expect(data.tiepTuc?.courseSlug).toBe('python-co-ban');
  });

  it('học xong vài buổi thì nút Học tiếp dịch theo', async () => {
    await hoanThanhToi(coBanId, 3);

    const data = await duLieuBangDieuKhien(coBanId);
    expect(data.tiepTuc?.lessonOrder).toBe(4);
    expect(data.tongBaiDaXong).toBe(3);
  });

  it('bấm Học tiếp mở được đúng bài đó, không lỗi', async () => {
    const data = await duLieuBangDieuKhien(coBanId);
    const slug = data.tiepTuc?.lessonSlug;
    expect(slug).toBeDefined();

    const kq = await duLieuBaiHoc(coBanId, slug!);
    expect(kq.trangThai).toBe('ok');
    if (kq.trangThai !== 'ok') return;
    expect(kq.bai.order).toBe(4);
    expect(kq.bai.blocks.length).toBeGreaterThan(0);
  });

  it('nút Học tiếp KHÔNG BAO GIỜ trỏ tới bài đang khoá', async () => {
    // Bất biến quan trọng nhất của nút này: bấm vào là vào được.
    for (const studentId of [coBanId, nangCaoId]) {
      const data = await duLieuBangDieuKhien(studentId);
      if (!data.tiepTuc) continue;
      const kq = await duLieuBaiHoc(studentId, data.tiepTuc.lessonSlug);
      expect(kq.trangThai, `${data.tiepTuc.lessonSlug} phải mở được`).toBe('ok');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phân hoá hiển thị đúng theo nhánh
// ═══════════════════════════════════════════════════════════════════════════

describe('Nội dung hiển thị khác nhau theo nhánh', () => {
  it('hai nhánh có mẫu số tiến độ khác nhau trên cùng khoá học', async () => {
    const coBan = await duLieuBangDieuKhien(coBanId);
    const nangCao = await duLieuBangDieuKhien(nangCaoId);

    expect(coBan.courses[0]?.progress.required.total).toBe(19);
    expect(nangCao.courses[0]?.progress.required.total).toBe(20);
  });

  it('buổi 17: học sinh Cơ bản thấy khối lượng giác là KHÁM PHÁ, Nâng cao thấy là chính', async () => {
    const slug = lessonByOrder.get(17)!.slug;

    // Mở khoá buổi 17 cho cả hai bằng override của giáo viên.
    for (const studentId of [coBanId, nangCaoId]) {
      await db.lessonOverride.create({
        data: { lessonId: lessonByOrder.get(17)!.id, studentId, isUnlocked: true, createdBy: teacherId },
      });
    }

    const kqCoBan = await duLieuBaiHoc(coBanId, slug);
    const kqNangCao = await duLieuBaiHoc(nangCaoId, slug);
    expect(kqCoBan.trangThai).toBe('ok');
    expect(kqNangCao.trangThai).toBe('ok');
    if (kqCoBan.trangThai !== 'ok' || kqNangCao.trangThai !== 'ok') return;

    const coBan = kqCoBan.bai;
    const nangCao = kqNangCao.bai;

    // Cùng số khối — không giấu gì cả.
    expect(coBan.blocks.length).toBe(nangCao.blocks.length);

    const khamPhaCoBan = coBan.blocks.filter((b) => b.access === 'EXPLORATION');
    const khamPhaNangCao = nangCao.blocks.filter((b) => b.access === 'EXPLORATION');

    expect(khamPhaCoBan.length).toBeGreaterThan(0);
    expect(khamPhaNangCao).toHaveLength(0);

    // Và phần bắt buộc của Nâng cao nhiều hơn.
    expect(nangCao.soBatBuoc).toBeGreaterThan(coBan.soBatBuoc);
  });

  it('bản đồ khoá học đánh dấu đúng bài nào bắt buộc với từng em', async () => {
    const coBan = await duLieuBanDoKhoaHoc(coBanId, 'python-co-ban');
    const nangCao = await duLieuBanDoKhoaHoc(nangCaoId, 'python-co-ban');

    const demBatBuoc = (d: typeof coBan): number =>
      d?.modules.reduce((n, m) => n + m.soBatBuoc, 0) ?? 0;

    expect(demBatBuoc(coBan)).toBe(19);
    expect(demBatBuoc(nangCao)).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bảo mật dữ liệu gửi xuống trình duyệt
// ═══════════════════════════════════════════════════════════════════════════

describe('Dữ liệu gửi xuống trình duyệt không lộ đáp án', () => {
  it('lựa chọn trắc nghiệm KHÔNG kèm cờ isCorrect', async () => {
    const kq = await duLieuBaiHoc(coBanId, lessonByOrder.get(1)!.slug);
    if (kq.trangThai !== 'ok') throw new Error('Buổi 1 phải mở được');
    const quiz = kq.bai.blocks.find((b) => b.tracNghiem)?.tracNghiem;

    expect(quiz).toBeDefined();
    expect(quiz!.questions.length).toBeGreaterThan(0);

    for (const cau of quiz!.questions) {
      for (const chon of cau.choices) {
        // Nếu trường này lọt xuống, học sinh chỉ cần mở DevTools là thấy đáp án.
        expect(Object.keys(chon).sort()).toEqual(['id', 'text']);
      }
    }
  });

  it('bài tập chỉ gửi test mẫu, không gửi test ẩn hay lời giải', async () => {
    // Buổi 6 là bài đầu tiên có bài tập chấm điểm.
    await db.lessonOverride.create({
      data: { lessonId: lessonByOrder.get(6)!.id, studentId: coBanId, isUnlocked: true, createdBy: teacherId },
    });

    const kq = await duLieuBaiHoc(coBanId, lessonByOrder.get(6)!.slug);
    if (kq.trangThai !== 'ok') throw new Error('Buổi 6 phải mở được sau override');
    const baiTap = kq.bai.blocks.find((b) => b.baiTap)?.baiTap;

    expect(baiTap).toBeDefined();
    expect(baiTap!.viDu.length).toBeGreaterThan(0);
    expect(Object.keys(baiTap!)).not.toContain('solutionCode');

    const soTestMau = baiTap!.viDu.length;
    const tongTest = await db.testCase.count({ where: { problemId: baiTap!.problemId } });
    // Test ẩn ở lại phía máy chủ.
    expect(soTestMau).toBeLessThan(tongTest);
  });

  it('bài học không gửi kèm ghi chú dành riêng cho giáo viên', async () => {
    const kq = await duLieuBaiHoc(coBanId, lessonByOrder.get(1)!.slug);
    if (kq.trangThai !== 'ok') throw new Error('Buổi 1 phải mở được');
    expect(Object.keys(kq.bai)).not.toContain('teacherNotes');
    expect(JSON.stringify(kq.bai)).not.toContain('GHI CHÚ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bài khoá
// ═══════════════════════════════════════════════════════════════════════════

describe('Bài bị khoá', () => {
  it('gõ thẳng địa chỉ bài chưa mở thì nhận trạng thái khoá, KHÔNG phải lỗi máy chủ', async () => {
    // Học sinh Nâng cao chưa học gì, buổi 10 phải khoá.
    // Trả về trạng thái thay vì ném lỗi: ném lỗi ở đây sẽ thành HTTP 500 kèm
    // vỏ lỗi nội bộ của Next.js, trong khi đây là hành vi hoàn toàn bình thường.
    const kq = await duLieuBaiHoc(nangCaoId, lessonByOrder.get(10)!.slug);
    expect(kq.trangThai).toBe('khoa');
  });

  it('thông báo nói rõ cần hoàn thành bài nào', async () => {
    const kq = await duLieuBaiHoc(nangCaoId, lessonByOrder.get(10)!.slug);
    expect(kq.trangThai === 'khoa' && kq.lyDo).toMatch(/Buổi 9/);
  });

  it('bài bị khoá KHÔNG hề nạp nội dung khối lên — dữ liệu không rời máy chủ', async () => {
    const kq = await duLieuBaiHoc(nangCaoId, lessonByOrder.get(10)!.slug);
    expect(Object.keys(kq)).not.toContain('bai');
    expect(JSON.stringify(kq)).not.toContain('markdown');
  });

  it('bản đồ khoá học hiện lý do khoá thay vì chỉ một ổ khoá câm', async () => {
    const banDo = await duLieuBanDoKhoaHoc(nangCaoId, 'python-co-ban');
    const bai10 = banDo?.modules.flatMap((m) => m.lessons).find((l) => l.order === 10);

    expect(bai10?.unlocked).toBe(false);
    expect(bai10?.lockReason).toContain('Buổi 9');
  });

  it('khoá học không tồn tại trả về null, không ném lỗi', async () => {
    expect(await duLieuBanDoKhoaHoc(coBanId, 'khong-ton-tai')).toBeNull();
  });
});
