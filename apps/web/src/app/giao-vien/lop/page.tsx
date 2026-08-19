import Link from 'next/link';

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
            <li
              key={l.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-the border border-vien bg-the p-4"
            >
              <div className="min-w-0">
                <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-base font-semibold">
                  <Link href={`/giao-vien/lop/${l.id}`} className="hover:underline">
                    {l.ten}
                  </Link>
                  {l.daLuuTru ? (
                    <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                      Đã lưu trữ
                    </span>
                  ) : null}
                </h3>
                <p className="m-0 text-sm text-chu-phu">
                  {l.ma} · {l.giaoVien} · {l.soHocSinh} học sinh
                  {l.term ? ` · ${l.term}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </VoGiaoVien>
  );
}
