# 👑 Vua Tiếng Việt - Kinh Tế Chính Trị Edition

Game thi đấu trực tuyến thời gian thực mô phỏng gameshow **Vua Tiếng Việt**, tích hợp các tính năng tương tác học đường sinh động.

## 🚀 Tính năng nổi bật:
- 🎮 **3 Vòng thi hấp dẫn**: 
  - **Vòng 1 - Phản xạ**: Trả lời nhanh từ xáo trộn.
  - **Vòng 2 - Xâu chuỗi**: Click chọn và sắp xếp từ thành câu có nghĩa.
  - **Vòng 3 - Soán ngôi**: Đoán ô chữ từ khóa nhận điểm thưởng.
- 🎒 **Cơ chế Phá hoại & Combo**: Đóng băng màn hình, Trộm thời gian, Tung bụi phấn (lau bảng).
- 🤪 **Tương tác Emote**: Bắn biểu tượng cảm xúc trêu đối thủ thời gian thực.
- 🔍 **Quyền trợ giúp**: Trợ giúp 50/50 (chọn 1 trong 2 nút nhấp nháy), Hiện từ đầu/từ cuối, Cặp từ liền kề.
- 🏆 **Bảng Vàng Kỷ Lục (High Scores)**: Lưu trữ Top 10 cao thủ mọi thời đại.

## 🛠️ Công nghệ sử dụng:
- **Backend**: Python FastAPI, WebSockets
- **Frontend**: HTML5, Vanilla CSS3, JavaScript (ES6+), Web Audio API
- **Deployment**: Render.com ready

## 💻 Chạy cục bộ:
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
