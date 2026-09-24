import { type CSSProperties } from 'react';

/**
 * The login page's background: the app's own editor, running.
 *
 * Two MicroPython files scroll past on either side and a terminal types a
 * command and prints what the robot saw — the thing a student is about to log
 * in and do, shown before they do it.
 *
 * ── No JavaScript ────────────────────────────────────────────────────────────
 * This is a server component. The typing, the scrolling and the blinking caret
 * are CSS keyframes (`--animate-*` in globals.css), so the login page ships no
 * extra client code, hydrates nothing new, and cannot drop a frame to a timer.
 * Every animation moves `transform`, `opacity` or `clip-path` — the scrolling
 * files run entirely on the compositor.
 *
 * ── Why a scrim and not a blur ───────────────────────────────────────────────
 * The whole layer is muted by an 80% navy scrim, darker still in the middle
 * column where the form sits. `backdrop-blur` over the full viewport would
 * re-blur the screen on every frame of the scroll, and that is the most
 * expensive thing a school laptop's GPU can be asked to do (see `kinh` in
 * globals.css). The one blur on this page stays the form card's own.
 *
 * ── Small screens ────────────────────────────────────────────────────────────
 * Below `lg` there is no room beside the form, so a single editor fills the
 * background top to bottom — its tab bar above the logo, its status bar in the
 * page's bottom padding, clear of any text — and the other two panels are
 * `display: none`, which stops their animations outright rather than running
 * them off-screen.
 *
 * Hidden from assistive tech: it is decoration, and a screen reader walking
 * seventy lines of Python before reaching "Tên đăng nhập" would be a trap.
 */
