/**
 * Student code: drafts, history, and submission.
 *
 * ── What this module protects ────────────────────────────────────────────────
 * A student's work. The brief's requirement is blunt and correct: closing the
 * tab, a flat battery, or wandering off to another lesson must never cost a
 * child the code they just wrote. Everything here exists to make losing work
 * hard.
 *
 * ── Three storage layers, three jobs ─────────────────────────────────────────
 *   CodeDraft     the live working copy. One row per (student, block),
 *                 overwritten by autosave. Answers "what was I typing?"
 *   CodeSnapshot  append-only history. Answers "what did it look like before
 *                 I broke it?" — and restoring never destroys the present.
 *   Submission    a deliberate act by the student. Answers "what did I hand in?"
 *
 * Drafts and snapshots are keyed on the BLOCK, not the Problem: a Code Playground
 * has no problem attached and deserves the same protection as a graded challenge.
 * Submissions stay keyed on the Problem, because that is what gets judged.
 *
 * ── Gating ───────────────────────────────────────────────────────────────────
 * Every entry point re-resolves lesson access through the Phase 4 engine. A
 * locked lesson refuses reads and writes alike: hiding an editor is not access
 * control, and a POST does not care what the UI rendered.
 */
import { createHash } from 'node:crypto';

import { resolveLessonAccess } from './curriculum/gating';
import { ForbiddenError } from './errors';

import type { PrismaClient, SnapshotReason, Verdict } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Policy
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Largest draft accepted, in characters.
 *
 * Generous for a middle-school Python exercise and small enough that a stuck
 * client or a pasted binary cannot fill the table. Rejected rather than
 * truncated: silently keeping half of a student's file is worse than saying no.
 */
export const GIOI_HAN_KY_TU = 64 * 1024;

/**
 * Minimum gap between two AUTO snapshots for the same block.
 *
 * Autosave fires every couple of seconds; snapshotting each one would write
 * thousands of near-identical rows per lesson and make the history unreadable.
 * Three minutes keeps "an hour of work" down to roughly twenty entries — enough
 * to find a working state, few enough to scan.
 */
export const KHOANG_CACH_BAN_LUU_MS = 3 * 60 * 1000;

/** Snapshots retained per (student, block). Oldest AUTO rows are pruned first. */
export const SO_BAN_LUU_TOI_DA = 30;

