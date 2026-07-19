"""
game_data.py
Ngân hàng câu hỏi cho game "Vua Tiếng Việt" - Chủ đề Kinh tế chính trị
Dữ liệu được tổ chức theo 3 vòng thi.
"""

from typing import List, Dict

# =============================================================================
# VÒNG 1: PHẢN XẠ
# Luật: Mỗi người chơi có 90 giây để trả lời tối đa 14 câu hỏi độc lập.
# Đúng +1 điểm. Có quyền bỏ qua (không quay lại).
# Server sẽ random 14 câu từ danh sách 30 câu này mỗi ván chơi.
# =============================================================================
round_1_questions: List[Dict[str, str]] = [
    # --- Lượng giá trị ---
    {
        "question": "Thước đo lượng giá trị của hàng hóa được tính bằng gì?",
        "answer": "Thời gian lao động"
    },
    {
        "question": "Thời gian lao động nào quyết định giá trị xã hội của hàng hóa trên thị trường?",
        "answer": "Thời gian lao động xã hội cần thiết"
    },
    {
        "question": "Lượng giá trị của một đơn vị hàng hóa tỷ lệ nghịch với nhân tố nào?",
        "answer": "Năng suất lao động"
    },
    {
        "question": "Tăng cường độ lao động có làm thay đổi lượng giá trị của một đơn vị hàng hóa không?",
        "answer": "Không"
    },
    {
        "question": "Lao động phức tạp là lao động giản đơn được làm sao?",
        "answer": "Nhân lên"
    },
    {
        "question": "Năng suất lao động tăng thì lượng giá trị của một đơn vị hàng hóa sẽ như thế nào?",
        "answer": "Giảm"
    },
    {
        "question": "Thời gian lao động cá biệt quyết định điều gì của hàng hóa?",
        "answer": "Giá trị cá biệt"
    },
    {
        "question": "Cường độ lao động tăng thì tổng lượng hàng hóa sản xuất ra sẽ như thế nào?",
        "answer": "Tăng"
    },
    # --- Tính hai mặt của lao động ---
    {
        "question": "Thuộc tính nào của hàng hóa do thuộc tính tự nhiên quyết định?",
        "answer": "Giá trị sử dụng"
    },
    {
        "question": "Lao động xã hội của người sản xuất kết tinh trong hàng hóa gọi là gì?",
        "answer": "Giá trị"
    },
    {
        "question": "Lao động có ích dưới một hình thức cụ thể của một nghề nghiệp nhất định gọi là gì?",
        "answer": "Lao động cụ thể"
    },
    {
        "question": "Lao động cụ thể tạo ra thuộc tính nào của hàng hóa?",
        "answer": "Giá trị sử dụng"
    },
    {
        "question": "Sự tiêu hao sức lao động nói chung gạt bỏ hình thức cụ thể gọi là gì?",
        "answer": "Lao động trừu tượng"
    },
    {
        "question": "Lao động trừu tượng tạo ra thuộc tính nào của hàng hóa?",
        "answer": "Giá trị"
    },
    {
        "question": "Mâu thuẫn cơ bản của sản xuất hàng hóa là sự đối lập giữa lao động xã hội và lao động gì?",
        "answer": "Lao động tư nhân"
    },
    {
        "question": "Mỗi hàng hóa có bao nhiêu thuộc tính?",
        "answer": "Hai"
    },
    {
        "question": "Hàng hóa là gì theo định nghĩa của C. Mác?",
        "answer": "Sản phẩm của lao động thỏa mãn nhu cầu qua trao đổi mua bán"
    },
    {
        "question": "Giá trị sử dụng của hàng hóa phụ thuộc vào điều gì?",
        "answer": "Thuộc tính tự nhiên (lý hóa sinh)"
    },
    # --- Chức năng tiền tệ ---
    {
        "question": "Tiền dùng để biểu thị giá trị của hàng hóa khác là đang thực hiện chức năng gì?",
        "answer": "Thước đo giá trị"
    },
    {
        "question": "Giữ vàng bạc lại thay vì tiêu dùng để mua sắm trong tương lai là chức năng gì của tiền?",
        "answer": "Phương tiện cất trữ"
    },
    {
        "question": "Mua hàng trước, trả tiền sau bằng thẻ tín dụng là tiền đang thực hiện chức năng gì?",
        "answer": "Phương tiện thanh toán"
    },
    {
        "question": "Tiền đóng vai trò môi giới trong công thức Hàng - Tiền - Hàng là chức năng gì?",
        "answer": "Phương tiện lưu thông"
    },
    {
        "question": "Khi nào tiền thực hiện chức năng tiền tệ thế giới?",
        "answer": "Khi mua bán hàng hóa vượt biên giới quốc gia"
    },
    {
        "question": "Tiền tệ xuất phát từ đâu trong lịch sử?",
        "answer": "Từ trao đổi hàng hóa"
    },
    # --- Sản xuất hàng hóa ---
    {
        "question": "Điều kiện đầu tiên để sản xuất hàng hóa ra đời là gì?",
        "answer": "Phân công lao động xã hội"
    },
    {
        "question": "Điều kiện thứ hai để sản xuất hàng hóa ra đời là gì?",
        "answer": "Sự tách biệt tương đối về kinh tế giữa những người sản xuất"
    },
    {
        "question": "Hàng hóa vô hình là loại hàng hóa nào?",
        "answer": "Dịch vụ"
    },
    {
        "question": "Phân công lao động xã hội là cơ sở của điều gì?",
        "answer": "Sản xuất hàng hóa (và trao đổi)"
    },
    {
        "question": "Giá cả hàng hóa là biểu hiện bằng tiền của cái gì?",
        "answer": "Giá trị"
    },
    {
        "question": "Lao động nào tạo ra giá trị sử dụng nhưng không trực tiếp tạo ra giá trị trao đổi?",
        "answer": "Lao động cụ thể"
    },
]


