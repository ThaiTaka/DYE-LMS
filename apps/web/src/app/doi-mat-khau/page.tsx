import { changePassword, MIN_PASSWORD_LENGTH } from '@dye/core';
import { redirect } from 'next/navigation';

import { currentActor, signOut } from '@/auth';
import { db } from '@/lib/db';

/**
 * Forced password change for teacher-provisioned accounts.
 *
 * `changePassword` revokes every session for the user, including this one — so
 * after a successful change we sign out and ask them to log in again. That is
 * the honest behaviour: if the old password leaked, no session created with it
 * should survive.
 */
async function doiMatKhau(formData: FormData): Promise<void> {
  'use server';

  const actor = await currentActor();
  if (!actor) redirect('/dang-nhap');

  const hienTai = String(formData.get('hien-tai') ?? '');
  const moi = String(formData.get('moi') ?? '');
  const xacNhan = String(formData.get('xac-nhan') ?? '');

  if (moi !== xacNhan) redirect('/doi-mat-khau?loi=khong-khop');
  if (moi.length < MIN_PASSWORD_LENGTH) redirect('/doi-mat-khau?loi=qua-ngan');

  try {
    await changePassword(db, actor.id, hienTai, moi);
  } catch {
    redirect('/doi-mat-khau?loi=sai-mat-khau');
  }

  await signOut({ redirect: false });
  redirect('/dang-nhap?doi-mat-khau=xong');
}

const THONG_BAO: Record<string, string> = {
  'khong-khop': 'Hai lần nhập mật khẩu mới không giống nhau.',
  'qua-ngan': `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
  'sai-mat-khau': 'Mật khẩu hiện tại không đúng.',
};

const O_NHAP =
  'min-h-cham w-full rounded-nut border border-vien bg-the px-4 py-2.5 text-base text-chu';

export default async function TrangDoiMatKhau({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect('/dang-nhap');

  const { loi } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="mt-0 mb-2 text-2xl font-bold">Đổi mật khẩu</h1>
      <p className="mt-0 mb-6 text-chu-phu">
        {actor.mustChangePassword
          ? 'Thầy cô vừa tạo tài khoản cho em. Hãy đặt mật khẩu riêng trước khi bắt đầu học.'
          : 'Đặt mật khẩu mới cho tài khoản của bạn.'}
      </p>

      <div className="rounded-the border border-vien bg-the p-6">
        {loi && THONG_BAO[loi] ? (
          <p
            role="alert"
            className="mt-0 mb-5 rounded-nut border border-loi/30 bg-loi-nen p-3.5 text-sm font-medium text-loi"
          >
            {THONG_BAO[loi]}
          </p>
        ) : null}

        <form action={doiMatKhau} className="space-y-5">
          <div>
            <label htmlFor="hien-tai" className="mb-1.5 block font-semibold">
              Mật khẩu hiện tại
            </label>
            <input
              id="hien-tai"
              name="hien-tai"
              type="password"
              autoComplete="current-password"
              required
              className={O_NHAP}
            />
          </div>

          <div>
            <label htmlFor="moi" className="mb-1.5 block font-semibold">
              Mật khẩu mới
            </label>
            <input
              id="moi"
              name="moi"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              aria-describedby="goi-y-do-dai"
              className={O_NHAP}
            />
            <p id="goi-y-do-dai" className="mt-1.5 mb-0 text-sm text-chu-nhat">
              Ít nhất {MIN_PASSWORD_LENGTH} ký tự.
            </p>
          </div>

          <div>
            <label htmlFor="xac-nhan" className="mb-1.5 block font-semibold">
              Nhập lại mật khẩu mới
            </label>
            <input
              id="xac-nhan"
              name="xac-nhan"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className={O_NHAP}
            />
          </div>

          <button
            type="submit"
            className="min-h-cham w-full rounded-nut bg-chinh px-5 py-3 font-semibold text-white hover:bg-chinh-dam"
          >
            Đổi mật khẩu
          </button>
        </form>

        <p className="mt-5 mb-0 text-sm text-chu-nhat">
          Sau khi đổi, mọi thiết bị khác sẽ bị đăng xuất — kể cả thiết bị này.
        </p>
      </div>
    </main>
  );
}
