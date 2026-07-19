# Antigravity Task: Expand Game Data Bank

## 1. Mục tiêu công việc
Sử dụng kho dữ liệu Kinh tế chính trị chi tiết để mở rộng bộ câu hỏi cho trò chơi, đảm bảo tính đa dạng và bao quát toàn bộ kiến thức về Lượng giá trị, Thuộc tính hàng hóa, Tính 2 mặt của lao động và Chức năng tiền tệ.

## 2. Cập nhật Dữ liệu câu hỏi (Backend - `game_data.py`)
Mở rộng các biến lưu trữ câu hỏi hiện tại bằng các dữ liệu dưới đây, cấu trúc dưới dạng List chứa Dict của Python:

### A. Dữ liệu Vòng 1: Phản xạ (14 câu hỏi - Trả lời nhanh 90s)
Khai báo mảng `round_1_questions` chứa các câu hỏi sau:
1. **Câu hỏi:** Thước đo lượng giá trị của hàng hóa được tính bằng gì? | **Đáp án:** Thời gian lao động
2. **Câu hỏi:** Thời gian lao động nào quyết định giá trị xã hội của hàng hóa trên thị trường? | **Đáp án:** Thời gian lao động xã hội cần thiết
3. **Câu hỏi:** Lượng giá trị của một đơn vị hàng hóa tỷ lệ nghịch với nhân tố nào? | **Đáp án:** Năng suất lao động
4. **Câu hỏi:** Tăng cường độ lao động có làm thay đổi lượng giá trị của một đơn vị hàng hóa không? | **Đáp án:** Không
5. **Câu hỏi:** Lao động phức tạp là lao động giản đơn được... làm sao? | **Đáp án:** Nhân lên
6. **Câu hỏi:** Thuộc tính nào của hàng hóa do thuộc tính tự nhiên quyết định? | **Đáp án:** Giá trị sử dụng
7. **Câu hỏi:** Lao động xã hội của người sản xuất kết tinh trong hàng hóa gọi là gì? | **Đáp án:** Giá trị
8. **Câu hỏi:** Lao động có ích dưới một hình thức cụ thể của một nghề nghiệp nhất định gọi là gì? | **Đáp án:** Lao động cụ thể
9. **Câu hỏi:** Lao động cụ thể tạo ra thuộc tính nào của hàng hóa? | **Đáp án:** Giá trị sử dụng
10. **Câu hỏi:** Sự tiêu hao sức lao động nói chung gạt bỏ hình thức cụ thể gọi là gì? | **Đáp án:** Lao động trừu tượng
11. **Câu hỏi:** Tiền dùng để biểu thị giá trị của hàng hóa khác là đang thực hiện chức năng gì? | **Đáp án:** Thước đo giá trị
12. **Câu hỏi:** Thay vì tiêu dùng, giữ vàng bạc lại để mua sắm trong tương lai là chức năng gì của tiền? | **Đáp án:** Phương tiện cất trữ
13. **Câu hỏi:** Mua hàng trước, trả tiền sau bằng thẻ tín dụng là tiền đang thực hiện chức năng gì? | **Đáp án:** Phương tiện thanh toán
14. **Câu hỏi:** Mâu thuẫn cơ bản của sản xuất hàng hóa là sự đối lập giữa lao động xã hội và lao động gì? | **Đáp án:** Lao động tư nhân (hoặc cá nhân)

### B. Dữ liệu Vòng 2: Xâu chuỗi (Sắp xếp từ trong 30s)
Khai báo mảng `round_2_questions` bao gồm các câu gốc (frontend sẽ tự động xử lý tách chữ và đảo lộn vị trí bằng split và shuffle):
1. **Câu gốc:** Lượng giá trị của hàng hóa
2. **Câu gốc:** Thời gian lao động cá biệt
3. **Câu gốc:** Tính chất hai mặt của lao động
4. **Câu gốc:** Lao động trừu tượng tạo ra giá trị
5. **Câu gốc:** Phương tiện lưu thông tiền tệ
6. **Câu gốc:** Tiêu dùng mang tính chất xã hội
7. **Câu gốc:** Năng suất lao động tăng lên
8. **Câu gốc:** Thuộc tính tự nhiên quyết định
9. **Câu gốc:** Phân công lao động xã hội

### C. Dữ liệu Vòng Đặc Biệt: Soán ngôi (Ô chữ)
Khai báo mảng `special_round_questions` theo định dạng `{"keyword": "...", "clue_1": "...", "clue_2": "..."}` phục vụ cho 2 giai đoạn gợi ý:
1. **Từ khóa:** HANGHOA (7 chữ cái)
   - **Gợi ý 1 (Giai đoạn 1):** Sản phẩm của lao động, thỏa mãn nhu cầu con người thông qua trao đổi mua bán.
   - **Gợi ý 2 (Giai đoạn 2):** Có hai thuộc tính là giá trị và giá trị sử dụng.
2. **Từ khóa:** GIATRI (6 chữ cái)
   - **Gợi ý 1:** Lao động xã hội của người sản xuất kết tinh trong sản phẩm.
   - **Gợi ý 2:** Bị thay đổi tỷ lệ nghịch khi năng suất lao động tăng.
3. **Từ khóa:** TRUUTUONG (9 chữ cái)
   - **Gợi ý 1:** Loại lao động tạo ra giá trị để đem bán.
   - **Gợi ý 2:** Đối lập với lao động cụ thể.
4. **Từ khóa:** CATTRU (6 chữ cái)
   - **Gợi ý 1:** Chức năng của tiền khi được rút khỏi lưu thông.
   - **Gợi ý 2:** Thường sử dụng vàng, bạc để thực hiện chức năng này lâu dài.

## 3. Chỉ thị thực thi
Hãy mở file `game_data.py`, khai báo toàn bộ các cấu trúc dữ liệu trên. Đảm bảo cấu trúc code sạch, sử dụng Type Hinting (ví dụ: `List[Dict[str, str]]`) để tối ưu hóa việc Server (FastAPI) đọc và gửi các chuỗi JSON này qua WebSocket cho từng Client tham gia phòng thi đấu.