/**
 * The exam room's lockdown hook.
 *
 * ── The invariant this file exists for ───────────────────────────────────────
 * One Alt-Tab is ONE strike. In fullscreen it fires `blur`, `visibilitychange`
 * and `fullscreenchange` — three events — and a hook that reported each would
 * put a student past a two-strike lock for pressing Alt-Tab once. Every test
 * in the first block asserts on the NUMBER of reports, not on whether one
 * happened.
 *
 * ── And the one the brief asked for by name ──────────────────────────────────
 * No listener and no timer survives unmount. Asserted by counting
 * removeEventListener calls against addEventListener calls, and by firing
 * events after unmount and expecting silence.
 */
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const baoStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/kiem-tra/[slug]/actions', () => ({
  baoViPham: baoStub,
}));

import { NGUONG_BLIP_MS, useGiamSatPhongThi } from './dung-giam-sat-phong-thi';

let hienThi: 'visible' | 'hidden' = 'visible';
let coFocus = true;
let fullscreenEl: Element | null = null;
const ketQua = vi.fn();

function Phong({ attemptId }: { attemptId: string | null }) {
  const goc = useRef<HTMLDivElement | null>(null);
  useGiamSatPhongThi({ attemptId, onKetQua: ketQua, goc });
  return <div ref={goc} data-testid="goc" />;
}

/*
 * Test files share one worker here (`fileParallelism: false` in the vitest
 * config), so anything written onto `document` outlives this file. Every
 * global touched below is captured first and put back in `afterEach` — a
 * leaked `hasFocus` returning false is enough to break a focus assertion in
 * an unrelated component's tests.
 */
const hasFocusGoc = document.hasFocus;
const visibilityGoc = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const fullscreenGoc = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');

beforeEach(() => {
  vi.useFakeTimers();
  hienThi = 'visible';
  coFocus = true;
  fullscreenEl = null;
  ketQua.mockReset();
  baoStub.mockReset();
  baoStub.mockResolvedValue({
    ok: true,
    cheatStrikes: 1,
    maxStrikes: 2,
    biKhoa: false,
    trungLap: false,
  });

  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hienThi });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenEl,
  });
  document.hasFocus = () => coFocus;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.hasFocus = hasFocusGoc;
  for (const [ten, goc] of [
    ['visibilityState', visibilityGoc],
    ['fullscreenElement', fullscreenGoc],
  ] as const) {
    if (goc) Object.defineProperty(document, ten, goc);
    else delete (document as unknown as Record<string, unknown>)[ten];
  }
});

/** Mount in the state an exam actually runs in: focused, visible, fullscreen. */
function dungTrongPhong(attemptId: string | null = 'a1') {
  const r = render(<Phong attemptId={attemptId} />);
  fullscreenEl = r.getByTestId('goc');
  return r;
}

function an() {
  hienThi = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
}
function hien() {
  hienThi = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
}
function matFocus() {
  coFocus = false;
  window.dispatchEvent(new Event('blur'));
}
function coFocusLai() {
  coFocus = true;
  window.dispatchEvent(new Event('focus'));
}
function thoatFullscreen() {
  fullscreenEl = null;
  document.dispatchEvent(new Event('fullscreenchange'));
}
function vaoFullscreen(el: Element) {
  fullscreenEl = el;
  document.dispatchEvent(new Event('fullscreenchange'));
}

describe('một lần rời đi là MỘT báo cáo', () => {
  it('Alt-Tab trong fullscreen bắn ba sự kiện → đúng một báo cáo', async () => {
    dungTrongPhong();

    await act(async () => {
      // Chrome on Windows: blur, then hidden, then the fullscreen drop.
      matFocus();
      an();
      thoatFullscreen();
    });

    expect(baoStub).toHaveBeenCalledTimes(1);
    /*
     * The bare blur was ambiguous and went into its grace period; the hidden
     * event that followed is unambiguous and is what actually reported. So the
     * kind on record is TAB_HIDDEN — the more informative of the two for a
     * teacher reading the log — and the blur never reported on its own.
     */
    expect(baoStub).toHaveBeenCalledWith('a1', 'TAB_HIDDEN');
  });

  it('thứ tự khác (hidden trước) → vẫn một báo cáo, loại là TAB_HIDDEN', async () => {
    dungTrongPhong();
    await act(async () => {
      an();
      matFocus();
      thoatFullscreen();
    });
    expect(baoStub).toHaveBeenCalledTimes(1);
    expect(baoStub).toHaveBeenCalledWith('a1', 'TAB_HIDDEN');
  });

  it('thoát fullscreen bằng Esc (vẫn nhìn thấy, vẫn có focus) → báo ngay, một lần', async () => {
    dungTrongPhong();
    await act(async () => {
      thoatFullscreen();
    });
    expect(baoStub).toHaveBeenCalledTimes(1);
    expect(baoStub).toHaveBeenCalledWith('a1', 'FULLSCREEN_EXIT');
  });

  it('chưa quay lại HẲN thì sự kiện tiếp theo không tính thêm', async () => {
    const r = dungTrongPhong();
    await act(async () => {
      an();
      thoatFullscreen(); // the OS dropped fullscreen with the tab switch
    });
    // Comes back to the tab but has not re-entered fullscreen: still "away".
    await act(async () => {
      hien();
      coFocusLai();
      an(); // leaves again while still not fullscreen
    });
    expect(baoStub).toHaveBeenCalledTimes(1);

    // Now genuinely back — visible, focused AND fullscreen — then leaves again.
    await act(async () => {
      hien();
      coFocusLai();
      vaoFullscreen(r.getByTestId('goc'));
    });
    await act(async () => {
      an();
    });
    expect(baoStub).toHaveBeenCalledTimes(2);
  });

  it('kết quả từ máy chủ được chuyển cho người gọi — kể cả lệnh khoá', async () => {
    baoStub.mockResolvedValue({
      ok: true,
      cheatStrikes: 2,
      maxStrikes: 2,
      biKhoa: true,
      trungLap: false,
    });
    dungTrongPhong();
    await act(async () => {
      an();
    });
    expect(ketQua).toHaveBeenCalledWith(expect.objectContaining({ biKhoa: true, cheatStrikes: 2 }));
  });
});

