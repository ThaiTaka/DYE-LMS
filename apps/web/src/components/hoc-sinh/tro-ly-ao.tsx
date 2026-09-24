'use client';

import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { VanBan } from '@/lib/markdown';

import { LO_XO } from './chuyen-dong';

import type { KetQuaTroLy } from '@/app/api/tro-ly/route';

/**
 * Bí, the tutor in the corner.
 *
 * ── What it is for ───────────────────────────────────────────────────────────
 * A ten-year-old working alone on a school laptop at 9pm has nobody to ask.
 * Bí is who they can ask — an obviously-not-a-person character who reads what
 * they have written and nudges them at it. What it must never be is the thing
 * that finishes the homework; the server prompt (`api/tro-ly/route.ts`) is
 * where that refusal is written down, and it is the point of the feature
 * rather than a restriction on it.
 *
 * ── Three deliberate limits, unchanged ───────────────────────────────────────
 *
 *   1. IT NEVER SPEAKS FIRST. The panel opens on a click and on nothing else.
 *      The greeting is composed at mount so it is already there when the panel
 *      opens, not pushed at a child mid-sentence. A mascot that pops up while
 *      you are thinking is a mascot you learn to dismiss, and then the help is
 *      gone with it.
 *   2. IT CAN BE SENT AWAY, and it stays away — the choice is kept in
 *      `localStorage`. A character you cannot switch off is not a companion.
 *      "Gọi Bí quay lại" brings it back.
 *   3. IT IS NOT IN THE EXAM ROOM. `/kiem-tra/[slug]` renders `PhongThi`
 *      without the student shell, and this lives in the shell — so a tutor
 *      cannot appear beside an exam question. That is not an accident of where
 *      the import landed; it is the reason it is mounted there.
 *
 * ── Why it bobs ──────────────────────────────────────────────────────────────
 * A still drawing in a corner reads as a decal. Two pixels of drift is what
 * makes it read as a character worth talking to — and it stops completely for
 * anyone whose OS asks for reduced motion (`useReducedMotion`), because a
 * permanent loop is exactly what that setting is there to end.
 */

const KHOA_AN = 'dye:tro-ly-ao:an';

/**
 * How Bí opens a conversation.
 *
 * Short, ordinary Vietnamese — the register a classmate would use, not a
 * teacher and not an advertisement. Nothing here praises a RESULT, because at
 * greeting time Bí has not read anything yet: praise for work it cannot see is
 * the fastest way for a child to stop believing any of it.
 */
const CAU_NOI = [
  'Cố lên nhé!',
  'Làm tốt lắm!',
  'Nghỉ giải lao tí không?',
  'Sai cũng không sao đâu, thử lại nào!',
  'Chậm mà chắc, không vội gì cả.',
  'Đọc lại đề một lượt xem sao?',
  'Mỗi ngày một chút là giỏi liền!',
  'Uống miếng nước rồi học tiếp nè.',
  'Ngồi thẳng lưng chút nào!',
  'Em làm được mà, tin Bí đi.',
  'Xong bài này là nghỉ được rồi!',
] as const;

/** One line from `CAU_NOI`, at random. */
function motCau(): string {
  return CAU_NOI[Math.floor(Math.random() * CAU_NOI.length)] ?? CAU_NOI[0];
}

/**
 * The greeting, composed once per mount.
 *
 * Not a constant: the same sentence on every page load reads as a sign, and a
 * sign is not something you talk to. Composed in an effect rather than in the
 * initial state for the same reason the hidden flag is — `Math.random()` on
 * the server and on the client give different text, and React reports that as
 * a hydration mismatch on a page a child is using.
 */
function loiChao(): string {
  return [
    `Chào em! ${motCau()}`,
    '',
    'Bí đọc được bài em đang gõ, nên em cứ hỏi thoải mái:',
    '',
    '- *"Sao chỗ này báo lỗi vậy?"*',
    '- *"Em làm tới đây rồi, giờ nghĩ tiếp kiểu gì?"*',
    '',
    'Bí sẽ **không làm hộ** đâu nha — Bí chỉ chỉ chỗ để em tự nghĩ ra thôi.',
  ].join('\n');
}

