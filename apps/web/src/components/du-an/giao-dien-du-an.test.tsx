/**
 * Project workspace UI.
 *
 * Covers the file explorer, the refusal messages a student actually reads, and
 * the accessibility floor the rest of the app holds to.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CayTep, coChu } from './cay-tep';
import { TaoDuAnForm } from './tao-du-an';

import type { TepDuAn } from '@dye/core';

const taiTepStub = vi.hoisted(() => vi.fn());
const luuTepStub = vi.hoisted(() => vi.fn());
const xoaTepStub = vi.hoisted(() => vi.fn());
const docTepStub = vi.hoisted(() => vi.fn());
const nopMocStub = vi.hoisted(() => vi.fn());
const taoStub = vi.hoisted(() => vi.fn());
const nhanXetStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/du-an/actions', () => ({
  CHUA_LAM: { trangThai: 'chua-lam', thongDiep: '' },
  taiTepLen: taiTepStub,
  luuTepVanBan: luuTepStub,
  xoaTepDuAn: xoaTepStub,
  docTepDeSua: docTepStub,
  nopMocDuAn: nopMocStub,
  taoDuAnMoi: taoStub,
  doiTen: vi.fn(),
  nhanXetDuAn: nhanXetStub,
}));

beforeEach(() => {
  for (const s of [taiTepStub, luuTepStub, xoaTepStub, docTepStub, nopMocStub, taoStub, nhanXetStub]) {
    s.mockReset();
  }
  docTepStub.mockResolvedValue({ path: 'main.py', code: 'import pygame\n' });
});

function tep(over: Partial<TepDuAn> = {}): TepDuAn {
  return {
    id: 'f1',
    path: 'main.py',
    sizeBytes: 1024,
    sniffedMime: 'text/x-python',
    sha256: 'a'.repeat(64),
    storageKey: `aa/${'a'.repeat(64)}`,
    createdAt: new Date('2026-08-18T02:00:00Z'),
    suaDuoc: true,
    ...over,
  };
}

const BO_TEP: TepDuAn[] = [
  tep(),
  tep({
    id: 'f2',
    path: 'assets/player.png',
    sniffedMime: 'image/png',
    suaDuoc: false,
    sizeBytes: 2048,
  }),
  tep({
    id: 'f3',
    path: 'am-thanh/ban.wav',
    sniffedMime: 'audio/wav',
    suaDuoc: false,
    sizeBytes: 51200,
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
// Cây tệp
// ═══════════════════════════════════════════════════════════════════════════

describe('Cây tệp', () => {
  it('nhóm tệp thành thư mục theo đường dẫn', () => {
    render(
      <CayTep tep={BO_TEP} dangChon={null} onChon={vi.fn()} onXoa={vi.fn()} suaDuoc />,
    );

    // Folders are derived from paths — there is no folder table, so an empty
    // folder cannot exist and confuse a student.
    expect(screen.getByText('assets')).toBeInTheDocument();
    expect(screen.getByText('am-thanh')).toBeInTheDocument();
    expect(screen.getByText('player.png')).toBeInTheDocument();
    expect(screen.getByText('main.py')).toBeInTheDocument();
  });

  it('dùng vai trò tree cho trình đọc màn hình', () => {
    render(<CayTep tep={BO_TEP} dangChon={null} onChon={vi.fn()} onXoa={vi.fn()} suaDuoc />);
    const cay = screen.getByRole('tree', { name: /tệp trong dự án/i });
    expect(within(cay).getAllByRole('treeitem').length).toBeGreaterThan(0);
  });

  it('nói rõ khi chưa có tệp nào, kèm gợi ý làm gì tiếp', () => {
    render(<CayTep tep={[]} dangChon={null} onChon={vi.fn()} onXoa={vi.fn()} suaDuoc />);
    expect(screen.getByText(/chưa có tệp nào/i)).toBeInTheDocument();
    expect(screen.getByText(/main\.py/)).toBeInTheDocument();
  });

  it('gọi onChon khi bấm vào tệp', async () => {
    const chon = vi.fn();
    const nguoiDung = userEvent.setup();
    render(<CayTep tep={BO_TEP} dangChon={null} onChon={chon} onXoa={vi.fn()} suaDuoc />);

    await nguoiDung.click(screen.getByText('main.py'));
    expect(chon).toHaveBeenCalledWith(expect.objectContaining({ path: 'main.py' }));
  });

  it('không hiện nút xoá khi chỉ được xem', () => {
    render(
      <CayTep tep={BO_TEP} dangChon={null} onChon={vi.fn()} onXoa={vi.fn()} suaDuoc={false} />,
    );
    // A teacher reviews; they do not delete a child's files.
    expect(screen.queryByLabelText(/^xoá /i)).not.toBeInTheDocument();
  });

  it('nút xoá có nhãn nói rõ xoá tệp nào', () => {
    render(<CayTep tep={BO_TEP} dangChon={null} onChon={vi.fn()} onXoa={vi.fn()} suaDuoc />);
    expect(screen.getByLabelText('Xoá assets/player.png')).toBeInTheDocument();
  });

  it('đánh dấu tệp đang chọn cho trình đọc màn hình', () => {
    render(<CayTep tep={BO_TEP} dangChon="main.py" onChon={vi.fn()} onXoa={vi.fn()} suaDuoc />);
    const muc = screen.getAllByRole('treeitem').find((n) => within(n).queryByText('main.py'));
    expect(muc).toHaveAttribute('aria-selected', 'true');
  });

  it('không có vi phạm axe', async () => {
    const { container } = render(
      <CayTep tep={BO_TEP} dangChon="main.py" onChon={vi.fn()} onXoa={vi.fn()} suaDuoc />,
    );
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});

describe('coChu', () => {
  it('hiển thị kích thước dễ đọc', () => {
    expect(coChu(512)).toBe('512 B');
    expect(coChu(2048)).toBe('2.0 KB');
    expect(coChu(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Khu làm việc
// ═══════════════════════════════════════════════════════════════════════════

describe('Khu làm việc dự án', () => {
  async function dung(props?: Partial<Record<string, unknown>>) {
    const { KhuDuAn } = await import('./khu-du-an');
    return render(
      <KhuDuAn
        projectId="p1"
        tepBanDau={BO_TEP}
        tongByte={54272}
        gioiHanByte={50 * 1024 * 1024}
        suaDuoc
        {...props}
      />,
    );
  }

  it('hiện thanh dung lượng có vai trò progressbar', async () => {
    await dung();
    const thanh = await screen.findByRole('progressbar', { name: /dung lượng/i });
    expect(thanh).toHaveAttribute('aria-valuemax', '100');
  });

  it('ô tải tệp chỉ nhận các đuôi được phép', async () => {
    await dung();
    const o = await screen.findByLabelText(/tải tài nguyên lên/i);
    const accept = o.getAttribute('accept') ?? '';

    expect(accept).toContain('.png');
    expect(accept).toContain('.py');
    expect(accept).toContain('.wav');
    // The allowlist is the server's; this only saves a student a round trip.
    expect(accept).not.toContain('.exe');
    expect(accept).not.toContain('.sh');
  });

  it('nói rõ giới hạn 5 MB trước khi em chọn tệp', async () => {
    await dung();
    expect(await screen.findByText(/tối đa 5 MB/i)).toBeInTheDocument();
  });

  it('hiện lý do cụ thể cho tệp bị máy chủ từ chối', async () => {
    /*
     * The realistic case: a binary renamed `.png`. It passes the `accept`
     * attribute — which is why `accept` is a convenience and not a control —
     * and is refused by the server on its magic bytes.
     *
     * (`userEvent.upload` honours `accept` and silently discards a `.exe`, so a
     * test using one would never reach this code at all.)
     */
    taiTepStub.mockResolvedValue({
      trangThai: 'tu-choi',
      thongDiep: 'Không tệp nào được nhận.',
      chiTiet: [
        {
          ten: 'tra-hinh.png',
          ok: false,
          lyDo: 'Đây là tệp thực thi (ELF), không phải tài nguyên trò chơi.',
        },
      ],
    });

    const nguoiDung = userEvent.setup();
    const { container } = await dung();

    const o = container.querySelector('input[type="file"]') as HTMLInputElement;
    await nguoiDung.upload(
      o,
      new File([new Uint8Array([0x7f, 0x45, 0x4c, 0x46])], 'tra-hinh.png', { type: 'image/png' }),
    );

    await waitFor(() => expect(taiTepStub).toHaveBeenCalled());

    // A refused file must say why, not vanish.
    expect(await screen.findByText(/tệp thực thi/i)).toBeInTheDocument();
    expect(screen.getByText('tra-hinh.png')).toBeInTheDocument();
  });

  it('mở tệp .py trong khung soạn thảo', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByText('main.py'));
    await waitFor(() => expect(docTepStub).toHaveBeenCalledWith('p1', 'f1'));
    expect(await screen.findByRole('textbox', { name: /main\.py/i })).toBeInTheDocument();
  });

  it('xem trước ảnh thay vì mở ra một màn hình byte', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByText('player.png'));
    const anh = await screen.findByAltText(/xem trước assets\/player\.png/i);
    expect(anh).toHaveAttribute('src', '/api/du-an/p1/tep/f2');
  });

  it('không gọi trình soạn thảo cho tệp nhị phân', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByText('player.png'));
    await screen.findByAltText(/xem trước/i);
    expect(docTepStub).not.toHaveBeenCalled();
  });

  it('chế độ chỉ xem không có nút lưu hay ô tải lên', async () => {
    await dung({ suaDuoc: false });
    await screen.findByText('main.py');

    expect(screen.queryByLabelText(/tải tài nguyên lên/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tạo tệp mới/i)).not.toBeInTheDocument();
  });

  it('không có vi phạm axe', async () => {
    const { container } = await dung();
    await screen.findByText('main.py');

    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Nộp mốc
// ═══════════════════════════════════════════════════════════════════════════

describe('Nộp mốc', () => {
  async function dung() {
    const { NopMoc } = await import('./khu-du-an');
    return render(<NopMoc projectId="p1" />);
  }

  it('nói rõ nộp rồi vẫn làm tiếp được, không mất gì', async () => {
    await dung();
    // The fear this addresses: a child thinking "submit" locks their work away.
    expect(await screen.findByText(/vẫn tiếp tục sửa được/i)).toBeInTheDocument();
    expect(screen.getByText(/không mất gì cả/i)).toBeInTheDocument();
  });

  it('có chỗ nhắn cho thầy cô', async () => {
    await dung();
    expect(await screen.findByLabelText(/muốn nói gì với thầy cô/i)).toBeInTheDocument();
  });

  it('gửi được kèm lời nhắn', async () => {
    nopMocStub.mockResolvedValue({
      trangThai: 'thanh-cong',
      thongDiep: 'Đã nộp bản 1. Em cứ tiếp tục làm ở bản 2 nhé.',
    });

    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.type(
      await screen.findByLabelText(/muốn nói gì/i),
      'Em xong phần di chuyển rồi ạ',
    );
    await nguoiDung.click(screen.getByRole('button', { name: /nộp mốc này/i }));

    await waitFor(() => expect(nopMocStub).toHaveBeenCalled());
    expect(await screen.findByText(/tiếp tục làm ở bản 2/i)).toBeInTheDocument();
  });

  it('luôn có lối tải cả dự án về', async () => {
    await dung();
    const link = await screen.findByRole('link', { name: /tải cả dự án/i });
    expect(link).toHaveAttribute('href', '/api/du-an/p1/tai-ve');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tạo dự án
// ═══════════════════════════════════════════════════════════════════════════

describe('Tạo dự án mới', () => {
  const MAU = {
    SPACE_INVADERS: { ten: 'Bắn phi thuyền', moTa: 'Phi thuyền bắn thiên thạch rơi xuống.' },
    PLATFORMER: { ten: 'Nhảy vượt chướng ngại', moTa: 'Nhân vật chạy, nhảy, tránh bẫy.' },
    PONG: { ten: 'Pong', moTa: 'Hai thanh đỡ và một quả bóng.' },
    MAZE: { ten: 'Mê cung kho báu', moTa: 'Tìm đường trong mê cung để lấy kho báu.' },
    QUIZ_GUI: { ten: 'Trò chơi đố vui', moTa: 'Câu hỏi trắc nghiệm có giao diện.' },
    CUSTOM: { ten: 'Tự do', moTa: 'Em tự nghĩ ra trò chơi của mình.' },
  };

  it('hiện đủ sáu kiểu trò chơi cùng mô tả', () => {
    render(<TaoDuAnForm mau={MAU} />);
    // Radio cards rather than a dropdown: a 12-year-old picking their first
    // project should choose between things they can see.
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByText('Phi thuyền bắn thiên thạch rơi xuống.')).toBeInTheDocument();
  });

  it('tên dự án không bắt buộc', () => {
    render(<TaoDuAnForm mau={MAU} />);
    expect(screen.getByLabelText(/tên trò chơi/i)).not.toBeRequired();
    expect(screen.getByText(/để trống cũng được/i)).toBeInTheDocument();
  });

  it('không có vi phạm axe', async () => {
    const { container } = render(<TaoDuAnForm mau={MAU} />);
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });

  it('mọi lựa chọn đều tới được bằng bàn phím', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaoDuAnForm mau={MAU} />);

    const chamToi: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      await nguoiDung.tab();
      const el = document.activeElement;
      if (el && el !== document.body) chamToi.push(el.tagName);
    }
    expect(chamToi).toContain('INPUT');
  });
});
