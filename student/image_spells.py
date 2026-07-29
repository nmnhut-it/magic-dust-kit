# ============================================================================
#  BÀI TẬP 2 — BA PHÉP XỬ LÝ ẢNH, CHẠY TRÊN CHÍNH KHUÔN MẶT BẠN
#  Ở đảo Gương Vô Cực bạn viết flip và blend trên lưới 8×8, đủ nhỏ để nhìn
#  từng con số. Vẫn đúng phép tính đó, giờ máy gọi lại nhiều lần mỗi giây
#  trên hình từ camera.
# ============================================================================
#
# KHUNG HÌNH Ở ĐÂY LÀ GÌ
# Máy đưa cho bạn một danh sách số rất dài tên là `px`. Mỗi ô ảnh chiếm 4 số
# liền nhau:
#
#     px[o]     đỏ          px[o + 1] xanh lá
#     px[o + 2] xanh dương   px[o + 3] độ đục (cứ để 255)
#
# Ô ở hàng `row`, cột `col` bắt đầu tại:
#
#     o = (row * width + col) * 4
#
# Giống hệt image[row][col] bên đảo, chỉ là ba kênh màu nằm duỗi thẳng ra cho
# máy chạy kịp. Số vẫn chỉ từ 0 tới 255: cộng quá thì kẹp bằng min(255, ...),
# trừ quá thì kẹp bằng max(0, ...).
#
# Bạn ghi kết quả vào `out` — một danh sách khác, cùng độ dài. Đừng ghi đè lên
# `px`: nửa ảnh sau sẽ đọc nhầm phần vừa bị bạn sửa.
#
# CÁCH THỬ: mở trang, bấm phím
#     F lật · B làm mờ · N ghép hai lớp · X tắt · T tự chấm · R nạp lại file
# ---------------------------------------------------------------------------


# ── LẬT NGANG ───────────────────────────────────────────────────────────────
# Bên đảo bạn viết:  flipped[row][col] = image[row][last - col]
# Ở đây: ô cột `col` lấy màu của ô cột `width - 1 - col` trong CÙNG hàng.
def flip(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            # lượt của bạn: tính chỗ lấy màu rồi chép đủ ba kênh sang out
            out[o] = px[o]
            out[o + 1] = px[o + 1]
            out[o + 2] = px[o + 2]


# ── LÀM MỜ ──────────────────────────────────────────────────────────────────
# Mỗi ô lấy màu TRUNG BÌNH của chính nó và các ô hàng xóm sát bên. Ô nằm sát
# mép thì bỏ qua hàng xóm rơi ra ngoài ảnh, và chia cho đúng số ô đã cộng
# được — chia cứng cho 9 sẽ làm viền ảnh tối đi.
def blur(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            # lượt của bạn: cộng màu 9 ô quanh đây rồi chia trung bình
            out[o] = px[o]
            out[o + 1] = px[o + 1]
            out[o + 2] = px[o + 2]


# ── GHÉP HAI LỚP ────────────────────────────────────────────────────────────
# `layer` là lớp hiệu ứng quay trên nền đen, cùng kích thước khung hình.
# Bên đảo bạn viết:  min(255, base + layer) cho từng kênh màu.
# Ô đen của lớp hiệu ứng cộng vào 0 nên nền giữ nguyên; ô sáng đẩy nền lên.
def blend(px, layer, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn: cộng px[i] với layer[i] rồi kẹp bằng min(255, ...)
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]


# ============================================================================
#  NGƯỜI CHẤM BÀI — bấm phím T. Đừng sửa phần dưới đây.
#  Nó dựng một ảnh tí hon rồi kiểm ba hàm trên, và nói bạn sai ở đâu.
# ============================================================================

def _anh(width, height, mau):
    px = []
    for row in range(height):
        for col in range(width):
            px += mau(row, col) + [255]
    return px


def kiem_tra():
    ket_qua = []

    px = _anh(3, 2, lambda r, c: [c * 10, r, 7])
    out = [255] * len(px)
    flip(px, out, 3, 2)
    mong_doi = _anh(3, 2, lambda r, c: [(2 - c) * 10, r, 7])
    ket_qua.append("✓ flip" if out == mong_doi
                   else "✖ flip: ô cột col phải lấy màu của cột width - 1 - col")

    px = _anh(3, 3, lambda r, c: [255, 255, 255] if (r == 1 and c == 1) else [0, 0, 0])
    out = [255] * len(px)
    blur(px, out, 3, 3)
    giua = out[(1 * 3 + 1) * 4]
    goc = out[0]
    if giua >= 250:
        ket_qua.append("✖ blur: ô giữa vẫn trắng nguyên — chưa lấy trung bình với hàng xóm")
    elif goc == 0:
        ket_qua.append("✖ blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm")
    else:
        ket_qua.append("✓ blur")

    px = _anh(2, 1, lambda r, c: [200, 10, 0])
    layer = _anh(2, 1, lambda r, c: [0, 0, 0] if c == 0 else [100, 100, 100])
    out = [255] * len(px)
    blend(px, layer, out, 2, 1)
    if out[0] != 200 or out[1] != 10:
        ket_qua.append("✖ blend: ô đen của lớp hiệu ứng phải giữ nguyên nền")
    elif out[4] != 255:
        ket_qua.append("✖ blend: ô sáng phải cộng vào nền rồi kẹp ở 255")
    else:
        ket_qua.append("✓ blend")

    return "\n".join(ket_qua)
