# Antigravity Task: Implement "Vua Tiếng Việt" Real-time Game

## 1. Tổng quan dự án
Nhiệm vụ của bạn là xây dựng ứng dụng web trò chơi thi đấu ngôn ngữ trực tuyến nhiều người chơi (multiplayer), mô phỏng theo luật của gameshow "Vua tiếng Việt".
- **Tech Stack:** Python (FastAPI), WebSockets (Backend) và Vanilla HTML/CSS/JS (Frontend).
- **Quy mô phòng chơi:** Mỗi phòng (Room) nhận tối đa 4 người chơi kết nối qua WebSocket.

## 2. Thiết kế Giao diện (UI/UX)
- **Chủ đề thị giác (Theme):** Áp dụng phong cách dark-theme kết hợp hiệu ứng cyber-neon.
- **Biến màu CSS (CSS Variables):**
  - Màu nền chính (Background): Obsidian (`#0b0c10`).
  - Màu thẻ/hộp thoại (Cards/Containers): Navy tối (`#1f2833`).
  - Màu chữ và viền nổi bật (Neon Glow): Cyan (`#66fcf1`) cho câu hỏi/text chính, Magenta (`#ff00ff`) hoặc Neon Green (`#45a29e`) cho đồng hồ đếm ngược và hiệu ứng đúng/sai.

## 3. Cấu trúc dữ liệu & Logic Backend (main.py)
Bạn cần thiết lập một class `ConnectionManager` trong FastAPI để quản lý các WebSocket liên kết với `room_id`. Trạng thái điểm số phải được đặt lại về 0 khi bắt đầu mỗi vòng mới. Người có điểm thấp nhất sẽ bị hệ thống gắn cờ "Loại" (Eliminated) sau mỗi vòng.

## 4. Đặc tả cơ chế các vòng thi (Thực thi qua JS & WebSockets)

### A. Vòng 1: Phản xạ (Reflex)
- **Luật:** Mỗi người chơi có 90 giây để trả lời tối đa 14 câu hỏi độc lập. Trả lời đúng được 1 điểm. Được quyền bỏ qua (không thể quay lại).
- **Thực thi:** 
  - Server gửi một mảng 14 câu hỏi dạng JSON về cho Client.
  - Client chạy đồng hồ đếm ngược 90s bằng JavaScript.
  - Điểm được gửi cập nhật liên tục về Server thông qua WebSocket payload.

### B. Vòng 2: Xâu chuỗi (Stringing)
- **Luật:** Server phát ngẫu nhiên 9 câu hỏi (mỗi câu là một thành ngữ/ca dao đã bị đảo lộn thứ tự các tiếng). Mỗi câu có thời gian 30 giây.
- **Thực thi:**
  - Hệ thống sử dụng cơ chế "Bấm chuông" (Buzzer).
  - Khi câu hỏi hiện ra, người chơi đầu tiên click nút "Trả lời" (gửi tín hiệu `buzz` qua WebSocket) sẽ giành quyền khóa màn hình của những người khác và nhập đáp án.
  - Đúng cộng 1 điểm. Sai thì những người còn lại có quyền bấm chuông tiếp nếu thời gian 30s chưa hết. Người đạt 5 điểm trước hoặc cao điểm nhất sau 9 câu sẽ thắng.

### C. Vòng Đặc biệt: Soán ngôi (Mùa 6 Format)
- **Luật:** Trả lời một ô chữ hàng ngang. Có 2 giai đoạn, mỗi giai đoạn 15 giây. 
- **Thực thi:**
  - **Giai đoạn 1 (15s đầu):** Chỉ hiện ô chữ trống và gợi ý chung. Nếu người chơi nhập đúng, nhận 100% tiền thưởng giả lập.
  - **Giai đoạn 2 (15s sau):** Nếu giai đoạn 1 không trả lời được, Server gửi tín hiệu lật mở ngẫu nhiên 1 chữ cái. Nếu trả lời đúng ở giai đoạn này, nhận 50% tiền thưởng. Không có đáp án đúng, trò chơi kết thúc.

## 5. Chỉ thị Code
1. Viết file `main.py` thiết lập FastAPI, mount thư mục `/static` và định nghĩa các endpoint WebSocket xử lý luồng (flow) 3 vòng thi trên.
2. Tạo thư mục `/static` chứa:
   - `index.html`: Khung giao diện chứa khu vực đăng nhập phòng, bảng xếp hạng (Leaderboard) và khu vực hiển thị câu hỏi.
   - `style.css`: Khai báo các biến màu tối/neon và hiệu ứng (glow, transition).
   - `app.js`: Xử lý kết nối WebSocket, render DOM theo dữ liệu Server gửi về, đếm ngược thời gian và bắt sự kiện bàn phím.
3. Chú trọng tính module và safe refactoring để tôi có thể dễ dàng thêm ngân hàng dữ liệu câu hỏi tiếng Việt sau này.