# ============================================================================
#  BỘ CHẤM — file của máy, học sinh không phải đọc.
#  Một nguồn duy nhất cho ba chỗ chấm bài:
#     · trang làm bài  (bai.html chấm từng hàm một)
#     · đồ chơi        (phím T chấm cả bài)
#     · dòng lệnh      (cham.py, và serve.py gọi lúc khởi động)
#  Nhờ vậy không có chuyện chỗ này báo đạt còn chỗ kia báo sai.
# ============================================================================

TASKS = ("flip", "blur", "blend", "negative", "grayscale", "flip_vertical", "drop_blue")
EXTRA_TASKS = ("negative", "grayscale", "flip_vertical", "drop_blue")


def solid(width, height, red, green, blue):
    """Ảnh mà mọi ô đều cùng một màu."""
    px = []
    for _ in range(width * height):
        px.append(red)
        px.append(green)
        px.append(blue)
        px.append(255)
    return px


def column_stripes(width, height, step):
    """Mỗi cột một sắc đỏ khác nhau — để thấy ảnh có bị lật ngang không."""
    px = []
    for row in range(height):
        for col in range(width):
            px.append(col * step)
            px.append(row)
            px.append(7)
            px.append(255)
    return px


def row_stripes(width, height, step):
    """Mỗi hàng một sắc đỏ khác nhau — để thấy ảnh có bị lật dọc không."""
    px = []
    for row in range(height):
        for col in range(width):
            px.append(row * step)
            px.append(col)
            px.append(7)
            px.append(255)
    return px


def white_dot(side):
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


def _check_flip(fn):
    px = column_stripes(3, 2, 10)
    out = [255] * len(px)
    fn(px, out, 3, 2)
    expected = []
    for row in range(2):
        for col in range(3):
            expected.append((2 - col) * 10)
            expected.append(row)
            expected.append(7)
            expected.append(255)
    if out == expected:
        return True, "flip"
    return False, "flip: ô cột col phải lấy màu của cột width - 1 - col"


def _check_blur(fn):
    px = white_dot(3)
    out = [255] * len(px)
    fn(px, out, 3, 3)
    middle = out[(1 * 3 + 1) * 4]
    corner = out[0]
    if middle >= 250:
        return False, "blur: ô giữa vẫn trắng nguyên — chưa lấy trung bình với hàng xóm"
    if corner == 0:
        return False, "blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm"
    flat = solid(3, 3, 90, 90, 90)
    out = [255] * len(flat)
    fn(flat, out, 3, 3)
    if out[0] != 90:
        return False, "blur: ảnh phẳng phải giữ nguyên — ô sát mép chia cho số hàng xóm thật, không chia cứng cho 9"
    return True, "blur"


def _check_blend(fn):
    px = solid(2, 1, 200, 10, 0)
    layer = [0, 0, 0, 255, 100, 100, 100, 255]      # ô đầu đen, ô sau xám sáng
    out = [255] * len(px)
    fn(px, layer, out, 2, 1)
    if out[0] != 200 or out[1] != 10:
        return False, "blend: ô đen của lớp hiệu ứng phải giữ nguyên nền"
    if out[4] != 255:
        return False, "blend: ô sáng phải cộng vào nền rồi kẹp ở 255"
    return True, "blend"


def _check_negative(fn):
    px = solid(2, 1, 0, 100, 255)
    out = [255] * len(px)
    fn(px, out, 2, 1)
    if out[0:3] == [255, 155, 0]:
        return True, "negative"
    return False, "negative: mỗi kênh phải là 255 trừ đi giá trị cũ"


def _check_grayscale(fn):
    px = solid(2, 1, 30, 60, 90)
    out = [255] * len(px)
    fn(px, out, 2, 1)
    if out[0] == out[1] == out[2] == 60:
        return True, "grayscale"
    if out[0] == out[1] == out[2]:
        return False, "grayscale: ba kênh đã bằng nhau nhưng chưa phải trung bình cộng"
    return False, "grayscale: ảnh đen trắng thì ba kênh màu phải bằng nhau"


def _check_flip_vertical(fn):
    px = row_stripes(2, 3, 40)
    out = [255] * len(px)
    fn(px, out, 2, 3)
    expected = []
    for row in range(3):
        for col in range(2):
            expected.append((2 - row) * 40)
            expected.append(col)
            expected.append(7)
            expected.append(255)
    if out == expected:
        return True, "flip_vertical"
    return False, "flip_vertical: ô hàng row phải lấy màu của hàng height - 1 - row"


def _check_drop_blue(fn):
    px = solid(2, 1, 200, 150, 100)
    out = [255] * len(px)
    fn(px, out, 2, 1)
    if out[0:3] == [200, 150, 0]:
        return True, "drop_blue"
    return False, "drop_blue: giữ nguyên đỏ và xanh lá, chỉ kênh xanh dương bằng 0"


CHECKERS = {
    "flip": _check_flip,
    "blur": _check_blur,
    "blend": _check_blend,
    "negative": _check_negative,
    "grayscale": _check_grayscale,
    "flip_vertical": _check_flip_vertical,
    "drop_blue": _check_drop_blue,
}


def check_one(name, namespace=None):
    """Chấm đúng một hàm. Trả về (đạt hay chưa, câu giải thích)."""
    if namespace is None:
        namespace = globals()
    fn = namespace.get(name)
    if fn is None:
        return False, f"{name}: chưa thấy hàm này — bạn đã đổi tên nó à?"
    try:
        return CHECKERS[name](fn)
    except Exception as err:
        return False, f"{name}: chạy tới đâu thì văng lỗi tới đó — {type(err).__name__}: {err}"


def check_all(namespace=None):
    """Chấm cả bài, trả về một chuỗi nhiều dòng để hiện thẳng lên màn hình."""
    if namespace is None:
        namespace = globals()
    lines = []
    for name in TASKS:
        if name == EXTRA_TASKS[0]:
            lines.append("— bài thêm —")
        passed, message = check_one(name, namespace)
        if passed:
            lines.append("✓ " + message)
        else:
            lines.append("✖ " + message)
    return "\n".join(lines)
