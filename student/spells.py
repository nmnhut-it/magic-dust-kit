import asyncio
from magic_stage import play_effect, say, add_button, fingers_now, set_background, set_behind, set_front, heard_word, run_loop

# Máy gọi setup() một lần sau khi nạp mã của bạn.
#     add_button("Rồng Lửa", "dragon")   -> mọc một nút, bấm là ra rồng
#
# Tên phép dùng được: dragon · koto · rose · phoenix · butterfly · sakura
#                     smoke · rain · flower · magic · lightning
# và cả hiệu ứng video bạn tự bỏ vào ở sân khấu.
def setup():
    # lượt của bạn: gọi add_button(...) cho mấy phép bạn thích
    pass


# Máy gọi stage() một lần khi sân khấu mở.
#
#     set_background("rung")        nền phía sau bạn
#         chọn: rung · cong_kotopia · hai_dang
#     set_behind("rain")            hiệu ứng bay SAU LƯNG bạn
#     set_front("dragon")           hiệu ứng phủ TRƯỚC MẶT bạn
#         chọn: dragon · phoenix · sakura · rain
#         (và cả video bạn tự bỏ vào ở sân khấu)
#     add_button("Rồng Lửa", "dragon")   thêm một nút bấm
#
# Không có đáp án đúng. Dựng cái bạn thấy đã mắt nhất.
def stage():
    # lượt của bạn
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


# word là chuỗi, so sánh bằng dấu nháy: word == "rồng"
# fingers_now() là số ngón tay đang giơ NGAY LÚC NÀY.
#
# Nối hai điều kiện bằng and — cả hai đúng thì mới chạy:
#     if fingers_now() == 1 and (word == "rồng" or word == "dragon"):
#
# Dấu ngoặc quanh phần or là bắt buộc, nếu không Python hiểu sai thứ tự.
# Nhánh cuối nên nhắc bạn đang thiếu gì: đúng lời mà sai tay thì nói ra.
def on_voice(word):
    say("nghe được: " + word)
    # lượt của bạn: viết if / elif / else, mỗi nhánh kết hợp tay AND lời


# while True là vòng lặp THẬT — chạy mãi. await asyncio.sleep(...) ở cuối mỗi
# vòng là BẮT BUỘC: nó nhường lại một nhịp cho trình duyệt, thiếu dòng đó thì
# máy treo cứng (Python độc chiếm luồng chính, không ai vẽ hình được nữa).
async def main_loop():
    while True:
        count = fingers_now()
        word = heard_word()
        # lượt của bạn: if/elif gọi play_effect(...) theo count/word
        await asyncio.sleep(0.15)   # BẮT BUỘC — xoá dòng này là treo máy

run_loop(main_loop)
