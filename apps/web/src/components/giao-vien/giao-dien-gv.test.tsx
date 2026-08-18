/**
 * Teacher UI component tests.
 *
 * Three things Phase 6 must get right:
 *   • the interface never labels a child, only their work;
 *   • an intervention control cannot be mistaken for a permission (the server
 *     re-checks, and the copy says what an action actually does);
 *   • the accessibility floor is the same as the student side.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HangCanThiep } from './dieu-khien-bai-hoc';
import { DieuKhienNhanh } from './dieu-khien-nhanh';
import { HangNhanSu } from './quan-ly-nhan-su';

import type { LessonAccess } from '@dye/core';

// Server actions are stubbed: these tests are about the interface, and the
// authorization they perform is covered by the integration tests.
const datNhanhStub = vi.hoisted(() => vi.fn());
const canThiepStub = vi.hoisted(() => vi.fn());
const voHieuStub = vi.hoisted(() => vi.fn());
const chuyenGiaoStub = vi.hoisted(() => vi.fn());
const xoaStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/giao-vien/actions', () => ({
  CHUA_LAM: { trangThai: 'chua-lam', thongDiep: '' },
  datNhanh: datNhanhStub,
  datCanThiepBaiHoc: canThiepStub,
  voHieuHoa: voHieuStub,
  chuyenGiao: chuyenGiaoStub,
  xoaNhanVien: xoaStub,
}));

beforeEach(() => {
  for (const s of [datNhanhStub, canThiepStub, voHieuStub, chuyenGiaoStub, xoaStub]) s.mockReset();
});

// ── Fixtures ───────────────────────────────────────────────────────────────

function bai(over: Partial<LessonAccess> = {}): LessonAccess {
  return {
    lessonId: 'l1',
    slug: 'b01-lam-quen',
    title: 'Buổi 1 · Làm quen với `python`',
    order: 1,
    moduleId: 'm1',
    status: 'REQUIRED',
    statusSource: 'default',
    isRequired: true,
    unlocked: true,
    lockReason: null,
    missingPrerequisites: [],
    prerequisitesWaived: false,
    teacherOverridden: false,
    state: 'NOT_STARTED',
    completed: false,
    ...over,
  };
}

const NHAN_SU = {
  id: 'gv1',
  username: 'co.lan',
  displayName: 'Cô Nguyễn Thị Lan',
  role: 'TEACHER' as const,
  isActive: true,
  soLop: 2,
  laToi: false,
};

const NGUOI_NHAN = [
  { id: 'gv2', username: 'thay.minh', displayName: 'Thầy Trần Văn Minh' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Ngôn ngữ
// ═══════════════════════════════════════════════════════════════════════════

/** Deficit vocabulary, in the forms it would realistically appear. */
const TU_TIEU_CUC = [
  /học sinh yếu/i,
  /học sinh kém/i,
  /nhóm yếu/i,
  /trình độ yếu/i,
  /\btụt hậu\b/i,
  /\bthất bại\b/i,
  /\bdốt\b/i,
];

