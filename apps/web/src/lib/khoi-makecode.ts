/**
 * MakeCode block XML → something a teacher can actually read.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * A Micro:bit hand-in is a Blockly workspace: a few hundred lines of
 * `<block type="device_forever"><statement name="HANDLER">…` that describe a
 * program a child assembled by dragging coloured shapes. Dumped raw into the
 * grading page it is unreadable, and "unreadable" here has a cost — the one
 * thing a MAKECODE problem asks of a teacher is that they read the logic and
 * form a view, and nobody forms a view by squinting at angle brackets. Marking
 * degenerates into "they submitted something, so it's đạt".
 *
 * So the XML is turned into an indented Vietnamese reading of the program.
 *
 * ── Why parse it here instead of re-rendering the blocks ─────────────────────
 * The obvious alternative is to load MakeCode a second time in a read-only
 * iframe. It was rejected for the same reason the original comment on
 * `XemKhoiLenh` gives: re-rendering asks a third-party editor to re-interpret
 * the submission, and what a teacher needs is certainty about the bytes on
 * record. It is also ~2 MB of editor over a school network, per submission, to
 * read twenty lines of logic — and the raw XML stays one tab away either way.
 *
 * ── The two rules this module holds to ───────────────────────────────────────
 *   1. NEVER THROW, and never lose the submission. The input is a string a
 *      ten-year-old's browser produced; the moment this code can crash the
 *      grading page, a child's work becomes ungradeable through no fault of
 *      theirs. Anything unparseable degrades to "we could not read this, here
 *      is the raw text" — which is exactly where the page was before.
 *   2. NEVER PRODUCE MARKUP. Everything here returns plain strings and plain
 *      data. The renderer turns them into React text nodes, so a student who
 *      types `<script>` into a text block is a student who typed some
 *      characters, on a page teachers log into. Same structural guarantee as
 *      `lib/markdown.tsx`.
 *
 * ── Unknown blocks ───────────────────────────────────────────────────────────
 * MakeCode has hundreds of blocks and gains more every release; the dictionary
 * below covers the vocabulary the DYE curriculum actually teaches. Anything
 * outside it is not dropped and not shown as XML — it is rendered as its own
 * block name with the arguments read out, e.g. «servo write pin». A teacher
 * reading that still knows what the child used and where it sits in the
 * program, which is most of what they needed.
 */

// ═══════════════════════════════════════════════════════════════════════════
// A very small XML reader
// ═══════════════════════════════════════════════════════════════════════════

interface NutXml {
  ten: string;
  thuocTinh: Record<string, string>;
  con: NutXml[];
  chu: string;
}

/**
 * The runaway guard: how many elements this will read before giving up.
 *
 * A stored workspace is capped at 64 KB by `nopBaiMicrobit`, and the smallest
 * element MakeCode writes is about thirteen bytes — so no accepted submission
 * can reach this number. It is deliberately set out of reach rather than
 * "generously": a cap a real hand-in can hit is a cap that turns a big,
 * enthusiastic project into "không đọc được" on grading day.
 */
const GIOI_HAN_NUT = 30_000;

/**
 * How deep the XML itself may nest.
 *
 * Generous on purpose, and NOT a proxy for how complicated a program is. A
 * stack of N blocks in a row is `block > next > block > next > …` — about 2N
 * levels of XML for a program that is completely flat to read. A cap set from
 * intuition about nesting ("nobody indents forty deep") silently refuses a
 * twenty-block `forever` loop, which is an ordinary Buổi 1 hand-in. Parsing is
 * iterative, so depth costs nothing but the stack array; the node count is the
 * real bound.
 */
const GIOI_HAN_SAU_XML = 4000;

/** How far the READING indents. Logical nesting, which is genuinely shallow. */
const GIOI_HAN_SAU = 40;

/**
 * How long one field value may be in the reading.
 *
 * A text block is a free-text box, and a child who pastes a paragraph (or a
 * whole web page) into one produces a single "Hiện chữ …" line that runs to
 * thousands of characters. The reading is for a teacher to grasp the shape of
 * the program; a hundred characters is enough to see what the block says, and
 * the full value is still one tab away in the raw XML.
 */
const GIOI_HAN_CHU = 100;

/** Cap a field value for display, marking the cut so it cannot pass as whole. */
function catNgan(chu: string): string {
  return chu.length > GIOI_HAN_CHU ? chu.slice(0, GIOI_HAN_CHU) + '…' : chu;
}

