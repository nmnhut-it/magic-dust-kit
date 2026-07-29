# ============================================================================
#  BỘ CHẤM — file của máy, học sinh không phải đọc.
#  Một nguồn duy nhất cho ba chỗ chấm bài:
#     · trang làm bài  (index.html chấm từng hàm một)
#     · sân khấu       (phím T chấm cả bài)
#     · dòng lệnh      (cham.py, và serve.py gọi lúc khởi động)
#  Nhờ vậy không có chuyện chỗ này báo đạt còn chỗ kia báo sai.
#
#  ẢNH Ở ĐÂY LÀ MẢNG HAI CHIỀU, giống hệt bên đảo Gương Vô Cực:
#     image[row][col] -> [đỏ, xanh lá, xanh dương]
#  (Bản cũ duỗi thẳng thành một danh sách dài và bắt học sinh tự tính
#   (row * width + col) * 4 — khó hiểu quá nên đã bỏ.)
# ============================================================================

import traceback

TASKS = ("flip", "blur", "blend", "blend_alpha", "compose", "blur_background", "scene",
         "negative", "grayscale", "flip_vertical", "drop_blue")
EXTRA_TASKS = ("negative", "grayscale", "flip_vertical", "drop_blue")


def solid(width, height, red, green, blue):
    """Ảnh mà mọi ô đều cùng một màu."""
    image = []
    for _ in range(height):
        row = []
        for _ in range(width):
            row.append([red, green, blue])
        image.append(row)
    return image


def blank(width, height):
    """Ảnh trống để học sinh ghi kết quả vào."""
    return solid(width, height, 0, 0, 0)


def column_stripes(width, height, step):
    """Mỗi cột một sắc đỏ khác nhau — để thấy ảnh có bị lật ngang không."""
    image = []
    for row in range(height):
        line = []
        for col in range(width):
            line.append([col * step, row, 7])
        image.append(line)
    return image


def row_stripes(width, height, step):
    """Mỗi hàng một sắc đỏ khác nhau — để thấy ảnh có bị lật dọc không."""
    image = []
    for row in range(height):
        line = []
        for col in range(width):
            line.append([row * step, col, 7])
        image.append(line)
    return image


def white_dot(side):
    """Ảnh đen với đúng một ô trắng ở giữa — để thấy blur có lan sáng không."""
    image = []
    middle = side // 2
    for row in range(side):
        line = []
        for col in range(side):
            if row == middle and col == middle:
                line.append([255, 255, 255])
            else:
                line.append([0, 0, 0])
        image.append(line)
    return image


def _check_flip(fn):
    image = column_stripes(3, 2, 10)
    out = blank(3, 2)
    fn(image, out, 3, 2)
    for row in range(2):
        for col in range(3):
            if list(out[row][col]) != [(2 - col) * 10, row, 7]:
                return False, "flip: ô cột col phải lấy màu của ô cột width - 1 - col"
    return True, "flip"


def _check_blur(fn):
    image = white_dot(3)
    out = blank(3, 3)
    fn(image, out, 3, 3)
    if out[1][1][0] >= 250:
        return False, "blur: ô giữa vẫn trắng nguyên — chưa lấy trung bình với hàng xóm"
    if out[0][0][0] == 0:
        return False, "blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm"
    flat = solid(3, 3, 90, 90, 90)
    out = blank(3, 3)
    fn(flat, out, 3, 3)
    if out[0][0][0] != 90:
        return False, ("blur: ảnh phẳng phải giữ nguyên — ô sát mép chia cho số hàng xóm"
                       " thật, không chia cứng cho 9")
    return True, "blur"


def _check_blend(fn):
    image = solid(2, 1, 200, 10, 0)
    layer = [[[0, 0, 0], [100, 100, 100]]]      # ô đầu đen, ô sau xám sáng
    out = blank(2, 1)
    fn(image, layer, out, 2, 1)
    if list(out[0][0]) != [200, 10, 0]:
        return False, "blend: ô đen của lớp hiệu ứng phải giữ nguyên nền"
    if out[0][1][0] != 255:
        return False, "blend: ô sáng phải cộng vào nền rồi kẹp ở 255"
    return True, "blend"


def _check_negative(fn):
    image = solid(2, 1, 0, 100, 255)
    out = blank(2, 1)
    fn(image, out, 2, 1)
    if list(out[0][0]) == [255, 155, 0]:
        return True, "negative"
    return False, "negative: mỗi kênh phải là 255 trừ đi giá trị cũ"


