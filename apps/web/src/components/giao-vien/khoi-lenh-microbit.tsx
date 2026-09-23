'use client';

import { useId, useMemo, useState } from 'react';

import { docKhoiLenh, toMauXml, type DongKhoi, type LoaiManh } from '@/lib/khoi-makecode';

/**
 * What a teacher sees instead of raw Blockly XML.
 *
 * ── What changed and why ─────────────────────────────────────────────────────
 * This panel used to render `blocksXml` into a `<pre>`. That is the literal
 * truth about the submission and it is also unreadable: a two-minute Buổi 1
 * program is forty lines of `<value name="text"><shadow type="text">`. The one
 * thing a MAKECODE problem asks of a teacher is that they read the logic, and
 * a panel nobody can read turns marking into a coin toss.
 *
 * So the default view is the program, read out in Vietnamese and indented the
 * way it nests. The XML is still here, one tab away, coloured and wrapped —
 * because the reading is an interpretation and the bytes are the record. A
 * teacher who wants to check what was really handed in must never have to take
 * our word for it.
 *
 * ── Why a `<pre>` still, for the XML ─────────────────────────────────────────
 * `whitespace-pre-wrap`: MakeCode writes very long lines, and a horizontal
 * scrollbar inside a review panel hides the end of every one of them.
 */
export function KhoiLenhMicrobit({
  blocksXml,
  coTepHex,
  hrefTepHex,
}: {
  blocksXml: string;
  /** True when the student handed in a compiled .hex instead of a workspace. */
  coTepHex?: boolean;
  hrefTepHex?: string | undefined;
}) {
  const id = useId();
  const [tab, setTab] = useState<'doc' | 'xml'>('doc');

  // Parsing is pure and the input never changes for a given submission.
  const banDoc = useMemo(() => docKhoiLenh(blocksXml), [blocksXml]);

  /*
   * A .hex hand-in has no workspace at all — `blocksXml` is the note
   * `nopBaiMicrobitHex` wrote. Showing the reader's "không đọc được" against
   * that would be telling the teacher something is broken when nothing is.
   */
  if (coTepHex) {
    return (
      <div className="rounded-the border border-vien bg-the p-5">
        <h3 className="mt-0 mb-2 text-base font-bold">Em nộp bằng tệp .hex</h3>
        <p className="mt-0 mb-4 text-sm text-chu-phu">
          Bài này nộp thẳng tệp .hex đã biên dịch, nên không có khối lệnh để đọc ở đây. Thầy cô tải
          về rồi nạp vào board để xem chương trình chạy thế nào.
        </p>
        <p className="m-0 rounded-nut bg-the-mo p-3 font-mono text-sm break-words">{blocksXml}</p>
        {hrefTepHex ? (
          <a
            href={hrefTepHex}
            className="mt-4 inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
          >
            <span aria-hidden="true">⬇</span>
            Tải tệp .hex của em
          </a>
        ) : null}
      </div>
    );
  }

  const doDuoc = banDoc.loi === null;

  return (
    <div className="rounded-the border border-vien bg-the">
      <div
        role="tablist"
        aria-label="Cách xem bài nộp"
        className="flex gap-1 border-b border-vien px-3 pt-3"
      >
        <Tab
          id={`${id}-doc`}
          bang={`${id}-bang-doc`}
          chon={tab === 'doc'}
          onChon={() => setTab('doc')}
        >
          Đọc chương trình
        </Tab>
        <Tab
          id={`${id}-xml`}
          bang={`${id}-bang-xml`}
          chon={tab === 'xml'}
          onChon={() => setTab('xml')}
        >
          XML gốc
        </Tab>
      </div>

      {tab === 'doc' ? (
        <div id={`${id}-bang-doc`} role="tabpanel" aria-labelledby={`${id}-doc`} className="p-4">
          {doDuoc ? (
            <>
              <p className="mt-0 mb-3 text-sm break-words font-medium text-chu-nhat">
                {banDoc.soKhoi} khối lệnh
                {banDoc.bien.length > 0 ? ` · biến em dùng: ${banDoc.bien.join(', ')}` : ''} · đây
                là cách hệ thống đọc bài của em, bấm “XML gốc” để xem nguyên văn.
              </p>
              <ol className="m-0 list-none space-y-0.5 p-0">
                {banDoc.dong.map((d, k) => (
                  <DongDoc key={k} dong={d} />
                ))}
              </ol>
            </>
          ) : (
            <>
              <p className="mt-0 mb-3 rounded-nut bg-thu-lai-nen p-3 text-sm text-thu-lai">
                {banDoc.loi}
              </p>
              <p className="m-0 text-sm font-medium text-chu-nhat">
                Nguyên văn bài nộp vẫn còn nguyên ở tab “XML gốc”.
              </p>
            </>
          )}
        </div>
      ) : (
        <div id={`${id}-bang-xml`} role="tabpanel" aria-labelledby={`${id}-xml`}>
          <XmlToMau xml={blocksXml} />
        </div>
      )}
    </div>
  );
}

