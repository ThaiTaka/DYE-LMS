# 🔍 Nội dung cần rà soát

> **Trạng thái:** 10 bài tập có lời giải mẫu **không qua được chính bài của nó**.
> **Phát hiện bởi:** `npm run judge:verify` (Phase 8)
> **Cần:** người soạn giáo án quyết định bên nào đúng.

---

## Vấn đề này nghiêm trọng ở đâu

Mỗi bài trong danh sách dưới đây sẽ **chấm SAI một bài làm ĐÚNG của học sinh**.

Lời giải mẫu (`Problem.solutionCode`) và kết quả mong đợi (`TestCase.expectedOutput`) đang mâu thuẫn với nhau. Một trong hai bên sai, và **chỉ người soạn giáo án mới biết bên nào** — vì câu trả lời phụ thuộc vào ý định sư phạm của bài, không suy ra được từ code.

Đây là lý do công cụ này tồn tại: không có cách nào phát hiện những lỗi này bằng cách đọc file seed. Chúng chỉ lộ ra khi cho chạy thật.

---

## Vì sao chưa tự sửa

Có thể sửa nhanh bằng cách lấy kết quả của lời giải mẫu làm chuẩn rồi ghi đè `expectedOutput`. **Đã cố ý không làm vậy.**

Nếu bên sai lại chính là *lời giải mẫu*, việc đó sẽ đóng băng cái sai thành chuẩn mực, và từ đó hệ thống dạy sai cho mọi học sinh — im lặng, không ai biết. Một bài tập hỏng mà lộ rõ vẫn tốt hơn một bài tập hỏng đã được che đi.

---

## Cách kiểm tra lại

```bash
npm run judge:verify
```

Lệnh này chạy **toàn bộ** lời giải mẫu qua bộ chấm thật và thoát với mã lỗi khác 0 nếu còn bài nào chưa đạt. Có thể đưa thẳng vào CI.

---

## Danh sách chi tiết

<!-- Bảng dưới đây sinh ra từ lần chạy judge:verify ngày 2026-08-18 -->

### Đã sửa ✅

| Bài | Nguyên nhân | Cách xử lý |
|---|---|---|
| `p-b07-chu-vi-dien-tich-hcn` | `1.25 × 0.5 = 0.625`, Python làm tròn **về số chẵn** cho `0.62`, đề bài ghi `0.63` | Đổi đầu vào thành `1.25 / 0.4` để không rơi vào thế hoà. Buổi 7 dạy hình chữ nhật, không dạy IEEE-754. |

### Còn chờ rà soát ⏳

| Bài | Số ca sai | Ghi chú |
|---|---|---|
| `p-nc-b17-trich-xuat-thong-tin` | 1/6 | Lệch ở phép tính tổng chữ số |
| `p-pg-b03-dem-vat-cham-day` | 3/6 | Lệch lớn và không theo quy luật — nên xem lại cả đề bài |
| `p-pg-b09-mo-phong-nay` | 1/6 | |
| `p-pg-b10-ma-sat-va-gia-toc` | 1/6 | Sai số dấu phẩy động khi cộng dồn |
| `p-pg-b11-do-cao-cu-nhay` | 2/6 | |
| `p-pg-b14-tinh-diem-combo` | 1/7 | |
| `p-pg-b20-ai-tuan-tra` | 3/6 | Lệch lớn — nên xem lại cả đề bài |
| `p-pg-b21-chuyen-trang-thai-ai` | 1/6 | |
| `p-pg-b25-dan-dich-cham-mep` | 3/6 | Lệch lớn — nên xem lại cả đề bài |
| `p-pg-b30-tong-ket-diem-du-an` | 1/6 | |

### Hai nhóm khác nhau

**Nhóm A — sai số dấu phẩy động (1 ca sai/bài).** Ví dụ `p-pg-b10`: lời giải in `-0.445`, đề bài ghi `-0.454`. Cộng dồn số thực nhiều lần thì kết quả phụ thuộc vào **thứ tự phép tính**. Nhiều khả năng đề bài được tính tay theo một thứ tự khác. Cân nhắc đặt `floatTolerance` cho các ca này thay vì so khớp chuỗi chính xác — `TestCase.comparison` đã hỗ trợ sẵn.

**Nhóm B — lệch về mặt thuật toán (3 ca sai/bài).** Ví dụ `p-pg-b03`: lời giải in `7`, đề bài ghi `5`. Đây không phải sai số làm tròn mà là **hai cách hiểu khác nhau về đề bài**. Cần đọc lại phần mô tả và quyết định cách hiểu nào là ý định gốc.

---

## Ba bài bị bỏ qua (không phải lỗi)

| Bài | Lý do |
|---|---|
| `p-nc-b19-goi-api-hoc-sinh` | Cần runtime `PY_WEB` |
| `p-nc-b20-client-api-co-xu-ly-loi` | Cần runtime `PY_WEB` |
| `p-nc-b21-mo-hinh-hoa-json` | Cần runtime `PY_WEB` |

`PY_WEB` cần một máy chủ giả chạy trên loopback trong hộp cát để `requests` hoạt động mà vẫn không có mạng ra ngoài. Chưa dựng ở Phase 8. Bộ chấm trả về `SKIPPED` kèm lý do rõ ràng, **không** chấm sai thành `WRONG_ANSWER` — vì bài làm đúng của học sinh không được phép bị đánh trượt chỉ vì hệ thống chưa hỗ trợ.

---

<div align="center">

**Xem thêm:** [`04-ROADMAP.md`](04-ROADMAP.md) · [`03-CURRICULUM-MAP.md`](03-CURRICULUM-MAP.md)

</div>
