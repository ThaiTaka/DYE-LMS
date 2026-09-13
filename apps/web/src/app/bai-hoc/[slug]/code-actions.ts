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
  ghiNhanDatBai,
  khoiPhucBanLuu,
  lichSuMa,
  lichSuNopBai,
  luuNhap,
  moKhoiCode,
  nopBai,
  nopBaiMicrobit,
  xemBanLuu,
  ForbiddenError,
  UnauthorizedError,
  type BaiDaNop,
  type BanLuu,
} from '@dye/core';

import { revalidatePath } from 'next/cache';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { chayThuTrongSandbox, xepHangChamBai } from '@/lib/judge-queue';

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
export interface KetQuaChayThuUI {
  ok: boolean;
  stdout: string;
  stderr: string;
  thoiGianMs: number;
  /** Human sentence when the run did not simply finish. */
  ghiChu: string;
  /** What the program read on stdin, so the student can see what it was answering. */
  dauVao: string;
}

/**
 * The input a run gets when the caller has none to offer.
 *
 * Sample tests first, then any other visible test. Hidden tests are never read
 * here: their input is what a submission is graded on, and a run button that
 * quietly echoed it would hand the answer key to anyone who pressed it.
 */
async function dauVaoMau(problemId: string | null): Promise<string> {
  if (!problemId) return '';

  const mau = await db.testCase.findFirst({
    where: { problemId, isHidden: false },
    orderBy: [{ isSample: 'desc' }, { order: 'asc' }],
    select: { input: true },
  });

  return mau?.input ?? '';
}

/**
 * Run what is in the editor and hand back its output. Nothing is graded or kept.
 *
 * ── Authorized on the block, exactly like submitting ─────────────────────────
 * `moKhoiCode` is the same gate `nop` uses. Without it this action would be a
 * general-purpose "execute Python on the server" endpoint for anyone with a
 * session, reachable by anybody who can read a block id out of the page source.
 * Running code is cheaper than submitting it, which makes it MORE attractive to
 * abuse, not less.
 *
 * ── Why a non-zero exit is `ok: true` ────────────────────────────────────────
 * A traceback is the normal, useful result of pressing this button while
 * learning. `ok` means "the sandbox ran your program and here is what happened";
 * it is false only when we could not run it at all.
 */
export async function chayThu(
  blockId: string,
  code: string,
  stdin?: string,
): Promise<KetQuaChayThuUI> {
  try {
    const actor = await hocSinhHienTai();
    const khoi = await moKhoiCode(db, actor.id, blockId);

    /*
     * Feed the sample input when the caller sends none.
     *
     * The editor has no stdin box, so "Chạy thử" always arrived here with an
     * empty string — and a program that calls `input()` then died on its first
     * line with EOFError, which to a ten-year-old reads as "my code is broken".
     * The problem's first sample test carries exactly the input the student is
     * being taught to handle, so that is what the run reads.
     *
     * `undefined` means "no opinion", and gets the sample. An explicit `''`
     * from a caller that wants an empty stdin is honoured as written.
     */
    const dauVao = stdin ?? (await dauVaoMau(khoi.problemId));

    const kq = await chayThuTrongSandbox(code, dauVao);
    if (!kq.ok) {
      return { ok: false, stdout: '', stderr: '', thoiGianMs: 0, ghiChu: kq.loi, dauVao };
    }

    const r = kq.ketQua;
    const ghiChu =
      r.ketThuc === 'het-gio'
        ? 'Chương trình chạy quá lâu nên đã bị dừng. Em xem lại vòng lặp có thoát được chưa nhé.'
        : r.ketThuc === 'het-bo-nho'
          ? 'Chương trình dùng hết bộ nhớ cho phép nên đã bị dừng.'
          : r.ketThuc === 'qua-nhieu-dau-ra'
            ? 'Chương trình in ra quá nhiều nên phần sau đã bị cắt bớt.'
            : r.ketThuc === 'khong-chay-duoc'
              ? 'Không chạy được đoạn này trong sandbox.'
              : r.daCatBot
                ? 'Kết quả dài quá nên đã cắt bớt phần cuối.'
                : '';

    return {
      ok: true,
      stdout: r.stdout,
      stderr: r.stderr,
      thoiGianMs: r.thoiGianMs,
      ghiChu,
      dauVao,
    };
  } catch (error) {
    const { thongDiep } = loiThanhThongDiep(error);
    return { ok: false, stdout: '', stderr: '', thoiGianMs: 0, ghiChu: thongDiep, dauVao: '' };
  }
}

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

/**
 * Hand in a Micro:bit block workspace.
 *
 * Deliberately does NOT enqueue for judging. A Micro:bit program's behaviour is
 * light on a physical LED matrix; nothing in a container can observe it. Putting
 * it on the queue would have the worker pick it up only to SKIP it, and the
 * student would watch a spinner for a verdict that was never coming.
 *
 * The wording says a teacher will look at it, because a teacher will.
 */
