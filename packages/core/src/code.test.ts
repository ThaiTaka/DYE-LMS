/**
 * Drafts, history and submission, against real Postgres.
 *
 * The three claims Phase 7 must actually prove:
 *   • an unchanged autosave writes nothing;
 *   • a student can list history and roll back to an older version;
 *   • a locked lesson refuses code writes, not just hides the editor.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  bamMa,
  docNhap,
  GIOI_HAN_KY_TU,
  khoiPhucBanLuu,
  lichSuMa,
  lichSuNopBai,
  luuNhap,
  moKhoiCode,
  nopBai,
  SO_BAN_LUU_TOI_DA,
  xemBanLuu,
} from './code';
import { ForbiddenError } from './errors';
import { createFixture, type Fixture } from './testing/fixtures';

let fx: Fixture;

/** A block in an UNLOCKED lesson (session 1 has no prerequisites). */
let khoiMo: string;
/** A block in a LOCKED lesson (a later session, prerequisites unmet). */
let khoiKhoa: string;
/** The problem behind `khoiMo`. */
let problemId: string;

const CODE_A = 'print("xin chao")\n';
const CODE_B = 'ten = "An"\nprint(f"xin chao {ten}")\n';

beforeAll(async () => {
  fx = await createFixture();

  // Attach a problem to a block in session 1 so the submit path has a target.
  const baiMot = await fx.db.lesson.findFirstOrThrow({
    where: { courseId: fx.courseId, order: 1 },
    select: { id: true },
  });
  const khoi1 = await fx.db.lessonBlock.findFirstOrThrow({
    where: { lessonId: baiMot.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  await fx.db.lessonBlock.update({
    where: { id: khoi1.id },
    data: { problemId: fx.problemId },
  });
  khoiMo = khoi1.id;
  problemId = fx.problemId;

  // Session 12 is deep enough that its prerequisite chain is unmet for a
  // student with no progress at all.
  const baiSau = await fx.db.lesson.findFirstOrThrow({
    where: { courseId: fx.courseId, order: 12 },
    select: { id: true },
  });
  const khoi12 = await fx.db.lessonBlock.findFirstOrThrow({
    where: { lessonId: baiSau.id },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  khoiKhoa = khoi12.id;
});

afterAll(async () => {
  await fx.db.codeSnapshot.deleteMany({ where: { studentId: { in: [fx.studentA1, fx.studentA2] } } });
  await fx.db.codeDraft.deleteMany({ where: { studentId: { in: [fx.studentA1, fx.studentA2] } } });

  // Detach the problem this suite attached to a SEEDED block. Without this the
  // shared dev database drifts from what `db:seed` produces — a THEORY block
  // ends up carrying a coding problem, and the next thing that queries "blocks
  // with a problem" picks up something that renders no editor at all.
  await fx.db.lessonBlock.update({ where: { id: khoiMo }, data: { problemId: null } });

  await fx.cleanup();
});

/** Rewind every snapshot for a block so an interval-sensitive test can run. */
async function luiThoiGian(studentId: string, blockId: string, phut: number): Promise<void> {
  const cu = new Date(Date.now() - phut * 60 * 1000);
  await fx.db.codeSnapshot.updateMany({
    where: { studentId, blockId },
    data: { createdAt: cu },
  });
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Tự động lưu — không ghi thừa', () => {
  it('lần lưu đầu tiên có ghi', async () => {
    const kq = await luuNhap(fx.db, fx.studentA1, khoiMo, CODE_A);
    expect(kq.daGhi).toBe(true);
  });

  it('lưu lại cùng nội dung thì KHÔNG ghi gì cả', async () => {
    const truoc = await fx.db.codeDraft.findUniqueOrThrow({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMo } },
      select: { updatedAt: true },
    });

    const kq = await luuNhap(fx.db, fx.studentA1, khoiMo, CODE_A);
    expect(kq.daGhi).toBe(false);

    const sau = await fx.db.codeDraft.findUniqueOrThrow({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMo } },
      select: { updatedAt: true },
    });
    // `updatedAt` is Prisma's own write marker: if it moved, a write happened.
    expect(sau.updatedAt.getTime()).toBe(truoc.updatedAt.getTime());
  });

  it('gọi mười lần liên tiếp cùng nội dung vẫn chỉ có một lần ghi', async () => {
    const truoc = await fx.db.codeDraft.findUniqueOrThrow({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMo } },
      select: { updatedAt: true },
    });

    const ketQua = [];
    for (let i = 0; i < 10; i += 1) {
      ketQua.push(await luuNhap(fx.db, fx.studentA1, khoiMo, CODE_A));
    }
    expect(ketQua.every((k) => k.daGhi === false)).toBe(true);

    const sau = await fx.db.codeDraft.findUniqueOrThrow({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMo } },
      select: { updatedAt: true },
    });
    expect(sau.updatedAt.getTime()).toBe(truoc.updatedAt.getTime());
  });

  it('đổi dù một ký tự là có ghi', async () => {
    const kq = await luuNhap(fx.db, fx.studentA1, khoiMo, `${CODE_A} `);
    expect(kq.daGhi).toBe(true);
    await luuNhap(fx.db, fx.studentA1, khoiMo, CODE_A);
  });

  it('từ chối bản nháp quá lớn thay vì cắt bớt', async () => {
    const qua = 'x'.repeat(GIOI_HAN_KY_TU + 1);
    // Silently keeping half a student's file would be worse than refusing.
    await expect(luuNhap(fx.db, fx.studentA1, khoiMo, qua)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('bản nháp của hai em hoàn toàn tách biệt', async () => {
    await luuNhap(fx.db, fx.studentA2, khoiMo, CODE_B);

    const a1 = await docNhap(fx.db, fx.studentA1, khoiMo);
    const a2 = await docNhap(fx.db, fx.studentA2, khoiMo);

    expect(a1.code).toBe(CODE_A);
    expect(a2.code).toBe(CODE_B);
  });

  it('chưa có bản nháp thì trả về mã khởi tạo của bài', async () => {
    const doc = await docNhap(fx.db, fx.studentB1, khoiMo);
    expect(doc.laBanNhap).toBe(false);
    expect(doc.luuLuc).toBeNull();
  });
});

describe('Lịch sử phiên bản', () => {
  it('không tạo bản lưu mới cho mỗi lần gõ', async () => {
    const truoc = await lichSuMa(fx.db, fx.studentA1, khoiMo);

    // Six distinct edits inside the snapshot interval.
    for (let i = 0; i < 6; i += 1) {
      await luuNhap(fx.db, fx.studentA1, khoiMo, `${CODE_A}# sua ${i}\n`);
    }

    const sau = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    // History is for finding a working state, not for replaying keystrokes.
    expect(sau.length).toBe(truoc.length);
  });

  it('tạo bản lưu mới khi đã qua khoảng cách quy định', async () => {
    await luiThoiGian(fx.studentA1, khoiMo, 10);
    const truoc = await lichSuMa(fx.db, fx.studentA1, khoiMo);

    const kq = await luuNhap(fx.db, fx.studentA1, khoiMo, 'print("bản mới hoàn toàn")\n');
    expect(kq.phienBanMoi).not.toBeNull();

    const sau = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    expect(sau.length).toBe(truoc.length + 1);
  });

  it('lịch sử xếp mới nhất trước và đánh số tăng dần', async () => {
    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    expect(ls.length).toBeGreaterThan(0);

    const so = ls.map((b) => b.version);
    expect(so).toEqual([...so].sort((a, b) => b - a));
  });

  it('lịch sử kèm số dòng để học sinh nhận ra bản mình cần', async () => {
    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    for (const b of ls) {
      expect(b.soDong).toBeGreaterThan(0);
      expect(b.soKyTu).toBeGreaterThan(0);
    }
  });

  it('xem được toàn văn một bản cũ', async () => {
    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    const cuNhat = ls[ls.length - 1]!;

    const ban = await xemBanLuu(fx.db, fx.studentA1, khoiMo, cuNhat.version);
    expect(ban).not.toBeNull();
    expect(typeof ban?.code).toBe('string');
  });

  it('không xem được bản lưu của bạn khác', async () => {
    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    const cua1 = ls[0]!;

    // Same block, different student: the version number simply does not exist
    // in A2's history, so there is nothing to return.
    const thu = await xemBanLuu(fx.db, fx.studentA2, khoiMo, cua1.version);
    if (thu) {
      const goc = await xemBanLuu(fx.db, fx.studentA1, khoiMo, cua1.version);
      expect(thu.code).not.toBe(goc?.code);
    }
  });
});

describe('Quay lại bản cũ', () => {
  it('khôi phục đưa bản nháp về đúng nội dung cũ', async () => {
    await luiThoiGian(fx.studentA1, khoiMo, 10);
    await luuNhap(fx.db, fx.studentA1, khoiMo, 'print("bản A")\n');

    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    const banCu = ls[ls.length - 1]!;
    const noiDungCu = (await xemBanLuu(fx.db, fx.studentA1, khoiMo, banCu.version))!.code;

    await luiThoiGian(fx.studentA1, khoiMo, 10);
    await luuNhap(fx.db, fx.studentA1, khoiMo, 'print("bản B — em làm hỏng rồi")\n');

    const kq = await khoiPhucBanLuu(fx.db, fx.studentA1, khoiMo, banCu.version);
    expect(kq.code).toBe(noiDungCu);

    const nhap = await docNhap(fx.db, fx.studentA1, khoiMo);
    expect(nhap.code).toBe(noiDungCu);
  });

  it('khôi phục KHÔNG làm mất bản đang viết dở', async () => {
    await luiThoiGian(fx.studentA1, khoiMo, 10);
    const dangViet = 'print("bản em đang viết dở")\n';
    await luuNhap(fx.db, fx.studentA1, khoiMo, dangViet);

    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    const banCu = ls[ls.length - 1]!;

    const kq = await khoiPhucBanLuu(fx.db, fx.studentA1, khoiMo, banCu.version);
    // Undo that loses work is not undo.
    expect(kq.phienBanGiuLai).not.toBeNull();

    const giuLai = await xemBanLuu(fx.db, fx.studentA1, khoiMo, kq.phienBanGiuLai!);
    expect(giuLai?.code).toBe(dangViet);
    expect(giuLai?.reason).toBe('RESTORE');
  });

  it('khôi phục vào bản không tồn tại bị từ chối', async () => {
    await expect(
      khoiPhucBanLuu(fx.db, fx.studentA1, khoiMo, 99_999),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lịch sử không vượt quá giới hạn', async () => {
    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    expect(ls.length).toBeLessThanOrEqual(SO_BAN_LUU_TOI_DA);
  });
});

describe('Bài học bị khoá thì chặn cả ghi lẫn đọc', () => {
  it('không mở được khối trong bài đang khoá', async () => {
    await expect(moKhoiCode(fx.db, fx.studentA1, khoiKhoa)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('không tự lưu được vào bài đang khoá', async () => {
    await expect(luuNhap(fx.db, fx.studentA1, khoiKhoa, CODE_A)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('không nộp bài được ở bài đang khoá', async () => {
    // The mandated case: a POST does not care what the UI rendered.
    await expect(nopBai(fx.db, fx.studentA1, khoiKhoa, CODE_A)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('không đọc được lịch sử ở bài đang khoá', async () => {
    await expect(lichSuMa(fx.db, fx.studentA1, khoiKhoa)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('bị khoá thì KHÔNG có dòng nào được ghi vào cơ sở dữ liệu', async () => {
    await luuNhap(fx.db, fx.studentA1, khoiKhoa, CODE_A).catch(() => undefined);
    await nopBai(fx.db, fx.studentA1, khoiKhoa, CODE_A).catch(() => undefined);

    const draft = await fx.db.codeDraft.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiKhoa } },
    });
    const snaps = await fx.db.codeSnapshot.count({
      where: { studentId: fx.studentA1, blockId: khoiKhoa },
    });

    expect(draft).toBeNull();
    expect(snaps).toBe(0);
  });

  it('thầy cô mở khoá thì em ghi được ngay', async () => {
    const khoi = await fx.db.lessonBlock.findUniqueOrThrow({
      where: { id: khoiKhoa },
      select: { lessonId: true },
    });
    await fx.db.lessonOverride.create({
      data: {
        lessonId: khoi.lessonId,
        studentId: fx.studentA1,
        isUnlocked: true,
        waivePrerequisites: true,
        createdBy: fx.teacherA,
      },
    });

    const kq = await luuNhap(fx.db, fx.studentA1, khoiKhoa, CODE_A);
    expect(kq.daGhi).toBe(true);

    await fx.db.lessonOverride.deleteMany({
      where: { lessonId: khoi.lessonId, studentId: fx.studentA1 },
    });
  });
});

describe('Nộp bài', () => {
  it('ghi đủ metadata vào bảng Submission', async () => {
    const kq = await nopBai(fx.db, fx.studentA1, khoiMo, CODE_B);

    const row = await fx.db.submission.findUniqueOrThrow({
      where: { id: kq.submissionId },
      select: {
        studentId: true,
        problemId: true,
        lessonId: true,
        code: true,
        verdict: true,
        attemptNo: true,
        queuedAt: true,
        judgedAt: true,
      },
    });

    expect(row.studentId).toBe(fx.studentA1);
    expect(row.problemId).toBe(problemId);
    expect(row.lessonId).not.toBeNull();
    expect(row.code).toBe(CODE_B);
    // PENDING is the honest state: accepted, not yet judged. Phase 8 moves it on.
    expect(row.verdict).toBe('PENDING');
    expect(row.queuedAt).not.toBeNull();
    expect(row.judgedAt).toBeNull();
  });

  it('số lần nộp tăng dần', async () => {
    const mot = await nopBai(fx.db, fx.studentA1, khoiMo, 'print(1)\n');
    const hai = await nopBai(fx.db, fx.studentA1, khoiMo, 'print(2)\n');
    expect(hai.attemptNo).toBe(mot.attemptNo + 1);
  });

  it('mỗi lần nộp đều để lại một bản lưu SUBMIT', async () => {
    const truoc = await lichSuMa(fx.db, fx.studentA1, khoiMo);
    await nopBai(fx.db, fx.studentA1, khoiMo, 'print("bài nộp mới")\n');
    const sau = await lichSuMa(fx.db, fx.studentA1, khoiMo);

    expect(sau.length).toBeGreaterThan(truoc.length);
    expect(sau[0]?.reason).toBe('SUBMIT');
  });

  it('bản lưu SUBMIT không bị dọn đi khi lịch sử đầy', async () => {
    // Push well past the cap with AUTO snapshots.
    for (let i = 0; i < SO_BAN_LUU_TOI_DA + 5; i += 1) {
      await luiThoiGian(fx.studentA1, khoiMo, 10);
      await luuNhap(fx.db, fx.studentA1, khoiMo, `print("lan ${i}")\n`);
    }

    const conLai = await fx.db.codeSnapshot.count({
      where: { studentId: fx.studentA1, blockId: khoiMo, reason: 'SUBMIT' },
    });
    // What a student handed in must not vanish because they kept typing.
    expect(conLai).toBeGreaterThan(0);
  });

  it('nộp bài lưu đúng mã đã nộp vào bản nháp', async () => {
    const ma = 'print("đúng bản này")\n';
    await nopBai(fx.db, fx.studentA1, khoiMo, ma);
    const nhap = await docNhap(fx.db, fx.studentA1, khoiMo);
    expect(nhap.code).toBe(ma);
  });

  it('khối không gắn bài tập thì không nộp được', async () => {
    const khongCoBaiTap = await fx.db.lessonBlock.findFirstOrThrow({
      where: { lessonId: (await fx.db.lessonBlock.findUniqueOrThrow({
        where: { id: khoiMo }, select: { lessonId: true },
      })).lessonId, problemId: null },
      select: { id: true },
    });

    await expect(
      nopBai(fx.db, fx.studentA1, khongCoBaiTap.id, CODE_A),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lịch sử nộp bài xếp mới nhất trước và đánh dấu đang chờ chấm', async () => {
    const ls = await lichSuNopBai(fx.db, fx.studentA1, problemId);
    expect(ls.length).toBeGreaterThan(0);
    expect(ls[0]?.dangCho).toBe(true);

    const thoiGian = ls.map((s) => s.createdAt.getTime());
    expect(thoiGian).toEqual([...thoiGian].sort((a, b) => b - a));
  });
});

describe('bamMa', () => {
  it('cùng nội dung cho cùng mã băm', () => {
    expect(bamMa(CODE_A)).toBe(bamMa(CODE_A));
  });

  it('khác một ký tự là khác mã băm', () => {
    expect(bamMa(CODE_A)).not.toBe(bamMa(`${CODE_A} `));
  });

  it('phân biệt cả khoảng trắng cuối dòng — thụt lề là ngữ nghĩa trong Python', () => {
    expect(bamMa('if x:\n    y = 1\n')).not.toBe(bamMa('if x:\n\ty = 1\n'));
  });
});