def _check_grayscale(fn):
    image = solid(2, 1, 30, 60, 90)
    out = blank(2, 1)
    fn(image, out, 2, 1)
    pixel = list(out[0][0])
    if pixel == [60, 60, 60]:
        return True, "grayscale"
    if pixel[0] == pixel[1] == pixel[2]:
        return False, "grayscale: ba kênh đã bằng nhau nhưng chưa phải trung bình cộng"
    return False, "grayscale: ảnh đen trắng thì ba kênh màu phải bằng nhau"


def _check_flip_vertical(fn):
    image = row_stripes(2, 3, 40)
    out = blank(2, 3)
    fn(image, out, 2, 3)
    for row in range(3):
        for col in range(2):
            if list(out[row][col]) != [(2 - row) * 40, col, 7]:
                return False, "flip_vertical: ô hàng row phải lấy màu của ô hàng height - 1 - row"
    return True, "flip_vertical"


def _check_drop_blue(fn):
    image = solid(2, 1, 200, 150, 100)
    out = blank(2, 1)
    fn(image, out, 2, 1)
    if list(out[0][0]) == [200, 150, 0]:
        return True, "drop_blue"
    return False, "drop_blue: giữ nguyên đỏ và xanh lá, chỉ kênh xanh dương bằng 0"


def _check_compose(fn):
    """Ghép ba lớp: nền, người, và mặt nạ nói ô nào là người."""
    person = solid(3, 1, 200, 40, 40)          # người: đỏ
    background = solid(3, 1, 20, 20, 120)      # nền: xanh dương tối
    mask = [[255, 0, 200]]                     # ô 0 chắc chắn người, ô 1 là nền, ô 2 vẫn là người
    out = blank(3, 1)
    fn(person, mask, background, out, 3, 1)
    if list(out[0][0]) != [200, 40, 40]:
        return False, "compose: ô có mặt nạ 255 phải lấy màu của NGƯỜI"
    if list(out[0][1]) != [20, 20, 120]:
        return False, "compose: ô có mặt nạ 0 phải lấy màu của NỀN"
    if list(out[0][2]) != [200, 40, 40]:
        return False, "compose: mặt nạ 200 vẫn tính là người — mốc chia là 128"
    return True, "compose"


def _check_scene(fn):
    """Bài cuối: nền + lớp sau + người + hiệu ứng trước, xếp đúng thứ tự.

    Dựng số sao cho mỗi bước sai một kiểu là kết quả lệch một kiểu, nhờ vậy
    câu báo lỗi chỉ được đúng chỗ hỏng.
    """
    person = solid(2, 1, 200, 0, 0)          # người: đỏ
    background = solid(2, 1, 10, 10, 10)     # nền: gần đen
    behind = solid(2, 1, 0, 40, 0)           # lớp sau: xanh lá nhạt
    front = solid(2, 1, 0, 0, 60)            # hiệu ứng trước: xanh dương nhạt
    mask = [[255, 0]]                        # ô đầu là người, ô sau là nền
    out = blank(2, 1)
    fn(person, mask, background, behind, front, out, 2, 1)

    # ô 0 (người): 200,0,0 rồi cộng front -> 200,0,60
    if list(out[0][0]) != [200, 0, 60]:
        if list(out[0][0]) == [200, 0, 0]:
            return False, "scene: chỗ có người phải được phủ thêm lớp front ở bước cuối"
        return False, "scene: ô có người phải lấy màu người rồi mới cộng front"
    # ô 1 (nền): nền 10,10,10 + behind 0,40,0 = 10,50,10, rồi + front -> 10,50,70
    if list(out[0][1]) != [10, 50, 70]:
        if list(out[0][1]) == [10, 10, 70]:
            return False, "scene: lớp behind chưa được cộng vào nền trước khi dán người"
        return False, "scene: ô không có người phải là nền + behind, rồi mới + front"
    return True, "scene"


