/**
 * One lesson, one workspace.
 *
 * `microbit-buoi-01` carried a Python warm-up block, so rendered on its own
 * terms it opened a CodeMirror Python editor on the same page as the MakeCode
 * iframe and a child was left to work out which box the homework went in. The
 * seed is fixed and Rule M7 in assertions.ts keeps it fixed; these tests are
 * the fence on the OTHER side, around what the player draws — which is what
 * governs a lesson a teacher authors later, where no seed rule applies.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KhoiNoiDung, moiTruongCuaBai } from './khoi-noi-dung';

import type { KhoiHienThi } from '@/lib/student-data';

/*
 * The workspaces import server actions that reach `@/auth` and therefore
 * next-auth. Next.js rewrites a 'use server' import into a network stub at
 * build time; Vitest does not, so the real module loads and fails on
 * `next/server`.
 */
vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/actions', () => ({
  kiemTraCauTraLoi: vi.fn(),
  danhDauKhoiXong: vi.fn(),
  nopBaiTuLuan: vi.fn(),
}));

vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions', () => ({
  tuDongLuu: vi.fn().mockResolvedValue({ trangThai: 'khong-doi', luuLuc: null, thongDiep: '' }),
  layBanNhap: vi.fn(),
  layLichSu: vi.fn().mockResolvedValue({ trangThai: 'ok', banLuu: [] }),
  layLichSuNop: vi.fn().mockResolvedValue({ trangThai: 'ok', baiNop: [] }),
  layNoiDungBanLuu: vi.fn(),
  khoiPhuc: vi.fn(),
  nop: vi.fn(),
  nopMicrobit: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function khoi(over: Partial<KhoiHienThi> = {}): KhoiHienThi {
  return {
    blockId: 'b1',
    order: 0,
    type: 'PLAYGROUND',
    stage: 'SAN_CHOI',
    title: 'Sân chơi: thử trước khi làm bài',
    tier: 'CO_BAN',
    access: 'REQUIRED',
    completed: false,
    estimatedMinutes: 15,
    noiDung: {
      kind: 'playground',
      markdown: 'Mở MakeCode ở một tab khác và thử ba việc sau.',
      starterCode: 'chu_em_muon_hien = "..."',
      goal: 'Thử được cả ba việc trong MakeCode.',
    },
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

const KHOI_MICROBIT = khoi({
  blockId: 'b2',
  type: 'MICROBIT_WORKSPACE',
  stage: 'THU_THACH',
  title: 'Hiện tên của em',
  noiDung: {
    kind: 'microbit',
    markdown: 'Em kéo thả các khối lệnh để hoàn thành yêu cầu.',
    goal: 'Tên chạy qua màn hình LED.',
    blocksXml: '',
    khoiLenh: ['show string'],
  },
});

describe('moiTruongCuaBai', () => {
  it('một khối Micro:bit là đủ để cả buổi thành buổi Micro:bit', () => {
    expect(moiTruongCuaBai([khoi(), KHOI_MICROBIT])).toBe('MICROBIT');
  });

  it('buổi không có phần cứng nào thì vẫn là Python', () => {
    expect(moiTruongCuaBai([khoi(), khoi({ blockId: 'b3', type: 'THEORY' })])).toBe('PYTHON');
  });

  it('nhận ra khối phần cứng qua `type`, kể cả khi JSON còn ghi là challenge', () => {
    // The two sources disagreeing is the authoring mistake this guards against.
    const lech = khoi({
      type: 'MICROBIT_WORKSPACE',
      noiDung: { kind: 'challenge', markdown: 'Làm bài nhé.' },
    });
    expect(moiTruongCuaBai([lech])).toBe('MICROBIT');
  });

  it('buổi rỗng không làm hàm nổ', () => {
    expect(moiTruongCuaBai([])).toBe('PYTHON');
  });
});

describe('KhoiNoiDung — khu làm bài đúng môi trường', () => {
  it('sân chơi Python trong buổi Micro:bit KHÔNG mở khung gõ code', () => {
    render(<KhoiNoiDung khoi={khoi()} moiTruong="MICROBIT" />);

    expect(screen.queryByText('Khung soạn thảo')).not.toBeInTheDocument();
    // The instructions stay — the block still has something to say.
    expect(screen.getByText(/Mở MakeCode ở một tab khác/)).toBeInTheDocument();
    // And the student is told where the work actually happens.
    expect(screen.getByText(/khối lệnh MakeCode/)).toBeInTheDocument();
  });

  it('cũng sân chơi đó, trong buổi Python, thì mở khung gõ code như cũ', () => {
    render(<KhoiNoiDung khoi={khoi()} moiTruong="PYTHON" />);

    expect(screen.getByText('Khung soạn thảo')).toBeInTheDocument();
    expect(screen.queryByText(/khối lệnh MakeCode/)).not.toBeInTheDocument();
  });

  it('khối đánh dấu MICROBIT_WORKSPACE không bao giờ mở khung Python, dù JSON ghi gì', () => {
    const lech = khoi({
      type: 'MICROBIT_WORKSPACE',
      noiDung: { kind: 'challenge', markdown: 'Làm bài nhé.' },
    });

    // Even told the lesson is Python, the block's own type wins.
    render(<KhoiNoiDung khoi={lech} moiTruong="PYTHON" />);

    expect(screen.queryByText('Bài làm của em')).not.toBeInTheDocument();
    expect(screen.getByText(/khối lệnh MakeCode/)).toBeInTheDocument();
  });

  it('không truyền môi trường thì khối tự quyết định, như trước đây', () => {
    render(<KhoiNoiDung khoi={khoi()} />);
    expect(screen.getByText('Khung soạn thảo')).toBeInTheDocument();
  });
});
