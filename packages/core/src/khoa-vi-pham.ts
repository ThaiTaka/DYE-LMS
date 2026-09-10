/**
 * Auto-zero lock — what happens when tab-outs pass the hard threshold.
 *
 * ── This module is the exception, and it is written as one ───────────────────
 * `giam-sat.ts` deliberately renders no verdict: it counts tab-outs, tells a
 * teacher, and stops. This module does render one. It voids a child's work and
 * takes the editor away from them, which is the single most consequential thing
 * the application can do to a student without a human in the loop.
 *
 * Because of that, three properties are non-negotiable here, and every function
 * below exists to hold one of them up:
 *
 *   1. THE COUNT IS THE SERVER'S. `khoaBaiViPham` re-counts `FocusEvent` rows
 *      itself and refuses if the real total is under `NGUONG_KHOA`. The browser
 *      asks for a lock; it never asserts one. Otherwise a student's classmate —
 *      or the student themself, in devtools — could zero a lesson by calling an
 *      action with a made-up number, and the client's tally is exactly the thing
 *      an anti-cheat measure must assume is hostile.
 *
 *   2. IT IS IDEMPOTENT. One lock per (student, lesson), enforced by a unique
 *      key rather than by checking first. A retry, a double-click, or a script
 *      calling the action in a loop produces one lock and one set of zeros.
 *
 *   3. IT IS ALWAYS LIFTABLE. `moKhoaViPham` restores every score the lock
 *      voided, and records who lifted it and why. The signal is a noisy proxy —
 *      a sleeping laptop, a Vietnamese IME switching in, a notification toast
 *      and a genuine alt-tab to a solutions page are indistinguishable to a
 *      browser — so a wrong lock is a normal outcome, not an edge case, and the
 *      adult in the room has to be able to undo one in a few seconds.
 *
 * ── What the student is told ─────────────────────────────────────────────────
 * Plainly, and before it happens. At `NGUONG_CANH_BAO_NANG` the tracker puts a
 * modal in front of them saying the count, the limit, and what happens at it.
 * A rule a 12-year-old is measured against but never shown is not a rule, it is
 * a trap — and the warning is also the only part of this system that can change
 * the outcome, because it is the one moment a student can still choose to stay.
 */
import { ForbiddenError } from './errors';

import type { FocusLockState, PrismaClient } from '@prisma/client';
import type { Actor } from './session';

/**
 * Tab-outs before the student is warned, hard, that a lock is coming.
 *
 * Five rather than three: `NGUONG_CANH_BAO` already told a teacher at three,
 * and a modal is an interruption of the lesson. This one has to be rare enough
 * that a student reads it instead of dismissing it by reflex.
 */
export const NGUONG_CANH_BAO_NANG = 5;

/**
 * Tab-outs before the lesson locks at zero.
 *
 * Twenty, and the gap from five is doing real work: it is four times the warning
 * so that noise alone is unlikely to reach it, and it leaves a student who has
 * seen the modal fifteen chances to change course. Recorded on every FocusLock
 * row as `nguong`, so raising or lowering this later cannot silently rewrite the
 * reason an existing lock was applied.
 */
export const NGUONG_KHOA = 20;

/** `RETURNED` closes a departure; it is not one. `PASTE_BURST` is not either. */
const LA_ROI_DI = ['TAB_HIDDEN', 'WINDOW_BLUR'] as const;

export interface KhoaHienThi {
  id: string;
  studentId: string;
  lessonId: string;
  classId: string | null;
  soLan: number;
  nguong: number;
  soBaiKhongDiem: number;
  soCauKhongDiem: number;
  state: FocusLockState;
  luc: Date;
  nguoiMoKhoa: string | null;
  moKhoaLuc: Date | null;
  ghiChuMoKhoa: string | null;
}

