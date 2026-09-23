import { redirect } from 'next/navigation';

import { currentActor } from '@/auth';
import { DauHieu } from '@/components/dau-hieu';

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
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center px-4 py-16 text-chu sm:px-6 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(to_right,rgba(167,139,250,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(167,139,250,0.10)_1px,transparent_1px)] before:bg-[size:40px_40px] before:[mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_30%,transparent_100%)] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-[radial-gradient(ellipse_55%_40%_at_50%_40%,rgba(124,58,237,0.22),transparent_70%)] after:content-['']">
      <div className="mb-8 w-full max-w-md text-center">
        {/*
          The mark sits on a lit tile rather than being tinted itself.

          The gradient is the same violet-to-pink as the author name below, but
          applied as the tile's background with the glyph drawn over it in dark
          ink (`text-white`, which the SVG picks up through
          `currentColor`). Gradient-filling the strokes themselves would need
          an SVG paint server, and at 32px the result is a thin line washing
          through three shades — legible as a shape only by accident. A solid
          glyph on a glowing tile reads at any size and carries the same accent.
        */}
        <span className="inline-flex rounded-nut bg-linear-to-br from-chinh to-hong p-2.5 text-white shadow-neon">
          <DauHieu className="h-8 w-8" />
        </span>

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

        <p className="m-0 text-chu-phu">Nền tảng học lập trình và STEM Robotics</p>
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
