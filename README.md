# ViezAI Admin Dashboard & Contact Ingestion API

Hệ thống quản lý và tiếp nhận form liên hệ từ Landing Page **ViezAI (viezai.com)** dành cho doanh nghiệp có nhu cầu triển khai giải pháp Enterprise AI Agent Orchestration.

---

## 🌟 Tính Năng Nổi Bật

1. **API Ingestion Hiệu Năng Cao & Chống Spam (`POST /api/contacts`)**:
   - Tiếp nhận thông tin khách hàng: Họ tên, Email, Doanh nghiệp, Nhu cầu AI Agent, Lời nhắn.
   - Cơ chế bẫy Spam Honeypot (`website`, `hp_check`).
   - Rate limiting in-memory sliding window ngăn chặn brute-force và DoS.
   - Xác thực định dạng email và chuẩn hóa chuỗi đầu vào.
   - Gửi thông báo tức thì (Non-blocking Webhooks) tới **Discord**, **Telegram Bot** hoặc **Generic Webhook**.

2. **Quản Trị Viên (Admin Management)**:
   - Bảo vệ an toàn bằng `ADMIN_KEY` / Secret Token (Bearer token hoặc `x-admin-token`).
   - Quản lý trạng thái xử lý khách hàng: `new` (Mới nhận), `contacting` (Đang liên hệ), `completed` (Hoàn thành), `archived` (Lưu trữ).
   - Tìm kiếm đa trường (Tên, Email, Công ty, Ghi chú), lọc trạng thái, phân trang.
   - Cập nhật trạng thái và ghi chú nội bộ (Internal Notes) cho từng khách hàng.
   - Thống kê KPI thời gian thực: Tổng lượt liên hệ, số lead mới, tỷ lệ xử lý.
   - Xuất dữ liệu ra file **CSV chuẩn UTF-8 BOM** hiển thị đúng tiếng Việt trong Microsoft Excel.

3. **Giao Diện Web UI Tối Giản (OpenAI / Vercel Aesthetic)**:
   - Đơn trang (SPA) không phụ thuộc framework nặng, tải nhanh dưới 50ms.
   - Dark theme tối giản, tinh tế: `#000000`, card `#0a0a0c`, viền mảnh `#1e1e24`, typography Inter & JetBrains Mono.
   - Modal xem chi tiết và xử lý lead trực quan, responsive trên mọi thiết bị di động.

4. **Kiến Trúc Lưu Trữ Zero-Config**:
   - Sử dụng SQLite WebAssembly (`sql.js`) 100% tương thích, không yêu cầu công cụ biên dịch C++ native addon.
   - Tự động đồng bộ và lưu trữ tệp cơ sở dữ liệu `data/contacts.db`.

---

## 🚀 Khởi Chạy Nhanh

### Yêu Cầu
- Node.js >= 18 (hoặc Docker / Docker Compose)

### 1. Chạy Trực Tiếp Bằng Node.js
```bash
# Cài đặt thư viện
npm install

# Sao chép biến môi trường
cp .env.example .env

# Chạy ứng dụng ở chế độ dev (tự reload khi sửa code)
npm run dev

# Hoặc khởi chạy production
npm start
```
Mặc định dịch vụ sẽ lắng nghe tại: `http://localhost:4000`

### 2. Chạy Bằng Docker Compose
```bash
docker-compose up -d --build
```
Dữ liệu danh sách khách hàng được lưu trữ bền vững tại thư mục `./data` trên máy chủ chủ quản.

---

## ⚙️ Biến Môi Trường (`.env`)

| Biến | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `PORT` | `4000` | Cổng HTTP Express server lắng nghe |
| `ADMIN_KEY` | `viezai_admin_2026` | Mật khẩu truy cập Admin Dashboard |
| `CORS_ORIGIN` | `*` | Danh sách domain được phép gọi API (ví dụ: `https://viezai.com`) |
| `DISCORD_WEBHOOK_URL` | *(để trống)* | Webhook URL kênh Discord nhận thông báo lead mới |
| `TELEGRAM_BOT_TOKEN` | *(để trống)* | Token Bot Telegram |
| `TELEGRAM_CHAT_ID` | *(để trống)* | ID nhóm hoặc chat Telegram nhận thông báo |
| `GENERIC_WEBHOOK_URL`| *(để trống)* | URL webhook tùy biến |

---

## 📖 Tài Liệu API

### 1. Ingestion Form (`Public`)
- **`POST /api/contacts`**
  ```json
  {
    "fullName": "Nguyễn Văn A",
    "email": "a.nguyen@enterprise.vn",
    "company": "Tập đoàn Viez Corp",
    "need": "Multi-Agent Automation & Private Deployment",
    "message": "Cần tư vấn triển khai cụm agent tự hành nội bộ.",
    "website": "" // Honeypot field (phải để trống)
  }
  ```

### 2. Xác Thực Quản Trị (`Auth`)
- **`POST /api/auth/login`**
  - Body: `{ "key": "viezai_admin_2026" }`
- **`GET /api/auth/verify`**
  - Header: `Authorization: Bearer <ADMIN_KEY>`

### 3. Quản Lý Lead (`Admin`)
*(Yêu cầu Header `Authorization: Bearer <ADMIN_KEY>`)*
- **`GET /api/contacts?page=1&limit=15&search=viez&status=new`**
- **`GET /api/contacts/:id`**
- **`PATCH /api/contacts/:id`**: Cập nhật trạng thái và ghi chú:
  ```json
  {
    "status": "contacting",
    "notes": "Đã gửi email hẹn gặp demo vào 9h sáng thứ Hai."
  }
  ```
- **`DELETE /api/contacts/:id`**
- **`GET /api/stats`**: Thống kê số lượng theo trạng thái.
- **`GET /api/contacts/export/csv`**: Tải file CSV tiếng Việt có tiền tố UTF-8 BOM.

---

## 🧪 Kiểm Thử Tự Động (Test Suite)

Hệ thống có test suite tự động kiểm tra toàn bộ 4 tiêu chí nghiệm thu (AC):
```bash
npm test
```

---

## 🔒 Bản Quyền & Giấy Phép
Phát triển bởi đội ngũ Kỹ sư **ViezAI Enterprise**. Giấy phép MIT.