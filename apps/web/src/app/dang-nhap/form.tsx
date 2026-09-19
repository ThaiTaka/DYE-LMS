'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { dangNhap, type TrangThaiDangNhap } from './actions';

const O_NHAP =
  'min-h-cham w-full rounded-nut border border-vien-dam bg-nen-sau/60 px-4 py-2.5 text-base text-chu outline-none transition-colors placeholder:text-chu-nhat focus:border-chinh-sang focus:ring-2 focus:ring-chinh-sang/40';

function NutGui() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="nut-neon w-full px-5 py-3 text-base font-bold"
    >
      {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
    </button>
  );
}

export function FormDangNhap({ tiepTuc }: { tiepTuc: string }) {
  const [trangThai, action] = useActionState<TrangThaiDangNhap, FormData>(dangNhap, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="tiep-tuc" value={tiepTuc} />

      {trangThai.loi ? (
        <p
          role="alert"
          className="m-0 rounded-nut border border-loi/40 bg-loi-nen p-3.5 text-sm font-medium text-loi"
        >
          {trangThai.loi}
        </p>
      ) : null}

      <div>
        <label htmlFor="username" className="mb-1.5 block font-semibold text-chu">
          Tên đăng nhập
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={O_NHAP}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block font-semibold text-chu">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={O_NHAP}
        />
      </div>

      <NutGui />
    </form>
  );
}
