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
#  BÀI THÊM — bốn phép nữa, làm được thì làm, không bắt buộc.
#  Cả bốn đều ngắn hơn `blur`. Máy vẫn chấm chúng bằng phím T.
# ============================================================================


# ── ÂM BẢN ─────────────────── phím A ───────────────────────────────────────
# Sáng thành tối, tối thành sáng: mỗi kênh màu lấy 255 trừ đi giá trị cũ.
def negative(px, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]


# ── ĐEN TRẮNG ──────────────── phím W ───────────────────────────────────────
# Một ô ảnh màu có ba con số khác nhau. Ảnh đen trắng thì cả ba PHẢI bằng
# nhau — lấy trung bình cộng của chúng rồi ghi cùng con số đó vào cả ba kênh.
def grayscale(px, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]


# ── LẬT DỌC ────────────────── phím V ───────────────────────────────────────
# Giống `flip` nhưng lộn đầu xuống chân: ô ở hàng `row` lấy màu của ô hàng
# `height - 1 - row`, cùng cột.
def flip_vertical(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            # lượt của bạn
            out[o] = px[o]
            out[o + 1] = px[o + 1]
            out[o + 2] = px[o + 2]


# ── TẮT MỘT KÊNH MÀU ───────── phím C ───────────────────────────────────────
# Giữ nguyên đỏ và xanh lá, cho kênh xanh dương bằng 0. Thế giới sẽ ngả vàng
# cam — đó là cách nhanh nhất để thấy ba con số kia thật sự là ba màu riêng.
def drop_blue(px, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]


# ============================================================================
#  NGƯỜI CHẤM BÀI — bấm phím T. Đừng sửa phần dưới đây.
#  Nó dựng mấy ảnh tí hon rồi kiểm từng hàm trên, và nói bạn sai ở đâu.
# ============================================================================

def _solid(width, height, red, green, blue):
    """Ảnh mà mọi ô đều cùng một màu."""
    px = []
    for _ in range(width * height):
        px.append(red)
        px.append(green)
        px.append(blue)
        px.append(255)
    return px


def _column_stripes(width, height, step):
    """Mỗi cột một sắc đỏ khác nhau, để nhìn ra ảnh có bị lật ngang không."""
    px = []
    for row in range(height):
        for col in range(width):
            px.append(col * step)
            px.append(row)
            px.append(7)
            px.append(255)
    return px


def _row_stripes(width, height, step):
    """Mỗi hàng một sắc đỏ khác nhau, để nhìn ra ảnh có bị lật dọc không."""
    px = []
    for row in range(height):
        for col in range(width):
            px.append(row * step)
            px.append(col)
            px.append(7)
            px.append(255)
    return px


def _white_dot(side):
    """Ảnh đen với đúng một ô trắng ở giữa — để thấy blur có lan sáng không."""
    px = []
    middle = side // 2
    for row in range(side):
        for col in range(side):
            if row == middle and col == middle:
                light = 255
            else:
                light = 0
            px.append(light)
            px.append(light)
            px.append(light)
            px.append(255)
    return px


def check_all():
    report = []

    px = _column_stripes(3, 2, 10)
    out = [255] * len(px)
    flip(px, out, 3, 2)
    expected = []
    for row in range(2):
        for col in range(3):
            expected.append((2 - col) * 10)
            expected.append(row)
            expected.append(7)
            expected.append(255)
    if out == expected:
        report.append("✓ flip")
    else:
        report.append("✖ flip: ô cột col phải lấy màu của cột width - 1 - col")

    px = _white_dot(3)
    out = [255] * len(px)
    blur(px, out, 3, 3)
    middle = out[(1 * 3 + 1) * 4]
    corner = out[0]
    if middle >= 250:
        report.append("✖ blur: ô giữa vẫn trắng nguyên — chưa lấy trung bình với hàng xóm")
    elif corner == 0:
        report.append("✖ blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm")
    else:
        report.append("✓ blur")

    px = _solid(2, 1, 200, 10, 0)
    layer = [0, 0, 0, 255, 100, 100, 100, 255]      # ô đầu đen, ô sau xám sáng
    out = [255] * len(px)
    blend(px, layer, out, 2, 1)
    if out[0] != 200 or out[1] != 10:
        report.append("✖ blend: ô đen của lớp hiệu ứng phải giữ nguyên nền")
    elif out[4] != 255:
        report.append("✖ blend: ô sáng phải cộng vào nền rồi kẹp ở 255")
    else:
        report.append("✓ blend")

    report.append("— bài thêm —")

    px = _solid(2, 1, 0, 100, 255)
    out = [255] * len(px)
    negative(px, out, 2, 1)
    if out[0:3] == [255, 155, 0]:
        report.append("✓ negative")
    else:
        report.append("✖ negative: mỗi kênh phải là 255 trừ đi giá trị cũ")

    px = _solid(2, 1, 30, 60, 90)
    out = [255] * len(px)
    grayscale(px, out, 2, 1)
    if out[0] == out[1] == out[2] == 60:
        report.append("✓ grayscale")
    elif out[0] == out[1] == out[2]:
        report.append("✖ grayscale: ba kênh đã bằng nhau nhưng chưa phải trung bình cộng")
    else:
        report.append("✖ grayscale: ảnh đen trắng thì ba kênh màu phải bằng nhau")

    px = _row_stripes(2, 3, 40)
    out = [255] * len(px)
    flip_vertical(px, out, 2, 3)
    expected = []
    for row in range(3):
        for col in range(2):
            expected.append((2 - row) * 40)
            expected.append(col)
            expected.append(7)
            expected.append(255)
    if out == expected:
        report.append("✓ flip_vertical")
    else:
        report.append("✖ flip_vertical: ô hàng row phải lấy màu của hàng height - 1 - row")

    px = _solid(2, 1, 200, 150, 100)
    out = [255] * len(px)
    drop_blue(px, out, 2, 1)
    if out[0:3] == [200, 150, 0]:
        report.append("✓ drop_blue")
    else:
        report.append("✖ drop_blue: giữ nguyên đỏ và xanh lá, chỉ kênh xanh dương bằng 0")

    return "\n".join(report)
