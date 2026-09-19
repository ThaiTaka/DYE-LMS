'use client';

import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useId, useState } from 'react';

import { LO_XO } from './chuyen-dong';

/**
 * Bí, the robot in the corner.
 *
 * ── What it is for ───────────────────────────────────────────────────────────
 * A ten-year-old working alone on a school laptop gets no encouragement from
 * anywhere between hand-ins. This is a small, obviously-not-a-person character
 * who says something kind when asked. It knows nothing, answers nothing, and
 * is never in the way — the value is that the room feels inhabited.
 *
 * ── Three deliberate limits ──────────────────────────────────────────────────
 *
 *   1. IT NEVER SPEAKS FIRST. The bubble opens on a click and on nothing else.
 *      A mascot that pops up mid-sentence is a mascot a child learns to
 *      dismiss, and then the encouragement is gone too.
 *   2. IT CAN BE SENT AWAY, and it stays away — the choice is kept in
 *      `localStorage`. A character you cannot switch off is not a companion.
 *      "Gọi Bí quay lại" brings it back.
 *   3. IT IS NOT IN THE EXAM ROOM. `/kiem-tra/[slug]` renders `PhongThi`
 *      without the student shell, and this lives in the shell — so a bobbing
 *      robot cannot appear next to an exam question. That is not an accident
 *      of where the import landed; it is the reason it is mounted here.
 *
 * ── Why it bobs ──────────────────────────────────────────────────────────────
 * A still drawing in a corner reads as a decal. Two pixels of drift is what
 * makes it read as a character worth talking to — and it stops completely for
 * anyone whose OS asks for reduced motion (`useReducedMotion`), because a
 * permanent loop is exactly what that setting is there to end.
 */

const KHOA_AN = 'dye:tro-ly-ao:an';

/**
 * What Bí says.
 *
 * Short, ordinary Vietnamese — the register a classmate would use, not a
 * teacher and not an advertisement. Nothing here praises a result, because Bí
 * has no idea how the work is going: praise for work it cannot see is the
 * fastest way for a child to stop believing any of it. Effort, rest and
 * "try again" are things it can honestly say at any moment.
 */
const CAU_NOI = [
  'Cố lên nhé!',
  'Làm tốt lắm!',
  'Nghỉ giải lao tí không?',
  'Sai cũng không sao đâu, thử lại nào!',
  'Chậm mà chắc, không vội gì cả.',
  'Đọc lại đề một lượt xem sao?',
  'Bí quá thì hỏi thầy cô nha.',
  'Mỗi ngày một chút là giỏi liền!',
  'Uống miếng nước rồi học tiếp nè.',
  'Ngồi thẳng lưng chút nào!',
  'Em làm được mà, tin Bí đi.',
  'Xong bài này là nghỉ được rồi!',
] as const;

/** A phrase that is not the one already on screen. */
function cauKhac(hienTai: string): string {
  const conLai = CAU_NOI.filter((c) => c !== hienTai);
  return conLai[Math.floor(Math.random() * conLai.length)] ?? CAU_NOI[0];
}

export function TroLyAo() {
  const id = useId();
  const it = useReducedMotion();

  const [hien, setHien] = useState(true);
  const [mo, setMo] = useState(false);
  const [cau, setCau] = useState<string>(CAU_NOI[0]);

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

  const doiTrangThai = useCallback((sangHien: boolean) => {
    setHien(sangHien);
    setMo(false);
    try {
      window.localStorage.setItem(KHOA_AN, sangHien ? 'khong' : 'co');
    } catch {
      // Not being able to remember the choice is not a reason to ignore it now.
    }
  }, []);

  const batTat = (): void => {
    setMo((truoc) => {
      // A new phrase each time it opens: the same sentence twice reads as a
      // broken toy rather than a character.
      if (!truoc) setCau((c) => cauKhac(c));
      return !truoc;
    });
  };

  if (!hien) {
    return (
      <button
        type="button"
        onClick={() => doiTrangThai(true)}
        className="fixed end-4 bottom-4 z-40 min-h-cham rounded-full border border-vien bg-the px-4 py-2 text-sm font-medium text-chu-phu shadow-sm hover:border-chinh hover:text-chinh"
      >
        <span aria-hidden="true">🤖</span> Gọi Bí quay lại
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
      <div className="fixed end-4 bottom-4 z-40 flex flex-col items-end gap-2 print:hidden">
        <AnimatePresence>
          {mo ? (
            <m.div
              id={`${id}-bong-bong`}
              role="status"
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: LO_XO }}
              exit={{ opacity: 0, y: 8, scale: 0.94, transition: { duration: 0.15 } }}
              // The tail grows from the bottom-right, where the robot is.
              style={{ transformOrigin: '100% 100%' }}
              className="max-w-[16rem] rounded-the rounded-ee-sm border border-chinh/30 bg-chinh-nhat p-4 shadow-lg"
            >
              <p className="m-0 text-base font-semibold text-chu">{cau}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCau((c) => cauKhac(c))}
                  className="min-h-cham rounded-nut border border-chinh/40 px-3 py-1.5 text-sm font-medium text-chinh hover:bg-the"
                >
                  Câu khác
                </button>
                <button
                  type="button"
                  onClick={() => doiTrangThai(false)}
                  className="min-h-cham rounded-nut px-3 py-1.5 text-sm font-medium text-chu-nhat hover:text-chu"
                >
                  Ẩn Bí đi
                </button>
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>

        <m.button
          type="button"
          onClick={batTat}
          aria-expanded={mo}
          aria-controls={`${id}-bong-bong`}
          // The name says what pressing it does, not what the picture is — a
          // screen reader user gets "một lời động viên", which is the point of
          // the button, rather than "robot".
          aria-label={mo ? 'Đóng lời của Bí' : 'Bí nói một câu động viên'}
          className="rounded-full focus-visible:outline-3"
          animate={it ? undefined : { y: [0, -10, 0] }}
          transition={it ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          whileHover={it ? undefined : { scale: 1.08, rotate: -4 }}
          whileTap={it ? undefined : { scale: 0.94 }}
        >
          <RobotBi dangNoi={mo} yen={Boolean(it)} />
        </m.button>
      </div>
    </LazyMotion>
  );
}

/**
 * Bí, drawn.
 *
 * Inline SVG rather than an image file: it needs two colours from the design
 * tokens, it has to stay sharp at any size, and one more asset to deploy is
 * one more asset that can 404 on a school network and leave a broken-image
 * icon bobbing in the corner.
 */
function RobotBi({ dangNoi, yen }: { dangNoi: boolean; yen: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="64"
      height="64"
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