/**
 * How many times this student has actually left this lesson.
 *
 * The only number any decision in this module is allowed to read. Exported
 * because the lesson page renders the warning from it too — the client keeps its
 * own running tally to avoid a round trip per event, but what it DISPLAYS and
 * what the server ACTS on both trace back to here.
 */
export async function demSoLanRoi(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<number> {
  return db.focusEvent.count({
    where: { studentId, lessonId, type: { in: [...LA_ROI_DI] } },
  });
}

/** The lock in force for this student on this lesson, if there is one. */
export async function khoaHienTai(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<KhoaHienThi | null> {
  const row = await db.focusLock.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
    select: {
      id: true,
      studentId: true,
      lessonId: true,
      classId: true,
      soLan: true,
      nguong: true,
      soBaiKhongDiem: true,
      soCauKhongDiem: true,
      state: true,
      createdAt: true,
      clearedAt: true,
      ghiChuMoKhoa: true,
      clearedBy: { select: { displayName: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    studentId: row.studentId,
    lessonId: row.lessonId,
    classId: row.classId,
    soLan: row.soLan,
    nguong: row.nguong,
    soBaiKhongDiem: row.soBaiKhongDiem,
    soCauKhongDiem: row.soCauKhongDiem,
    state: row.state,
    luc: row.createdAt,
    nguoiMoKhoa: row.clearedBy?.displayName ?? null,
    moKhoaLuc: row.clearedAt,
    ghiChuMoKhoa: row.ghiChuMoKhoa,
  };
}

/**
 * Is this student currently locked out of this lesson?
 *
 * The gate every write path calls. Kept as a `count` rather than reusing
 * `khoaHienTai` because it runs on the hot path — every autosave, every test
 * run, every submit — and none of those need the row, only the answer.
 */
export async function biKhoaViPham(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<boolean> {
  const n = await db.focusLock.count({
    where: { studentId, lessonId, state: 'LOCKED' },
  });
  return n > 0;
}

export interface KetQuaKhoa {
  /** True only when THIS call created the lock. A retry answers false. */
  daKhoa: boolean;
  /** True whenever a lock is in force, whoever created it. */
  dangKhoa: boolean;
  /** The server's own count at the moment of the decision. */
  soLan: number;
  soBaiKhongDiem: number;
  soCauKhongDiem: number;
  /** Set when the request was refused because the real count was under the bar. */
  lyDoTuChoi: 'chua-du-nguong' | 'khong-thay-bai' | null;
}

/**
 * Which class is this student sitting in for this lesson?
 *
 * Denormalised onto the lock at creation time for the same reason `FocusAlert`
 * does it: the teacher feed scopes by `Class.teacherId`, and re-deriving
 * enrolment per row on a dashboard is a query per lock.
 */
async function lopChoBaiHoc(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<string | null> {
  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId,
      isActive: true,
      class: { classCourses: { some: { course: { lessons: { some: { id: lessonId } } } } } },
    },
    select: { classId: true },
    orderBy: { enrolledAt: 'desc' },
  });
  return enrollment?.classId ?? null;
}

/**
 * Lock this lesson at zero.
 *
 * ── The refusal is the important path ────────────────────────────────────────
 * Most calls to this function should do nothing. The client asks when its own
 * tally reaches the threshold, and that tally is a hint: the server counts for
 * itself and returns `lyDoTuChoi: 'chua-du-nguong'` whenever the real number is
 * lower. A caller cannot pass a count in, because there is no parameter for one.
 *
 * ── What gets zeroed ─────────────────────────────────────────────────────────
 * The work the student actually did in this lesson: every coding problem they
 * have a draft or a prior submission for, plus the block they were sitting on
 * when the lock fired, plus every quiz answer in the lesson.
 *
 * Deliberately NOT every problem in the lesson. A lesson carries blocks for four
 * tiers and a CO_BAN student never sees the NANG_CAO ones; minting zeroed
 * submissions for exercises they were never shown would put rows in a teacher's
 * review queue for work that was never set, and would read to a parent as the
 * system inventing failures.
 */
export async function khoaBaiViPham(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
  options: { blockId?: string | undefined } = {},
): Promise<KetQuaKhoa> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, order: true, title: true },
  });
  if (!lesson) {
    return {
      daKhoa: false,
      dangKhoa: false,
      soLan: 0,
      soBaiKhongDiem: 0,
      soCauKhongDiem: 0,
      lyDoTuChoi: 'khong-thay-bai',
    };
  }

  // Already locked: answer from the existing row rather than zeroing again.
  const daCo = await khoaHienTai(db, studentId, lesson.id);
  if (daCo && daCo.state === 'LOCKED') {
    return {
      daKhoa: false,
      dangKhoa: true,
      soLan: daCo.soLan,
      soBaiKhongDiem: daCo.soBaiKhongDiem,
      soCauKhongDiem: daCo.soCauKhongDiem,
      lyDoTuChoi: null,
    };
  }

  /*
   * The one number that matters.
   *
   * A lock that trusted the client would be a button any student could press on
   * themselves out of curiosity, and — far worse — a shape that invites the next
   * change to accept a studentId from the request too.
   */
  const soLan = await demSoLanRoi(db, studentId, lesson.id);
  if (soLan < NGUONG_KHOA) {
    return {
      daKhoa: false,
      dangKhoa: false,
      soLan,
      soBaiKhongDiem: 0,
      soCauKhongDiem: 0,
      lyDoTuChoi: 'chua-du-nguong',
    };
  }

  /*
   * A lock that was lifted and then re-earned is a new lock, not a revival: the
   * teacher's note and the name on the old one describe a decision about a
   * different set of events. `update` on the CLEARED row keeps the unique key
   * satisfied while resetting the counts this pass will fill in.
   */
  const classId = await lopChoBaiHoc(db, studentId, lesson.id);

  const blocks = await db.lessonBlock.findMany({
    where: { lessonId: lesson.id },
    select: { id: true, problemId: true, quizId: true },
  });

  const idKhoi = blocks.map((b) => b.id);
  const [banNhap, daNop] = await Promise.all([
    db.codeDraft.findMany({
      where: { studentId, blockId: { in: idKhoi } },
      select: { blockId: true, code: true },
    }),
    db.submission.findMany({
      where: { studentId, lessonId: lesson.id },
      select: { problemId: true },
      distinct: ['problemId'],
    }),
  ]);

  const nhapTheoKhoi = new Map(banNhap.map((d) => [d.blockId, d.code]));
  const problemDaNop = new Set(daNop.map((s) => s.problemId));

  // The problems this student actually engaged with, plus the one they were
  // sitting on when it fired.
  const cham = blocks.filter(
    (b) =>
      b.problemId !== null &&
      (nhapTheoKhoi.has(b.id) || problemDaNop.has(b.problemId) || b.id === options.blockId),
  );

  const idQuiz = [...new Set(blocks.map((b) => b.quizId).filter((q): q is string => q !== null))];

  let ketQua: { soBai: number; soCau: number };
  try {
    ketQua = await khoaTrongGiaoDich(db, {
      studentId,
      lesson,
      classId,
      soLan,
      daCoId: daCo?.id ?? null,
      cham,
      nhapTheoKhoi,
      idQuiz,
    });
  } catch (error) {
    /*
     * The loser of the race.
     *
     * Another request created the lock between this one's read and its write.
     * That is the CORRECT outcome — the whole point of putting the constraint
     * in the way — and the loser's transaction rolled back, so no duplicate
     * zeros were written. What it must not do is throw: the caller is a server
     * action in a 12-year-old's browser, and this is the ordinary path when a
     * `blur` and a `visibilitychange` both cross the threshold in the same
     * moment, which is exactly how a single alt-tab arrives.
     */
    if (!laTrungKhoa(error)) throw error;

    const co = await khoaHienTai(db, studentId, lesson.id);
    return {
      daKhoa: false,
      dangKhoa: co?.state === 'LOCKED',
      soLan: co?.soLan ?? soLan,
      soBaiKhongDiem: co?.soBaiKhongDiem ?? 0,
      soCauKhongDiem: co?.soCauKhongDiem ?? 0,
      lyDoTuChoi: null,
    };
  }

  await baoChoNguoiLon(db, {
    studentId,
    classId,
    lesson,
    soLan,
    soBai: ketQua.soBai,
    soCau: ketQua.soCau,
  });

  return {
    daKhoa: true,
    dangKhoa: true,
    soLan,
    soBaiKhongDiem: ketQua.soBai,
    soCauKhongDiem: ketQua.soCau,
    lyDoTuChoi: null,
  };
}

