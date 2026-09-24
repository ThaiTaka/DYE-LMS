/**
 * Teacher-set homework: who can set it, who sees it, the hand-in lifecycle,
 * and the grade that freezes it.
 *
 * The fixture's two teacher→student setups are disjoint, which is what gives
 * every "cannot reach" assertion here a true negative: teacher B's class and
 * student B1 have no path to anything teacher A sets.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { anhHuongXoaTaiKhoan } from './accounts';
import {
  BAI_TAP_AUDIT,
  baiTapChoGiaoVien,
  baiTapCuaGiaoVien,
  baiTapCuaHocSinh,
  chamBaiTapVeNha,
  moBaiTapChoHocSinh,
  nopBaiTapVeNha,
  soBaiTapChoCham,
  taoBaiTapVeNha,
  type TaoBaiTapInput,
} from './bai-tap-ve-nha';
import { ForbiddenError } from './errors';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let hsA1: Actor;
let hsA2: Actor;
let hsB1: Actor;
let hsRoiLop: Actor;

const NGAY_MS = 24 * 60 * 60 * 1000;

function deBai(over: Partial<TaoBaiTapInput> = {}): TaoBaiTapInput {
  return {
    classId: fx.classA,
    lessonId: fx.lessonId,
    tieuDe: 'Vẽ tam giác bằng dấu sao',
    moTa: 'Dùng vòng lặp `for` in ra tam giác 5 dòng.',
    maMau: 'n = 5\n# Viết tiếp ở đây\n',
    hanNop: new Date(Date.now() + 3 * NGAY_MS),
    ...over,
  };
}

/** Set a homework in class A as teacher A and return its id. */
async function giaoBai(over: Partial<TaoBaiTapInput> = {}): Promise<string> {
  const kq = await taoBaiTapVeNha(fx.db, teacherA, deBai(over));
  if (kq.trangThai !== 'da-tao') throw new Error(`khong tao duoc: ${kq.lyDo}`);
  return kq.homeworkId;
}

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  hsA1 = await actorFor(fx.db, fx.studentA1);
  hsA2 = await actorFor(fx.db, fx.studentA2);
  hsB1 = await actorFor(fx.db, fx.studentB1);
  hsRoiLop = await actorFor(fx.db, fx.studentWithdrawn);
});

afterEach(async () => {
  // Class ownership is moved in one test; put it back whatever happened there.
  await fx.db.class.update({ where: { id: fx.classA }, data: { teacherId: fx.teacherA } });
  await fx.db.homework.deleteMany({ where: { classId: { in: [fx.classA, fx.classB] } } });
});