interface TinNhan {
  id: string;
  /** `em` is the student, `bi` is the assistant. */
  vai: 'em' | 'bi';
  /** Markdown. Bí writes it; the student's own text is rendered as plain text. */
  noiDung: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reading the page the student is on
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The code the student is looking at.
 *
 * ── Why the DOM and not a store ──────────────────────────────────────────────
 * The editors are `KhuLamBai` instances mounted per block, each owning its own
 * CodeMirror state, and Bí is mounted in the shell — outside all of them, on
 * every student page, including ones with no editor at all. Lifting that state
 * to a shared context would mean every lesson block re-rendering on every
 * keystroke so that a panel which is usually closed can read a string. Reading
 * the DOM at send time costs nothing until the moment it is needed.
 *
 * ── Which editor, on a page with five ────────────────────────────────────────
 * A lesson is a column of blocks and several of them can carry an editor, so
 * "the first one" is usually the wrong one. The editor the student is typing
 * in wins; failing that, the one nearest the middle of the screen, which is
 * the one they are looking at.
 *
 * ── Why lines and not `textContent` ──────────────────────────────────────────
 * CodeMirror renders each line as its own element with no newline between
 * them, so `.cm-content.textContent` returns the whole program on one line —
 * which for Python is not the same program. The lines are joined by hand and
 * `textContent` kept only as a fallback for a DOM shape that is not there.
 */
function docMaHienTai(): string {
  if (typeof document === 'undefined') return '';

  const soanThao = Array.from(document.querySelectorAll<HTMLElement>('.cm-editor'));
  if (soanThao.length === 0) return '';

  const dangGo = soanThao.find((e) => e.contains(document.activeElement));

  const giua = window.innerHeight / 2;
  const cachGiua = (el: HTMLElement): number => {
    const r = el.getBoundingClientRect();
    return Math.abs(r.top + r.height / 2 - giua);
  };

  const chon = dangGo ?? soanThao.reduce((gan, e) => (cachGiua(e) < cachGiua(gan) ? e : gan));

  const dong = Array.from(chon.querySelectorAll<HTMLElement>('.cm-line'));
  if (dong.length > 0) {
    const ma = dong.map((d) => d.textContent ?? '').join('\n');
    return ma.trim();
  }

  return (chon.querySelector<HTMLElement>('.cm-content')?.textContent ?? '').trim();
}

/**
 * Which lesson this is, for the model's benefit.
 *
 * The page heading, because it is the one thing every student route has and it
 * is already the words the student would use for where they are. A bare slug
 * would tell the model less than nothing.
 */
function docBaiHienTai(): string {
  if (typeof document === 'undefined') return '';
  const h1 = document.querySelector('main h1')?.textContent?.trim() ?? '';
  return h1.slice(0, 200);
}

// ═══════════════════════════════════════════════════════════════════════════

export function TroLyAo() {
  const id = useId();
  const it = useReducedMotion();

  const [hien, setHien] = useState(true);
  const [mo, setMo] = useState(false);
  const [tinNhan, setTinNhan] = useState<TinNhan[]>([]);
  const [soanThao, setSoanThao] = useState('');
  const [dangGui, setDangGui] = useState(false);
  /**
   * The server said this student's tutor is locked.
   *
   * Learned from the first answer rather than fetched on mount: a lock is rare,
   * and asking on every page load would be a request per navigation for every
   * student to discover what almost none of them have. Not persisted either —
   * the server is the authority, and a teacher who lifts the lock should not
   * have to wait for a stale flag in the browser to expire.
   */
  const [biKhoa, setBiKhoa] = useState(false);

  const oCuon = useRef<HTMLDivElement | null>(null);
  const oNhap = useRef<HTMLTextAreaElement | null>(null);
  const dem = useRef(0);

  const themTinNhan = useCallback((vai: TinNhan['vai'], noiDung: string) => {
    dem.current += 1;
    setTinNhan((truoc) => [...truoc, { id: `tn-${dem.current}`, vai, noiDung }]);
  }, []);

  /*
   * The hidden flag is read AFTER mount, never during render.
   *
   * `localStorage` does not exist on the server, so reading it in the initial
   * state would make the server and the client render different trees and
   * React would throw a hydration mismatch on a page a child is using. The
   * cost is that a student who hid Bí sees it for one frame on a cold load,
   * which is the right side of that trade.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KHOA_AN) === 'co') setHien(false);
    } catch {
      // Private mode, or storage switched off by a school image. Bí stays.
    }
  }, []);

  /** The greeting is waiting in the panel before it is ever opened. */
  useEffect(() => {
    dem.current += 1;
    setTinNhan([{ id: `tn-${dem.current}`, vai: 'bi', noiDung: loiChao() }]);
  }, []);

  /* New message, or a reply arriving: the newest line is the one to be on. */
  useEffect(() => {
    const o = oCuon.current;
    if (o) o.scrollTop = o.scrollHeight;
  }, [tinNhan, dangGui]);

  /* Opening the panel puts the cursor where the student types. */
  useEffect(() => {
    if (mo) oNhap.current?.focus();
  }, [mo]);

  /* Escape closes it, wherever the focus happens to be. */
  useEffect(() => {
    if (!mo) return;
    const thoat = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMo(false);
    };
    window.addEventListener('keydown', thoat);
    return () => window.removeEventListener('keydown', thoat);
  }, [mo]);

