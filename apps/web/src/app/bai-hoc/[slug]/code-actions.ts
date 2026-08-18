'use server';

/**
 * Code editor actions: autosave, history, rollback, submit.
 *
 * Every one re-resolves lesson access inside `@dye/core`, so a request that
 * bypasses the UI is refused exactly as a hidden button would have been. The
 * editor being on screen is not the permission.
 *
 * These return result objects rather than throwing, because they are called from
 * a client component during ordinary typing. A thrown error in an autosave loop
 * would replace the lesson with a crash page while the student was mid-sentence.
 * The reason is preserved in `thongDiep` so the editor can say what happened.
 */
import {
  docNhap,
  khoiPhucBanLuu,
  lichSuMa,
  lichSuNopBai,
  luuNhap,
  moKhoiCode,
  nopBai,
  xemBanLuu,
  ForbiddenError,
  UnauthorizedError,
  type BaiDaNop,
  type BanLuu,
} from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { xepHangChamBai } from '@/lib/judge-queue';

import type { Actor } from '@dye/core';

export interface KetQuaLuu {
  trangThai: 'da-luu' | 'khong-doi' | 'tu-choi' | 'loi';
  luuLuc: string | null;
  thongDiep: string;
}

/** Resolve the signed-in student, or refuse. Staff do not have drafts. */
async function hocSinhHienTai(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new UnauthorizedError('no-session');
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-write-code');
  return actor;
}

