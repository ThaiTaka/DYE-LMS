'use client';

import { useCallback, useState } from 'react';

/**
 * Lesson illustrations, with an honest fallback.
 *
 * ── Why this is a client component ───────────────────────────────────────────
 * `onError` is the only way a browser tells us an image did not arrive, and it
 * only exists on the client. The markdown renderer is a server module, so the
 * image itself has to cross the boundary.
 *
 * ── The bug `onError` alone does not fix ─────────────────────────────────────
 * The picture starts loading the moment the server-rendered HTML is parsed,
 * which is BEFORE React hydrates. A 404 on a small file routinely resolves
 * first, so the `error` event fires while no React handler is attached yet and
 * is simply lost — leaving the broken-image glyph on screen with the fallback
 * never triggered. The `ref` callback closes that gap: on attach it asks the DOM
 * what already happened (`complete` with `naturalWidth === 0` means "finished,
 * and there is nothing there"), so an error that fired before hydration is
 * picked up rather than missed.
 *
 * ── A missing image renders NOTHING ──────────────────────────────────────────
 * The curriculum ships illustration paths ahead of the files themselves, so a
 * missing image is a NORMAL state during authoring, not a fault. This used to
 * draw a dashed box reading "Hình minh hoạ đang được vẽ", which was worse than
 * the gap it filled: on a lesson with several pending illustrations the page
 * became a column of grey boxes, and a student reading it could not tell an
 * unfinished drawing from a broken site.
 *
 * So a failed load now collapses to nothing at all and the prose closes over
 * it. The surrounding text was always written to stand on its own — the
 * pictures illustrate it rather than carry it.
 *
 * A stock image from a CDN was the other option and is not available: the CSP
 * in next.config.mjs allows `img-src 'self' data: blob:` only, so a remote
 * asset is blocked at the browser with no visible error. Widening that for
 * decoration would trade a real protection for a placeholder.
 */

type TrangThaiAnh = 'dang-tai' | 'hong';

/** Shared load-failure detection for both variants. */
function useAnhHong(): {
  hong: boolean;
  onError: () => void;
  ref: (el: HTMLImageElement | null) => void;
} {
  const [trangThai, setTrangThai] = useState<TrangThaiAnh>('dang-tai');

  const onError = useCallback(() => setTrangThai('hong'), []);

  const ref = useCallback((el: HTMLImageElement | null) => {
    if (!el) return;
    // Already finished before React got here, with nothing decoded: that is a
    // load failure whose event we never saw.
    if (el.complete && el.naturalWidth === 0) setTrangThai('hong');
  }, []);

  return { hong: trangThai === 'hong', onError, ref };
}

/**
 * A standalone illustration — its own block, with a caption.
 *
 * Rendered as `<figure>`, so it must only ever be placed where flow content is
 * allowed. The markdown renderer guarantees that by detecting image-only
 * paragraphs and emitting this OUTSIDE the `<p>`; see `renderMarkdown`.
 */
export function HinhBaiHoc({ src, alt }: { src: string; alt: string }) {
  const { hong, onError, ref } = useAnhHong();

  // Nothing at all, rather than a box explaining the absence.
  if (hong) return null;

  return (
    <figure className="hinh-bai-hoc">
      <img ref={ref} src={src} alt={alt} loading="lazy" decoding="async" onError={onError} />
      {alt ? <figcaption>{alt}</figcaption> : null}
    </figure>
  );
}

/**
 * An illustration sitting in the middle of a sentence.
 *
 * Every element here is PHRASING content — `<img>` and `<span>`, never
 * `<figure>` or `<div>` — because this one renders inside a `<p>`, a `<li>` or a
 * table cell. Putting flow content there is what produced the hydration
 * mismatch this component exists to prevent: the browser silently closes the
 * `<p>` before a `<figure>`, so the server's tree and the client's tree stop
 * matching and React throws.
 */
export function HinhTrongDong({ src, alt }: { src: string; alt: string }) {
  const { hong, onError, ref } = useAnhHong();

  if (hong) return null;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={onError}
      className="hinh-trong-dong"
    />
  );
}