  const doiTrangThai = useCallback((sangHien: boolean) => {
    setHien(sangHien);
    setMo(false);
    try {
      window.localStorage.setItem(KHOA_AN, sangHien ? 'khong' : 'co');
    } catch {
      // Not being able to remember the choice is not a reason to ignore it now.
    }
  }, []);

  const gui = useCallback(async () => {
    const cauHoi = soanThao.trim();
    if (!cauHoi || dangGui) return;

    setSoanThao('');
    themTinNhan('em', cauHoi);
    setDangGui(true);

    try {
      const res = await fetch('/api/tro-ly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cauHoi,
          // Read here, at send time, so it is what is on screen right now
          // rather than whatever was there when the panel was opened.
          codeContext: docMaHienTai(),
          lessonContext: docBaiHienTai(),
        }),
      });

      /*
       * The body is read whatever the status: the route answers 4xx and 5xx
       * with the same `KetQuaTroLy` shape, and its `traLoi` is a sentence
       * written for a child. Only a body that will not parse at all — a proxy
       * error page, an offline fetch — falls through to the catch.
       */
      const kq = (await res.json()) as KetQuaTroLy;
      themTinNhan('bi', kq.traLoi || 'Bí chưa nghĩ ra gì để nói. Em hỏi lại giúp Bí nhé.');
      if (kq.trangThai === 'bi-khoa') setBiKhoa(true);
    } catch {
      themTinNhan(
        'bi',
        'Bí không kết nối được 😢 Em kiểm tra mạng rồi thử lại, hoặc hỏi thầy cô nhé.',
      );
    } finally {
      setDangGui(false);
      oNhap.current?.focus();
    }
  }, [soanThao, dangGui, themTinNhan]);

  if (!hien) {
    return (
      <button
        type="button"
        onClick={() => doiTrangThai(true)}
        className="fixed end-4 bottom-4 z-40 flex min-h-cham items-center gap-2 rounded-full border border-vien bg-the px-4 py-2 text-sm font-medium text-chu-phu shadow-sm hover:border-chinh hover:text-chinh-sang"
      >
        <span aria-hidden="true" className="text-3xl leading-none">
          🤖
        </span>
        Gọi Bí quay lại
      </button>
    );
  }

  return (
    /*
     * Its own `LazyMotion`, even though the student shell already provides one.
     *
     * Nesting is free — the same feature bundle is loaded once — and it makes
     * the mascot work wherever it is mounted. Without it, dropping `<TroLyAo/>`
     * on a page outside `VoHocSinh` gives a robot that renders perfectly and
     * never moves, which is the kind of bug nobody files because nothing looks
     * broken.
     */
    <LazyMotion features={domAnimation} strict>
      <div className="fixed end-4 bottom-4 z-40 flex flex-col items-end gap-3 print:hidden">
        <AnimatePresence>
          {mo ? (
            <m.div
              id={`${id}-khung-chat`}
              role="dialog"
              aria-labelledby={`${id}-tieu-de`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: LO_XO }}
              exit={{ opacity: 0, y: 16, scale: 0.96, transition: { duration: 0.15 } }}
              // It grows from the corner the robot sits in.
              style={{ transformOrigin: '100% 100%' }}
              /*
               * Glass, by hand rather than through `TheKinh`.
               *
               * The card utility is a 6% white wash meant to sit ON a page that
               * glows behind it. This panel floats over arbitrary lesson
               * content — code blocks, tables, illustrations — and at 6% every
               * one of them shows through the conversation. `bg-the/80` is the
               * same card colour the whole app uses (`--color-the`, #151A35)
               * at a weight that stays readable over anything, with the blur
               * and the neon halo that make it read as lifted rather than
               * pasted on.
               */
              className="flex h-[min(30rem,calc(100dvh-11rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-the border border-white/10 bg-the/80 shadow-[var(--shadow-neon)] backdrop-blur-xl"
            >
              {/* ── Header ──────────────────────────────────────────────── */}
              <header className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-4 py-3">
                <span aria-hidden="true" className="shrink-0">
                  <RobotBi size={32} dangNoi={dangGui} yen />
                </span>

                <span className="min-w-0 flex-1">
                  <h2 id={`${id}-tieu-de`} className="m-0 truncate text-sm font-bold text-chu">
                    Bí — trợ lý học tập
                  </h2>
                  <p className="m-0 truncate text-xs font-medium text-chu-nhat">
                    {biKhoa
                      ? 'Đang tạm khoá'
                      : dangGui
                        ? 'Đang đọc bài của em…'
                        : 'Gợi ý từng bước, không làm hộ'}
                  </p>
                </span>

                <button
                  type="button"
                  onClick={() => doiTrangThai(false)}
                  className="shrink-0 rounded-nut px-2 py-1 text-xs font-medium text-chu-nhat hover:text-chu"
                >
                  Ẩn Bí đi
                </button>
                <button
                  type="button"
                  onClick={() => setMo(false)}
                  aria-label="Đóng cửa sổ trò chuyện"
                  className="grid size-8 shrink-0 place-items-center rounded-nut text-chu-phu hover:bg-white/[0.06] hover:text-chu"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </header>

              {/* ── History ─────────────────────────────────────────────── */}
              <div
                ref={oCuon}
                role="log"
                aria-live="polite"
                aria-label="Cuộc trò chuyện với Bí"
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
              >
                {tinNhan.map((t) => (
                  <BongTinNhan key={t.id} tin={t} />
                ))}

                {dangGui ? (
                  <p className="m-0 flex items-center gap-2 text-sm font-medium text-chu-nhat">
                    <span aria-hidden="true">🤖</span>
                    Bí đang nghĩ…
                  </p>
                ) : null}
              </div>

              {/* ── Composer ────────────────────────────────────────────── */}
              {biKhoa ? (
                /*
                 * No text box to type into a wall. The sentence says what
                 * happened and who can undo it — never what the student is —
                 * and it is amber, not red: a lock is something a teacher
                 * will look at, not a verdict.
                 */
                <p
                  role="status"
                  className="m-0 shrink-0 border-t border-white/10 bg-thu-lai-nen px-4 py-3 text-sm font-medium text-thu-lai"
                >
                  <span aria-hidden="true">🔒 </span>
                  Quyền truy cập AI của em đã bị khóa do vi phạm. Vui lòng liên hệ giáo viên để mở
                  lại.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void gui();
                  }}
                  className="flex shrink-0 items-end gap-2 border-t border-white/10 p-3"
                >
                  <label htmlFor={`${id}-o-nhap`} className="sr-only">
                    Hỏi Bí một câu
                  </label>
                  <textarea
                    id={`${id}-o-nhap`}
                    ref={oNhap}
                    rows={2}
                    value={soanThao}
                    onChange={(e) => setSoanThao(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter is a new line. A twelve-year-old
                      // reaches for Enter; the modifier is there for the rare
                      // question that needs two lines.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void gui();
                      }
                    }}
                    placeholder="Em đang mắc chỗ nào?"
                    className="min-h-11 flex-1 resize-none rounded-nut border border-white/10 bg-nen-sau/60 px-3 py-2 text-sm text-chu placeholder:text-chu-nhat focus-visible:border-chinh-sang focus-visible:ring-2 focus-visible:ring-chinh-sang/40 focus-visible:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={dangGui || soanThao.trim() === ''}
                    className="grid size-11 shrink-0 place-items-center rounded-nut bg-chinh font-semibold text-white hover:bg-chinh-dam disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span aria-hidden="true">➤</span>
                    <span className="sr-only">Gửi câu hỏi cho Bí</span>
                  </button>
                </form>
              )}
            </m.div>
          ) : null}
        </AnimatePresence>

        {/*
          The mascot button.

          A bare 64px drawing floating on a dark lesson page was easy to miss
          and easy to mistake for an illustration. It now sits on its own glass
          disc with a neon halo and a gradient hairline, so it reads as a
          control — and it is bigger, because the thing a stuck child needs to
          find is the thing that helps.
        */}
        <m.button
          type="button"
          onClick={() => setMo((truoc) => !truoc)}
          aria-expanded={mo}
          aria-controls={`${id}-khung-chat`}
          // The name says what pressing it does, not what the picture is — a
          // screen reader user gets "hỏi Bí", which is the point of the
          // button, rather than "robot".
          aria-label={mo ? 'Đóng cửa sổ trò chuyện với Bí' : 'Mở trò chuyện, hỏi Bí một câu'}
          className="grid size-16 place-items-center rounded-full border border-white/10 bg-the/80 shadow-[var(--shadow-neon)] backdrop-blur-xl focus-visible:outline-3 sm:size-20"
          animate={it ? undefined : { y: [0, -10, 0] }}
          transition={it ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={it ? undefined : { scale: 1.08, rotate: -4 }}
          whileTap={it ? undefined : { scale: 0.94 }}
        >
          <RobotBi size={56} dangNoi={mo} yen={Boolean(it)} />
        </m.button>
      </div>
    </LazyMotion>
  );
}

