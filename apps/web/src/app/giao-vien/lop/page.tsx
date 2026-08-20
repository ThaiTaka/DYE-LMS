import Link from 'next/link';

import { HangLop } from '@/components/giao-vien/hang-lop';
import { TaoLop } from '@/components/giao-vien/tao-lop';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { duLieuLopHoc } from '@/lib/teacher-data';

export default async function TrangLopHoc() {
  // Admin-only, like Nhân sự. Creating a class decides who will have access to
  // the children put in it, so it is not something a teacher does for themselves
  // — see `requireQuanTriTaoLop` in @dye/core.
  const actor = await requireRole('ADMIN');
  const data = await duLieuLopHoc(actor);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro="ADMIN">
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Lớp học' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Lớp học</h1>
        <p className="m-0 text-chu-phu">
          Tạo lớp và xem lớp nào do ai phụ trách. Lớp vừa tạo dùng được ngay ở{' '}
          <Link href="/giao-vien/hoc-sinh" className="underline">
            Thêm học sinh
          </Link>{' '}
          và{' '}
          <Link href="/giao-vien/nhan-su" className="underline">
            Phân công lớp
          </Link>
          .
        </p>
      </header>

      <TaoLop nhanSu={data.nhanSu} />

      <h2 className="mt-0 mb-4 text-xl font-bold">Danh sách lớp ({data.lop.length})</h2>

      {data.lop.length === 0 ? (
        <p className="rounded-the border border-vien bg-the p-5 text-chu-phu">
          Chưa có lớp nào. Bấm “Thêm lớp học” ở trên để tạo lớp đầu tiên, rồi thêm học sinh vào
          lớp đó.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {data.lop.map((l) => (
            <HangLop key={l.id} lop={l} />
          ))}
        </ul>
      )}
    </VoGiaoVien>
  );
}
