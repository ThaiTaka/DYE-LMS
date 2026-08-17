import Link from 'next/link';

export default function KhongCoQuyen() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="rounded-the border border-vien bg-the p-6 sm:p-8">
        <h1 className="mt-0 mb-2 text-2xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-0 mb-5 text-chu-phu">
          Trang này không dành cho tài khoản của bạn. Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ thầy
          cô phụ trách lớp.
        </p>
        <Link
          href="/bang-dieu-khien"
          className="inline-flex min-h-cham items-center rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
        >
          Quay lại trang chính
        </Link>
      </div>
    </main>
  );
}