/** Turn an expected refusal into a message; let real faults stay loud. */
function loiThanhThongDiep(error: unknown): { trangThai: 'tu-choi' | 'loi'; thongDiep: string } {
  if (error instanceof ForbiddenError) {
    return { trangThai: 'tu-choi', thongDiep: error.message };
  }
  if (error instanceof UnauthorizedError) {
    return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.' };
  }
  console.error('[code-actions] thất bại', error);
  return { trangThai: 'loi', thongDiep: 'Chưa lưu được. Hệ thống sẽ tự thử lại.' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Autosave
// ═══════════════════════════════════════════════════════════════════════════

export async function tuDongLuu(blockId: string, code: string): Promise<KetQuaLuu> {
  try {
    const actor = await hocSinhHienTai();
    const kq = await luuNhap(db, actor.id, blockId, code);

    return {
      trangThai: kq.daGhi ? 'da-luu' : 'khong-doi',
      luuLuc: kq.luuLuc.toISOString(),
      thongDiep: '',
    };
  } catch (error) {
    return { ...loiThanhThongDiep(error), luuLuc: null };
  }
}

export interface KetQuaDocNhap {
  trangThai: 'ok' | 'tu-choi';
  code: string;
  luuLuc: string | null;
  laBanNhap: boolean;
  thongDiep: string;
}

/** Load the working copy when the editor mounts. */
export async function layBanNhap(blockId: string): Promise<KetQuaDocNhap> {
  try {
    const actor = await hocSinhHienTai();
    const kq = await docNhap(db, actor.id, blockId);
    return {
      trangThai: 'ok',
      code: kq.code,
      luuLuc: kq.luuLuc?.toISOString() ?? null,
      laBanNhap: kq.laBanNhap,
      thongDiep: '',
    };
  } catch (error) {
    const { thongDiep } = loiThanhThongDiep(error);
    return { trangThai: 'tu-choi', code: '', luuLuc: null, laBanNhap: false, thongDiep };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════

export interface BanLuuHienThi {
  version: number;
  reason: BanLuu['reason'];
  luuLuc: string;
  soDong: number;
  soKyTu: number;
}

export async function layLichSu(
  blockId: string,
): Promise<{ trangThai: 'ok' | 'tu-choi'; banLuu: BanLuuHienThi[] }> {
  try {
    const actor = await hocSinhHienTai();
    const ls = await lichSuMa(db, actor.id, blockId);
    return {
      trangThai: 'ok',
      banLuu: ls.map((b) => ({
        version: b.version,
        reason: b.reason,
        luuLuc: b.createdAt.toISOString(),
        soDong: b.soDong,
        soKyTu: b.soKyTu,
      })),
    };
  } catch {
    return { trangThai: 'tu-choi', banLuu: [] };
  }
}

/** Full text of one snapshot, for the diff view. */
export async function layNoiDungBanLuu(
  blockId: string,
  version: number,
): Promise<{ trangThai: 'ok' | 'khong-thay'; code: string }> {
  try {
    const actor = await hocSinhHienTai();
    const ban = await xemBanLuu(db, actor.id, blockId, version);
    if (!ban) return { trangThai: 'khong-thay', code: '' };
    return { trangThai: 'ok', code: ban.code };
  } catch {
    return { trangThai: 'khong-thay', code: '' };
  }
}

export interface KetQuaKhoiPhuc {
  trangThai: 'ok' | 'tu-choi';
  code: string;
  thongDiep: string;
}

export async function khoiPhuc(blockId: string, version: number): Promise<KetQuaKhoiPhuc> {
  try {
    const actor = await hocSinhHienTai();
    const kq = await khoiPhucBanLuu(db, actor.id, blockId, version);

    return {
      trangThai: 'ok',
      code: kq.code,
      thongDiep:
        kq.phienBanGiuLai === null
          ? `Đã quay lại bản ${version}.`
          : `Đã quay lại bản ${version}. Bản em đang viết được giữ lại thành bản ${kq.phienBanGiuLai}.`,
    };
  } catch (error) {
    const { thongDiep } = loiThanhThongDiep(error);
    return { trangThai: 'tu-choi', code: '', thongDiep };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Submission
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaNop {
  trangThai: 'da-nhan' | 'tu-choi' | 'loi';
  submissionId: string | null;
  attemptNo: number | null;
  thongDiep: string;
}

/**
 * Hand in an attempt.
 *
 * Phase 7 stops at the queue, and the copy says so plainly. Telling a student
 * their code "passed" when nothing ran would be a lie they cannot detect, and it
 * would teach them the verdict means nothing.
 */
export async function nop(blockId: string, code: string): Promise<KetQuaNop> {
  try {
    const actor = await hocSinhHienTai();
    const kq = await nopBai(db, actor.id, blockId, code);

    // The row is already safe. Enqueueing only makes judging prompt, so a queue
    // outage must not turn into an error the student sees — the worker's sweep
    // picks up anything that never made it onto Redis.
    await xepHangChamBai(kq.submissionId);

    return {
      trangThai: 'da-nhan',
      submissionId: kq.submissionId,
      attemptNo: kq.attemptNo,
      thongDiep: `Đã nhận bài làm lần ${kq.attemptNo} của em. Bài đang chờ được chấm.`,
    };
  } catch (error) {
    const { trangThai, thongDiep } = loiThanhThongDiep(error);
    return { trangThai, submissionId: null, attemptNo: null, thongDiep };
  }
}

export interface BaiDaNopHienThi {
  id: string;
  attemptNo: number;
  verdict: BaiDaNop['verdict'];
  score: number;
  passedTests: number;
  totalTests: number;
  nopLuc: string;
  dangCho: boolean;
}

export async function layLichSuNop(
  blockId: string,
): Promise<{ trangThai: 'ok' | 'tu-choi'; baiNop: BaiDaNopHienThi[] }> {
  try {
    const actor = await hocSinhHienTai();
    const khoi = await moKhoiCode(db, actor.id, blockId);
    if (!khoi.problemId) return { trangThai: 'ok', baiNop: [] };

    const ls = await lichSuNopBai(db, actor.id, khoi.problemId);
    return {
      trangThai: 'ok',
      baiNop: ls.map((s) => ({
        id: s.id,
        attemptNo: s.attemptNo,
        verdict: s.verdict,
        score: s.score,
        passedTests: s.passedTests,
        totalTests: s.totalTests,
        nopLuc: s.createdAt.toISOString(),
        dangCho: s.dangCho,
      })),
    };
  } catch {
    return { trangThai: 'tu-choi', baiNop: [] };
  }
}
