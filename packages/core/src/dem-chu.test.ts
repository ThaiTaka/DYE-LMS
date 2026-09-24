/**
 * The word counter behind the 150-word floor.
 *
 * Pure, so it runs without a database — and it matters more than its size:
 * the browser's live counter and the server's refusal both call this, and a
 * child whose screen says 150/150 must never be told by the server they wrote
 * 149.
 */
import { describe, expect, it } from 'vitest';

import { demSoChu, SO_CHU_TOI_THIEU_SUY_NGAM } from './dem-chu';

describe('demSoChu', () => {
  it('đếm theo khoảng trắng — mỗi tiếng Việt là một chữ', () => {
    expect(demSoChu('Hôm nay em học vòng lặp for.')).toBe(7);
  });

  it('chuỗi rỗng và toàn khoảng trắng là 0 chữ', () => {
    expect(demSoChu('')).toBe(0);
    expect(demSoChu('   \n\t  ')).toBe(0);
  });

  it('xuống dòng, tab và khoảng trắng liền nhau không tạo thêm chữ', () => {
    expect(demSoChu('  em   học\n\nPython\t rất   vui  ')).toBe(5);
  });

  it('dấu câu đứng riêng không được tính là chữ', () => {
    // A line of dashes is not writing. Counting it would teach the shortcut.
    expect(demSoChu('- - - - . . . ! ?')).toBe(0);
    expect(demSoChu('em học — rất vui !')).toBe(4);
  });

  it('dấu câu dính vào chữ không làm mất chữ đó', () => {
    expect(demSoChu('"print()", range(5), x=3.')).toBe(3);
  });

  it('số được tính là chữ', () => {
    expect(demSoChu('vòng lặp chạy 10 lần')).toBe(5);
  });

  it('khoảng trắng không ngắt (NBSP) cũng là dấu tách', () => {
    // Pasted from a word processor, a sentence can arrive with U+00A0 between
    // words; a counter that treated it as a letter would glue them together.
    expect(demSoChu('em\u00a0học\u00a0Python')).toBe(3);
  });

  it('đúng 150 chữ thì đạt mức tối thiểu, 149 thì chưa', () => {
    const du = Array.from({ length: SO_CHU_TOI_THIEU_SUY_NGAM }, () => 'chữ').join(' ');
    expect(demSoChu(du)).toBe(SO_CHU_TOI_THIEU_SUY_NGAM);
    expect(demSoChu(du.slice(0, du.lastIndexOf(' ')))).toBe(SO_CHU_TOI_THIEU_SUY_NGAM - 1);
  });

  it('mức tối thiểu là 150 chữ', () => {
    expect(SO_CHU_TOI_THIEU_SUY_NGAM).toBe(150);
  });
});
