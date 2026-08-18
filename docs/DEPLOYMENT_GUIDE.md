# Hướng dẫn triển khai DYE LMS lên máy chủ thật

Tài liệu này hướng dẫn đưa DYE LMS từ máy tính cá nhân lên một VPS chạy thật cho
học sinh dùng. Viết cho người đã dùng được dòng lệnh Linux cơ bản, nhưng chưa
từng triển khai một ứng dụng Node.js nào.

Đọc kèm:

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — chạy trên máy cá nhân để phát triển
- [01-ARCHITECTURE.md](01-ARCHITECTURE.md) — kiến trúc tổng thể
- [DATABASE_GUIDE.md](DATABASE_GUIDE.md) — cấu trúc cơ sở dữ liệu

---

## Mục lục

1. [Chuẩn bị VPS](#1-chuẩn-bị-vps)
2. [Cài Docker](#2-cài-docker)
3. [Khoá tường lửa](#3-khoá-tường-lửa)
4. [Lấy mã nguồn](#4-lấy-mã-nguồn)
5. [Tệp .env.production](#5-tệp-envproduction)
6. [Khởi chạy hệ thống](#6-khởi-chạy-hệ-thống)
7. [Tạo tài khoản quản trị đầu tiên](#7-tạo-tài-khoản-quản-trị-đầu-tiên)
8. [Nginx reverse proxy](#8-nginx-reverse-proxy)
9. [Chứng chỉ SSL (HTTPS)](#9-chứng-chỉ-ssl-https)
10. [Bộ chấm bài và hộp cát Docker](#10-bộ-chấm-bài-và-hộp-cát-docker)
11. [Sao lưu và phục hồi](#11-sao-lưu-và-phục-hồi)
12. [Cập nhật phiên bản mới](#12-cập-nhật-phiên-bản-mới)
13. [Khắc phục sự cố](#13-khắc-phục-sự-cố)
14. [Danh sách kiểm tra trước khi mở cho học sinh](#14-danh-sách-kiểm-tra-trước-khi-mở-cho-học-sinh)

---

## 1. Chuẩn bị VPS

### Cấu hình tối thiểu

| Thành phần | Tối thiểu | Khuyến nghị | Vì sao |
| --- | --- | --- | --- |
| CPU | 2 nhân | 4 nhân | Mỗi bài nộp chạy trong một container riêng, chiếm 0.5 nhân |
| RAM | 4 GB | 8 GB | PostgreSQL 2 GB + web 1 GB + worker 1 GB + các hộp cát |
| Ổ cứng | 40 GB SSD | 80 GB SSD | Ảnh Docker ~3 GB, cơ sở dữ liệu tăng dần, bài nộp của học sinh |
| Hệ điều hành | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS | Hướng dẫn này viết theo Ubuntu |

> **Lưu ý về số lượng học sinh.** Cấu hình khuyến nghị phục vụ tốt khoảng 30–50
> em dùng cùng lúc. Nút thắt gần như luôn là bộ chấm bài chứ không phải web:
> nếu cả lớp bấm "Nộp bài" trong cùng một phút, hàng đợi sẽ dài ra chứ trang web
> không chậm đi. Muốn chấm nhanh hơn thì tăng CPU rồi tăng `JUDGE_CONCURRENCY`.

### Tên miền

Trỏ một bản ghi `A` về địa chỉ IP của VPS **trước khi** làm bước SSL, vì
Let's Encrypt cần phân giải được tên miền mới cấp chứng chỉ.

```
lms.truonghoccuaban.edu.vn.   A   203.0.113.45
```

Kiểm tra đã trỏ đúng chưa:

```bash
dig +short lms.truonghoccuaban.edu.vn
```

### Tạo người dùng riêng (không dùng root)

```bash
adduser dye
usermod -aG sudo dye
rsync --archive --chown=dye:dye ~/.ssh /home/dye/
```

Từ đây trở đi đăng nhập bằng `dye`, không dùng `root`.

---

## 2. Cài Docker

```bash
# Gỡ các bản cũ nếu có
sudo apt-get remove -y docker docker-engine docker.io containerd runc

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Cho người dùng `dye` chạy được Docker:

```bash
sudo usermod -aG docker dye
newgrp docker   # hoặc đăng xuất rồi đăng nhập lại
docker run --rm hello-world
```

> **Cảnh báo bảo mật.** Thêm một tài khoản vào nhóm `docker` tương đương cấp
> quyền `root` cho tài khoản đó, vì ai điều khiển được Docker daemon thì gắn
> được thư mục gốc của máy vào một container. Chỉ thêm những tài khoản mà bạn
> vốn đã tin tưởng ở mức quản trị máy chủ.

---

## 3. Khoá tường lửa

Chỉ mở đúng ba cổng. PostgreSQL và Redis **không** được mở ra Internet — trong
`docker-compose.prod.yml` chúng cố tình không có mục `ports:` nào.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Kiểm tra lại từ **máy khác** rằng cơ sở dữ liệu không lộ ra ngoài:

```bash
nc -zv <IP-VPS> 5432   # phải báo timeout hoặc refused
```

---

## 4. Lấy mã nguồn

```bash
sudo mkdir -p /opt/dye-lms
sudo chown dye:dye /opt/dye-lms
git clone https://github.com/ThaiTaka/DYE-LMS.git /opt/dye-lms
cd /opt/dye-lms
```

---

## 5. Tệp .env.production

Đây là bước dễ sai nhất. Làm chậm và kiểm tra kỹ.

```bash
cp .env.production.example .env.production
chmod 600 .env.production      # chỉ chủ sở hữu đọc được
```

Sinh ba giá trị bí mật, **mỗi giá trị một lần chạy riêng**:

```bash
openssl rand -hex 24       # -> POSTGRES_PASSWORD
openssl rand -hex 24       # -> REDIS_PASSWORD
openssl rand -base64 32    # -> AUTH_SECRET
```

Mở `.env.production` và điền. Các biến **bắt buộc** phải đổi:

| Biến | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `NODE_ENV` | ✔ | Để nguyên `production` |
| `POSTGRES_PASSWORD` | ✔ | Chuỗi ngẫu nhiên vừa sinh |
| `DATABASE_URL` | ✔ | Mật khẩu bên trong **phải trùng** `POSTGRES_PASSWORD` |
| `REDIS_PASSWORD` | ✔ | Chuỗi ngẫu nhiên khác |
| `REDIS_URL` | ✔ | Mật khẩu bên trong **phải trùng** `REDIS_PASSWORD` |
| `AUTH_SECRET` | ✔ | 32 byte base64 |
| `AUTH_URL` | ✔ | `https://` + tên miền thật |
| `AUTH_TRUST_HOST` | ✔ | `true`, vì có Nginx đứng trước |
| `SEED_ALLOW_PRODUCTION` | | Để `no` trên máy chủ thật |
| `WEB_PORT` | | Mặc định `3000`, chỉ nghe trên `127.0.0.1` |

### Ba lỗi thường gặp

**1. Mật khẩu bị lặp hai nơi mà quên sửa một chỗ.**

`DATABASE_URL` chứa lại mật khẩu đã khai ở `POSTGRES_PASSWORD`. Nếu sửa một chỗ
mà quên chỗ kia, PostgreSQL khởi động bình thường còn ứng dụng báo
`password authentication failed`. Kiểm tra nhanh:

```bash
grep -E '^(POSTGRES_PASSWORD|DATABASE_URL|REDIS_PASSWORD|REDIS_URL)=' .env.production
```

**2. Mật khẩu có ký tự đặc biệt.**

`DATABASE_URL` và `REDIS_URL` là URL, nên các ký tự `@ : / ? # &` bên trong mật
khẩu sẽ bị hiểu sai. `openssl rand -base64` có thể sinh ra `/` và `+`, nên hướng
dẫn ở trên dùng `openssl rand -hex` cho hai mật khẩu nằm trong URL — chuỗi hex
chỉ gồm `0-9a-f` nên không bao giờ cần mã hoá.

**3. `AUTH_URL` để `http://` hoặc để địa chỉ IP.**

Đăng nhập sẽ chuyển hướng sai và cookie phiên không được đặt. Phải là đúng tên
miền, đúng `https://`, **không** có dấu `/` ở cuối.

---

## 6. Khởi chạy hệ thống

```bash
cd /opt/dye-lms
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Lần đầu sẽ mất khoảng 5–15 phút vì phải biên dịch ứng dụng.

Theo dõi tiến trình:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
```

Dịch vụ `db-migrate` chạy một lần rồi thoát với mã `0` — đó là **đúng**, không
phải lỗi. Nó chạy migration rồi nạp chương trình học.

Xác nhận đã nạp đủ dữ liệu:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec postgres psql -U dye -d dye_lms -c \
  'SELECT (SELECT count(*) FROM "Course") AS khoa_hoc,
          (SELECT count(*) FROM "Lesson") AS bai_hoc,
          (SELECT count(*) FROM "User")   AS tai_khoan;'
```

> **Vì sao tên bảng phải có dấu ngoặc kép?** Prisma đặt tên bảng theo kiểu
> `PascalCase` (`"User"`, `"Course"`), còn PostgreSQL tự hạ mọi tên không có
> ngoặc kép thành chữ thường. Viết `FROM users` sẽ báo
> `relation "users" does not exist`.

Kết quả mong đợi: có khoá học và bài học, còn `tai_khoan` bằng **0**.

> **Vì sao chưa có tài khoản nào?** Bộ seed cố ý không tạo tài khoản demo khi
> `NODE_ENV=production`. Các tài khoản demo dùng chung một mật khẩu được ghi
> công khai trong kho mã nguồn, trong đó có một tài khoản quản trị — tạo chúng
> trên máy chủ thật là mở sẵn cửa cho bất kỳ ai đọc README.

---

## 7. Tạo tài khoản quản trị đầu tiên

```bash
cd /opt/dye-lms
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
  -e ADMIN_USERNAME='hieutruong' \
  -e ADMIN_PASSWORD='<mat-khau-manh-it-nhat-12-ky-tu>' \
  -e ADMIN_DISPLAY_NAME='Nguyễn Văn A' \
  db-migrate sh -c 'npx tsx prisma/scripts/tao-quan-tri.ts'
```

Lệnh này **không** ghi đè tài khoản đã tồn tại. Nếu quên mật khẩu quản trị và
muốn đặt lại, thêm `-e ADMIN_FORCE_RESET=yes`.

> **Mẹo che mật khẩu khỏi lịch sử shell.** Thêm một dấu cách ở đầu dòng lệnh thì
> bash sẽ không lưu vào `~/.bash_history` (khi `HISTCONTROL=ignorespace`).

Sau khi có tài khoản quản trị, hãy đăng nhập và tạo tài khoản giáo viên, lớp học
và danh sách học sinh qua giao diện web.

---

## 8. Nginx reverse proxy

Ứng dụng chỉ lắng nghe trên `127.0.0.1:3000`. Nginx nhận HTTPS từ Internet rồi
chuyển tiếp vào.

```bash
sudo apt-get install -y nginx
sudo rm -f /etc/nginx/sites-enabled/default
```

Tạo `/etc/nginx/sites-available/dye-lms`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name lms.truonghoccuaban.edu.vn;

    # Certbot dùng đường dẫn này để xác thực tên miền.
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name lms.truonghoccuaban.edu.vn;

    # Certbot sẽ điền các dòng ssl_certificate ở bước 9.

    # Học sinh nộp cả dự án Pygame trong một lần, giới hạn 50 MB mỗi dự án.
    # Để mặc định 1 MB thì mọi lượt nộp dự án đều hỏng với lỗi 413.
    client_max_body_size 60m;

    # Bài chấm có thể chạy tới 10 giây; đừng ngắt kết nối giữa chừng.
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;

        # BẮT BUỘC. Thiếu dòng này thì Auth.js tưởng đang chạy HTTP và
        # không đặt cookie phiên — đăng nhập xong lại quay về trang đăng nhập.
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off;
    }

    # Tài nguyên tĩnh có tên chứa mã băm nên cache vĩnh viễn được.
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

> **Không thêm các header bảo mật ở Nginx.** Ứng dụng đã tự đặt CSP,
> `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
> `Permissions-Policy` và HSTS trong
> [`apps/web/next.config.mjs`](../apps/web/next.config.mjs). Khai thêm ở Nginx sẽ
> tạo header trùng lặp, và trình duyệt xử lý nhiều CSP theo kiểu giao của các
> chính sách — rất dễ làm hỏng trang mà khó lần ra nguyên nhân.

Bật cấu hình:

```bash
sudo ln -s /etc/nginx/sites-available/dye-lms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Chứng chỉ SSL (HTTPS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lms.truonghoccuaban.edu.vn
```

Certbot tự sửa tệp cấu hình ở bước 8 để thêm `ssl_certificate` và
`ssl_certificate_key`.

Kiểm tra việc tự động gia hạn:

```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

Chứng chỉ Let's Encrypt có hạn 90 ngày. `certbot.timer` gia hạn tự động; nếu
timer không chạy thì đúng 90 ngày sau trang web sẽ báo lỗi chứng chỉ.

> **Về HSTS.** Ứng dụng gửi `Strict-Transport-Security: max-age=31536000`. Sau
> lần truy cập HTTPS đầu tiên, trình duyệt sẽ **từ chối** dùng HTTP với tên miền
> này trong một năm. Chỉ bật HTTPS khi bạn chắc chắn sẽ giữ HTTPS lâu dài.

---

## 10. Bộ chấm bài và hộp cát Docker

Bộ chấm bài chạy mã của học sinh, nên phần này cần đọc kỹ.

### Dựng ảnh chạy Python

Worker khởi động các container hộp cát từ một ảnh phải có sẵn **trên máy chủ**:

```bash
cd /opt/dye-lms
docker build -t dye-judge-pytest:3.12 \
  -f apps/judge-worker/images/pytest.Dockerfile apps/judge-worker/images
docker images | grep dye-judge
```

Thiếu bước này thì mọi lượt nộp bài Python đều báo lỗi hệ thống.

### Các lớp cách ly

Mỗi container hộp cát chạy với:

| Tham số | Giá trị | Ngăn được gì |
| --- | --- | --- |
| `--network none` | không có mạng | Gọi ra Internet, tấn công máy khác |
| `--memory` | 128–256 MB | Cấp phát bộ nhớ vô hạn làm treo máy |
| `--cpus` | 0.5 | Vòng lặp vô tận chiếm hết CPU |
| `--pids-limit` | 50 | Fork bomb |
| `--read-only` | hệ thống tệp gốc chỉ đọc | Ghi đè tệp hệ thống |
| `tmpfs /tmp` | `noexec,nosuid`, 10 MB | Tải xuống rồi chạy mã lạ |
| `--user` | `1000:1000` | Chạy dưới quyền root trong container |

Các ràng buộc này được kiểm chứng bằng test tự động trong
`apps/judge-worker/src/sandbox.test.ts`, chứ không chỉ nằm trong tài liệu.

### Rủi ro của docker.sock

Dịch vụ `judge-worker` gắn `/var/run/docker.sock` để tạo được container hộp cát.
**Quyền này tương đương quyền root trên máy chủ.**

Điều đó chấp nhận được với worker vì nó chỉ chạy mã trong kho nguồn này. Nó
**không** chấp nhận được với hộp cát — và hộp cát không bao giờ nhìn thấy socket
(có test khẳng định điều này).

Gắn socket ở chế độ chỉ đọc (`:ro`) **không giúp gì cả**: Docker API là HTTP đi
qua socket đó, đặt tệp thành chỉ đọc không làm API thành chỉ đọc.

Nếu VPS còn chạy dịch vụ nào khác không thuộc dự án này, hãy tách bộ chấm bài
sang một máy riêng.

---

## 11. Sao lưu và phục hồi

Có hai thứ cần sao lưu: cơ sở dữ liệu và tệp dự án học sinh tải lên.

### Kịch bản sao lưu hằng ngày

Tạo `/opt/dye-lms/sao-luu.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

THU_MUC=/var/backups/dye-lms
NGAY=$(date +%Y-%m-%d)
mkdir -p "$THU_MUC"

cd /opt/dye-lms
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# Cơ sở dữ liệu
$COMPOSE exec -T postgres pg_dump -U dye -d dye_lms --format=custom \
  > "$THU_MUC/dye_lms-$NGAY.dump"

# Tệp học sinh tải lên (nằm trong volume "uploads")
docker run --rm \
  -v dye-lms-prod_uploads:/data:ro \
  -v "$THU_MUC":/backup \
  alpine tar czf "/backup/uploads-$NGAY.tar.gz" -C /data .

# Giữ 14 ngày gần nhất
find "$THU_MUC" -type f -mtime +14 -delete
```

```bash
chmod +x /opt/dye-lms/sao-luu.sh
sudo crontab -e
# Chạy lúc 2 giờ sáng mỗi ngày:
# 0 2 * * * /opt/dye-lms/sao-luu.sh >> /var/log/dye-sao-luu.log 2>&1
```

> **Bản sao lưu chưa từng phục hồi thử thì chưa phải bản sao lưu.** Mỗi học kỳ
> nên phục hồi thử một lần sang máy khác để chắc chắn tệp dump dùng được.

### Phục hồi

```bash
cd /opt/dye-lms
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

$COMPOSE stop web judge-worker
cat /var/backups/dye-lms/dye_lms-2026-08-18.dump \
  | $COMPOSE exec -T postgres pg_restore -U dye -d dye_lms --clean --if-exists
$COMPOSE start web judge-worker
```

---

## 12. Cập nhật phiên bản mới

```bash
cd /opt/dye-lms
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# 1. Sao lưu TRƯỚC khi cập nhật
./sao-luu.sh

# 2. Lấy mã mới
git pull origin main

# 3. Dựng lại
$COMPOSE build

# 4. Chạy migration rồi khởi động lại
$COMPOSE up -d

# 5. Kiểm tra
$COMPOSE ps
$COMPOSE logs --tail=50 web
```

Migration của Prisma là tiến (forward-only) và không có lệnh lùi tự động. Nếu
một bản cập nhật hỏng, cách quay lui là phục hồi bản sao lưu ở mục 11.

---

## 13. Khắc phục sự cố

### Trang báo 502 Bad Gateway

Nginx chạy nhưng không nối được vào ứng dụng.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 web
curl -I http://127.0.0.1:3000/dang-nhap
```

### Đăng nhập xong lại quay về trang đăng nhập

Gần như luôn do một trong hai nguyên nhân:

1. Thiếu `proxy_set_header X-Forwarded-Proto $scheme;` trong Nginx.
2. `AUTH_URL` không khớp chính xác tên miền đang truy cập (sai `https`, thừa dấu
   `/` ở cuối, hoặc dùng IP).

### password authentication failed for user "dye"

Mật khẩu trong `DATABASE_URL` không khớp `POSTGRES_PASSWORD`. Lưu ý: đổi
`POSTGRES_PASSWORD` sau khi PostgreSQL đã khởi tạo lần đầu **không** đổi mật khẩu
thật trong cơ sở dữ liệu — biến đó chỉ dùng lúc tạo cluster. Đổi bằng SQL:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec postgres psql -U dye -d dye_lms \
  -c "ALTER USER dye WITH PASSWORD 'mat-khau-moi';"
```

### Nộp bài mà không bao giờ được chấm

```bash
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE logs --tail=100 judge-worker
docker images | grep dye-judge          # ảnh hộp cát đã dựng chưa?
```

Nguyên nhân hay gặp nhất là quên dựng ảnh `dye-judge-pytest:3.12` ở mục 10.

### Lỗi 413 khi học sinh nộp dự án

Thiếu `client_max_body_size 60m;` trong Nginx.

### Hết dung lượng ổ đĩa

```bash
df -h
docker system df
docker image prune -a          # an toàn: chỉ xoá ảnh không còn dùng
```

> Tránh `docker system prune --volumes` trên máy chủ thật: lệnh đó xoá cả volume
> không được container nào đang dùng, và nếu hệ thống đang tạm dừng thì volume
> chứa cơ sở dữ liệu cũng nằm trong diện bị xoá.

---

## 14. Danh sách kiểm tra trước khi mở cho học sinh

- [ ] `dig` trả về đúng IP của VPS
- [ ] `ufw status` chỉ mở 22, 80, 443
- [ ] Từ máy khác, cổng 5432 và 6379 **không** kết nối được
- [ ] `.env.production` có quyền `600` và không nằm trong Git
- [ ] `AUTH_SECRET` là chuỗi ngẫu nhiên, không phải giá trị mẫu
- [ ] `AUTH_URL` là `https://` + tên miền thật, không có `/` ở cuối
- [ ] `SEED_ALLOW_PRODUCTION=no`
- [ ] Bảng `"User"` không chứa tài khoản demo nào (`hs.an`, `co.lan`, …)
- [ ] Đã tạo tài khoản quản trị thật với mật khẩu mạnh
- [ ] `https://` mở được, có ổ khoá, `http://` tự chuyển sang `https://`
- [ ] `certbot renew --dry-run` chạy thành công
- [ ] Ảnh `dye-judge-pytest:3.12` đã có trên máy chủ
- [ ] Nộp thử một bài Python và nhận được kết quả chấm
- [ ] Nộp thử một dự án Pygame khoảng 10 MB không bị lỗi 413
- [ ] `sao-luu.sh` đã chạy được ít nhất một lần và có tệp dump
- [ ] Đã phục hồi thử bản sao lưu sang máy khác

---

## Phụ lục: các lệnh hay dùng

Đặt bí danh cho gọn:

```bash
echo "alias dye='docker compose -f /opt/dye-lms/docker-compose.prod.yml --env-file /opt/dye-lms/.env.production'" \
  >> ~/.bashrc
source ~/.bashrc
```

```bash
dye ps                      # trạng thái các dịch vụ
dye logs -f web             # nhật ký ứng dụng
dye logs -f judge-worker    # nhật ký bộ chấm bài
dye restart web             # khởi động lại ứng dụng
dye down                    # dừng tất cả (KHÔNG xoá dữ liệu)
dye exec postgres psql -U dye -d dye_lms    # mở psql
```

> `dye down -v` xoá **toàn bộ volume**, tức là mất sạch cơ sở dữ liệu và bài của
> học sinh. Gần như không bao giờ có lý do chạy lệnh này trên máy chủ thật.