/** SHA-256 of the code, used to skip no-op writes and to dedupe snapshots. */
export function bamMa(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// Access
// ═══════════════════════════════════════════════════════════════════════════

export interface KhoiCode {
  blockId: string;
  lessonId: string;
  problemId: string | null;
  starterCode: string;
}

/**
 * Resolve a code block and refuse unless this student may work in it.
 *
 * Unknown block ids are refused rather than reported as missing, matching the
 * rule in `authz.ts`: telling a caller which ids exist is itself a leak.
 */
export async function moKhoiCode(
  db: PrismaClient,
  studentId: string,
  blockId: string,
): Promise<KhoiCode> {
  const block = await db.lessonBlock.findUnique({
    where: { id: blockId },
    select: {
      id: true,
      lessonId: true,
      problemId: true,
      problem: { select: { starterCode: true } },
    },
  });
  if (!block) throw new ForbiddenError('block-not-found');

  const access = await resolveLessonAccess(db, studentId, block.lessonId);
  if (!access) throw new ForbiddenError('lesson-not-found');

  if (!access.unlocked) {
    // The lock reason is safe to surface: it says what to finish first and
    // reveals nothing about any other student.
    const error = new ForbiddenError(`lesson-locked:${access.slug}`);
    Object.defineProperty(error, 'message', {
      value: access.lockReason ?? 'Bài học này chưa mở.',
      enumerable: true,
    });
    throw error;
  }

  return {
    blockId: block.id,
    lessonId: block.lessonId,
    problemId: block.problemId,
    starterCode: block.problem?.starterCode ?? '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Autosave
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaLuuNhap {
  /** False when the incoming code was byte-identical to what is already stored. */
  daGhi: boolean;
  /** Set when this save also became a history entry. */
  phienBanMoi: number | null;
  luuLuc: Date;
}

/**
 * Store the student's working copy.
 *
 * Idempotent by content hash: an unchanged body performs NO write. Autosave runs
 * on a timer, a student can sit on a finished exercise for ten minutes, and a
 * blur or a tab switch can fire a save with nothing new in it — none of that
 * should touch the database.
 *
 * A snapshot is added when the content actually changed AND the last snapshot is
 * older than `KHOANG_CACH_BAN_LUU_MS`, so history stays useful rather than
 * exhaustive.
 */
export async function luuNhap(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  code: string,
): Promise<KetQuaLuuNhap> {
  if (code.length > GIOI_HAN_KY_TU) {
    throw new ForbiddenError('draft-too-large');
  }

  await moKhoiCode(db, studentId, blockId);

  const hash = bamMa(code);
  const hienCo = await db.codeDraft.findUnique({
    where: { studentId_blockId: { studentId, blockId } },
    select: { contentHash: true, updatedAt: true },
  });

  // The idempotency guarantee. Compared by hash rather than by text so an
  // unchanged 60 KB file does not travel twice.
  if (hienCo && hienCo.contentHash === hash) {
    return { daGhi: false, phienBanMoi: null, luuLuc: hienCo.updatedAt };
  }

  const draft = await db.codeDraft.upsert({
    where: { studentId_blockId: { studentId, blockId } },
    create: { studentId, blockId, code, contentHash: hash },
    update: { code, contentHash: hash },
    select: { updatedAt: true },
  });

  const phienBanMoi = await themBanLuuNeuDenLuc(db, studentId, blockId, code, hash);

  return { daGhi: true, phienBanMoi, luuLuc: draft.updatedAt };
}

/** Load the working copy, falling back to the problem's starter code. */
export async function docNhap(
  db: PrismaClient,
  studentId: string,
  blockId: string,
): Promise<{ code: string; luuLuc: Date | null; laBanNhap: boolean }> {
  const khoi = await moKhoiCode(db, studentId, blockId);

  const draft = await db.codeDraft.findUnique({
    where: { studentId_blockId: { studentId, blockId } },
    select: { code: true, updatedAt: true },
  });

  if (!draft) return { code: khoi.starterCode, luuLuc: null, laBanNhap: false };
  return { code: draft.code, luuLuc: draft.updatedAt, laBanNhap: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════

export interface BanLuu {
  version: number;
  reason: SnapshotReason;
  createdAt: Date;
  soDong: number;
  soKyTu: number;
  contentHash: string;
}

/** Add a snapshot, but only when it would tell the student something new. */
async function themBanLuuNeuDenLuc(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  code: string,
  hash: string,
): Promise<number | null> {
  const ganNhat = await db.codeSnapshot.findFirst({
    where: { studentId, blockId },
    orderBy: { version: 'desc' },
    select: { version: true, createdAt: true, contentHash: true },
  });

  // Identical content is never worth a second entry, however long it has been.
  if (ganNhat?.contentHash === hash) return null;

  if (ganNhat && Date.now() - ganNhat.createdAt.getTime() < KHOANG_CACH_BAN_LUU_MS) {
    return null;
  }

  return themBanLuu(db, studentId, blockId, code, hash, 'AUTO');
}

/** Append a snapshot unconditionally, then prune. Returns the new version. */
async function themBanLuu(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  code: string,
  hash: string,
  reason: SnapshotReason,
): Promise<number> {
  const ganNhat = await db.codeSnapshot.findFirst({
    where: { studentId, blockId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (ganNhat?.version ?? 0) + 1;

  await db.codeSnapshot.create({
    data: { studentId, blockId, version, code, contentHash: hash, reason },
  });

  await donBanLuuCu(db, studentId, blockId);
  return version;
}

/**
 * Keep history bounded.
 *
 * Prunes the oldest AUTO entries only. A SUBMIT is what the student handed in
 * and a RESTORE is a decision they made; neither should quietly disappear
 * because they kept typing.
 */
async function donBanLuuCu(
  db: PrismaClient,
  studentId: string,
  blockId: string,
): Promise<number> {
  const tong = await db.codeSnapshot.count({ where: { studentId, blockId } });
  if (tong <= SO_BAN_LUU_TOI_DA) return 0;

  const thua = await db.codeSnapshot.findMany({
    where: { studentId, blockId, reason: 'AUTO' },
    orderBy: { version: 'asc' },
    take: tong - SO_BAN_LUU_TOI_DA,
    select: { id: true },
  });
  if (thua.length === 0) return 0;

  const { count } = await db.codeSnapshot.deleteMany({
    where: { id: { in: thua.map((s) => s.id) } },
  });
  return count;
}

/** History for one block, newest first. Code bodies are NOT loaded here. */
export async function lichSuMa(
  db: PrismaClient,
  studentId: string,
  blockId: string,
): Promise<BanLuu[]> {
  await moKhoiCode(db, studentId, blockId);

  const rows = await db.codeSnapshot.findMany({
    where: { studentId, blockId },
    orderBy: { version: 'desc' },
    select: { version: true, reason: true, createdAt: true, code: true, contentHash: true },
  });

  return rows.map((r) => ({
    version: r.version,
    reason: r.reason,
    createdAt: r.createdAt,
    soDong: r.code.split('\n').length,
    soKyTu: r.code.length,
    contentHash: r.contentHash,
  }));
}

/** One snapshot's full text, for the diff view. */
export async function xemBanLuu(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  version: number,
): Promise<{ version: number; code: string; reason: SnapshotReason; createdAt: Date } | null> {
  await moKhoiCode(db, studentId, blockId);

  const row = await db.codeSnapshot.findUnique({
    where: { studentId_blockId_version: { studentId, blockId, version } },
    select: { version: true, code: true, reason: true, createdAt: true },
  });
  return row;
}

/**
 * Roll the working copy back to an earlier snapshot.
 *
 * The current draft is snapshotted FIRST, so a restore is never destructive:
 * a student who rolls back and then wants their newer attempt again can still
 * reach it. Undo that loses work is not undo.
 */
export async function khoiPhucBanLuu(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  version: number,
): Promise<{ code: string; phienBanGiuLai: number | null }> {
  await moKhoiCode(db, studentId, blockId);

  const ban = await db.codeSnapshot.findUnique({
    where: { studentId_blockId_version: { studentId, blockId, version } },
    select: { code: true, contentHash: true },
  });
  if (!ban) throw new ForbiddenError('snapshot-not-found');

  const hienTai = await db.codeDraft.findUnique({
    where: { studentId_blockId: { studentId, blockId } },
    select: { code: true, contentHash: true },
  });

  let phienBanGiuLai: number | null = null;
  if (hienTai && hienTai.contentHash !== ban.contentHash) {
    phienBanGiuLai = await themBanLuu(
      db,
      studentId,
      blockId,
      hienTai.code,
      hienTai.contentHash,
      'RESTORE',
    );
  }

  await db.codeDraft.upsert({
    where: { studentId_blockId: { studentId, blockId } },
    create: { studentId, blockId, code: ban.code, contentHash: ban.contentHash },
    update: { code: ban.code, contentHash: ban.contentHash },
  });

  return { code: ban.code, phienBanGiuLai };
}

// ═══════════════════════════════════════════════════════════════════════════
// Submission
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaNopBai {
  submissionId: string;
  attemptNo: number;
  verdict: Verdict;
  queuedAt: Date;
}

/**
 * Hand in an attempt.
 *
 * Phase 7 stops at the queue. The row is written with everything the judge will
 * need — student, problem, lesson, exact code, attempt number, `queuedAt` — and
 * left at `PENDING`, which is the honest state: it has been accepted and not yet
 * judged. Phase 8 picks it up from there.
 *
 * A fake `ACCEPTED` would have been easier to demo and would have taught every
 * student that the verdict means nothing.
 */
export async function nopBai(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  code: string,
): Promise<KetQuaNopBai> {
  if (code.length > GIOI_HAN_KY_TU) throw new ForbiddenError('submission-too-large');

  const khoi = await moKhoiCode(db, studentId, blockId);
  if (!khoi.problemId) throw new ForbiddenError('block-has-no-problem');

  const hash = bamMa(code);

  // Save the exact text that was submitted, and record it in history so the
  // student can always get back to a version they were willing to hand in.
  await db.codeDraft.upsert({
    where: { studentId_blockId: { studentId, blockId } },
    create: { studentId, blockId, code, contentHash: hash },
    update: { code, contentHash: hash },
  });
  await themBanLuu(db, studentId, blockId, code, hash, 'SUBMIT');

  const daNop = await db.submission.count({
    where: { studentId, problemId: khoi.problemId },
  });

  const queuedAt = new Date();
  const submission = await db.submission.create({
    data: {
      studentId,
      problemId: khoi.problemId,
      lessonId: khoi.lessonId,
      code,
      verdict: 'PENDING',
      attemptNo: daNop + 1,
      queuedAt,
    },
    select: { id: true, attemptNo: true, verdict: true, queuedAt: true },
  });

  return {
    submissionId: submission.id,
    attemptNo: submission.attemptNo,
    verdict: submission.verdict,
    queuedAt: submission.queuedAt ?? queuedAt,
  };
}

/**
 * Hand in a Micro:bit block workspace.
 *
 * Separate from `nopBai` because what is being handed in is different in kind:
 * there is no source file to run, and no verdict a machine can reach. The blocks
 * go into `blocksXml`, the row is left at PENDING, and a teacher grades it.
 *
 * `code` is still populated — with the workspace — so every existing query that
 * reads a submission keeps working rather than special-casing hardware.
 */
export async function nopBaiMicrobit(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  blocksXml: string,
): Promise<KetQuaNopBai> {
  if (blocksXml.length > GIOI_HAN_KY_TU) throw new ForbiddenError('workspace-too-large');

  const khoi = await moKhoiCode(db, studentId, blockId);
  if (!khoi.problemId) throw new ForbiddenError('block-has-no-problem');

  const hash = bamMa(blocksXml);

  // The workspace is also kept as a draft and a snapshot, so a student who
  // resubmits can still reach what they handed in last time.
  await db.codeDraft.upsert({
    where: { studentId_blockId: { studentId, blockId } },
    create: { studentId, blockId, code: blocksXml, contentHash: hash },
    update: { code: blocksXml, contentHash: hash },
  });
  await themBanLuu(db, studentId, blockId, blocksXml, hash, 'SUBMIT');

  const daNop = await db.submission.count({
    where: { studentId, problemId: khoi.problemId },
  });

  const queuedAt = new Date();
  const submission = await db.submission.create({
    data: {
      studentId,
      problemId: khoi.problemId,
      lessonId: khoi.lessonId,
      code: blocksXml,
      blocksXml,
      verdict: 'PENDING',
      attemptNo: daNop + 1,
      queuedAt,
    },
    select: { id: true, attemptNo: true, verdict: true, queuedAt: true },
  });

  return {
    submissionId: submission.id,
    attemptNo: submission.attemptNo,
    verdict: submission.verdict,
    queuedAt: submission.queuedAt ?? queuedAt,
  };
}

export interface BaiDaNop {
  id: string;
  attemptNo: number;
  verdict: Verdict;
  score: number;
  passedTests: number;
  totalTests: number;
  createdAt: Date;
  /** True while the judge has not reached it yet. */
  dangCho: boolean;
}

/** A student's attempts on one problem, newest first. */
export async function lichSuNopBai(
  db: PrismaClient,
  studentId: string,
  problemId: string,
  gioiHan = 10,
): Promise<BaiDaNop[]> {
  const rows = await db.submission.findMany({
    where: { studentId, problemId },
    orderBy: { createdAt: 'desc' },
    take: gioiHan,
    select: {
      id: true,
      attemptNo: true,
      verdict: true,
      score: true,
      passedTests: true,
      totalTests: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    dangCho: r.verdict === 'PENDING' || r.verdict === 'RUNNING',
  }));
}
