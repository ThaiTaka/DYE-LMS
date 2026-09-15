/**
 * The one-attempt policy, and the two ways out of it.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * A student hands in a graded block ONCE. Code, Micro:bit blocks, a .hex —
 * one submission per (student, problem). After that the editor freezes and
 * the way forward is a person: the teacher resets the block, or — for a .hex
 * only — the student deletes their own file and uploads again.
 *
 * ── Enforced here, not in the UI ─────────────────────────────────────────────
 * `kiemTraConLuot` runs inside every hand-in path in @dye/core, BEFORE the
 * draft snapshot is written. A frozen editor is a courtesy; a second submit
 * from devtools, a stale tab, or a double-click meets the same refusal.
 *
 * ── A reset is a DELETE, and it is logged ────────────────────────────────────
 * The brief asks for the attempt history to be removed so the student starts
 * clean, and that is what `moLaiKhoi` does. What it does not do is forget:
 * the audit row carries every submission id, verdict and score it deleted,
 * with the teacher's name and reason, so "why does this child have no
 * record of Buổi 4?" has an answer.
 *
 * ── Content-addressed blobs are shared ───────────────────────────────────────
 * A .hex is stored under its SHA-256. Two students who export the same
 * MakeCode project hand in the same bytes and share one file on disk.
 * Deleting a submission therefore removes the blob only when no other
 * submission still points at it.
 */
import { authorize } from './authz';
import { syncLessonCompletion } from './curriculum/progress';
import { ForbiddenError } from './errors';

import type { PrismaClient } from '@prisma/client';
import type { KhoLuuTru } from './projects';
import type { Actor } from './session';

/** Hand-ins per (student, problem) before the block freezes. */
export const GIOI_HAN_LUOT_NOP = 1;

/** The one sentence every surface shows for a used-up attempt. */
export const THONG_DIEP_HET_LUOT = 'Em đã hết lượt nộp bài. Vui lòng nhờ Giáo viên mở khóa.';

/**
 * A hand-in refused because the attempt is used.
 *
 * A `ForbiddenError` — every catch that already handles one handles this —
 * whose message is the student's sentence rather than the generic refusal:
 * the code actions and the .hex route surface it verbatim, the same way a
 * locked lesson's reason is.
 */
export class HetLuotNopError extends ForbiddenError {
  constructor() {
    super('het-luot-nop');
    this.name = 'HetLuotNopError';
    this.message = THONG_DIEP_HET_LUOT;
  }
}

/** Refuse a hand-in when the student has used their attempt. */
export async function kiemTraConLuot(
  db: PrismaClient,
  studentId: string,
  problemId: string,
): Promise<void> {
  const daNop = await db.submission.count({ where: { studentId, problemId } });
  if (daNop >= GIOI_HAN_LUOT_NOP) throw new HetLuotNopError();
}

/** Hand-ins so far, per problem, for the lesson page to freeze editors on load. */
export async function soLanDaNop(
  db: PrismaClient,
  studentId: string,
  problemIds: string[],
): Promise<Map<string, number>> {
  if (problemIds.length === 0) return new Map();
  const rows = await db.submission.groupBy({
    by: ['problemId'],
    where: { studentId, problemId: { in: problemIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.problemId, r._count._all]));
}

/** Remove a stored blob, unless another submission still references it. */
async function xoaBlobNeuMoCoi(db: PrismaClient, kho: KhoLuuTru, hexKey: string): Promise<boolean> {
  const conDung = await db.submission.count({ where: { hexKey } });
  if (conDung > 0) return false;
  await kho.xoa(hexKey);
  return true;
}

export interface KetQuaXoaHex {
  daXoa: boolean;
  tenTep: string;
}

/**
 * A student deletes their own .hex hand-in so they can upload another.
 *
 * ── Only a .hex, only their own, only if a person has not marked it ─────────
 * Code and MakeCode submissions cannot be self-deleted: for those the rule is
 * one attempt and a teacher's reset. The .hex path is the exception the
 * brief carves out, and it stays narrow — once a teacher has graded it, the
 * mark stands and the student is back to asking.
 */
export async function xoaBaiNopHex(
  db: PrismaClient,
  studentId: string,
  submissionId: string,
  kho: KhoLuuTru,
): Promise<KetQuaXoaHex> {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      hexKey: true,
      code: true,
      verdict: true,
      runnerError: true,
      problemId: true,
    },
  });
  if (!sub || sub.studentId !== studentId) throw new ForbiddenError('submission-not-yours');
  if (!sub.hexKey) throw new ForbiddenError('submission-not-hex');
  if ((sub.runnerError ?? '').startsWith('cham tay boi')) {
    throw new ForbiddenError('submission-already-graded');
  }

  const hexKey = sub.hexKey;
  const tenTep = /:\s*(.+?)\s+\(/.exec(sub.code)?.[1] ?? 'tệp .hex';

  await db.$transaction([
    db.submissionTestResult.deleteMany({ where: { submissionId } }),
    db.feedback.deleteMany({ where: { submissionId } }),
    db.submission.delete({ where: { id: submissionId } }),
    db.auditLog.create({
      data: {
        actorId: studentId,
        action: 'submission.hex_deleted',
        entityType: 'Submission',
        entityId: submissionId,
        meta: { problemId: sub.problemId, hexKey, verdict: sub.verdict, tuHocSinh: true },
      },
    }),
  ]);

  // Outside the transaction: a storage failure must not resurrect the row.
  await xoaBlobNeuMoCoi(db, kho, hexKey);

  return { daXoa: true, tenTep };
}

