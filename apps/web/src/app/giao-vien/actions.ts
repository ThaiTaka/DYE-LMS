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
  chamTay,
  chuyenGiaoHoSoGiangDay,
  ganKhoaHocVaoLop,
  goKhoaHocKhoiLop,
  khoiPhucHocSinh,
  laVaiTroTaoDuoc,
  luuTruLopHoc,
  phanCongLopHoc,
  taoLopHoc,
  taoTaiKhoan,
  voHieuHoaHocSinh,
  voHieuHoaNhanVien,
  xoaLopHoc,
  xoaTaiKhoanHocSinh,
  xoaTaiKhoanNhanVien,
  xuLyCanhBao,
  ForbiddenError,
} from '@dye/core';
import { revalidatePath } from 'next/cache';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';

import type { KetQuaHanhDong } from './ket-qua';

import type { LessonStatus, Tier } from '@prisma/client';

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

/**
 * Grade a Micro:bit submission by hand.
 *
 * The one path in the system where a human sets a verdict. `chamTay` in
 * @dye/core refuses it for anything the sandbox CAN judge, so this cannot be
 * used to set an IO_MATCH result without a single test having run.
 */
export async function chamBaiMicrobit(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const submissionId = String(form.get('submissionId') ?? '');
    const verdictRaw = String(form.get('verdict') ?? '');
    const nhanXet = String(form.get('nhanXet') ?? '').trim();
    const score = Number(form.get('score') ?? 0);

    if (!submissionId) return { trangThai: 'loi', thongDiep: 'Thiếu bài nộp.' };
    if (nhanXet.length < 3) {
      return {
        trangThai: 'loi',
        thongDiep: 'Thầy cô viết vài dòng nhận xét giúp em nhé — em cần biết vì sao.',
      };
    }
    if (verdictRaw !== 'ACCEPTED' && verdictRaw !== 'WRONG_ANSWER') {
      return { trangThai: 'loi', thongDiep: 'Kết luận không hợp lệ.' };
    }
    if (!Number.isFinite(score)) {
      return { trangThai: 'loi', thongDiep: 'Điểm không hợp lệ.' };
    }

    const kq = await chamTay(db, actor, submissionId, verdictRaw, score, nhanXet.slice(0, 4000));

    revalidatePath('/giao-vien/microbit');
    revalidatePath(`/giao-vien/microbit/${submissionId}`);

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        kq.verdict === 'ACCEPTED'
          ? `Đã chấm đạt (${kq.score} điểm). Tiến độ của em đã được cập nhật.`
          : 'Đã gửi nhận xét. Em sẽ thấy và có thể nộp lại.',
    };
  });
}

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

/**
 * Provision a new account. Admin-only, enforced inside `taoTaiKhoan`.
 *
 * The password is read from the form and handed to core as plain text, which is
 * the only place it exists in that form: core hashes it with Argon2id before the
 * row is written, and nothing here logs, echoes or returns it. The success
 * message deliberately repeats the USERNAME and not the password — an admin
 * creating twenty students needs to confirm the account name, and a password
 * rendered back into the page would end up in a screenshot on a staffroom
 * laptop.
 */
