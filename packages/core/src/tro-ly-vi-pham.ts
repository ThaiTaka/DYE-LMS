/**
 * The tutor's moderation lock — what happens when a student sends Bí something
 * a child should not be sending.
 *
 * ── What it is, and what it is not ───────────────────────────────────────────
 * The route (`api/tro-ly/route.ts`) decides WHETHER a message is a violation.
 * This module decides what that costs and how it is undone: the student loses
 * the tutor — nothing else, not a score, not a lesson — until a teacher who
 * teaches them lifts it.
 *
 * The same three properties as the focus lock (`khoa-vi-pham.ts`), for the same
 * reasons:
 *
 *   1. IT LEAVES EVIDENCE. The lock and the `AiViolationAlert` are written in
 *      one transaction. A locked child with no row saying why is a punishment
 *      nobody can explain to a parent.
 *   2. ONLY STUDENTS. A teacher or admin trying the tutor out is refused an
 *      answer by the route, never locked — there would be nobody above them to
 *      lift it.
 *   3. IT IS ALWAYS LIFTABLE, by the adult who teaches that child. Moderation is
 *      a judgement call made by a keyword list or a model, so being wrong is a
 *      normal outcome and the remedy has to be one click away.
 */
import { authorize } from './authz';
import { ForbiddenError } from './errors';

import type { AiViolationType, PrismaClient } from '@prisma/client';
import type { Actor } from './session';

/** Which check caught it. Stored verbatim in `AiViolationAlert.detectedBy`. */
export type NguonPhatHien = 'tu-khoa' | 'mo-hinh';

/** Chars of the offending message kept on the alert — the route's own prompt cap. */
const GIOI_HAN_NOI_DUNG = 2000;

/**
 * Is Bí switched off for this user?
 *
 * The first thing the tutor route asks, before any model is called — a locked
 * student must not be able to spend a single token.
 */
export async function biKhoaTroLy(db: PrismaClient, userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { isAiLocked: true } });
  return u?.isAiLocked ?? false;
}

export interface KetQuaKhoaTroLy {
  alertId: string;
}

/**
 * Lock the tutor for this student and record why.
 *
 * One transaction: the flag and the alert land together or not at all. The
 * role is re-read INSIDE it rather than taken from the caller, so a change of
 * role between the route's check and this write cannot lock a staff account.
 */
export async function khoaTroLyViPham(
  db: PrismaClient,
  studentId: string,
  input: { noiDung: string; loai: AiViolationType; nguon: NguonPhatHien },
): Promise<KetQuaKhoaTroLy> {
  return db.$transaction(async (tx) => {
    const hs = await tx.user.findUnique({ where: { id: studentId }, select: { role: true } });
    if (!hs || hs.role !== 'STUDENT') throw new ForbiddenError('only-students-are-ai-locked');

    await tx.user.update({ where: { id: studentId }, data: { isAiLocked: true } });

    const alert = await tx.aiViolationAlert.create({
      data: {
        studentId,
        promptText: input.noiDung.slice(0, GIOI_HAN_NOI_DUNG),
        violationType: input.loai,
        detectedBy: input.nguon,
      },
      select: { id: true },
    });

    return { alertId: alert.id };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// The teacher's side
// ═══════════════════════════════════════════════════════════════════════════

export interface CanhBaoTroLyHienThi {
  id: string;
  studentId: string;
  tenHocSinh: string;
  username: string;
  /** What the student typed. The teacher needs it to judge the machine. */
  noiDung: string;
  loai: AiViolationType;
  nguon: NguonPhatHien;
  daXuLy: boolean;
  /** Whether the student is locked RIGHT NOW, whatever this row says. */
  conKhoa: boolean;
  luc: Date;
  nguoiXuLy: string | null;
  xuLyLuc: Date | null;
}

/**
 * The same relational scope as `canhBaoTapTrung`: an admin sees everyone, a
 * teacher sees students they currently teach. There is no `classId` on the
 * alert — a student's tutor is not tied to one class — so the scope goes
 * through enrolment alone.
 */
function phamVi(actor: Actor) {
  return actor.role === 'ADMIN'
    ? {}
    : {
        student: {
          enrollments: { some: { isActive: true, class: { teacherId: actor.id } } },
        },
      };
}

/** Alerts this actor may see, newest first. */
export async function canhBaoTroLy(
  db: PrismaClient,
  actor: Actor,
  options: { chiChuaXuLy?: boolean | undefined; gioiHan?: number | undefined } = {},
): Promise<CanhBaoTroLyHienThi[]> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-read-ai-alerts');

  const rows = await db.aiViolationAlert.findMany({
    where: { ...phamVi(actor), ...(options.chiChuaXuLy ? { resolved: false } : {}) },
    select: {
      id: true,
      studentId: true,
      promptText: true,
      violationType: true,
      detectedBy: true,
      resolved: true,
      resolvedAt: true,
      createdAt: true,
      student: { select: { displayName: true, username: true, isAiLocked: true } },
      resolvedBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options.gioiHan ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    tenHocSinh: r.student.displayName,
    username: r.student.username,
    noiDung: r.promptText,
    loai: r.violationType,
    nguon: r.detectedBy === 'mo-hinh' ? 'mo-hinh' : 'tu-khoa',
    daXuLy: r.resolved,
    conKhoa: r.student.isAiLocked,
    luc: r.createdAt,
    nguoiXuLy: r.resolvedBy?.displayName ?? null,
    xuLyLuc: r.resolvedAt,
  }));
}

/** Open tutor alerts for this actor. Feeds the nav badge alongside focus alerts. */
export async function soCanhBaoTroLyChuaXuLy(db: PrismaClient, actor: Actor): Promise<number> {
  if (!actor.isActive || actor.role === 'STUDENT') return 0;
  return db.aiViolationAlert.count({ where: { resolved: false, ...phamVi(actor) } });
}

export interface KetQuaMoKhoaTroLy {
  tenHocSinh: string;
  /** Open alerts closed by this unlock. */
  soCanhBaoDaXuLy: number;
}

/**
 * Give a student their tutor back.
 *
 * ── The role check comes BEFORE `authorize` ──────────────────────────────────
 * `authorize(student: manage)` lets a student through for their OWN id — that
 * is right for reading a profile and exactly wrong here. Without the explicit
 * refusal, the lock would be a door the student holds the key to.
 *
 * Resolves every open alert for the student with the teacher's name and time
 * on each, and records the note in `AuditLog`: a lock that appeared for a
 * recorded reason and vanished for none is the question a parent asks and
 * nobody can answer.
 */
export async function moKhoaTroLy(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  ghiChu: string,
): Promise<KetQuaMoKhoaTroLy> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-unlock-ai');
  await authorize(db, actor, { resource: 'student', action: 'manage', studentId });

  const hs = await db.user.findUnique({
    where: { id: studentId },
    select: { displayName: true, isAiLocked: true },
  });
  if (!hs) throw new ForbiddenError('student-not-found');

  const soCanhBao = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: studentId }, data: { isAiLocked: false } });

    const { count } = await tx.aiViolationAlert.updateMany({
      where: { studentId, resolved: false },
      data: { resolved: true, resolvedById: actor.id, resolvedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'ai.unlocked',
        entityType: 'User',
        entityId: studentId,
        meta: { ghiChu: ghiChu.trim().slice(0, 500), soCanhBao: count, dangKhoa: hs.isAiLocked },
      },
    });

    return count;
  });

  return { tenHocSinh: hs.displayName, soCanhBaoDaXuLy: soCanhBao };
}