/**
 * One turn in the conversation.
 *
 * Bí's side goes through the lesson markdown renderer — the same one the
 * curriculum uses, which produces React nodes and never an HTML string, so a
 * model that echoes markup back cannot turn it into markup. The student's own
 * line is deliberately NOT rendered as markdown: it is what they typed, and
 * seeing their asterisks quietly become italics is confusing in a box that is
 * otherwise a chat.
 */
function BongTinNhan({ tin }: { tin: TinNhan }) {
  if (tin.vai === 'em') {
    return (
      <p className="m-0 ms-auto w-fit max-w-[85%] rounded-the-nho rounded-ee-sm bg-chinh px-3 py-2 text-sm whitespace-pre-wrap text-white">
        {tin.noiDung}
      </p>
    );
  }

  return (
    <div className="me-auto w-fit max-w-[92%] rounded-the-nho rounded-es-sm border border-chinh/25 bg-chinh-nhat px-3 py-2 text-sm text-chu [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
      <VanBan>{tin.noiDung}</VanBan>
    </div>
  );
}

/**
 * Bí, drawn.
 *
 * Inline SVG rather than an image file: it needs colours from the design
 * tokens, it has to stay sharp at any size, and one more asset to deploy is
 * one more asset that can 404 on a school network and leave a broken-image
 * icon bobbing in the corner.
 */
