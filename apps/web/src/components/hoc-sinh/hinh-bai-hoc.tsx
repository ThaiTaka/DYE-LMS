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
 * ── What the fallback says ───────────────────────────────────────────────────
 * The curriculum ships illustration paths ahead of the files themselves, so a
 * missing image is a NORMAL state during authoring, not a fault. The placeholder
 * therefore renders the alt text as a description of the picture that belongs
 * there — which is genuinely useful to a student reading the lesson — rather
 * than an error, and never the browser's broken-image icon.
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

  if (hong) {
    return (
      <figure className="hinh-bai-hoc hinh-bai-hoc--thieu">
        <div className="hinh-bai-hoc__o-trong">
          <span aria-hidden="true" className="text-3xl">
            🖼️
          </span>
          <p className="m-0 text-sm font-semibold text-chu-phu">Hình minh hoạ đang được vẽ</p>
          {alt ? <p className="m-0 max-w-prose text-sm text-chu-nhat">{alt}</p> : null}
        </div>
      </figure>
    );
  }

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

  if (hong) {
    return (
      <span className="hinh-trong-dong hinh-trong-dong--thieu">
        <span aria-hidden="true">🖼️</span>
        {alt ? <span>{alt}</span> : <span>hình minh hoạ</span>}
      </span>
    );
  }

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
