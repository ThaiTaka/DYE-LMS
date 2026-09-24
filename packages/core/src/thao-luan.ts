/**
 * The class chat ("Thảo luận lớp") — who may read it, who may write in it.
 *
 * ── Relational, like everything else ─────────────────────────────────────────
 * Both directions go through `authorize(class: read)`: a student reads and
 * writes only in a class they are ACTIVELY enrolled in; the class's teacher and
 * an admin read it. There is no role-only path — a teacher of another class
 * sees nothing, which is the rule `authz.ts` exists to hold.
 *
 * ── Students write; adults read ──────────────────────────────────────────────
 * `ClassMessage.studentId` is the author and is always a student. A teacher
 * reads the feed from the class page, because a group chat between children
 * that no adult can see is not something this product ships.
 *
 * ── Moderation is the caller's first job, and this module's last check ───────
 * The filter — the tutor's word list and then its model classifier — lives in
 * the web app (`lib/kiem-duyet-tin-nhan.ts`), because the classifier needs the
 * API key and the SDK. `POST /api/chat` runs it BEFORE calling `guiTinNhanLop`,
 * and a message that trips it never reaches this module: it goes to
 * `khoaTroLyViPham` instead. What this module does re-check, inside the write,
 * is the lock itself — a violation landing between the route's lock check and
 * this insert must not let the next message through.
 */
import { authorize } from './authz';
import { ForbiddenError } from './errors';

import type { PrismaClient } from '@prisma/client';
import type { Actor } from './session';

/** Characters per message. A chat line, not an essay — and less to moderate. */
export const GIOI_HAN_TIN_NHAN = 500;

/** Messages on first load: the recent conversation, not the whole year. */
export const SO_TIN_NHAN_BAN_DAU = 50;

/** Most rows one poll returns. A class of thirty cannot outrun this in 5 s. */
const SO_TIN_NHAN_MOI_LAN_HOI = 100;

export interface TinNhanLop {
  id: string;
  noiDung: string;
  luc: Date;
  tacGia: { id: string; ten: string; anh: string | null };
}

export interface LopThaoLuan {
  id: string;
  ten: string;
  ma: string;
}

const CHON_TIN_NHAN = {
  id: true,
  content: true,
  createdAt: true,
  student: { select: { id: true, displayName: true, avatarUrl: true } },
} as const;

function thanhTinNhan(r: {
  id: string;
  content: string;
  createdAt: Date;
  student: { id: string; displayName: string; avatarUrl: string | null };
}): TinNhanLop {
  return {
    id: r.id,
    noiDung: r.content,
    luc: r.createdAt,
    tacGia: { id: r.student.id, ten: r.student.displayName, anh: r.student.avatarUrl },
  };
}

/**
 * The classes whose chat this actor can open, in name order.
 *
 * A student gets the classes they are actively in; a teacher the ones they
 * run. Archived classes are left out — a class that has ended is not a place
 * to start a conversation. Admins get none here: they read a class's chat from
 * its page like its teacher does, rather than from a list of every class.
 */
export async function lopThaoLuanCuaEm(db: PrismaClient, actor: Actor): Promise<LopThaoLuan[]> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');

  if (actor.role === 'STUDENT') {
    const rows = await db.enrollment.findMany({
      where: { studentId: actor.id, isActive: true, class: { isArchived: false } },
      select: { class: { select: { id: true, name: true, code: true } } },
      orderBy: { class: { name: 'asc' } },
    });
    return rows.map((r) => ({ id: r.class.id, ten: r.class.name, ma: r.class.code }));
  }

  if (actor.role === 'TEACHER') {
    const rows = await db.class.findMany({
      where: { teacherId: actor.id, isArchived: false },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, ten: r.name, ma: r.code }));
  }

  return [];
}

