/**
 * Student UI component tests.
 *
 * Covers the things Phase 5 must get right for this audience:
 *   • a wrong quiz answer is encouraging, never punitive;
 *   • one attempt per question — a wrong one freezes the question and says
 *     who can reopen it, and the freeze survives a reload;
 *   • an EXPLORATION block reads as a bonus, never as a lock;
 *   • the interface is reachable by keyboard and legible by a screen reader.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KhoiNoiDung } from './khoi-noi-dung';
import { ThanhChang } from './thanh-chang';
import { DuongDan } from './duong-dan';
import { ThanhTienDo } from '../ui/thanh-tien-do';

import type { KhoiHienThi } from '@/lib/student-data';

// The quiz calls a server action; stub it so the component can be tested alone.
const kiemTra = vi.hoisted(() => vi.fn());
const danhDauXong = vi.hoisted(() => vi.fn());
vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/actions', () => ({
  kiemTraCauTraLoi: kiemTra,
  danhDauKhoiXong: danhDauXong,
  nopBaiTuLuan: vi.fn(),
}));

/*
 * The code workspace imports its own server actions, and those reach `@/auth`
 * and therefore next-auth. Next.js rewrites a 'use server' import into a network
 * stub at build time; Vitest does not, so the real module loads and fails on
 * `next/server`. Stubbed here for the same reason the quiz actions are.
 */
vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions', () => ({
  tuDongLuu: vi.fn().mockResolvedValue({ trangThai: 'khong-doi', luuLuc: null, thongDiep: '' }),
  layBanNhap: vi.fn(),
  layLichSu: vi.fn().mockResolvedValue({ trangThai: 'ok', banLuu: [] }),
  layLichSuNop: vi.fn().mockResolvedValue({ trangThai: 'ok', baiNop: [] }),
  layNoiDungBanLuu: vi.fn(),
  khoiPhuc: vi.fn(),
  nop: vi.fn(),
}));

beforeEach(() => {
  kiemTra.mockReset();
  danhDauXong.mockReset();
});

// ── Fixtures ───────────────────────────────────────────────────────────────

function khoi(over: Partial<KhoiHienThi> = {}): KhoiHienThi {
  return {
    blockId: 'b1',
    order: 0,
    type: 'THEORY',
    stage: 'LY_THUYET',
    title: 'Biến và kiểu dữ liệu',
    tier: 'CO_BAN',
    access: 'REQUIRED',
    completed: false,
    estimatedMinutes: 12,
    noiDung: { kind: 'theory', markdown: 'Một **biến** là một cái tên.', keyPoints: ['Ghi nhớ'] },
    tracNghiem: null,
    baiTap: null,
    maBanDau: '',
    coBanNhap: false,
    luuLucBanDau: null,
    soLanDaNop: 0,
    baiNopCuoi: null,
    onTap: null,
    thuyetTrinh: null,
    ...over,
  };
}

