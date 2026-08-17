/**
 * Progress bar.
 *
 * Exposed as a real `progressbar` role with min/max/now, so a screen reader
 * announces "62 phần trăm" rather than reading a decorative div.
 *
 * The `chuaGiao` case exists because Phase 4 distinguishes "finished" from
 * "nothing assigned yet" — both would otherwise render as a full bar, which
 * would tell a student they had completed work they were never given.
 */
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
  const giaTri = chuaGiao ? 0 : Math.max(0, Math.min(100, phanTram));
  const xong = !chuaGiao && giaTri >= 100;

  const moTa = chuaGiao
    ? 'Chưa có bài bắt buộc nào được giao'
    : typeof daXong === 'number' && typeof tong === 'number'
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
        className={`w-full overflow-hidden rounded-full bg-the-mo ${
          cao === 'lon' ? 'h-4' : 'h-3'
        }`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            xong ? 'bg-dung' : 'bg-chinh'
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
