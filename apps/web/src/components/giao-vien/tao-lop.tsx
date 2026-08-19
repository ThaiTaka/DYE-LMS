'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { taoLop } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface NhanSuChon {
  id: string;
  displayName: string;
  username: string;
  laToi: boolean;
}

function NutGui() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang tạo…' : 'Tạo lớp'}
    </button>
  );
}

/**
 * Create a class.
 *
 * A disclosure rather than a dialog, for the same reason as the account form: a
 * hand-rolled focus trap that half works is worse for a keyboard user than no
 * dialog at all.
 *
 * The form remounts after each success so the fields empty. Setting up a term
 * means creating several classes in a row, and a leftover name is how "Lập trình
 * cơ bản" gets created twice.
 */
export function TaoLop({ nhanSu }: { nhanSu: NhanSuChon[] }) {
  const [mo, setMo] = useState(false);
  const [soLanXong, setSoLanXong] = useState(0);
  const [ketQua, action] = useActionState(taoLop, CHUA_LAM);

  const id = useId();
  const vungId = `${id}-vung`;

  useEffect(() => {
    if (ketQua.trangThai === 'thanh-cong') setSoLanXong((n) => n + 1);
  }, [ketQua]);

  const toi = nhanSu.find((n) => n.laToi);

  return (
    <section className="mb-7 rounded-the border border-vien bg-the p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold">Thêm lớp học</h2>
        <button
          type="button"
          aria-expanded={mo}
          aria-controls={vungId}
          onClick={() => setMo((truoc) => !truoc)}
          className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam"
        >
          {mo ? 'Đóng biểu mẫu' : 'Thêm lớp học'}
        </button>
      </div>

      {/* Outside the form, so the outcome survives the remount that clears it. */}
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={ketQua} />
      </div>

      {mo ? (
        <form key={soLanXong} id={vungId} action={action} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="m-0">
              <label htmlFor={`${id}-ten`} className="mb-1 block text-sm font-semibold">
                Tên lớp
              </label>
              <input
                id={`${id}-ten`}
                name="ten"
                type="text"
                required
                autoComplete="off"
                placeholder="Lập trình cơ bản"
                aria-describedby={`${id}-ten-mo-ta`}
                className="min-h-cham w-full rounded-nut border border-vien bg-the px-3 py-2 text-sm"
              />
              <span id={`${id}-ten-mo-ta`} className="mt-1 block text-xs text-chu-phu">
                Tên thầy cô và các em nhìn thấy. Có dấu, viết thoải mái.
              </span>
            </p>

            <p className="m-0">
              <label htmlFor={`${id}-ma`} className="mb-1 block text-sm font-semibold">
                Mã lớp <span className="font-normal text-chu-nhat">(không bắt buộc)</span>
              </label>
              <input
                id={`${id}-ma`}
                name="ma"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="LAP-TRINH-CO-BAN"
                aria-describedby={`${id}-ma-mo-ta`}
                className="min-h-cham w-full rounded-nut border border-vien bg-the px-3 py-2 text-sm"
              />
              <span id={`${id}-ma-mo-ta`} className="mt-1 block text-xs text-chu-phu">
                Bỏ trống thì hệ thống tự tạo từ tên lớp, đã bỏ dấu.
              </span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <p className="m-0">
              <label htmlFor={`${id}-term`} className="mb-1 block text-sm font-semibold">
                Khoá / học kỳ <span className="font-normal text-chu-nhat">(không bắt buộc)</span>
              </label>
              <input
                id={`${id}-term`}
                name="term"
                type="text"
                autoComplete="off"
                placeholder="Học kỳ 1 · 2026"
                className="min-h-cham w-full rounded-nut border border-vien bg-the px-3 py-2 text-sm"
              />
            </p>

            <p className="m-0">
              <label htmlFor={`${id}-gv`} className="mb-1 block text-sm font-semibold">
                Ai phụ trách
              </label>
              <select
                id={`${id}-gv`}
                name="giaoVienId"
                defaultValue={toi?.id ?? ''}
                aria-describedby={`${id}-gv-mo-ta`}
                className="min-h-cham w-full rounded-nut border border-vien bg-the px-3 py-2 text-sm"
              >
                {nhanSu.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.displayName} ({n.username}){n.laToi ? ' — bạn' : ''}
                  </option>
                ))}
              </select>
              <span id={`${id}-gv-mo-ta`} className="mt-1 block text-xs text-chu-phu">
                Mỗi lớp luôn phải có một người phụ trách. Mặc định là bạn, và đổi được sau ở
                trang Nhân sự.
              </span>
            </p>
          </div>

          <NutGui />
        </form>
      ) : null}
    </section>
  );
}
