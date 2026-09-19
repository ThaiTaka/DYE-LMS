'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { xoaBaiNopHexCu } from '@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions';

import { batDauChonTep, ketThucChonTep } from './tieu-diem';

import type { KetQuaNop } from '@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions';

/**
 * Hand in a .hex file by hand — the fallback when the MakeCode frame will not.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The embedded editor is a third-party page loaded from makecode.microbit.org.
 * A school network that blocks it, a browser it dislikes, an afternoon it is
 * simply down — each leaves a student with finished blocks and no way to hand
 * them in. MakeCode's own site (and its desktop app) export a .hex; this takes
 * that file and makes it a first-class submission: same attempt numbering,
 * same teacher queue, same completion.
 *
 * ── Checked twice ────────────────────────────────────────────────────────────
 * Here, before upload: extension, size, and the first byte (a .hex starts with
 * `:`). Cheap, instant, and enough to catch "I picked the wrong file" without
 * a round trip. Then on the server, fully: every record's checksum. This
 * component never claims the file is valid — only that it was worth sending.
 *
 * ── A plain POST, not a server action ────────────────────────────────────────
 * The file goes to `/api/khoi/[blockId]/hex` as multipart form data. It used
 * to go through a server action, and a server action's body is capped at 1 MB
 * by Next.js — a universal .hex is ~1.8 MB, so every real file was refused
 * before the action ran and the student was told to check their network. The
 * route handler has no such cap and answers the same `KetQuaNop` shape the
 * action did, so nothing below the request line changed.
 *
 * ── The picker pauses the focus tracker ──────────────────────────────────────
 * Opening the OS file dialog hides the tab on Android and takes focus from the
 * window everywhere. The lesson's tab-switch tracker must not count that, so
 * the click that opens the dialog flags it (`batDauChonTep`) and the dialog
 * closing — a file chosen, cancelled, or focus simply coming back — clears it.
 *
 * ── Built for a ten-year-old ─────────────────────────────────────────────────
 * One big target that is both a button and a drop zone. The chosen file is
 * named back to them in large text before they commit. Every refusal says
 * what to do next, in the second person, without the word "lỗi".
 */

const MB = 1024 * 1024;
/** Mirrors GIOI_HAN_HEX_BYTE in @dye/core. */
const GIOI_HAN_MB = 4;

const LOI_MANG: KetQuaNop = {
  trangThai: 'loi',
  submissionId: null,
  attemptNo: null,
  thongDiep: 'Chưa gửi được. Em kiểm tra mạng rồi thử lại nhé.',
};

/** The only states the route answers with; anything else is not its answer. */
const TRANG_THAI_NOP: readonly KetQuaNop['trangThai'][] = ['da-nhan', 'tu-choi', 'loi'];

/**
 * POST the file and read back the server's answer.
 *
 * Every answer the route gives is a JSON `KetQuaNop`, whatever the status, so
 * the status is not consulted — `trangThai` says what happened. The two things
 * that are NOT an answer from the route are told apart: a redirect means the
 * session expired and the middleware sent the request to the login page; a
 * body that is not JSON (a proxy's 413 page, a dropped connection) is the one
 * case that really is the network.
 */