afterAll(async () => {
  await fx.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Giao bài tập về nhà', () => {
  it('giáo viên giao cho lớp mình, kèm buổi học thuộc khoá của lớp', async () => {
    const kq = await taoBaiTapVeNha(fx.db, teacherA, deBai());

    expect(kq.trangThai).toBe('da-tao');
    if (kq.trangThai !== 'da-tao') return;
    // A1 and A2 are active; the withdrawn student is not a recipient.
    expect(kq.soHocSinh).toBe(2);

    const hw = await fx.db.homework.findUniqueOrThrow({ where: { id: kq.homeworkId } });
    expect(hw).toMatchObject({
      teacherId: fx.teacherA,
      classId: fx.classA,
      lessonId: fx.lessonId,
      templateCode: 'n = 5\n# Viết tiếp ở đây\n',
    });
  });

  it('ghi nhật ký kiểm toán khi giao bài', async () => {
    const id = await giaoBai();
    const log = await fx.db.auditLog.findFirst({
      where: { action: BAI_TAP_AUDIT.CREATED, entityId: id },
      select: { actorId: true },
    });
    expect(log?.actorId).toBe(fx.teacherA);
  });

  it('giáo viên không giao được cho lớp của người khác', async () => {
    await expect(
      taoBaiTapVeNha(fx.db, teacherA, deBai({ classId: fx.classB, lessonId: null })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('học sinh không giao được bài', async () => {
    await expect(taoBaiTapVeNha(fx.db, hsA1, deBai())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('hạn nộp đã qua là lỗi biểu mẫu, không phải lỗi quyền', async () => {
    const kq = await taoBaiTapVeNha(
      fx.db,
      teacherA,
      deBai({ hanNop: new Date(Date.now() - 60_000) }),
    );
    expect(kq.trangThai).toBe('khong-hop-le');
  });

  it('tên hoặc đề bài trống thì bị từ chối', async () => {
    expect((await taoBaiTapVeNha(fx.db, teacherA, deBai({ tieuDe: '   ' }))).trangThai).toBe(
      'khong-hop-le',
    );
    expect((await taoBaiTapVeNha(fx.db, teacherA, deBai({ moTa: '' }))).trangThai).toBe(
      'khong-hop-le',
    );
  });

  it('buổi học thuộc khoá mà lớp không học thì bị từ chối', async () => {
    const baiKhac = await fx.db.lesson.findFirstOrThrow({
      where: { course: { classCourses: { none: { classId: fx.classA } } } },
      select: { id: true },
    });
    const kq = await taoBaiTapVeNha(fx.db, teacherA, deBai({ lessonId: baiKhac.id }));
    expect(kq.trangThai).toBe('khong-hop-le');
  });

  it('không gắn buổi học cũng được', async () => {
    const kq = await taoBaiTapVeNha(fx.db, teacherA, deBai({ lessonId: null }));
    expect(kq.trangThai).toBe('da-tao');
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Học sinh thấy và nộp bài', () => {
  it('chỉ học sinh đang học trong lớp mới thấy bài', async () => {
    const id = await giaoBai();

    expect((await baiTapCuaHocSinh(fx.db, fx.studentA1)).map((b) => b.id)).toContain(id);
    expect((await baiTapCuaHocSinh(fx.db, fx.studentB1)).map((b) => b.id)).not.toContain(id);
    // Left the class: the relationship is over, so the homework is too.
    expect((await baiTapCuaHocSinh(fx.db, fx.studentWithdrawn)).map((b) => b.id)).not.toContain(id);
  });

  it('học sinh ngoài lớp mở bài hoặc nộp bài đều bị từ chối', async () => {
    const id = await giaoBai();

    await expect(moBaiTapChoHocSinh(fx.db, hsB1, id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(nopBaiTapVeNha(fx.db, hsB1, id, 'print(1)')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(nopBaiTapVeNha(fx.db, hsRoiLop, id, 'print(1)')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('mở bài lần đầu thấy mã mẫu của giáo viên và trạng thái chưa nộp', async () => {
    const id = await giaoBai();
    const bai = await moBaiTapChoHocSinh(fx.db, hsA1, id);

    expect(bai.maMau).toBe('n = 5\n# Viết tiếp ở đây\n');
    expect(bai.trangThai).toBe('chua-nop');
    expect(bai.baiNop).toBeNull();
  });

  it('nộp rồi nộp lại thì ghi đè, vẫn chỉ một dòng', async () => {
    const id = await giaoBai();

    const lan1 = await nopBaiTapVeNha(fx.db, hsA1, id, 'print("lần 1")');
    const lan2 = await nopBaiTapVeNha(fx.db, hsA1, id, 'print("lần 2")');
    expect(lan1).toMatchObject({ trangThai: 'da-nop', lanDau: true, nopMuon: false });
    expect(lan2).toMatchObject({ trangThai: 'da-nop', lanDau: false });

    const rows = await fx.db.homeworkSubmission.findMany({ where: { homeworkId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.submittedCode).toBe('print("lần 2")');

    const bai = await moBaiTapChoHocSinh(fx.db, hsA1, id);
    expect(bai.trangThai).toBe('da-nop');
  });

  it('bài trống thì không nhận', async () => {
    const id = await giaoBai();
    expect(await nopBaiTapVeNha(fx.db, hsA1, id, '  \n\t ')).toEqual({ trangThai: 'rong' });
  });

  it('nộp sau hạn vẫn được nhận và được đánh dấu nộp muộn', async () => {
    const id = await giaoBai();
    const sauHan = new Date(Date.now() + 5 * NGAY_MS);

    expect((await baiTapCuaHocSinh(fx.db, fx.studentA1, sauHan))[0]?.trangThai).toBe('qua-han');

    const kq = await nopBaiTapVeNha(fx.db, hsA1, id, 'print(1)', sauHan);
    expect(kq).toMatchObject({ trangThai: 'da-nop', nopMuon: true });
  });

  it('giáo viên không nộp bài thay học sinh được', async () => {
    const id = await giaoBai();
    await expect(nopBaiTapVeNha(fx.db, teacherA, id, 'print(1)')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('danh sách xếp việc cần làm lên trước, bài đã chấm xuống cuối', async () => {
    const xa = await giaoBai({ tieuDe: 'Hạn xa', hanNop: new Date(Date.now() + 9 * NGAY_MS) });
    const gan = await giaoBai({ tieuDe: 'Hạn gần', hanNop: new Date(Date.now() + 1 * NGAY_MS) });
    const daNop = await giaoBai({ tieuDe: 'Đã nộp', hanNop: new Date(Date.now() + 2 * NGAY_MS) });
    await nopBaiTapVeNha(fx.db, hsA1, daNop, 'print(1)');

    const ds = (await baiTapCuaHocSinh(fx.db, fx.studentA1)).map((b) => b.id);
    expect(ds).toEqual([gan, xa, daNop]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Giáo viên chấm bài', () => {
  async function nopVaLay(id: string): Promise<{ subId: string; nopLuc: Date }> {
    await nopBaiTapVeNha(fx.db, hsA1, id, 'for i in range(5):\n    print("*" * (i + 1))\n');
    const s = await fx.db.homeworkSubmission.findUniqueOrThrow({
      where: { homeworkId_studentId: { homeworkId: id, studentId: fx.studentA1 } },
      select: { id: true, submittedAt: true },
    });
    return { subId: s.id, nopLuc: s.submittedAt };
  }

  it('bảng của giáo viên có cả em chưa nộp, bài chờ chấm lên đầu', async () => {
    const id = await giaoBai();
    await nopVaLay(id);

    const bai = await baiTapChoGiaoVien(fx.db, teacherA, id);
    expect(bai.hocSinh.map((h) => h.studentId)).toEqual([fx.studentA1, fx.studentA2]);
    expect(bai.hocSinh[1]?.baiNop).toBeNull();

    const ds = await baiTapCuaGiaoVien(fx.db, teacherA);
    expect(ds.find((b) => b.id === id)).toMatchObject({ soHocSinh: 2, soDaNop: 1, soChoCham: 1 });
    expect(await soBaiTapChoCham(fx.db, teacherA)).toBeGreaterThanOrEqual(1);
  });

  it('chấm xong: học sinh thấy nhận xét, và không nộp lại được nữa', async () => {
    const id = await giaoBai();
    const { subId, nopLuc } = await nopVaLay(id);

    const kq = await chamBaiTapVeNha(fx.db, teacherA, subId, 'Em làm đúng rồi, gọn lắm!', nopLuc);
    expect(kq).toMatchObject({ trangThai: 'da-cham', capNhat: false });

    const bai = await moBaiTapChoHocSinh(fx.db, hsA1, id);
    expect(bai.trangThai).toBe('da-cham');
    expect(bai.baiNop?.nhanXet).toBe('Em làm đúng rồi, gọn lắm!');

    expect(await nopBaiTapVeNha(fx.db, hsA1, id, 'print("sửa sau khi chấm")')).toEqual({
      trangThai: 'da-cham-roi',
    });
    const s = await fx.db.homeworkSubmission.findUniqueOrThrow({ where: { id: subId } });
    expect(s.submittedCode).not.toContain('sửa sau khi chấm');

    const log = await fx.db.auditLog.findFirst({
      where: { action: BAI_TAP_AUDIT.GRADED, entityId: subId },
      select: { actorId: true },
    });
    expect(log?.actorId).toBe(fx.teacherA);
  });

  it('em nộp lại trong lúc giáo viên đang đọc thì không chấm nhầm bản cũ', async () => {
    const id = await giaoBai();
    const { subId, nopLuc } = await nopVaLay(id);

    // The student hands in a newer version after the teacher opened the page.
    await nopBaiTapVeNha(fx.db, hsA1, id, 'print("bản mới")', new Date(nopLuc.getTime() + 60_000));

    const kq = await chamBaiTapVeNha(fx.db, teacherA, subId, 'Nhận xét về bản cũ', nopLuc);
    expect(kq.trangThai).toBe('da-doi');
    expect(
      (await fx.db.homeworkSubmission.findUniqueOrThrow({ where: { id: subId } })).isGraded,
    ).toBe(false);
  });

  it('nhận xét trống thì không chấm', async () => {
    const id = await giaoBai();
    const { subId, nopLuc } = await nopVaLay(id);
    expect((await chamBaiTapVeNha(fx.db, teacherA, subId, '   ', nopLuc)).trangThai).toBe(
      'khong-hop-le',
    );
  });

  it('giáo viên lớp khác không xem và không chấm được', async () => {
    const id = await giaoBai();
    const { subId, nopLuc } = await nopVaLay(id);

    await expect(baiTapChoGiaoVien(fx.db, teacherB, id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      chamBaiTapVeNha(fx.db, teacherB, subId, 'Không phải lớp tôi', nopLuc),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await baiTapCuaGiaoVien(fx.db, teacherB)).map((b) => b.id)).not.toContain(id);
  });

  it('học sinh không tự chấm bài mình được', async () => {
    const id = await giaoBai();
    const { subId, nopLuc } = await nopVaLay(id);
    await expect(chamBaiTapVeNha(fx.db, hsA1, subId, 'Tự khen', nopLuc)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(chamBaiTapVeNha(fx.db, hsA2, subId, 'Chấm hộ', nopLuc)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('quyền đi theo LỚP, không theo người giao bài', async () => {
    const id = await giaoBai();

    // Class A is reassigned to teacher B. The author loses the homework with
    // the students; the new teacher gains it. `afterEach` puts the class back.
    await fx.db.class.update({ where: { id: fx.classA }, data: { teacherId: fx.teacherB } });

    await expect(baiTapChoGiaoVien(fx.db, teacherA, id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(baiTapChoGiaoVien(fx.db, teacherB, id)).resolves.toMatchObject({ id });
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Vòng đời tài khoản giáo viên', () => {
  it('bài tập đã giao được tính là ràng buộc khi xoá tài khoản', async () => {
    await giaoBai();
    const anhHuong = await anhHuongXoaTaiKhoan(fx.db, fx.teacherA);

    expect(anhHuong.rangBuoc.baiTapVeNha).toBeGreaterThanOrEqual(1);
    expect(anhHuong.xoaTrucTiepDuoc).toBe(false);
  });
});
