#!/usr/bin/env bash
#
# Cài hai dịch vụ systemd (dye-web, dye-judge) để DYE LMS chạy nền vĩnh viễn:
# tự bật lại khi lỗi, tự khởi động cùng máy, không chết khi thoát SSH.
#
#   sudo bash trien-khai/cai-dat-systemd.sh
#
# Chạy lại được nhiều lần (idempotent): mỗi lần chỉ ghi đè hai tệp .service rồi
# nạp lại, không đụng gì khác.
#
# ── Vì sao là script chứ không phải chép tay hai tệp trong HUONG_DAN_DEPLOY_VPS.md
# Ba giá trị trong tệp .service phụ thuộc vào từng máy, và đoán sai giá trị nào
# cũng làm dịch vụ chết ngay lúc khởi động, với thông báo chẳng liên quan gì:
#
#   ExecStart   /usr/bin/npm chỉ đúng khi Node cài bằng apt/NodeSource. Cài bằng
#               nvm thì npm nằm trong ~/.nvm/versions/node/*/bin và systemd báo
#               203/EXEC.
#   User        phải là chủ thư mục kho VÀ phải ở trong nhóm docker, nếu không
#               bộ chấm bài không tạo nổi container.
#   PATH        systemd không nạp hồ sơ đăng nhập, nên PATH mặc định thiếu cả
#               thư mục bin của Node lẫn (đôi khi) docker.
#
# Script dò cả ba từ chính máy đang chạy thay vì bắt người cài nhớ.
set -euo pipefail

CO_MAU=$([ -t 1 ] && echo 1 || echo 0)
do_()   { [ "$CO_MAU" = 1 ] && printf '\033[31m%s\033[0m\n' "$*" || printf '%s\n' "$*"; }
xanh_() { [ "$CO_MAU" = 1 ] && printf '\033[32m%s\033[0m\n' "$*" || printf '%s\n' "$*"; }
vang_() { [ "$CO_MAU" = 1 ] && printf '\033[33m%s\033[0m\n' "$*" || printf '%s\n' "$*"; }

loi() { do_ "✗ $*" >&2; exit 1; }

THU_MUC_SCRIPT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
THU_MUC_GOC=$(cd -- "$THU_MUC_SCRIPT/.." && pwd)

CONG=3000
NGUOI_DUNG=""
CHI_IN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --nguoi-dung) NGUOI_DUNG="${2:-}"; shift 2 ;;
    --cong)       CONG="${2:-}";       shift 2 ;;
    --chi-in)     CHI_IN=1;            shift ;;   # in tệp ra màn hình, không cài
    -h|--help)
      sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) loi "Tham số lạ: $1 (xem --help)" ;;
  esac
done

# ── 1. Điều kiện cần ────────────────────────────────────────────────────────
# --chi-in chỉ dựng tệp ra màn hình, nên không đòi systemd lẫn root. Nhờ vậy
# xem trước được ngay từ máy dev, trước khi đụng vào máy chủ thật.
if [ "$CHI_IN" != 1 ]; then
  command -v systemctl >/dev/null 2>&1 || loi "Máy này không có systemd. Script chỉ chạy trên VPS Linux (Ubuntu/Debian)."
  [ "$(id -u)" = 0 ] || loi "Cần quyền root. Chạy: sudo $0"
fi

[ -f "$THU_MUC_GOC/package.json" ] && grep -q '"name": "dye-lms"' "$THU_MUC_GOC/package.json" \
  || loi "Không thấy kho DYE LMS ở $THU_MUC_GOC"

# ── 2. Tài khoản chạy dịch vụ ───────────────────────────────────────────────
# Ưu tiên: cờ --nguoi-dung → người gọi sudo → chủ sở hữu thư mục kho.
if [ -z "$NGUOI_DUNG" ]; then
  NGUOI_DUNG="${SUDO_USER:-}"
fi
if [ -z "$NGUOI_DUNG" ]; then
  NGUOI_DUNG=$(stat -c '%U' "$THU_MUC_GOC")
fi
id "$NGUOI_DUNG" >/dev/null 2>&1 || loi "Không có tài khoản '$NGUOI_DUNG' trên máy này."

# ── 3. Đường dẫn npm — chỗ hay sai nhất ─────────────────────────────────────
# Hỏi bằng shell ĐĂNG NHẬP của chính tài khoản đó, để bắt được cả nvm.
NPM=$(su - "$NGUOI_DUNG" -c 'command -v npm' 2>/dev/null || true)
[ -n "$NPM" ] || NPM=$(command -v npm 2>/dev/null || true)
[ -n "$NPM" ] || loi "Không tìm thấy npm cho tài khoản '$NGUOI_DUNG'. Cài Node.js trước (mục 4 của HUONG_DAN_DEPLOY_VPS.md)."
[ -x "$NPM" ] || loi "npm tìm được nhưng không chạy được: $NPM"

