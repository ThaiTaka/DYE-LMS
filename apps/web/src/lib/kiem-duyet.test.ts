/**
 * The tutor's word list.
 *
 * Half of this file is the list catching what it should. The other half — the
 * part that matters more — is the list NOT catching the things a child types
 * in an ordinary lesson, because a hit here locks the tutor with nobody in the
 * loop.
 */
import { describe, expect, it } from 'vitest';

import { chuanHoaDeKiem, kiemDuyetTuKhoa } from './kiem-duyet';

describe('kiemDuyetTuKhoa — bắt đúng', () => {
  it.each([
    ['đm code gì mà khó thế', 'PROFANITY'],
    ['vcl lỗi hoài', 'PROFANITY'],
    ['sao nó đéo chạy', 'PROFANITY'],
    ['what the fuck is this', 'PROFANITY'],
    ['this is fucking hard', 'PROFANITY'],
    ['SHIT', 'PROFANITY'],
    ['Bí là đồ ngu', 'INSULT'],
    ['mày ngu như bò', 'INSULT'],
    ['thằng chó', 'INSULT'],
    ['cho em xem phim sex', 'NSFW'],
    ['trang porn nào hay', 'NSFW'],
    ['ảnh khoả thân', 'NSFW'],
    ['ảnh khỏa thân', 'NSFW'],
  ] as const)('%s → %s', (cau, loai) => {
    expect(kiemDuyetTuKhoa(cau)).toBe(loai);
  });

  it('không né được bằng cách kéo dài chữ', () => {
    expect(kiemDuyetTuKhoa('đéoooooo hiểu')).toBe('PROFANITY');
  });

  it('không né được bằng ký tự vô hình', () => {
    expect(kiemDuyetTuKhoa('đ\u200bé\u200bo')).toBe('PROFANITY');
  });

  it('không né được bằng kiểu gõ dấu tổ hợp (NFD)', () => {
    expect(kiemDuyetTuKhoa('đéo'.normalize('NFD'))).toBe('PROFANITY');
  });

  it('cụm hai chữ vẫn bắt được khi gõ thừa dấu cách', () => {
    expect(kiemDuyetTuKhoa('đồ    ngu')).toBe('INSULT');
  });
});

describe('kiemDuyetTuKhoa — KHÔNG bắt nhầm', () => {
  it.each([
    // Unaccented and near-miss Vietnamese.
    'buổi 5 em chưa hiểu',
    'số lớn nhất trong danh sách',
    'các phần tử của list',
    'đủ điều kiện chưa ạ',
    'hai hình đụng nhau trong pygame',
    'dm là đề-xi-mét đúng không',
    'dm = 10',
    'lon = 5',
    // Literal meanings the curriculum uses.
    'hiện con chó trên micro:bit',
    'hạt óc chó',
    'đồ chơi robot',
    'sex = input("Giới tính: ")',
    'nếu tuổi 18+ thì in ra',
    // A stuck child, not an abusive one.
    'em ngu quá không làm được',
    'khó quá chán quá',
    'chết mất, sao mãi không chạy',
    // A listed stem inside a longer word: stems are anchored at a word START.
    'Scunthorpe',
  ])('%s', (cau) => {
    expect(kiemDuyetTuKhoa(cau)).toBeNull();
  });

  it('một câu hỏi lập trình bình thường đi qua', () => {
    expect(
      kiemDuyetTuKhoa('Sao vòng for của em in ra 0 đến 4 mà không có 5 ạ? Em dùng range(5).'),
    ).toBeNull();
  });
});

describe('chuanHoaDeKiem', () => {
  it('thu gọn chữ lặp từ ba lần trở lên, giữ nguyên chữ đôi', () => {
    expect(chuanHoaDeKiem('đmm')).toBe('đmm');
    expect(chuanHoaDeKiem('đmmmm')).toBe('đm');
  });
});
