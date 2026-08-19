/**
 * @dye/core — domain logic shared by the web app and the judge worker.
 *
 * Phase 3 ships the auth and authorization layer. Phase 4 adds the curriculum
 * engine (gating, tier routing, progress) to the same package.
 *
 * Nothing here imports Next.js. Everything takes a `PrismaClient` as an
 * argument, which is what makes it testable against a real database without a
 * web server in the loop.
 */

export {
  AccountDisabledError,
  ForbiddenError,
  RateLimitedError,
  UnauthorizedError,
} from './errors';

export {
  burnVerificationTime,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  PASSWORD_PARAMS,
  verifyPassword,
} from './password';

export {
  createSession,
  deactivateUser,
  generateSessionToken,
  purgeExpiredSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  safeDigestEqual,
  SESSION_TTL_DAYS,
  validateSession,
  type Actor,
  type IssuedSession,
  type SessionContext,
} from './session';

export {
  AUDIT,
  changePassword,
  DEFAULT_LOGIN_RATE_LIMIT,
  login,
  logout,
  resetPasswordByStaff,
  revokeAllForUser,
  type LoginResult,
  type RateLimitPolicy,
} from './authenticate';

export {
  authorize,
  can,
  isEnrolledIn,
  ownsClass,
  requireActor,
  teachesStudent,
  visibleStudentIds,
  type AuthzRequest,
} from './authz';

export {
  ACCOUNT_AUDIT,
  anhHuongXoaTaiKhoan,
  chuyenGiaoHoSoGiangDay,
  khoiPhucNhanVien,
  laVaiTroTaoDuoc,
  maTuTenLop,
  nguoiCoTheNhanBanGiao,
  phanCongLopHoc,
  taoLopHoc,
  taoTaiKhoan,
  voHieuHoaNhanVien,
  xoaTaiKhoanNhanVien,
  type AnhHuongXoaTaiKhoan,
  type KetQuaChuyenGiao,
  type KetQuaPhanCongLop,
  type KetQuaTaoLop,
  type KetQuaTaoTaiKhoan,
  type KetQuaXoaTaiKhoan,
  type RangBuocXoa,
  type TaoLopInput,
  type TaoTaiKhoanInput,
  type VaiTroTaoDuoc,
} from './accounts';

export { bocMarkdown, rutGon, tenBuoi } from './text';

export {
  chamTay,
  ghiNhanDatBai,
  KET_LUAN_CHAM_TAY,
  type KetQuaChamTay,
} from './grading';

// ── Phase 9: Pygame project workspace ────────────────────────────────────────
export {
  bamNoiDung,
  banLamViec,
  danhSachTep,
  doiTenTep,
  ghiNhanXet,
  ghiTep,
  khoaLuuTru,
  MAU_DU_AN,
  moDuAn,
  moDuAnDeSua,
  nopMoc,
  taoDuAn,
  xoaTep,
  type BanLamViec,
  type KetQuaGhiTep,
  type KetQuaNopMoc,
  type KhoLuuTru,
  type TepDuAn,
} from './projects';

export {
  coShebang,
  conDuDungLuong,
  DINH_DANG_CHO_PHEP,
  DAI_DUONG_DAN_TOI_DA,
  GIOI_HAN_DU_AN_BYTE,
  GIOI_HAN_TEP_BYTE,
  kiemTraDuongDan,
  kiemTraTepTai,
  laVanBanUtf8,
  layDuoi,
  nguiMime,
  nhanDangThucThi,
  SO_TEP_TOI_DA,
  timDinhDang,
  type DinhDang,
  type KetQuaKiemTra,
  type LoaiTep,
} from './upload-guard';

// ── Phase 8: judge queue contract (no queue library — see the module) ────────
export {
  CHINH_SACH_THU_LAI,
  HANG_CHAM_BAI,
  VIEC_CHAM_BAI,
  type ViecChamBai,
} from './judge-queue';

// ── Phase 7: code drafts, history, submission ────────────────────────────────
export {
  bamMa,
  docNhap,
  GIOI_HAN_KY_TU,
  KHOANG_CACH_BAN_LUU_MS,
  khoiPhucBanLuu,
  lichSuMa,
  lichSuNopBai,
  luuNhap,
  moKhoiCode,
  nopBai,
  nopBaiMicrobit,
  SO_BAN_LUU_TOI_DA,
  xemBanLuu,
  type BaiDaNop,
  type BanLuu,
  type KetQuaLuuNhap,
  type KetQuaNopBai,
  type KhoiCode,
} from './code';

// ── Phase 4: curriculum engine ───────────────────────────────────────────────
export * from './curriculum/index';
