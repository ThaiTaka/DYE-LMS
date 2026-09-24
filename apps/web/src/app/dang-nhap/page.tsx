import Image from 'next/image';
import { redirect } from 'next/navigation';

import { currentActor } from '@/auth';

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

      {/*
        The branding cluster: full name, mascot, short name — one centred
        column, one rhythm.

        The full name is an eyebrow, not a headline: small caps-and-tracking
        in the mascot's mint running into the brand violet, balanced over two
        lines. "DYE LMS" is the `<h1>` and the loud line, lit with the same
        `drop-shadow-neon` as the primary button.

        The spacing is set by what the eye sees, not by the boxes. Capitals
        leave the eyebrow's line box empty below the letters, and the
        mascot's torso fades out through its bottom quarter, so equal gaps
        between boxes looked lopsided. Measured as ink, the gaps above and
        below the mascot are within a pixel of each other (≈24px), and the
        credit sits closer under "DYE LMS" so it reads as its caption.

        The mascot drifts 6px on a 6s loop — a transform, so it runs on the
        compositor next to the code background — and stands still for anyone
        who asked their OS for reduced motion. The glow sits on the wrapper,
        not the `<img>`: a mask is applied AFTER a filter on the same element
        and only covers its box, so the glow was cut off square at the edges.
        `next/image` serves the picture resized from a large source; `priority`
        because it is above the fold on the page every student sees first.
      */}
      <div className="mb-8 flex w-full max-w-md flex-col items-center text-center">
        <p className="m-0 text-xs leading-relaxed font-semibold tracking-widest text-balance uppercase drop-shadow-[0_0_8px_rgba(94,234,212,0.35)]">
          <span className="bg-linear-to-r from-ngoc to-chinh-sang bg-clip-text text-transparent">
            DaLat Young Engineers Learning Management System
          </span>
        </p>

        <div className="mt-4 animate-troi drop-shadow-[0_0_15px_rgba(94,234,212,0.5)] motion-reduce:animate-none">
          <Image
            src="/hinh/logo.png"
            alt="DYE Mascot"
            width={96}
            height={96}
            priority
            className="size-24 [mask-image:linear-gradient(to_bottom,#000_72%,transparent)]"
          />
        </div>

        <h1 className="mt-2.5 mb-0 text-3xl leading-none font-extrabold tracking-tight text-chu drop-shadow-neon">
          DYE LMS
        </h1>

        <p className="mt-1.5 mb-0 text-sm font-medium text-chu-nhat">
          Phát triển bởi <span className="chu-neon font-bold">Thái Taka</span>
        </p>
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