const THUC_THE: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function giaiMa(s: string): string {
  if (!s.includes('&')) return s;

  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (tron, ma: string) => {
    if (ma.startsWith('#')) {
      const so = ma.startsWith('#x') ? parseInt(ma.slice(2), 16) : parseInt(ma.slice(1), 10);
      // Reject anything that is not a plain character: a lone surrogate or an
      // out-of-range code point would throw out of `fromCodePoint`.
      if (!Number.isFinite(so) || so < 0x20 || so > 0x10ffff) return tron;
      try {
        return String.fromCodePoint(so);
      } catch {
        return tron;
      }
    }
    return THUC_THE[ma.toLowerCase()] ?? tron;
  });
}

/**
 * Find the `>` that closes a tag, ignoring any inside a quoted attribute.
 *
 * `indexOf('>')` is wrong here and wrong in a way that only shows up on real
 * data: `<field name="TEXT">a > b</field>` is fine, but an attribute holding
 * `>` would cut the tag in half and everything after it would parse as
 * nonsense.
 */
function cuoiThe(nguon: string, tu: number): number {
  let trongNhay: string | null = null;

  for (let k = tu; k < nguon.length; k++) {
    const c = nguon[k]!;
    if (trongNhay) {
      if (c === trongNhay) trongNhay = null;
      continue;
    }
    if (c === '"' || c === "'") {
      trongNhay = c;
      continue;
    }
    if (c === '>') return k;
  }
  return -1;
}

const RE_THUOC_TINH = /([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

function docThuocTinh(than: string): Record<string, string> {
  const ra: Record<string, string> = {};
  RE_THUOC_TINH.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = RE_THUOC_TINH.exec(than)) !== null) {
    ra[m[1]!.toLowerCase()] = giaiMa(m[3] ?? m[4] ?? '');
  }
  return ra;
}

