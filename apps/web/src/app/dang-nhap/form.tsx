'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { dangNhap, type TrangThaiDangNhap } from './actions';

const O_NHAP =
  'min-h-cham w-full rounded-nut border border-slate-500 bg-slate-900/70 px-4 py-2.5 text-base text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/40';

function NutGui() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham w-full rounded-nut bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-3 text-base font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:from-cyan-300 hover:to-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-60"
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
          className="m-0 rounded-nut border border-rose-400/30 bg-rose-400/10 p-3.5 text-sm font-medium text-rose-300"
        >
          {trangThai.loi}
        </p>
      ) : null}

      <div>
        <label htmlFor="username" className="mb-1.5 block font-semibold text-slate-100">
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
        <label htmlFor="password" className="mb-1.5 block font-semibold text-slate-100">
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