export function NenMaLenh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none contain-strict perspective-distant"
    >
      {/*
        Beside the form, never under it: the width is whatever is left between
        a 4% margin and the card's edge (28rem wide, centred) less a 1.5rem gap.
        The panels lean in towards the form like the walls of a corridor.
      */}
      <CuaSoMa
        tenTep="main.py"
        dong={MAIN_PY}
        style={{ animationDelay: '-14s' }}
        className="top-6 right-4 bottom-6 left-4 flex sm:right-10 sm:left-10 lg:top-[10%] lg:right-auto lg:bottom-auto lg:left-[4%] lg:h-[78%] lg:w-[min(26rem,calc(46vw_-_15.5rem))] lg:rotate-y-12"
      />
      <CuaSoMa
        tenTep="robot.py"
        dong={ROBOT_PY}
        style={{ animationDuration: '85s', animationDelay: '-38s' }}
        className="top-[8%] right-[4%] hidden h-[50%] w-[min(26rem,calc(46vw_-_15.5rem))] -rotate-y-12 lg:flex"
      />
      <Terminal className="right-[4%] bottom-[8%] hidden h-[30%] w-[min(26rem,calc(46vw_-_15.5rem))] -rotate-y-12 lg:flex" />

      {/* The scrim, then a darker pool behind the heading and form. */}
      <div className="absolute inset-0 bg-nen/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_30rem_34rem_at_50%_48%,var(--color-nen)_35%,transparent_100%)]" />

      {/* Violet data grid, faded out towards the edges, and the glow behind the logo. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(167,139,250,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(167,139,250,0.10)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_30%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_40%,rgba(124,58,237,0.22),transparent_70%)]" />
    </div>
  );
}

/* ── Panels ─────────────────────────────────────────────────────────────── */

const KHUNG =
  'absolute flex-col overflow-hidden rounded-the-nho border border-white/10 bg-nen-sau/85 shadow-noi';

/**
 * An editor window whose file scrolls upward forever.
 *
 * The track holds the file THREE times and slides up by exactly one copy, so
 * the last frame is the first and the loop has no seam. That holds while two
 * copies cover the window: a ~35-line file is ~980px, so anything up to a
 * ~1950px-tall panel. Two copies would need one copy to fill the window alone,
 * and a portrait tablet's full-height panel is taller than that.
 */
function CuaSoMa({
  tenTep,
  dong,
  className,
  style,
}: {
  tenTep: string;
  dong: Manh[][];
  className: string;
  /** Per-panel duration and a negative delay, so the two files start mid-scroll and never move in step. */
  style: CSSProperties;
}) {
  return (
    <div className={`${KHUNG} ${className}`}>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-be-mat/90 px-3.5">
        {/* Window controls. Literal colours: they are a picture of a window, not app state. */}
        <span className="flex gap-1.5">
          <span className="block size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="block size-2.5 rounded-full bg-[#febc2e]" />
          <span className="block size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="-mb-px border-b-2 border-chinh-sang px-2 py-2 font-mono text-xs text-chu-phu">
          🐍 {tenTep}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden pt-2 [mask-image:linear-gradient(to_bottom,transparent,#000_12%,#000_88%,transparent)]">
        <div
          className="animate-cuon-ma text-sm leading-[1.7] will-change-transform motion-reduce:animate-none"
          style={style}
        >
          <BanMa dong={dong} />
          <BanMa dong={dong} />
          <BanMa dong={dong} />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 overflow-hidden bg-chinh/75 px-3 font-mono text-xs leading-6 whitespace-nowrap text-white">
        <span>✓ micro:bit</span>
        <span>MicroPython · UTF-8</span>
      </div>
    </div>
  );
}

/** One copy of a file: line numbers, then the coloured source. */
function BanMa({ dong }: { dong: Manh[][] }) {
  return (
    <div className="flex">
      <pre className="m-0 w-12 shrink-0 pr-4 text-right font-mono text-chu-nhat/50">
        {dong.map((_, i) => i + 1).join('\n')}
      </pre>
      <pre className="m-0 font-mono text-[#e2e8f0]">
        {dong.map((manh, i) => [
          i > 0 ? '\n' : null,
          ...manh.map((m, k) =>
            m.loai ? (
              <span key={`${i}-${k}`} className={MAU[m.loai]}>
                {m.chu}
              </span>
            ) : (
              m.chu
            ),
          ),
        ])}
      </pre>
    </div>
  );
}

/*
 * The terminal.
 *
 * One 12-second loop: the prompt waits, the command types itself, the output
 * prints a line at a time, holds, clears, and the command backspaces away. The
 * timeline is in globals.css; the step COUNTS are set here, next to the text
 * they count, so changing the command or adding an output line cannot leave
 * the caret out of step with the letters.
 */
const LENH = 'python robot.py';
const KET_QUA = [
  'Đang kết nối micro:bit… ✓',
  'Khoảng cách: 42 cm → đi thẳng',
  'Khoảng cách: 17 cm → rẽ trái',
];

function Terminal({ className }: { className: string }) {
  const buocGo = `steps(${LENH.length})`;

  return (
    <div className={`${KHUNG} ${className}`}>
      <div className="flex shrink-0 items-center gap-5 border-b border-white/10 bg-be-mat/90 px-4 font-mono text-xs">
        <span className="py-2 text-chu-nhat">OUTPUT</span>
        <span className="-mb-px border-b-2 border-chinh-sang py-2 text-chu-phu">TERMINAL</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 font-mono text-sm leading-[1.7] whitespace-pre text-[#e2e8f0]">
        <p className="m-0">
          <span className="text-[#6ee7b7]">$ </span>
          <span className="relative inline-block">
            <span
              className="inline-block animate-go-lenh motion-reduce:animate-none"
              style={{ animationTimingFunction: buocGo }}
            >
              {LENH}
            </span>
            {/* At rest this caret is hidden: with motion reduced, the finished run below carries the live one. */}
            <span
              className="absolute top-[0.25em] left-0 h-[1.2em] w-[0.55ch] bg-chinh-sang opacity-0 animate-con-tro-go motion-reduce:animate-none"
              style={
                { '--so-ky-tu': LENH.length, animationTimingFunction: buocGo } as CSSProperties
              }
            />
          </span>
        </p>

        {/* Revealed a line at a time: the clip steps once per line, so every line must be one line tall. */}
        <div
          className="animate-hien-ket-qua motion-reduce:animate-none"
          style={{ animationTimingFunction: `steps(${KET_QUA.length + 1})` }}
        >
          {KET_QUA.map((dong) => (
            <p key={dong} className="m-0 text-chu-phu">
              {dong}
            </p>
          ))}
          <p className="m-0">
            <span className="text-[#6ee7b7]">$ </span>
            <span className="inline-block h-[1.2em] w-[0.55ch] translate-y-[0.25em] bg-chinh-sang animate-nhay motion-reduce:animate-none" />
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Syntax colouring ───────────────────────────────────────────────────── */

/*
 * The editor's own palette — `MAU_CU_PHAP` in components/hoc-sinh/soan-thao.tsx
 * — so what scrolls past the login form is recognisably the editor a student
 * is about to open, not a stock theme.
 */
type Loai = 'tu-khoa' | 'hang' | 'chuoi' | 'so' | 'chu-thich' | 'ham' | 'lop';

const MAU: Record<Loai, string> = {
  'tu-khoa': 'font-semibold text-[#c084fc]',
  hang: 'font-semibold text-[#fdba74]',
  chuoi: 'text-[#6ee7b7]',
  so: 'text-[#fbbf24]',
  'chu-thich': 'italic text-[#8b93ad]',
  ham: 'text-[#60a5fa]',
  lop: 'font-semibold text-[#f9a8d4]',
};

interface Manh {
  chu: string;
  loai?: Loai;
}

const TU_KHOA = new Set([
  'and',
  'break',
  'def',
  'elif',
  'else',
  'for',
  'from',
  'if',
  'import',
  'in',
  'not',
  'or',
  'pass',
  'return',
  'while',
]);
const HANG = new Set(['True', 'False', 'None']);

/** Comment · string · number · name · any other single character, tried in that order. */
const MANH = /(#.*)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(.)/g;

/**
 * Just enough of a Python tokeniser for two files written in this module.
 *
 * Returns DATA — runs of text with a colour — and `BanMa` maps it to spans, the
 * same shape as the Blocks highlighter in khoi-lenh-microbit.tsx. Uncoloured
 * runs are merged, so a line costs a handful of nodes rather than one per token.
 */
function toMau(dong: string): Manh[] {
  const ra: Manh[] = [];
  for (const m of dong.matchAll(MANH)) {
    const [chu, chuThich, chuoi, so, ten] = m;
    let loai: Loai | undefined;
    if (chuThich) loai = 'chu-thich';
    else if (chuoi) loai = 'chuoi';
    else if (so) loai = 'so';
    else if (ten) {
      if (TU_KHOA.has(ten)) loai = 'tu-khoa';
      else if (HANG.has(ten)) loai = 'hang';
      else if (dong[m.index + ten.length] === '(') loai = 'ham';
      else if (/^[A-Z][a-z]/.test(ten)) loai = 'lop';
    }

    const truoc = ra.at(-1);
    if (!loai && truoc && !truoc.loai) truoc.chu += chu;
    else ra.push(loai ? { chu, loai } : { chu });
  }
  return ra;
}

const tep = (ma: string): Manh[][] => ma.split('\n').map(toMau);

// Tokenised once when the module loads, not on every request.
const MAIN_PY = tep(`# Trạm thời tiết mini — micro:bit V2
from microbit import *
import radio
import music

radio.on()
radio.config(group=7, power=6)

NGUONG_NONG = 30
dem = 0

def bao_dong():
    music.play(music.BA_DING)
    display.show(Image.SAD)

while True:
    nhiet_do = temperature()
    anh_sang = display.read_light_level()

    if button_a.was_pressed():
        display.scroll(str(nhiet_do) + "C")
    elif button_b.was_pressed():
        dem += 1
        radio.send("tram:" + str(dem))

    if nhiet_do > NGUONG_NONG:
        bao_dong()
    elif anh_sang < 40:
        display.show(Image.ASLEEP)
    else:
        display.show(Image.HAPPY)

    tin = radio.receive()
    if tin:
        display.scroll(tin, delay=80)
    sleep(500)
`);

const ROBOT_PY = tep(`# Xe robot tránh vật cản
from microbit import *
import utime

TOC_DO = 700
AN_TOAN = 20  # cm

def dong_co(trai, phai):
    pin13.write_analog(trai)
    pin14.write_analog(phai)

def do_khoang_cach():
    pin1.write_digital(1)
    utime.sleep_us(10)
    pin1.write_digital(0)
    while pin2.read_digital() == 0:
        pass
    bat_dau = utime.ticks_us()
    while pin2.read_digital() == 1:
        pass
    thoi_gian = utime.ticks_diff(utime.ticks_us(), bat_dau)
    return thoi_gian / 58

def tranh_vat_can():
    dong_co(0, 0)
    sleep(200)
    dong_co(0, TOC_DO)
    sleep(450)

while True:
    kc = do_khoang_cach()
    if kc < AN_TOAN:
        display.show(Image.NO)
        tranh_vat_can()
    else:
        display.show(Image.ARROW_N)
        dong_co(TOC_DO, TOC_DO)
    sleep(50)
`);
