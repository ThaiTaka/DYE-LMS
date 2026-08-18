'use server';

/**
 * Teacher actions — the writes that change what a student sees.
 *
 * Every one of these starts with `authorize()`. A teacher may only touch a
 * student they actually teach, through a real `Class → Enrollment` row, and the
 * check runs on the server whether or not the UI offered the control. Hiding a
 * button is not access control.
 *
 * Each action returns a result object rather than throwing on refusal, because
 * these are called from forms via `useActionState`: a thrown error becomes a
 * crash page, while a returned message becomes an explanation next to the
 * control the teacher just used.
 */
import {
  authorize,
  chuyenGiaoHoSoGiangDay,
  voHieuHoaNhanVien,
  xoaTaiKhoanNhanVien,
  ForbiddenError,
} from '@dye/core';
import { revalidatePath } from 'next/cache';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';

import type { LessonStatus, Tier } from '@prisma/client';

export interface KetQuaHanhDong {
  trangThai: 'chua-lam' | 'thanh-cong' | 'tu-choi' | 'loi';
  thongDiep: string;
}

export const CHUA_LAM: KetQuaHanhDong = { trangThai: 'chua-lam', thongDiep: '' };

const TIERS: Tier[] = ['CO_BAN', 'THU_THACH', 'NANG_CAO', 'MO_RONG'];
const TEN_NHANH: Record<Tier, string> = {
  CO_BAN: 'Cơ bản',
  THU_THACH: 'Thử thách',
  NANG_CAO: 'Nâng cao',
  MO_RONG: 'Mở rộng',
};

const TRANG_THAI: LessonStatus[] = ['REQUIRED', 'RECOMMENDED', 'OPTIONAL', 'ADVANCED'];

/** Wrap an action so a refusal reads as a message, never as a crash page. */
async function chay(
  viec: () => Promise<KetQuaHanhDong>,
): Promise<KetQuaHanhDong> {
  try {
    return await viec();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { trangThai: 'tu-choi', thongDiep: 'Thầy cô không có quyền thực hiện việc này.' };
    }
    // Unexpected: log server-side, tell the caller something honest and short.
    console.error('[giao-vien] hành động thất bại', error);
    return { trangThai: 'loi', thongDiep: 'Có lỗi kỹ thuật. Thầy cô thử lại giúp em nhé.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Differentiation tier
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Move a student to a different tier.
 *
 * Reversible by design, and invisible to the student's classmates. The note is
 * the teacher's own planning aid ("đang tăng tốc, thử NÂNG CAO tuần sau") and is
 * never rendered in the student UI.
 */
export async function datNhanh(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const studentId = String(form.get('studentId') ?? '');
    const courseId = String(form.get('courseId') ?? '');
    const tierRaw = String(form.get('tier') ?? '');
    const note = String(form.get('note') ?? '').trim();

    if (!studentId || !courseId) {
      return { trangThai: 'loi', thongDiep: 'Thiếu thông tin học sinh hoặc khoá học.' };
    }
    // Never trust a form value into an enum column.
    const tier = TIERS.find((t) => t === tierRaw);
    if (!tier) return { trangThai: 'loi', thongDiep: 'Nhánh học không hợp lệ.' };

    await authorize(db, actor, { resource: 'track', action: 'manage', studentId, courseId });

    await db.trackAssignment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: {
        studentId,
        courseId,
        tier,
        assignedBy: actor.id,
        note: note || null,
      },
      update: { tier, assignedBy: actor.id, note: note || null },
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'track.assigned',
        entityType: 'User',
        entityId: studentId,
        meta: { courseId, tier },
      },
    });

    revalidatePath(`/giao-vien/hoc-sinh/${studentId}`);
    revalidatePath('/giao-vien');

    return {
      trangThai: 'thanh-cong',
      thongDiep: `Đã chuyển sang nhánh ${TEN_NHANH[tier]}. Em có thể đổi lại bất cứ lúc nào.`,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Lesson overrides
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Open, close, restatus or waive prerequisites on one lesson for one student.
 *
 * Written as an explicit `LessonOverride` row rather than by editing the lesson,
 * so the curriculum stays the curriculum and the intervention stays attributable:
 * who did it, when, and why.
 */
export async function datCanThiepBaiHoc(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const studentId = String(form.get('studentId') ?? '');
    const lessonId = String(form.get('lessonId') ?? '');
    const hanhDong = String(form.get('hanhDong') ?? '');
    const reason = String(form.get('reason') ?? '').trim();
    const forceStatusRaw = String(form.get('forceStatus') ?? '');

    if (!studentId || !lessonId) {
      return { trangThai: 'loi', thongDiep: 'Thiếu thông tin bài học hoặc học sinh.' };
    }

    await authorize(db, actor, { resource: 'lessonOverride', action: 'manage', studentId });

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, order: true },
    });
    if (!lesson) return { trangThai: 'loi', thongDiep: 'Không tìm thấy bài học.' };

    // Student-scoped overrides are replaced rather than stacked, so the resolved
    // state matches what the teacher last chose instead of depending on which
    // of several rows happens to be newest.
    await db.lessonOverride.deleteMany({ where: { lessonId, studentId } });

    let thongDiep: string;

    switch (hanhDong) {
      case 'mo-khoa': {
        await db.lessonOverride.create({
          data: {
            lessonId,
            studentId,
            isUnlocked: true,
            waivePrerequisites: true,
            reason: reason || null,
            createdBy: actor.id,
          },
        });
        thongDiep = `Đã mở Buổi ${lesson.order} cho em này.`;
        break;
      }

      case 'khoa-lai': {
        await db.lessonOverride.create({
          data: {
            lessonId,
            studentId,
            isUnlocked: false,
            reason: reason || null,
            createdBy: actor.id,
          },
        });
        thongDiep = `Đã tạm khoá Buổi ${lesson.order} với em này.`;
        break;
      }

      case 'bo-tien-quyet': {
        await db.lessonOverride.create({
          data: {
            lessonId,
            studentId,
            waivePrerequisites: true,
            reason: reason || null,
            createdBy: actor.id,
          },
        });
        thongDiep = `Đã bỏ yêu cầu bài trước cho Buổi ${lesson.order}.`;
        break;
      }

      case 'doi-trang-thai': {
        const forceStatus = TRANG_THAI.find((s) => s === forceStatusRaw);
        if (!forceStatus) return { trangThai: 'loi', thongDiep: 'Trạng thái không hợp lệ.' };
        await db.lessonOverride.create({
          data: {
            lessonId,
            studentId,
            forceStatus,
            reason: reason || null,
            createdBy: actor.id,
          },
        });
        thongDiep = `Đã đổi trạng thái Buổi ${lesson.order}.`;
        break;
      }

      case 'go-bo': {
        // The deleteMany above already removed it.
        thongDiep = `Đã gỡ can thiệp ở Buổi ${lesson.order}. Bài trở lại quy tắc chung.`;
        break;
      }

      default:
        return { trangThai: 'loi', thongDiep: 'Hành động không hợp lệ.' };
    }

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'lesson.override',
        entityType: 'Lesson',
        entityId: lessonId,
        meta: { studentId, hanhDong, reason: reason || null },
      },
    });

    revalidatePath(`/giao-vien/hoc-sinh/${studentId}`);

    return { trangThai: 'thanh-cong', thongDiep };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff accounts