export async function nopMicrobit(blockId: string, blocksXml: string): Promise<KetQuaNop> {
  try {
    const actor = await hocSinhHienTai();

    if (!blocksXml.trim()) {
      return {
        trangThai: 'tu-choi',
        submissionId: null,
        attemptNo: null,
        thongDiep: 'Vùng làm việc đang trống. Em kéo vài khối lệnh vào rồi nộp nhé.',
      };
    }

    const kq = await nopBaiMicrobit(db, actor.id, blockId, blocksXml);

    return {
      trangThai: 'da-nhan',
      submissionId: kq.submissionId,
      attemptNo: kq.attemptNo,
      thongDiep:
        `Đã nhận bài lần ${kq.attemptNo} của em. Thầy cô sẽ xem các khối lệnh và nhận xét — ` +
        'bài Micro:bit không chấm tự động được, vì chương trình chạy trên board thật.',
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

/**
 * Re-read every page that shows progress, once a verdict has landed.
 *
 * Everything that says "done" — the ✓ on the block header, the "Phần bắt buộc"
 * bar, the next-lesson unlock on the course map, the course cards on the
 * dashboard — is a server component reading BlockProgress / LessonProgress.
 * The judge writes those rows from ANOTHER PROCESS, so nothing on the web
 * server ever learns that a rendered tree has gone stale, and the App Router
 * keeps handing out what it has. A `router.refresh()` from the browser was not
 * enough on its own: it is a separate GET after the fact, and it only touches
 * the route the tab is on.
 *
 * `revalidatePath` from inside a server action is the one signal that reaches
 * every cache at once. The server re-renders the current page in THIS response
 * — the same round trip that carried the verdict — and the client's Router
 * Cache is purged, so the course map and the dashboard are fetched fresh on
 * the next navigation, including Back.
 *
 * Route patterns rather than concrete slugs, as everywhere else in this app:
 * the action holds a block id, not the lesson's URL, and the pattern form
 * covers every lesson at once. The course map is revalidated as a layout so
 * anything rendered beneath it is included.
 */
function lamMoiTrangTienDo(): void {
  revalidatePath('/bai-hoc/[slug]', 'page');
  revalidatePath('/khoa-hoc/[slug]', 'layout');
  revalidatePath('/bang-dieu-khien');
}

/**
 * A student's attempts on this block — and, when the caller says which ones it
 * is still waiting on, the moment the judge finishes with them.
 *
 * ── `dangDoi`: the ids the client last saw as pending ─────────────────────────
 * The workspace polls this while a submission is being judged. A server action
 * has no memory between calls, so the client says what it is waiting for; any
 * of those ids that now carries a final verdict has JUST been graded, and that
 * is the one moment the pages showing progress have to be re-read. Opening the
 * history panel passes nothing and is a plain read.
 *
 * ── Why progress is written here as well as in the worker ────────────────────
 * The worker stores the verdict first and BlockProgress / LessonProgress
 * afterwards, in separate statements. A poll that lands between the two sees a
 * final verdict and re-renders a page whose progress rows are still the old
 * ones — and because nothing is pending any more, it never polls again. The
 * student is left on 0% with "Đúng rồi 🎉" in the list underneath.
 *
 * `ghiNhanDatBai` is idempotent — upserts, then a recomputation — and it is the
 * same call the worker and a teacher grading by hand both make. Running it here
 * for an ACCEPTED verdict closes the race from the other side: whichever
 * process gets there second finds the rows already correct. It also means a
 * worker whose progress write failed AFTER the verdict was stored (a stale
 * Prisma client, a dropped connection) no longer leaves the lesson stuck. The
 * verdict is read from the database, never taken from the client, so this
 * cannot be used to claim progress that was not earned.
 */
export async function layLichSuNop(
  blockId: string,
  dangDoi: readonly string[] = [],
): Promise<{ trangThai: 'ok' | 'tu-choi'; baiNop: BaiDaNopHienThi[] }> {
  try {
    const actor = await hocSinhHienTai();
    const khoi = await moKhoiCode(db, actor.id, blockId);
    if (!khoi.problemId) return { trangThai: 'ok', baiNop: [] };

    const ls = await lichSuNopBai(db, actor.id, khoi.problemId);

    // Arrived over the wire; shape it before trusting it.
    const choDoi = new Set(
      Array.isArray(dangDoi) ? dangDoi.filter((x): x is string => typeof x === 'string') : [],
    );
    const vuaCham = ls.filter((s) => !s.dangCho && choDoi.has(s.id));

    if (vuaCham.length > 0) {
      if (vuaCham.some((s) => s.verdict === 'ACCEPTED')) {
        await ghiNhanDatBai(db, actor.id, khoi.problemId);
      }
      lamMoiTrangTienDo();
    }

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
