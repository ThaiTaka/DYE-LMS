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

  // Manual grading is for work the sandbox cannot judge. Allowing it on an
  // IO_MATCH problem would let a verdict be set without any test ever running,
  // which quietly turns an objective result into an opinion.
  if (sub.problem.judgeMode !== 'MAKECODE' && sub.problem.judgeMode !== 'PROJECT_UPLOAD') {
    throw new ForbiddenError('problem-is-auto-judged');
  }

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
