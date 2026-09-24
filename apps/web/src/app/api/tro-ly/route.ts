import { biKhoaTroLy, khoaTroLyViPham, type NguonPhatHien } from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { KHOANG_CHO_TRO_LY_MS, thongDiepChoLai, thuChiemLuot } from '@/lib/gioi-han-toc-do';
import { type LoaiViPham } from '@/lib/kiem-duyet';
import { kiemDuyetTinNhan } from '@/lib/kiem-duyet-tin-nhan';
import { coMoHinh, hoiGiaSu } from '@/lib/tro-ly-claude';

import type { Actor } from '@dye/core';

/**
 * Bí's tutoring endpoint.
 *
 * ── What it is for ───────────────────────────────────────────────────────────
 * A student stuck at 9pm has nobody to ask. This is the thing they can ask —
 * and the whole design problem is that it must NOT be the thing that finishes
 * their homework. A tutor that hands over working code teaches a child that
 * being stuck is something you route around rather than something you get
 * better at, and it makes every submission after it meaningless to the teacher
 * reading it. The refusal to answer is the feature; `LOI_NHAC_HE_THONG` in
 * `lib/tro-ly-claude.ts` is where it is written down.
 *
 * ── Guardrail first ──────────────────────────────────────────────────────────
 * Every request walks the same line, and each step can end it:
 *
 *   1. Same origin, signed in, a readable body with a question in it.
 *   2. LOCKED? — one indexed read. A locked student is refused before a single
 *      token is spent, with the sentence the brief specifies.
 *   3. Cooldown — each question is a paid model call.
 *   4. The word list (`lib/kiem-duyet.ts`). Free, instant, and it still works
 *      when the model is down or not configured.
 *   5. The model classifier. Only the question is sent, and it can only answer
 *      with a label.
 *   6. Only now, the tutor.
 *
 * A violation at 4 or 5 is never answered. For a student it locks the tutor
 * and files an `AiViolationAlert` for their teacher, in one transaction; for
 * staff it is refused without a lock — there would be nobody above them to
 * lift it.
 *
 * When the classifier cannot give an answer (network, refusal, bad output) the
 * question is NOT answered and NOT punished: an unmoderated reply is not safe
 * to send to a child, and a lock needs a positive, not a shrug.
 *
 * ── Same-origin only ─────────────────────────────────────────────────────────
 * Server actions check `Origin` against `Host` for free; a route handler has to
 * do it by hand. Compared against `x-forwarded-host` first, which is what the
 * proxy and the Cloudflare tunnel set — the app must never hardcode or infer
 * its own origin (see middleware.ts). Copied from the .hex upload route on
 * purpose: two handlers checking the same thing should check it the same way.
 */

/** Chars. Past this a "question" is a pasted assignment, not a question. */
const GIOI_HAN_CAU_HOI = 2000;

/** Chars of student code. Comfortably more than any lesson exercise. */
const GIOI_HAN_MA = 20000;

/** Chars of lesson context — a title and a statement, not a curriculum. */
const GIOI_HAN_BAI = 4000;

/**
 * The sentence a locked student gets, word for word from the brief.
 *
 * Not exported: a route module may only export handlers and route config, and
 * `next build` type-checks exactly that.
 */
const THONG_DIEP_BI_KHOA =
  'Quyền truy cập AI của em đã bị khóa do vi phạm. Vui lòng liên hệ giáo viên để mở lại.';

/** What the chat panel receives, whatever happened. */
export interface KetQuaTroLy {
  trangThai: 'tra-loi' | 'tu-choi' | 'loi' | 'bi-khoa';
  /** Markdown, Vietnamese. Always something a student can read. */
  traLoi: string;
  /** Every non-answer carries its sentence here too, for clients that read `error`. */
  error?: string;
  /** `bi-khoa` only: true when THIS message is what caused the lock. */
  khoaMoi?: boolean;
}

export interface YeuCauTroLy {
  prompt: string;
  codeContext: string;
  lessonContext: string;
}

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

