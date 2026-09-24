/**
 * The review milestones and the class chat, against a real database.
 *
 * What would break silently:
 *
 *   1. THE BOSS IS NOT AN ORACLE. A question the student has not yet answered
 *      in its home lesson must be refused — with the right answer or the wrong
 *      one — and must not be in their pool. Otherwise a replayable game marks
 *      one-attempt questions as often as a child likes.
 *   2. THE POOL IS PER STUDENT. One child answering a question does not put it
 *      in a classmate's fight.
 *   3. A PRESENTATION IS EIGHT SLIDES, ONCE, and completes its block; a
 *      teacher's reset removes it.
 *   4. THE CHAT IS RELATIONAL. Students write in their own class only; their
 *      teacher reads it, another teacher does not; a locked student cannot
 *      write; an archived class takes no new messages.
 *   5. A CHAT VIOLATION IS FILED AS ONE. The alert says CLASS_CHAT.
 *
 * Blocks are created by the test rather than taken from the seed, so this runs
 * against a database seeded before the milestones existed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { moLaiKhoi } from './luot-nop';
import { chamCauOnTap, deOnTap } from './on-tap';
import { guiTinNhanLop, lopThaoLuanCuaEm, tinNhanCuaLop, trangThaiThaoLuan } from './thao-luan';
import { nopThuyetTrinh, thuyetTrinhCuaHocSinh } from './thuyet-trinh';
import { traLoiCauHoi } from './tra-loi';
import { khoaTroLyViPham } from './tro-ly-vi-pham';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { KhoLuuTru } from './projects';
import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let studentA1: Actor;
let studentA2: Actor;
let studentB1: Actor;
let studentWithdrawn: Actor;

/** Blocks this file creates, removed in afterAll. */
const khoiTao: string[] = [];

/** A question in the seeded course with a known correct choice, and where it lives. */
let cau: {
  id: string;
  dung: string;
  sai: string;
  textDung: string;
  lessonId: string;
  buoi: number;
};
let bossId: string;
let thuyetTrinhId: string;

const KHO_GIA: KhoLuuTru = {
  ghi: async () => undefined,
  doc: async () => null,
  xoa: async () => undefined,
};

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  studentA1 = await actorFor(fx.db, fx.studentA1);
  studentA2 = await actorFor(fx.db, fx.studentA2);
  studentB1 = await actorFor(fx.db, fx.studentB1);
  studentWithdrawn = await actorFor(fx.db, fx.studentWithdrawn);

  // A multiple-choice question attached to an early python-co-ban lesson.
  const q = await fx.db.question.findFirstOrThrow({
    where: {
      type: 'MULTIPLE_CHOICE',
      choices: { some: { isCorrect: true } },
      quiz: { blocks: { some: { lesson: { courseId: fx.courseId, order: { lte: 5 } } } } },
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      choices: { select: { id: true, text: true, isCorrect: true } },
      quiz: {
        select: {
          blocks: {
            where: { lesson: { courseId: fx.courseId, order: { lte: 5 } } },
            select: { lesson: { select: { id: true, order: true } } },
            take: 1,
          },
        },
      },
    },
  });
  const dung = q.choices.find((c) => c.isCorrect)!;
  const sai = q.choices.find((c) => !c.isCorrect)!;
  const lesson = q.quiz.blocks[0]!.lesson;
  cau = {
    id: q.id,
    dung: dung.id,
    sai: sai.id,
    textDung: dung.text,
    lessonId: lesson.id,
    buoi: lesson.order,
  };

  // Open that lesson for both A-students, however far they have got.
  await fx.db.lessonOverride.createMany({
    data: [studentA1, studentA2].map((s) => ({
      lessonId: lesson.id,
      studentId: s.id,
      isUnlocked: true,
      waivePrerequisites: true,
      createdBy: fx.teacherA,
    })),
  });

  bossId = (
    await fx.db.lessonBlock.create({
      data: {
        lessonId: lesson.id,
        order: 9000 + Math.floor(Math.random() * 900),
        type: 'MINIGAME_BOSS',
        title: `${fx.prefix} boss`,
        content: {
          kind: 'boss',
          markdown: '',
          tenBoss: 'T',
          bieuTuong: '👾',
          tuBuoi: 1,
          denBuoi: lesson.order,
        },
      },
      select: { id: true },
    })
  ).id;
  khoiTao.push(bossId);

  thuyetTrinhId = (
    await fx.db.lessonBlock.create({
      data: {
        lessonId: fx.lessonId,
        order: 9900 + Math.floor(Math.random() * 90),
        type: 'PRESENTATION',
        title: `${fx.prefix} thuyet trinh`,
        content: { kind: 'presentation', markdown: '', tuBuoi: 1, denBuoi: 1, goiY: [] },
      },
      select: { id: true },
    })
  ).id;
  khoiTao.push(thuyetTrinhId);
});