export async function taoTaiKhoanMoi(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const vaiTroTho = String(form.get('role') ?? '');
    if (!laVaiTroTaoDuoc(vaiTroTho)) {
      return { trangThai: 'loi', thongDiep: 'Vai trò không hợp lệ.' };
    }

    let ketQua;
    try {
      ketQua = await taoTaiKhoan(db, actor, {
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
        displayName: String(form.get('displayName') ?? ''),
        role: vaiTroTho,
        avatarUrl: String(form.get('avatarUrl') ?? ''),
        classIds: form.getAll('classIds').map(String).filter(Boolean),
        // Absent checkbox means unchecked, and the safe reading of "unchecked" is
        // still to force a change — so this only turns OFF when asked explicitly.
        mustChangePassword: form.get('giuMatKhau') !== 'co',
      });
    } catch (error) {
      /*
       * One refusal is a form mistake, not a permission problem.
       *
       * A teacher who forgets to tick a class would otherwise be told "thầy cô
       * không có quyền" by the generic handler and go asking an admin for
       * something they can fix themselves in two seconds.
       *
       * `reason` is internal and is never echoed — this matches ONE known value
       * and answers with a sentence written here. Every other reason keeps the
       * generic refusal, so a real boundary violation still says nothing about
       * why.
       */
      if (
        error instanceof ForbiddenError &&
        error.reason === 'teacher-must-assign-own-class'
      ) {
        return {
          trangThai: 'loi',
          thongDiep: 'Thầy cô chọn giúp em ít nhất một lớp mà thầy cô đang dạy nhé.',
        };
      }
      throw error;
    }

    if (ketQua.trangThai === 'trung-ten') {
      return {
        trangThai: 'loi',
        thongDiep: `Tên đăng nhập “${ketQua.username}” đã có người dùng. Thầy cô chọn tên khác giúp em nhé.`,
      };
    }

    if (ketQua.trangThai === 'khong-hop-le') {
      return { trangThai: 'loi', thongDiep: ketQua.thongDiep };
    }

    revalidatePath('/giao-vien/nhan-su');
    revalidatePath('/giao-vien/hoc-sinh');

    const vaiTro =
      ketQua.role === 'ADMIN' ? 'quản trị viên' : ketQua.role === 'TEACHER' ? 'giáo viên' : 'học sinh';

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã tạo tài khoản ${vaiTro} “${ketQua.displayName}” với tên đăng nhập ${ketQua.username}` +
        (ketQua.soLop > 0 ? `, đã xếp vào ${ketQua.soLop} lớp` : '') +
        '. Lần đăng nhập đầu tiên, tài khoản sẽ được yêu cầu tự đặt lại mật khẩu.',
    };
  });
}

/**
 * Hand one or more classes to a member of staff. Admin-only, enforced in
 * `phanCongLopHoc`.
 *
 * Both the personnel page and the student page are revalidated: moving a class
 * changes who runs it AND which children each teacher can see, and the student
 * page is built from exactly that scope.
 */
export async function phanCongLop(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const targetId = String(form.get('targetId') ?? '');
    if (!targetId) return { trangThai: 'loi', thongDiep: 'Thiếu thầy cô cần phân công.' };

    const classIds = form.getAll('classIds').map(String).filter(Boolean);
    if (classIds.length === 0) {
      // Answered here rather than letting the guard refuse it, so forgetting to
      // tick a box does not read as a permission problem.
      return { trangThai: 'loi', thongDiep: 'Chọn giúp em ít nhất một lớp để giao nhé.' };
    }

    const kq = await phanCongLopHoc(db, actor, targetId, classIds);
    revalidatePath('/giao-vien/nhan-su');
    revalidatePath('/giao-vien/hoc-sinh');

    if (kq.daChuyen.length === 0) {
      return {
        trangThai: 'thanh-cong',
        thongDiep: 'Các lớp đã chọn vốn đã do thầy cô này phụ trách, nên không có gì thay đổi.',
      };
    }

    const dsLop = kq.daChuyen.map((l) => `${l.ten} (từ ${l.tuAi})`).join('; ');
    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã giao ${kq.daChuyen.length} lớp: ${dsLop}. ` +
        'Thầy cô nhận lớp từ giờ xem được dữ liệu của các em trong những lớp này, ' +
        'và người giao lớp thì không còn xem được nữa.' +
        (kq.giuNguyen > 0 ? ` ${kq.giuNguyen} lớp vốn đã thuộc thầy cô này.` : ''),
    };
  });
}

/**
 * Create a class. Admin-only, enforced in `taoLopHoc`.
 *
 * Three pages are revalidated because a new class changes three different
 * questions: the class list itself, which classes a teacher can be given
 * (`/nhan-su`), and which classes a student can be enrolled into
 * (`/hoc-sinh`). Without this the class exists but does not appear in either
 * form until something else happens to invalidate the cache.
 */
