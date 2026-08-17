import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { VoHocSinh } from '@/components/hoc-sinh/vo';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireSession } from '@/lib/guard';
import { duLieuBanDoKhoaHoc } from '@/lib/student-data';

import type { LessonAccess } from '@dye/core';

export default async function BanDoKhoaHoc({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requireSession();
  const { slug } = await params;

  const data = await duLieuBanDoKhoaHoc(actor.id, slug);
  if (!data) notFound();

  return (
    <VoHocSinh tenHienThi={actor.displayName} nhanh={data.progress.tier}>
      <DuongDan muc={[{ nhan: 'Trang chính', href: '/bang-dieu-khien' }, { nhan: data.title }]} />

      <header className="mb-7">
        <h1 className="mt-0 mb-2 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
          <span aria-hidden="true">{data.iconEmoji}</span>
          {data.title}
        </h1>
        <p className="mt-0 mb-5 text-chu-phu">{data.subtitle}</p>

        <div className="rounded-the border border-vien bg-the p-5">
          <ThanhTienDo
            nhan="Phần bắt buộc của em"
            phanTram={data.progress.required.percent}
            daXong={data.progress.required.completed}
            tong={data.progress.required.total}
            chuaGiao={!data.progress.hasRequiredWork}
            cao="lon"
          />
        </div>
      </header>

      <ol className="m-0 list-none space-y-6 p-0">
        {data.modules.map((m) => (
          <li key={m.moduleId}>
            <section aria-labelledby={`mo-dun-${m.moduleId}`}>
              <div className="mb-3">
                <h2
                  id={`mo-dun-${m.moduleId}`}
                  className="mt-0 mb-1 text-xl leading-snug font-bold"
                >
                  {m.title}
                </h2>
                <p className="m-0 text-sm text-chu-phu">
                  Buổi {m.sessionFrom}–{m.sessionTo}
                  {m.soBatBuoc > 0 ? (
                    <>
                      {' '}
                      · {m.soDaXong}/{m.soBatBuoc} bài bắt buộc
                    </>
                  ) : (
                    <> · toàn bộ là bài tuỳ chọn</>
                  )}
                </p>
              </div>

              <ul className="m-0 list-none space-y-2 p-0">
                {m.lessons.map((l) => (
                  <li key={l.lessonId}>
                    <MucBaiHoc bai={l} />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        ))}
      </ol>
    </VoHocSinh>
  );
}

/**
 * One lesson row.
 *
 * A locked lesson renders as a non-interactive element with its reason spelled
 * out, rather than a link that errors when clicked. Telling a student exactly
 * what to finish first is more useful than a padlock with no explanation.
 */
function MucBaiHoc({ bai }: { bai: LessonAccess }) {
  const noiDung = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          bai.completed
            ? 'bg-dung text-white'
            : bai.unlocked
              ? 'bg-chinh-nhat text-chinh'
              : 'bg-the-mo text-chu-nhat'
        }`}
      >
        {bai.completed ? '✓' : bai.order}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-medium">{bai.title}</span>

        {!bai.isRequired ? (
          <span className="mt-0.5 block text-sm text-chu-nhat">🌟 Bài khám phá thêm</span>
        ) : null}

        {!bai.unlocked && bai.lockReason ? (
          <span className="mt-0.5 block text-sm text-chu-phu">{bai.lockReason}</span>
        ) : null}
      </span>

      {bai.completed ? (
        <span className="shrink-0 text-sm font-semibold text-dung">Đã xong</span>
      ) : null}
    </>
  );

  const chung = 'flex min-h-cham items-center gap-3 rounded-nut border p-3';

  if (!bai.unlocked) {
    return (
      <div
        className={`${chung} border-vien bg-the-mo/60 text-chu-phu`}
        // Not a button and not a link: there is nothing to activate here.
        aria-label={`Buổi ${bai.order}, ${bai.title}. Chưa mở. ${bai.lockReason ?? ''}`}
      >
        {noiDung}
      </div>
    );
  }

  return (
    <Link
      href={`/bai-hoc/${bai.slug}`}
      className={`${chung} border-vien bg-the hover:border-chinh`}
    >
      {noiDung}
    </Link>
  );
}
