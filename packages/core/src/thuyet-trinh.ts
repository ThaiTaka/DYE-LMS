/**
 * The eight-slide presentation at every fifteenth session.
 *
 * ── The contract ─────────────────────────────────────────────────────────────
 *   • Only a STUDENT hands one in, only for themselves, only on a PRESENTATION
 *     block in a lesson the gating engine has opened to them, and never under
 *     an integrity lock — `moKhoiCode` is the same door every hand-in uses.
 *   • Exactly `SO_TRANG_THUYET_TRINH` slides, each with a title and content,
 *     checked HERE by `kiemTraThuyetTrinh`. The browser runs the same function
 *     to decide when the button lights up; this is the one that counts.
 *   • Once per block. The unique key on (student, block) refuses a second
 *     hand-in, so a double-click or a stale tab cannot overwrite what a teacher
 *     is reading. A teacher's "Mở lại" on the block (`moLaiKhoi`) removes it.
 *
 * Unlike a post-lesson reflection, this IS a block: handing it in completes it
 * through `ghiNhanNoLuc`, and the lesson's progress moves with it.
 */
import { authorize } from './authz';
import { moKhoiCode } from './code';
import { ForbiddenError } from './errors';
import { ghiNhanNoLuc } from './grading';
import {
  kiemTraThuyetTrinh,
  type LoiThuyetTrinh,
  type TrangThuyetTrinh,
} from './trang-thuyet-trinh';

import type { Prisma, PrismaClient } from '@prisma/client';
import type { Actor } from './session';

export type KetQuaNopThuyetTrinh =
  | { trangThai: 'da-nhan'; baiXong: boolean }
  | { trangThai: 'khong-hop-le'; loi: LoiThuyetTrinh }
  | { trangThai: 'da-nop-roi' };

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
 * Read slides back out of JSON written by `nopThuyetTrinh`.
 *
 * Total, like `parseNoiDung`: a row edited by hand degrades to whatever slides
 * still parse rather than taking down the page it is shown on.
 */
function docTrang(json: Prisma.JsonValue): TrangThuyetTrinh[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((t) => {
    if (typeof t !== 'object' || t === null || Array.isArray(t)) return [];
    const tieuDe = t['tieuDe'];
    const noiDung = t['noiDung'];
    return typeof tieuDe === 'string' && typeof noiDung === 'string' ? [{ tieuDe, noiDung }] : [];
  });
}

/**
 * Hand in one presentation.
 *
 * Every refusal a child can cause by WRITING is returned with enough detail
 * for the page to say which slide needs work. Refusals they cannot cause by
 * writing — wrong role, a locked lesson, a block that is not a presentation —
 * throw `ForbiddenError`, whose message for a lock is already a sentence.
 */
export async function nopThuyetTrinh(
  db: PrismaClient,
  actor: Actor,
  blockId: string,
  slides: unknown,
): Promise<KetQuaNopThuyetTrinh> {
  // Students only. A teacher previewing the lesson must not leave a
  // presentation filed under their own account.
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-present');

  const khoi = await moKhoiCode(db, actor.id, blockId);

  const block = await db.lessonBlock.findUnique({
    where: { id: khoi.blockId },
    select: { type: true },
  });
  if (!block || block.type !== 'PRESENTATION') throw new ForbiddenError('not-a-presentation-block');

  const kiemTra = kiemTraThuyetTrinh(slides);
  if (!kiemTra.ok) return { trangThai: 'khong-hop-le', loi: kiemTra.loi };

  try {
    await db.presentationSubmission.create({
      data: {
        studentId: actor.id,
        blockId: khoi.blockId,
        slides: kiemTra.trang as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  } catch (error) {
    // Insert-and-catch, not check-then-insert: two racing submits would both
    // pass a check, and only the key sees them both.
    if (laTrungKhoa(error)) return { trangThai: 'da-nop-roi' };
    throw error;
  }

  const { baiXong } = await ghiNhanNoLuc(db, actor.id, khoi.blockId);
  return { trangThai: 'da-nhan', baiXong };
}

export interface ThuyetTrinhDaNop {
  trang: TrangThuyetTrinh[];
  nopLuc: Date;
}

/**
 * This student's presentations on these blocks, keyed by block.
 *
 * One query for a whole lesson. The student id comes from the caller, which is
 * always the session student the lesson page is rendering for.
 */
export async function thuyetTrinhCuaKhoi(
  db: PrismaClient,
  studentId: string,
  blockIds: string[],
): Promise<Map<string, ThuyetTrinhDaNop>> {
  if (blockIds.length === 0) return new Map();

  const rows = await db.presentationSubmission.findMany({
    where: { studentId, blockId: { in: blockIds } },
    select: { blockId: true, slides: true, createdAt: true },
  });

  return new Map(rows.map((r) => [r.blockId, { trang: docTrang(r.slides), nopLuc: r.createdAt }]));
}

/** One presentation, as a teacher reads it on the student's page. */
export interface ThuyetTrinhHienThi {
  id: string;
  buoi: number;
  tenBai: string;
  tenKhoaHoc: string;
  trang: TrangThuyetTrinh[];
  nopLuc: Date;
}

/**
 * Every presentation this student has handed in, newest first.
 *
 * Behind `student: read` — the permission the rest of the teacher's page about
 * this child already demands, so a teacher reaches it only through a live
 * enrolment in a class they run.
 */
export async function thuyetTrinhCuaHocSinh(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  gioiHan = 20,
): Promise<ThuyetTrinhHienThi[]> {
  await authorize(db, actor, { resource: 'student', action: 'read', studentId });

  const rows = await db.presentationSubmission.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: gioiHan,
    select: {
      id: true,
      slides: true,
      createdAt: true,
      block: {
        select: {
          lesson: { select: { order: true, title: true, course: { select: { title: true } } } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    buoi: r.block.lesson.order,
    tenBai: r.block.lesson.title,
    tenKhoaHoc: r.block.lesson.course.title,
    trang: docTrang(r.slides),
    nopLuc: r.createdAt,
  }));
}