function Tab({
  id,
  bang,
  chon,
  onChon,
  children,
}: {
  id: string;
  bang: string;
  chon: boolean;
  onChon: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={chon}
      aria-controls={bang}
      onClick={onChon}
      className={`min-h-cham rounded-t-nut border-b-2 px-4 py-2 text-sm font-semibold ${
        chon
          ? 'border-chinh text-chinh-sang'
          : 'border-transparent text-chu-phu hover:border-vien-dam hover:text-chu'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * One step of the program.
 *
 * The indent is a left border per level rather than leading spaces: a teacher
 * scanning a nested `forever` needs the structure to be visible at a glance,
 * and spaces collapse the moment the line wraps on a tablet.
 */
function DongDoc({ dong }: { dong: DongKhoi }) {
  // Capped so a pathologically nested workspace cannot push the text off-screen.
  const lui = Math.min(dong.sau, 8);

  return (
    <li className="flex" style={{ paddingInlineStart: `${lui * 1.25}rem` }}>
      <div
        className={`flex min-w-0 flex-1 items-start gap-2 rounded-nut px-2 py-1 ${
          lui > 0 ? 'border-s-2 border-vien ps-3' : ''
        }`}
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0 leading-none">
          {dong.icon}
        </span>
        <div className="min-w-0 flex-1">
          {/*
            The parser already caps each field at a hundred characters, but a
            block can hold several fields and a `text_join` chain can hold
            several blocks. `line-clamp-3` is the floor under the layout: no
            single step may grow past three lines, whatever was pasted into it.
            `whitespace-pre-wrap` keeps a deliberate line break in a text block
            visible instead of collapsing it, and `break-words` stops an unbroken
            run (a URL, a keyboard mash) from widening the panel.
          */}
          <span
            className="block text-base break-words whitespace-pre-wrap line-clamp-3"
            title={dong.loai}
          >
            {dong.chu}
          </span>
          {dong.luoi ? <LuoiLed luoi={dong.luoi} /> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The 5×5 picture a student drew, drawn.
 *
 * `basic_show_leds` IS its grid — "hiện hình em tự vẽ" tells a teacher nothing
 * about whether the child drew the smiley the task asked for. The alt text
 * carries the same information for a screen reader.
 */
function LuoiLed({ luoi }: { luoi: boolean[][] }) {
  const mo = luoi.flat().filter(Boolean).length;

  return (
    <div
      className="mt-1.5 inline-grid gap-0.5 rounded-nut bg-chu p-1.5"
      style={{ gridTemplateColumns: `repeat(${luoi[0]?.length ?? 5}, 0.55rem)` }}
      role="img"
      aria-label={`Hình 5×5 với ${mo} đèn sáng`}
    >
      {luoi.flatMap((hang, y) =>
        hang.map((sang, x) => (
          <span
            key={`${y}-${x}`}
            // A literal red rather than `--color-loi`: this is a picture of the
            // board's own LEDs, not an error state, and the token carries the
            // meaning "something went wrong" everywhere else in the app.
            className={`block rounded-[2px] ${sang ? 'bg-[#f43f5e]' : 'bg-vien-dam/25'}`}
            style={{ height: '0.55rem', width: '0.55rem' }}
          />
        )),
      )}
    </div>
  );
}

const MAU: Record<LoaiManh, string> = {
  the: 'text-[#7dd3fc]',
  'thuoc-tinh': 'text-[#c4b5fd]',
  'gia-tri': 'text-[#86efac]',
  chu: 'text-[#fde68a]',
  dau: 'text-[#94a3b8]',
};

/**
 * The raw workspace, coloured.
 *
 * The tokeniser returns DATA and this maps it to `<span>`s, so nothing a
 * student typed can ever become markup — same structural guarantee as the
 * markdown renderer. A highlighter that built an HTML string would be one
 * escaping bug away from stored XSS on a page teachers log into.
 */
function XmlToMau({ xml }: { xml: string }) {
  const manh = useMemo(() => toMauXml(xml), [xml]);

  return (
    <pre className="m-0 max-h-[32rem] overflow-auto rounded-b-the bg-chu p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
      <code>
        {manh.map((m, k) => (
          <span key={k} className={MAU[m.loai]}>
            {m.chu}
          </span>
        ))}
      </code>
    </pre>
  );
}
