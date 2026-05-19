readme_content = """# Codebase Bible 📖

**Codebase Bible** là một công cụ Full-stack hỗ trợ lập trình viên đọc hiểu, phân tích và tự động tạo tài liệu hướng dẫn (onboarding) cho bất kỳ kho lưu trữ mã nguồn (GitHub repository) nào chỉ với một cú click chuột. Hệ thống ứng dụng kiến trúc RAG (Retrieval-Augmented Generation) kết hợp phân tích cú pháp mã nguồn chuyên sâu để chuyển đổi các file code phức tạp thành tài liệu Markdown trực quan, sinh động.

---

## 🚀 Các Tính Năng Đã Hoàn Thành

1. **Pipeline Xử Lý Dữ Liệu Tự Động (Ingestion Pipeline):** Tự động clone mã nguồn từ GitHub, lọc bỏ các file rác (ảnh, thư mục build, thư mục cấu hình ẩn) và băm nhỏ mã nguồn (chunking) theo ngữ nghĩa nhờ bộ lọc AST.
2. **Hệ Thống Vector Cơ Sở Dữ Liệu Địa Phương:** Tạo các Vector Embedding (mảng 1536 chiều qua OpenAI Embeddings) đại diện cho ý nghĩa của từng đoạn code, lưu trữ cục bộ mượt mà bằng **SQLite** thông qua **Prisma ORM**.
3. **Cơ Chế Điều Hướng Phân Cấp (Hierarchical Sidebar):** Giao diện quản lý file dạng cây thư mục lồng nhau đệ quy chuyên nghiệp, lấy cảm hứng từ cấu trúc Explorer của VS Code với hệ thống hơn 30+ biểu tượng icon tự động nhận diện theo đuôi file.
4. **Tự Động Hóa Quản Lý Cổng Chạy (Pre-dev Port Control):** Tích hợp script dọn dẹp tiến trình chạy ngầm (Zombie Process). Mỗi khi kích hoạt dự án, hệ thống tự động quét và giải phóng các cổng kẹt (`3000`, `5173`, `5174`), ngăn ngừa hoàn toàn lỗi `EADDRINUSE`.
5. **Cấu Hình Giới Hạn Tần Suất Gọi AI Linh Hoạt (Dynamic Rate Limiting):** Tự động phát hiện loại model LLM (Free hay Premium). Nếu phát hiện model miễn phí (như các dòng `:free` trên OpenRouter), hệ thống tự động kích hoạt chế độ **Throttle & Delay** (chạy tuần tự và nghỉ giãn cách 3 giây) để phòng tránh lỗi `429 Too Many Requests`.
6. **Dọn Dẹp Dữ Liệu Tận Gốc (Cascade Deletion):** Chức năng xóa repository được cấu hình đồng bộ hóa cơ sở dữ liệu. Khi thực hiện lệnh xóa một repo, toàn bộ các file con, các đoạn chunking dữ liệu và tài liệu AI sinh ra sẽ tự động biến mất sạch sẽ, không để lại rác trong bộ nhớ SQLite.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

* **Frontend:** React.js, Vite, TypeScript, Wouter (Routing), `@uiw/react-md-editor` (Markdown Rendering & Editing).
* **Backend:** Node.js, Express, TypeScript, Chonky/AST Parsers, Concurrently (Quản lý đa tiến trình song song).
* **Database & ORM:** SQLite, Prisma ORM (Hỗ trợ cấu hình `onDelete: Cascade` tối ưu).
* **AI & RAG Pipeline:** OpenAI Embeddings (`text-embedding-3-small`), OpenRouter API Gateway (`claude-opus-4.6-fast`, `deepseek-v4-flash:free`).

---

## 📦 Hướng Dẫn Cài Đặt (Setup Instructions)

Hệ thống được thiết kế tối ưu hóa cho môi trường phát triển cục bộ của developer. Hãy làm theo các bước dưới đây:

### 1. Tải Mã Nguồn Và Cài Đặt Thư Viện

Mở terminal tại thư mục gốc của dự án và chạy lệnh tự động để cài đặt toàn bộ package cho cả Frontend lẫn Backend: