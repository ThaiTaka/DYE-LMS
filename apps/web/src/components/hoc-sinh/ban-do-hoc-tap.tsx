import Link from 'next/link';

import { TheKiemTra } from './the-kiem-tra';

import type { BaiThiHienThi, LessonAccess } from '@dye/core';
import type { MoDunBanDo } from '@/lib/student-data';

/**
 * The learning roadmap — "Bản đồ học tập".
 *
 * ── Built for a ten-year-old scanning a page ─────────────────────────────────
 * The whole course is one vertical path. Every lesson is a stop on it with a
 * big circle: ✓ done, a number for the one to do next, a padlock for the
 * rest. The next stop is the only thing on the page with colour and a button,
 * because "what do I do now?" is the question the page exists to answer and
 * it should be answerable from across the room.
 *
 * Text is one size up from the rest of the app. Targets are 56 px tall where
 * they are interactive. Nothing is conveyed by colour alone: every state has
 * an icon and a word.
 *
 * ── What is deliberately absent ──────────────────────────────────────────────
 * Percentages per lesson, block counts, tier badges. Those are for the
 * dashboard and the teacher. Here a stop is done, next, or not yet — three
 * states, three pictures.
 */

export function BanDoHocTap({
  modules,
  kiemTra,
  tiepTheo,
}: {
  modules: MoDunBanDo[];
  kiemTra: BaiThiHienThi[];
  /** The lesson to do next, if any. Drawn as the hero at the top. */
  tiepTheo: { slug: string; title: string; order: number } | null;
}) {
  return (
    <div className="space-y-10">
      {tiepTheo ? <HocTiep bai={tiepTheo} /> : null}

      <ol className="m-0 list-none space-y-10 p-0">
        {modules.map((m, i) => (
          <li key={m.moduleId}>
            <section aria-labelledby={`chang-${m.moduleId}`}>
              <CotMoc
                id={`chang-${m.moduleId}`}
                soThuTu={i + 1}
                title={m.title}
                sessionFrom={m.sessionFrom}
                sessionTo={m.sessionTo}
                daXong={m.soBatBuoc > 0 && m.soDaXong === m.soBatBuoc}
              />

              <ol className="relative m-0 list-none p-0 ps-8 sm:ps-10">
                {/* The path itself: one line every stop hangs off. */}
                <span
                  aria-hidden="true"
                  className="absolute top-0 bottom-0 left-[1.35rem] w-1 rounded-full bg-vien sm:left-[1.85rem]"
                />
                {m.lessons.map((l) => (
                  <li key={l.lessonId} className="relative py-2">
                    <Buoc bai={l} laTiepTheo={tiepTheo?.slug === l.slug} />
                  </li>
                ))}
                {kiemTra
                  .filter((k) => k.afterLessonOrder >= m.sessionFrom && k.afterLessonOrder <= m.sessionTo)
                  .map((k) => (
                    <li key={k.examId} className="relative py-2">
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 -left-8 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border-4 border-nen bg-mo-rong text-lg text-white sm:-left-10 sm:size-11"
                      >
                        🏁
                      </span>
                      <TheKiemTra bai={k} />
                    </li>
                  ))}
              </ol>
            </section>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The one thing on the page a student should see first. */
function HocTiep({ bai }: { bai: { slug: string; title: string; order: number } }) {
  return (
    <section
      aria-labelledby="hoc-tiep"
      className="kinh vien-neon rounded-the border-transparent p-5 sm:p-6"
    >
      <p className="m-0 text-sm font-bold tracking-wide text-chinh-sang uppercase">
        <span aria-hidden="true">👉 </span>Bước tiếp theo của em
      </p>
      <h2 id="hoc-tiep" className="mt-1 mb-4 text-2xl leading-snug font-bold sm:text-3xl">
        Buổi {bai.order} · {bai.title}
      </h2>
      <Link
        href={`/bai-hoc/${bai.slug}`}
        className="nut-neon min-h-[3.5rem] px-7 text-xl font-bold"
      >
        Học tiếp
        <span aria-hidden="true" className="text-2xl">
          →
        </span>
      </Link>
    </section>
  );
}

/** A module boundary on the path: a flag, a name, a session range. */
function CotMoc({
  id,
  soThuTu,
  title,
  sessionFrom,
  sessionTo,
  daXong,
}: {
  id: string;
  soThuTu: number;
  title: string;
  sessionFrom: number;
  sessionTo: number;
  daXong: boolean;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl sm:size-14 sm:text-2xl ${
          daXong ? 'bg-dung text-nen' : 'bg-the border-2 border-vien'
        }`}
      >
        {daXong ? '🏆' : '🚩'}
      </span>
      <div className="min-w-0">
        <p className="m-0 text-sm font-semibold text-chu-nhat">
          Chặng {soThuTu} · Buổi {sessionFrom}–{sessionTo}
        </p>
        <h2 id={id} className="m-0 text-xl leading-snug font-bold sm:text-2xl">
          {title}
        </h2>
      </div>
    </div>
  );
}

/**
 * One stop on the path.
 *
 * Three states, three pictures:
 *   done   — green circle with a tick, quiet text, still a link (re-reading is
 *            allowed and common).
 *   next   — the number in the course colour, a ring, and a "Bắt đầu" button.
 *            The ONLY stop with a button.
 *   locked — grey padlock, the reason in plain words, nothing to click.
 */
function Buoc({ bai, laTiepTheo }: { bai: LessonAccess; laTiepTheo: boolean }) {
  const trangThai = bai.completed ? 'xong' : bai.unlocked ? (laTiepTheo ? 'tiep' : 'mo') : 'khoa';

  const vong = {
    xong: 'bg-dung text-nen',
    tiep: 'bg-chinh text-white ring-4 ring-chinh/30',
    mo: 'bg-the border-2 border-chinh text-chinh-sang',
    khoa: 'bg-the-mo border-2 border-vien text-chu-nhat',
  }[trangThai];

  const nhan = {
    xong: { chu: 'Đã xong', mau: 'text-dung', icon: '✅' },
    tiep: { chu: 'Làm tiếp nhé!', mau: 'text-chinh-sang', icon: '▶' },
    mo: { chu: 'Đã mở', mau: 'text-chu-phu', icon: '📖' },
    khoa: { chu: 'Chưa mở', mau: 'text-chu-nhat', icon: '🔒' },
  }[trangThai];

  const vienThe = {
    xong: 'border-dung/40 bg-the',
    tiep: 'border-chinh bg-chinh-nhat shadow-neon',
    mo: 'border-vien bg-the',
    khoa: 'border-vien bg-the-mo/60',
  }[trangThai];

  const noiDung = (
    <>
      <span
        aria-hidden="true"
        className={`absolute top-1/2 -left-8 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border-4 border-nen text-base font-bold sm:-left-10 sm:size-11 sm:text-lg ${vong}`}
      >
        {trangThai === 'xong' ? '✓' : trangThai === 'khoa' ? '🔒' : bai.order}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-chu-nhat">Buổi {bai.order}</span>
        <span className="block text-lg leading-snug font-bold sm:text-xl">{bai.title}</span>
        <span className={`mt-1 block text-base font-semibold ${nhan.mau}`}>
          <span aria-hidden="true">{nhan.icon} </span>
          {nhan.chu}
          {!bai.isRequired ? <span className="ms-2 font-normal text-chu-nhat">· 🌟 làm thêm</span> : null}
        </span>
        {trangThai === 'khoa' && bai.lockReason ? (
          <span className="mt-1 block text-base text-chu-phu">{bai.lockReason}</span>
        ) : null}
      </span>

      {trangThai === 'tiep' ? (
        <span className="hidden shrink-0 items-center gap-2 rounded-nut border border-white/15 bg-linear-to-r from-chinh to-hong px-5 py-2.5 text-base font-bold text-white shadow-neon sm:inline-flex">
          Bắt đầu <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </>
  );

  const chung = `relative flex min-h-[3.5rem] items-center gap-4 rounded-the border-2 p-4 ${vienThe}`;

  if (trangThai === 'khoa') {
    return (
      <div className={`${chung} text-chu-phu`} aria-label={`Buổi ${bai.order}, ${bai.title}. Chưa mở. ${bai.lockReason ?? ''}`}>
        {noiDung}
      </div>
    );
  }

  return (
    <Link
      href={`/bai-hoc/${bai.slug}`}
      aria-current={trangThai === 'tiep' ? 'step' : undefined}
      className={`${chung} hover:border-chinh focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chinh-sang`}
    >
      {noiDung}
    </Link>
  );
}
