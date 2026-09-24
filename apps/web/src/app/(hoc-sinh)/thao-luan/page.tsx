import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { KhuThaoLuan } from '@/components/hoc-sinh/khu-thao-luan';
import { ChuNeon, TheKinh } from '@/components/ui/the-kinh';
import { requireSession } from '@/lib/guard';
import { duLieuTrangThaoLuan } from '@/lib/thao-luan-data';

/**
 * Thảo luận lớp — the student's class chat.
 *
 * `?lop=<classId>` picks a class when the student is in more than one; an id
 * that is not one of THEIR classes falls back to the first rather than
 * erroring (`duLieuTrangThaoLuan` looks it up in their own list).
 *
 * Staff read a class's chat on its page (`/giao-vien/lop/[id]`), next to the
 * roster it belongs to, so they are sent there.
 */
export default async function TrangThaoLuan({
  searchParams,
}: {
  searchParams: Promise<{ lop?: string }>;
}) {
  const actor = await requireSession();
  if (actor.role !== 'STUDENT') redirect('/giao-vien/lop');

  const { lop: lopChon } = await searchParams;
  const { lop, dangXem, banDau } = await duLieuTrangThaoLuan(actor, lopChon);

  return (
    <>
      <DuongDan
        muc={[{ nhan: 'Trang chính', href: '/bang-dieu-khien' }, { nhan: 'Thảo luận lớp' }]}
      />

      <header className="mb-6">
        <h1 className="mt-0 mb-1 text-3xl font-extrabold sm:text-4xl">
          <ChuNeon>Thảo luận lớp</ChuNeon>
        </h1>
        <p className="m-0 text-chu-phu">
          Hỏi bài, chia sẻ mẹo hay và cổ vũ nhau cùng các bạn trong lớp.
        </p>
      </header>

      {lop.length > 1 ? (
        <nav aria-label="Chọn lớp" className="mb-4 flex flex-wrap gap-2">
          {lop.map((l) => {
            const dangO = l.id === dangXem?.id;
            return (
              <Link
                key={l.id}
                href={`/thao-luan?lop=${encodeURIComponent(l.id)}`}
                aria-current={dangO ? 'page' : undefined}
                className={`flex min-h-cham items-center rounded-nut border px-4 py-2 text-sm font-medium ${
                  dangO
                    ? 'border-chinh-sang bg-chinh-nhat text-chinh-sang shadow-[var(--shadow-neon)]'
                    : 'border-white/10 text-chu-phu hover:border-chinh-sang hover:text-chu'
                }`}
              >
                {l.ten}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {dangXem && banDau ? (
        // Keyed on the class so switching classes starts a fresh feed and poller.
        <KhuThaoLuan key={dangXem.id} lop={{ id: dangXem.id, ten: dangXem.ten }} banDau={banDau} />
      ) : (
        <TheKinh className="p-6 text-chu-phu">
          <span aria-hidden="true">💬 </span>
          Em chưa ở trong lớp nào đang học. Khi thầy cô xếp em vào lớp, phòng thảo luận của lớp sẽ
          hiện ở đây.
        </TheKinh>
      )}
    </>
  );
}