export async function taoLop(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const kq = await taoLopHoc(db, actor, {
      ten: String(form.get('ten') ?? ''),
      ma: String(form.get('ma') ?? ''),
      term: String(form.get('term') ?? ''),
      giaoVienId: String(form.get('giaoVienId') ?? ''),
    });

    if (kq.trangThai === 'trung-ma') {
      return {
        trangThai: 'loi',
        thongDiep: `Mã lớp “${kq.ma}” đã có lớp khác dùng. Thầy cô đổi mã giúp em nhé.`,
      };
    }

    if (kq.trangThai === 'khong-hop-le') {
      return { trangThai: 'loi', thongDiep: kq.thongDiep };
    }

    revalidatePath('/giao-vien/lop');
    revalidatePath('/giao-vien/nhan-su');
    revalidatePath('/giao-vien/hoc-sinh');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã tạo lớp “${kq.ten}” (mã ${kq.ma}), do ${kq.giaoVien} phụ trách. ` +
        'Lớp này đã sẵn sàng để thêm học sinh và để phân công lại cho thầy cô khác.',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Class lifecycle — delete, archive, attach curriculum
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete a class. Admin-only, enforced in `xoaLopHoc`.
 *
 * Two-step by design. The first call comes back `can-xac-nhan` whenever the
 * class still holds active students, carrying the counts; the form re-submits
 * with `xacNhan` to go through. The counts are the whole point: `Enrollment`
 * cascades, so an admin clearing out a typo and an admin clearing out the class
 * thirty children are sitting in would otherwise issue the identical click.
 *
 * The success message says out loud that the student ACCOUNTS survive, because
 * "xoá lớp" reads like it might take the children with it, and an admin who
 * believes that will not use the feature at all.
 */
export async function xoaLop(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const classId = String(form.get('classId') ?? '');
    if (!classId) return { trangThai: 'loi', thongDiep: 'Thiếu lớp cần xoá.' };

    const kq = await xoaLopHoc(db, actor, classId, { xacNhan: form.get('xacNhan') === 'co' });

    if (kq.trangThai === 'can-xac-nhan') {
      const a = kq.anhHuong;
      return {
        trangThai: 'tu-choi',
        thongDiep:
          `Lớp “${a.ten}” đang có ${a.hocSinhDangHoc} học sinh theo học. ` +
          `Xoá lớp sẽ gỡ các em ra khỏi lớp và xoá ${a.khoaHoc} khoá học đã gắn, ` +
          `${a.canThiepBaiHoc} can thiệp bài học và ${a.thongBao} thông báo của lớp. ` +
          'Tài khoản và bài làm của từng em thì vẫn giữ nguyên. ' +
          'Nếu lớp chỉ vừa học xong, thầy cô nên “Lưu trữ” thay vì xoá. ' +
          'Muốn xoá thật thì tích vào ô xác nhận rồi bấm lại.',
      };
    }

    revalidatePath('/giao-vien/lop');
    revalidatePath('/giao-vien/nhan-su');
    revalidatePath('/giao-vien/hoc-sinh');
    revalidatePath('/giao-vien/thong-ke');
    revalidatePath('/giao-vien');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã xoá lớp “${kq.ten}” (mã ${kq.ma}).` +
        (kq.hocSinhGoRa > 0
          ? ` ${kq.hocSinhGoRa} em đã được gỡ khỏi lớp — tài khoản và toàn bộ bài làm của các em vẫn còn nguyên, chỉ cần xếp vào lớp khác.`
          : ' Lớp này chưa có học sinh nào.'),
    };
  });
}

/** Archive or un-archive a class. The reversible alternative to deleting one. */
export async function doiLuuTruLop(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const classId = String(form.get('classId') ?? '');
    if (!classId) return { trangThai: 'loi', thongDiep: 'Thiếu lớp cần xử lý.' };

    const kq = await luuTruLopHoc(db, actor, classId, form.get('luuTru') === 'co');

    revalidatePath('/giao-vien/lop');
    revalidatePath('/giao-vien/thong-ke');
    revalidatePath('/giao-vien');

    return {
      trangThai: 'thanh-cong',
      thongDiep: kq.daLuuTru
        ? `Đã lưu trữ lớp “${kq.ten}”. Danh sách, tiến độ và thông báo giữ nguyên; mở lại lúc nào cũng được.`
        : `Đã mở lại lớp “${kq.ten}”.`,
    };
  });
}

