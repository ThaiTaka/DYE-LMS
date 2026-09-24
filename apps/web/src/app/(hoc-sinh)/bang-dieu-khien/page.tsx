import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BaiNopGanDay } from '@/components/hoc-sinh/bai-nop-gan-day';
import { MucVao, TheNoi, VaoTrang } from '@/components/hoc-sinh/chuyen-dong';
import { LuoiBaiTap } from '@/components/hoc-sinh/the-bai-tap';
import { TheHocTiep } from '@/components/hoc-sinh/the-hoc-tiep';
import { BieuTuong } from '@/components/ui/bieu-tuong';
import { KIEU_NHANH } from '@/components/ui/nhanh';
import { SAC_THAI } from '@/components/ui/sac-thai';
import { ChuNeon, TheKinh } from '@/components/ui/the-kinh';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireSession } from '@/lib/guard';
import { duLieuBangDieuKhien, type DuLieuBangDieuKhien } from '@/lib/student-data';
import { conLai } from '@/lib/thoi-gian';

/** Homework cards on the dashboard. The rest are one click away on `/bai-tap`. */
const SO_THE_BAI_TAP = 4;

export default async function BangDieuKhien() {
  const actor = await requireSession();

  // Staff have their own home. This route stays the single "take me to my
  // dashboard" link so nothing in the app needs to branch on role to build a URL.
  if (actor.role !== 'STUDENT') redirect('/giao-vien');

  const data = await duLieuBangDieuKhien(actor.id);
  const ten = actor.displayName.split(' ').slice(-1)[0];
  // One clock for the whole page, so every "còn 2 ngày" agrees with the others.
  const bayGio = new Date();

  // The list is sorted most-urgent-first, so the first to-do item is the
  // deadline the greeting should mention.
  const ganNhat = data.baiTapVeNha.find(
    (b) => b.trangThai === 'chua-nop' || b.trangThai === 'qua-han',
  );

  return (
    <>
      {/*
        The welcome banner — whose platform this is, then "where am I?".

        The same typography as the login page's branding cluster, so the
        student walks from one into the other: the full name as a mint →
        violet eyebrow in tracked capitals, then the loud line under it. Here
        the loud line is the greeting, and it is the `<h1>` — a screen reader
        arriving here wants "Chào Minh", not the product name the sidebar
        already said. Then the one sentence that matters today: with homework
        outstanding it says so, with the nearest deadline in words — a
        sentence, not a second call to action; the gradient button in the hero
        stays the only one on the page.

        The mascot stands still here, unlike on the login page. Bí already
        bobs in the corner of every student page, and two moving robots on one
        screen would be two things pulling at a child's eye. Its alt is empty
        because it only decorates the words beside it.

        No `kinh` blur: this is chrome over the page glow, and the blur is kept
        for the panels a student acts on. The glow, the grid (the login page's
        data grid, fading out to the right) and the top scanline are gradients,
        painted once and never animated. The eyebrow's glow is a `drop-shadow`
        filter because `text-shadow` would paint over clipped gradient text.
      */}
      <header className="relative isolate mb-6 overflow-hidden rounded-the border border-vien bg-be-mat/70 p-5 shadow-mem sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_34rem_20rem_at_0%_0%,rgba(124,58,237,0.3),transparent_70%),radial-gradient(ellipse_30rem_16rem_at_100%_100%,rgba(94,234,212,0.08),transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(167,139,250,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(167,139,250,0.08)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_right,#000,transparent_80%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-chinh-sang/70 to-transparent" />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* Glow on the wrapper, mask on the image — see the login page for why. */}
          <div className="shrink-0 drop-shadow-[0_0_15px_rgba(94,234,212,0.5)]">
            <Image
              src="/hinh/logo.png"
              alt=""
              width={96}
              height={96}
              priority
              className="size-20 [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] sm:size-24"
            />
          </div>

          <div className="min-w-0">
            <p className="m-0 text-xs leading-relaxed font-semibold tracking-widest text-balance uppercase drop-shadow-[0_0_8px_rgba(94,234,212,0.35)]">
              <span className="bg-linear-to-r from-ngoc to-chinh-sang bg-clip-text text-transparent">
                DaLat Young Engineers Learning Management System
              </span>
            </p>
            <h1 className="mt-2 mb-1 text-3xl leading-tight font-extrabold sm:text-4xl">
              Chào <ChuNeon>{ten}</ChuNeon> 👋
            </h1>
            {ganNhat ? (
              <p className="m-0 text-chu-phu">
                Em có{' '}
                <a
                  href="#tieu-de-bai-tap"
                  className="font-semibold text-chinh-sang underline-offset-2 hover:underline"
                >
                  {data.soBaiTapCanLam} bài tập về nhà
                </a>{' '}
                cần nộp — bài gần nhất {conLai(ganNhat.hanNop, bayGio).chu}.
              </p>
            ) : (
              <p className="m-0 text-chu-phu">Hôm nay em muốn học gì?</p>
            )}
          </div>
        </div>
      </header>

      {/*
        The asymmetric grid.

        Two columns from `xl`: a wide one (≈62%) for the things the student
        acts on — the hero, their homework, their courses — and a narrow one
        (22rem, sticky) for the things they glance at: counts, badges, recent
        hand-ins. Below `xl` it is one column in the same reading order, so
        nothing moves around between a laptop and a tablet.

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

          <MucVao>
            <PhanBaiTapVeNha data={data} bayGio={bayGio} />
          </MucVao>

          {/* "What did I learn?" — one card per course, progress on the student's own track. */}
          <MucVao>
            <section aria-labelledby="tieu-de-khoa-hoc">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 id="tieu-de-khoa-hoc" className="m-0 text-xl font-bold">
                  Khoá học của em
                </h2>
                <span className="text-sm font-medium text-chu-nhat">
                  {data.courses.length} khoá
                </span>
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
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${kieu.huyHieu}`}
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
                                <p className="mt-3 mb-0 text-sm font-medium text-chu-nhat">
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

/**
 * "Bài tập về nhà" — what the teacher asked for, and where each piece stands.
 *
 * ── Why it sits directly under the hero ──────────────────────────────────────
 * "Học tiếp" answers "what's next in the course?"; this answers "what did my
 * teacher ask me to do by Friday?". The second has a deadline, so it is the
 * first thing below the fold on every screen size — above the courses, which
 * are the long-term view.
 *
 * ── The one highlighted card ─────────────────────────────────────────────────
 * With work outstanding the section is the page's `noiBat` panel — the
 * gradient hairline `TheKinh` reserves for the one "look here" per screen.
 * With nothing to do it drops to a plain panel: a glowing border around "no
 * homework" would be asking for attention it has not earned.
 */
function PhanBaiTapVeNha({ data, bayGio }: { data: DuLieuBangDieuKhien; bayGio: Date }) {
  const canLam = data.soBaiTapCanLam;
  const hienThi = data.baiTapVeNha.slice(0, SO_THE_BAI_TAP);

  return (
    <TheKinh
      as="section"
      noiBat={canLam > 0}
      aria-labelledby="tieu-de-bai-tap"
      className="scroll-mt-24 p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-the-nho border border-white/10 bg-chinh-nhat text-chinh-sang"
          >
            <BieuTuong ten="baiTap" className="size-6" />
          </span>
          <h2 id="tieu-de-bai-tap" className="m-0 text-xl font-bold">
            Bài tập về nhà
          </h2>
          {canLam > 0 ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.chinh}`}>
              {canLam} bài cần làm
            </span>
          ) : null}
        </div>

        {data.baiTapVeNha.length > 0 ? (
          <Link
            href="/bai-tap"
            className="inline-flex min-h-cham items-center gap-1.5 rounded-nut px-2 text-sm font-semibold text-chinh-sang hover:underline"
          >
            Xem tất cả ({data.baiTapVeNha.length})
            <BieuTuong ten="muiTen" className="size-4" />
          </Link>
        ) : null}
      </div>

      {hienThi.length === 0 ? (
        <p className="m-0 rounded-the-nho border border-white/10 bg-be-mat p-5 text-chu-phu">
          <span aria-hidden="true">🎉 </span>
          Em chưa có bài tập về nhà nào. Khi thầy cô giao bài, bài sẽ hiện ngay ở đây.
        </p>
      ) : (
        <LuoiBaiTap baiTap={hienThi} bayGio={bayGio} />
      )}
    </TheKinh>
  );
}
