# ============================================================================
#  BÀI TẬP 1 — BỘ CHỌN THẦN CHÚ VÀ BẢNG NÚT CỦA BẠN
#  Cùng đề bài với trang làm bài. Sửa xong lưu file rồi bấm R ở sân khấu.
# ============================================================================

from magic_stage import play_effect, say, add_button

# Máy gọi setup() một lần sau khi nạp mã của bạn.
#     add_button("Rồng Lửa", "dragon")   -> mọc một nút, bấm là ra rồng

# Máy gọi setup() một lần sau khi nạp mã của bạn.
#     add_button("Rồng Lửa", "dragon")   -> mọc một nút, bấm là ra rồng
#
# Tên phép dùng được: dragon · koto · rose · phoenix · butterfly · sakura
#                     smoke · rain · flower · magic · lightning
# và cả hiệu ứng video bạn tự bỏ vào ở sân khấu.
def setup():
    # lượt của bạn: gọi add_button(...) cho mấy phép bạn thích
    pass


# Hai lệnh bạn gọi được:
#     play_effect("dragon")   mở một lớp hiệu ứng lên khung hình
#     say("chữ gì đó")        hiện một dòng chữ
#
# Tên hiệu ứng có sẵn: dragon · koto · rose · phoenix · butterfly · sakura
#                      smoke · rain · flower · magic · lightning
#
# else phải nằm CUỐI CÙNG, vì nó là nhánh "không khớp cái nào ở trên".
def on_fingers(count):
    say("thấy " + str(count) + " ngón tay")
    # lượt của bạn: thay dòng trên bằng if / elif / else gọi play_effect(...)


# word là chuỗi, nên so sánh bằng dấu nháy: word == "rồng"
# Dấu tiếng Việt tính là khác nhau: "rong" KHÔNG khớp "rồng".
# Muốn một nhánh nhận nhiều từ thì nối bằng or.
#
# Nhánh cuối nên đọc lại từ vừa nghe — đó là cách bạn biết micro nghe ra gì.
def on_voice(word):
    say("nghe được: " + word)
    # lượt của bạn: viết if / elif / else ở đây
