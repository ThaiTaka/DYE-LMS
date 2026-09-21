import { currentActor } from '@/auth';

/**
 * Bí's tutoring endpoint.
 *
 * ── What it is for ───────────────────────────────────────────────────────────
 * A student stuck at 9pm has nobody to ask. This is the thing they can ask —
 * and the whole design problem is that it must NOT be the thing that finishes
 * their homework. A tutor that hands over working code teaches a child that
 * being stuck is something you route around rather than something you get
 * better at, and it makes every submission after it meaningless to the teacher
 * reading it.
 *
 * So the refusal to answer is the feature, not a limitation to be lifted later.
 * `LOI_NHAC_HE_THONG` below is where that lives.
 *
 * ── What it does today ───────────────────────────────────────────────────────
 * It returns a canned reply. No model is called, no key is read, nothing is
 * billed. What IS real is everything around the model: the origin check, the
 * session check, the caps on what a request may carry, the shape of the answer,
 * and the fact that the student's code reaches the server at all. That is
 * deliberate — a chat panel wired to a model and one wired to a stub differ by
 * a single function call, and the bugs that are expensive to find live in the
 * other ninety percent. Swapping the stub for a real call means replacing
 * `traLoiTam` and nothing else.
 *
 * ── Same-origin only ─────────────────────────────────────────────────────────
 * Server actions check `Origin` against `Host` for free; a route handler has to
 * do it by hand. Compared against `x-forwarded-host` first, which is what the
 * proxy and the Cloudflare tunnel set — the app must never hardcode or infer
 * its own origin (see middleware.ts). Copied from the .hex upload route on
 * purpose: two handlers checking the same thing should check it the same way.
 */

/**
 * The rules the model is given, verbatim.
 *
 * Exported so the eventual provider call and anything that tests this behaviour
 * read one definition. English, because that is the register these instructions
 * are written in and followed best in; the REPLY is Vietnamese, which is the
 * last line's job.
 */
export const LOI_NHAC_HE_THONG = [
  'You are a STEM programming tutor for children aged 10-15 learning Python and',
  'micro:bit at DYE LMS.',
  '',
  'DO NOT give direct answers or final code. Never write the solution, never',
  'complete a function the student left unfinished, and never output a code block',
  'that could be pasted in and handed in. If the student asks you outright for the',
  'answer, say kindly that you will not, and give the next hint instead.',
  '',
  "Analyze the student's code and provide step-by-step hints in Markdown: point at",
  'the line or the idea that is wrong, ask a question that makes the student look',
  'at it, and stop. One step at a time — do not list every remaining step at once.',
  '',
  'Short snippets of SYNTAX are allowed when the student does not know the form of',
  'a statement (for example, how a `for` loop is written). Snippets that solve this',
  'particular exercise are not.',
  '',
  'Answer in Vietnamese, in the plain register a classmate would use. Be warm and',
  'brief. Being stuck is normal, and you say so.',
].join('\n');

/** Chars. Past this a "question" is a pasted assignment, not a question. */
const GIOI_HAN_CAU_HOI = 2000;

/** Chars of student code. Comfortably more than any lesson exercise. */
const GIOI_HAN_MA = 20000;

/** Chars of lesson context — a title and a statement, not a curriculum. */
const GIOI_HAN_BAI = 4000;

/** What the chat panel receives, whatever went wrong. */
export interface KetQuaTroLy {
  trangThai: 'tra-loi' | 'tu-choi' | 'loi';
  /** Markdown, Vietnamese. Always something a student can read. */
  traLoi: string;
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

function traLoi(kq: KetQuaTroLy, status: number): Response {
  return Response.json(kq, { status, headers: { 'Cache-Control': 'no-store' } });
}

function tuChoi(thongDiep: string, status: number): Response {
  return traLoi({ trangThai: 'tu-choi', traLoi: thongDiep }, status);
}

/** A string field out of an untrusted body, trimmed and capped. */
function chuoi(v: unknown, gioiHan: number): string {
  return typeof v === 'string' ? v.trim().slice(0, gioiHan) : '';
}

/**
 * The stand-in answer.
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
    '> Phần trả lời thông minh của Bí đang được lắp đặt, nên bây giờ Bí chưa',
    '> giải thích được. Em hỏi thầy cô hoặc bạn bên cạnh trước nhé.',
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

  try {
    /*
     * Where the provider call goes.
     *
     * It takes `LOI_NHAC_HE_THONG` as the system prompt and `yeuCau` as the
     * user turn. Everything above this line — the origin check, the session,
     * the caps — is what it will be handed, and none of it changes when it
     * arrives. Keep the failure path below: a tutor that throws a stack trace
     * at a twelve-year-old is worse than one that is briefly unavailable.
     */
    return traLoi({ trangThai: 'tra-loi', traLoi: traLoiTam(yeuCau) }, 200);
  } catch {
    return traLoi(
      { trangThai: 'loi', traLoi: 'Bí đang bận mất rồi 😵 Em thử hỏi lại sau một chút nhé.' },
      500,
    );
  }
}
