'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { CHUA_LAM, taoDuAnMoi } from '@/app/du-an/actions';

import type { ProjectTemplate } from '@prisma/client';

const ICON: Record<ProjectTemplate, string> = {
  SPACE_INVADERS: '🚀',
  PLATFORMER: '🏃',
  PONG: '🏓',
  MAZE: '🗺️',
  QUIZ_GUI: '❓',
  CUSTOM: '✨',
};

function Nut() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang tạo…' : 'Tạo dự án'}
    </button>
  );
}

/**
 * New-project form.
 *
 * The templates are radio cards rather than a dropdown so all six choices and
 * what they mean stay visible. A 12-year-old picking their first game project
 * should be choosing between things they can see, not guessing at labels in a
 * collapsed list.
 */
export function TaoDuAnForm({
  mau,
}: {
  mau: Record<ProjectTemplate, { ten: string; moTa: string }>;
}) {
  const [ketQua, formAction] = useActionState(taoDuAnMoi, CHUA_LAM);
  const cacMau = Object.entries(mau) as Array<[ProjectTemplate, { ten: string; moTa: string }]>;

  return (
    <form action={formAction}>
      <fieldset className="m-0 mb-5 border-0 p-0">
        <legend className="mb-3 text-sm font-semibold">Kiểu trò chơi</legend>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {cacMau.map(([key, m]) => (
            <label
              key={key}
              className="flex cursor-pointer gap-3 rounded-nut border-2 border-vien bg-the p-3.5 transition-colors hover:border-vien-dam has-checked:border-chinh has-checked:bg-chinh-nhat"
            >
              <input
                type="radio"
                name="template"
                value={key}
                defaultChecked={key === 'CUSTOM'}
                className="mt-1 size-5 shrink-0 accent-[var(--color-chinh)]"
              />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span aria-hidden="true">{ICON[key]}</span>
                  {m.ten}
                </span>
                <span className="mt-0.5 block text-sm text-chu-phu">{m.moTa}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-5">
        <label htmlFor="ten-du-an" className="mb-1.5 block text-sm font-semibold">
          Tên trò chơi của em{' '}
          <span className="font-normal text-chu-nhat">(để trống cũng được)</span>
        </label>
        <input
          id="ten-du-an"
          name="title"
          type="text"
          maxLength={120}
          placeholder="ví dụ: Phi thuyền cứu Trái Đất"
          className="min-h-cham w-full rounded-nut border border-vien bg-the px-3.5 py-2.5 text-base"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Nut />
        {ketQua.trangThai !== 'chua-lam' && ketQua.thongDiep ? (
          <p
            role="status"
            className={`m-0 text-sm font-medium ${
              ketQua.trangThai === 'thanh-cong' ? 'text-dung' : 'text-thu-lai'
            }`}
          >
            {ketQua.trangThai === 'thanh-cong' ? 'Đã tạo dự án. Em kéo lên trên để mở nhé.' : ketQua.thongDiep}
          </p>
        ) : null}
      </div>
    </form>
  );
}