/** Parse to a tree, or null if the input is not usable XML. Never throws. */
function phanTichXml(nguon: string): NutXml | null {
  const goc: NutXml = { ten: '#goc', thuocTinh: {}, con: [], chu: '' };
  const ngan: NutXml[] = [goc];
  let i = 0;
  let dem = 0;

  while (i < nguon.length) {
    const mo = nguon.indexOf('<', i);
    if (mo === -1) break;

    if (mo > i) {
      const text = nguon.slice(i, mo);
      if (text.trim()) ngan[ngan.length - 1]!.chu += giaiMa(text);
    }

    // Comments, declarations and doctypes are stepped over whole.
    if (nguon.startsWith('<!--', mo)) {
      const het = nguon.indexOf('-->', mo + 4);
      i = het === -1 ? nguon.length : het + 3;
      continue;
    }
    if (nguon.startsWith('<?', mo) || nguon.startsWith('<!', mo)) {
      const het = cuoiThe(nguon, mo);
      i = het === -1 ? nguon.length : het + 1;
      continue;
    }

    const dong = cuoiThe(nguon, mo);
    if (dong === -1) break;

    const benTrong = nguon.slice(mo + 1, dong);
    i = dong + 1;

    if (benTrong.startsWith('/')) {
      if (ngan.length > 1) ngan.pop();
      continue;
    }

    const tuDong = benTrong.trimEnd().endsWith('/');
    const than = tuDong ? benTrong.trimEnd().slice(0, -1) : benTrong;

    const ten = /^([A-Za-z_][\w.:-]*)/.exec(than);
    if (!ten) continue;

    dem += 1;
    if (dem > GIOI_HAN_NUT) return null;

    const nut: NutXml = {
      ten: ten[1]!.toLowerCase(),
      thuocTinh: docThuocTinh(than.slice(ten[1]!.length)),
      con: [],
      chu: '',
    };
    ngan[ngan.length - 1]!.con.push(nut);

    if (!tuDong) {
      if (ngan.length >= GIOI_HAN_SAU_XML) return null;
      ngan.push(nut);
    }
  }

  return goc.con.find((n) => n.ten === 'xml') ?? goc.con[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Blockly shapes
// ═══════════════════════════════════════════════════════════════════════════

function con(nut: NutXml, ten: string): NutXml[] {
  return nut.con.filter((c) => c.ten === ten);
}

/**
 * `<field name="X">v</field>` → `{ X: 'v' }`.
 *
 * Every value is capped here, at the one place all of them pass through, so
 * a pasted paragraph is cut before it can reach any sentence. The 5×5 LED
 * grid is the exception: it is data that becomes cells, never a text run, and
 * cutting it would silently redraw the child's picture.
 */
function truong(khoi: NutXml): Record<string, string> {
  const ra: Record<string, string> = {};
  for (const f of con(khoi, 'field')) {
    const ten = f.thuocTinh['name'];
    if (!ten) continue;
    const khoa = ten.toUpperCase();
    ra[khoa] = khoa === 'LEDS' ? f.chu.trim() : catNgan(f.chu.trim());
  }
  return ra;
}

/**
 * The block plugged into a socket.
 *
 * A `<value>` holds a `<shadow>` — the greyed default MakeCode puts there —
 * and, when the student dropped something in, a `<block>` as well. The real
 * block wins; reading the shadow would report the default the child replaced.
 */
function trongO(o: NutXml | undefined): NutXml | undefined {
  if (!o) return undefined;
  return con(o, 'block')[0] ?? con(o, 'shadow')[0];
}

/**
 * A socket by name, compared WITHOUT case.
 *
 * MakeCode is inconsistent about this and both conventions appear on blocks
 * the curriculum teaches: `<value name="text">` on `basic_show_string`,
 * `<value name="IF0">` on `controls_if`. Matching exactly meant every
 * lowercase socket came back empty, and `basic_show_string` — the first block
 * in the whole course — read as "Hiện chữ …" with the child's text missing.
 */
function oTen(nut: NutXml, ten: string): NutXml | undefined {
  const can = ten.toUpperCase();
  return nut.con.find((c) => c.thuocTinh['name']?.toUpperCase() === can);
}

function giaTri(khoi: NutXml, ...ten: string[]): NutXml | undefined {
  for (const t of ten) {
    const found = trongO(oTen({ ...khoi, con: con(khoi, 'value') }, t));
    if (found) return found;
  }
  return undefined;
}

function thanKhoi(khoi: NutXml, ten: string): NutXml | undefined {
  const s = oTen({ ...khoi, con: con(khoi, 'statement') }, ten);
  return s ? con(s, 'block')[0] : undefined;
}

/** The next block down the same stack. */
function keTiep(khoi: NutXml): NutXml | undefined {
  const n = con(khoi, 'next')[0];
  return n ? con(n, 'block')[0] : undefined;
}

function loaiKhoi(khoi: NutXml): string {
  return (khoi.thuocTinh['type'] ?? '').trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Vocabulary
// ═══════════════════════════════════════════════════════════════════════════

const NUT_BAM: Record<string, string> = {
  'Button.A': 'A',
  'Button.B': 'B',
  'Button.AB': 'A+B',
};

const CU_CHI: Record<string, string> = {
  'Gesture.Shake': 'lắc bảng mạch',
  'Gesture.LogoUp': 'dựng logo lên',
  'Gesture.LogoDown': 'úp logo xuống',
  'Gesture.ScreenUp': 'ngửa màn hình lên',
  'Gesture.ScreenDown': 'úp màn hình xuống',
  'Gesture.TiltLeft': 'nghiêng sang trái',
  'Gesture.TiltRight': 'nghiêng sang phải',
  'Gesture.FreeFall': 'thả rơi',
  'Gesture.ThreeG': 'lắc mạnh (3G)',
};

/** Icons the curriculum uses, with the picture a teacher is looking for. */
const HINH: Record<string, string> = {
  Happy: '🙂 mặt cười',
  Sad: '🙁 mặt buồn',
  Heart: '❤️ trái tim',
  SmallHeart: '🤍 trái tim nhỏ',
  Yes: '✔️ dấu đúng',
  No: '✖️ dấu sai',
  Asleep: '😴 mặt ngủ',
  Confused: '😕 mặt bối rối',
  Angry: '😠 mặt giận',
  Surprised: '😮 mặt ngạc nhiên',
  Silly: '😜 mặt nghịch',
  Fabulous: '😎 mặt đeo kính',
  Meh: '😐 mặt bình thường',
  Duck: '🦆 con vịt',
  House: '🏠 ngôi nhà',
  Ghost: '👻 con ma',
  Skull: '💀 đầu lâu',
  Umbrella: '☂️ cái ô',
  Snake: '🐍 con rắn',
  Rabbit: '🐰 con thỏ',
  Cow: '🐮 con bò',
  Butterfly: '🦋 con bướm',
  StickFigure: '🧍 hình người',
  Giraffe: '🦒 hươu cao cổ',
  Tortoise: '🐢 con rùa',
  TShirt: '👕 cái áo',
  Rollerskate: '🛼 giày trượt',
  Sword: '🗡️ thanh kiếm',
  Target: '🎯 cái bia',
  Triangle: '△ hình tam giác',
  Diamond: '◇ hình thoi',
  SmallDiamond: '◊ hình thoi nhỏ',
  Square: '□ hình vuông',
  SmallSquare: '▫️ hình vuông nhỏ',
  Chessboard: '▩ bàn cờ',
  Scissors: '✂️ cái kéo',
};

const MUI_TEN: Record<string, string> = {
  North: '↑ lên',
  NorthEast: '↗ chéo lên phải',
  East: '→ sang phải',
  SouthEast: '↘ chéo xuống phải',
  South: '↓ xuống',
  SouthWest: '↙ chéo xuống trái',
  West: '← sang trái',
  NorthWest: '↖ chéo lên trái',
};

const SO_SANH: Record<string, string> = {
  EQ: '=',
  NEQ: '≠',
  LT: '<',
  LTE: '≤',
  GT: '>',
  GTE: '≥',
};

const PHEP_TINH: Record<string, string> = {
  ADD: '+',
  MINUS: '−',
  MULTIPLY: '×',
  DIVIDE: '÷',
  POWER: '^',
};

const TRUC: Record<string, string> = {
  'Dimension.X': 'trục X',
  'Dimension.Y': 'trục Y',
  'Dimension.Z': 'trục Z',
  'Dimension.Strength': 'tổng lực',
};

/** Strip the MakeCode namespace off an enum value: `IconNames.Happy` → `Happy`. */
function boTienTo(v: string): string {
  const cham = v.lastIndexOf('.');
  return cham === -1 ? v : v.slice(cham + 1);
}

/**
 * A readable name for a block we have no translation for.
 *
 * `basic_show_ambient_light` → `show ambient light`. English, because that is
 * what is written on the block in the editor the student used — translating it
 * loosely would be worse than leaving the label the teacher can point at.
 */
function tenKhoiLa(loai: string): string {
  const s = loai
    .replace(
      /^(pxt-|pxt_|device_|basic_|led_|input_|music_|radio_|pins_|game_|controls_|control_|logic_|math_|text_|variables_)/,
      '',
    )
    .replace(/[_-]+/g, ' ')
    .trim();
  return s || loai || 'khối không rõ';
}

// ═══════════════════════════════════════════════════════════════════════════
// Expressions — the things that plug INTO a socket
// ═══════════════════════════════════════════════════════════════════════════

function bieuThuc(khoi: NutXml | undefined, sau = 0): string {
  if (!khoi || sau > 12) return '…';

  const loai = loaiKhoi(khoi);
  const f = truong(khoi);
  const v = (...ten: string[]): string => bieuThuc(giaTri(khoi, ...ten), sau + 1);

  switch (loai) {
    case 'math_number':
    case 'math_integer':
    case 'math_whole_number':
      return f['NUM'] || '0';

    case 'text':
      return `“${f['TEXT'] ?? ''}”`;

    case 'logic_boolean':
      return f['BOOL'] === 'FALSE' ? 'sai' : 'đúng';

    case 'variables_get':
      return f['VAR'] || 'biến';

    case 'math_arithmetic':
      return `${v('A')} ${PHEP_TINH[f['OP'] ?? ''] ?? '?'} ${v('B')}`;

    case 'math_modulo':
      return `${v('DIVIDEND')} chia lấy dư ${v('DIVISOR')}`;

    case 'math_op2':
      return `${f['OP'] === 'min' ? 'số nhỏ hơn' : 'số lớn hơn'} trong ${v('x')} và ${v('y')}`;

    case 'math_op3':
      return `trị tuyệt đối của ${v('x')}`;

    case 'logic_compare':
      return `${v('A')} ${SO_SANH[f['OP'] ?? ''] ?? '?'} ${v('B')}`;

    case 'logic_operation':
      return `${v('A')} ${f['OP'] === 'OR' ? 'hoặc' : 'và'} ${v('B')}`;

    case 'logic_negate':
      return `không phải ${v('BOOL')}`;

    case 'device_random':
    case 'math_js_random':
      return `số ngẫu nhiên từ 0 đến ${v('limit')}`;

    case 'math_random_int':
      return `số ngẫu nhiên từ ${v('from')} đến ${v('to')}`;

    case 'device_temperature':
      return 'nhiệt độ';

    case 'device_get_light_level':
      return 'độ sáng';

    case 'device_get_sound_level':
      return 'độ ồn';

    case 'device_get_acceleration':
      return `gia tốc ${TRUC[f['NAME'] ?? ''] ?? boTienTo(f['NAME'] ?? '')}`;

    case 'device_get_button_state':
      return `nút ${NUT_BAM[f['NAME'] ?? ''] ?? boTienTo(f['NAME'] ?? '')} đang được nhấn`;

    case 'device_is_gesture':
      return `đang ${CU_CHI[f['NAME'] ?? ''] ?? boTienTo(f['NAME'] ?? '')}`;

    case 'device_running_time':
      return 'thời gian đã chạy';

    case 'radio_datagram_received_number':
    case 'radio_received_number':
      return 'số vừa nhận được';

    case 'radio_datagram_received_string':
    case 'radio_received_string':
      return 'chữ vừa nhận được';

    case 'radio_datagram_rssi':
      return 'độ mạnh sóng';

    case 'text_join':
      return `${v('A')} nối với ${v('B')}`;

    case 'text_length':
      return `độ dài của ${v('VALUE')}`;

    case 'device_get_digital_pin':
      return `chân ${boTienTo(f['NAME'] ?? '')} (số)`;

    case 'device_get_analog_pin':
      return `chân ${boTienTo(f['NAME'] ?? '')} (tương tự)`;

    default: {
      // Unknown expression: name the block, then read out whatever it holds so
      // the shape of the program still comes across.
      const phan = [
        ...Object.values(f).filter(Boolean),
        ...con(khoi, 'value').map((o) => bieuThuc(trongO(o), sau + 1)),
      ].filter((p) => p !== '…');

      const ten = `«${tenKhoiLa(loai)}»`;
      return phan.length > 0 ? `${ten} (${phan.join(', ')})` : ten;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Statements — the readable program
// ═══════════════════════════════════════════════════════════════════════════

/** One line of the reading. */
export interface DongKhoi {
  /** Indent level. 0 is a top-level stack. */
  sau: number;
  /** Emoji marker for the kind of step. Decorative — never the only signal. */
  icon: string;
  /** The Vietnamese reading of this block. Plain text. */
  chu: string;
  /** The MakeCode block id, shown on hover so the label can be traced back. */
  loai: string;
  /**
   * The 5×5 LED picture, when the block draws one. Rendered as a grid rather
   * than described in words: "hiện hình tự vẽ" tells a teacher nothing, and
   * the picture is the entire content of the block.
   */
  luoi?: boolean[][];
}

export interface BanDocKhoi {
  /** The program, in reading order. Empty when nothing could be read. */
  dong: DongKhoi[];
  /** How many blocks the workspace contains, however many we could translate. */
  soKhoi: number;
  /** Variables the student declared, in the order MakeCode listed them. */
  bien: string[];
  /**
   * Why there is nothing to show, in Vietnamese, or null when the reading
   * succeeded. The caller falls back to the raw text when this is set.
   */
  loi: string | null;
}

/** Parse the 5×5 `LEDS` field MakeCode writes for a hand-drawn picture. */
function docLuoi(gia: string | undefined): boolean[][] | undefined {
  if (!gia) return undefined;

  // MakeCode wraps the grid in backticks on their own lines; only a line that
  // holds at least one cell (`.` or `#`) is a row of the picture.
  const hang = gia
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => /[.#]/.test(d))
    .map((d) => d.split(/\s+/).map((o) => o === '#'));

  return hang.length > 0 ? hang : undefined;
}

interface BoiCanh {
  ra: DongKhoi[];
  dem: { khoi: number };
}

function them(
  bc: BoiCanh,
  sau: number,
  icon: string,
  chu: string,
  loai: string,
  luoi?: boolean[][],
): void {
  bc.ra.push(luoi ? { sau, icon, chu, loai, luoi } : { sau, icon, chu, loai });
}

/**
 * Read one stack of blocks, top to bottom, following `<next>`.
 *
 * Iterative down the stack and recursive into bodies: a long `forever` loop is
 * a hundred-deep `<next>` chain, and recursing on it would be a stack overflow
 * on a student's homework.
 */
function docChuoi(dau: NutXml | undefined, sau: number, bc: BoiCanh): void {
  let khoi = dau;
  let vong = 0;

  while (khoi && vong < GIOI_HAN_NUT && sau < GIOI_HAN_SAU) {
    vong += 1;
    docMotKhoi(khoi, sau, bc);
    khoi = keTiep(khoi);
  }
}

function docMotKhoi(khoi: NutXml, sau: number, bc: BoiCanh): void {
  bc.dem.khoi += 1;

  const loai = loaiKhoi(khoi);
  const f = truong(khoi);
  const v = (...ten: string[]): string => bieuThuc(giaTri(khoi, ...ten));
  const than = (ten: string, tiep = sau + 1): void => docChuoi(thanKhoi(khoi, ten), tiep, bc);

  switch (loai) {
    // ── Hats: when the program runs ────────────────────────────────────────
    case 'pxt-on-start':
      them(bc, sau, '▶️', 'Khi bắt đầu', loai);
      than('HANDLER');
      return;

    case 'device_forever':
    case 'forever':
      them(bc, sau, '🔁', 'Lặp đi lặp lại mãi', loai);
      than('HANDLER');
      return;

    case 'device_button_event':
      them(
        bc,
        sau,
        '🔘',
        `Khi nhấn nút ${NUT_BAM[f['NAME'] ?? ''] ?? boTienTo(f['NAME'] ?? '')}`,
        loai,
      );
      than('HANDLER');
      return;

    case 'device_gesture_event':
      them(bc, sau, '🤾', `Khi ${CU_CHI[f['NAME'] ?? ''] ?? boTienTo(f['NAME'] ?? '')}`, loai);
      than('HANDLER');
      return;

    case 'device_pin_event':
      them(bc, sau, '📌', `Khi chạm chân ${boTienTo(f['NAME'] ?? '')}`, loai);
      than('HANDLER');
      return;

    case 'radio_on_datagram_received':
    case 'radio_on_number_drag':
    case 'radio_on_received_number':
      them(bc, sau, '📻', 'Khi nhận được số qua sóng radio', loai);
      than('HANDLER');
      return;

    case 'radio_on_string_drag':
    case 'radio_on_received_string':
      them(bc, sau, '📻', 'Khi nhận được chữ qua sóng radio', loai);
      than('HANDLER');
      return;

    // ── Showing things ─────────────────────────────────────────────────────
    case 'basic_show_string':
      them(bc, sau, '🔤', `Hiện chữ ${v('text')}`, loai);
      return;

    case 'basic_show_number':
      them(bc, sau, '🔢', `Hiện số ${v('number')}`, loai);
      return;

    case 'basic_show_icon':
      them(
        bc,
        sau,
        '🖼️',
        `Hiện hình ${HINH[boTienTo(f['I'] ?? '')] ?? boTienTo(f['I'] ?? '')}`,
        loai,
      );
      return;

    case 'basic_show_arrow':
      them(
        bc,
        sau,
        '➡️',
        `Hiện mũi tên ${MUI_TEN[boTienTo(f['I'] ?? '')] ?? boTienTo(f['I'] ?? '')}`,
        loai,
      );
      return;

    case 'basic_show_leds':
      them(bc, sau, '💡', 'Hiện hình em tự vẽ', loai, docLuoi(f['LEDS']));
      return;

    case 'basic_clear_screen':
      them(bc, sau, '🧹', 'Xoá màn hình', loai);
      return;

    case 'basic_pause':
      them(bc, sau, '⏸️', `Chờ ${v('pause')} mili giây`, loai);
      return;

    case 'device_plot':
    case 'led_plot':
      them(bc, sau, '💡', `Bật đèn ở cột ${v('x')}, hàng ${v('y')}`, loai);
      return;

    case 'device_unplot':
    case 'led_unplot':
      them(bc, sau, '🌑', `Tắt đèn ở cột ${v('x')}, hàng ${v('y')}`, loai);
      return;

    case 'device_toggle':
    case 'led_toggle':
      them(bc, sau, '🔀', `Đảo đèn ở cột ${v('x')}, hàng ${v('y')}`, loai);
      return;

    // ── Variables ──────────────────────────────────────────────────────────
    case 'variables_set':
      them(bc, sau, '📦', `Đặt ${f['VAR'] || 'biến'} bằng ${v('VALUE')}`, loai);
      return;

    case 'variables_change':
      them(bc, sau, '➕', `Tăng ${f['VAR'] || 'biến'} thêm ${v('VALUE')}`, loai);
      return;

    // ── Control flow ───────────────────────────────────────────────────────
    case 'controls_if': {
      const mutation = con(khoi, 'mutation')[0];
      const soElseIf = Number(mutation?.thuocTinh['elseif'] ?? 0) || 0;
      const coElse = (mutation?.thuocTinh['else'] ?? '0') !== '0';

      them(bc, sau, '❓', `Nếu ${v('IF0')} thì`, loai);
      than('DO0');

      for (let k = 1; k <= Math.min(soElseIf, 20); k++) {
        them(bc, sau, '❔', `Nếu không, mà ${bieuThuc(giaTri(khoi, `IF${k}`))} thì`, loai);
        than(`DO${k}`);
      }

      if (coElse) {
        them(bc, sau, '↪️', 'Nếu không thì', loai);
        than('ELSE');
      }
      return;
    }

    case 'controls_repeat_ext':
    case 'controls_repeat':
      them(bc, sau, '🔂', `Lặp lại ${v('TIMES')} lần`, loai);
      than('DO');
      return;

    case 'device_while':
    case 'controls_whileUntil':
      them(bc, sau, '🔄', `Trong khi ${v('COND')} thì`, loai);
      than('DO');
      return;

    case 'controls_simple_for':
    case 'pxt_controls_for':
      them(bc, sau, '🔢', `Cho ${f['VAR'] || 'i'} chạy từ 0 đến ${v('TO')}`, loai);
      than('DO');
      return;

    // ── Radio ──────────────────────────────────────────────────────────────
    case 'radio_set_group':
      them(bc, sau, '📡', `Đặt nhóm radio là ${v('ID')}`, loai);
      return;

    case 'radio_datagram_send':
    case 'radio_send_number':
      them(bc, sau, '📤', `Gửi số ${v('value', 'NUM')} qua radio`, loai);
      return;

    case 'radio_send_string':
      them(bc, sau, '📤', `Gửi chữ ${v('msg', 'TEXT')} qua radio`, loai);
      return;

    case 'radio_send_value':
      them(bc, sau, '📤', `Gửi “${f['NAME'] ?? ''}” kèm giá trị ${v('value')} qua radio`, loai);
      return;

    // ── Music ──────────────────────────────────────────────────────────────
    case 'device_play_note':
    case 'music_play_tone':
      them(bc, sau, '🎵', `Phát nốt ${v('note')} trong ${v('duration')}`, loai);
      return;

    case 'music_start_melody':
    case 'device_start_melody':
      them(
        bc,
        sau,
        '🎶',
        `Bật giai điệu ${giaTri(khoi, 'melody') ? v('melody') : boTienTo(f['MELODY'] ?? '')}`,
        loai,
      );
      return;

    case 'music_rest':
      them(bc, sau, '🎼', `Nghỉ ${v('duration')}`, loai);
      return;

    // ── Pins ───────────────────────────────────────────────────────────────
    case 'device_set_digital_pin':
      them(bc, sau, '📌', `Đặt chân ${boTienTo(f['NAME'] ?? '')} bằng ${v('value')}`, loai);
      return;

    case 'device_set_analog_pin':
      them(
        bc,
        sau,
        '📌',
        `Đặt mức tương tự chân ${boTienTo(f['NAME'] ?? '')} bằng ${v('value')}`,
        loai,
      );
      return;

    case 'servo_write_pin':
      them(
        bc,
        sau,
        '🦾',
        `Quay servo ở chân ${boTienTo(f['NAME'] ?? '')} tới ${v('value')} độ`,
        loai,
      );
      return;

    default: {
      /*
       * A block outside the dictionary. Named, with its arguments read out and
       * its bodies walked — a teacher gets the shape of the program and the
       * name on the block, which is enough to go and look at it.
       */
      const doiSo = [
        ...Object.entries(f).map(([k, val]) => `${k.toLowerCase()}: ${boTienTo(val)}`),
        ...con(khoi, 'value').map((o) => bieuThuc(trongO(o))),
      ].filter(Boolean);

      const ten = `«${tenKhoiLa(loai)}»`;
      them(bc, sau, '🧩', doiSo.length > 0 ? `${ten} — ${doiSo.join(', ')}` : ten, loai);

      for (const s of con(khoi, 'statement')) {
        docChuoi(con(s, 'block')[0], sau + 1, bc);
      }
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read a MakeCode workspace.
 *
 * Always returns a value. `loi` is set when there is nothing to show, and the
 * caller falls back to the raw text — which is where the grading page was
 * before this module existed, so the worst case is no worse than the old one.
 */
export function docKhoiLenh(xml: string): BanDocKhoi {
  const trong: BanDocKhoi = { dong: [], soKhoi: 0, bien: [], loi: null };

  if (!xml || !xml.trim()) {
    return { ...trong, loi: 'Học sinh nộp bài với vùng làm việc trống.' };
  }
  if (!xml.includes('<')) {
    return { ...trong, loi: 'Bài nộp này không phải là vùng làm việc MakeCode.' };
  }

  let goc: NutXml | null = null;
  try {
    goc = phanTichXml(xml);
  } catch {
    // Belt and braces: the parser is written not to throw, and a grading page
    // is not the place to find out it does.
    goc = null;
  }

  if (!goc) {
    return { ...trong, loi: 'Không đọc được cấu trúc khối lệnh của bài nộp này.' };
  }

  const bien = con(goc, 'variables')
    .flatMap((v) => con(v, 'variable'))
    .map((v) => catNgan(v.chu.trim()))
    .filter(Boolean);

  const bc: BoiCanh = { ra: [], dem: { khoi: 0 } };
  for (const khoi of con(goc, 'block')) {
    docChuoi(khoi, 0, bc);
  }

  if (bc.ra.length === 0) {
    return {
      ...trong,
      bien,
      loi: 'Vùng làm việc không có khối lệnh nào — em mở trình soạn rồi nộp mà chưa kéo khối ra.',
    };
  }

  return { dong: bc.ra, soKhoi: bc.dem.khoi, bien, loi: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// Raw XML, coloured
// ═══════════════════════════════════════════════════════════════════════════

export type LoaiManh = 'the' | 'thuoc-tinh' | 'gia-tri' | 'chu' | 'dau';

/** One coloured run of the raw XML. */
export interface ManhXml {
  loai: LoaiManh;
  chu: string;
}

/**
 * Split raw XML into coloured runs for the "XML gốc" tab.
 *
 * A tokeniser rather than a highlighter library, and it emits DATA, not HTML:
 * the renderer maps each run to a `<span>` with a class. The one place a
 * teacher reads a string a student produced is the last place to introduce an
 * HTML-string pipeline — same reasoning as `lib/markdown.tsx`.
 *
 * Unrecognised input is never dropped: anything the scanner cannot classify
 * comes back as a `chu` run, so the output always concatenates back to the
 * exact input.
 */
export function toMauXml(xml: string): ManhXml[] {
  const ra: ManhXml[] = [];
  const day = (loai: LoaiManh, chu: string): void => {
    if (!chu) return;
    const cuoi = ra[ra.length - 1];
    if (cuoi && cuoi.loai === loai) cuoi.chu += chu;
    else ra.push({ loai, chu });
  };

  let i = 0;
  let vong = 0;

  while (i < xml.length && vong < GIOI_HAN_NUT * 4) {
    vong += 1;

    const mo = xml.indexOf('<', i);
    if (mo === -1) {
      day('chu', xml.slice(i));
      break;
    }

    day('chu', xml.slice(i, mo));

    const dong = cuoiThe(xml, mo);
    if (dong === -1) {
      day('chu', xml.slice(mo));
      break;
    }

    const the = xml.slice(mo, dong + 1);
    i = dong + 1;

    const ten = /^<\/?\s*([A-Za-z_][\w.:-]*)/.exec(the);
    if (!ten) {
      day('chu', the);
      continue;
    }

    const cuoiTen = ten[0].length;
    day('dau', the.slice(0, cuoiTen - ten[1]!.length));
    day('the', ten[1]!);

    // Attributes, then whatever punctuation sits between them.
    const phan = the.slice(cuoiTen);
    RE_THUOC_TINH.lastIndex = 0;
    let truoc = 0;
    let m: RegExpExecArray | null;

    while ((m = RE_THUOC_TINH.exec(phan)) !== null) {
      day('dau', phan.slice(truoc, m.index));
      day('thuoc-tinh', m[1]!);
      day('dau', '=');
      day('gia-tri', m[2]!);
      truoc = m.index + m[0].length;
    }
    day('dau', phan.slice(truoc));
  }

  return ra;
}
