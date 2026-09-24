'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { hienThiLuc } from '@/lib/thoi-gian';

import { Avatar } from '../ui/avatar';

import type { KetQuaDocThaoLuan, KetQuaGuiThaoLuan, TinNhanGuiDi } from '@/lib/thao-luan-data';

/**
 * Thảo luận lớp — the class group chat.
 *
 * ── Polling, and only while someone is looking ───────────────────────────────
 * Every `CHU_KY_MS` the page asks `GET /api/chat` for what arrived since its
 * newest message, and merges by id (the server deliberately re-sends a few
 * seconds of overlap — see the route). A hidden tab stops asking and catches up
 * the moment it is shown again: thirty background tabs polling a class nobody
 * is reading is load for nothing.
 *
 * ── Moderation is the server's; the page only reports it ─────────────────────
 * The composer cannot check a message — the filter, the lock and the alert all
 * happen in `POST /api/chat` before anything is saved. When it answers
 * `vi-pham`, the text is cleared (it was not sent and must not be one Enter
 * away from being sent again), a warning explains what happened and who was
 * told, and the composer is replaced by the lock notice. Orange, the warning
 * tone, not red: this is a rule with a consequence, not a system fault.
 *
 * ── Plain text, always ───────────────────────────────────────────────────────
 * Messages render as text with `whitespace-pre-wrap`. No markdown, no link
 * detection: nothing a classmate types becomes something to click.
 *
 * ── Two audiences ────────────────────────────────────────────────────────────
 * `cheDo="giao-vien"` is the teacher's view on the class page: the same feed,
 * no composer. A children's group chat that no adult can read is not shipped.
 */

const CHU_KY_MS = 5000;
/** After a failed poll, wait longer before asking again. */
const CHU_KY_LOI_MS = 15000;
/** Messages from one person closer than this are drawn as one group. */
const GOP_NHOM_MS = 5 * 60 * 1000;
/** Pixels from the bottom that still count as "reading the newest". */
const GAN_CUOI_PX = 120;
const GIOI_HAN_KY_TU = 500;

function hopNhat(cu: TinNhanGuiDi[], moi: TinNhanGuiDi[]): TinNhanGuiDi[] {
  if (moi.length === 0) return cu;
  const daCo = new Set(cu.map((t) => t.id));
  const them = moi.filter((t) => !daCo.has(t.id));
  if (them.length === 0) return cu;
  return [...cu, ...them].sort((a, b) =>
    a.luc === b.luc ? a.id.localeCompare(b.id) : a.luc.localeCompare(b.luc),
  );
}