# =============================================================================
# VÒNG 2: XÂU CHUỖI
# Luật: 9 câu từ ghép bị đảo lộn, 30 giây/câu. Cơ chế Buzzer.
# Đúng +1 điểm. Người đạt 5 điểm trước hoặc cao điểm nhất sau 9 câu thắng.
# Server sẽ random 9 câu từ danh sách 20 câu này mỗi ván chơi.
# Frontend sẽ tự động split theo " " (khoảng trắng) và shuffle.
# =============================================================================
round_2_questions: List[Dict[str, str]] = [
    {"original": "Lượng giá trị của hàng hóa"},
    {"original": "Thời gian lao động cá biệt"},
    {"original": "Tính chất hai mặt của lao động"},
    {"original": "Lao động trừu tượng tạo ra giá trị"},
    {"original": "Phương tiện lưu thông tiền tệ"},
    {"original": "Tiêu dùng mang tính chất xã hội"},
    {"original": "Năng suất lao động tăng lên"},
    {"original": "Thuộc tính tự nhiên quyết định"},
    {"original": "Phân công lao động xã hội"},
    {"original": "Giá trị sử dụng của hàng hóa"},
    {"original": "Thời gian lao động xã hội cần thiết"},
    {"original": "Hàng hóa có hai thuộc tính"},
    {"original": "Lao động cụ thể tạo ra giá trị sử dụng"},
    {"original": "Cường độ lao động tăng"},
    {"original": "Mâu thuẫn của sản xuất hàng hóa"},
    {"original": "Tiền tệ thực hiện chức năng"},
    {"original": "Phương tiện cất trữ giá trị"},
    {"original": "Điều kiện trao đổi hàng hóa"},
    {"original": "Sản phẩm của lao động xã hội"},
    {"original": "Bản chất của giá trị hàng hóa"},
]


# =============================================================================
# VÒNG ĐẶC BIỆT: SOÁN NGÔI
# Luật: Giải ô chữ với từ khóa. Giai đoạn 1 (15s) nhận 100%, Giai đoạn 2 (15s) nhận 50%.
# =============================================================================
special_round_questions: List[Dict[str, str]] = [
    {
        "keyword": "HANGHOA",
        "display": "H À N G H Ó A",
        "length": 7,
        "clue_1": "Sản phẩm của lao động, thỏa mãn nhu cầu con người thông qua trao đổi mua bán.",
        "clue_2": "Có hai thuộc tính là giá trị và giá trị sử dụng.",
    },
    {
        "keyword": "GIATRI",
        "display": "G I Á T R Ị",
        "length": 6,
        "clue_1": "Lao động xã hội của người sản xuất kết tinh trong sản phẩm.",
        "clue_2": "Bị thay đổi tỷ lệ nghịch khi năng suất lao động tăng.",
    },
    {
        "keyword": "TRUUTUTUONG",
        "display": "T R Ừ U T Ư Ợ N G",
        "length": 9,
        "clue_1": "Loại lao động tạo ra giá trị để đem bán.",
        "clue_2": "Đối lập với lao động cụ thể; là sự tiêu hao sức lao động nói chung.",
    },
    {
        "keyword": "CATTRU",
        "display": "C Ấ T T R Ữ",
        "length": 6,
        "clue_1": "Chức năng của tiền khi được rút khỏi lưu thông.",
        "clue_2": "Thường sử dụng vàng, bạc để thực hiện chức năng này lâu dài.",
    },
]