/**
 * Is this Prisma's unique-constraint refusal?
 *
 * Matched structurally on the error code rather than with `instanceof
 * PrismaClientKnownRequestError`, because @dye/core imports @prisma/client for
 * TYPES only — pulling in the runtime class here just to name an error would
 * make every consumer of this package carry it.
 */
function laTrungKhoa(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * The zeroing itself: one transaction, all of it or none of it.
 *
 * Split out from `khoaBaiViPham` so the race handling above reads as one
 * decision rather than being buried under three hundred lines of writes.
 */
async function khoaTrongGiaoDich(
  db: PrismaClient,
  input: {
    studentId: string;
    lesson: { id: string; order: number; title: string };
    classId: string | null;
    soLan: number;
    daCoId: string | null;
    cham: Array<{ id: string; problemId: string | null }>;
    nhapTheoKhoi: Map<string, string>;
    idQuiz: string[];
  },
): Promise<{ soBai: number; soCau: number }> {
  const { studentId, lesson, classId, soLan, daCoId, cham, nhapTheoKhoi, idQuiz } = input;

  return db.$transaction(async (tx) => {
    /*
     * Create FIRST, and let the unique key decide.
     *
     * Checking then writing leaves a window in which two concurrent requests
     * both pass the check and both zero the lesson. Letting the constraint
     * reject the loser makes the race impossible rather than unlikely.
     */
    if (daCoId) {
      await tx.focusLock.update({
        where: { id: daCoId },
        data: {
          classId,
          soLan,
          nguong: NGUONG_KHOA,
          soBaiKhongDiem: 0,
          soCauKhongDiem: 0,
          state: 'LOCKED',
          clearedById: null,
          clearedAt: null,
          ghiChuMoKhoa: null,
          createdAt: new Date(),
        },
      });
    } else {
      await tx.focusLock.create({
        data: { studentId, lessonId: lesson.id, classId, soLan, nguong: NGUONG_KHOA },
      });
    }

    let soBai = 0;
    for (const b of cham) {
      const problemId = b.problemId;
      if (problemId === null) continue;

      const truoc = await tx.submission.count({ where: { studentId, problemId } });
      await tx.submission.create({
        data: {
          studentId,
          problemId,
          lessonId: lesson.id,
          /*
           * The student's own text, not a placeholder.
           *
           * A teacher reviewing this lock has to be able to see what was in the
           * editor when it fired — that is most of what tells them whether the
           * tab-outs were a child looking up `range()` or something else. A row
           * saying "locked" and nothing more makes the decision unreviewable.
           */
          code: nhapTheoKhoi.get(b.id) ?? '',
          verdict: 'WRONG_ANSWER',
          score: 0,
          passedTests: 0,
          totalTests: 0,
          attemptNo: truoc + 1,
          judgedAt: new Date(),
          runnerError: `focus-lock: ${soLan} lần rời bài (ngưỡng ${NGUONG_KHOA})`,
        },
      });
      soBai += 1;
    }

    /*
     * Quiz answers are voided, not deleted.
     *
     * `khoaViPham` records WHY the zero is there. Writing `pointsAwarded = 0`
     * alone would leave a teacher unable to tell an imposed zero from a wrong
     * answer, and a zero nobody can explain is one nobody can defend.
     */
    let soCau = 0;
    if (idQuiz.length > 0) {
      const capNhat = await tx.answer.updateMany({
        where: {
          attempt: { studentId, quizId: { in: idQuiz } },
          khoaViPham: false,
        },
        data: { isCorrect: false, pointsAwarded: 0, khoaViPham: true },
      });
      soCau = capNhat.count;

      await tx.quizAttempt.updateMany({
        where: { studentId, quizId: { in: idQuiz } },
        data: { score: 0, isPassed: false },
      });
    }

    await tx.focusLock.update({
      where: { studentId_lessonId: { studentId, lessonId: lesson.id } },
      data: { soBaiKhongDiem: soBai, soCauKhongDiem: soCau },
    });

    await tx.auditLog.create({
      data: {
        actorId: studentId,
        action: 'focus.lock_applied',
        entityType: 'Lesson',
        entityId: lesson.id,
        meta: {
          studentId,
          soLan,
          nguong: NGUONG_KHOA,
          soBaiKhongDiem: soBai,
          soCauKhongDiem: soCau,
          tuDong: true,
        },
      },
    });

    return { soBai, soCau };
  });
}

/**
 * Tell the adults, immediately.
 *
 * Unlike a focus ALERT — which is a "worth checking in on" that can wait for the
 * end of the lesson — a lock has already taken something away from a student who
 * is sitting there right now looking at a blocked editor. The teacher needs to
 * know inside the same lesson, so the copy leads with the action taken and the
 * fact that only they can reverse it.
 */
async function baoChoNguoiLon(
  db: PrismaClient,
  input: {
    studentId: string;
    classId: string | null;
    lesson: { id: string; order: number; title: string };
    soLan: number;
    soBai: number;
    soCau: number;
  },
): Promise<void> {
  const [student, klass, admins] = await Promise.all([
    db.user.findUnique({ where: { id: input.studentId }, select: { displayName: true } }),
    input.classId
      ? db.class.findUnique({
          where: { id: input.classId },
          select: { teacherId: true, teacher: { select: { isActive: true } } },
        })
      : Promise.resolve(null),
    db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ]);

  const nguoiNhan = new Set<string>();
  if (klass?.teacher.isActive) nguoiNhan.add(klass.teacherId);
  for (const a of admins) nguoiNhan.add(a.id);
  if (nguoiNhan.size === 0) return;

  const ten = student?.displayName ?? 'Một học sinh';
  const daVo = [
    input.soBai > 0 ? `${input.soBai} bài code` : null,
    input.soCau > 0 ? `${input.soCau} câu trắc nghiệm` : null,
  ]
    .filter(Boolean)
    .join(' và ');

  await db.notification.createMany({
    data: [...nguoiNhan].map((userId) => ({
      userId,
      type: 'FOCUS_LOCK' as const,
      title: `${ten} bị khoá bài do rời tab ${input.soLan} lần`,
      body:
        `Buổi ${input.lesson.order} · ${input.lesson.title}. ` +
        (daVo ? `Hệ thống đã cho 0 điểm ${daVo}. ` : 'Chưa có bài nào để trừ điểm. ') +
        'Em không nộp bài được nữa cho tới khi thầy cô mở khoá. ' +
        'Máy chỉ đếm số lần rời tab, không biết em đã mở gì — ' +
        'thầy cô hỏi em một câu rồi quyết định nhé.',
      linkUrl: `/giao-vien/hoc-sinh/${input.studentId}`,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// The teacher's side
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Locks this actor may see, scoped exactly as `canhBaoTapTrung` scopes alerts.
 *
 * The two clauses matter for the same reason they do there: `classId` is
 * nullable and is SET NULL when a class is deleted, so a teacher must also reach
 * a lock through the student they currently teach, or reorganising a class would
 * hide a locked child from the only person able to unlock them.
 */
export async function danhSachKhoa(
  db: PrismaClient,
  actor: Actor,
  options: { chiConKhoa?: boolean | undefined; gioiHan?: number | undefined } = {},
): Promise<KhoaHienThi[]> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-read-locks');

  const trongPhamVi =
    actor.role === 'ADMIN'
      ? {}
      : {
          OR: [
            { class: { teacherId: actor.id } },
            {
              student: {
                enrollments: { some: { isActive: true, class: { teacherId: actor.id } } },
              },
            },
          ],
        };

  const rows = await db.focusLock.findMany({
    where: {
      ...trongPhamVi,
      ...(options.chiConKhoa ? { state: 'LOCKED' as const } : {}),
    },
    select: {
      id: true,
      studentId: true,
      lessonId: true,
      classId: true,
      soLan: true,
      nguong: true,
      soBaiKhongDiem: true,
      soCauKhongDiem: true,
      state: true,
      createdAt: true,
      clearedAt: true,
      ghiChuMoKhoa: true,
      clearedBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options.gioiHan ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    lessonId: r.lessonId,
    classId: r.classId,
    soLan: r.soLan,
    nguong: r.nguong,
    soBaiKhongDiem: r.soBaiKhongDiem,
    soCauKhongDiem: r.soCauKhongDiem,
    state: r.state,
    luc: r.createdAt,
    nguoiMoKhoa: r.clearedBy?.displayName ?? null,
    moKhoaLuc: r.clearedAt,
    ghiChuMoKhoa: r.ghiChuMoKhoa,
  }));
}

export interface KetQuaMoKhoa {
  tenHocSinh: string;
  /** Zeroed submissions removed, so the student's history reads as it did. */
  soBaiHoanLai: number;
  /** Quiz answers whose original marking was restored. */
  soCauHoanLai: number;
}

/**
 * Lift a lock and put back what it took.
 *
 * ── Why this restores rather than merely unlocking ───────────────────────────
 * A teacher who decides the tab-outs were a child looking things up has decided
 * the zeros were wrong. Leaving them in place — "you may submit again, but the
 * zeros stand" — would mean the only remedy for a false positive is for the
 * student to redo work they already did correctly, which is a punishment for the
 * system's mistake.
 *
 * The zeroed submissions are DELETED rather than re-verdicted: they were never
 * attempts the student made, and leaving them as ACCEPTED-of-nothing or as
 * SKIPPED rows would corrupt the attempt history the student reads. Every one
 * carries the `focus-lock:` marker in `runnerError`, so the delete can be scoped
 * to exactly the rows this system created and can never touch a real attempt.
 *
 * Quiz answers are re-marked from the question bank rather than from a saved
 * copy of the old score, because there is no saved copy — `khoaViPham` records
 * that the zero was imposed, and re-grading from the stored `response` is both
 * simpler and self-correcting.
 */
export async function moKhoaViPham(
  db: PrismaClient,
  actor: Actor,
  lockId: string,
  ghiChu: string,
): Promise<KetQuaMoKhoa> {
  // Re-read through the scope filter rather than trusting the id: a teacher must
  // not be able to unlock a class they do not run by guessing one.
  const trongTam = await danhSachKhoa(db, actor, { gioiHan: 1000 });
  const khoa = trongTam.find((k) => k.id === lockId);
  if (!khoa) throw new ForbiddenError('lock-not-visible');

  const student = await db.user.findUnique({
    where: { id: khoa.studentId },
    select: { displayName: true },
  });
  if (!student) throw new ForbiddenError('student-not-found');

  const ketQua = await db.$transaction(async (tx) => {
    const xoa = await tx.submission.deleteMany({
      where: {
        studentId: khoa.studentId,
        lessonId: khoa.lessonId,
        verdict: 'WRONG_ANSWER',
        score: 0,
        runnerError: { startsWith: 'focus-lock:' },
      },
    });

    const daVo = await tx.answer.findMany({
      where: { khoaViPham: true, attempt: { studentId: khoa.studentId } },
      select: {
        id: true,
        response: true,
        attemptId: true,
        question: {
          select: {
            id: true,
            type: true,
            points: true,
            acceptedAnswers: true,
            matchMode: true,
            choices: { select: { id: true, isCorrect: true } },
            quiz: { select: { blocks: { select: { lessonId: true } } } },
          },
        },
      },
    });

    // Only the answers this lesson's lock voided. A student can hold locks on
    // two lessons at once, and lifting one must not re-grade the other.
    const thuocBai = daVo.filter((a) =>
      a.question.quiz.blocks.some((b) => b.lessonId === khoa.lessonId),
    );

    for (const a of thuocBai) {
      const dung = chamLai(a.question, a.response);
      await tx.answer.update({
        where: { id: a.id },
        data: {
          isCorrect: dung,
          pointsAwarded: dung ? a.question.points : 0,
          khoaViPham: false,
        },
      });
    }

    // Attempt totals follow from the answers, so they are recomputed rather
    // than patched — a sum written by hand here would drift from the rows.
    const idLuot = [...new Set(thuocBai.map((a) => a.attemptId))];
    for (const attemptId of idLuot) {
      const [tong, luot] = await Promise.all([
        tx.answer.aggregate({ where: { attemptId }, _sum: { pointsAwarded: true } }),
        tx.quizAttempt.findUnique({
          where: { id: attemptId },
          select: { maxScore: true, quiz: { select: { passingScore: true } } },
        }),
      ]);
      const diem = tong._sum.pointsAwarded ?? 0;
      const toiDa = luot?.maxScore ?? 0;
      const phanTram = toiDa > 0 ? Math.round((diem / toiDa) * 100) : 0;
      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: { score: diem, isPassed: phanTram >= (luot?.quiz.passingScore ?? 60) },
      });
    }

    await tx.focusLock.update({
      where: { id: lockId },
      data: {
        state: 'CLEARED',
        clearedById: actor.id,
        clearedAt: new Date(),
        ghiChuMoKhoa: ghiChu.trim().slice(0, 500) || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'focus.lock_cleared',
        entityType: 'FocusLock',
        entityId: lockId,
        meta: {
          studentId: khoa.studentId,
          lessonId: khoa.lessonId,
          soBaiHoanLai: xoa.count,
          soCauHoanLai: thuocBai.length,
          ghiChu: ghiChu.trim().slice(0, 500),
        },
      },
    });

    return { soBaiHoanLai: xoa.count, soCauHoanLai: thuocBai.length };
  });

  return { tenHocSinh: student.displayName, ...ketQua };
}

/**
 * Re-mark one answer from the question bank.
 *
 * A deliberately small copy of the marking rules in the quiz action rather than
 * an import: this runs inside a transaction in @dye/core, and reaching into the
 * web app's server action from here would invert the dependency. The two must
 * agree, which is what `khoa-vi-pham.test.ts` checks.
 */
function chamLai(
  question: {
    type: string;
    acceptedAnswers: string[];
    matchMode: string;
    choices: Array<{ id: string; isCorrect: boolean }>;
  },
  response: unknown,
): boolean {
  const traLoi = typeof response === 'string' ? response : String(response ?? '');

  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
    return question.choices.some((c) => c.id === traLoi && c.isCorrect);
  }

  if (question.type === 'FILL_BLANK') {
    const chuan = (t: string): string => {
      const base = t.trim();
      if (question.matchMode === 'exact') return base;
      const lower = base.toLowerCase().replace(/\s+/g, ' ');
      if (question.matchMode === 'insensitive') return lower;
      return lower
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd');
    };
    return question.acceptedAnswers.some((a) => chuan(a) === chuan(traLoi));
  }

  // SHORT_ANSWER is teacher-graded. Restoring it to "not correct" is right:
  // it returns to the review queue rather than being auto-passed.
  return false;
}