/**
 * Messages in one class, oldest first.
 *
 * With `tu`, everything at or after that moment — the poll. The caller passes
 * a moment slightly BEFORE the newest message it holds and drops the ids it
 * already has: two inserts can commit out of timestamp order, and a strict
 * "newer than my last one" would lose the one that committed second forever.
 * Without `tu`, the most recent `SO_TIN_NHAN_BAN_DAU`.
 */
export async function tinNhanCuaLop(
  db: PrismaClient,
  actor: Actor,
  classId: string,
  options: { tu?: Date | undefined } = {},
): Promise<TinNhanLop[]> {
  await authorize(db, actor, { resource: 'class', action: 'read', classId });

  if (options.tu) {
    const rows = await db.classMessage.findMany({
      where: { classId, createdAt: { gte: options.tu } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: SO_TIN_NHAN_MOI_LAN_HOI,
      select: CHON_TIN_NHAN,
    });
    return rows.map(thanhTinNhan);
  }

  const rows = await db.classMessage.findMany({
    where: { classId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: SO_TIN_NHAN_BAN_DAU,
    select: CHON_TIN_NHAN,
  });
  return rows.reverse().map(thanhTinNhan);
}

export interface TrangThaiThaoLuan {
  /** The class has been archived: readable, closed to new messages. */
  daLuuTru: boolean;
  /** This actor is a student under the moderation lock. */
  biKhoa: boolean;
  /** The one question the composer asks: may this actor send right now? */
  coTheGui: boolean;
}

/** Whether this actor may write in this class right now, and if not, why. */
export async function trangThaiThaoLuan(
  db: PrismaClient,
  actor: Actor,
  classId: string,
): Promise<TrangThaiThaoLuan> {
  await authorize(db, actor, { resource: 'class', action: 'read', classId });

  const [lop, nguoi] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { isArchived: true } }),
    db.user.findUnique({ where: { id: actor.id }, select: { isAiLocked: true } }),
  ]);
  const daLuuTru = lop?.isArchived ?? true;
  const biKhoa = actor.role === 'STUDENT' && (nguoi?.isAiLocked ?? false);

  return { daLuuTru, biKhoa, coTheGui: actor.role === 'STUDENT' && !daLuuTru && !biKhoa };
}

export type KetQuaGuiTinNhan =
  | { trangThai: 'da-gui'; tinNhan: TinNhanLop }
  | { trangThai: 'rong' }
  | { trangThai: 'qua-dai'; toiDa: number }
  | { trangThai: 'bi-khoa' }
  | { trangThai: 'lop-luu-tru' };

/**
 * Post one message. The caller has ALREADY moderated it — see the module note.
 *
 * Students only, and only in a class they are actively in. Every refusal a
 * child can cause is returned; only "not allowed here at all" throws.
 */
export async function guiTinNhanLop(
  db: PrismaClient,
  actor: Actor,
  classId: string,
  noiDung: string,
): Promise<KetQuaGuiTinNhan> {
  // Checked BEFORE `authorize`: `class: read` admits the class's teacher, and
  // the author column is a student id by definition.
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-post-in-class-chat');
  await authorize(db, actor, { resource: 'class', action: 'read', classId });

  const vanBan = noiDung.trim();
  if (vanBan === '') return { trangThai: 'rong' };
  if (vanBan.length > GIOI_HAN_TIN_NHAN) return { trangThai: 'qua-dai', toiDa: GIOI_HAN_TIN_NHAN };

  const [lop, hs] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { isArchived: true } }),
    db.user.findUnique({ where: { id: actor.id }, select: { isAiLocked: true } }),
  ]);
  if (!lop || lop.isArchived) return { trangThai: 'lop-luu-tru' };
  if (hs?.isAiLocked) return { trangThai: 'bi-khoa' };

  const row = await db.classMessage.create({
    data: { classId, studentId: actor.id, content: vanBan },
    select: CHON_TIN_NHAN,
  });

  return { trangThai: 'da-gui', tinNhan: thanhTinNhan(row) };
}
