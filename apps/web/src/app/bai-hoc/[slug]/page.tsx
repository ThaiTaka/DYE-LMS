import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { KhoiNoiDung } from '@/components/hoc-sinh/khoi-noi-dung';
import { ThanhChang } from '@/components/hoc-sinh/thanh-chang';
import { VoHocSinh } from '@/components/hoc-sinh/vo';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireSession } from '@/lib/guard';
import { duLieuBaiHoc } from '@/lib/student-data';

export default async function TrangBaiHoc({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requireSession();
  const { slug } = await params;

  const ketQua = await duLieuBaiHoc(actor.id, slug);

  if (ketQua.trangThai === 'khong-thay') notFound();

  // A locked lesson is a normal outcome, so it gets a real page — not an error
  // boundary and not an HTTP 500.
  if (ketQua.trangThai === 'khoa') {
    return (
      <VoHocSinh tenHienThi={actor.displayName}>
        <DuongDan
          muc={[
            { nhan: 'Trang chính', href: '/bang-dieu-khien' },
            { nhan: ketQua.khoaHoc.title, href: `/khoa-hoc/${ketQua.khoaHoc.slug}` },
            { nhan: ketQua.tieuDe },
          ]}
        />

        <section className="rounded-the border border-vien bg-the p-6 sm:p-8">
          <p aria-hidden="true" className="m-0 text-4xl">
            🔒
          </p>
          <h1 className="mt-3 mb-2 text-2xl font-bold">{ketQua.tieuDe}</h1>
          <p className="mt-0 mb-6 text-lg text-chu-phu">{ketQua.lyDo}</p>

          <Link
            href={`/khoa-hoc/${ketQua.khoaHoc.slug}`}
            className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
          >
            <span aria-hidden="true">←</span>
            Về bản đồ khoá học
          </Link>
        </section>
      </VoHocSinh>
    );
  }

  const bai = ketQua.bai;

  return (
    <VoHocSinh tenHienThi={actor.displayName} nhanh={bai.tier}>
      <DuongDan
        muc={[
          { nhan: 'Trang chính', href: '/bang-dieu-khien' },
          { nhan: bai.course.title, href: `/khoa-hoc/${bai.course.slug}` },
          { nhan: bai.module.title },
          { nhan: `Buổi ${bai.order}` },
        ]}
      />

      <header className="mb-6">
        <p className="m-0 text-sm font-semibold tracking-wide text-chinh uppercase">
          Buổi {bai.order} · khoảng {bai.estimatedMinutes} phút
        </p>
        <h1 className="mt-1 mb-3 text-3xl leading-tight font-bold sm:text-4xl">{bai.title}</h1>
        <p className="m-0 text-lg text-chu-phu">{bai.summary}</p>
      </header>

      {/* "What will I learn?" — the objectives double as a checklist. */}
      {bai.objectives.length > 0 ? (
        <section
          aria-labelledby="muc-tieu-bai-hoc"
          className="mb-6 rounded-the border border-vien bg-the p-5"
        >
          <h2 id="muc-tieu-bai-hoc" className="mt-0 mb-3 text-base font-bold">
            Sau bài này em sẽ
          </h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {bai.objectives.map((m, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden="true" className="text-chinh">
                  ○
                </span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-6">
        <ThanhChang blocks={bai.blocks} />
      </div>

      <div className="mb-6 rounded-the border border-vien bg-the p-5">
        <ThanhTienDo
          nhan="Phần bắt buộc trong bài này"
          phanTram={
            bai.soBatBuoc === 0 ? 0 : Math.round((bai.soBatBuocXong / bai.soBatBuoc) * 100)
          }
          daXong={bai.soBatBuocXong}
          tong={bai.soBatBuoc}
          chuaGiao={bai.soBatBuoc === 0}
        />
      </div>

      <div className="space-y-5">
        {bai.blocks.map((khoi) => (
          <KhoiNoiDung key={khoi.blockId} khoi={khoi} />
        ))}
      </div>

      {/* "What's next?" at the end of the lesson, too. */}
      <nav
        aria-label="Chuyển bài"
        className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-vien pt-6"
      >
        {bai.truoc ? (
          <Link
            href={`/bai-hoc/${bai.truoc.slug}`}
            className="flex min-h-cham items-center gap-2 rounded-nut border border-vien px-4 py-2.5 font-medium text-chu-phu hover:border-chinh hover:text-chinh"
          >
            <span aria-hidden="true">←</span>
            Buổi {bai.truoc.order}
          </Link>
        ) : (
          <span />
        )}

        {bai.sau ? (
          bai.sau.unlocked ? (
            <Link
              href={`/bai-hoc/${bai.sau.slug}`}
              className="flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
            >
              Buổi {bai.sau.order} · {bai.sau.title}
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <p className="m-0 max-w-sm text-end text-sm text-chu-phu">
              Hoàn thành bài này để mở Buổi {bai.sau.order}.
            </p>
          )
        ) : (
          <Link
            href={`/khoa-hoc/${bai.course.slug}`}
            className="flex min-h-cham items-center gap-2 rounded-nut border border-vien px-4 py-2.5 font-medium"
          >
            Về bản đồ khoá học
          </Link>
        )}
      </nav>
    </VoHocSinh>
  );
}
