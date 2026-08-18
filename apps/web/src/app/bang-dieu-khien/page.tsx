import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TheHocTiep } from '@/components/hoc-sinh/the-hoc-tiep';
import { VoHocSinh } from '@/components/hoc-sinh/vo';
import { KIEU_NHANH } from '@/components/ui/nhanh';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireSession } from '@/lib/guard';
import { duLieuBangDieuKhien } from '@/lib/student-data';

export default async function BangDieuKhien() {
  const actor = await requireSession();

  // Staff have their own home. This route stays the single "take me to my
  // dashboard" link so nothing in the app needs to branch on role to build a URL.
  if (actor.role !== 'STUDENT') redirect('/giao-vien');

  const data = await duLieuBangDieuKhien(actor.id);
  const nhanh = data.courses[0]?.tier;

  return (
    <VoHocSinh tenHienThi={actor.displayName} nhanh={nhanh}>
      {/* "Where am I?" — greeting plus the two numbers that actually matter. */}
      <header className="mb-7">
        <h1 className="mt-0 mb-2 text-3xl font-bold sm:text-4xl">
          Chào {actor.displayName.split(' ').slice(-1)[0]} 👋
        </h1>
        <p className="m-0 text-chu-phu">
          Em đã hoàn thành <strong className="text-chu">{data.tongBaiDaXong}</strong> bài học
          {data.chuoiNgay > 1 ? (
            <>
              {' '}
              · chuỗi <strong className="text-chu">{data.chuoiNgay} ngày</strong> liên tiếp 🔥
            </>
          ) : null}
        </p>
      </header>

      <div className="mb-8">
        <TheHocTiep tiepTuc={data.tiepTuc} />
      </div>

      {/* "What did I learn?" — one card per course, progress on the student's own track. */}
      <section aria-labelledby="tieu-de-khoa-hoc" className="mb-8">
        <h2 id="tieu-de-khoa-hoc" className="mt-0 mb-4 text-xl font-bold">
          Khoá học của em
        </h2>

        {data.courses.length === 0 ? (
          <p className="rounded-the border border-vien bg-the p-6 text-chu-phu">
            Chưa có khoá học nào. Hãy hỏi thầy cô nhé.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
            {data.courses.map((c) => {
              const kieu = KIEU_NHANH[c.tier];
              return (
                <li key={c.courseId}>
                  <Link
                    href={`/khoa-hoc/${c.slug}`}
                    className="block h-full rounded-the border border-vien bg-the p-5 transition-colors hover:border-chinh"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <span aria-hidden="true" className="text-3xl leading-none">
                        {c.iconEmoji}
                      </span>
                      <div className="min-w-0">
                        <h3 className="mt-0 mb-1 text-lg leading-snug font-semibold text-chu">
                          {c.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${kieu.nen} ${kieu.chu} ${kieu.vien}`}
                        >
                          <span aria-hidden="true">{kieu.icon}</span>
                          {kieu.nhan}
                        </span>
                      </div>
                    </div>

                    <ThanhTienDo
                      nhan="Phần bắt buộc của em"
                      phanTram={c.progress.required.percent}
                      daXong={c.progress.required.completed}
                      tong={c.progress.required.total}
                      chuaGiao={!c.progress.hasRequiredWork}
                    />

                    {c.progress.optional.total > 0 ? (
                      <p className="mt-3 mb-0 text-sm text-chu-nhat">
                        🌟 {c.progress.optional.completed}/{c.progress.optional.total} bài khám phá
                        thêm
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.huyHieu.length > 0 ? (
        <section aria-labelledby="tieu-de-huy-hieu">
          <h2 id="tieu-de-huy-hieu" className="mt-0 mb-4 text-xl font-bold">
            Huy hiệu của em
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {data.huyHieu.map((h) => (
              <li
                key={h.slug}
                className="flex items-center gap-2 rounded-full border border-vien bg-the px-4 py-2 text-sm font-medium"
              >
                <span aria-hidden="true" className="text-lg">
                  {h.iconEmoji}
                </span>
                {h.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </VoHocSinh>
  );
}