async function guiTep(blockId: string, file: File): Promise<KetQuaNop> {
  const fd = new FormData();
  fd.set('tep', file);

  let res: Response;
  try {
    res = await fetch(`/api/khoi/${encodeURIComponent(blockId)}/hex`, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return LOI_MANG;
  }

  if (res.redirected) {
    return {
      ...LOI_MANG,
      trangThai: 'tu-choi',
      thongDiep: 'Phiên đăng nhập đã hết hạn. Em đăng nhập lại rồi nộp tệp nhé.',
    };
  }

  try {
    const kq = (await res.json()) as Partial<KetQuaNop> | null;
    const trangThai = TRANG_THAI_NOP.find((t) => t === kq?.trangThai);
    if (kq && trangThai && typeof kq.thongDiep === 'string') {
      return {
        trangThai,
        submissionId: typeof kq.submissionId === 'string' ? kq.submissionId : null,
        attemptNo: typeof kq.attemptNo === 'number' ? kq.attemptNo : null,
        thongDiep: kq.thongDiep,
      };
    }
  } catch {
    // Not JSON: fall through.
  }

  if (res.status === 413) {
    return {
      ...LOI_MANG,
      trangThai: 'tu-choi',
      thongDiep: `Tệp lớn hơn ${GIOI_HAN_MB} MB — không phải tệp .hex của micro:bit.`,
    };
  }
  return LOI_MANG;
}

interface TepDaChon {
  file: File;
  /** Set when the pre-check refused it; the file is shown but not sendable. */
  lyDoTuChoi: string | null;
}

async function kiemTraSoBo(file: File): Promise<string | null> {
  if (!/\.hex$/i.test(file.name)) {
    return 'Tệp này không phải .hex. Trong MakeCode, em bấm "Tải xuống" và chọn tệp có đuôi .hex.';
  }
  if (file.size === 0) return 'Tệp này trống. Em tải lại từ MakeCode nhé.';
  if (file.size > GIOI_HAN_MB * MB) {
    return `Tệp lớn hơn ${GIOI_HAN_MB} MB — không phải tệp .hex của micro:bit.`;
  }
  // Intel HEX begins with a record start code. One byte tells us a lot.
  const dau = new Uint8Array(await file.slice(0, 1).arrayBuffer());
  if (dau[0] !== 0x3a /* ':' */) {
    return 'Tệp không đúng định dạng .hex của micro:bit. Em tải lại từ MakeCode nhé.';
  }
  return null;
}

function kichThuoc(bytes: number): string {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface BaiNopHexHienThi {
  submissionId: string;
  tenTep: string;
  kichThuocKb: number;
  nopLuc: string;
  /** A person has marked it: the student may no longer delete it. */
  daCham: boolean;
  verdict: string;
}

/**
 * The .hex on record, in place of the picker.
 *
 * One upload per problem. While one exists the input is not rendered at all —
 * not disabled, not hidden behind a toggle — because "upload" is not a thing
 * the student can do. What they can do is delete it, and the button says so
 * in full: what will be removed, and that they will then upload again.
 */
function DaNopHex({ bai }: { bai: BaiNopHexHienThi }) {
  const router = useRouter();
  const [xacNhan, setXacNhan] = useState(false);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangXoa, batDauXoa] = useTransition();
  const id = useId();

  const luc = new Date(bai.nopLuc).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="rounded-nut border border-vien bg-the-mo p-4 sm:p-5"
      data-testid="da-nop-hex"
    >
      <h3 id={`${id}-tieu-de`} className="mt-0 mb-3 text-base font-bold">
        <span aria-hidden="true">📎 </span>Tệp .hex em đã nộp
      </h3>

      <dl className="m-0 mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
        <dt className="text-chu-phu">Tệp</dt>
        <dd className="m-0 font-semibold break-all">{bai.tenTep}</dd>
        <dt className="text-chu-phu">Kích thước</dt>
        <dd className="m-0">{bai.kichThuocKb} KB</dd>
        <dt className="text-chu-phu">Nộp lúc</dt>
        <dd className="m-0">{luc}</dd>
        <dt className="text-chu-phu">Trạng thái</dt>
        <dd className="m-0">
          {bai.daCham
            ? bai.verdict === 'ACCEPTED'
              ? '✅ Thầy cô đã chấm: đạt'
              : '📝 Thầy cô đã chấm'
            : '⏳ Đang chờ thầy cô xem'}
        </dd>
      </dl>

      {bai.daCham ? (
        <p className="m-0 text-sm text-chu-phu">
          Thầy cô đã chấm bài này nên không xoá được nữa. Muốn nộp lại, em nhờ thầy cô mở khoá nhé.
        </p>
      ) : !xacNhan ? (
        <button
          type="button"
          onClick={() => setXacNhan(true)}
          className="min-h-cham rounded-nut bg-loi px-5 py-2.5 text-base font-bold text-nen hover:opacity-90 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-loi"
        >
          <span aria-hidden="true">🗑 </span>Xóa bài nộp cũ để nộp lại
        </button>
      ) : (
        <div role="group" aria-labelledby={`${id}-xac-nhan`} className="rounded-nut border-2 border-loi bg-loi-nen p-4">
          <p id={`${id}-xac-nhan`} className="mt-0 mb-3 font-semibold text-loi">
            Xoá <strong>{bai.tenTep}</strong>? Bài nộp cũ sẽ mất, rồi em chọn tệp mới để nộp lại.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={dangXoa}
              onClick={() =>
                batDauXoa(async () => {
                  const kq = await xoaBaiNopHexCu(bai.submissionId).catch(() => ({
                    trangThai: 'loi' as const,
                    thongDiep: 'Chưa xoá được. Em kiểm tra mạng rồi thử lại nhé.',
                  }));
                  setThongBao({ ok: kq.trangThai === 'da-xoa', chu: kq.thongDiep });
                  // The page re-renders from the server: no submission on
                  // record → this panel is replaced by the picker.
                  if (kq.trangThai === 'da-xoa') router.refresh();
                })
              }
              className="min-h-cham rounded-nut bg-loi px-5 py-2.5 text-base font-bold text-nen hover:opacity-90 disabled:opacity-60"
            >
              {dangXoa ? 'Đang xoá…' : 'Xoá và nộp lại'}
            </button>
            <button
              type="button"
              onClick={() => setXacNhan(false)}
              className="min-h-cham rounded-nut border border-vien px-4 py-2 text-base font-medium text-chu-phu hover:text-chu"
            >
              Giữ lại
            </button>
          </div>
        </div>
      )}

      {thongBao ? (
        <p role={thongBao.ok ? 'status' : 'alert'} className={`mt-3 mb-0 text-sm font-medium ${thongBao.ok ? 'text-dung' : 'text-thu-lai'}`}>
          {thongBao.chu}
        </p>
      ) : null}
    </section>
  );
}