// ═══════════════════════════════════════════════════════════════════════════

/** Retire a staff account without destroying their record. Admin-only. */
export async function voHieuHoa(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const targetId = String(form.get('targetId') ?? '');
    if (!targetId) return { trangThai: 'loi', thongDiep: 'Thiếu tài khoản cần xử lý.' };

    const { sessionsRevoked } = await voHieuHoaNhanVien(db, actor, targetId);
    revalidatePath('/giao-vien/nhan-su');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã ngưng quyền truy cập. Toàn bộ hồ sơ giảng dạy được giữ nguyên.` +
        (sessionsRevoked > 0 ? ` Đã đăng xuất ${sessionsRevoked} phiên đang mở.` : ''),
    };
  });
}

/** Move a teacher's whole record to a named successor. Admin-only. */
export async function chuyenGiao(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const fromId = String(form.get('fromId') ?? '');
    const toId = String(form.get('toId') ?? '');
    if (!fromId || !toId) {
      return { trangThai: 'loi', thongDiep: 'Cần chọn cả người bàn giao và người nhận.' };
    }

    const kq = await chuyenGiaoHoSoGiangDay(db, actor, fromId, toId);
    revalidatePath('/giao-vien/nhan-su');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã bàn giao ${kq.lop} lớp, ${kq.nhanhDaGiao} phân nhánh, ` +
        `${kq.canThiepBaiHoc} can thiệp bài học, ${kq.thongBao} thông báo và ${kq.nhanXet} nhận xét. ` +
        `Người nhận từ giờ có quyền xem dữ liệu của các em trong những lớp này.`,
    };
  });
}

/** Permanently delete a staff account. Admin-only, and refuses while records remain. */
export async function xoaNhanVien(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const targetId = String(form.get('targetId') ?? '');
    const chuyenGiaoCho = String(form.get('chuyenGiaoCho') ?? '').trim();
    if (!targetId) return { trangThai: 'loi', thongDiep: 'Thiếu tài khoản cần xoá.' };

    const kq = await xoaTaiKhoanNhanVien(
      db,
      actor,
      targetId,
      chuyenGiaoCho ? { chuyenGiaoCho } : {},
    );
    revalidatePath('/giao-vien/nhan-su');

    if (kq.trangThai === 'con-rang-buoc') {
      const r = kq.anhHuong.rangBuoc;
      const con = [
        r.lop > 0 ? `${r.lop} lớp` : '',
        r.nhanhDaGiao > 0 ? `${r.nhanhDaGiao} phân nhánh` : '',
        r.canThiepBaiHoc > 0 ? `${r.canThiepBaiHoc} can thiệp bài học` : '',
        r.thongBao > 0 ? `${r.thongBao} thông báo` : '',
        r.nhanXet > 0 ? `${r.nhanXet} nhận xét` : '',
      ]
        .filter(Boolean)
        .join(', ');

      return {
        trangThai: 'tu-choi',
        thongDiep:
          `Chưa xoá được: tài khoản này còn ${con}. ` +
          `Hãy chọn người nhận bàn giao, hoặc ngưng quyền truy cập thay vì xoá.`,
      };
    }

    return {
      trangThai: 'thanh-cong',
      thongDiep: `Đã xoá tài khoản ${kq.username}. Nhật ký kiểm toán vẫn giữ lại việc này.`,
    };
  });
}
