/**
 * Manual grading, for work a machine cannot judge.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * A Micro:bit program's output is light on a physical LED matrix. There is no
 * stdout to compare, no exit code to read, and no container that can watch a
 * board blink. The honest answer is that a person grades it — so this is a
 * first-class path rather than a workaround, and it writes the same rows the
 * automatic judge does.
 *
 * ── The shared progress hook ─────────────────────────────────────────────────
 * `ghiNhanDatBai` is used by BOTH the judge worker and a teacher grading by
 * hand. One implementation, so an accepted answer means exactly the same thing
 * however it was reached — and lesson completion is always re-derived by the
 * Phase 4 engine rather than written directly.
 */
import { syncLessonCompletion } from './curriculum/progress';
import { ForbiddenError } from './errors';

import type { PrismaClient, Verdict } from '@prisma/client';
import type { Actor } from './session';

/**
 * Record that a student has satisfied a problem.
 *
 * Marks every block carrying that problem complete, then asks the Phase 4
 * engine to recompute lesson completion from the blocks REQUIRED for that
 * particular student — so a Cơ bản student is never held back by a Nâng cao
 * challenge sitting in the same lesson.
 */
export async function ghiNhanDatBai(
  db: PrismaClient,
  studentId: string,
  problemId: string,
): Promise<void> {
  const khoi = await db.lessonBlock.findMany({
    where: { problemId },
    select: { id: true, lessonId: true },
  });

  for (const b of khoi) {
    await db.blockProgress.upsert({
      where: { studentId_blockId: { studentId, blockId: b.id } },
      create: { studentId, blockId: b.id, state: 'COMPLETED', completedAt: new Date() },
      update: { state: 'COMPLETED', completedAt: new Date() },
    });
  }

  for (const lessonId of [...new Set(khoi.map((b) => b.lessonId))]) {
    await syncLessonCompletion(db, studentId, lessonId);
  }
}

/**
 * Effort counts.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * Handing something in completes the block — code the judge has not yet seen,
 * a quiz answered wrong, an essay nobody has marked. Completion here means
 * "the student did the work", and the verdict, the score and the teacher's
 * mark stay exactly as informative as before; they just stop being the gate
 * to the next lesson.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * The audience is ten years old. Under the previous rule a lesson stayed
 * incomplete until every required block was ACCEPTED — and, because nothing
 * ever marked a theory or quiz block at all, a lesson with one paragraph of
 * theory in it could never complete and the next never unlocked. A child who
 * has read the page, answered the quiz and submitted an attempt at the
 * exercise has done Buổi 3; whether the attempt passed is what the teacher's
 * page is for.
 *
 * ── What it deliberately keeps ───────────────────────────────────────────────
 * `ghiNhanDatBai` (ACCEPTED → complete) is unchanged and still runs from the
 * judge. On a block that was already completed by effort it is a no-op. It
 * matters for the one case effort cannot see: a teacher grading by hand marks
 * a problem the student never submitted through the page.
 */
export async function ghiNhanNoLuc(
  db: PrismaClient,
  studentId: string,
  blockId: string,
): Promise<{ baiXong: boolean }> {
  const block = await db.lessonBlock.findUnique({
    where: { id: blockId },
    select: { lessonId: true },
  });
  if (!block) return { baiXong: false };

  await db.blockProgress.upsert({
    where: { studentId_blockId: { studentId, blockId } },
    create: { studentId, blockId, state: 'COMPLETED', completedAt: new Date() },
    // Already complete: keep the original timestamp.
    update: { state: 'COMPLETED' },
  });

  const baiXong = await syncLessonCompletion(db, studentId, block.lessonId);
  return { baiXong };
}

/** Verdicts a human may set. The machine-only states are not offered. */
export const KET_LUAN_CHAM_TAY: Verdict[] = ['ACCEPTED', 'WRONG_ANSWER'];

export interface KetQuaChamTay {
  submissionId: string;
  verdict: Verdict;
  score: number;
}

/**
 * Grade one submission by hand.
 *
 * Refuses unless the actor genuinely teaches this student, through the same
 * `Class → Enrollment` relationship every other path uses. A teacher grading a
 * child they do not teach is exactly the failure the authorization layer exists
 * to prevent, and it does not become acceptable because the grading is manual.
 */
export async function chamTay(
  db: PrismaClient,
  actor: Actor,
  submissionId: string,
  verdict: Verdict,
  score: number,
  nhanXet: string,
): Promise<KetQuaChamTay> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-grade');
  if (!KET_LUAN_CHAM_TAY.includes(verdict)) throw new ForbiddenError('verdict-not-manual');

  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      problemId: true,
      problem: { select: { judgeMode: true, totalPoints: true } },
    },
  });
  // Unknown id is forbidden rather than missing: which ids exist is itself
  // information.
  if (!sub) throw new ForbiddenError('submission-not-found');

  if (actor.role !== 'ADMIN') {
    const day = await db.enrollment.findFirst({
      where: { studentId: sub.studentId, isActive: true, class: { teacherId: actor.id } },
      select: { id: true },
    });
    if (!day) throw new ForbiddenError('teacher-does-not-teach-student');
  }

  /*
   * Any submission may be graded by hand, including one the sandbox judged.
   *
   * This used to refuse auto-judged problems, on the argument that a verdict
   * set without a test running turns an objective result into an opinion.
   * The argument still holds — and the teacher is still the person the
   * platform exists to serve. A sandbox that marks WRONG_ANSWER because a
   * ten-year-old printed "Xin chao" with a trailing space is not objectively
   * right; it is objectively literal. The override is ATTRIBUTED (see
   * `runnerError` below) and carries a required note, so an overridden
   * machine verdict stays distinguishable from a machine verdict forever.
   */

  const diem = Math.max(0, Math.min(Math.round(score), sub.problem.totalPoints));

  await db.$transaction([
    db.submission.update({
      where: { id: submissionId },
      data: {
        verdict,
        score: verdict === 'ACCEPTED' ? diem : Math.min(diem, sub.problem.totalPoints - 1),
        judgedAt: new Date(),
        // Attributed, so "who decided this?" stays answerable.
        runnerError: `cham tay boi ${actor.username}`,
      },
    }),
    db.feedback.create({
      data: { authorId: actor.id, submissionId, comment: nhanXet },
    }),
  ]);

  if (verdict === 'ACCEPTED') {
    await ghiNhanDatBai(db, sub.studentId, sub.problemId);
  }

  return { submissionId, verdict, score: diem };
}
