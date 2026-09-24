/**
 * Bí, the tutor in the corner.
 *
 * The tests are mostly about restraint: a tutor on a page a child is trying to
 * concentrate on earns its place by staying quiet until asked, staying
 * reachable from the keyboard, going away when told to — and, now that it has
 * something to say, by sending the student's actual work to the server and
 * never blowing up in their face when the answer does not come.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TroLyAo, VirtualAssistant } from './tro-ly-ao';

/** A successful answer from `/api/tro-ly`. */
function traLoiOk(traLoi = 'Em thử đọc lại **dòng 2** xem sao?') {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ trangThai: 'tra-loi', traLoi }),
    } as Response),
  );
}

/** The body of the one call made to `/api/tro-ly`. */
function thanYeuCau(gia: ReturnType<typeof traLoiOk>): Record<string, unknown> {
  const [duongDan, tuyChon] = (gia.mock.calls[0] ?? []) as unknown as [string, RequestInit];
  expect(duongDan).toBe('/api/tro-ly');
  return JSON.parse(String(tuyChon.body)) as Record<string, unknown>;
}

async function moTroChuyen(nguoiDung: ReturnType<typeof userEvent.setup>): Promise<void> {
  await nguoiDung.click(screen.getByRole('button', { name: /Mở trò chuyện/ }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  /*
   * The fake lesson page a test injects is appended to `document.body`, which
   * Testing Library's own cleanup does not touch — it only removes the
   * container it created. Left behind, the next test's `docMaHienTai()` finds
   * the previous test's editor and the failure points at the component rather
   * than at the fixture.
   */
  document.querySelectorAll('main').forEach((el) => el.remove());
});

describe('TroLyAo', () => {
  it('không mở gì cho tới khi được bấm vào', () => {
    render(<TroLyAo />);

    expect(screen.getByRole('button', { name: /Mở trò chuyện/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mở ra là đã có sẵn lời chào, chưa cần hỏi gì', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await moTroChuyen(nguoiDung);

    const khung = screen.getByRole('dialog', { name: /Bí/ });
    expect(khung).toBeInTheDocument();
    expect(screen.getByRole('log').textContent).toMatch(/Chào em/);
    // The promise the greeting makes is the whole point of the feature.
    expect(screen.getByRole('log').textContent).toMatch(/không làm hộ/);
  });

  it('có đủ ba phần: đầu khung, lịch sử cuộn được, và ô nhập', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await moTroChuyen(nguoiDung);

    expect(screen.getByRole('heading', { name: /Bí/ })).toBeInTheDocument();
    expect(screen.getByRole('log', { name: /trò chuyện/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Hỏi Bí/ })).toBeInTheDocument();
  });

  it('gửi câu hỏi kèm code đang gõ và hiện câu trả lời của Bí', async () => {
    const nguoiDung = userEvent.setup();
    const gia = traLoiOk('Gợi ý: **vòng lặp** của em chạy mấy lần?');
    vi.stubGlobal('fetch', gia);

    /*
     * A CodeMirror editor as the DOM actually renders one: one element per
     * line, with no newline between them. Reading `.cm-content.textContent`
     * would join these into a single line, which for Python is a different
     * program — so the test asserts the newline survives.
     */
    document.body.insertAdjacentHTML(
      'beforeend',
      '<main><h1>Buổi 3 · Vòng lặp</h1>' +
        '<div class="cm-editor"><div class="cm-content">' +
        '<div class="cm-line">for i in range(3):</div>' +
        '<div class="cm-line">    print(i)</div>' +
        '</div></div></main>',
    );

    render(<TroLyAo />);
    await moTroChuyen(nguoiDung);

    await nguoiDung.type(screen.getByRole('textbox', { name: /Hỏi Bí/ }), 'Sao em sai vậy?');
    await nguoiDung.click(screen.getByRole('button', { name: /Gửi câu hỏi/ }));

    await waitFor(() => expect(gia).toHaveBeenCalledTimes(1));

    const than = thanYeuCau(gia);
    expect(than['prompt']).toBe('Sao em sai vậy?');
    expect(than['codeContext']).toBe('for i in range(3):\n    print(i)');
    expect(than['lessonContext']).toBe('Buổi 3 · Vòng lặp');

    // Markdown from the server comes back as elements, never as a raw string.
    expect(await screen.findByText('vòng lặp')).toBeInTheDocument();
    // And what the student typed is still on screen above it.
    expect(screen.getByRole('log').textContent).toMatch(/Sao em sai vậy\?/);
  });

  it('không có khung soạn thảo nào thì vẫn hỏi được', async () => {
    const nguoiDung = userEvent.setup();
    const gia = traLoiOk();
    vi.stubGlobal('fetch', gia);

    render(<TroLyAo />);
    await moTroChuyen(nguoiDung);

    await nguoiDung.type(screen.getByRole('textbox', { name: /Hỏi Bí/ }), 'Bài này làm sao ạ?');
    await nguoiDung.keyboard('{Enter}');

    await waitFor(() => expect(gia).toHaveBeenCalledTimes(1));
    expect(thanYeuCau(gia)['codeContext']).toBe('');
  });

  it('mạng hỏng thì nói một câu tử tế, không phải lỗi kỹ thuật', async () => {
    const nguoiDung = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    render(<TroLyAo />);
    await moTroChuyen(nguoiDung);

    await nguoiDung.type(screen.getByRole('textbox', { name: /Hỏi Bí/ }), 'Alo?');
    await nguoiDung.keyboard('{Enter}');

    expect(await screen.findByText(/không kết nối được/)).toBeInTheDocument();
    // Still usable afterwards: one failed question must not end the session.
    expect(screen.getByRole('textbox', { name: /Hỏi Bí/ })).toBeEnabled();
  });

  it('bị khoá thì báo rõ ai mở được, và không còn ô để gõ tiếp', async () => {
    const nguoiDung = userEvent.setup();
    const cau =
      'Quyền truy cập AI của em đã bị khóa do vi phạm. Vui lòng liên hệ giáo viên để mở lại.';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ trangThai: 'bi-khoa', traLoi: cau, error: cau }),
        } as Response),
      ),
    );

    const { container } = render(<TroLyAo />);
    await moTroChuyen(nguoiDung);

    await nguoiDung.type(screen.getByRole('textbox', { name: /Hỏi Bí/ }), 'Alo?');
    await nguoiDung.keyboard('{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent(/liên hệ giáo viên để mở lại/);
    expect(screen.queryByRole('textbox', { name: /Hỏi Bí/ })).not.toBeInTheDocument();
    expect(screen.getByText('Đang tạm khoá')).toBeInTheDocument();

    const kq = await axe.run(container);
    expect(kq.violations.map((v) => v.id)).toEqual([]);
  });

  it('câu rỗng thì không gửi gì cả', async () => {
    const nguoiDung = userEvent.setup();
    const gia = traLoiOk();
    vi.stubGlobal('fetch', gia);

    render(<TroLyAo />);
    await moTroChuyen(nguoiDung);

    await nguoiDung.type(screen.getByRole('textbox', { name: /Hỏi Bí/ }), '   ');
    await nguoiDung.keyboard('{Enter}');

    expect(gia).not.toHaveBeenCalled();
  });

  it('ẩn đi được, và lần sau vào vẫn ẩn', async () => {
    const nguoiDung = userEvent.setup();
    const { unmount } = render(<TroLyAo />);

    await moTroChuyen(nguoiDung);
    await nguoiDung.click(screen.getByRole('button', { name: 'Ẩn Bí đi' }));

    expect(screen.getByRole('button', { name: /Gọi Bí quay lại/ })).toBeInTheDocument();

    unmount();
    render(<TroLyAo />);
    // The choice survives a reload — a character you cannot switch off is not
    // a companion.
    expect(await screen.findByRole('button', { name: /Gọi Bí quay lại/ })).toBeInTheDocument();
  });

  it('gọi lại được sau khi đã ẩn', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await moTroChuyen(nguoiDung);
    await nguoiDung.click(screen.getByRole('button', { name: 'Ẩn Bí đi' }));
    await nguoiDung.click(screen.getByRole('button', { name: /Gọi Bí quay lại/ }));

    expect(screen.getByRole('button', { name: /Mở trò chuyện/ })).toBeInTheDocument();
  });

  it('bấm Escape là đóng khung trò chuyện', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await moTroChuyen(nguoiDung);
    await nguoiDung.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Closing is not hiding: Bí is still there to be asked again.
    expect(screen.getByRole('button', { name: /Mở trò chuyện/ })).toBeInTheDocument();
  });

  it('dùng được bằng bàn phím', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await nguoiDung.tab();
    expect(screen.getByRole('button', { name: /Mở trò chuyện/ })).toHaveFocus();

    await nguoiDung.keyboard('{Enter}');
    // Opening puts the cursor where the student types, so the next keystroke
    // is the question rather than a hunt for the box.
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Hỏi Bí/ })).toHaveFocus());
  });

  it('không có lỗi tiếp cận', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(<TroLyAo />);
    await moTroChuyen(nguoiDung);

    const kq = await axe.run(container);
    expect(kq.violations.map((v) => v.id)).toEqual([]);
  });

  it('tên tiếng Anh trỏ về cùng một component', () => {
    expect(VirtualAssistant).toBe(TroLyAo);
  });
});