function RobotBi({
  dangNoi,
  yen,
  size = 64,
}: {
  dangNoi: boolean;
  yen: boolean;
  /** Rendered edge in px. The drawing is a 64-unit square at any size. */
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className="drop-shadow-lg"
      role="presentation"
    >
      {/* Antenna */}
      <line x1="32" y1="6" x2="32" y2="14" stroke="var(--color-chinh)" strokeWidth="2.5" />
      <m.circle
        cx="32"
        cy="5"
        r="3.5"
        fill="var(--color-thu-lai)"
        animate={yen ? undefined : { scale: [1, 1.25, 1], opacity: [1, 0.75, 1] }}
        transition={yen ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '32px 5px' }}
      />

      {/* Head */}
      <rect
        x="10"
        y="14"
        width="44"
        height="36"
        rx="12"
        fill="var(--color-chinh-tuoi)"
        stroke="#ffffff"
        strokeWidth="2.5"
      />

      {/* Face plate */}
      <rect x="16" y="21" width="32" height="20" rx="8" fill="var(--color-chinh-nhat)" />

      {/* Eyes — they blink, which is most of what makes it read as alive. */}
      {[24, 40].map((cx) => (
        <m.rect
          key={cx}
          x={cx - 3.5}
          y="27"
          width="7"
          height="8"
          rx="3.5"
          fill="var(--color-chinh)"
          animate={yen ? undefined : { scaleY: [1, 1, 0.12, 1] }}
          transition={
            yen ? undefined : { duration: 4.5, repeat: Infinity, times: [0, 0.92, 0.96, 1] }
          }
          style={{ transformOrigin: `${cx}px 31px` }}
        />
      ))}

      {/* Mouth: a smile normally, an open "o" while it is talking. */}
      {dangNoi ? (
        <ellipse cx="32" cy="38" rx="4" ry="3" fill="var(--color-chinh)" />
      ) : (
        <path
          d="M27 37 Q32 41 37 37"
          fill="none"
          stroke="var(--color-chinh)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}

      {/* Ears */}
      <rect x="5" y="26" width="5" height="12" rx="2.5" fill="var(--color-chinh)" />
      <rect x="54" y="26" width="5" height="12" rx="2.5" fill="var(--color-chinh)" />

      {/* Body, just enough of it to sit on */}
      <rect
        x="19"
        y="50"
        width="26"
        height="10"
        rx="5"
        fill="var(--color-chinh-tuoi)"
        stroke="#ffffff"
        strokeWidth="2.5"
      />
    </svg>
  );
}

/**
 * English alias.
 *
 * The codebase names things in Vietnamese so the people who maintain it read
 * their own language; this is here because the component is referred to as
 * `<VirtualAssistant />` outside the code, and two names for one thing is
 * cheaper than an argument about it.
 */
export { TroLyAo as VirtualAssistant };
