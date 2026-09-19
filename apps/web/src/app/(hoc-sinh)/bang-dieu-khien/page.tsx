import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BaiNopGanDay } from '@/components/hoc-sinh/bai-nop-gan-day';
import { MucVao, TheNoi, VaoTrang } from '@/components/hoc-sinh/chuyen-dong';
import { TheHocTiep } from '@/components/hoc-sinh/the-hoc-tiep';
import { BieuTuong } from '@/components/ui/bieu-tuong';
import { KIEU_NHANH } from '@/components/ui/nhanh';
import { ChuNeon, TheKinh } from '@/components/ui/the-kinh';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireSession } from '@/lib/guard';
import { duLieuBangDieuKhien } from '@/lib/student-data';

export default async function BangDieuKhien() {
  const actor = await requireSession();

  // Staff have their own home. This route stays the single "take me to my
  // dashboard" link so nothing in the app needs to branch on role to build a URL.
  if (actor.role !== 'STUDENT') redirect('/giao-vien');

  const data = await duLieuBangDieuKhien(actor.id);
  const ten = actor.displayName.split(' ').slice(-1)[0];

  return (
    <>
      {/* "Where am I?" — greeting, then the two numbers that matter live in the side column. */}
      <header className="mb-6">
        <h1 className="mt-0 mb-1 text-3xl font-extrabold sm:text-4xl">
          Chào <ChuNeon>{ten}</ChuNeon> 👋
        </h1>
        <p className="m-0 text-chu-phu">Hôm nay em muốn học gì?</p>
      </header>

      {/*
        The asymmetric grid.

        Two columns from `xl`: a wide one (≈62%) for the things the student
        acts on — the hero and the courses — and a narrow one (22rem, sticky)
        for the things they glance at: counts, badges, recent hand-ins. Below
        `xl` it is one column in the same reading order, so nothing moves
        around between a laptop and a tablet.

        Everything arrives in sequence — the hero first, then the cards. It
        runs once, on load: the point is that the page reads as ready, not
        that it performs.
      */}
      <VaoTrang className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_22rem] xl:items-start">
        {/* ── Wide column ─────────────────────────────────────────────────── */}
        <div className="grid gap-6">
          <MucVao>
            <TheHocTiep tiepTuc={data.tiepTuc} />
          </MucVao>

          {/* "What did I learn?" — one card per course, progress on the student's own track. */}
          <MucVao>
            <section aria-labelledby="tieu-de-khoa-hoc">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 id="tieu-de-khoa-hoc" className="m-0 text-xl font-bold">
                  Khoá học của em
                </h2>
                <span className="text-sm text-chu-nhat">{data.courses.length} khoá</span>
              </div>

              {data.courses.length === 0 ? (
                <TheKinh className="p-6 text-chu-phu">
                  Chưa có khoá học nào. Hãy hỏi thầy cô nhé.
                </TheKinh>
              ) : (
                <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                  {data.courses.map((c) => {
                    const kieu = KIEU_NHANH[c.tier];
                    return (
                      <li key={c.courseId}>
                        <TheNoi className="h-full">
                          <Link
                            href={`/khoa-hoc/${c.slug}`}
                            className="kinh flex h-full flex-col rounded-the p-5 transition-colors hover:border-chinh-sang/60"
                          >
                            <div className="mb-4 flex items-start gap-3">
                              <span
                                aria-hidden="true"
                                className="grid size-12 shrink-0 place-items-center rounded-the-nho border border-white/10 bg-white/[0.05] text-2xl leading-none"
                              >
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

                            <div className="mt-auto">
                              <ThanhTienDo
                                nhan="Phần bắt buộc của em"
                                phanTram={c.progress.required.percent}
                                daXong={c.progress.required.completed}
                                tong={c.progress.required.total}
                                chuaGiao={!c.progress.hasRequiredWork}
                              />

                              {c.progress.optional.total > 0 ? (
                                <p className="mt-3 mb-0 text-sm text-chu-nhat">
                                  🌟 {c.progress.optional.completed}/{c.progress.optional.total} bài
                                  khám phá thêm
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        </TheNoi>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </MucVao>
        </div>

        {/* ── Narrow column ───────────────────────────────────────────────── */}
        <aside
          aria-label="Tổng quan của em"
          className="grid gap-4 xl:sticky xl:top-[calc(var(--spacing-thanh-tren)+1.5rem)]"
        >
          <MucVao className="grid grid-cols-2 gap-4">
            <TheKinh nho className="p-4">
              <p className="m-0 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-chu-nhat uppercase">
                <BieuTuong ten="xong" className="size-4 text-dung" />
                Bài đã xong
              </p>
              <p className="mt-1 mb-0 text-3xl font-extrabold tabular-nums">
                <ChuNeon>{data.tongBaiDaXong}</ChuNeon>
              </p>
            </TheKinh>
            <TheKinh nho className="p-4">
              <p className="m-0 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-chu-nhat uppercase">
                <BieuTuong ten="lua" className="size-4 text-thu-lai" />
                Chuỗi ngày
              </p>
              <p className="mt-1 mb-0 text-3xl font-extrabold tabular-nums">
                <ChuNeon>{data.chuoiNgay}</ChuNeon>
                <span className="ms-1 text-base font-semibold text-chu-phu">ngày</span>
              </p>
            </TheKinh>
          </MucVao>

          {data.huyHieu.length > 0 ? (
            <MucVao>
              <TheKinh as="section" aria-labelledby="tieu-de-huy-hieu" className="p-5">
                <h2 id="tieu-de-huy-hieu" className="mt-0 mb-3 text-base font-bold">
                  Huy hiệu của em
                </h2>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {data.huyHieu.map((h) => (
                    <li
                      key={h.slug}
                      className="flex items-center gap-2 rounded-full border border-vien bg-white/[0.04] px-3 py-1.5 text-sm font-medium"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {h.iconEmoji}
                      </span>
                      {h.name}
                    </li>
                  ))}
                </ul>
              </TheKinh>
            </MucVao>
          ) : null}

          {/*
            Recent hand-ins.

            This is the answer to "did the system get my work?" — the question a
            student asks after every submit. It shows every attempt, including
            the ones still in the queue, so a pending verdict reads as "being
            graded" rather than as silence.
          */}
          <MucVao>
            <BaiNopGanDay baiNop={data.baiNopGanDay} />
          </MucVao>
        </aside>
      </VaoTrang>
    </>
  );
}
