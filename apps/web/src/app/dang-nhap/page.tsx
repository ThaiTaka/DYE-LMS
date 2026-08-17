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
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <p aria-hidden="true" className="m-0 text-4xl">
          🐍
        </p>
        <h1 className="mt-2 mb-1 text-3xl font-bold">DYE LMS</h1>
        <p className="m-0 text-chu-phu">Học lập trình Python cùng nhau</p>
      </div>

      {vuaDoiMatKhau ? (
        <p
          role="status"
          className="mb-5 rounded-nut border border-dung/30 bg-dung-nen p-4 text-center font-medium text-dung"
        >
          ✓ Đã đổi mật khẩu. Em đăng nhập lại bằng mật khẩu mới nhé.
        </p>
      ) : null}

      <div className="rounded-the border border-vien bg-the p-6">
        <h2 className="mt-0 mb-5 text-xl font-bold">Đăng nhập</h2>
        <FormDangNhap tiepTuc={tiepTuc} />
      </div>

      <p className="mt-6 text-center text-sm text-chu-nhat">
        Quên mật khẩu? Hãy nhờ thầy cô đặt lại giúp em.
      </p>
    </main>
  );
}
