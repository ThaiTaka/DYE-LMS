/**
 * Server-action layer for the code editor, against real Postgres.
 *
 * The core engine is tested in packages/core; this covers the layer above it —
 * the part that decides who the caller is, converts a refusal into something the
 * editor can display, and serialises dates for the client. That layer is where a
 * mistake shows up as "the student's work silently stopped saving".
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Actor } from '@dye/core';
import type { PrismaClient } from '@prisma/client';

const { PrismaClient: Client } = await import('@prisma/client');

const db = new Client({
  datasources: { db: { url: process.env['DATABASE_URL'] ?? '' } },
  log: ['error'],
}) as PrismaClient;

/** Swapped per test to impersonate a student, a teacher, or nobody. */
let dienVien: Actor | null = null;

vi.mock('@/auth', () => ({
  currentActor: () => Promise.resolve(dienVien),
  signOut: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
  khoiPhuc,
  layBanNhap,
  layLichSu,
  layLichSuNop,
  layNoiDungBanLuu,
  nop,
  tuDongLuu,
} = await import('./code-actions');

const prefix = `p7-${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];
const classIds: string[] = [];

let hocSinh: Actor;
let giaoVien: Actor;
let khoiMo: string;
let khoiKhoa: string;

async function taoNguoi(suffix: string, role: 'TEACHER' | 'STUDENT'): Promise<Actor> {
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
  giaoVien = await taoNguoi('gv', 'TEACHER');
  hocSinh = await taoNguoi('hs', 'STUDENT');

  const course = await db.course.findUniqueOrThrow({
    where: { slug: 'python-co-ban' },
    select: { id: true },
  });

  const lop = await db.class.create({
    data: { code: `${prefix}-LOP`, name: `${prefix} Lớp`, teacherId: giaoVien.id },
    select: { id: true },
  });
  classIds.push(lop.id);

  await db.classCourse.create({ data: { classId: lop.id, courseId: course.id } });
  await db.enrollment.create({
    data: { classId: lop.id, studentId: hocSinh.id, isActive: true },
  });

  const problem = await db.problem.findFirstOrThrow({ select: { id: true } });

  const baiMot = await db.lesson.findFirstOrThrow({
    where: { courseId: course.id, order: 1 },
    select: { id: true },
  });
  const k1 = await db.lessonBlock.findFirstOrThrow({
    where: { lessonId: baiMot.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  await db.lessonBlock.update({ where: { id: k1.id }, data: { problemId: problem.id } });
  khoiMo = k1.id;

  const baiSau = await db.lesson.findFirstOrThrow({
    where: { courseId: course.id, order: 12 },
    select: { id: true },
  });
  khoiKhoa = (
    await db.lessonBlock.findFirstOrThrow({
      where: { lessonId: baiSau.id },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
  ).id;
});

beforeEach(() => {
  dienVien = hocSinh;
});

afterAll(async () => {
  await db.codeSnapshot.deleteMany({ where: { studentId: { in: userIds } } });
  await db.codeDraft.deleteMany({ where: { studentId: { in: userIds } } });
  await db.submission.deleteMany({ where: { studentId: { in: userIds } } });
  await db.trackAssignment.deleteMany({ where: { assignedBy: { in: userIds } } });
  await db.lessonOverride.deleteMany({ where: { createdBy: { in: userIds } } });
  await db.class.deleteMany({ where: { id: { in: classIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Ai được gọi các hành động này', () => {
  it('chưa đăng nhập thì bị từ chối, không phải lỗi hệ thống', async () => {
    dienVien = null;
    const kq = await tuDongLuu(khoiMo, 'print(1)');

    expect(kq.trangThai).toBe('tu-choi');
    // An autosave loop must never replace the lesson with a crash page.
    expect(kq.thongDiep).toMatch(/đăng nhập/i);
  });

  it('giáo viên không có bản nháp — đây là không gian của học sinh', async () => {
    dienVien = giaoVien;
    const kq = await tuDongLuu(khoiMo, 'print(1)');
    expect(kq.trangThai).toBe('tu-choi');
  });

  it('học sinh trong lớp thì lưu được', async () => {
    const kq = await tuDongLuu(khoiMo, 'print("xin chao")\n');
    expect(kq.trangThai).toBe('da-luu');
    expect(kq.luuLuc).not.toBeNull();
  });
});

describe('Tự động lưu qua tầng hành động', () => {
  it('lưu lại y nguyên nội dung thì báo "không đổi"', async () => {
    await tuDongLuu(khoiMo, 'print("giong het")\n');
    const kq = await tuDongLuu(khoiMo, 'print("giong het")\n');

    // The client also guards this; the server is the one that must be right.
    expect(kq.trangThai).toBe('khong-doi');
  });

  it('trả về thời điểm lưu dạng chuỗi ISO cho client', async () => {
    const kq = await tuDongLuu(khoiMo, `print(${Date.now()})\n`);
    expect(kq.luuLuc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('đọc lại đúng bản đã lưu', async () => {
    const ma = 'ten = "An"\nprint(ten)\n';
    await tuDongLuu(khoiMo, ma);

    const kq = await layBanNhap(khoiMo);
    expect(kq.trangThai).toBe('ok');
    expect(kq.code).toBe(ma);
    expect(kq.laBanNhap).toBe(true);
  });
});

describe('Bài học bị khoá', () => {
  it('tự động lưu bị từ chối kèm lý do đọc được', async () => {
    const kq = await tuDongLuu(khoiKhoa, 'print(1)');

    expect(kq.trangThai).toBe('tu-choi');
    // The lock reason says what to finish first and leaks nothing about anyone.
    expect(kq.thongDiep.length).toBeGreaterThan(0);
  });

  it('nộp bài bị từ chối', async () => {
    const kq = await nop(khoiKhoa, 'print(1)');
    expect(kq.trangThai).toBe('tu-choi');
    expect(kq.submissionId).toBeNull();
  });

  it('không dòng nào được ghi khi bị từ chối', async () => {
    await tuDongLuu(khoiKhoa, 'print(1)');
    await nop(khoiKhoa, 'print(1)');

    const draft = await db.codeDraft.findUnique({
      where: { studentId_blockId: { studentId: hocSinh.id, blockId: khoiKhoa } },
    });
    expect(draft).toBeNull();
  });
});

describe('Lịch sử và quay lại', () => {
  it('liệt kê được các bản đã lưu', async () => {
    await tuDongLuu(khoiMo, 'print("ban mot")\n');
    await db.codeSnapshot.updateMany({
      where: { studentId: hocSinh.id, blockId: khoiMo },
      data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) },
    });
    await tuDongLuu(khoiMo, 'print("ban hai")\n');

    const kq = await layLichSu(khoiMo);
    expect(kq.trangThai).toBe('ok');
    expect(kq.banLuu.length).toBeGreaterThan(0);
    expect(kq.banLuu[0]?.luuLuc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('xem được toàn văn một bản cũ', async () => {
    const ls = await layLichSu(khoiMo);
    const ban = ls.banLuu[ls.banLuu.length - 1]!;

    const kq = await layNoiDungBanLuu(khoiMo, ban.version);
    expect(kq.trangThai).toBe('ok');
    expect(kq.code.length).toBeGreaterThan(0);
  });

  it('quay lại bản cũ và giữ nguyên bản đang viết', async () => {
    await db.codeSnapshot.updateMany({
      where: { studentId: hocSinh.id, blockId: khoiMo },
      data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) },
    });
    await tuDongLuu(khoiMo, 'print("bản em đang viết dở")\n');

    const ls = await layLichSu(khoiMo);
    const banCu = ls.banLuu[ls.banLuu.length - 1]!;
    const noiDungCu = (await layNoiDungBanLuu(khoiMo, banCu.version)).code;

    const kq = await khoiPhuc(khoiMo, banCu.version);

    expect(kq.trangThai).toBe('ok');
    expect(kq.code).toBe(noiDungCu);
    // The message tells the student their in-progress version was kept.
    expect(kq.thongDiep).toMatch(/giữ lại/i);

    const sau = await layBanNhap(khoiMo);
    expect(sau.code).toBe(noiDungCu);
  });

  it('quay lại bản không tồn tại bị từ chối, không nổ', async () => {
    const kq = await khoiPhuc(khoiMo, 99_999);
    expect(kq.trangThai).toBe('tu-choi');
  });
});

describe('Nộp bài', () => {
  it('ghi đúng metadata và để ở trạng thái chờ chấm', async () => {
    const kq = await nop(khoiMo, 'print("bai nop cua em")\n');

    expect(kq.trangThai).toBe('da-nhan');
    expect(kq.submissionId).not.toBeNull();

    const row = await db.submission.findUniqueOrThrow({
      where: { id: kq.submissionId! },
      select: { studentId: true, code: true, verdict: true, queuedAt: true, lessonId: true },
    });

    expect(row.studentId).toBe(hocSinh.id);
    expect(row.code).toBe('print("bai nop cua em")\n');
    // Honest state: accepted, not yet judged. Phase 8 moves it on.
    expect(row.verdict).toBe('PENDING');
    expect(row.queuedAt).not.toBeNull();
    expect(row.lessonId).not.toBeNull();
  });

  it('thông báo cho học sinh biết bài đang chờ chấm, không nói là đã đúng', async () => {
    const kq = await nop(khoiMo, 'print("lan nua")\n');
    expect(kq.thongDiep).toMatch(/chờ được chấm/i);
    // Telling a child their code passed when nothing ran is a lie they cannot
    // detect, and it teaches them the verdict means nothing.
    expect(kq.thongDiep).not.toMatch(/đúng rồi|hoàn hảo|chính xác/i);
  });

  it('lịch sử nộp bài đánh dấu đang chờ', async () => {
    const kq = await layLichSuNop(khoiMo);
    expect(kq.trangThai).toBe('ok');
    expect(kq.baiNop.length).toBeGreaterThan(0);
    expect(kq.baiNop[0]?.dangCho).toBe(true);
    expect(kq.baiNop[0]?.nopLuc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
