/**
 * Micro:bit: submission and manual grading, against real Postgres.
 *
 * The behaviour that matters here is that hardware work travels the SAME
 * pipeline as everything else — drafts, snapshots, progress, authorization —
 * with exactly one difference: a person reaches the verdict instead of a
 * container.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { docNhap, lichSuMa, nopBaiMicrobit } from './code';
import { ForbiddenError } from './errors';
import { chamTay, ghiNhanDatBai, KET_LUAN_CHAM_TAY } from './grading';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

const BLOCKS =
  '<xml xmlns="https://developers.google.com/blockly/xml">' +
  '<block type="device_forever"/></xml>';

let fx: Fixture;
let hocSinh: Actor;
let giaoVienA: Actor;
let giaoVienB: Actor;
let quanTri: Actor;

/** A block in an unlocked lesson, carrying a MAKECODE problem. */
let khoiMb: string;
let baiTapMb: string;
/** A block carrying an ordinary IO_MATCH problem. */
let khoiPy: string;

beforeAll(async () => {
  fx = await createFixture();
  hocSinh = await actorFor(fx.db, fx.studentA1);
  giaoVienA = await actorFor(fx.db, fx.teacherA);
  giaoVienB = await actorFor(fx.db, fx.teacherB);
  quanTri = await actorFor(fx.db, fx.admin);

  const baiMot = await fx.db.lesson.findFirstOrThrow({
    where: { courseId: fx.courseId, order: 1 },
    select: { id: true },
  });
  const khoi = await fx.db.lessonBlock.findMany({
    where: { lessonId: baiMot.id },
    orderBy: { order: 'asc' },
    select: { id: true },
    take: 2,
  });

  const mb = await fx.db.problem.create({
    data: {
      slug: `${fx.prefix}-mb`,
      title: 'Mặt cười mặt khóc',
      statement: 'Hiện mặt cười rồi mặt khóc.',
      judgeMode: 'MAKECODE',
      solutionCode: 'basic.forever(function () { })',
      totalPoints: 100,
    },
    select: { id: true },
  });
  baiTapMb = mb.id;

  khoiMb = khoi[0]!.id;
  await fx.db.lessonBlock.update({ where: { id: khoiMb }, data: { problemId: mb.id } });

  khoiPy = khoi[1]!.id;
  await fx.db.lessonBlock.update({ where: { id: khoiPy }, data: { problemId: fx.problemId } });
});

beforeEach(async () => {
  await fx.db.submission.deleteMany({ where: { studentId: fx.studentA1 } });
  await fx.db.blockProgress.deleteMany({ where: { studentId: fx.studentA1 } });
});

