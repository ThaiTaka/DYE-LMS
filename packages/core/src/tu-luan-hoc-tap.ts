/**
 * Post-lesson reflections ("tự luận học tập"): what a student says they learned.
 *
 * ── The contract ─────────────────────────────────────────────────────────────
 *   • Only a STUDENT writes one, only for themselves, only in a lesson the
 *     gating engine has opened to them, and never while an integrity lock is in
 *     force on that lesson — the same doors every other hand-in passes through.
 *   • At least SO_CHU_TOI_THIEU_SUY_NGAM words, counted HERE by `demSoChu`. The
 *     disabled button in the browser is a courtesy to the child; this is the
 *     rule, because the action is reachable from a console in a tab that never
 *     re-rendered.
 *   • One per lesson. A double-click or a stale second tab is refused by the
 *     unique key on (studentId, lessonId), not by the button.
 *
 * ── What it deliberately does not do ─────────────────────────────────────────
 * It completes nothing. Lesson completion is computed from BlockProgress, and a
 * reflection is not a block — see the note on `LessonReflection` in the schema.
 * The teacher reads it on the student's page; that is its whole audience.
 */
import { authorize } from './authz';
import { assertLessonUnlocked } from './curriculum/gating';
import { demSoChu, SO_CHU_TOI_THIEU_SUY_NGAM, SUY_NGAM_TOI_DA_KY_TU } from './dem-chu';
import { ForbiddenError } from './errors';
import { biKhoaViPham } from './khoa-vi-pham';

import type { PrismaClient } from '@prisma/client';
import type { Actor } from './session';

/** A reflection as its author sees it again. */
export interface TuLuanHocTapDaNop {
  noiDung: string;
  soChu: number;
  nopLuc: Date;
}

export type KetQuaNopTuLuanHocTap =
  | { trangThai: 'da-nhan'; soChu: number }
  | { trangThai: 'chua-du-chu'; soChu: number; toiThieu: number }
  | { trangThai: 'qua-dai'; toiDa: number }
  | { trangThai: 'da-nop-roi' }
  | { trangThai: 'bi-khoa' };

/** Prisma's unique-constraint violation, without importing the error class. */
function laTrungKhoa(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Store one post-lesson reflection.
 *
 * Every refusal a child can cause by writing is RETURNED, with the numbers the
 * page needs to say why ("em mới viết 120/150 chữ"). Only refusals a child
 * cannot cause by writing — wrong role, a locked or unknown lesson — throw.
 */
export async function nopTuLuanHocTap(
  db: PrismaClient,
  actor: Actor,
  lessonId: string,
  noiDung: string,
): Promise<KetQuaNopTuLuanHocTap> {
  /*
   * Students only, checked by role BEFORE `authorize`: `progress: read` on
   * one's own id admits an admin too, and an admin previewing a lesson must
   * not leave a reflection filed under their own account.
   */
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-reflect');
  await authorize(db, actor, { resource: 'progress', action: 'read', studentId: actor.id });

  // The lesson id comes from the browser. Without this a student could file a
  // reflection against a session the gating engine has not opened to them.
  await assertLessonUnlocked(db, actor.id, lessonId);

  if (await biKhoaViPham(db, actor.id, lessonId)) return { trangThai: 'bi-khoa' };

  const vanBan = noiDung.trim();
  if (vanBan.length > SUY_NGAM_TOI_DA_KY_TU) {
    return { trangThai: 'qua-dai', toiDa: SUY_NGAM_TOI_DA_KY_TU };
  }

  const soChu = demSoChu(vanBan);
  if (soChu < SO_CHU_TOI_THIEU_SUY_NGAM) {
    return { trangThai: 'chua-du-chu', soChu, toiThieu: SO_CHU_TOI_THIEU_SUY_NGAM };
  }

  try {
    await db.lessonReflection.create({
      data: { studentId: actor.id, lessonId, content: vanBan, wordCount: soChu },
      select: { id: true },
    });
  } catch (error) {
    // Insert-and-catch rather than check-then-insert: two submits racing each
    // other would both pass a check, and only the key sees them both.
    if (laTrungKhoa(error)) return { trangThai: 'da-nop-roi' };
    throw error;
  }

  return { trangThai: 'da-nhan', soChu };
}

/**
 * The student's own reflection on one lesson, or null.
 *
 * Takes the student id from the caller, which is always the session: this is
 * read by the lesson page for the child who is looking at it.
 */
export async function tuLuanHocTapCuaBai(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<TuLuanHocTapDaNop | null> {
  const row = await db.lessonReflection.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
    select: { content: true, wordCount: true, createdAt: true },
  });
  return row ? { noiDung: row.content, soChu: row.wordCount, nopLuc: row.createdAt } : null;
}

/** One reflection, as a teacher reads it on the student's page. */
export interface TuLuanHocTapHienThi {
  id: string;
  lessonId: string;
  buoi: number;
  tenBai: string;
  tenKhoaHoc: string;
  noiDung: string;
  soChu: number;
  nopLuc: Date;
}

/**
 * Every reflection this student has written, newest first.
 *
 * Behind `student: read`, the same permission as the rest of the teacher's
 * page about this child: a teacher who does not teach them through a live
 * enrolment is refused before a row is read.
 */
export async function tuLuanHocTapCuaHocSinh(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  gioiHan = 60,
): Promise<TuLuanHocTapHienThi[]> {
  await authorize(db, actor, { resource: 'student', action: 'read', studentId });

  const rows = await db.lessonReflection.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: gioiHan,
    select: {
      id: true,
      content: true,
      wordCount: true,
      createdAt: true,
      lesson: {
        select: { id: true, order: true, title: true, course: { select: { title: true } } },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lesson.id,
    buoi: r.lesson.order,
    tenBai: r.lesson.title,
    tenKhoaHoc: r.lesson.course.title,
    noiDung: r.content,
    soChu: r.wordCount,
    nopLuc: r.createdAt,
  }));
}
