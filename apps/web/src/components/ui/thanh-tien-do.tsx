/**
 * Progress bar.
 *
 * Exposed as a real `progressbar` role with min/max/now, so a screen reader
 * announces "62 phần trăm" rather than reading a decorative div.
 *
 * The `chuaGiao` case exists because Phase 4 distinguishes "finished" from
 * "nothing assigned yet" — both would otherwise render as a full bar, which
 * would tell a student they had completed work they were never given.
 *
 * ── The percentage is derived here, not trusted ──────────────────────────────
 * `phanTram` comes from `LessonProgress.percent`, a cache column that is
 * written by one code path and read by a dozen. A row that was created before
 * the column existed, or whose sync was skipped, reads as 0 — and a child with
 * four finished lessons sees "4/15 · 0%", which to them means "the system lost
 * my work". Whenever the counts are supplied, the bar recomputes
 * `Math.round(daXong / tong * 100)` and uses whichever is higher: the cached
 * number carries partial credit for half-finished lessons that the counts do
 * not, so it is kept when it is honest, and overruled when it is stale.
 */
export function tinhPhanTram(daXong: number, tong: number): number {
  return tong > 0 ? Math.round((daXong / tong) * 100) : 0;
}

export function ThanhTienDo({
  phanTram,
  nhan,
  daXong,
  tong,
  chuaGiao = false,
  cao = 'thuong',
}: {
  phanTram: number;
  nhan: string;
  daXong?: number;
  tong?: number;
  chuaGiao?: boolean;
  cao?: 'thuong' | 'lon';
}) {
  const coDem = typeof daXong === 'number' && typeof tong === 'number';
  const tuDem = coDem ? tinhPhanTram(daXong, tong) : 0;
  const thucTe = Math.max(Number.isFinite(phanTram) ? phanTram : 0, tuDem);

  const giaTri = chuaGiao ? 0 : Math.max(0, Math.min(100, thucTe));
  const xong = !chuaGiao && giaTri >= 100;

  const moTa = chuaGiao
    ? 'Chưa có bài bắt buộc nào được giao'
    : coDem
      ? `${daXong} trên ${tong} bài, ${giaTri} phần trăm`
      : `${giaTri} phần trăm`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-chu">{nhan}</span>
        <span className="text-sm text-chu-phu tabular-nums">
          {chuaGiao ? 'Chưa giao bài' : `${daXong ?? ''}${tong ? `/${tong}` : ''} · ${giaTri}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={giaTri}
        aria-valuetext={moTa}
        aria-label={nhan}
        className={`w-full overflow-hidden rounded-full bg-white/[0.08] ${
          cao === 'lon' ? 'h-4' : 'h-3'
        }`}
      >
        {/*
          Two different fills, not one.

          In progress is the brand gradient, violet running to pink; finished
          is solid green. If both were the gradient the bar would stop saying
          anything until it happened to reach the end, and the 🎉 line below
          carries the same news in words for anyone who cannot tell the two
          apart.
        */}
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            xong
              ? 'bg-dung'
              : 'bg-linear-to-r from-chinh to-hong shadow-[0_0_12px_rgba(124,58,237,0.55)]'
          }`}
          style={{ width: `${giaTri}%` }}
        />
      </div>

      {xong ? (
        <p className="mt-2 text-sm font-semibold text-dung">🎉 Em đã hoàn thành phần này!</p>
      ) : null}
    </div>
  );
}