afterAll(async () => {
  await fx.db.submission.deleteMany({ where: { studentId: { in: [fx.studentA1] } } });
  await fx.db.codeSnapshot.deleteMany({ where: { studentId: fx.studentA1 } });
  await fx.db.codeDraft.deleteMany({ where: { studentId: fx.studentA1 } });
  await fx.db.lessonBlock.updateMany({
    where: { id: { in: [khoiMb] } },
    data: { problemId: null },
  });
  await fx.db.problem.deleteMany({ where: { id: baiTapMb } });
  await fx.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Nộp bài Micro:bit', () => {
  it('lưu workspace vào blocksXml và để ở trạng thái chờ', async () => {
    const kq = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);

    const row = await fx.db.submission.findUniqueOrThrow({
      where: { id: kq.submissionId },
      select: { blocksXml: true, code: true, verdict: true, judgedAt: true },
    });

    expect(row.blocksXml).toBe(BLOCKS);
    // `code` carries the same bytes so every query that predates hardware keeps
    // working without special-casing.
    expect(row.code).toBe(BLOCKS);
    expect(row.verdict).toBe('PENDING');
    expect(row.judgedAt).toBeNull();
  });

  it('workspace cũng được giữ làm bản nháp để em nộp lại được', async () => {
    await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);

    const nhap = await docNhap(fx.db, fx.studentA1, khoiMb);
    expect(nhap.code).toBe(BLOCKS);
    expect(nhap.laBanNhap).toBe(true);
  });

  it('mỗi lần nộp để lại một bản lưu trong lịch sử', async () => {
    await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    const ls = await lichSuMa(fx.db, fx.studentA1, khoiMb);

    expect(ls.length).toBeGreaterThan(0);
    expect(ls[0]?.reason).toBe('SUBMIT');
  });

  it('CHỈ MỘT lượt: nộp lần hai bị từ chối với câu học sinh đọc được', async () => {
    const mot = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    expect(mot.attemptNo).toBe(1);
    await expect(nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS)).rejects.toMatchObject({
      message: 'Em đã hết lượt nộp bài. Vui lòng nhờ Giáo viên mở khóa.',
    });
  });

  it('workspace quá lớn bị từ chối', async () => {
    await expect(
      nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, 'x'.repeat(100_000)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('bài học bị khoá thì không nộp được', async () => {
    const baiSau = await fx.db.lesson.findFirstOrThrow({
      where: { courseId: fx.courseId, order: 12 },
      select: { id: true },
    });
    const khoiKhoa = await fx.db.lessonBlock.findFirstOrThrow({
      where: { lessonId: baiSau.id },
      select: { id: true },
    });

    // Same gating as every other write path: a POST does not care what the UI
    // rendered.
    await expect(
      nopBaiMicrobit(fx.db, fx.studentA1, khoiKhoa.id, BLOCKS),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('Chấm tay', () => {
  it('giáo viên dạy em đó chấm được và tiến độ được cập nhật', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);

    const kq = await chamTay(
      fx.db,
      giaoVienA,
      nop.submissionId,
      'ACCEPTED',
      90,
      'Em ghép khối rất gọn, phần pause dùng đúng.',
    );

    expect(kq.verdict).toBe('ACCEPTED');
    expect(kq.score).toBe(90);

    const row = await fx.db.submission.findUniqueOrThrow({
      where: { id: nop.submissionId },
      select: { verdict: true, score: true, judgedAt: true, runnerError: true },
    });
    expect(row.verdict).toBe('ACCEPTED');
    expect(row.judgedAt).not.toBeNull();
    // Attributed, so "who decided this?" stays answerable.
    expect(row.runnerError).toContain(giaoVienA.username);

    const bp = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMb } },
      select: { state: true },
    });
    expect(bp?.state).toBe('COMPLETED');
  });

  it('nhận xét được lưu lại cho em đọc', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    await chamTay(fx.db, giaoVienA, nop.submissionId, 'ACCEPTED', 100, 'Làm tốt lắm em.');

    const fb = await fx.db.feedback.findFirst({
      where: { submissionId: nop.submissionId },
      select: { comment: true, authorId: true },
    });
    expect(fb?.comment).toContain('Làm tốt');
    expect(fb?.authorId).toBe(fx.teacherA);
  });

  it('nộp bài là hoàn thành khối NGAY, trước cả khi có kết luận', async () => {
    /*
     * Effort counts (see `ghiNhanNoLuc`). Handing in completes the block; the
     * teacher's later verdict changes the score, not the completion. The old
     * rule — complete only on ACCEPTED — left a child who did the work and got
     * it wrong stuck on the same lesson, which for this audience taught the
     * wrong thing.
     */
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);

    const truoc = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMb } },
    });
    expect(truoc?.state).toBe('COMPLETED');

    // A WRONG_ANSWER mark leaves completion alone and records the verdict.
    await chamTay(fx.db, giaoVienA, nop.submissionId, 'WRONG_ANSWER', 40, 'Em thiếu khối pause.');
    const sau = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMb } },
    });
    expect(sau?.state).toBe('COMPLETED');
    const bai = await fx.db.submission.findUniqueOrThrow({ where: { id: nop.submissionId } });
    expect(bai.verdict).toBe('WRONG_ANSWER');
  });

  it('giáo viên KHÔNG dạy em đó thì không chấm được', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    // Manual grading does not become acceptable across a relationship that does
    // not exist.
    await expect(
      chamTay(fx.db, giaoVienB, nop.submissionId, 'ACCEPTED', 100, 'x y z'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('học sinh không tự chấm bài của mình', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    await expect(
      chamTay(fx.db, hocSinh, nop.submissionId, 'ACCEPTED', 100, 'tu cham'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('quản trị viên chấm được', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    await expect(
      chamTay(fx.db, quanTri, nop.submissionId, 'ACCEPTED', 100, 'quan tri cham'),
    ).resolves.toBeDefined();
  });

  it('chấm tay ĐƯỢC cả bài sandbox đã chấm — có ghi tên người chấm', async () => {
    /*
     * The override the teacher dashboard needs: a machine verdict a person
     * disagrees with can be replaced. What makes that safe is attribution —
     * the row says who set it, and a note is required — not a refusal.
     */
    const s = await fx.db.submission.create({
      data: {
        studentId: fx.studentA1,
        problemId: fx.problemId,
        code: 'print("Xin chao ")',
        verdict: 'WRONG_ANSWER',
        score: 0,
      },
      select: { id: true },
    });

    const kq = await chamTay(fx.db, giaoVienA, s.id, 'ACCEPTED', 100, 'Chỉ thừa một dấu cách.');
    expect(kq.verdict).toBe('ACCEPTED');

    const sau = await fx.db.submission.findUniqueOrThrow({ where: { id: s.id } });
    expect(sau.verdict).toBe('ACCEPTED');
    // Distinguishable from a machine verdict forever.
    expect(sau.runnerError).toContain('cham tay boi');
  });

  it('chỉ nhận kết luận mà con người đưa ra được', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);

    expect(KET_LUAN_CHAM_TAY).toEqual(['ACCEPTED', 'WRONG_ANSWER']);
    // TIME_LIMIT_EXCEEDED is a machine measurement; a person cannot observe it
    // by reading blocks.
    await expect(
      chamTay(fx.db, giaoVienA, nop.submissionId, 'TIME_LIMIT_EXCEEDED', 0, 'x y z'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('điểm bị kẹp trong khoảng hợp lệ', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    const kq = await chamTay(fx.db, giaoVienA, nop.submissionId, 'ACCEPTED', 9999, 'diem cao');
    expect(kq.score).toBe(100);
  });

  it('bài nộp không tồn tại bị từ chối, không báo "không tìm thấy"', async () => {
    await expect(
      chamTay(fx.db, giaoVienA, 'khong-co-that', 'ACCEPTED', 100, 'x y z'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('kết luận "đạt" trả về tiến độ vừa ghi, để màn hình giáo viên nói được con số', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    const kq = await chamTay(fx.db, giaoVienA, nop.submissionId, 'ACCEPTED', 100, 'Rất gọn em ạ.');

    expect(kq.tienDo).not.toBeNull();
    expect(kq.tienDo!.soKhoi).toBeGreaterThan(0);

    // The percent reported back is the one now stored, not a guess.
    const buoi = kq.tienDo!.baiHoc[0]!;
    const lp = await fx.db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: fx.studentA1, lessonId: buoi.lessonId } },
      select: { percent: true },
    });
    expect(buoi.phanTram).toBe(lp.percent);
  });

  it('kết luận "chưa đạt" không ghi tiến độ nào', async () => {
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    const kq = await chamTay(fx.db, giaoVienA, nop.submissionId, 'WRONG_ANSWER', 40, 'Thieu pause.');
    expect(kq.tienDo).toBeNull();
  });

  it('bài tập rời khỏi mọi khối vẫn tính lại được buổi học của bài nộp', async () => {
    /*
     * The silent no-op this guards against: `ghiNhanDatBai` looks up blocks by
     * PROBLEM, and a problem detached from its block after a curriculum edit
     * matches none — so nothing was recomputed and the teacher was told the
     * progress had updated when it had not. The submission's own `lessonId` is
     * the fallback anchor.
     */
    const nop = await nopBaiMicrobit(fx.db, fx.studentA1, khoiMb, BLOCKS);
    await fx.db.lessonBlock.update({ where: { id: khoiMb }, data: { problemId: null } });

    try {
      const kq = await chamTay(fx.db, giaoVienA, nop.submissionId, 'ACCEPTED', 100, 'Dat roi em.');
      expect(kq.tienDo!.soKhoi).toBe(0);
      expect(kq.tienDo!.baiHoc).toHaveLength(1);
    } finally {
      await fx.db.lessonBlock.update({ where: { id: khoiMb }, data: { problemId: baiTapMb } });
    }
  });
});

describe('ghiNhanDatBai — dùng chung giữa chấm tự động và chấm tay', () => {
  it('đánh dấu khối hoàn thành và tính lại tiến độ bài học', async () => {
    await ghiNhanDatBai(fx.db, fx.studentA1, baiTapMb);

    const bp = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMb } },
      select: { state: true },
    });
    expect(bp?.state).toBe('COMPLETED');

    // Lesson completion is re-derived by the Phase 4 engine, never written
    // directly — so an accepted answer means the same thing however it was
    // reached.
    const lp = await fx.db.lessonProgress.findFirst({
      where: { studentId: fx.studentA1, lesson: { blocks: { some: { id: khoiMb } } } },
    });
    expect(lp).not.toBeNull();
  });
});