/**
 * Attach a course to a class — the "Gắn khoá học" button.
 *
 * Admin OR the class's own teacher. That is decided inside `ganKhoaHocVaoLop`
 * by `authorize({ resource: 'class', action: 'manage' })`, not here: choosing
 * what a class studies is ordinary teaching work, unlike creating or deleting
 * the class itself.
 */
export async function ganKhoaHoc(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const classId = String(form.get('classId') ?? '');
    const courseId = String(form.get('courseId') ?? '');
    if (!classId) return { trangThai: 'loi', thongDiep: 'Thiếu lớp.' };
    if (!courseId) {
      return { trangThai: 'loi', thongDiep: 'Thầy cô chọn giúp em một khoá học nhé.' };
    }

    const kq = await ganKhoaHocVaoLop(db, actor, classId, courseId);

    if (kq.trangThai === 'khong-thay-khoa') {
      return {
        trangThai: 'loi',
        thongDiep: 'Không tìm thấy khoá học này, hoặc khoá chưa được xuất bản.',
      };
    }

    revalidatePath(`/giao-vien/lop/${classId}`);
    revalidatePath('/giao-vien/lop');
    revalidatePath('/giao-vien/thong-ke');
    revalidatePath('/giao-vien');
    // Every student in the class now has a course map where they had none.
    revalidatePath('/bang-dieu-khien');

    if (kq.trangThai === 'da-co') {
      return {
        trangThai: 'thanh-cong',
        thongDiep: `Lớp này vốn đã học “${kq.tenKhoa}” rồi, nên không có gì thay đổi.`,
      };
    }

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã gắn khoá “${kq.tenKhoa}” (${kq.soBuoi} buổi) vào lớp. ` +
        'Từ bây giờ các em trong lớp mở trang chính là thấy bản đồ khoá học này, ' +
        'và buổi 1 đã mở sẵn.',
    };
  });
}

/** Detach a course from a class. Student work survives — it is keyed on lessons. */
export async function goKhoaHoc(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const classId = String(form.get('classId') ?? '');
    const courseId = String(form.get('courseId') ?? '');
    if (!classId || !courseId) return { trangThai: 'loi', thongDiep: 'Thiếu lớp hoặc khoá học.' };

    const kq = await goKhoaHocKhoiLop(db, actor, classId, courseId);
    if (!kq) return { trangThai: 'loi', thongDiep: 'Lớp này không có khoá học đó.' };

    revalidatePath(`/giao-vien/lop/${classId}`);
    revalidatePath('/giao-vien/lop');
    revalidatePath('/giao-vien/thong-ke');
    revalidatePath('/giao-vien');
    revalidatePath('/bang-dieu-khien');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã gỡ khoá “${kq.tenKhoa}” khỏi lớp. ` +
        'Bài làm, bản nháp và tiến độ của các em vẫn được giữ nguyên — gắn lại khoá này ' +
        'lúc nào thì các em thấy lại đúng chỗ đã dừng.',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Student accounts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete a student account. Admin-only, and two-step whenever they have work.
 *
 * Unlike a teacher, nothing about a student BLOCKS the delete: every row
 * pointing at them cascades. That is precisely why the confirmation exists —
 * the statement is quiet, and it destroys a term of a child's submissions,
 * drafts, snapshots, badges and progress in one go.
 */
export async function xoaHocSinh(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const studentId = String(form.get('studentId') ?? '');
    if (!studentId) return { trangThai: 'loi', thongDiep: 'Thiếu học sinh cần xoá.' };

    const kq = await xoaTaiKhoanHocSinh(db, actor, studentId, {
      xacNhan: form.get('xacNhan') === 'co',
    });

    if (kq.trangThai === 'can-xac-nhan') {
      const a = kq.anhHuong;
      const con = [
        a.baiNop > 0 ? `${a.baiNop} bài nộp` : '',
        a.tienDoBaiHoc > 0 ? `${a.tienDoBaiHoc} bản ghi tiến độ` : '',
        a.banNhapCode > 0 ? `${a.banNhapCode} bản nháp code` : '',
        a.lamTracNghiem > 0 ? `${a.lamTracNghiem} lượt làm trắc nghiệm` : '',
        a.duAn > 0 ? `${a.duAn} dự án` : '',
        a.huyHieu > 0 ? `${a.huyHieu} huy hiệu` : '',
      ]
        .filter(Boolean)
        .join(', ');

      return {
        trangThai: 'tu-choi',
        thongDiep:
          `Tài khoản “${a.displayName}” đang có ${con}. Xoá là mất hẳn, không khôi phục được. ` +
          (a.lop > 0 ? `Em này đang học ở: ${a.tenLop.join(', ')}. ` : '') +
          'Nếu chỉ cần chặn em đăng nhập, thầy cô dùng “Ngưng truy cập” — dữ liệu giữ nguyên và bật lại được. ' +
          'Muốn xoá thật thì tích vào ô xác nhận rồi bấm lại.',
      };
    }

    revalidatePath('/giao-vien/hoc-sinh');
    revalidatePath('/giao-vien/thong-ke');
    revalidatePath('/giao-vien');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã xoá tài khoản “${kq.displayName}” (${kq.username})` +
        (kq.daXoaBanGhi > 0 ? ` cùng ${kq.daXoaBanGhi} bản ghi liên quan` : '') +
        '. Nhật ký kiểm toán vẫn giữ lại việc này.',
    };
  });
}

/** Stop a student signing in, or let them back in. Nothing they made is touched. */
export async function doiTruyCapHocSinh(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const studentId = String(form.get('studentId') ?? '');
    if (!studentId) return { trangThai: 'loi', thongDiep: 'Thiếu học sinh cần xử lý.' };

    if (form.get('bat') === 'co') {
      const mo = await khoiPhucHocSinh(db, actor, studentId);
      revalidatePath('/giao-vien/hoc-sinh');
      return {
        trangThai: 'thanh-cong',
        thongDiep: `Đã mở lại truy cập cho ${mo.displayName}. Em đăng nhập được ngay.`,
      };
    }

    const kq = await voHieuHoaHocSinh(db, actor, studentId);
    revalidatePath('/giao-vien/hoc-sinh');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        `Đã ngưng truy cập của ${kq.displayName}. Toàn bộ bài làm giữ nguyên và bật lại được bất cứ lúc nào.` +
        (kq.sessionsRevoked > 0 ? ` Đã đăng xuất ${kq.sessionsRevoked} phiên đang mở.` : ''),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Focus alerts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mark a focus alert dealt with.
 *
 * "Đã hỏi thăm" (acknowledged) and "Bỏ qua" (dismissed) are both recorded with
 * a name and a time. An alert about a child that was silently cleared is worse
 * than one nobody looked at, so there is no path here that removes a row.
 *
 * The visibility check lives in `xuLyCanhBao`, which re-reads the alert through
 * the same relational scope the feed is built from — a teacher cannot clear an
 * alert about a class they do not run by guessing its id.
 */
export async function xuLyCanhBaoTapTrung(
  _truoc: KetQuaHanhDong,
  form: FormData,
): Promise<KetQuaHanhDong> {
  return chay(async () => {
    const actor = await currentActor();
    if (!actor) return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn.' };

    const alertId = String(form.get('alertId') ?? '');
    const hanhDong = String(form.get('hanhDong') ?? '');
    if (!alertId) return { trangThai: 'loi', thongDiep: 'Thiếu cảnh báo cần xử lý.' };
    if (hanhDong !== 'da-hoi-tham' && hanhDong !== 'bo-qua') {
      return { trangThai: 'loi', thongDiep: 'Hành động không hợp lệ.' };
    }

    const kq = await xuLyCanhBao(
      db,
      actor,
      alertId,
      hanhDong === 'da-hoi-tham' ? 'ACKNOWLEDGED' : 'DISMISSED',
    );

    revalidatePath('/giao-vien/canh-bao');
    revalidatePath('/giao-vien');

    return {
      trangThai: 'thanh-cong',
      thongDiep:
        hanhDong === 'da-hoi-tham'
          ? `Đã ghi nhận thầy cô đã hỏi thăm ${kq.tenHocSinh}.`
          : `Đã bỏ qua cảnh báo về ${kq.tenHocSinh}.`,
    };
  });
}