export interface KetQuaMoLai {
  tenHocSinh: string;
  tenKhoi: string;
  soBaiNopXoa: number;
  soCauTraLoiXoa: number;
}

/**
 * A teacher resets one block for one student.
 *
 * Deletes the attempt history the block holds for that student — submissions
 * for its problem, answers for its quiz — and the completion mark, then
 * re-derives the lesson's state. The student's DRAFT is kept: it is their
 * work, and the point of a reset is to let them fix it, not retype it.
 *
 * Authorised through `student: manage`, the same relationship every other
 * teacher write goes through.
 */
export async function moLaiKhoi(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  blockId: string,
  ghiChu: string,
  kho: KhoLuuTru,
): Promise<KetQuaMoLai> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-reset');
  await authorize(db, actor, { resource: 'student', action: 'manage', studentId });

  const [block, student] = await Promise.all([
    db.lessonBlock.findUnique({
      where: { id: blockId },
      select: {
        id: true,
        title: true,
        lessonId: true,
        problemId: true,
        quiz: { select: { id: true, questions: { select: { id: true } } } },
      },
    }),
    db.user.findUnique({ where: { id: studentId }, select: { displayName: true } }),
  ]);
  if (!block) throw new ForbiddenError('block-not-found');
  if (!student) throw new ForbiddenError('student-not-found');

  const baiNop = block.problemId
    ? await db.submission.findMany({
        where: { studentId, problemId: block.problemId },
        select: { id: true, verdict: true, score: true, attemptNo: true, hexKey: true },
      })
    : [];
  const idBaiNop = baiNop.map((s) => s.id);
  const idCauHoi = block.quiz?.questions.map((q) => q.id) ?? [];

  const ketQua = await db.$transaction(async (tx) => {
    let soCau = 0;
    if (idCauHoi.length > 0) {
      const xoa = await tx.answer.deleteMany({
        where: { questionId: { in: idCauHoi }, attempt: { studentId } },
      });
      soCau = xoa.count;
      // An attempt with no answers left is noise on every later query.
      if (block.quiz) {
        const conLai = await tx.answer.count({
          where: { attempt: { studentId, quizId: block.quiz.id } },
        });
        if (conLai === 0) {
          await tx.quizAttempt.deleteMany({ where: { studentId, quizId: block.quiz.id } });
        }
      }
    }

    if (idBaiNop.length > 0) {
      await tx.submissionTestResult.deleteMany({ where: { submissionId: { in: idBaiNop } } });
      await tx.feedback.deleteMany({ where: { submissionId: { in: idBaiNop } } });
      await tx.submission.deleteMany({ where: { id: { in: idBaiNop } } });
    }

    await tx.blockProgress.deleteMany({ where: { studentId, blockId } });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'block.reset',
        entityType: 'LessonBlock',
        entityId: blockId,
        meta: {
          studentId,
          ghiChu: ghiChu.trim().slice(0, 500),
          daXoaBaiNop: baiNop.map((s) => ({
            id: s.id,
            attemptNo: s.attemptNo,
            verdict: s.verdict,
            score: s.score,
          })),
          soCauTraLoiXoa: soCau,
        },
      },
    });

    return { soCau };
  });

  // Blobs, after the rows are gone, and only the orphaned ones.
  for (const s of baiNop) {
    if (s.hexKey) await xoaBlobNeuMoCoi(db, kho, s.hexKey);
  }

  await syncLessonCompletion(db, studentId, block.lessonId);

  return {
    tenHocSinh: student.displayName,
    tenKhoi: block.title,
    soBaiNopXoa: idBaiNop.length,
    soCauTraLoiXoa: ketQua.soCau,
  };
}
