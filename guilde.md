# Antigravity Task: Scaffold Multiplayer Web Game
4. Yêu cầu các tính năng cốt lõi (MVP) cần thực thi
A. Quản lý phòng chơi (Lobby & Room)

Client có màn hình đăng nhập nhỏ để nhập Tên người chơi và Mã phòng.

Server (trong main.py) cần có class ConnectionManager để lưu trữ danh sách các phòng (rooms) và các kết nối (websocket) tương ứng với từng phòng.

B. Đồng bộ trạng thái trò chơi (Real-time Sync)

Khi có một người trong phòng bấm "Bắt đầu", server sẽ phát tín hiệu (broadcast) để tất cả client trong phòng đó cùng chuyển sang màn hình đếm ngược và hiển thị câu hỏi đầu tiên.

C. Logic Vòng 1: Phản xạ (Ví dụ minh họa)

Server giữ danh sách câu hỏi (ví dụ: "Sản phẩm của lao động, thỏa mãn nhu cầu qua trao đổi mua bán là gì?" - Đáp án: Hàng hóa).

Server gửi câu hỏi và đồng hồ đếm ngược (ví dụ 30 giây/câu) đến tất cả client trong phòng.

Người chơi nhập đáp án và ấn gửi qua WebSocket. Server chấm điểm ngay lập tức.

Khi hết giờ, server tổng hợp và broadcast Bảng xếp hạng (Leaderboard) cho tất cả mọi người.

5. Chỉ thị thực hiện
Thiết lập Backend: Viết file main.py hoàn chỉnh, cấu hình FastAPI để phục vụ file tĩnh (static files) và mở endpoint WebSocket /ws/{room_id}/{client_id}.

Thiết lập Frontend: Viết index.html và app.js để kết nối tới WebSocket, xử lý các sự kiện onmessage để cập nhật giao diện mà không cần reload trang.

An toàn & Tối ưu: Áp dụng nguyên tắc safe refactoring, đảm bảo code clean, dễ đọc, phân chia logic rõ ràng để tôi có thể dễ dàng bổ sung thêm dữ liệu câu hỏi từ file tài liệu của tôi sau này.

Hãy phân tích yêu cầu này và tiến hành sinh mã nguồn (generate code) cho các file main.py, index.html, style.css, và app.js.
"""

file_path = "antigravity_multiplayer_prompt.md"
with open(file_path, "w", encoding="utf-8") as file:
file.write(markdown_content)

print(f"File created successfully: {file_path}")

Để giải quyết yêu cầu "mỗi người dùng máy tính riêng để thi đấu với nhau từ xa", hệ thống web của bạn bắt buộc phải có một Backend (Máy chủ) để quản lý kết nối, và công nghệ tốt nhất để làm việc này là WebSockets (giúp dữ liệu đồng bộ ngay lập tức giữa các máy tính mà không cần tải lại trang).

Tôi đã soạn sẵn một file .md chứa Prompt chỉ lệnh chi tiết dành riêng cho Antigravity. Trong file này, tôi đã chỉ định rõ:

Công nghệ: Sử dụng Python (FastAPI) cho máy chủ và WebSockets để đồng bộ thời gian thực (rất phù hợp với môi trường VS Code và Python bạn đang dùng).

Cấu trúc thư mục: Chia rõ Backend và Frontend (HTML, CSS, JS).

Luồng trò chơi: Cấu trúc quản lý phòng (room) để bạn và bạn bè có thể nhập mã và vào chung một phòng thi đấu.

Cách sử dụng:
Bạn chỉ cần tải file .md này về, đưa vào thư mục làm việc trên VS Code của bạn và yêu cầu Antigravity: "Hãy đọc file antigravity_multiplayer_prompt.md và thực thi tuần tự các bước trong đó để tạo bộ khung dự án cho tôi". Antigravity sẽ tự động sinh mã nguồn khởi tạo cả Server lẫn giao diện trò chơi cho bạn!
## 1. Tổng quan dự án
Bạn hãy giúp tôi xây dựng một ứng dụng web trò chơi thi đấu trực tuyến thời gian thực (real-time multiplayer). Trò chơi này kết hợp nội dung môn Kinh tế chính trị (Hàng hóa, Thị trường, Tiền tệ) vào cơ chế đố vui, với các người chơi tham gia từ các máy tính khác nhau thông qua mạng internet.

## 2. Kiến trúc & Công nghệ (Tech Stack)
- **Backend:** Sử dụng Python với framework FastAPI. Yêu cầu thiết lập **WebSockets** để xử lý kết nối, đồng bộ trạng thái và gửi/nhận tín hiệu thời gian thực giữa các người chơi.
- **Frontend:** HTML, CSS, và Vanilla JavaScript.
- **Giao thức:** Client và Server giao tiếp thông qua JSON payload qua kênh WebSocket.

## 3. Cấu trúc thư mục dự kiến
Yêu cầu khởi tạo cấu trúc thư mục như sau:
```text
/game_project
├── main.py             # Server FastAPI và logic quản lý WebSocket
├── requirements.txt    # Các thư viện cần thiết (fastapi, uvicorn, websockets)
└── /static
    ├── index.html      # Giao diện chính của trò chơi
    ├── style.css       # File định dạng giao diện (giao diện dark-theme, neon)
    └── app.js          # Logic kết nối WebSocket phía client và xử lý DOM
```

## 4. Yêu cầu các tính năng cốt lõi (MVP) cần thực thi

**A. Quản lý phòng chơi (Lobby & Room)**
- Client có màn hình đăng nhập nhỏ để nhập `Tên người chơi` và `Mã phòng`.
- Server (trong `main.py`) cần có class `ConnectionManager` để lưu trữ danh sách các phòng (rooms) và các kết nối (websocket) tương ứng với từng phòng.

**B. Đồng bộ trạng thái trò chơi (Real-time Sync)**
- Khi có một người trong phòng bấm "Bắt đầu", server sẽ phát tín hiệu (broadcast) để tất cả client trong phòng đó cùng chuyển sang màn hình đếm ngược và hiển thị câu hỏi đầu tiên.

**C. Logic Vòng 1: Phản xạ (Ví dụ minh họa)**
- Server giữ danh sách câu hỏi (ví dụ: "Sản phẩm của lao động, thỏa mãn nhu cầu qua trao đổi mua bán là gì?" - Đáp án: Hàng hóa).
- Server gửi câu hỏi và đồng hồ đếm ngược (ví dụ 30 giây/câu) đến tất cả client trong phòng.
- Người chơi nhập đáp án và ấn gửi qua WebSocket. Server chấm điểm ngay lập tức.
- Khi hết giờ, server tổng hợp và broadcast Bảng xếp hạng (Leaderboard) cho tất cả mọi người.

## 5. Chỉ thị thực hiện
1. **Thiết lập Backend:** Viết file `main.py` hoàn chỉnh, cấu hình FastAPI để phục vụ file tĩnh (static files) và mở endpoint WebSocket `/ws/{room_id}/{client_id}`.
2. **Thiết lập Frontend:** Viết `index.html` và `app.js` để kết nối tới WebSocket, xử lý các sự kiện `onmessage` để cập nhật giao diện mà không cần reload trang.
3. **An toàn & Tối ưu:** Áp dụng nguyên tắc safe refactoring, đảm bảo code clean, dễ đọc, phân chia logic rõ ràng để tôi có thể dễ dàng bổ sung thêm dữ liệu câu hỏi từ file tài liệu của tôi sau này.

Hãy phân tích yêu cầu này và tiến hành sinh mã nguồn (generate code) cho các file `main.py`, `index.html`, `style.css`, và `app.js`.