export function KhuThaoLuan({
  lop,
  banDau,
  cheDo = 'hoc-sinh',
}: {
  lop: { id: string; ten: string };
  /** Read on the server with the page, so the first paint has the conversation. */
  banDau: KetQuaDocThaoLuan;
  cheDo?: 'hoc-sinh' | 'giao-vien';
}) {
  const id = useId();
  const [tinNhan, setTinNhan] = useState(banDau.tinNhan);
  const [coTheGui, setCoTheGui] = useState(banDau.coTheGui);
  const [biKhoa, setBiKhoa] = useState(banDau.biKhoa);
  const [daLuuTru, setDaLuuTru] = useState(banDau.daLuuTru);
  const [soanThao, setSoanThao] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [canhBao, setCanhBao] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const [coTinMoi, setCoTinMoi] = useState(false);
  const [matKetNoi, setMatKetNoi] = useState(false);

  const oCuon = useRef<HTMLDivElement | null>(null);
  const oNhap = useRef<HTMLTextAreaElement | null>(null);
  const ganCuoi = useRef(true);
  const moiNhat = useRef<string | null>(banDau.tinNhan.at(-1)?.luc ?? null);
  const toi = banDau.toi;

  // ── Scrolling: follow the conversation unless the reader scrolled up ──────
  const cuonXuongCuoi = useCallback(() => {
    const o = oCuon.current;
    if (o) o.scrollTop = o.scrollHeight;
    setCoTinMoi(false);
  }, []);

  // Also runs on mount, which is what opens the page at the newest message.
  useEffect(() => {
    moiNhat.current = tinNhan.at(-1)?.luc ?? moiNhat.current;
    if (ganCuoi.current) cuonXuongCuoi();
    else setCoTinMoi(true);
  }, [tinNhan, cuonXuongCuoi]);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let huy = false;
    let hen: ReturnType<typeof setTimeout> | null = null;
    let dieuKhien: AbortController | null = null;

    const hoi = async (): Promise<void> => {
      if (huy) return;
      if (document.visibilityState === 'hidden') return; // resumed by the listener
      dieuKhien = new AbortController();
      let cho = CHU_KY_MS;
      try {
        const qs = new URLSearchParams({ lop: lop.id });
        if (moiNhat.current) qs.set('sau', moiNhat.current);
        const res = await fetch(`/api/chat?${qs.toString()}`, {
          cache: 'no-store',
          signal: dieuKhien.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const kq = (await res.json()) as KetQuaDocThaoLuan;
        if (huy) return;
        setTinNhan((cu) => hopNhat(cu, kq.tinNhan));
        setCoTheGui(kq.coTheGui);
        setBiKhoa(kq.biKhoa);
        setDaLuuTru(kq.daLuuTru);
        setMatKetNoi(false);
      } catch {
        if (huy) return;
        setMatKetNoi(true);
        cho = CHU_KY_LOI_MS;
      }
      if (!huy) hen = setTimeout(() => void hoi(), cho);
    };

    const khiDoiHienThi = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (hen) clearTimeout(hen);
      void hoi();
    };

    hen = setTimeout(() => void hoi(), CHU_KY_MS);
    document.addEventListener('visibilitychange', khiDoiHienThi);
    return () => {
      huy = true;
      if (hen) clearTimeout(hen);
      dieuKhien?.abort();
      document.removeEventListener('visibilitychange', khiDoiHienThi);
    };
  }, [lop.id]);

  // ── Sending ────────────────────────────────────────────────────────────────
  async function gui() {
    const noiDung = soanThao.trim();
    if (!noiDung || dangGui || !coTheGui) return;

    setDangGui(true);
    setThongBao(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lop: lop.id, noiDung }),
      });
      // Every status carries the same shape with a sentence in it; only a body
      // that will not parse at all falls through to the catch.
      const kq = (await res.json()) as KetQuaGuiThaoLuan;

      switch (kq.trangThai) {
        case 'da-gui': {
          const moi = kq.tinNhan;
          setSoanThao('');
          ganCuoi.current = true;
          if (moi) setTinNhan((cu) => hopNhat(cu, [moi]));
          break;
        }
        case 'vi-pham':
          // Not sent, and not left in the box to be sent again.
          setSoanThao('');
          setCanhBao(kq.thongDiep);
          setBiKhoa(true);
          setCoTheGui(false);
          break;
        case 'bi-khoa':
          setBiKhoa(true);
          setCoTheGui(false);
          break;
        default:
          // Kept in the box: a cooldown or a network blip is not the child's text's fault.
          setThongBao(kq.thongDiep);
      }
    } catch {
      setThongBao(
        'Không kết nối được. Em kiểm tra mạng rồi gửi lại nhé — tin nhắn vẫn còn trong ô.',
      );
    } finally {
      setDangGui(false);
      oNhap.current?.focus();
    }
  }

  const giaoVien = cheDo === 'giao-vien';

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="flex h-[min(44rem,calc(100dvh-10rem))] min-h-[26rem] flex-col overflow-hidden rounded-the border border-chinh/40 bg-be-mat shadow-[var(--shadow-neon)]"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-4 py-3 sm:px-5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-nut border border-ngoc/40 bg-nen-sau text-xl"
        >
          💬
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-tieu-de`} className="m-0 truncate text-lg font-bold">
            {lop.ten}
          </h2>
          <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-chu-nhat">
            <span
              aria-hidden="true"
              className={`inline-block size-2 rounded-full ${matKetNoi ? 'bg-thu-lai' : 'bg-dung shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`}
            />
            {matKetNoi ? 'Đang kết nối lại…' : 'Đang cập nhật'}
            {giaoVien ? ' · Chế độ xem của giáo viên' : ''}
          </p>
        </div>
      </header>

      {/* ── The house rule, stated before anyone types ───────────────────── */}
      <p className="m-0 shrink-0 border-b border-white/10 bg-nen-sau/60 px-4 py-2 text-xs font-medium text-chu-phu sm:px-5">
        <span aria-hidden="true">🛡️ </span>
        {giaoVien
          ? 'Tin nhắn có lời lẽ không phù hợp bị chặn tự động và báo ở mục Cảnh báo — học sinh không nhìn thấy chúng.'
          : 'Thầy cô của lớp đọc được mọi tin nhắn ở đây. Tin nhắn có lời lẽ không phù hợp sẽ bị chặn, và em sẽ bị khoá quyền gửi tin cùng trợ lý AI.'}
      </p>

      {/* ── The feed ─────────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={oCuon}
          role="log"
          aria-live="polite"
          aria-label={`Tin nhắn của lớp ${lop.ten}`}
          onScroll={(e) => {
            const o = e.currentTarget;
            ganCuoi.current = o.scrollHeight - o.scrollTop - o.clientHeight < GAN_CUOI_PX;
            if (ganCuoi.current) setCoTinMoi(false);
          }}
          className="nen-luoi h-full space-y-1 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {tinNhan.length === 0 ? (
            <p className="m-0 mt-8 text-center text-sm text-chu-nhat">
              {giaoVien
                ? 'Lớp chưa có tin nhắn nào.'
                : 'Chưa có ai nói gì cả. Em chào cả lớp một câu nhé! 👋'}
            </p>
          ) : (
            tinNhan.map((t, i) => {
              const truoc = tinNhan[i - 1];
              const noiTiep =
                truoc !== undefined &&
                truoc.tacGia.id === t.tacGia.id &&
                Date.parse(t.luc) - Date.parse(truoc.luc) < GOP_NHOM_MS;
              return <BongTin key={t.id} tin={t} cuaToi={t.tacGia.id === toi} noiTiep={noiTiep} />;
            })
          )}
        </div>

        {coTinMoi ? (
          <button
            type="button"
            onClick={() => {
              ganCuoi.current = true;
              cuonXuongCuoi();
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-chinh-sang/40 bg-chinh px-4 py-1.5 text-sm font-semibold text-white shadow-[var(--shadow-neon)]"
          >
            Tin nhắn mới <span aria-hidden="true">↓</span>
          </button>
        ) : null}
      </div>

      {/* ── Warnings and the composer ────────────────────────────────────── */}
      {canhBao ? (
        <p
          role="alert"
          className="m-0 shrink-0 border-t border-white/10 border-l-4 border-l-canh-bao bg-canh-bao/10 px-4 py-3 text-sm font-medium text-canh-bao-chu"
        >
          <span aria-hidden="true">⚠️ </span>
          {canhBao}
        </p>
      ) : null}

      {giaoVien ? null : biKhoa ? (
        <p
          role="status"
          className="m-0 shrink-0 border-t border-white/10 bg-thu-lai-nen px-4 py-3 text-sm font-medium text-thu-lai"
        >
          <span aria-hidden="true">🔒 </span>
          Em tạm thời không gửi được tin nhắn vì đã vi phạm quy định trò chuyện. Vui lòng liên hệ
          giáo viên để mở lại. Em vẫn đọc được tin nhắn của lớp.
        </p>
      ) : daLuuTru || !coTheGui ? (
        <p className="m-0 shrink-0 border-t border-white/10 px-4 py-3 text-sm text-chu-nhat">
          {daLuuTru
            ? 'Lớp này đã kết thúc nên không gửi thêm tin nhắn được nữa.'
            : 'Em chỉ xem được thảo luận này.'}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void gui();
          }}
          className="shrink-0 border-t border-white/10 p-3"
        >
          <div className="flex items-end gap-2">
            <label htmlFor={`${id}-o-nhap`} className="sr-only">
              Nhắn cho cả lớp
            </label>
            <textarea
              id={`${id}-o-nhap`}
              ref={oNhap}
              rows={2}
              value={soanThao}
              maxLength={GIOI_HAN_KY_TU}
              onChange={(e) => {
                setSoanThao(e.target.value);
                if (thongBao) setThongBao(null);
              }}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter is a new line — as in the tutor.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void gui();
                }
              }}
              placeholder="Nhắn cho cả lớp…"
              className="min-h-11 flex-1 resize-none rounded-nut border border-white/10 bg-nen-sau/60 px-3 py-2 text-base text-chu placeholder:text-chu-nhat focus-visible:border-chinh-sang focus-visible:ring-2 focus-visible:ring-chinh-sang/40 focus-visible:outline-hidden"
            />
            <button
              type="submit"
              disabled={dangGui || soanThao.trim() === ''}
              className="grid size-11 shrink-0 place-items-center rounded-nut bg-chinh font-semibold text-white shadow-[var(--shadow-neon)] hover:bg-chinh-dam disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <span aria-hidden="true">{dangGui ? '…' : '➤'}</span>
              <span className="sr-only">Gửi tin nhắn</span>
            </button>
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-xs font-medium text-chu-nhat">
            <span role="status">{thongBao ?? ''}</span>
            <span className="shrink-0 tabular-nums">
              {soanThao.length}/{GIOI_HAN_KY_TU}
            </span>
          </div>
        </form>
      )}
    </section>
  );
}