export function TaiLenHex({
  blockId,
  onDaNop,
  daNop = null,
}: {
  blockId: string;
  /** Lets the parent refresh its own history list. */
  onDaNop?: (kq: KetQuaNop) => void;
  /** The .hex on record, if any. When set, the picker is not rendered. */
  daNop?: BaiNopHexHienThi | null;
}) {
  if (daNop) return <DaNopHex bai={daNop} />;
  return <ChonVaNopHex blockId={blockId} onDaNop={onDaNop} />;
}

function ChonVaNopHex({
  blockId,
  onDaNop,
}: {
  blockId: string;
  onDaNop?: ((kq: KetQuaNop) => void) | undefined;
}) {
  const [chon, setChon] = useState<TepDaChon | null>(null);
  const [keo, setKeo] = useState(false);
  const [ketQua, setKetQua] = useState<KetQuaNop | null>(null);
  const [dangGui, batDau] = useTransition();
  const input = useRef<HTMLInputElement | null>(null);
  const id = useId();

  /*
   * The dialog closed with nothing chosen. React does not forward `cancel`
   * from an <input>, so it is bound natively; and the pause is ended on
   * unmount too, so a block that disappears mid-dialog cannot leave the
   * tracker switched off.
   */
  useEffect(() => {
    const el = input.current;
    el?.addEventListener('cancel', ketThucChonTep);
    return () => {
      el?.removeEventListener('cancel', ketThucChonTep);
      ketThucChonTep();
    };
  }, []);

  const nhanTep = useCallback(async (file: File | undefined) => {
    // The dialog has closed, whichever way. The tracker is back on.
    ketThucChonTep();
    setKetQua(null);
    if (!file) return;
    setChon({ file, lyDoTuChoi: await kiemTraSoBo(file) });
  }, []);

  const gui = useCallback(() => {
    if (!chon || chon.lyDoTuChoi) return;
    batDau(async () => {
      const kq = await guiTep(blockId, chon.file);
      setKetQua(kq);
      if (kq.trangThai === 'da-nhan') {
        setChon(null);
        if (input.current) input.current.value = '';
        onDaNop?.(kq);
      }
    });
  }, [blockId, chon, onDaNop]);

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="rounded-nut border-2 border-dashed border-vien bg-the-mo p-4 sm:p-5"
    >
      <h3 id={`${id}-tieu-de`} className="mt-0 mb-1 text-base font-bold">
        <span aria-hidden="true">📎 </span>Nộp tệp .hex (nếu trình soạn không mở được)
      </h3>
      <p className="mt-0 mb-4 text-sm text-chu-phu">
        Em làm bài trên <strong>makecode.microbit.org</strong>, bấm <strong>Tải xuống</strong> để
        có tệp <code>.hex</code>, rồi đưa tệp đó vào đây. Tệp này được tính là bài nộp chính thức.
      </p>

      {/*
        One large target. `<label>` wraps the hidden input so a click anywhere
        on it opens the picker; the same element takes a drop.
      */}
      <label
        htmlFor={`${id}-tep`}
        onDragOver={(e) => {
          e.preventDefault();
          setKeo(true);
        }}
        onDragLeave={() => setKeo(false)}
        onDrop={(e) => {
          e.preventDefault();
          setKeo(false);
          void nhanTep(e.dataTransfer.files[0]);
        }}
        className={`flex min-h-[6rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-nut border-2 p-4 text-center transition-colors ${
          keo
            ? 'border-chinh bg-chinh-nhat'
            : 'border-vien bg-the hover:border-chinh focus-within:border-chinh'
        }`}
      >
        <span aria-hidden="true" className="text-3xl">
          📂
        </span>
        <span className="text-base font-semibold">Chọn tệp .hex hoặc kéo thả vào đây</span>
        <span className="text-sm text-chu-nhat">Tối đa {GIOI_HAN_MB} MB</span>
        <input
          ref={input}
          id={`${id}-tep`}
          type="file"
          accept=".hex,application/octet-stream"
          className="sr-only"
          // `click` fires before the dialog opens, on a real click and on the
          // label's synthetic one alike. The dialog closed empty is `cancel`,
          // bound natively in the effect above — React only wires that event
          // on <dialog>, so an `onCancel` prop here would never fire.
          onClick={batDauChonTep}
          onChange={(e) => void nhanTep(e.target.files?.[0])}
        />
      </label>

      {chon ? (
        <div
          className={`mt-3 rounded-nut border p-3 ${
            chon.lyDoTuChoi ? 'border-thu-lai bg-thu-lai-nen' : 'border-dung/40 bg-dung-nen'
          }`}
        >
          <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-base font-semibold break-all">
              <span aria-hidden="true">{chon.lyDoTuChoi ? '⚠️ ' : '✅ '}</span>
              {chon.file.name}
            </span>
            <span className="text-sm text-chu-phu">{kichThuoc(chon.file.size)}</span>
          </p>
          {chon.lyDoTuChoi ? (
            <p role="alert" className="mt-2 mb-0 text-sm text-thu-lai">
              {chon.lyDoTuChoi}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={gui}
          disabled={!chon || chon.lyDoTuChoi !== null || dangGui}
          className="min-h-cham rounded-nut bg-chinh px-5 py-2.5 text-base font-semibold text-white hover:bg-chinh-dam disabled:opacity-50"
        >
          {dangGui ? 'Đang gửi…' : 'Nộp tệp này'}
        </button>
        {chon ? (
          <button
            type="button"
            onClick={() => {
              setChon(null);
              setKetQua(null);
              if (input.current) input.current.value = '';
            }}
            className="min-h-cham rounded-nut px-3 py-2 text-sm font-medium text-chu-phu hover:text-chinh-sang"
          >
            Chọn tệp khác
          </button>
        ) : null}
      </div>

      {ketQua ? (
        <p
          role={ketQua.trangThai === 'da-nhan' ? 'status' : 'alert'}
          className={`mt-3 mb-0 rounded-nut p-3 text-sm font-medium ${
            ketQua.trangThai === 'da-nhan' ? 'bg-dung-nen text-dung' : 'bg-thu-lai-nen text-thu-lai'
          }`}
        >
          {ketQua.thongDiep}
        </p>
      ) : null}
    </section>
  );
}
