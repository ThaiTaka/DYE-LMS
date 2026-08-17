/**
 * Course 1 — Python Cơ Bản (30 buổi).
 *
 * Source: lesson plan "PYTHON CƠ BẢN", 11 enumerated topics across 30 sessions.
 * Sessions marked `isDerived` were reconstructed to fill the 30-session count;
 * see docs/03-CURRICULUM-MAP.md.
 *
 * The guaranteed floor is sessions 1–19 (REQUIRED). From session 20 (Collections,
 * i.e. Lesson 7) onward the course is OPTIONAL/ADVANCED, because the lesson plan
 * states some students will max out around Loops.
 */
import type { CourseSpec } from '../types.ts';
import { module1, module2 } from './python-co-ban-m1.ts';
import { module3, module4 } from './python-co-ban-m2.ts';
import { module5, module6 } from './python-co-ban-m3.ts';
import { module7, module8, module9 } from './python-co-ban-m4.ts';

export const pythonCoBan: CourseSpec = {
  slug: 'python-co-ban',
  title: 'Python Cơ Bản',
  subtitle: '30 buổi · Từ phép tính đầu tiên đến chương trình hoàn chỉnh',
  description:
    'Khoá học nền tảng dành cho học sinh trung học cơ sở chưa từng lập trình. Em sẽ đi từ những phép ' +
    'tính đơn giản, học cách lưu trữ dữ liệu, dạy chương trình ra quyết định và lặp lại công việc, ' +
    'rồi kết thúc bằng một dự án của riêng mình.\n\n' +
    'Mười chín buổi đầu là phần nền tảng bắt buộc. Từ buổi 20 trở đi, nội dung là tuỳ chọn — em có thể ' +
    'đi tiếp cùng lớp, hoặc quay lại luyện thêm những phần muốn thật vững. Cả hai lựa chọn đều được ' +
    'ghi nhận là hoàn thành khoá học.',
  totalSessions: 30,
  order: 1,
  colorToken: 'emerald',
  iconEmoji: '🐍',
  modules: [module1, module2, module3, module4, module5, module6, module7, module8, module9],
};
