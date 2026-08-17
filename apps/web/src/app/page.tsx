import { redirect } from 'next/navigation';

import { currentActor } from '@/auth';

export default async function Trang() {
  const actor = await currentActor();
  redirect(actor ? '/bang-dieu-khien' : '/dang-nhap');
}
