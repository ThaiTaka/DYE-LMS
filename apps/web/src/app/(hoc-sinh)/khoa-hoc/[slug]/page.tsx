import { notFound } from 'next/navigation';

import { BanDoHocTap } from '@/components/hoc-sinh/ban-do-hoc-tap';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { ChuNeon, TheKinh } from '@/components/ui/the-kinh';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireSession } from '@/lib/guard';
import { duLieuBanDoKhoaHoc } from '@/lib/student-data';

/**
 * The course page is the learning roadmap.
 *
 * Everything below the header is `BanDoHocTap`: one path, stops along it, and
 * a single loud "do this next". The header keeps the course-level bar because
 * it is the one number a student asks about ("how far am I?"); everything
 * finer-grained lives on the lesson page.
 */
export default async function BanDoKhoaHoc({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requireSession();
  const { slug } = await params;

  const data = await duLieuBanDoKhoaHoc(actor.id, slug);
  if (!data) notFound();

  const next = data.progress.nextLesson;

  return (
    <>
      <DuongDan muc={[{ nhan: 'Trang chính', href: '/bang-dieu-khien' }, { nhan: data.title }]} />

      <header className="mb-8">
        <p className="m-0 text-sm font-bold tracking-wide text-chinh-sang uppercase">Bản đồ học tập</p>
        <h1 className="mt-1 mb-2 flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
          <span aria-hidden="true">{data.iconEmoji}</span>
          <ChuNeon>{data.title}</ChuNeon>
        </h1>
        <p className="mt-0 mb-5 text-lg text-chu-phu">{data.subtitle}</p>

        <TheKinh className="p-5">
          <ThanhTienDo
            nhan="Em đã đi được"
            phanTram={data.progress.required.percent}
            daXong={data.progress.required.completed}
            tong={data.progress.required.total}
            chuaGiao={!data.progress.hasRequiredWork}
            cao="lon"
          />
          {data.progress.isComplete ? (
            <p role="status" className="mt-3 mb-0 text-lg font-bold text-dung">
              <span aria-hidden="true">🏆 </span>Em đã hoàn thành cả khoá học!
            </p>
          ) : null}
        </TheKinh>
      </header>

      <BanDoHocTap
        modules={data.modules}
        kiemTra={data.kiemTra}
        tiepTheo={next ? { slug: next.slug, title: next.title, order: next.order } : null}
      />
    </>
  );
}
