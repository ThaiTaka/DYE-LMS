import {
  authorize,
  biKhoaTroLy,
  ForbiddenError,
  GIOI_HAN_TIN_NHAN,
  guiTinNhanLop,
  khoaTroLyViPham,
} from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { KHOANG_CHO_THAO_LUAN_MS, thongDiepChoLai, thuChiemLuot } from '@/lib/gioi-han-toc-do';
import { kiemDuyetTinNhan } from '@/lib/kiem-duyet-tin-nhan';
import {
  docThaoLuan,
  thanhGuiDi,
  type KetQuaDocThaoLuan,
  type KetQuaGuiThaoLuan,
} from '@/lib/thao-luan-data';

/**
 * The class chat.
 *
 * ── GET — the feed ───────────────────────────────────────────────────────────
 * `?lop=<classId>` for the recent conversation; add `&sau=<ISO>` to poll for
 * what arrived since. Readable by the class's students, its teacher and an
 * admin — `tinNhanCuaLop` authorizes through `class: read`.
 *
 * Polled rather than pushed. The app is one Node process behind a Cloudflare
 * tunnel, which buffers long-lived responses; a GET every few seconds from an
 * open tab is predictable load and survives every proxy between a school and
 * the server. The client pauses while its tab is hidden.
 *
 * ── POST — a message, moderation first ───────────────────────────────────────
 * The same line as the tutor (`api/tro-ly`), and each step can end it:
 *
 *   1. Same origin, signed in, a readable body with a message in it.
 *   2. Students only, and only in a class they are actively enrolled in.
 *   3. LOCKED? — a student under the moderation lock reads but cannot send.
 *   4. Cooldown.
 *   5. `kiemDuyetTinNhan` — the tutor's own filter, not a copy of it.
 *   6. Only now, the insert.
 *
 * A violation at 5 is NEVER saved. The student is locked (`isAiLocked`) and an
 * `AiViolationAlert` is filed for their teacher in one transaction
 * (`khoaTroLyViPham`, channel CLASS_CHAT), and the response is a 403 the page
 * turns into a warning. If that write fails the message is still refused: the
 * refusal must not depend on the database accepting the punishment.
 *
 * A classifier that cannot decide refuses the message and punishes no one —
 * an unmoderated message is not safe to deliver to thirty children.
 *
 * ── Same origin ──────────────────────────────────────────────────────────────
 * Checked by hand on POST, against `x-forwarded-host` first — the same check,
 * the same way, as the tutor and the .hex upload.
 */

/**
 * How far before the client's newest message a poll starts.
 *
 * Two inserts can commit out of timestamp order; a poll that asked for
 * "strictly newer than my last" would skip the one that committed second. The
 * overlap re-sends a few seconds of messages and the client drops ids it has.
 */
const CHONG_LAN_MS = 10_000;