BIN_NODE=$(dirname "$NPM")
DUONG_DAN="$BIN_NODE:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# systemd tách ExecStart/WorkingDirectory theo dấu cách, nên đường dẫn có dấu
# cách hỏng theo kiểu rất khó đoán. Chặn ngay còn hơn để dịch vụ chết sau.
case "$THU_MUC_GOC$NPM" in
  *" "*) loi "Đường dẫn có dấu cách — systemd không nhận. Đặt kho ở đường dẫn không dấu cách (ví dụ /opt/dye-lms).";;
esac

echo
echo "  thư mục kho : $THU_MUC_GOC"
echo "  tài khoản   : $NGUOI_DUNG"
echo "  npm         : $NPM"
echo "  cổng web    : $CONG"
echo

# ── 4. Cảnh báo những thứ làm dịch vụ chạy nhưng vô dụng ────────────────────
CANH_BAO=0
# root vào được /var/run/docker.sock nhờ LÀ root, không nhờ nhóm docker. Kiểm
# tra nhóm mà không trừ root ra sẽ báo động giả đúng vào cấu hình VPS phổ biến
# nhất (chạy dịch vụ dưới root), khiến người cài đi sửa một thứ không hỏng.
if [ "$(id -u "$NGUOI_DUNG")" != 0 ] && ! id -nG "$NGUOI_DUNG" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
  vang_ "⚠ '$NGUOI_DUNG' chưa ở trong nhóm docker → bộ chấm bài sẽ không tạo được container."
  vang_ "  Sửa:  sudo usermod -aG docker $NGUOI_DUNG   (rồi chạy lại script này)"
  CANH_BAO=1
fi
if [ ! -d "$THU_MUC_GOC/apps/web/.next" ]; then
  vang_ "⚠ Chưa có bản build production (apps/web/.next). Chạy 'npm run build' trước."
  CANH_BAO=1
fi
if ! docker image inspect dye-judge-pytest:3.12 >/dev/null 2>&1; then
  vang_ "⚠ Thiếu ảnh dye-judge-pytest:3.12 → bài nộp sẽ báo lỗi nội bộ chứ không được chấm."
  vang_ "  Sửa:  npm run judge:images"
  CANH_BAO=1
fi
if [ ! -f "$THU_MUC_GOC/.env" ] && [ ! -f "$THU_MUC_GOC/.env.production" ]; then
  vang_ "⚠ Không thấy .env hay .env.production ở $THU_MUC_GOC → cả hai dịch vụ sẽ chết vì thiếu DATABASE_URL."
  CANH_BAO=1
fi

# ── 5. Sinh tệp .service từ bản mẫu ─────────────────────────────────────────
sinh() {
  sed -e "s|__THU_MUC_GOC__|$THU_MUC_GOC|g" \
      -e "s|__NGUOI_DUNG__|$NGUOI_DUNG|g" \
      -e "s|__NPM__|$NPM|g" \
      -e "s|__DUONG_DAN__|$DUONG_DAN|g" \
      -e "s|PORT=3000|PORT=$CONG|g" \
      "$THU_MUC_SCRIPT/systemd/$1"
}
if [ "$CHI_IN" = 1 ]; then
  for t in dye-web.service dye-judge.service; do
    echo "───── /etc/systemd/system/$t ─────"; sinh "$t"; echo
  done
  exit 0
fi

for t in dye-web.service dye-judge.service; do
  sinh "$t" > "/etc/systemd/system/$t"
  chmod 0644 "/etc/systemd/system/$t"
  xanh_ "✓ đã ghi /etc/systemd/system/$t"
done

# ── 6. Nạp và bật ───────────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable --now dye-web dye-judge

echo
sleep 3
systemctl --no-pager --lines=0 status dye-web dye-judge || true

echo
xanh_ "✓ Xong. Xem nhật ký thời gian thực:"
echo "    sudo journalctl -u dye-web   -f"
echo "    sudo journalctl -u dye-judge -f"
# Không viết dạng `[ … ] && vang_ …`: dưới `set -e`, danh sách && đứng cuối mà
# trả về khác 0 sẽ làm script thoát với mã 1 đúng vào lúc MỌI THỨ ĐỀU ỔN.
if [ "$CANH_BAO" = 1 ]; then
  vang_ "⚠ Có cảnh báo ở trên — đọc lại trước khi coi là chạy được."
fi
exit 0
