# ============================================================================
#  BÀI TẬP 1 — BỘ CHỌN THẦN CHÚ
#  File này là Python thật, chạy thật, ngay trong trang đang mở camera của bạn.
#  Sửa file, lưu lại, quay ra trang web bấm phím  R  là nạp lại — không cần
#  tải lại trang, không cần cài gì thêm.
# ============================================================================
#
# Gương cho bạn hai lệnh:
#
#     play_effect("dragon")   mở một lớp hiệu ứng quay sẵn lên khung hình
#     say("chữ gì đó")        hiện một dòng chữ ở góc màn hình
#
# Tên hiệu ứng dùng được:
#     dragon · koto · rose · phoenix · butterfly · sakura · smoke · rain
#     flower · magic · lightning
#
# ---------------------------------------------------------------------------

from magic_stage import play_effect, say


# ── GIƠ MẤY NGÓN TAY THÌ RA PHÉP GÌ ─────────────────────────────────────────
# Máy đếm số ngón tay bạn giơ lên camera rồi gọi hàm này, đưa vào số đó.
# Hãy viết chuỗi if / elif / else để mỗi số ngón tay gọi một hiệu ứng khác nhau.
#
# ĐỀ BÀI: sửa hàm dưới đây để
#     1 ngón  -> dragon
#     2 ngón  -> phoenix
#     3 ngón  -> sakura
#     còn lại -> nói "chưa gán phép cho số này"
def on_fingers(count):
    say("thấy " + str(count) + " ngón tay")
    # lượt của bạn: thay dòng trên bằng if / elif / else gọi play_effect(...)


# ── NÓI GÌ THÌ RA PHÉP GÌ ───────────────────────────────────────────────────
# Khi micro nghe được một từ, máy gọi hàm này và đưa vào từ đó (chữ thường).
# Hãy làm giống hệt bên trên, nhưng so sánh chuỗi thay vì số.
#
# ĐỀ BÀI:
#     "rồng" hoặc "dragon"  -> dragon
#     "hoa"  hoặc "sakura"  -> sakura
#     "mưa"  hoặc "rain"    -> rain
#     còn lại -> nói lại đúng từ vừa nghe, để bạn biết máy nghe ra gì
def on_voice(word):
    say("nghe được: " + word)
    # lượt của bạn: viết if / elif / else ở đây


# ============================================================================
#  Ghi chú nhỏ: hai hàm trên KHÔNG cần return gì cả. Chúng chỉ ra lệnh.
#  Sai cú pháp thì màn hình hiện đúng dòng báo lỗi Python và số dòng — đọc
#  dòng đó trước khi hỏi ai.
# ============================================================================
