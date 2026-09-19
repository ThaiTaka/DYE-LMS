'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { resetMatKhauHocSinh } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';
import { BieuTuong } from '@/components/ui/bieu-tuong';

import { PhanHoi } from './dieu-khien-nhanh';

const TOI_THIEU = 8;

function NutGui() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang đổi…' : 'Xác nhận đổi'}
    </button>
  );
}

/**
 * "Đổi mật khẩu" — a button that opens a small dialog.
 *
 * ── Why a dialog and not an inline form ──────────────────────────────────────
 * A password field sitting open on the student page is a field a teacher
 * types into by accident, and a projector shows. Behind a button, the secret
 * exists on screen only for the seconds it is being set, and the dialog is
 * the one place the page says out loud what the reset does: logs the child
 * out everywhere and forces them to choose their own password next time.
 *
 * ── The same dialog shape as the rest of the app ─────────────────────────────
 * A plain `div` with `role="dialog"`, like `CanhBaoRoiTab`: `<dialog>` and
 * `showModal()` behave unevenly across the browsers on a school laptop.
 * Escape and the backdrop close it — unlike the exam warning, nothing here is
 * being enforced on anyone, so the usual ways out are honoured.
 *
 * ── Fresh every time ─────────────────────────────────────────────────────────
 * The dialog body is keyed by how many times it has been opened. `useActionState`
 * has no reset, and without the key a teacher who resets one password, closes,
 * and opens again would be greeted by the previous "Đã đổi" panel.
 */
export function DoiMatKhauHocSinh({
  studentId,
  tenHocSinh,
}: {
  studentId: string;
  tenHocSinh: string;
}) {
  const [mo, setMo] = useState(false);
  const [lan, setLan] = useState(0);
  const nutMo = useRef<HTMLButtonElement | null>(null);

  function moRa(): void {
    setLan((n) => n + 1);
    setMo(true);
  }

  function dong(): void {
    setMo(false);
    nutMo.current?.focus();
  }

  return (
    <>
      <button
        ref={nutMo}
        type="button"
        onClick={moRa}
        aria-haspopup="dialog"
        aria-expanded={mo}
        className="inline-flex min-h-cham items-center gap-1.5 rounded-nut border border-vien px-3.5 py-2 text-sm font-medium whitespace-nowrap text-chu-phu hover:border-chinh hover:text-chinh-sang"
      >
        <span aria-hidden="true">🔑</span>
        Đổi mật khẩu
      </button>

      {mo ? (
        <HopThoai key={lan} studentId={studentId} tenHocSinh={tenHocSinh} onDong={dong} />
      ) : null}
    </>
  );
}

/**
 * The dialog itself. Focus lands on the first field on open, stays inside
 * while open, and the caller returns it to the button on close.
 *
 * After success the form disappears and only the outcome stays, so the
 * teacher reads what happened (logged out, must change on next login) before
 * closing — and the password they just typed is no longer on the screen.
 */
function HopThoai({
  studentId,
  tenHocSinh,
  onDong,
}: {
  studentId: string;
  tenHocSinh: string;
  onDong: () => void;
}) {
  const [ketQua, formAction] = useActionState(resetMatKhauHocSinh, CHUA_LAM);
  const [hien, setHien] = useState(false);

  const id = useId();
  const hop = useRef<HTMLDivElement | null>(null);
  const oDau = useRef<HTMLInputElement | null>(null);

  const thanhCong = ketQua.trangThai === 'thanh-cong';

  useEffect(() => {
    oDau.current?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDong();
        return;
      }

      // Keep Tab inside the dialog; a keyboard user who walks out lands on the
      // page behind the scrim with no visible focus.
      if (e.key === 'Tab' && hop.current) {
        const muc = hop.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), a[href]',
        );
        if (muc.length === 0) return;
        const dau = muc[0]!;
        const cuoi = muc[muc.length - 1]!;
        if (e.shiftKey && document.activeElement === dau) {
          e.preventDefault();
          cuoi.focus();
        } else if (!e.shiftKey && document.activeElement === cuoi) {
          e.preventDefault();
          dau.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onDong]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDong();
      }}
    >
      <div
        ref={hop}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-tieu-de`}
        aria-describedby={`${id}-mo-ta`}
        className="w-full max-w-md rounded-the border border-vien bg-the p-6 shadow-[0_0_40px_rgba(124,58,237,0.25)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={`${id}-tieu-de`} className="mt-0 mb-0 text-xl font-bold">
            Đổi mật khẩu cho {tenHocSinh}
          </h2>
          <button
            type="button"
            onClick={onDong}
            aria-label="Đóng"
            className="grid size-cham shrink-0 place-items-center rounded-nut text-chu-phu hover:bg-white/[0.06] hover:text-chu"
          >
            <BieuTuong ten="dong" />
          </button>
        </div>

        {thanhCong ? (
          <>
            <div id={`${id}-mo-ta`} className="mb-5 rounded-nut bg-dung-nen p-4">
              <PhanHoi ketQua={ketQua} />
            </div>
            <button
              type="button"
              onClick={onDong}
              className="min-h-cham w-full rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
            >
              Đóng
            </button>
          </>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="studentId" value={studentId} />

            <p id={`${id}-mo-ta`} className="mt-0 mb-4 text-sm text-chu-phu">
              Em sẽ bị đăng xuất khỏi mọi thiết bị và{' '}
              <strong className="text-chu">phải tự đặt mật khẩu mới</strong> ngay lần đăng nhập tới,
              nên mật khẩu thầy cô nhập ở đây chỉ dùng một lần.
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor={`${id}-moi`} className="mb-1.5 block text-sm font-semibold">
                  Mật khẩu mới{' '}
                  <span className="font-normal text-chu-nhat">(ít nhất {TOI_THIEU} ký tự)</span>
                </label>
                <input
                  ref={oDau}
                  id={`${id}-moi`}
                  name="matKhauMoi"
                  type={hien ? 'text' : 'password'}
                  required
                  minLength={TOI_THIEU}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="min-h-cham w-full rounded-nut border border-vien bg-nen px-3.5 py-2.5 text-base"
                />
              </div>

              <div>
                <label htmlFor={`${id}-lai`} className="mb-1.5 block text-sm font-semibold">
                  Nhập lại mật khẩu
                </label>
                <input
                  id={`${id}-lai`}
                  name="nhapLai"
                  type={hien ? 'text' : 'password'}
                  required
                  minLength={TOI_THIEU}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="min-h-cham w-full rounded-nut border border-vien bg-nen px-3.5 py-2.5 text-base"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-chu-phu">
                <input
                  type="checkbox"
                  checked={hien}
                  onChange={(e) => setHien(e.target.checked)}
                  className="size-4 accent-[var(--color-chinh)]"
                />
                Hiện mật khẩu
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <NutGui />
              <button
                type="button"
                onClick={onDong}
                className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
              >
                Huỷ
              </button>
            </div>

            <div className="mt-3 empty:mt-0">
              <PhanHoi ketQua={ketQua} />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
