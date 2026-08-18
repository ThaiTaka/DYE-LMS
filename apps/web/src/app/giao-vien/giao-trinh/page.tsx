import Link from 'next/link';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { requireRole } from '@/lib/guard';
import { danhSachKhoaHoc } from '@/lib/teacher-data';

export default async function TrangChonGiaoTrinh() {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const khoa = await danhSachKhoaHoc();

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Giáo trình</h1>
        <p className="m-0 text-chu-phu">
          Bản đồ đầy đủ của từng khoá, kèm ghi chú giáo án và yêu cầu giảng dạy — phần học sinh
          không nhìn thấy.
        </p>
      </header>

      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-3">
        {khoa.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/giao-vien/giao-trinh/${c.slug}`}
              className="block h-full rounded-the border border-vien bg-the p-5 transition-colors hover:border-chinh"
            >
              <span aria-hidden="true" className="mb-3 block text-4xl leading-none">
                {c.iconEmoji}
              </span>
              <h2 className="mt-0 mb-1 text-lg leading-snug font-semibold text-chu">{c.title}</h2>
              <p className="m-0 text-sm text-chu-nhat">{c.totalSessions} buổi</p>
            </Link>
          </li>
        ))}
      </ul>
    </VoGiaoVien>
  );
}