function traLoi(kq: KetQuaTroLy, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(kq, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function khongTraLoi(
  trangThai: Exclude<KetQuaTroLy['trangThai'], 'tra-loi'>,
  thongDiep: string,
  status: number,
  them: Partial<KetQuaTroLy> = {},
  headers: Record<string, string> = {},
): Response {
  return traLoi({ trangThai, traLoi: thongDiep, error: thongDiep, ...them }, status, headers);
}

function tuChoi(thongDiep: string, status: number): Response {
  return khongTraLoi('tu-choi', thongDiep, status);
}

/** A string field out of an untrusted body, trimmed and capped. */
function chuoi(v: unknown, gioiHan: number): string {
  return typeof v === 'string' ? v.trim().slice(0, gioiHan) : '';
}

/**
 * The trap: the message is not answered, and a student loses the tutor.
 *
 * `khoaTroLyViPham` re-reads the role inside its transaction, so the STUDENT
 * test here is the courtesy and the one there is the rule. If the write fails
 * the message is STILL not answered — the refusal does not depend on the
 * database being up.
 */
async function xuLyViPham(
  actor: Actor,
  cauHoi: string,
  loai: LoaiViPham,
  nguon: NguonPhatHien,
): Promise<Response> {
  if (actor.role !== 'STUDENT') {
    return tuChoi('Bí không trả lời tin nhắn này vì nội dung không phù hợp.', 403);
  }

  try {
    await khoaTroLyViPham(db, actor.id, { noiDung: cauHoi, loai, nguon });
  } catch (error) {
    console.error('[tro-ly] không ghi được khoá vi phạm', error);
    return khongTraLoi('tu-choi', 'Bí không trả lời tin nhắn này vì nội dung không phù hợp.', 403);
  }

  return khongTraLoi(
    'bi-khoa',
    'Bí không trả lời tin nhắn này vì nội dung không phù hợp với lớp học. ' + THONG_DIEP_BI_KHOA,
    403,
    { khoaMoi: true },
  );
}

/**
 * The stand-in answer, for a server with no model configured.
 *
 * Written to be honest about being a stand-in — a child told "Bí đang suy nghĩ"
 * by something that will never think is a child who stops believing the next
 * thing the app says. It still proves the wiring end to end by naming what
 * actually arrived, so "the code is not being sent" shows up on screen rather
 * than being something to go and find in a log.
 */
function traLoiTam(yeuCau: YeuCauTroLy): string {
  const dong: string[] = [
    'Bí đã nhận được câu hỏi của em rồi nè 👋',
    '',
    '> Phần trả lời thông minh của Bí chưa được bật trên máy chủ này, nên bây giờ',
    '> Bí chưa giải thích được. Em hỏi thầy cô hoặc bạn bên cạnh trước nhé.',
    '',
    '**Bí đang thấy:**',
    '',
    `- Câu hỏi: *${yeuCau.prompt}*`,
  ];

  if (yeuCau.lessonContext) dong.push(`- Bài học: *${yeuCau.lessonContext}*`);

  dong.push(
    yeuCau.codeContext
      ? `- Bài làm của em: **${yeuCau.codeContext.split('\n').length} dòng** đã gửi kèm ✅`
      : '- Bài làm của em: chưa mở khung soạn thảo nào nên Bí chưa đọc được code.',
    '',
    'Trong lúc chờ, ba việc này Bí luôn khuyên:',
    '',
    '1. Đọc lại đề một lượt, gạch chân chỗ nói **kết quả phải ra gì**.',
    '2. Chạy thử với ví dụ nhỏ nhất em nghĩ ra được.',
    '3. Chỗ nào nghi sai thì `print()` ra xem giá trị thật là bao nhiêu.',
  );

  return dong.join('\n');
}

export async function POST(req: Request): Promise<Response> {
  if (!cungNguon(req)) return tuChoi('Yêu cầu không hợp lệ.', 403);

  const actor = await currentActor();
  if (!actor) return tuChoi('Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.', 401);

  let than: unknown;
  try {
    than = await req.json();
  } catch {
    return tuChoi('Bí không đọc được câu hỏi. Em thử gửi lại nhé.', 400);
  }

  if (typeof than !== 'object' || than === null) {
    return tuChoi('Bí không đọc được câu hỏi. Em thử gửi lại nhé.', 400);
  }

  const raw = than as Record<string, unknown>;
  const yeuCau: YeuCauTroLy = {
    prompt: chuoi(raw['prompt'], GIOI_HAN_CAU_HOI),
    codeContext: chuoi(raw['codeContext'], GIOI_HAN_MA),
    lessonContext: chuoi(raw['lessonContext'], GIOI_HAN_BAI),
  };

  if (!yeuCau.prompt) return tuChoi('Em gõ câu hỏi vào rồi gửi cho Bí nhé.', 400);

  // ── 2. The lock ──────────────────────────────────────────────────────────
  let biKhoa: boolean;
  try {
    biKhoa = await biKhoaTroLy(db, actor.id);
  } catch (error) {
    // Cannot tell whether they are locked, so they are not answered.
    console.error('[tro-ly] không đọc được trạng thái khoá', error);
    return khongTraLoi('loi', 'Bí đang bận mất rồi 😵 Em thử hỏi lại sau một chút nhé.', 503);
  }
  if (biKhoa) return khongTraLoi('bi-khoa', THONG_DIEP_BI_KHOA, 403, { khoaMoi: false });

  // ── 3. Cooldown ──────────────────────────────────────────────────────────
  const cho = thuChiemLuot('tro-ly', actor.id, KHOANG_CHO_TRO_LY_MS);
  if (!cho.duocPhep) {
    return khongTraLoi(
      'tu-choi',
      thongDiepChoLai(cho.conLaiMs),
      429,
      {},
      {
        'Retry-After': String(Math.ceil(cho.conLaiMs / 1000)),
      },
    );
  }

  // ── 4–5. The word list, then the classifier ──────────────────────────────
  // One function for every box a child types into; the class chat calls the
  // same one (see lib/kiem-duyet-tin-nhan.ts). With no model configured it
  // runs the word list alone and reports `sach` on a miss.
  const kiemDuyet = await kiemDuyetTinNhan(yeuCau.prompt);
  if (kiemDuyet.trangThai === 'vi-pham') {
    return xuLyViPham(actor, yeuCau.prompt, kiemDuyet.loai, kiemDuyet.nguon);
  }
  if (kiemDuyet.trangThai === 'chua-ro') return khongTraLoi('loi', kiemDuyet.loi, 503);

  if (!coMoHinh()) return traLoi({ trangThai: 'tra-loi', traLoi: traLoiTam(yeuCau) }, 200);

  // ── 6. The tutor ─────────────────────────────────────────────────────────
  const giaSu = await hoiGiaSu({
    cauHoi: yeuCau.prompt,
    maCuaEm: yeuCau.codeContext,
    baiHoc: yeuCau.lessonContext,
  });
  if (!giaSu.ok) return khongTraLoi('loi', giaSu.loi, 503);

  return traLoi({ trangThai: 'tra-loi', traLoi: giaSu.traLoi }, 200);
}
