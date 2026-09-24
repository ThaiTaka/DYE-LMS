/**
 * The logo.
 *
 * What is being protected: two logos on one page (the student sidebar and the
 * dashboard banner) each paint with their OWN gradient — `url(#id)` resolves
 * to the first matching id in the document, so a shared id silently borrows
 * the other copy's paint — and the logo stays invisible to a screen reader,
 * because it always sits beside the brand name in words.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LogoDYE } from './logo-dye';

describe('LogoDYE', () => {
  it('hai logo trên một trang không dùng chung id gradient', () => {
    const { container } = render(
      <>
        <LogoDYE />
        <LogoDYE />
      </>,
    );
    const [a, b] = Array.from(container.querySelectorAll('svg'));
    const idCua = (svg: Element) =>
      Array.from(svg.querySelectorAll('linearGradient')).map((g) => g.id);

    expect(idCua(a!)).toHaveLength(2);
    expect(idCua(a!).filter((id) => idCua(b!).includes(id))).toEqual([]);

    // Every paint reference points at a gradient inside the same SVG.
    for (const svg of [a!, b!]) {
      const thamChieu = Array.from(svg.querySelectorAll('[fill^="url("], [stroke^="url("]')).map(
        (el) => (el.getAttribute('fill') ?? el.getAttribute('stroke'))!.slice(5, -1),
      );
      expect(thamChieu.length).toBeGreaterThan(0);
      for (const id of thamChieu) expect(idCua(svg)).toContain(id);
    }
  });

  it('ẩn khỏi trình đọc màn hình và không nhận focus', () => {
    const { container } = render(<LogoDYE />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('nhận className để đặt kích thước', () => {
    const { container } = render(<LogoDYE className="size-9 drop-shadow-neon" />);
    expect(container.querySelector('svg')).toHaveClass('size-9', 'drop-shadow-neon');
  });
});
