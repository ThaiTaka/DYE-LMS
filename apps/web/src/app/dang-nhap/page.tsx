import { redirect } from 'next/navigation';

import { currentActor } from '@/auth';
import { LogoDYE } from '@/components/ui/logo-dye';

import { FormDangNhap } from './form';
import { NenMaLenh } from './nen-ma-lenh';

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
    // `isolate` keeps the background's `-z-10` inside this page, above the
    // body's own glow and below everything drawn here.
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center px-4 py-16 text-chu sm:px-6">
      <NenMaLenh />

      <div className="mb-8 w-full max-w-md text-center">
        {/*
          The logo at its largest in the app, over the violet glow the
          background already pools behind this spot. It carries its own
          gradient; `drop-shadow-neon` lights the hexagon itself, not a square
          around it.
        */}
        <LogoDYE className="mx-auto block size-16 drop-shadow-neon" />

        {/*
          Product name and author on one line.

          `flex-wrap` with a middot rather than a drawn divider: on a narrow
          phone the two halves wrap onto separate lines, and a vertical rule
          left stranded at the end of a line looks like a mistake where a
          middot just disappears into the gap.
        */}
        <div className="mt-2 mb-1 flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-0.5">
          <h1 className="m-0 text-3xl font-bold tracking-tight text-chu">DYE LMS</h1>
          <span aria-hidden="true" className="text-chu-nhat">
            ·
          </span>
          <p className="m-0 text-sm font-medium text-chu-nhat">
            Phát triển bởi <span className="chu-neon font-bold">Thái Taka</span>
          </p>
        </div>

        <p className="m-0 text-chu-phu">Nền tảng học lập trình và Robotics</p>
      </div>

      {vuaDoiMatKhau ? (
        <p
          role="status"
          className="mb-5 w-full max-w-md rounded-nut border border-dung/30 bg-dung-nen p-4 text-center font-medium text-dung"
        >
          ✓ Đã đổi mật khẩu. Em đăng nhập lại bằng mật khẩu mới nhé.
        </p>
      ) : null}

      <div className="w-full max-w-md kinh rounded-the p-6">
        <h2 className="mt-0 mb-5 text-xl font-bold text-chu">Đăng nhập</h2>
        <FormDangNhap tiepTuc={tiepTuc} />
      </div>

      <p className="mt-6 w-full max-w-md text-center text-sm font-medium text-chu-nhat">
        Quên mật khẩu? Hãy nhờ thầy cô đặt lại giúp em.
      </p>
    </main>
  );
}
