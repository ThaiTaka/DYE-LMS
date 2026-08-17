/**
 * Course 3 — Python Nâng Cao & Cấu Trúc Dữ Liệu (30 buổi).
 *
 * Source: lesson plan "PYTHON NÂNG CAO & CẤU TRÚC DỮ LIỆU", 4 chapters across
 * 30 sessions. The chapter boundaries come from the brief; the session-by-session
 * split inside each chapter is reconstructed — those lessons carry `isDerived`.
 *
 * Security posture for this course (teacher notes 15 & 16):
 *   • Every problem runs with networkPolicy NONE.
 *   • Socket exercises use loopback (127.0.0.1) inside a --network=none container.
 *   • Web API exercises use RuntimeImage.PY_WEB with a local mock server.
 */
import type { CourseSpec, ModuleSpec } from '../types.ts';
import { advancedLessons1to5 } from './nang-cao-m1a.ts';
import { advancedLessons6to10 } from './nang-cao-m1b.ts';
import { advancedChuong2 } from './nang-cao-m2.ts';
import { advancedChuong3 } from './nang-cao-m3.ts';
import { advancedChuong4 } from './nang-cao-m4b.ts';

const advancedChuong1: ModuleSpec = {
  slug: 'lap-trinh-huong-doi-tuong',
  title: 'Chương 1 · Lập trình hướng đối tượng',
  description:
    'Mười buổi học cách mô hình hoá thế giới thực bằng code. Bắt đầu từ tư duy — nhìn một bài toán ' +
    'và thấy được các đối tượng trong đó — rồi mới tới cú pháp. Kết chương bằng một dự án mô hình ' +
    'hoá hệ thống thật, viết theo chuẩn PEP8.',
  lessons: [...advancedLessons1to5, ...advancedLessons6to10],
};

export const pythonNangCao: CourseSpec = {
  slug: 'python-nang-cao',
  title: 'Python Nâng Cao & Cấu Trúc Dữ Liệu',
  subtitle: '30 buổi · OOP, Mạng, Web API và Thuật toán',
  description:
    'Khoá học dành cho em đã vững Python cơ bản và muốn viết được phần mềm thật.\n\n' +
    'Em sẽ học cách mô hình hoá hệ thống bằng lập trình hướng đối tượng, tự viết server mạng và ' +
    'phòng chat nhiều người, bóc tách dữ liệu bằng biểu thức chính quy, gọi Web API có xử lý lỗi ' +
    'đầy đủ, và cuối cùng là tự cài đặt các thuật toán tìm kiếm và sắp xếp — rồi đo hiệu năng thật ' +
    'của chúng ở dữ liệu từ 100 đến 100 000 phần tử.\n\n' +
    'Toàn bộ phần mạng và Web API chạy trên địa chỉ nội bộ 127.0.0.1 với máy chủ mô phỏng, ' +
    'nên em học được kỹ thuật thật trong một môi trường an toàn tuyệt đối.',
  totalSessions: 30,
  order: 3,
  colorToken: 'amber',
  iconEmoji: '⚡',
  modules: [advancedChuong1, advancedChuong2, advancedChuong3, advancedChuong4],
};