function cungNguon(req: Request): boolean {
  const origin = req.headers.get('origin');
  // No Origin header: not a cross-site browser request (fetch always sends one
  // for POST). The session cookie is still required below.
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function json<T>(body: T, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function gui(
  trangThai: KetQuaGuiThaoLuan['trangThai'],
  thongDiep: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return json<KetQuaGuiThaoLuan>({ trangThai, thongDiep }, status, headers);
}

const THONG_DIEP_BI_KHOA =
  'Em tạm thời không gửi được tin nhắn vì đã vi phạm quy định trò chuyện. ' +
  'Vui lòng liên hệ giáo viên để mở lại.';

const THONG_DIEP_VI_PHAM =
  'Tin nhắn KHÔNG được gửi vì có lời lẽ không phù hợp với lớp học. ' +
  'Quyền gửi tin nhắn và trợ lý AI của em đã bị khoá, và thầy cô đã được thông báo.';

// ═══════════════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: Request): Promise<Response> {
  const actor = await currentActor();
  if (!actor) return json({ error: 'Phiên đăng nhập đã hết hạn.' }, 401);

  const url = new URL(req.url);
  const classId = url.searchParams.get('lop') ?? '';
  if (!classId) return json({ error: 'Thiếu lớp.' }, 400);

  const sau = url.searchParams.get('sau');
  const moc = sau ? Date.parse(sau) : Number.NaN;
  const tu = Number.isFinite(moc) ? new Date(moc - CHONG_LAN_MS) : undefined;

  try {
    return json<KetQuaDocThaoLuan>(await docThaoLuan(actor, classId, tu), 200);
  } catch (error) {
    // Unknown class and "not your class" look the same from outside.
    if (error instanceof ForbiddenError) return json({ error: error.message }, 403);
    console.error('[thao-luan] doc that bai', error);
    return json({ error: 'Không tải được tin nhắn.' }, 503);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: Request): Promise<Response> {
  // ── 1. Who, from where, saying what ──────────────────────────────────────
  if (!cungNguon(req)) return gui('tu-choi', 'Yêu cầu không hợp lệ.', 403);

  const actor = await currentActor();
  if (!actor) return gui('tu-choi', 'Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.', 401);

  let than: unknown;
  try {
    than = await req.json();
  } catch {
    return gui('tu-choi', 'Không đọc được tin nhắn. Em thử gửi lại nhé.', 400);
  }
  const raw = typeof than === 'object' && than !== null ? (than as Record<string, unknown>) : {};
  const classId = typeof raw['lop'] === 'string' ? raw['lop'] : '';
  const noiDung = typeof raw['noiDung'] === 'string' ? raw['noiDung'].trim() : '';

  if (!classId) return gui('tu-choi', 'Không rõ tin nhắn gửi vào lớp nào.', 400);
  if (!noiDung) return gui('tu-choi', 'Em gõ gì đó rồi hãy gửi nhé.', 400);
  // Refused, never truncated: cutting a message could change what it says —
  // or cut a word the filter needed to see whole. Also refused before it is
  // moderated, so a pasted essay never becomes a classifier call.
  if (noiDung.length > GIOI_HAN_TIN_NHAN) {
    return gui('tu-choi', `Tin nhắn dài quá — tối đa ${GIOI_HAN_TIN_NHAN} ký tự.`, 400);
  }

  // ── 2. Students, in their own class ──────────────────────────────────────
  if (actor.role !== 'STUDENT') {
    return gui(
      'tu-choi',
      'Thầy cô xem thảo luận ở trang lớp; chỉ học sinh gửi tin nhắn tại đây.',
      403,
    );
  }
  try {
    await authorize(db, actor, { resource: 'class', action: 'read', classId });
  } catch (error) {
    if (error instanceof ForbiddenError) return gui('tu-choi', error.message, 403);
    throw error;
  }

  // ── 3. The lock ──────────────────────────────────────────────────────────
  let biKhoa: boolean;
  try {
    biKhoa = await biKhoaTroLy(db, actor.id);
  } catch (error) {
    // Cannot tell whether they are locked, so the message does not go out.
    console.error('[thao-luan] khong doc duoc trang thai khoa', error);
    return gui('loi', 'Chưa gửi được lúc này. Em thử lại sau một chút nhé.', 503);
  }
  if (biKhoa) return gui('bi-khoa', THONG_DIEP_BI_KHOA, 403);

  // ── 4. Cooldown ──────────────────────────────────────────────────────────
  const cho = thuChiemLuot('thao-luan', actor.id, KHOANG_CHO_THAO_LUAN_MS);
  if (!cho.duocPhep) {
    return gui('tu-choi', thongDiepChoLai(cho.conLaiMs), 429, {
      'Retry-After': String(Math.ceil(cho.conLaiMs / 1000)),
    });
  }

  // ── 5. Moderation — the tutor's filter ───────────────────────────────────
  const kiemDuyet = await kiemDuyetTinNhan(noiDung);

  if (kiemDuyet.trangThai === 'vi-pham') {
    // a) Not saved: nothing below this line runs. b) + c) lock and alert, in
    // one transaction that re-reads the role itself.
    try {
      await khoaTroLyViPham(db, actor.id, {
        noiDung,
        loai: kiemDuyet.loai,
        nguon: kiemDuyet.nguon,
        kenh: 'CLASS_CHAT',
      });
    } catch (error) {
      console.error('[thao-luan] khong ghi duoc khoa vi pham', error);
    }
    // d) The page shows the warning and closes the composer.
    return gui('vi-pham', THONG_DIEP_VI_PHAM, 403);
  }

  if (kiemDuyet.trangThai === 'chua-ro') {
    return gui(
      'loi',
      'Chưa kiểm tra được tin nhắn này nên chưa gửi. Em thử lại sau một chút nhé.',
      503,
    );
  }

  // ── 6. The insert ────────────────────────────────────────────────────────
  try {
    const kq = await guiTinNhanLop(db, actor, classId, noiDung);
    switch (kq.trangThai) {
      case 'da-gui':
        return json<KetQuaGuiThaoLuan>(
          { trangThai: 'da-gui', thongDiep: '', tinNhan: thanhGuiDi(kq.tinNhan) },
          201,
        );
      case 'bi-khoa':
        // Locked between step 3 and the insert — by a message in another tab.
        return gui('bi-khoa', THONG_DIEP_BI_KHOA, 403);
      case 'lop-luu-tru':
        return gui('tu-choi', 'Lớp này đã kết thúc nên không gửi thêm tin nhắn được nữa.', 403);
      case 'rong':
        return gui('tu-choi', 'Em gõ gì đó rồi hãy gửi nhé.', 400);
      case 'qua-dai':
        return gui('tu-choi', `Tin nhắn dài quá — tối đa ${kq.toiDa} ký tự.`, 400);
    }
  } catch (error) {
    if (error instanceof ForbiddenError) return gui('tu-choi', error.message, 403);
    console.error('[thao-luan] gui that bai', error);
    return gui('loi', 'Chưa gửi được lúc này. Em thử lại sau một chút nhé.', 503);
  }
}