afterAll(async () => {
  await fx.db.lessonBlock.deleteMany({ where: { id: { in: khoiTao } } });
  await fx.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// Boss fight
// ═══════════════════════════════════════════════════════════════════════════

describe('Trận boss không phải là máy dò đáp án', () => {
  it('câu CHƯA trả lời ở bài gốc: không có trong bộ câu, và bị từ chối kể cả khi đoán đúng', async () => {
    const de = await deOnTap(fx.db, studentA1.id, bossId);
    expect(de?.cauHoi.map((c) => c.id)).not.toContain(cau.id);

    await expect(chamCauOnTap(fx.db, studentA1.id, bossId, cau.id, cau.dung)).rejects.toMatchObject(
      {
        reason: 'question-not-in-review',
      },
    );
  });

  it('trả lời ở bài gốc xong → vào bộ câu, KHÔNG kèm đáp án, và được chấm trên máy chủ', async () => {
    const kq = await traLoiCauHoi(fx.db, studentA1.id, cau.id, cau.sai);
    expect(kq.trangThai).toBe('da-cham');

    const de = await deOnTap(fx.db, studentA1.id, bossId);
    const trongDe = de?.cauHoi.find((c) => c.id === cau.id);
    expect(trongDe).toBeDefined();
    expect(trongDe?.buoi).toBe(cau.buoi);
    for (const c of trongDe?.choices ?? []) expect(Object.keys(c).sort()).toEqual(['id', 'text']);

    expect(await chamCauOnTap(fx.db, studentA1.id, bossId, cau.id, cau.dung)).toMatchObject({
      dung: true,
      dapAnDung: null,
    });
    expect(await chamCauOnTap(fx.db, studentA1.id, bossId, cau.id, cau.sai)).toMatchObject({
      dung: false,
      dapAnDung: cau.textDung,
    });
  });

  it('không ghi gì: đấu boss không đổi câu trả lời đã lưu ở bài gốc', async () => {
    const soDap = await fx.db.answer.count({
      where: { questionId: cau.id, attempt: { studentId: studentA1.id } },
    });
    await chamCauOnTap(fx.db, studentA1.id, bossId, cau.id, cau.dung);
    expect(
      await fx.db.answer.count({
        where: { questionId: cau.id, attempt: { studentId: studentA1.id } },
      }),
    ).toBe(soDap);
  });

  it('bộ câu là của TỪNG em: bạn cùng lớp chưa trả lời thì không có', async () => {
    await expect(chamCauOnTap(fx.db, studentA2.id, bossId, cau.id, cau.dung)).rejects.toMatchObject(
      {
        reason: 'question-not-in-review',
      },
    );
  });

  it('khối không phải boss → từ chối', async () => {
    await expect(
      chamCauOnTap(fx.db, studentA1.id, thuyetTrinhId, cau.id, cau.dung),
    ).rejects.toMatchObject({
      reason: 'not-a-review-block',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Presentation
// ═══════════════════════════════════════════════════════════════════════════

const tam = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ tieuDe: `Trang ${i + 1}`, noiDung: `Nội dung ${i + 1}` }));

describe('Bài thuyết trình', () => {
  it('7 trang → không hợp lệ, không lưu', async () => {
    const kq = await nopThuyetTrinh(fx.db, studentA1, thuyetTrinhId, tam(7));
    expect(kq).toMatchObject({ trangThai: 'khong-hop-le', loi: { loai: 'sai-so-trang' } });
    expect(await fx.db.presentationSubmission.count({ where: { blockId: thuyetTrinhId } })).toBe(0);
  });

  it('8 trang → lưu, và khối được tính là xong', async () => {
    const kq = await nopThuyetTrinh(fx.db, studentA1, thuyetTrinhId, tam(8));
    expect(kq.trangThai).toBe('da-nhan');
    const tienDo = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: studentA1.id, blockId: thuyetTrinhId } },
      select: { state: true },
    });
    expect(tienDo?.state).toBe('COMPLETED');
  });

  it('nộp lần hai → da-nop-roi, bản đầu giữ nguyên', async () => {
    const kq = await nopThuyetTrinh(fx.db, studentA1, thuyetTrinhId, tam(8).reverse());
    expect(kq.trangThai).toBe('da-nop-roi');
  });

  it('giáo viên của em đọc được; giáo viên lớp khác thì không; giáo viên không nộp hộ', async () => {
    const ds = await thuyetTrinhCuaHocSinh(fx.db, teacherA, studentA1.id);
    expect(ds[0]?.trang[0]).toEqual({ tieuDe: 'Trang 1', noiDung: 'Nội dung 1' });

    await expect(thuyetTrinhCuaHocSinh(fx.db, teacherB, studentA1.id)).rejects.toMatchObject({
      reason: 'teacher-does-not-teach-student',
    });
    await expect(nopThuyetTrinh(fx.db, teacherA, thuyetTrinhId, tam(8))).rejects.toMatchObject({
      reason: 'only-students-present',
    });
  });

  it('giáo viên "Mở lại" khối → xoá bài, ghi vào nhật ký, em nộp lại được', async () => {
    await moLaiKhoi(fx.db, teacherA, studentA1.id, thuyetTrinhId, 'cho em sửa', KHO_GIA);
    expect(await fx.db.presentationSubmission.count({ where: { blockId: thuyetTrinhId } })).toBe(0);

    const log = await fx.db.auditLog.findFirst({
      where: { action: 'block.reset', entityId: thuyetTrinhId },
      orderBy: { createdAt: 'desc' },
      select: { meta: true },
    });
    expect(JSON.stringify(log?.meta)).toContain('daXoaThuyetTrinh');

    expect((await nopThuyetTrinh(fx.db, studentA1, thuyetTrinhId, tam(8))).trangThai).toBe(
      'da-nhan',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Class chat
// ═══════════════════════════════════════════════════════════════════════════

describe('Thảo luận lớp', () => {
  it('học sinh gửi vào lớp của mình; bạn cùng lớp và giáo viên của lớp đọc được', async () => {
    const kq = await guiTinNhanLop(fx.db, studentA1, fx.classA, '  Chào cả lớp  ');
    expect(kq.trangThai).toBe('da-gui');
    if (kq.trangThai === 'da-gui') expect(kq.tinNhan.noiDung).toBe('Chào cả lớp');

    for (const nguoiDoc of [studentA2, teacherA]) {
      const ds = await tinNhanCuaLop(fx.db, nguoiDoc, fx.classA);
      expect(ds.map((t) => t.noiDung)).toContain('Chào cả lớp');
    }
  });

  it('lớp khác, giáo viên khác, học sinh đã rời lớp: không đọc, không gửi', async () => {
    await expect(tinNhanCuaLop(fx.db, teacherB, fx.classA)).rejects.toMatchObject({
      reason: 'teacher-does-not-own-class',
    });
    await expect(tinNhanCuaLop(fx.db, studentB1, fx.classA)).rejects.toMatchObject({
      reason: 'student-not-enrolled',
    });
    await expect(guiTinNhanLop(fx.db, studentB1, fx.classA, 'hi')).rejects.toMatchObject({
      reason: 'student-not-enrolled',
    });
    await expect(guiTinNhanLop(fx.db, studentWithdrawn, fx.classA, 'hi')).rejects.toMatchObject({
      reason: 'student-not-enrolled',
    });
  });

  it('giáo viên chỉ đọc, không gửi', async () => {
    await expect(guiTinNhanLop(fx.db, teacherA, fx.classA, 'Các em trật tự')).rejects.toMatchObject(
      {
        reason: 'only-students-post-in-class-chat',
      },
    );
    expect((await trangThaiThaoLuan(fx.db, teacherA, fx.classA)).coTheGui).toBe(false);
  });

  it('`tu` chỉ trả tin từ mốc đó trở đi', async () => {
    const moc = new Date(Date.now() + 60_000);
    expect(await tinNhanCuaLop(fx.db, studentA1, fx.classA, { tu: moc })).toEqual([]);
  });

  it('quá dài, rỗng → từ chối, không lưu', async () => {
    expect((await guiTinNhanLop(fx.db, studentA1, fx.classA, 'x'.repeat(501))).trangThai).toBe(
      'qua-dai',
    );
    expect((await guiTinNhanLop(fx.db, studentA1, fx.classA, '   ')).trangThai).toBe('rong');
  });

  it('lớp đã lưu trữ → không nhận tin mới, vẫn đọc được, không còn trong danh sách', async () => {
    await fx.db.class.update({ where: { id: fx.classA }, data: { isArchived: true } });
    try {
      expect((await guiTinNhanLop(fx.db, studentA1, fx.classA, 'còn ai không')).trangThai).toBe(
        'lop-luu-tru',
      );
      expect((await tinNhanCuaLop(fx.db, studentA1, fx.classA)).length).toBeGreaterThan(0);
      expect((await lopThaoLuanCuaEm(fx.db, studentA1)).map((l) => l.id)).not.toContain(fx.classA);
    } finally {
      await fx.db.class.update({ where: { id: fx.classA }, data: { isArchived: false } });
    }
  });

  it('vi phạm trong thảo luận: khoá + cảnh báo kênh CLASS_CHAT, rồi không gửi được nữa', async () => {
    const { alertId } = await khoaTroLyViPham(fx.db, studentA2.id, {
      noiDung: 'đm',
      loai: 'PROFANITY',
      nguon: 'tu-khoa',
      kenh: 'CLASS_CHAT',
    });
    const alert = await fx.db.aiViolationAlert.findUniqueOrThrow({
      where: { id: alertId },
      select: { channel: true },
    });
    expect(alert.channel).toBe('CLASS_CHAT');

    expect((await guiTinNhanLop(fx.db, studentA2, fx.classA, 'xin lỗi')).trangThai).toBe('bi-khoa');
    const tt = await trangThaiThaoLuan(fx.db, studentA2, fx.classA);
    expect(tt).toMatchObject({ biKhoa: true, coTheGui: false });
    // Reading stays open.
    expect((await tinNhanCuaLop(fx.db, studentA2, fx.classA)).length).toBeGreaterThan(0);
  });

  it('không ghi kênh → vẫn là TUTOR, như mọi cảnh báo cũ', async () => {
    const { alertId } = await khoaTroLyViPham(fx.db, studentA1.id, {
      noiDung: 'đm',
      loai: 'PROFANITY',
      nguon: 'tu-khoa',
    });
    const alert = await fx.db.aiViolationAlert.findUniqueOrThrow({
      where: { id: alertId },
      select: { channel: true },
    });
    expect(alert.channel).toBe('TUTOR');
  });
});