/**
 * One message. Mine on the right in the brand fill; everyone else's on the
 * left in a raised card with a hairline. A run of messages from one person
 * shows their face and name once.
 */
function BongTin({
  tin,
  cuaToi,
  noiTiep,
}: {
  tin: TinNhanGuiDi;
  cuaToi: boolean;
  noiTiep: boolean;
}) {
  return (
    <div
      className={`flex items-end gap-2 ${cuaToi ? 'flex-row-reverse' : ''} ${noiTiep ? '' : 'pt-3'}`}
    >
      <div className="w-8 shrink-0">
        {!noiTiep && !cuaToi ? (
          <Avatar name={tin.tacGia.ten} anh={tin.tacGia.anh} co="nho" trangTri />
        ) : null}
      </div>
      <div className={`flex max-w-[78%] min-w-0 flex-col ${cuaToi ? 'items-end' : 'items-start'}`}>
        {!noiTiep ? (
          <p className="m-0 mb-1 flex items-baseline gap-2 px-1 text-xs">
            <span className={`font-bold ${cuaToi ? 'text-chinh-sang' : 'text-chu'}`}>
              {cuaToi ? 'Em' : tin.tacGia.ten}
            </span>
            <time dateTime={tin.luc} className="font-medium text-chu-nhat">
              {hienThiLuc(tin.luc)}
            </time>
          </p>
        ) : null}
        <p
          className={`m-0 rounded-the-nho px-3.5 py-2 text-base leading-snug break-words whitespace-pre-wrap ${
            cuaToi
              ? 'rounded-ee-sm bg-chinh text-white shadow-[0_0_14px_rgba(124,58,237,0.35)]'
              : 'rounded-es-sm border border-white/10 bg-the-mo text-chu'
          }`}
        >
          {/* Screen readers hear who said it even inside a grouped run. */}
          {noiTiep ? <span className="sr-only">{cuaToi ? 'Em' : tin.tacGia.ten}: </span> : null}
          {tin.noiDung}
        </p>
      </div>
    </div>
  );
}