describe('Ngôn ngữ mô tả công việc, không mô tả học sinh', () => {
  it('bộ chọn nhánh không chứa từ tiêu cực nào', () => {
    const { container } = render(
      <DieuKhienNhanh
        studentId="hs1"
        courseId="c1"
        tierHienTai="CO_BAN"
        ghiChu={null}
        tenHocSinh="Phạm Tiến Dũng"
      />,
    );

    const chu = container.textContent ?? '';
    for (const xau of TU_TIEU_CUC) expect(chu).not.toMatch(xau);
  });

  it('không có bậc nào dưới Cơ bản trên thang phân hoá', () => {
    render(
      <DieuKhienNhanh
        studentId="hs1"
        courseId="c1"
        tierHienTai="CO_BAN"
        ghiChu={null}
        tenHocSinh="Phạm Tiến Dũng"
      />,
    );

    const nhom = screen.getByRole('group', { name: /nhánh học/i });
    const cacLuaChon = within(nhom).getAllByRole('radio');
    // Exactly four, and the lowest is the guaranteed floor — not a verdict.
    expect(cacLuaChon).toHaveLength(4);
    expect(within(nhom).getByText('Cơ bản')).toBeInTheDocument();
    expect(within(nhom).getByText('Mở rộng')).toBeInTheDocument();
  });

  it('nói rõ nhánh học có thể đổi lại và bạn cùng lớp không thấy', () => {
    render(
      <DieuKhienNhanh
        studentId="hs1"
        courseId="c1"
        tierHienTai="NANG_CAO"
        ghiChu={null}
        tenHocSinh="Phạm Tiến Dũng"
      />,
    );
    expect(screen.getByText(/đổi lại lúc nào cũng được/i)).toBeInTheDocument();
    expect(screen.getByText(/không nhìn thấy lựa chọn này/i)).toBeInTheDocument();
  });

  it('ghi chú của giáo viên được đánh dấu là học sinh không xem được', () => {
    render(
      <DieuKhienNhanh
        studentId="hs1"
        courseId="c1"
        tierHienTai="CO_BAN"
        ghiChu="đang tăng tốc"
        tenHocSinh="Dũng"
      />,
    );
    expect(screen.getByLabelText(/học sinh không nhìn thấy/i)).toHaveValue('đang tăng tốc');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Can thiệp bài học
// ═══════════════════════════════════════════════════════════════════════════

describe('Điều khiển can thiệp bài học', () => {
  it('tiêu đề bài học hiện ra đã gỡ dấu backtick', () => {
    render(<HangCanThiep studentId="hs1" bai={bai()} daCanThiep={false} />);
    // The Phase 5 defect, asserted where a teacher would actually see it.
    expect(screen.getByText(/Làm quen với python/)).toBeInTheDocument();
    expect(screen.queryByText(/`python`/)).not.toBeInTheDocument();
  });

  it('điều khiển ẩn cho tới khi thầy cô mở ra', async () => {
    const nguoiDung = userEvent.setup();
    render(<HangCanThiep studentId="hs1" bai={bai({ unlocked: false })} daCanThiep={false} />);

    expect(screen.queryByRole('button', { name: /mở bài này/i })).not.toBeInTheDocument();

    const nut = screen.getByRole('button', { name: /điều chỉnh/i });
    expect(nut).toHaveAttribute('aria-expanded', 'false');

    await nguoiDung.click(nut);
    expect(nut).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /mở bài này/i })).toBeInTheDocument();
  });

  it('bài đang khoá thì hiện nút mở; bài đang mở thì hiện nút tạm khoá', async () => {
    const nguoiDung = userEvent.setup();
    const { unmount } = render(
      <HangCanThiep studentId="hs1" bai={bai({ unlocked: false })} daCanThiep={false} />,
    );
    await nguoiDung.click(screen.getByRole('button', { name: /điều chỉnh/i }));
    expect(screen.getByRole('button', { name: /mở bài này/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tạm khoá/i })).not.toBeInTheDocument();
    unmount();

    render(<HangCanThiep studentId="hs1" bai={bai({ unlocked: true })} daCanThiep={false} />);
    await nguoiDung.click(screen.getByRole('button', { name: /điều chỉnh/i }));
    expect(screen.getByRole('button', { name: /tạm khoá/i })).toBeInTheDocument();
  });

  it('nút bỏ tiên quyết chỉ hiện khi thực sự còn bài chưa xong', async () => {
    const nguoiDung = userEvent.setup();
    render(
      <HangCanThiep
        studentId="hs1"
        bai={bai({
          unlocked: false,
          missingPrerequisites: [{ id: 'l0', slug: 'b00', title: 'Buổi 0', order: 0 }],
        })}
        daCanThiep={false}
      />,
    );
    await nguoiDung.click(screen.getByRole('button', { name: /điều chỉnh/i }));
    expect(screen.getByRole('button', { name: /bỏ yêu cầu bài trước/i })).toBeInTheDocument();
  });

  it('ô lý do nói rõ sẽ được lưu vào nhật ký', async () => {
    const nguoiDung = userEvent.setup();
    render(<HangCanThiep studentId="hs1" bai={bai()} daCanThiep={false} />);
    await nguoiDung.click(screen.getByRole('button', { name: /điều chỉnh/i }));
    expect(screen.getByLabelText(/lưu vào nhật ký/i)).toBeInTheDocument();
  });

  it('hiện trạng thái thật của bài với riêng em này', () => {
    render(
      <HangCanThiep
        studentId="hs1"
        bai={bai({ isRequired: false, status: 'ADVANCED' })}
        daCanThiep={false}
      />,
    );
    expect(screen.getByText(/không tính vào tiến độ/i)).toBeInTheDocument();
  });

  it('đánh dấu rõ bài đã có can thiệp', () => {
    render(
      <HangCanThiep
        studentId="hs1"
        bai={bai({ teacherOverridden: true, statusSource: 'student-override' })}
        daCanThiep
      />,
    );
    expect(screen.getByText(/có can thiệp/i)).toBeInTheDocument();
    expect(screen.getByText(/đã đổi riêng/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Luồng xoá tài khoản
// ═══════════════════════════════════════════════════════════════════════════

describe('Luồng nghỉ việc / xoá tài khoản nhân sự', () => {
  it('ngưng quyền truy cập là hành động chính, không phải xoá', () => {
    render(<HangNhanSu nv={NHAN_SU} nguoiNhan={NGUOI_NHAN} />);
    // Deactivation is the visible default; deletion sits behind a disclosure.
    expect(screen.getByRole('button', { name: /ngưng quyền truy cập/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /xoá tài khoản/i })).not.toBeInTheDocument();
  });

  it('cảnh báo rõ vì sao nên ngưng thay vì xoá', async () => {
    const nguoiDung = userEvent.setup();
    render(<HangNhanSu nv={NHAN_SU} nguoiNhan={NGUOI_NHAN} />);

    await nguoiDung.click(screen.getByRole('button', { name: /bàn giao hoặc xoá/i }));
    expect(screen.getByText(/nên cân nhắc trước khi xoá/i)).toBeInTheDocument();
    expect(screen.getByText(/quyết định sư phạm/i)).toBeInTheDocument();
  });

  it('nói thẳng rằng bàn giao là trao quyền xem dữ liệu học sinh', async () => {
    const nguoiDung = userEvent.setup();
    render(<HangNhanSu nv={NHAN_SU} nguoiNhan={NGUOI_NHAN} />);

    await nguoiDung.click(screen.getByRole('button', { name: /bàn giao hoặc xoá/i }));
    // Transferring classes grants access to children. That must be stated, not
    // buried as a filing detail.
    expect(screen.getByText(/quyền xem dữ liệu của các em/i)).toBeInTheDocument();
  });

  it('không cho tự thao tác lên tài khoản của chính mình', () => {
    render(<HangNhanSu nv={{ ...NHAN_SU, laToi: true }} nguoiNhan={NGUOI_NHAN} />);
    expect(screen.getByText(/đây là bạn/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ngưng quyền truy cập/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bàn giao hoặc xoá/i })).not.toBeInTheDocument();
  });

  it('không đề xuất bàn giao cho chính người đang bị thay', async () => {
    const nguoiDung = userEvent.setup();
    render(
      <HangNhanSu
        nv={NHAN_SU}
        nguoiNhan={[...NGUOI_NHAN, { id: NHAN_SU.id, username: 'co.lan', displayName: 'Cô Lan' }]}
      />,
    );

    await nguoiDung.click(screen.getByRole('button', { name: /bàn giao hoặc xoá/i }));
    const chon = screen.getByLabelText(/bàn giao cho/i);
    const giaTri = within(chon).getAllByRole('option').map((o) => o.getAttribute('value'));
    expect(giaTri).not.toContain(NHAN_SU.id);
  });

  it('tài khoản đã ngưng thì không hiện nút ngưng nữa', () => {
    render(<HangNhanSu nv={{ ...NHAN_SU, isActive: false }} nguoiNhan={NGUOI_NHAN} />);
    expect(screen.getByText(/đã ngưng hoạt động/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ngưng quyền truy cập/i })).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Khả năng tiếp cận
// ═══════════════════════════════════════════════════════════════════════════

describe('Khả năng tiếp cận (axe)', () => {
  async function kiemTraAxe(node: HTMLElement) {
    const ketQua = await axe.run(node, {
      rules: {
        // jsdom dựng không có layout nên không đo được tương phản;
        // tương phản được tính riêng từ token trong hien-thi.test.tsx.
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    return ketQua.violations;
  }

  it('bộ chọn nhánh không có vi phạm', async () => {
    const { container } = render(
      <DieuKhienNhanh
        studentId="hs1"
        courseId="c1"
        tierHienTai="CO_BAN"
        ghiChu={null}
        tenHocSinh="Dũng"
      />,
    );
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('hàng can thiệp không có vi phạm, kể cả khi đã mở', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(
      <ul>
        <HangCanThiep studentId="hs1" bai={bai({ unlocked: false })} daCanThiep={false} />
      </ul>,
    );
    expect(await kiemTraAxe(container)).toEqual([]);

    await nguoiDung.click(screen.getByRole('button', { name: /điều chỉnh/i }));
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('hàng nhân sự không có vi phạm khi mở luồng xoá', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(
      <ul>
        <HangNhanSu nv={NHAN_SU} nguoiNhan={NGUOI_NHAN} />
      </ul>,
    );

    await nguoiDung.click(screen.getByRole('button', { name: /bàn giao hoặc xoá/i }));
    expect(await kiemTraAxe(container)).toEqual([]);
  });

  it('vùng mở ra được liên kết bằng aria-controls', async () => {
    const nguoiDung = userEvent.setup();
    render(<HangCanThiep studentId="hs1" bai={bai()} daCanThiep={false} />);

    const nut = screen.getByRole('button', { name: /điều chỉnh/i });
    const vungId = nut.getAttribute('aria-controls');
    expect(vungId).toBeTruthy();

    await nguoiDung.click(nut);
    expect(document.getElementById(vungId!)).toBeInTheDocument();
  });

  it('mọi điều khiển đều tới được bằng bàn phím', async () => {
    const nguoiDung = userEvent.setup();
    render(
      <DieuKhienNhanh
        studentId="hs1"
        courseId="c1"
        tierHienTai="CO_BAN"
        ghiChu={null}
        tenHocSinh="Dũng"
      />,
    );

    const chamToi: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      await nguoiDung.tab();
      const el = document.activeElement;
      if (el && el !== document.body) chamToi.push(el.tagName);
    }

    expect(chamToi).toContain('INPUT');
    expect(chamToi).toContain('BUTTON');
  });
});
