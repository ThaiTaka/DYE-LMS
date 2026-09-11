import { redirect } from 'next/navigation';

import { currentActor } from '@/auth';

import { FormDangNhap } from './form';

export default async function TrangDangNhap({
  searchParams,
}: {
  searchParams: Promise<{ 'tiep-tuc'?: string; 'doi-mat-khau'?: string }>;
}) {
  // Already signed in? Don't show a login form.
  if (await currentActor()) redirect('/bang-dieu-khien');

  const params = await searchParams;
  const tiepTuc = params['tiep-tuc'] ?? '/bang-dieu-khien';
  const vuaDoiMatKhau = params['doi-mat-khau'] === 'xong';

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-[#0b1a33] px-4 py-16 text-slate-100 sm:px-6 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(to_right,rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.10)_1px,transparent_1px)] before:bg-[size:40px_40px] before:[mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_30%,transparent_100%)] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-[radial-gradient(ellipse_55%_40%_at_50%_40%,rgba(56,189,248,0.10),transparent_70%)] after:content-['']">
      <div className="mb-8 w-full max-w-md text-center">
        <p aria-hidden="true" className="m-0 text-4xl">
          🐍
        </p>

        {/*
          Product name and author on one line.

          `flex-wrap` with a middot rather than a drawn divider: on a narrow
          phone the two halves wrap onto separate lines, and a vertical rule
          left stranded at the end of a line looks like a mistake where a
          middot just disappears into the gap.
        */}
        <div className="mt-2 mb-1 flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-0.5">
          <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-50">DYE LMS</h1>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <p className="m-0 text-sm text-slate-400">
            Phát triển bởi{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text font-bold text-transparent">
              Thái Taka
            </span>
          </p>
        </div>

        <p className="m-0 text-slate-300">Học lập trình Python cùng nhau</p>
      </div>

      {vuaDoiMatKhau ? (
        <p
          role="status"
          className="mb-5 w-full max-w-md rounded-nut border border-emerald-400/30 bg-emerald-400/10 p-4 text-center font-medium text-emerald-300"
        >
          ✓ Đã đổi mật khẩu. Em đăng nhập lại bằng mật khẩu mới nhé.
        </p>
      ) : null}

      <div className="w-full max-w-md rounded-the border border-white/15 bg-white/10 p-6 shadow-[0_8px_32px_-8px_rgba(2,6,23,0.6),0_0_0_1px_rgba(56,189,248,0.12)_inset] backdrop-blur-md">
        <h2 className="mt-0 mb-5 text-xl font-bold text-slate-50">Đăng nhập</h2>
        <FormDangNhap tiepTuc={tiepTuc} />
      </div>

      <p className="mt-6 w-full max-w-md text-center text-sm text-slate-400">
        Quên mật khẩu? Hãy nhờ thầy cô đặt lại giúp em.
      </p>

    </main>
  );
}
