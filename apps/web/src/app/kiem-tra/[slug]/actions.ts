'use server';

import {
  batDauLamBai,
  ForbiddenError,
  ghiNhanViPham,
  luuTraLoi,
  nopBaiThi,
  UnauthorizedError,
  type KetQuaViPham,
  type LuotThiTomTat,
} from '@dye/core';

import { revalidatePath } from 'next/cache';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';

import type { ExamStrikeKind } from '@prisma/client';
import type { Actor } from '@dye/core';

/**
 * The exam room's server actions.
 *
 * ── Every one of these resolves the student from the SESSION ────────────────
 * No action takes a student id. The attempt id comes from the browser, and the
 * core layer refuses it unless it belongs to the session's student
 * (`luotDangMo` in kiem-tra.ts), so the worst a tampered client can do is act
 * on its own attempt — which it could do anyway by using the page.
 *
 * ── `baoViPham` carries no count ─────────────────────────────────────────────
 * The browser reports WHAT happened (a departure of some kind), never HOW MANY
 * times. The server counts, dedupes and decides. There is no parameter through
 * which a client could set its own strike total, in either direction.
 *
 * ── Answers, not thrown errors ───────────────────────────────────────────────
 * Every action returns a result object. These are called from an exam room a
 * child is sitting in; an unhandled rejection there is a crashed page over a
 * network blip, in the one place a crash costs the most.
 */

async function hocSinhHienTai(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new UnauthorizedError('no-session');
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-sit-exams');
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  return actor;
}

const LOAI_HOP_LE: readonly ExamStrikeKind[] = ['FULLSCREEN_EXIT', 'TAB_HIDDEN', 'WINDOW_BLUR'];

export interface KetQuaBatDauUI {
  trangThai: 'ok' | 'tu-choi' | 'loi';
  attemptId: string | null;
  deadlineAt: string | null;
  maxStrikes: number;
  thongDiep: string;
}

/**
 * Open (or re-enter) the sitting.
 *
 * Called from the "Bắt đầu" button AFTER fullscreen has been granted — the
 * order matters, because a sitting that started before fullscreen would have
 * its first seconds outside the rules it is measured against.
 */
export async function batDauThi(examId: string): Promise<KetQuaBatDauUI> {
  try {
    const actor = await hocSinhHienTai();
    const kq = await batDauLamBai(db, actor.id, String(examId ?? ''));
    return {
      trangThai: 'ok',
      attemptId: kq.attemptId,
      deadlineAt: kq.deadlineAt.toISOString(),
      maxStrikes: kq.maxStrikes,
      thongDiep: '',
    };
  } catch (error) {
    return { attemptId: null, deadlineAt: null, maxStrikes: 2, ...loiThanhLoi(error) };
  }
}

/** One answer. Fire-and-forget from the client; the reply says only whether it stuck. */
export async function luuCauTraLoiThi(
  attemptId: string,
  questionId: string,
  response: unknown,
): Promise<{ daLuu: boolean }> {
  try {
    const actor = await hocSinhHienTai();
    return await luuTraLoi(db, actor.id, String(attemptId ?? ''), String(questionId ?? ''), response);
  } catch (error) {
    // A lost autosave is not worth interrupting the exam for; the next change
    // resends the whole answer. Logged so a pattern of them is visible.
    if (!(error instanceof ForbiddenError) && !(error instanceof UnauthorizedError)) {
      console.error('[kiem-tra] không lưu được câu trả lời', error);
    }
    return { daLuu: false };
  }
}

export interface KetQuaViPhamUI extends KetQuaViPham {
  ok: boolean;
}

/**
 * Report one departure.
 *
 * Returns the server's count and whether the attempt is now locked. The
 * client renders from THIS answer — the warning at strike one, the locked
 * screen at the limit — never from a number it kept itself.
 */
export async function baoViPham(attemptId: string, loai: string): Promise<KetQuaViPhamUI> {
  const trong: KetQuaViPhamUI = {
    ok: false,
    cheatStrikes: 0,
    maxStrikes: 2,
    biKhoa: false,
    trungLap: false,
  };
  try {
    const actor = await hocSinhHienTai();
    const kind = LOAI_HOP_LE.find((k) => k === loai);
    if (!kind) return trong;

    const kq = await ghiNhanViPham(db, actor.id, String(attemptId ?? ''), kind);
    if (kq.biKhoa) revalidatePath('/kiem-tra/[slug]', 'page');
    return { ok: true, ...kq };
  } catch (error) {
    if (!(error instanceof ForbiddenError) && !(error instanceof UnauthorizedError)) {
      console.error('[kiem-tra] không ghi được vi phạm', error);
    }
    return trong;
  }
}

export interface KetQuaNopUI {
  trangThai: 'ok' | 'tu-choi' | 'loi';
  luot: (Omit<LuotThiTomTat, 'startedAt' | 'deadlineAt' | 'submittedAt'> & {
    submittedAt: string | null;
  }) | null;
  thongDiep: string;
}

/** Hand in — by the button, or by the clock. */
export async function nopBai(attemptId: string): Promise<KetQuaNopUI> {
  try {
    const actor = await hocSinhHienTai();
    const kq = await nopBaiThi(db, actor.id, String(attemptId ?? ''));
    revalidatePath('/kiem-tra/[slug]', 'page');
    revalidatePath('/khoa-hoc/[slug]', 'page');
    const { startedAt: _s, deadlineAt: _d, ...rest } = kq;
    return {
      trangThai: 'ok',
      luot: { ...rest, submittedAt: kq.submittedAt?.toISOString() ?? null },
      thongDiep: '',
    };
  } catch (error) {
    return { luot: null, ...loiThanhLoi(error) };
  }
}

function loiThanhLoi(error: unknown): { trangThai: 'tu-choi' | 'loi'; thongDiep: string } {
  if (error instanceof ForbiddenError) {
    return { trangThai: 'tu-choi', thongDiep: thongDiepTuChoi(error.message) };
  }
  if (error instanceof UnauthorizedError) {
    return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.' };
  }
  console.error('[kiem-tra] thất bại', error);
  return { trangThai: 'loi', thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé.' };
}

/** The core's refusal codes, in the student's words. */
function thongDiepTuChoi(ma: string): string {
  switch (ma) {
    case 'exam-locked-by-lessons':
      return 'Em cần hoàn thành các bài học phía trước rồi mới vào thi được.';
    case 'exam-already-submitted':
      return 'Em đã nộp bài thi này rồi.';
    case 'exam-already-locked_cheating':
      return 'Bài thi này đã bị khoá. Em nói với thầy cô để được xem xét nhé.';
    case 'exam-not-found':
      return 'Không tìm thấy bài thi này.';
    default:
      return 'Không thực hiện được. Em thử lại hoặc hỏi thầy cô nhé.';
  }
}