def _check_blur_background(fn):
    """Nền mờ, người vẫn nét — đúng kiểu họp trực tuyến.

    Ảnh vào có một ô sáng chói giữa vùng tối. Ô đó nằm trong vùng NGƯỜI nên
    phải giữ nguyên; mấy ô nền quanh nó phải nhoè đi.
    """
    image = white_dot(3)
    mask = [[0, 0, 0], [0, 255, 0], [0, 0, 0]]     # chỉ ô giữa là người
    out = blank(3, 3)
    fn(image, mask, out, 3, 3)
    if out[1][1][0] != 255:
        return False, "blur_background: ô có người phải giữ NGUYÊN, không được làm mờ"
    if out[0][0][0] == 0:
        return False, "blur_background: ô nền phải là ảnh đã làm mờ (ánh sáng lan sang)"
    if out[0][0][0] == 255:
        return False, "blur_background: ô nền đang lấy ảnh gốc — bạn quên dùng bản đã mờ?"
    return True, "blur_background"


def _check_blend_alpha(fn):
    """Trộn hai ảnh theo tỉ lệ — đè ảnh thật sự, không phải cộng ánh sáng."""
    image = solid(2, 1, 200, 0, 0)        # nền: đỏ
    layer = solid(2, 1, 0, 0, 200)        # lớp trên: xanh dương
    out = blank(2, 1)
    fn(image, layer, 50, out, 2, 1)       # 50% -> nửa đỏ nửa xanh
    pixel = list(out[0][0])
    if pixel == [100, 0, 100]:
        pass
    elif pixel == [200, 0, 200]:
        return False, "blend_alpha: đang CỘNG hai màu; phải trộn theo tỉ lệ rồi chia 100"
    elif pixel == [0, 0, 200]:
        return False, "blend_alpha: đang lấy nguyên lớp trên, chưa pha với ảnh nền"
    elif pixel == [200, 0, 0]:
        return False, "blend_alpha: đang giữ nguyên ảnh nền, chưa pha lớp trên vào"
    else:
        return False, f"blend_alpha: với strength 50 thì ô phải là [100,0,100], đang ra {pixel}"

    out = blank(2, 1)
    fn(image, layer, 0, out, 2, 1)        # 0% -> y nguyên nền
    if list(out[0][0]) != [200, 0, 0]:
        return False, "blend_alpha: strength 0 nghĩa là không pha gì, phải ra đúng ảnh nền"
    out = blank(2, 1)
    fn(image, layer, 100, out, 2, 1)      # 100% -> chỉ còn lớp trên
    if list(out[0][0]) != [0, 0, 200]:
        return False, "blend_alpha: strength 100 nghĩa là che hẳn, phải ra đúng lớp trên"
    return True, "blend_alpha"