describe('blur trần được ân hạn; hidden và thoát fullscreen thì không', () => {
  it('mất focus dưới ngưỡng blip (popup gõ tiếng Việt) → không báo', async () => {
    dungTrongPhong();
    await act(async () => {
      matFocus();
      vi.advanceTimersByTime(NGUONG_BLIP_MS - 200);
      coFocusLai();
      vi.advanceTimersByTime(NGUONG_BLIP_MS);
    });
    expect(baoStub).not.toHaveBeenCalled();
  });

  it('mất focus quá ngưỡng blip → báo WINDOW_BLUR, một lần', async () => {
    dungTrongPhong();
    await act(async () => {
      matFocus();
      vi.advanceTimersByTime(NGUONG_BLIP_MS + 50);
    });
    expect(baoStub).toHaveBeenCalledTimes(1);
    expect(baoStub).toHaveBeenCalledWith('a1', 'WINDOW_BLUR');
  });

  it('focus vào iframe của trang (trình soạn MakeCode) → KHÔNG phải rời đi, không báo', async () => {
    /*
     * Clicking a block inside an embedded editor moves focus into the frame
     * and fires `blur` on the window exactly as switching apps does — students
     * dragging blocks were being struck for doing the exam. The parent's
     * activeElement is the <iframe> element itself, and that is the signal.
     *
     * Not fullscreen on purpose: that is the branch that used to strike on
     * arrival with no check at all. (In fullscreen `document.hasFocus()` was
     * already covering it.)
     */
    const { container } = dungTrongPhong();
    fullscreenEl = null;

    const khung = document.createElement('iframe');
    container.appendChild(khung);

    await act(async () => {
      khung.focus();
      expect(document.activeElement).toBe(khung);
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(NGUONG_BLIP_MS + 50);
    });
    expect(baoStub).not.toHaveBeenCalled();
  });

  it('mất focus sang nơi khác khi không fullscreen → vẫn báo, một tick sau', async () => {
    // The control for the test above: a blur whose focus went NOWHERE of ours
    // is still a departure, and the deferral must not have swallowed it.
    dungTrongPhong();
    fullscreenEl = null;

    await act(async () => {
      matFocus();
      vi.advanceTimersByTime(1);
    });
    expect(baoStub).toHaveBeenCalledTimes(1);
    expect(baoStub).toHaveBeenCalledWith('a1', 'WINDOW_BLUR');
  });

  it('tab bị ẩn thì báo ngay, không chờ', async () => {
    dungTrongPhong();
    await act(async () => {
      an();
    });
    expect(baoStub).toHaveBeenCalledTimes(1);
  });
});

describe('không rò rỉ', () => {
  it('không có attemptId thì không gắn gì cả', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const addW = vi.spyOn(window, 'addEventListener');
    dungTrongPhong(null);
    expect(
      add.mock.calls.filter(([t]) => t === 'visibilitychange' || t === 'fullscreenchange'),
    ).toHaveLength(0);
    expect(addW.mock.calls.filter(([t]) => t === 'blur' || t === 'focus')).toHaveLength(0);
  });

  it('gỡ đúng những listener đã gắn, và huỷ hẹn giờ blur đang chờ', async () => {
    const addD = vi.spyOn(document, 'addEventListener');
    const remD = vi.spyOn(document, 'removeEventListener');
    const addW = vi.spyOn(window, 'addEventListener');
    const remW = vi.spyOn(window, 'removeEventListener');

    const r = dungTrongPhong();
    // A blur is pending when the room unmounts.
    await act(async () => {
      matFocus();
    });
    r.unmount();

    const cuaTa = (calls: unknown[][]) =>
      calls
        .map(([t]) => t as string)
        .filter((t) => ['visibilitychange', 'fullscreenchange', 'blur', 'focus'].includes(t))
        .sort();
    expect(cuaTa(remD.mock.calls)).toEqual(cuaTa(addD.mock.calls));
    expect(cuaTa(remW.mock.calls)).toEqual(cuaTa(addW.mock.calls));

    // The pending blur timer was cleared: letting it elapse reports nothing.
    await act(async () => {
      vi.advanceTimersByTime(NGUONG_BLIP_MS * 2);
    });
    expect(baoStub).not.toHaveBeenCalled();

    // And events after unmount fall on nobody.
    await act(async () => {
      an();
      thoatFullscreen();
    });
    expect(baoStub).not.toHaveBeenCalled();
  });

  it('đổi attemptId thì gắn lại sạch — không còn listener của lượt cũ', async () => {
    const r = render(<Phong attemptId="a1" />);
    fullscreenEl = r.getByTestId('goc');
    r.rerender(<Phong attemptId="a2" />);

    await act(async () => {
      an();
    });
    expect(baoStub).toHaveBeenCalledTimes(1);
    expect(baoStub).toHaveBeenCalledWith('a2', 'TAB_HIDDEN');
  });
});