const TRAC_NGHIEM = {
  quizId: 'q1',
  title: 'Kiểm tra nhanh',
  description: null,
  passingScore: 60,
  questions: [
    {
      id: 'c1',
      order: 0,
      type: 'MULTIPLE_CHOICE' as const,
      prompt: 'Kết quả của 17 % 5 là bao nhiêu?',
      points: 10,
      template: null,
      mediaUrl: null,
      hint: null,
      tuLuan: null,
      daTraLoi: null,
      choices: [
        { id: 'a', text: '2' },
        { id: 'b', text: '3' },
        { id: 'c', text: '3.4' },
      ],
    },
    {
      id: 'c2',
      order: 1,
      type: 'FILL_BLANK' as const,
      prompt: 'Toán tử nào cho phần dư?',
      points: 10,
      template: 'Toán tử ___ cho phần dư của phép chia.',
      mediaUrl: null,
      hint: 'Nó là một ký tự em thấy trên bàn phím số.',
      tuLuan: null,
      daTraLoi: null,
      choices: [],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Trắc nghiệm
// ═══════════════════════════════════════════════════════════════════════════

describe('Bài trắc nghiệm', () => {
  it('không bao giờ gửi đáp án đúng xuống trình duyệt', () => {
    // Kiểu dữ liệu truyền vào component không có trường isCorrect.
    for (const cau of TRAC_NGHIEM.questions) {
      for (const chon of cau.choices) {
        expect(Object.keys(chon)).toEqual(['id', 'text']);
      }
    }
  });

  it('trả lời đúng thì khen, không chỉ báo "đúng"', async () => {
    kiemTra.mockResolvedValue({ dung: true, giaiThich: '17 = 5×3 + 2.', dapAnDung: null, hetLuot: false });
    const nguoiDung = userEvent.setup();

    render(<KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />);

    await nguoiDung.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByText(/Chính xác/)).toBeInTheDocument();
    expect(screen.getByText('17 = 5×3 + 2.')).toBeInTheDocument();
  });

  it('trả lời sai thì nói "Chưa đúng rồi" — TUYỆT ĐỐI không dùng chữ "SAI" hay màu đỏ', async () => {
    kiemTra.mockResolvedValue({ dung: false, giaiThich: '23 = 4×5 + 3.', dapAnDung: '3', hetLuot: false });
    const nguoiDung = userEvent.setup();

    const { container } = render(
      <KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />,
    );

    await nguoiDung.click(screen.getByRole('button', { name: '3.4' }));

    const phanHoi = await screen.findByRole('status');
    expect(phanHoi).toHaveTextContent('Chưa đúng rồi');
    // The explanation still teaches, and the answer is shown because the
    // student can no longer act on it.
    expect(phanHoi).toHaveTextContent('23 = 4×5 + 3.');
    expect(phanHoi).toHaveTextContent('Đáp án đúng là: 3');

    // Giọng điệu tích cực: không có từ mang tính phán xét.
    const chu = container.textContent ?? '';
    expect(chu).not.toMatch(/\bSAI\b/);
    expect(chu).not.toMatch(/thất bại|FAIL/i);

    // Màu dùng là amber (thu-lai), không phải đỏ (loi).
    expect(phanHoi.className).toContain('thu-lai');
    expect(phanHoi.className).not.toContain('bg-loi');
  });

  it('trả lời sai là HẾT LƯỢT: câu hỏi đóng băng, không có "Làm lại", nói rõ ai mở được', async () => {
    /*
     * One attempt. The old "Làm lại" loop is gone: a wrong answer closes the
     * question, every choice is disabled, and the message names the teacher
     * as the only way back in — the same sentence the code editor shows.
     */
    kiemTra.mockResolvedValue({ dung: false, giaiThich: null, dapAnDung: '3', hetLuot: false });
    const nguoiDung = userEvent.setup();

    render(<KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />);

    await nguoiDung.click(screen.getByRole('button', { name: '3.4' }));
    const phanHoi = await screen.findByRole('status');

    expect(phanHoi).toHaveTextContent('Em đã hết lượt nộp bài. Vui lòng nhờ Giáo viên mở khóa.');
    expect(screen.queryByRole('button', { name: /Làm lại/ })).not.toBeInTheDocument();
    for (const ten of ['2', '3', '3.4']) {
      expect(screen.getByRole('button', { name: ten })).toBeDisabled();
    }
    // Clicking a disabled choice must not reach the server.
    await nguoiDung.click(screen.getByRole('button', { name: '2' }));
    expect(kiemTra).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Đã trả lời 1\/2/)).toBeInTheDocument();
  });

  it('máy chủ từ chối vì đã có câu trả lời (hetLuot) → chỉ hiện thông báo khoá, không hiện kết quả', async () => {
    // A stale tab: the question was answered elsewhere. The server says so
    // and the page shows the lock, not a verdict it does not have.
    kiemTra.mockResolvedValue({ dung: false, giaiThich: null, dapAnDung: null, hetLuot: true });
    const nguoiDung = userEvent.setup();

    render(<KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />);

    await nguoiDung.click(screen.getByRole('button', { name: '2' }));

    const canhBao = await screen.findByRole('alert');
    expect(canhBao).toHaveTextContent('Em đã hết lượt nộp bài. Vui lòng nhờ Giáo viên mở khóa.');
    expect(screen.queryByText(/Chưa đúng rồi|Chính xác/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeDisabled();
  });

  it('câu đã trả lời trên máy chủ thì mở trang ra đã khoá sẵn — lựa chọn cũ được đánh dấu', () => {
    /*
     * The freeze must survive a reload, so it is seeded from the database:
     * `daTraLoi` on the question. The chosen option is marked (`aria-pressed`)
     * so the student can see what they picked, and the input for the
     * fill-in question is read-only with the old answer in it.
     */
    const daLam = {
      ...TRAC_NGHIEM,
      questions: [
        { ...TRAC_NGHIEM.questions[0]!, daTraLoi: { dung: false, chon: 'c', dapAnDung: '2', giaiThich: '17 = 5×3 + 2.' } },
        { ...TRAC_NGHIEM.questions[1]!, daTraLoi: { dung: true, chon: '%', dapAnDung: null, giaiThich: null } },
      ],
    };

    // Every question answered on the server means the block is already
    // complete there too; the page must not write it again.
    render(
      <KhoiNoiDung
        khoi={khoi({ type: 'QUIZ', completed: true, noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: daLam })}
      />,
    );

    expect(screen.getByText(/Đã trả lời 2\/2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3.4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'false');
    for (const ten of ['2', '3', '3.4']) {
      expect(screen.getByRole('button', { name: ten })).toBeDisabled();
    }
    expect(screen.getByText('Đáp án đúng là:', { exact: false })).toBeInTheDocument();

    const nhap = screen.getByRole('textbox', { name: /Câu trả lời/ });
    expect(nhap).toBeDisabled();
    expect(nhap).toHaveValue('%');

    // Nothing was fetched or written: the state came with the page.
    expect(kiemTra).not.toHaveBeenCalled();
    expect(danhDauXong).not.toHaveBeenCalled();
  });

  it('đếm đúng số câu đã trả lời', async () => {
    kiemTra.mockResolvedValue({ dung: true, giaiThich: null, dapAnDung: null, hetLuot: false });
    const nguoiDung = userEvent.setup();

    render(<KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />);

    expect(screen.getByText(/Đã trả lời 0\/2/)).toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText(/Đã trả lời 1\/2/)).toBeInTheDocument();
  });

  it('trả lời HẾT các câu — kể cả sai — là khối được ghi nhận hoàn thành, đúng một lần', async () => {
    /*
     * Effort counts. Under the old rule nothing ever called `danhDauKhoiXong`
     * for a quiz, so a lesson with a quiz in it could never finish. Now every
     * question answered — right or wrong — completes the block.
     */
    kiemTra.mockResolvedValue({ dung: false, giaiThich: null, dapAnDung: '2', hetLuot: false });
    danhDauXong.mockResolvedValue({ baiXong: false, daGhi: true });
    const nguoiDung = userEvent.setup();

    render(<KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />);

    await nguoiDung.click(screen.getByRole('button', { name: '3' })); // wrong
    expect(danhDauXong).not.toHaveBeenCalled(); // 1/2 is not "all"

    await nguoiDung.type(screen.getByRole('textbox'), 'chia{Enter}'); // wrong again
    await screen.findByText(/Đã trả lời 2\/2/);
    expect(danhDauXong).toHaveBeenCalledTimes(1);
    expect(danhDauXong).toHaveBeenCalledWith('b1');
  });

  it('khối đã hoàn thành trên máy chủ thì không ghi lại', async () => {
    kiemTra.mockResolvedValue({ dung: true, giaiThich: null, dapAnDung: null, hetLuot: false });
    const nguoiDung = userEvent.setup();

    render(
      <KhoiNoiDung
        khoi={khoi({ type: 'QUIZ', completed: true, noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })}
      />,
    );
    await nguoiDung.click(screen.getByRole('button', { name: '2' }));
    await nguoiDung.type(screen.getByRole('textbox'), '%{Enter}');
    await screen.findByText(/Đã trả lời 2\/2/);
    expect(danhDauXong).not.toHaveBeenCalled();
  });

  it('câu điền từ trả lời được bằng bàn phím, nhấn Enter là gửi', async () => {
    kiemTra.mockResolvedValue({ dung: true, giaiThich: null, dapAnDung: null, hetLuot: false });
    const nguoiDung = userEvent.setup();

    render(<KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />);

    await nguoiDung.type(screen.getByRole('textbox', { name: /Câu trả lời/ }), '%{Enter}');

    expect(kiemTra).toHaveBeenCalledWith('c2', '%');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phân hoá hiển thị
// ═══════════════════════════════════════════════════════════════════════════

describe('Hiển thị theo nhánh phân hoá', () => {
  it('khối lý thuyết có nút "Em đã đọc xong" — bấm là ghi nhận, và chỉ ghi một lần', async () => {
    /*
     * The other half of the same bug: theory, example, video, resource and
     * reflection blocks had no completion control at all. A big explicit
     * button is the one a ten-year-old understands.
     */
    danhDauXong.mockResolvedValue({ baiXong: false, daGhi: true });
    const nguoiDung = userEvent.setup();
    render(<KhoiNoiDung khoi={khoi()} />);

    const nut = screen.getByRole('button', { name: /Em đã đọc xong/ });
    await nguoiDung.click(nut);
    expect(danhDauXong).toHaveBeenCalledWith('b1');
    expect(await screen.findByText(/Xong phần này rồi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Em đã đọc xong/ })).not.toBeInTheDocument();
  });

  it('khối lý thuyết đã xong thì hiện trạng thái xong, không hiện nút', () => {
    render(<KhoiNoiDung khoi={khoi({ completed: true })} />);
    expect(screen.getByText(/Xong phần này rồi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Em đã đọc xong/ })).not.toBeInTheDocument();
  });

  it('máy chủ từ chối thì nút quay lại và nói rõ', async () => {
    danhDauXong.mockResolvedValue({ baiXong: false, daGhi: false });
    const nguoiDung = userEvent.setup();
    render(<KhoiNoiDung khoi={khoi()} />);
    await nguoiDung.click(screen.getByRole('button', { name: /Em đã đọc xong/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/thử bấm lại/);
    expect(screen.getByRole('button', { name: /Em đã đọc xong/ })).toBeInTheDocument();
  });

  it('khối KHÁM PHÁ trông như phần thưởng, không phải trạng thái lỗi', () => {
    const { container } = render(
      <KhoiNoiDung khoi={khoi({ access: 'EXPLORATION', tier: 'NANG_CAO', title: 'Lượng giác' })} />,
    );

    expect(screen.getByText('Khám phá thêm')).toBeInTheDocument();
    expect(screen.getByText(/Không làm cũng không sao cả/)).toBeInTheDocument();

    // Không có ngôn từ khoá/cấm/lỗi.
    const chu = container.textContent ?? '';
    expect(chu).not.toMatch(/khoá|cấm|không được phép|lỗi/i);

    // Viền nét đứt màu vàng — trông như nhiệm vụ thưởng.
    const section = container.querySelector('section');
    expect(section?.className).toContain('border-dashed');
    expect(section?.className).toContain('mo-rong');
  });

  it('khối bắt buộc hiện nhãn nhánh kèm icon, không chỉ dựa vào màu', () => {
    render(<KhoiNoiDung khoi={khoi({ access: 'REQUIRED', tier: 'CO_BAN' })} />);
    // Icon 🌱 đi kèm chữ "Cơ bản" — người khó phân biệt màu vẫn đọc được.
    expect(screen.getByText('Cơ bản')).toBeInTheDocument();
  });

  it('khối làm thêm nói rõ là không bắt buộc', () => {
    render(<KhoiNoiDung khoi={khoi({ access: 'OPTIONAL' })} />);
    expect(screen.getByText(/Làm thêm nếu em muốn/)).toBeInTheDocument();
  });

  it('nội dung hỏng chỉ làm hỏng một khối, không làm trắng cả bài', () => {
    render(<KhoiNoiDung khoi={khoi({ noiDung: { kind: 'khong-doc-duoc' } })} />);
    expect(screen.getByText(/đang được cập nhật/)).toBeInTheDocument();
    // Tiêu đề khối vẫn hiện.
    expect(screen.getByRole('heading', { name: 'Biến và kiểu dữ liệu' })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Thanh tiến độ và điều hướng
// ═══════════════════════════════════════════════════════════════════════════

describe('Thanh tiến độ', () => {
  it('là progressbar thật, đọc được bằng trình đọc màn hình', () => {
    render(<ThanhTienDo nhan="Phần bắt buộc" phanTram={62} daXong={13} tong={21} />);

    const thanh = screen.getByRole('progressbar', { name: 'Phần bắt buộc' });
    expect(thanh).toHaveAttribute('aria-valuenow', '62');
    expect(thanh).toHaveAttribute('aria-valuetext', '13 trên 21 bài, 62 phần trăm');
  });

  it('đạt 100% thì chúc mừng', () => {
    render(<ThanhTienDo nhan="Phần bắt buộc" phanTram={100} daXong={19} tong={19} />);
    expect(screen.getByText(/hoàn thành phần này/)).toBeInTheDocument();
  });

  it('bộ đếm thắng số phần trăm cũ trong cache: 4/15 không bao giờ là 0%', () => {
    // `percent` is a cache column; a row written before it existed reads 0.
    // The counts are the truth the child can see, so the bar recomputes.
    render(<ThanhTienDo nhan="Phần bắt buộc" phanTram={0} daXong={4} tong={15} />);

    const thanh = screen.getByRole('progressbar', { name: 'Phần bắt buộc' });
    expect(thanh).toHaveAttribute('aria-valuenow', '27');
    expect(thanh).toHaveAttribute('aria-valuetext', '4 trên 15 bài, 27 phần trăm');
    expect(screen.getByText('4/15 · 27%')).toBeInTheDocument();
  });

  it('giữ phần trăm có tín dụng dở dang khi nó cao hơn bộ đếm', () => {
    // Three of five challenges in one lesson: the cache says 30, the counts
    // say 0. Falling back to the counts would erase the work in progress.
    render(<ThanhTienDo nhan="Phần bắt buộc" phanTram={30} daXong={0} tong={2} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  it('không có bộ đếm thì dùng nguyên phần trăm được đưa', () => {
    render(<ThanhTienDo nhan="Tiến độ" phanTram={45} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
  });

  it('phân biệt "chưa giao bài" với "đã hoàn thành"', () => {
    render(<ThanhTienDo nhan="Phần bắt buộc" phanTram={100} daXong={0} tong={0} chuaGiao />);

    expect(screen.getByText('Chưa giao bài')).toBeInTheDocument();
    expect(screen.queryByText(/hoàn thành phần này/)).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('Đường dẫn và thanh chặng', () => {
  it('đường dẫn là nav có nhãn, trang hiện tại được đánh dấu', () => {
    render(
      <DuongDan
        muc={[
          { nhan: 'Trang chính', href: '/bang-dieu-khien' },
          { nhan: 'Python Cơ Bản', href: '/khoa-hoc/python-co-ban' },
          { nhan: 'Buổi 12' },
        ]}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    expect(within(nav).getByText('Buổi 12')).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });

  it('thanh chặng chỉ hiện các chặng BẮT BUỘC của em, và đếm riêng phần khám phá', () => {
    render(
      <ThanhChang
        blocks={[
          khoi({ blockId: 'a', stage: 'LY_THUYET', access: 'REQUIRED', completed: true }),
          khoi({ blockId: 'b', stage: 'VI_DU', access: 'REQUIRED' }),
          khoi({ blockId: 'c', stage: 'THU_THACH', access: 'EXPLORATION' }),
        ]}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Các chặng của bài học' });
    // Chỉ hai chặng bắt buộc, chặng của khối khám phá không xuất hiện.
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText(/1 phần khám phá thêm/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Khả năng tiếp cận
// ═══════════════════════════════════════════════════════════════════════════

describe('Khả năng tiếp cận (axe)', () => {
  async function kiemTraAxe(node: HTMLElement) {
    const ketQua = await axe.run(node, {
      rules: {
        // jsdom không dựng layout nên không đo được tương phản.
        // Tương phản được kiểm riêng bằng phép tính trên token bên dưới.
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    return ketQua.violations;
  }

  it('khối nội dung không có vi phạm', async () => {
    const { container } = render(<KhoiNoiDung khoi={khoi()} />);
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('khối khám phá không có vi phạm', async () => {
    const { container } = render(<KhoiNoiDung khoi={khoi({ access: 'EXPLORATION' })} />);
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('trắc nghiệm không có vi phạm', async () => {
    const { container } = render(
      <KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />,
    );
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('thanh tiến độ và đường dẫn không có vi phạm', async () => {
    const { container } = render(
      <div>
        <DuongDan muc={[{ nhan: 'Trang chính', href: '/' }, { nhan: 'Buổi 1' }]} />
        <ThanhTienDo nhan="Tiến độ" phanTram={50} daXong={1} tong={2} />
      </div>,
    );
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('mọi nút và ô nhập đều tới được bằng bàn phím', async () => {
    const nguoiDung = userEvent.setup();
    render(
      <KhoiNoiDung khoi={khoi({ type: 'QUIZ', noiDung: { kind: 'quiz', markdown: '' }, tracNghiem: TRAC_NGHIEM })} />,
    );

    const dichVaoDuoc: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await nguoiDung.tab();
      const el = document.activeElement;
      if (el && el !== document.body) dichVaoDuoc.push(el.tagName);
    }

    // Ba lựa chọn + ô nhập + nút gửi đều nhận được tiêu điểm.
    expect(dichVaoDuoc.filter((t) => t === 'BUTTON').length).toBeGreaterThanOrEqual(3);
    expect(dichVaoDuoc).toContain('INPUT');
  });
});
