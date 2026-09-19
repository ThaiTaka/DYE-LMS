/**
 * Initials avatar.
 *
 * Nobody uploads a photo here — accounts are provisioned by a teacher, and a
 * roster of thirty identical grey circles gives the eye nothing to land on.
 * Two letters on the brand gradient is enough to tell rows apart at a glance
 * and to make the corner of the nav read as "you".
 *
 * ── Which letters ────────────────────────────────────────────────────────────
 * Vietnamese names run family → middle → given, so "Từ Minh Nguyên" is "TN":
 * the first letter of the first word and of the last. One word gives one
 * letter; an empty name gives "?" rather than an empty circle, which would
 * look like a rendering failure.
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * By default it is an image named after the person, so a screen reader in the
 * nav (where the name is visually hidden below `md`) still says who is signed
 * in. Where the name is already printed beside it, pass `trangTri` and the
 * circle becomes decoration, so the name is not read twice.
 */
export function chuCaiTen(ten: string): string {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) return '?';

  const dau = tu[0]?.[0] ?? '';
  const cuoi = tu.length > 1 ? (tu[tu.length - 1]?.[0] ?? '') : '';

  return `${dau}${cuoi}`.toLocaleUpperCase('vi') || '?';
}

const CO = {
  nho: 'size-8 text-xs',
  vua: 'size-10 text-sm',
  lon: 'size-14 text-lg',
} as const;

export function Avatar({
  name,
  co = 'vua',
  trangTri = false,
  className = '',
}: {
  name: string;
  co?: keyof typeof CO;
  /** True when the name is printed right next to it — hides it from readers. */
  trangTri?: boolean;
  className?: string;
}) {
  const chuCai = chuCaiTen(name);
  const lop = `grid shrink-0 select-none place-items-center rounded-full bg-linear-to-br from-chinh to-hong font-bold text-white ring-2 ring-white/10 shadow-[0_0_14px_rgba(124,58,237,0.45)] ${CO[co]} ${className}`;

  if (trangTri) {
    return (
      <span aria-hidden="true" className={lop}>
        {chuCai}
      </span>
    );
  }

  return (
    <span role="img" aria-label={name} title={name} className={lop}>
      {chuCai}
    </span>
  );
}