CHECKERS = {
    "flip": _check_flip,
    "blur": _check_blur,
    "blend": _check_blend,
    "blend_alpha": _check_blend_alpha,
    "compose": _check_compose,
    "blur_background": _check_blur_background,
    "scene": _check_scene,
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
        return False, f"{name}: {_where(err)}{type(err).__name__}: {err}"


def _where(err):
    """Chỉ đúng hàm và dòng làm vỡ chương trình.

    "chạy tới đâu thì văng lỗi tới đó" nghe thì hay nhưng học sinh không biết
    lỗi nằm ở hàm nào — nhất là mấy bài gọi lại hàm của bài trước.
    """
    frames = traceback.extract_tb(err.__traceback__)
    mine = []
    for frame in frames:
        if frame.name in ("check_one", "_where") or frame.name.startswith("_check"):
            continue
        mine.append(frame)
    if not mine:
        return ""
    last = mine[-1]
    line = last.line.strip() if last.line else ""
    place = f"vỡ trong hàm {last.name}()"
    if line:
        place += f", ở dòng: {line}"
    return place + " — "


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


# ── kể lại bài test cho học sinh xem ────────────────────────────────────────
# Không chỉ nói đúng/sai: chạy hàm trên một ảnh tí hon rồi đưa cả ba thứ ra
# màn hình — ảnh vào, kết quả mong đợi, kết quả của em. Học sinh nhìn số là
# hiểu mình lệch chỗ nào.

def _pixels(image):
    """Đọc ảnh nhỏ thành chuỗi kiểu '[10,0,7] [0,0,7]' cho dễ nhìn."""
    parts = []
    for row in image:
        cells = []
        for pixel in row:
            cells.append("[" + ",".join(str(int(v)) for v in pixel) + "]")
        parts.append(" ".join(cells))
    return " / ".join(parts)


def _run(fn, image, width, height, layer=None):
    out = blank(width, height)
    if layer is None:
        fn(image, out, width, height)
    elif isinstance(layer, list) and len(layer) == 2 and isinstance(layer[1], int):
        # blend_alpha: layer là [lớp trên, độ đậm]
        top, strength = layer
        fn(image, top, strength, out, width, height)
    elif isinstance(layer, list) and len(layer) == 2 and isinstance(layer[1][0], list):
        # compose: layer là [nền, mặt nạ]; mặt nạ là bảng SỐ chứ không phải bảng ô
        background, mask = layer
        fn(image, mask, background, out, width, height)
    else:
        fn(image, layer, out, width, height)
    return out


# Mỗi bài test: mô tả · dựng ảnh vào · dựng lớp hiệu ứng (nếu có) · cỡ ảnh ·
# dựng kết quả mong đợi. Viết bằng hàm thường, không lambda, không
# comprehension — vì học sinh có thể mở file này ra đọc.

def _case_flip():
    image = column_stripes(3, 2, 10)
    expected = []
    for row in range(2):
        line = []
        for col in range(3):
            line.append([(2 - col) * 10, row, 7])
        expected.append(line)
    return "ảnh 3 cột 2 hàng, mỗi cột một sắc đỏ", image, None, 3, 2, expected


def _case_flip_vertical():
    image = row_stripes(2, 3, 40)
    expected = []
    for row in range(3):
        line = []
        for col in range(2):
            line.append([(2 - row) * 40, col, 7])
        expected.append(line)
    return "ảnh 2 cột 3 hàng, mỗi hàng một sắc đỏ", image, None, 2, 3, expected


def _case_negative():
    return "một ô màu [0,100,255]", solid(1, 1, 0, 100, 255), None, 1, 1, [[[255, 155, 0]]]


def _case_grayscale():
    return "một ô màu [30,60,90]", solid(1, 1, 30, 60, 90), None, 1, 1, [[[60, 60, 60]]]


def _case_drop_blue():
    return "một ô màu [200,150,100]", solid(1, 1, 200, 150, 100), None, 1, 1, [[[200, 150, 0]]]


def _case_blend():
    layer = [[[0, 0, 0], [100, 100, 100]]]
    return ("nền [200,10,0]; lớp hiệu ứng ô đen rồi ô [100,100,100]",
            solid(2, 1, 200, 10, 0), layer, 2, 1, [[[200, 10, 0], [255, 110, 100]]])


def _case_blur():
    # ô giữa trắng, tám ô quanh đen: ô giữa còn 255/9, ô cạnh và ô góc nhận
    # phần sáng chia theo số hàng xóm của riêng nó
    # ô góc chỉ có 4 ô để chia (255 // 4 = 63), ô cạnh có 6 (42), ô giữa có 9 (28)
    expected = [[[63, 63, 63], [42, 42, 42], [63, 63, 63]],
                [[42, 42, 42], [28, 28, 28], [42, 42, 42]],
                [[63, 63, 63], [42, 42, 42], [63, 63, 63]]]
    return "ảnh 3x3 đen, riêng ô giữa trắng", white_dot(3), None, 3, 3, expected


def _case_compose():
    person = solid(3, 1, 200, 40, 40)
    background = solid(3, 1, 20, 20, 120)
    mask = [[255, 0, 200]]
    expected = [[[200, 40, 40], [20, 20, 120], [200, 40, 40]]]
    return ("người [200,40,40], nền [20,20,120], mặt nạ 255 · 0 · 200",
            person, [background, mask], 3, 1, expected)


def _case_blend_alpha():
    return ("nền [200,0,0], lớp trên [0,0,200], strength 50",
            solid(1, 1, 200, 0, 0), [solid(1, 1, 0, 0, 200), 50], 1, 1, [[[100, 0, 100]]])


CASES = {
    "flip": _case_flip,
    "flip_vertical": _case_flip_vertical,
    "negative": _case_negative,
    "grayscale": _case_grayscale,
    "drop_blue": _case_drop_blue,
    "blend": _case_blend,
    "blend_alpha": _case_blend_alpha,
    "compose": _case_compose,
    "blur": _case_blur,
}


def explain(name, namespace=None):
    """Kể lại bài test: [mô tả, ảnh vào, mong đợi, kết quả của em]."""
    if namespace is None:
        namespace = globals()
    fn = namespace.get(name)
    make_case = CASES.get(name)
    if fn is None or make_case is None:
        return []
    label, image, layer, width, height, expected = make_case()
    try:
        got = _run(fn, image, width, height, layer)
    except Exception as err:
        return [label, _pixels(image), _pixels(expected), f"{type(err).__name__}: {err}"]
    return [label, _pixels(image), _pixels(expected), _pixels(got)]
