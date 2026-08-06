"""magic_mirror - teaching helpers for the Magic Mirror project.

Two groups of commands.

Pictures that explain an idea before any maths appears:
    show_one_lamp(channel)     one lamp going from off to full brightness
    mix_light(r, g, b)         three lamps together, and the colour they make
    color_table()              the classic RGB triples side by side
    show_pixels()              six picture dots and the three numbers each holds
    show_grayscale(r, g, b)    why three equal lamps look grey
    show_resize()              dropping lamps to shrink, copying lamps to enlarge
    show_blur()                averaging a lamp with its eight neighbours
    show_sharpen()             pushing a lamp away from its neighbours
    show_goal()                the four effects the student is aiming for

Running the student's own work:
    check_my_code()            grade the five filter functions
    demo(fingers)              run the filters on a still picture, no camera
    run() / stop()             start / stop the webcam inside the output area
    set_filter(fingers, func)  bind a new filter to a finger count

Simple lesson only (don-gian.html), where resizing and the effects are built in
and the student writes a grid flip plus an if/else:
    simple_intro()             the cheat sheet for that lesson
    try_flip()                 test flip_image() on the sample picture
    try_effects()              show what choose_effect() answers per finger count
    set_spark(color, count)    restyle the magic dust

Skin Lab only (/skin-lab/), where the student writes one reusable convolution
layer and a no-training skin / red-spot pipeline:
    skin_intro()               explain the static and live workflow
    show_skin_sample()         synthetic portrait; works without camera
    skin_demo()                original, skin mask, spot mask, cleaned result
    check_skin_code()          grade the five Skin Lab functions

The filter functions are looked up in the notebook on EVERY frame, so re-running
the filter cell changes the live picture immediately - no camera restart needed.

All printed text is Vietnamese on purpose: the code is English so it reads like
real Python, the explanations are in the students' own language.
"""
import base64
import io
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage

import __main__
import js

COLOR_MIN, COLOR_MAX = 0, 255
CHANNELS = 3
OUTPUT_SIZE = (480, 360)
DEMO_SIZE = (80, 60)
PUBLIC_PHOTO_DIR = Path(__file__).resolve().parent / "photos"
PUBLIC_PHOTOS = (
    ("face-portrait-william-stitt.jpg", "CHÂN DUNG 1 · WILLIAM STITT"),
    ("face-portrait-eddie-kopp.jpg", "CHÂN DUNG 2 · EDDIE KOPP"),
    ("human-skin-closeup.jpg", "BỀ MẶT DA · M. HOWARD"),
)

# How many fingers runs which function. None means "leave the picture alone".
FILTER_BY_FINGERS = {
    0: "apply_grayscale",
    1: "apply_blur",
    2: "apply_sharpen",
    3: None,
    4: "__rotate__",
    5: None,
}
EFFECT_NAMES = {
    0: "trắng đen",
    1: "làm mờ",
    2: "làm nét",
    3: "(còn trống - phần thử thách)",
    4: "(còn trống - phần thử thách)",
    5: "ảnh gốc",
}

_status_line = ""


class MagicMirrorError(RuntimeError):
    """An error we can explain to a student, shown under the camera."""


# ===========================================================================
# Drawing kit
# ===========================================================================

# Kotopia palette (magic-dust/lessons/palette.css). Pillow cannot read CSS
# variables, so the same hex values are repeated here as RGB tuples.
PAPER_WARM = (255, 240, 220)
PAPER_RAISED = (255, 253, 245)
INK = (24, 63, 73)
INK_MUTED = (79, 111, 115)

# Red / green / blue channel labels. These are lesson CONTENT, not UI chrome:
# a student must be able to tell which number drives which lamp.
CHANNEL_COLORS = ((190, 40, 40), (30, 120, 55), (35, 75, 190))
CHANNEL_NAMES = ("đỏ", "xanh lá", "xanh dương")

ZOOM = 3                        # blow the drawing up so numbers stay readable
CELL = 30                       # one square in a diagram
LIGHT_TEXT_ABOVE = 380          # bright square -> dark text, dark square -> light


def _canvas(width, height):
    return Image.new("RGB", (width, height), PAPER_WARM)


def _text(image, position, words, color=INK):
    """Write ASCII on the drawing; skip silently if no font is available."""
    try:
        ImageDraw.Draw(image).text(position, words, fill=color)
    except Exception:
        pass


def _text_color_on(background):
    return INK if sum(background) > LIGHT_TEXT_ABOVE else PAPER_RAISED


def _square(image, x, y, color, label=None, size=CELL):
    """Draw one coloured square, optionally with a number in the middle."""
    image.paste(Image.new("RGB", (size - 2, size - 2), color), (x + 1, y + 1))
    if label is not None:
        words = str(label)
        _text(image, (x + size // 2 - 3 * len(words), y + size // 2 - 5), words,
              _text_color_on(color))


def _zoom(image):
    """Pixel-art upscale so both squares and text read well on screen."""
    return image.resize((image.width * ZOOM, image.height * ZOOM), Image.NEAREST)


def _grey(level):
    return (level, level, level)


def _only(channel, level):
    """A colour with a single lamp turned on."""
    lamp = [0, 0, 0]
    lamp[channel] = level
    return tuple(lamp)


# ---------------------------------------------------------------------------
# One lamp, then three
# ---------------------------------------------------------------------------

BRIGHTNESS_STEPS = (0, 32, 64, 96, 128, 160, 192, 224, 255)


def show_one_lamp(channel=0):
    """One lamp turned from 0 (off) up to 255 (full). channel: 0=red, 1=green, 2=blue."""
    image = _canvas(CELL * len(BRIGHTNESS_STEPS), CELL + 14)
    for column, level in enumerate(BRIGHTNESS_STEPS):
        _square(image, column * CELL, 0, _only(channel, level))
        _text(image, (column * CELL + 4, CELL + 2), "%3d" % level, CHANNEL_COLORS[channel])
    print("Đây là MỘT bóng đèn %s, vặn dần từ số 0 đến số 255." % CHANNEL_NAMES[channel])
    print("  số 0   -> đèn tắt hẳn, ô đen thui")
    print("  số 255 -> đèn sáng hết cỡ")
    print("  số ở giữa -> đèn sáng vừa vừa")
    print("Số càng lớn thì ánh sáng càng mạnh. Chỉ có thế thôi!")
    return _zoom(image)


def _check_level(value, name):
    """A lamp level must be a whole number between 0 and 255."""
    if not isinstance(value, int) or isinstance(value, bool):
        raise MagicMirrorError("Độ sáng đèn %s phải là số nguyên, đang nhận %r" % (name, value))
    if not COLOR_MIN <= value <= COLOR_MAX:
        raise MagicMirrorError("Độ sáng đèn %s phải từ 0 đến 255, đang nhận %d" % (name, value))


def _why_this_color(red, green, blue):
    """One sentence explaining the colour the three levels produce."""
    if red == green == blue == COLOR_MIN:
        return "Cả 3 đèn đều tắt -> không có tí ánh sáng nào -> màu ĐEN."
    if red == green == blue == COLOR_MAX:
        return "Cả 3 đèn sáng hết cỡ -> ánh sáng trộn lại thành màu TRẮNG."
    if red == green == blue:
        return ("Ba đèn sáng BẰNG NHAU -> màu XÁM, không còn màu sắc gì nữa. "
                "Số càng lớn thì xám càng sáng.")
    lit = [name for name, level in zip(CHANNEL_NAMES, (red, green, blue)) if level > COLOR_MIN]
    return "Đang sáng: đèn %s. Ánh sáng của chúng cộng lại thành màu ở ô lớn." % " + đèn ".join(lit)


LAMP_W, LAMP_H, RESULT_H = 60, 46, 54


def mix_light(red, green, blue):
    """Turn the three lamps to the given levels and show the colour they make."""
    for level, name in zip((red, green, blue), CHANNEL_NAMES):
        _check_level(level, name)

    image = _canvas(LAMP_W * CHANNELS, LAMP_H + RESULT_H)
    for column, level in enumerate((red, green, blue)):
        lamp = _only(column, level)
        _square(image, column * LAMP_W, 0, lamp, size=LAMP_W)
        _text(image, (column * LAMP_W + 6, 6), "%s=%d" % ("RGB"[column], level),
              _text_color_on(lamp))
    image.paste(Image.new("RGB", (LAMP_W * CHANNELS, RESULT_H - 2), (red, green, blue)),
                (0, LAMP_H + 1))

    for level, name in zip((red, green, blue), CHANNEL_NAMES):
        state = "tắt hẳn" if level == COLOR_MIN else "sáng %d%%" % round(level * 100 / COLOR_MAX)
        print("Đèn %-11s : %3d/255  (%s)" % (name, level, state))
    print("=> Ô lớn bên dưới là màu mắt em nhìn thấy: (%d, %d, %d)" % (red, green, blue))
    print("   " + _why_this_color(red, green, blue))
    return _zoom(image)


CLASSIC_COLORS = (
    (0, 0, 0, "cả 3 đèn tắt -> đen"),
    (255, 0, 0, "chỉ đèn đỏ sáng"),
    (0, 255, 0, "chỉ đèn xanh lá sáng"),
    (0, 0, 255, "chỉ đèn xanh dương sáng"),
    (255, 255, 0, "đỏ + xanh lá -> VÀNG"),
    (0, 255, 255, "xanh lá + xanh dương -> xanh lơ"),
    (255, 0, 255, "đỏ + xanh dương -> hồng cánh sen"),
    (255, 255, 255, "cả 3 đèn sáng hết -> trắng"),
    (128, 128, 128, "3 đèn bằng nhau, mức nửa -> xám"),
    (40, 40, 40, "3 đèn bằng nhau, rất yếu -> xám gần đen"),
)


def color_table():
    """The classic RGB triples, each next to the colour it really makes."""
    image = _canvas(CELL * len(CLASSIC_COLORS), CELL)
    print("%-16s %s" % ("(R, G, B)", "Ba cái đèn đang thế nào"))
    for column, (red, green, blue, note) in enumerate(CLASSIC_COLORS):
        _square(image, column * CELL, 0, (red, green, blue))
        print("%-16s %s" % ("(%d, %d, %d)" % (red, green, blue), note))
    print("Nhớ: trộn ÁNH SÁNG khác trộn màu nước. Đỏ + xanh lá ánh sáng ra VÀNG!")
    return _zoom(image)


# ---------------------------------------------------------------------------
# A picture is a grid of lamps
# ---------------------------------------------------------------------------

PIXEL_CELL = 34
LABEL_H = 34
SAMPLE_PIXELS = ((230, 60, 60), (60, 200, 90), (70, 120, 240),
                 (240, 220, 70), (150, 150, 150), (235, 190, 160))


def show_pixels():
    """Six picture dots and the three numbers that drive each one's lamps."""
    image = _canvas(PIXEL_CELL * len(SAMPLE_PIXELS), PIXEL_CELL + LABEL_H)
    for column, color in enumerate(SAMPLE_PIXELS):
        _square(image, column * PIXEL_CELL, 0, color, size=PIXEL_CELL)
        for row, level in enumerate(color):
            _text(image, (column * PIXEL_CELL + 6, PIXEL_CELL + row * 11),
                  "%3d" % level, CHANNEL_COLORS[row])
    print("Mỗi ô vuông ở trên là MỘT điểm ảnh - một cụm 3 cái đèn tí hon.")
    print("Ba con số dưới mỗi ô là độ sáng của đèn đỏ, đèn xanh lá, đèn xanh dương.")
    print("Ô thứ 5 có 3 số bằng nhau (150, 150, 150) nên nó xám - đúng như em đoán.")
    print("Ảnh 240x180 có 240 * 180 = 43200 cụm đèn như thế.")
    return _zoom(image)


# ---------------------------------------------------------------------------
# The four transformations
# ---------------------------------------------------------------------------

def show_grayscale(red=200, green=110, blue=50):
    """Three lamps at different levels, then all three levelled to their average."""
    for level, name in zip((red, green, blue), CHANNEL_NAMES):
        _check_level(level, name)
    average = (red + green + blue) // CHANNELS

    image = _canvas(CELL * 9, CELL + 14)
    for column, level in enumerate((red, green, blue)):
        _square(image, column * CELL, 0, _only(column, level), level)
    _square(image, CELL * 3, 0, (red, green, blue))
    _text(image, (CELL * 4 + 8, CELL // 2 - 5), "=>")
    for column in range(CHANNELS):
        _square(image, CELL * (5 + column), 0, _only(column, average), average)
    _square(image, CELL * 8, 0, _grey(average))
    _text(image, (2, CELL + 2), "truoc: %d %d %d" % (red, green, blue))
    _text(image, (CELL * 5 + 2, CELL + 2), "sau: %d %d %d" % (average, average, average))

    print("Trước: ba kênh màu có giá trị (%d, %d, %d); kênh đỏ lớn nhất nên pixel có màu cam."
          % (red, green, blue))
    print("Trung bình của ba số: (%d + %d + %d) // 3 = %d" % (red, green, blue, average))
    print("Sau: cả ba kênh cùng bằng %d nên pixel không còn màu trội và chuyển thành màu xám." % average)
    print("Ảnh trắng đen giữ lại thông tin CHỖ NÀO SÁNG, CHỖ NÀO TỐI, bỏ đi màu sắc.")
    return _zoom(image)


RESIZE_ROW = (240, 200, 160, 120, 80, 40)


def show_resize():
    """Six lamps, shrunk to three by dropping every other one, then stretched back."""
    image = _canvas(CELL * len(RESIZE_ROW), CELL * 3 + 16)
    for column, level in enumerate(RESIZE_ROW):
        _square(image, column * CELL, 0, _grey(level), level)
    for column in range(0, len(RESIZE_ROW), 2):                 # keep 1 lamp out of 2
        _square(image, (column // 2) * CELL, CELL + 8, _grey(RESIZE_ROW[column]), RESIZE_ROW[column])
    for column in range(len(RESIZE_ROW)):                       # then stretch back out
        kept = RESIZE_ROW[(column // 2) * 2]
        _square(image, column * CELL, CELL * 2 + 16, _grey(kept), kept)

    print("Hàng 1 - ảnh gốc: 6 cái đèn.")
    print("Hàng 2 - thu nhỏ: bỏ bớt, cứ 2 đèn chỉ giữ lại 1 -> còn 3 đèn (240, 160, 80).")
    print("Hàng 3 - phóng to lại: mỗi đèn được chép ra 2 đèn giống hệt nhau.")
    print("Để ý hàng 3 không giống hàng 1 nữa: các đèn 200, 120, 40 đã mất hẳn.")
    print("Đó là lý do ảnh phóng to trông vuông vức từng ô như tranh pixel art.")
    return _zoom(image)


NEIGHBOURHOOD = ((40, 60, 80), (60, 100, 120), (80, 120, 200))
KERNEL_CELL = 42                # bigger squares: they also carry a weight label
SHARPEN_KERNEL = ((0, -1, 0), (-1, 5, -1), (0, -1, 0))
BLUR_KERNEL = ((1, 1, 1), (1, 1, 1), (1, 1, 1))
BLUR_DIVISOR = 9


def _draw_neighbourhood(image, levels, weights=None):
    """Draw the 3x3 window: brightness in the middle, weight in the top-left corner."""
    for row in range(CHANNELS):
        for column in range(CHANNELS):
            x, y = column * KERNEL_CELL, row * KERNEL_CELL
            _square(image, x, y, _grey(levels[row][column]), levels[row][column], size=KERNEL_CELL)
            if weights and weights[row][column]:
                _text(image, (x + 4, y + 3), "%+d" % weights[row][column], (170, 110, 0))


def _kernel_canvas():
    return _canvas(KERNEL_CELL * 5, KERNEL_CELL * CHANNELS + 14)


def _draw_result(image, level, caption):
    _text(image, (KERNEL_CELL * 3 + 10, KERNEL_CELL + KERNEL_CELL // 2 - 5), "=>")
    _square(image, KERNEL_CELL * 4, KERNEL_CELL, _grey(level), level, size=KERNEL_CELL)
    _text(image, (3, KERNEL_CELL * CHANNELS + 2), caption)


def show_blur():
    """Nine neighbouring lamps averaged into one - that is all blurring is."""
    total = sum(sum(row) for row in NEIGHBOURHOOD)
    average = total // BLUR_DIVISOR

    image = _kernel_canvas()
    _draw_neighbourhood(image, NEIGHBOURHOOD)
    _draw_result(image, average, "tong %d / 9 = %d" % (total, average))

    print("Chín cái đèn nằm sát nhau. Đèn ở GIỮA đang sáng mức %d." % NEIGHBOURHOOD[1][1])
    print("Cộng độ sáng cả 9 đèn: %d. Chia cho 9 -> %d." % (total, average))
    print("Vặn đèn giữa về %d, tức là mức chung của cả xóm." % average)
    print("Làm thế với MỌI đèn thì đèn nào cũng giống hàng xóm, không còn chỗ nào")
    print("đổi đột ngột nữa -> mắt thấy ảnh MỜ đi.")
    return _zoom(image)


def show_sharpen():
    """The middle lamp pushed away from its neighbours - that is sharpening."""
    middle = NEIGHBOURHOOD[1][1]
    neighbours = (NEIGHBOURHOOD[0][1] + NEIGHBOURHOOD[2][1]
                  + NEIGHBOURHOOD[1][0] + NEIGHBOURHOOD[1][2])
    result = max(COLOR_MIN, min(COLOR_MAX, middle * 5 - neighbours))

    image = _kernel_canvas()
    _draw_neighbourhood(image, NEIGHBOURHOOD, SHARPEN_KERNEL)
    _draw_result(image, result, "%d x5 - %d = %d" % (middle, neighbours, result))

    print("Vẫn 9 cái đèn đó, nhưng mỗi đèn có thêm một TRỌNG SỐ (số màu cam).")
    print("Đèn giữa nhân 5:              %d x 5 = %d" % (middle, middle * 5))
    print("Bốn đèn trên/dưới/trái/phải bị trừ đi: -%d" % neighbours)
    print("Còn lại %d, nên đèn giữa từ mức %d bị vặn lên %d." % (result, middle, result))
    print("Đèn nào sáng hơn hàng xóm thì được vặn sáng thêm, tối hơn thì bị vặn tối")
    print("thêm -> chênh lệch giãn ra -> đường viền hiện RÕ.")
    return _zoom(image)


def _reference_grayscale(image):
    result = image.copy()
    pixels = result.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b = pixels[x, y]
            pixels[x, y] = _grey((r + g + b) // CHANNELS)
    return result


def _reference_kernel(image, kernel, divisor):
    result = image.copy()
    old, new = image.load(), result.load()
    for y in range(1, image.height - 1):
        for x in range(1, image.width - 1):
            totals = [0] * CHANNELS
            for ky in range(-1, 2):
                for kx in range(-1, 2):
                    weight = kernel[ky + 1][kx + 1]
                    for channel in range(CHANNELS):
                        totals[channel] += old[x + kx, y + ky][channel] * weight
            new[x, y] = tuple(max(COLOR_MIN, min(COLOR_MAX, v // divisor)) for v in totals)
    return result


GOAL_TILE = (260, 195)


def show_goal():
    """Original, grayscale, blur, sharpen in a 2x2 grid - the target of the project."""
    original = sample_image((65, 49))
    tiles = (original, _reference_grayscale(original),
             _reference_kernel(original, BLUR_KERNEL, BLUR_DIVISOR),
             _reference_kernel(original, SHARPEN_KERNEL, 1))
    gap, (tile_w, tile_h) = 8, GOAL_TILE
    image = Image.new("RGB", (tile_w * 2 + gap, tile_h * 2 + gap), PAPER_WARM)
    for index, tile in enumerate(tiles):
        image.paste(tile.resize(GOAL_TILE, Image.NEAREST),
                    ((index % 2) * (tile_w + gap), (index // 2) * (tile_h + gap)))
    print("Bốn ô, đọc như đọc sách:")
    print("   trên-trái: ảnh gốc       trên-phải: trắng đen")
    print("   dưới-trái: làm mờ        dưới-phải: làm nét")
    print("Đây là kết quả em sẽ tự tay làm ra bằng 5 hàm ở phần sau.")
    return image


# ===========================================================================
# Running the student's filters
# ===========================================================================

def _student_function(name):
    """Fetch a function the student wrote in the notebook, or explain what is missing."""
    function = getattr(__main__, name, None)
    if not callable(function):
        raise MagicMirrorError("Chưa có hàm %s() - hãy chạy ô code bộ lọc trước." % name)
    return function


def _require_image(value, name):
    if not isinstance(value, Image.Image):
        raise MagicMirrorError(
            "%s() phải trả về ảnh, nhưng đang trả về %s (thiếu return?)"
            % (name, type(value).__name__))
    return value


def _require_finger_count(fingers):
    if fingers not in FILTER_BY_FINGERS:
        raise MagicMirrorError("Số ngón tay phải từ 0 đến 5, đang nhận %r" % (fingers,))
    return fingers


def rotate_nearest(image, angle):
    """Rotate around the image centre with inverse mapping and nearest-neighbour sampling."""
    radians = math.radians(float(angle))
    cosine, sine = math.cos(radians), math.sin(radians)
    width, height = image.size
    center_x = (width - 1) / 2
    center_y = (height - 1) / 2
    source = image.load()
    result = Image.new("RGB", image.size)
    target = result.load()

    for target_y in range(height):
        for target_x in range(width):
            dx = target_x - center_x
            dy = target_y - center_y
            source_x = round(cosine * dx + sine * dy + center_x)
            source_y = round(-sine * dx + cosine * dy + center_y)
            if 0 <= source_x < width and 0 <= source_y < height:
                target[target_x, target_y] = source[source_x, source_y]
    return result


def process(image, fingers, small_size, hand_angle=0):
    """Shrink -> filter according to the finger count -> enlarge again."""
    _require_finger_count(fingers)
    small = _require_image(_student_function("scale_down")(image, *small_size), "scale_down")
    filter_name = FILTER_BY_FINGERS[fingers]
    if filter_name == "__rotate__":
        small = rotate_nearest(small, hand_angle)
    elif filter_name:
        small = _require_image(_student_function(filter_name)(small), filter_name)
    return _require_image(_student_function("scale_up")(small, *OUTPUT_SIZE), "scale_up")


def set_filter(fingers, function):
    """Bind a filter to a finger count. `function` is a function or its name; None = untouched."""
    _require_finger_count(fingers)
    FILTER_BY_FINGERS[fingers] = getattr(function, "__name__", function)
    EFFECT_NAMES[fingers] = FILTER_BY_FINGERS[fingers] or "ảnh gốc"
    print("Giơ %d ngón tay -> chạy %s" % (fingers, EFFECT_NAMES[fingers]))


def _warn_if_black(image):
    """An all-black frame nearly always means a pixel-copy loop is still missing."""
    if np.asarray(image.convert("RGB")).max() == COLOR_MIN:
        return "Ảnh toàn màu đen - có lẽ vòng lặp trong scale_down/scale_up chưa gán pixel."
    return ""


def _to_rgba_bytes(image):
    """Pack the picture into flat RGBA so JavaScript can paint it straight onto a canvas."""
    if image.size != OUTPUT_SIZE:
        # Safety net: a wrong-sized return still shows something instead of crashing.
        image = image.resize(OUTPUT_SIZE)
    frame = np.zeros((OUTPUT_SIZE[1], OUTPUT_SIZE[0], 4), dtype=np.uint8)
    frame[..., :CHANNELS] = np.asarray(image.convert("RGB"), dtype=np.uint8)
    frame[..., 3] = COLOR_MAX
    return frame.tobytes()


def _frame(buffer, width, height, fingers, small_w, small_h, hand_angle=0, face_mask=None):
    """Called from JavaScript once per frame; `buffer` is raw RGBA from the canvas."""
    global _status_line
    raw = np.frombuffer(buffer.to_py(), dtype=np.uint8).reshape(height, width, 4)
    image = Image.fromarray(np.ascontiguousarray(raw[..., :CHANNELS]), "RGB")
    mask_array = None
    if face_mask is not None:
        flat_mask = np.frombuffer(face_mask.to_py(), dtype=np.uint8)
        if flat_mask.size == small_w * small_h:
            mask_array = flat_mask.reshape(small_h, small_w)
    try:
        if _skin_mode:
            result = process_skin(image, (small_w, small_h), mask_array)
        elif _simple_mode:
            result = process_simple(image, fingers, (small_w, small_h), hand_angle)
        else:
            result = process(image, fingers, (small_w, small_h), hand_angle)
        _status_line = _warn_if_black(result)
        if _skin_mode and mask_array is not None:
            coverage = int((mask_array > 0).mean() * 100)
            _status_line = ("MediaPipe Face Mesh: face mask chiếm %d%% khung hình." % coverage
                            if coverage else "MediaPipe Face Mesh chưa thấy khuôn mặt; ảnh đang được giữ nguyên.")
    except MagicMirrorError as error:
        result, _status_line = image, str(error)
    except Exception as error:
        result = image
        _status_line = "Lỗi trong code Python: %s: %s" % (type(error).__name__, error)
    return _to_rgba_bytes(result)


def _status():
    """JavaScript reads this to show a fix-it hint under the camera."""
    return _status_line


def _label(fingers):
    """Caption on the camera badge, e.g. '2 ngón - làm nét'."""
    if _skin_mode:
        return "Skin Lab - tích chập viết tay, không huấn luyện"
    if _simple_mode:
        return "%d ngón - %s%s" % (fingers, _last_effect, " | đã lật" if _flipped else "")
    return "%d ngón - %s" % (fingers, EFFECT_NAMES.get(fingers, "?"))


def _weather_action(motion):
    """Camera gọi hàm học sinh viết chỉ khi nhận ra một chuyển động hoàn chỉnh."""
    if not _simple_mode:
        return "clear"
    try:
        chooser = _student_function("choose_spell")
    except MagicMirrorError:
        chooser = _student_function("choose_weather")
    action = chooser(motion)
    allowed = ("lightning", "swords", "lotus", "petals", "clear")
    if action not in allowed:
        raise MagicMirrorError(
            'choose_spell("%s") phải trả về một trong: %s' %
            (motion, ", ".join('"%s"' % item for item in allowed)))
    return action


def run():
    """Start the webcam inside the output area of the cell being run."""
    js.MagicMirrorUI.start()


def stop():
    """Stop the webcam."""
    js.MagicMirrorUI.stop()


def show(value):
    """Render a cell result: a PIL image becomes a picture, anything else becomes text."""
    if value is None:
        return
    if isinstance(value, Image.Image):
        buffer = io.BytesIO()
        value.convert("RGB").save(buffer, format="PNG")
        js.MagicMirrorUI.emit("image", base64.b64encode(buffer.getvalue()).decode("ascii"))
    else:
        js.MagicMirrorUI.emit("text", repr(value))


def intro():
    """Print the finger-count table and the handful of commands worth remembering."""
    print("magic_mirror đã sẵn sàng. Giơ mấy ngón tay thì được hiệu ứng gì:")
    for fingers in sorted(EFFECT_NAMES):
        print("  %d ngón  ->  %s" % (fingers, EFFECT_NAMES[fingers]))
    print("Lệnh hay dùng: mix_light(255,0,0) | check_my_code() | demo(0) | run() | stop()")


# ===========================================================================
# Simple mode (don-gian.html)
#
# Everything except the two exercises is handed to the student ready-made:
# resizing and the effects themselves are built in, so the lesson can be about
# working on a 2-D grid (flipping) and about if / elif / else.
# ===========================================================================

EFFECT_LIBRARY = ("normal", "blur", "sharpen", "invert", "rotate")
SPARK_COLORS = ("honey", "mint", "white", "green", "red")

_simple_mode = False
_skin_mode = False
_flipped = False
_last_effect = "normal"


def use_simple_mode():
    """Switch the camera pipeline to the simple lesson. Called by the page itself."""
    global _simple_mode, _skin_mode
    _simple_mode = True
    _skin_mode = False


def use_skin_mode():
    """Switch the camera pipeline to Skin Lab without changing the other routes."""
    global _simple_mode, _skin_mode
    _simple_mode = False
    _skin_mode = True


def toggle_flip():
    """Called from JavaScript when the open-hand pose has been held long enough."""
    global _flipped
    _flipped = not _flipped
    return _flipped


def is_flipped():
    """True when the picture is currently flipped."""
    return _flipped


def _make_invert(image):
    result = image.copy()
    pixels = result.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b = pixels[x, y]
            pixels[x, y] = (COLOR_MAX - r, COLOR_MAX - g, COLOR_MAX - b)
    return result


def _run_effect(image, name, hand_angle=0):
    """Apply one of the built-in effects by name, with a friendly error if unknown."""
    global _last_effect
    if not isinstance(name, str):
        raise MagicMirrorError(
            "choose_effect() phải trả về một chuỗi trong dấu nháy, ví dụ \"gray\" - "
            "đang trả về %s" % type(name).__name__)
    if name not in EFFECT_LIBRARY:
        raise MagicMirrorError(
            "choose_effect() trả về \"%s\", nhưng chỉ có: %s" % (name, ", ".join(EFFECT_LIBRARY)))
    _last_effect = name
    if name == "blur":
        return _reference_kernel(image, BLUR_KERNEL, BLUR_DIVISOR)
    if name == "sharpen":
        return _reference_kernel(image, SHARPEN_KERNEL, 1)
    if name == "invert":
        return _make_invert(image)
    if name == "rotate":
        return image.rotate(-float(hand_angle), resample=Image.Resampling.NEAREST)
    return image


def process_simple(image, fingers, small_size, hand_angle=0):
    """Shrink -> effect chosen by if/else -> flip if the pose was held -> enlarge.

    Shrinking and enlarging use Pillow directly: in this lesson they are plumbing,
    not the exercise, and skipping the hand-written loops keeps the camera smooth.
    """
    small = image.resize(small_size, Image.NEAREST)
    small = _run_effect(small, _student_function("choose_effect")(fingers), hand_angle)
    if _flipped:
        small = _require_image(_student_function("flip_image")(small), "flip_image")
    return small.resize(OUTPUT_SIZE, Image.NEAREST)


def process_skin(image, small_size, face_mask=None):
    """Run the vectorized filter, then keep its changes inside MediaPipe's face mask."""
    small = image if image.size == small_size else image.resize(small_size, Image.Resampling.LANCZOS)
    cleaned = _require_image(_student_function("remove_pimples")(small), "remove_pimples")
    if face_mask is not None:
        enabled = np.asarray(face_mask) > 0
        original_pixels = np.asarray(small.convert("RGB"), dtype=np.uint8)
        cleaned_pixels = np.asarray(cleaned.convert("RGB"), dtype=np.uint8)
        combined = np.where(enabled[:, :, None], cleaned_pixels, original_pixels)
        cleaned = Image.fromarray(combined.astype(np.uint8), "RGB")
    return cleaned if cleaned.size == OUTPUT_SIZE else cleaned.resize(OUTPUT_SIZE, Image.Resampling.BILINEAR)


def skin_intro():
    """Print the few commands worth remembering in the isolated Skin Lab route."""
    print("Skin Lab đã sẵn sàng.")
    print("Các bước xử lý: ảnh RGB -> vùng da -> vùng đỏ -> giới hạn trong khuôn mặt -> làm mềm vùng được chọn.")
    print("Face Mesh có sẵn sẽ tìm đường bao khuôn mặt; em không cần tự huấn luyện chương trình nhận diện.")
    print("Mỗi phần có phép tính, hình màu và lời giải thích. Bài này không dùng để chẩn đoán da.")
    print("Code và phần đang học được tự lưu trên máy này; ảnh camera không được lưu.")
    print("Lệnh: show_skin_pixel_channels() | check_skin_code() | skin_demo() | run() | stop()")


def set_spark(color=None, count=None):
    """Change the magic dust: colour name, and how many grains appear per frame."""
    if color is not None and color not in SPARK_COLORS:
        raise MagicMirrorError("Màu bụi phép phải là một trong: %s" % ", ".join(SPARK_COLORS))
    js.MagicMirrorUI.configureSparks(color, count)
    print("Bụi phép: màu %s, %s hạt mỗi nhịp." % (color or "giữ nguyên", count or "giữ nguyên"))


def set_spell_time(swords_seconds=8.8, lotus_seconds=9.5, lightning_seconds=7.6):
    """Đổi thời gian tồn tại của ba đại chiêu có countdown."""
    swords_seconds = max(3, min(20, float(swords_seconds)))
    lotus_seconds = max(3, min(20, float(lotus_seconds)))
    lightning_seconds = max(3, min(20, float(lightning_seconds)))
    js.MagicMirrorUI.configureSpells(swords_seconds, lotus_seconds, lightning_seconds)
    print("VFX: Vạn Kiếm %.1f giây, Hỏa Liên %.1f giây, Thiên Lôi %.1f giây." %
          (swords_seconds, lotus_seconds, lightning_seconds))


set_weather = set_spell_time


def try_flip(size=DEMO_SIZE):
    """Test flip_image on the sample picture. Returns original and flipped side by side."""
    original = sample_image(size)
    flipped = _require_image(_student_function("flip_image")(original), "flip_image")
    gap = 8
    board = Image.new("RGB", (OUTPUT_SIZE[0] * 2 + gap, OUTPUT_SIZE[1]), PAPER_WARM)
    board.paste(original.resize(OUTPUT_SIZE, Image.NEAREST), (0, 0))
    board.paste(flipped.resize(OUTPUT_SIZE, Image.NEAREST), (OUTPUT_SIZE[0] + gap, 0))
    print("Trái: ảnh gốc | Phải: sau khi chạy flip_image()")
    print("Ảnh mẫu có ô vuông trắng lệch sang trái, nên lật đúng thì nó phải nhảy sang phải.")
    return board


def try_effects(fingers_list=(0, 1, 2, 5)):
    """Print what choose_effect() answers for a few finger counts."""
    choose = _student_function("choose_effect")
    print("Em giơ mấy ngón -> choose_effect() trả về gì:")
    for fingers in fingers_list:
        try:
            answer = choose(fingers)
        except Exception as error:
            answer = "LỖI: %s" % error
        print("  %d ngón  ->  %r" % (fingers, answer))
    print("Các hiệu ứng dùng được: %s" % ", ".join(EFFECT_LIBRARY))


def simple_intro():
    """Print the cheat sheet for the simple lesson."""
    print("magic_mirror đã sẵn sàng (bản đơn giản).")
    print("Cử chỉ:")
    print("  giơ 0..4 ngón      -> đổi hiệu ứng, do hàm choose_effect() của em quyết định")
    print("  xòe 5 ngón, giữ yên -> LẬT ảnh (chạy hàm flip_image() của em)")
    print("  ngón cái + ngón út  -> triệu hồi bụi phép")
    print("Hiệu ứng có sẵn: %s" % ", ".join(EFFECT_LIBRARY))
    print("Lệnh: try_flip() | try_effects() | set_spark(\"mint\", 6) | run() | stop()")


def rgb_rectangle_image():
    """A small meaningful RGB matrix: a warm rectangle on a blue background."""
    blue = (30, 80, 180)
    red = (255, 40, 40)
    rows = []
    for row in range(6):
        line = []
        for column in range(8):
            inside = 1 <= row <= 4 and 2 <= column <= 5
            line.append(red if inside else blue)
        rows.append(line)
    return rows


def show_rgb_matrix(matrix=None, zoom=42):
    """Render a nested RGB list as enlarged pixels and print exact row/column values."""
    matrix = matrix or rgb_rectangle_image()
    if not matrix or not matrix[0]:
        raise MagicMirrorError("Ma trận ảnh phải có ít nhất một hàng và một cột.")
    width = len(matrix[0])
    if any(len(row) != width for row in matrix):
        raise MagicMirrorError("Mọi hàng trong ma trận ảnh phải có cùng số cột.")

    normalized = []
    for row_index, row in enumerate(matrix):
        normalized_row = []
        for column_index, pixel in enumerate(row):
            if len(pixel) != 3:
                raise MagicMirrorError(
                    "Pixel ở hàng %d, cột %d phải có đúng ba số [R, G, B]."
                    % (row_index, column_index))
            normalized_row.append(tuple(max(0, min(255, int(value))) for value in pixel))
        normalized.append(normalized_row)

    image = Image.new("RGB", (width, len(normalized)))
    pixels = image.load()
    for row_index, row in enumerate(normalized):
        for column_index, pixel in enumerate(row):
            pixels[column_index, row_index] = pixel

    print("Ma trận có %d hàng × %d cột. Mỗi ô là [red, green, blue]." %
          (len(normalized), width))
    for row_index, row in enumerate(normalized):
        print("hàng %d: %s" % (row_index, row))
    return image.resize((width * zoom, len(normalized) * zoom), Image.Resampling.NEAREST)


# ===========================================================================
# Skin Lab: synthetic evidence and a no-camera fallback
# ===========================================================================

SKIN_TONE = (183, 127, 103)
SKIN_SHADOW = (145, 91, 75)
PIMPLE_RED = (225, 62, 66)
SKIN_BACKGROUND = (35, 80, 185)
SKIN_SOFTEN_KERNEL = ((1, 2, 1), (2, 4, 2), (1, 2, 1))


def _math_card(title, lines, width=250):
    """Draw a compact, ASCII-only calculation card that remains readable in-browser."""
    height = 22 + 14 * len(lines)
    image = _canvas(width, height)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((1, 1, width - 2, height - 2), radius=5, outline=INK_MUTED, width=1)
    _text(image, (8, 7), title, INK)
    for index, line in enumerate(lines):
        _text(image, (8, 22 + index * 14), line, INK_MUTED)
    return _zoom(image)


def _tile_board(tiles, labels):
    """Place four equally sized pictures on one labelled 2x2 board."""
    tile_size = (160, 120)
    label_height = 18
    gap = 8
    board = Image.new(
        "RGB",
        (tile_size[0] * 2 + gap, (tile_size[1] + label_height) * 2 + gap),
        PAPER_WARM,
    )
    for index, (tile, label) in enumerate(zip(tiles, labels)):
        column, row = index % 2, index // 2
        x = column * (tile_size[0] + gap)
        y = row * (tile_size[1] + label_height + gap)
        board.paste(tile.resize(tile_size, Image.Resampling.NEAREST), (x, y + label_height))
        _text(board, (x + 4, y + 4), label, INK)
    return board


def _image_grid(tiles, labels, columns=3, tile_size=(160, 120),
                resample=Image.Resampling.NEAREST):
    """Place any number of labelled pictures on a compact grid."""
    rows = math.ceil(len(tiles) / columns)
    label_height = 22
    gap = 8
    board = Image.new(
        "RGB",
        (tile_size[0] * columns + gap * (columns - 1),
         (tile_size[1] + label_height) * rows + gap * (rows - 1)),
        PAPER_WARM,
    )
    for index, (tile, label) in enumerate(zip(tiles, labels)):
        column, row = index % columns, index // columns
        x = column * (tile_size[0] + gap)
        y = row * (tile_size[1] + label_height + gap)
        board.paste(tile.convert("RGB").resize(tile_size, resample),
                    (x, y + label_height))
        _text(board, (x + 4, y + 5), label, INK)
    return board


def show_skin_pixel_channels():
    """Break one skin pixel and one red spot into coloured R/G/B lamps, then rebuild them."""
    samples = (("PIXEL DA", SKIN_TONE), ("PIXEL ĐỎ", PIMPLE_RED))
    cell_width, cell_height = 112, 92
    gap = 6
    board = Image.new("RGB", (cell_width * 5 + gap * 4, cell_height * 2 + gap), PAPER_WARM)
    for row, (name, color) in enumerate(samples):
        red, green, blue = color
        parts = (
            (color, "%s RGB" % name),
            ((red, 0, 0), "R = %d" % red),
            ((0, green, 0), "G = %d" % green),
            ((0, 0, blue), "B = %d" % blue),
            (color, "R + G + B"),
        )
        for column, (fill, label) in enumerate(parts):
            x = column * (cell_width + gap)
            y = row * (cell_height + gap)
            ImageDraw.Draw(board).rounded_rectangle(
                (x + 3, y + 23, x + cell_width - 3, y + cell_height - 3),
                radius=8, fill=fill, outline=(255, 255, 255), width=2,
            )
            _text(board, (x + 7, y + 7), label, INK)
    print("Pixel da (183, 127, 103) được tách thành ba kênh R, G, B rồi ghép lại đúng màu ban đầu.")
    print("Pixel đỏ (225, 62, 66) có R lớn hơn G và B; Chặng 4 sẽ đo chính độ chênh này.")
    return board


def show_numpy_channels():
    """Show an RGB image, its coloured channels, and an exact np.stack rebuild."""
    original = skin_sample_image()
    pixels = np.asarray(original, dtype=np.uint8)
    red_only = np.zeros_like(pixels)
    green_only = np.zeros_like(pixels)
    blue_only = np.zeros_like(pixels)
    red_only[:, :, 0] = pixels[:, :, 0]
    green_only[:, :, 1] = pixels[:, :, 1]
    blue_only[:, :, 2] = pixels[:, :, 2]
    rebuilt = np.stack(
        (pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]), axis=2,
    )
    difference = np.abs(rebuilt.astype(np.int16) - pixels.astype(np.int16)).astype(np.uint8)
    print("Bảng pixels có kích thước %s: cao %d, rộng %d và có ba kênh R/G/B." %
          (pixels.shape, pixels.shape[0], pixels.shape[1]))
    print("np.stack((red, green, blue), axis=2) ghép ba kênh lại; sai khác lớn nhất = %d." %
          int(difference.max()))
    return _image_grid(
        (original, _numpy_picture(red_only), _numpy_picture(green_only),
         _numpy_picture(blue_only), _numpy_picture(rebuilt), _numpy_picture(difference)),
        ("ẢNH RGB", "KÊNH ĐỎ", "KÊNH XANH LÁ",
         "KÊNH XANH DƯƠNG", "GHÉP LẠI RGB", "SAI KHÁC = 0"),
    )


def _public_photo(file_name, size=None):
    """Load a bundled CC0 image; the browser installs the same files beside this module."""
    path = PUBLIC_PHOTO_DIR / file_name
    if not path.exists():
        raise MagicMirrorError("Thiếu ảnh minh họa %s; hãy tải lại trang bằng HTTP." % file_name)
    with Image.open(path) as source:
        photo = ImageOps.exif_transpose(source).convert("RGB")
    return ImageOps.fit(photo, size, method=Image.Resampling.LANCZOS) if size else photo


def show_public_photo_gallery():
    """Show locally bundled CC0 inputs with different tones, lighting, and texture."""
    pictures = [_public_photo(file_name, (200, 150)) for file_name, _ in PUBLIC_PHOTOS]
    labels = [label for _, label in PUBLIC_PHOTOS]
    print("Ba ảnh CC0 đã được lưu sẵn trong bài; trang không tải ảnh trực tiếp từ nơi khác.")
    print("Màu da và ánh sáng khác nhau giúp em kiểm tra giới hạn của luật RGB viết tay.")
    return _image_grid(pictures, labels, columns=3, tile_size=(200, 150),
                       resample=Image.Resampling.LANCZOS)


def try_public_photo(index=0):
    """Run the student's complete pipeline on one public photo and expose every decision."""
    if not 0 <= int(index) < len(PUBLIC_PHOTOS):
        raise MagicMirrorError("index phải là 0, 1 hoặc 2.")
    file_name, label = PUBLIC_PHOTOS[int(index)]
    original = _public_photo(file_name, (200, 150))
    skin_mask = np.asarray(_student_function("detect_skin")(original))
    pimple_mask = np.asarray(_student_function("detect_pimples")(original, skin_mask))
    cleaned = _require_image(_student_function("remove_pimples")(original), "remove_pimples")
    print("Ảnh %d: %s. Hãy tìm vùng nhận thiếu hoặc nhận nhầm; đây là phép thử, không phải kết luận về da." %
          (int(index), label))
    print("Vùng da được đánh dấu: %d/%d pixel. Vùng đỏ được đánh dấu: %d/%d pixel." %
          (int((skin_mask > 0).sum()), skin_mask.size,
           int((pimple_mask > 0).sum()), pimple_mask.size))
    print("Màu vàng chỉ vị trí skin_mask=255; màu đỏ chỉ vị trí pimple_mask=255; hình cuối là kết quả (OUTPUT).")
    return _image_grid(
        (original, _mask_overlay(original, skin_mask, (255, 210, 80)),
         _mask_overlay(original, pimple_mask, (255, 35, 45), 0.7), cleaned),
        ("ẢNH CÔNG KHAI", "VÙNG DA", "VÙNG ĐỎ", "KẾT QUẢ"),
        columns=2, tile_size=(240, 180), resample=Image.Resampling.LANCZOS,
    )


def show_face_mesh_map():
    """Draw the face-oval landmark indices used by the browser's MediaPipe mask."""
    image = ImageOps.fit(skin_sample_image(), (360, 270), method=Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(image, "RGBA")
    points = {
        10: (180, 24), 338: (250, 40), 454: (293, 133), 152: (180, 248),
        234: (67, 133), 109: (110, 40),
    }
    oval = [(180, 24), (250, 40), (293, 133), (270, 205), (180, 248),
            (90, 205), (67, 133), (110, 40)]
    draw.polygon(oval, fill=(255, 210, 80, 42), outline=(255, 210, 80, 255), width=4)
    for landmark_id, (x, y) in points.items():
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(80, 238, 220, 255))
        _text(image, (x + 8, y - 8), str(landmark_id), INK)
    print("Face Mesh tìm tối đa 478 điểm mốc khi bật refineLandmarks.")
    print("Trình duyệt nối các điểm 10, 454, 152 và 234 thành đường bao của face_mask.")
    return image


def show_face_mask_pipeline():
    """Show why the final edit requires both a face polygon and the RGB skin decision."""
    original = skin_sample_image((160, 120))
    width, height = original.size
    y, x = np.ogrid[:height, :width]
    face_mask = (((x - width / 2) / (width * .29)) ** 2
                 + ((y - height / 2) / (height * .44)) ** 2 <= 1)
    skin_mask = np.asarray(_student_function("detect_skin")(original)) > 0
    allowed = face_mask & skin_mask
    print("Dấu & chỉ chọn pixel khi face_mask và skin_mask cùng đúng.")
    print("face_mask chọn %d pixel; skin_mask chọn %d pixel; cả hai cùng chọn %d pixel." %
          (int(face_mask.sum()), int(skin_mask.sum()), int(allowed.sum())))
    print("np.where(allowed[..., None], cleaned, original) chỉ đổi vùng được cả hai ảnh đánh dấu chọn.")
    return _image_grid(
        (original, _mask_picture(face_mask, (95, 238, 220)),
         _mask_picture(skin_mask, (245, 204, 166)),
         _mask_overlay(original, allowed, (255, 210, 80), 0.65)),
        ("ẢNH CAMERA", "VÙNG KHUÔN MẶT", "VÙNG DA RGB", "VÙNG ĐƯỢC PHÉP ĐỔI"),
        columns=2, tile_size=(240, 180),
    )


def show_skin_pipeline_overview():
    """Show a fixed input and the three intended pipeline products before coding."""
    original = skin_sample_image()
    width, height = original.size
    skin_picture = Image.new("RGB", original.size, (28, 42, 48))
    skin_draw = ImageDraw.Draw(skin_picture)
    skin_draw.ellipse(
        (width * 22 // 100, height * 7 // 100, width * 78 // 100, height * 93 // 100),
        fill=(245, 204, 166),
    )
    spot_picture = Image.new("RGB", original.size, (28, 42, 48))
    spot_draw = ImageDraw.Draw(spot_picture)
    cleaned = original.copy()
    clean_draw = ImageDraw.Draw(cleaned)
    for spot_x, spot_y in ((40, 58), (55, 49), (51, 68)):
        x, y = width * spot_x // 100, height * spot_y // 100
        spot_draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=PIMPLE_RED)
        clean_draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=SKIN_TONE)
    print("Bước 1 lấy ảnh màu; bước 2 đánh dấu vùng da; bước 3 đánh dấu vùng đỏ; bước 4 chỉ đổi màu vùng đỏ.")
    print("Đây là kết quả cần đạt. Sau khi em viết code, skin_demo() sẽ tính lại bằng chính năm hàm đó.")
    return _tile_board(
        (original, skin_picture, spot_picture, cleaned),
        ("1 ẢNH ĐẦU VÀO", "2 VÙNG DA", "3 VÙNG ĐỎ", "4 KẾT QUẢ"),
    )


def show_convolution_math():
    """Draw the exact 3x3 substitution used by the first task."""
    values = ((10, 10, 10), (10, 90, 10), (10, 10, 10))
    image = _canvas(CELL * 3 + 120, CELL * 3)
    for row in range(3):
        for column in range(3):
            value = values[row][column]
            _square(image, column * CELL, row * CELL, _grey(value), value)
    _text(image, (CELL * 3 + 8, 12), "8 x 10 + 90 = 170")
    _text(image, (CELL * 3 + 8, 34), "170 / 9 = 18.89")
    _text(image, (CELL * 3 + 8, 56), "tâm: 90 -> 18.89")
    print("Tám pixel xung quanh đóng góp 8 × 10 = 80.")
    print("Cộng pixel giữa: 80 + 90 = 170. Chia 9: 170 / 9 = 18.89.")
    return _zoom(image)


def show_skin_evidence_math():
    """Show substituted RGB evidence for one accepted and one rejected pixel."""
    print("Pixel da mẫu (183, 127, 103): brightness=137, warmth=80, red_green_gap=56 -> 255.")
    print("Pixel nền xanh (35, 80, 185): brightness=100, warmth=-150, red_green_gap=-45 -> 0.")
    return _math_card("TÍNH TỪ BA SỐ RGB", (
        "PIXEL DA (183,127,103):",
        "brightness = 413 // 3 = 137",
        "warmth = 183 - 103 = 80",
        "red_green_gap = 183 - 127 = 56",
        "đạt mọi điều kiện -> 255",
        "",
        "NỀN XANH (35,80,185): warmth = -150",
        "không đạt warmth >= 8 -> 0",
    ))


def show_skin_vote_math():
    """Show how eight neighbouring skin votes retain a rejected centre pixel."""
    image = _canvas(CELL * 3 + 145, CELL * 3)
    for row in range(3):
        for column in range(3):
            value = 0 if (row, column) == (1, 1) else 255
            _square(image, column * CELL, row * CELL, _grey(value), value)
    _text(image, (CELL * 3 + 8, 10), "8 x 255 + 0 = 2040")
    _text(image, (CELL * 3 + 8, 32), "trung bình = 226.67")
    _text(image, (CELL * 3 + 8, 54), "mức cần = 141.67")
    _text(image, (CELL * 3 + 8, 72), "226.67 >= 141.67 -> 255")
    print("Tám giá trị 255 và một giá trị 0 có trung bình là 226.67.")
    print("Mức cần đạt là 141.67. Vì 226.67 lớn hơn, pixel giữa vẫn được đánh dấu là vùng da.")
    return _zoom(image)


def show_red_gap_math():
    """Show the 5x5 local-redness substitution for the synthetic red spot."""
    print("Chấm đỏ có redness=161; pixel da xung quanh có redness=68.")
    print("Trung bình 5×5 là 71.72; red_gap=89.28, lớn hơn ngưỡng 24.")
    return _math_card("ĐỘ ĐỎ TRONG VÙNG 5x5", (
        "spot = 225 - (62 + 66) / 2 = 161",
        "skin = 183 - (127 + 103) / 2 = 68",
        "local = (161 + 24 x 68) / 25",
        "      = 1793 / 25 = 71.72",
        "red_gap = 161 - 71.72 = 89.28",
        "89.28 >= 24 -> chọn pixel này",
    ))


def show_soften_math():
    """Show the per-channel weighted substitution for selective softening."""
    print("Bảng trọng số 1-2-1 đổi pixel giữa thành (194, 111, 94).")
    print("Độ đỏ nổi trội giảm từ 161 xuống 91.5; pixel ngoài vùng đánh dấu giữ nguyên.")
    return _math_card("LÀM MỀM BẰNG BẢNG 1-2-1", (
        "R: (4x225 + 12x183) / 16 = 193.5 -> 194",
        "G: (4x 62 + 12x127) / 16 = 110.75 -> 111",
        "B: (4x 66 + 12x103) / 16 = 93.75 -> 94",
        "pixel mới = (194, 111, 94)",
        "độ đỏ mới = 194 - (111 + 94) / 2 = 91.5",
    ), width=310)


def show_numpy_mask(mask):
    """Render a two-dimensional NumPy 0/255 mask."""
    array = np.asarray(mask)
    if array.ndim != 2:
        raise MagicMirrorError("Ảnh đánh dấu phải là một bảng hai chiều: chiều cao và chiều rộng.")
    picture = Image.fromarray(np.where(array > 0, 255, 0).astype(np.uint8), "L").convert("RGB")
    print("Ảnh đánh dấu có kích thước %s và chọn %d pixel." % (array.shape, int((array > 0).sum())))
    return picture.resize(OUTPUT_SIZE, Image.Resampling.NEAREST)


def _numpy_convolve(pixels, kernel, divisor=1):
    """Apply one spatial kernel to all RGB channels with SciPy."""
    source = np.asarray(pixels, dtype=np.float32)
    weights = np.asarray(kernel, dtype=np.float32)[:, :, None]
    result = ndimage.convolve(source, weights, mode="nearest") / divisor
    return np.clip(np.rint(result), 0, 255).astype(np.uint8)


def _numpy_picture(array):
    array = np.asarray(array)
    if array.ndim != 3 or array.shape[2] != 3:
        raise MagicMirrorError("Hàm phải trả một bảng số có kích thước (height, width, 3).")
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), "RGB")


def numpy_filter_gallery():
    """Show three beginner NumPy filters that operate on the whole RGB grid."""
    original = skin_sample_image()
    pixels = np.asarray(original, dtype=np.int16)
    inverted = 255 - pixels
    brighter = np.clip(pixels + 35, 0, 255)
    red_only = pixels.copy()
    red_only[:, :, 1:] = 0
    print("Đảo màu dùng 255 - pixels; tăng sáng dùng np.clip; giữ đỏ gán hai kênh còn lại bằng 0.")
    return _tile_board(
        (original, _numpy_picture(inverted), _numpy_picture(brighter), _numpy_picture(red_only)),
        ("ẢNH GỐC", "ĐẢO MÀU", "TĂNG SÁNG +35", "CHỈ GIỮ KÊNH ĐỎ"),
    )


def numpy_kernel_gallery():
    """Apply three supplied kernels to one image."""
    original = skin_sample_image((48, 36))
    pixels = np.asarray(original, dtype=np.int16)
    blur = ((1, 1, 1), (1, 1, 1), (1, 1, 1))
    sharpen = ((0, -1, 0), (-1, 5, -1), (0, -1, 0))
    edge = ((-1, -1, -1), (-1, 8, -1), (-1, -1, -1))
    print("Cùng một hàm tính; chỉ thay bảng trọng số để làm mờ, làm nét hoặc tìm đường biên.")
    return _tile_board(
        (original, _numpy_picture(_numpy_convolve(pixels, blur, 9)),
         _numpy_picture(_numpy_convolve(pixels, sharpen)),
         _numpy_picture(_numpy_convolve(pixels, edge))),
        ("ẢNH GỐC", "LÀM MỜ / 9", "LÀM NÉT", "ĐƯỜNG BIÊN"),
    )


def preview_numpy_filter(function):
    """Run a student's NumPy filter without allowing it to mutate the input."""
    original = skin_sample_image()
    source = np.array(original, dtype=np.uint8, copy=True)
    before = source.copy()
    result = np.asarray(function(source))
    if not np.array_equal(source, before):
        raise MagicMirrorError("Hàm đang sửa trực tiếp bảng đầu vào; hãy tạo result = pixels.copy().")
    filtered = _numpy_picture(result)
    print("Ảnh đầu vào giữ nguyên. Bảng kết quả có kích thước %s và kiểu số %s." % (result.shape, result.dtype))
    return _tile_board((original, filtered), ("ẢNH ĐẦU VÀO", "ẢNH SAU KHI ĐỔI"))


def skin_sample_image(size=DEMO_SIZE):
    """Draw a synthetic face with visible red spots; no personal photo is required."""
    width, height = size
    image = Image.new("RGB", size, SKIN_BACKGROUND)
    draw = ImageDraw.Draw(image)

    face = (width * 22 // 100, height * 7 // 100,
            width * 78 // 100, height * 93 // 100)
    draw.ellipse(face, fill=SKIN_TONE)
    draw.ellipse((face[0] - 3, height * 39 // 100, face[0] + 4, height * 60 // 100),
                 fill=SKIN_SHADOW)
    draw.ellipse((face[2] - 4, height * 39 // 100, face[2] + 3, height * 60 // 100),
                 fill=SKIN_SHADOW)
    draw.pieslice(face, 180, 360, fill=(45, 37, 48))

    eye_y = height * 42 // 100
    for eye_x in (width * 40 // 100, width * 60 // 100):
        draw.ellipse((eye_x - 2, eye_y - 1, eye_x + 2, eye_y + 1), fill=(35, 30, 35))
    draw.arc((width * 41 // 100, height * 55 // 100,
              width * 59 // 100, height * 77 // 100), 10, 170, fill=SKIN_SHADOW, width=1)

    for spot_x, spot_y in ((40, 58), (55, 49), (51, 68)):
        x = width * spot_x // 100
        y = height * spot_y // 100
        draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=PIMPLE_RED)
    return image


def show_skin_sample():
    """Show the fixed Skin Lab input before students write any detector."""
    print("Ảnh mẫu có nền xanh, khuôn mặt và ba vùng đỏ được đặt trên má.")
    print("Em có thể dùng ảnh này khi camera bị chặn; bài không cần ảnh cá nhân.")
    return skin_sample_image().resize(OUTPUT_SIZE, Image.Resampling.NEAREST)


def _mask_picture(mask, on_color):
    values = np.asarray(mask)
    picture = np.zeros((*values.shape, 3), dtype=np.uint8)
    picture[:, :] = (28, 42, 48)
    picture[values > 0] = on_color
    return Image.fromarray(picture, "RGB")


def _mask_overlay(image, mask, color, alpha=0.55):
    """Keep the original colours visible and tint only pixels where the mask is on."""
    base = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    enabled = np.asarray(mask) > 0
    base[enabled] = base[enabled] * (1 - alpha) + np.asarray(color) * alpha
    return Image.fromarray(np.clip(np.rint(base), 0, 255).astype(np.uint8), "RGB")


def preview_library_convolution():
    """Use the student's SciPy wrapper on all three colour channels and show before/after."""
    original = skin_sample_image()
    pixels = np.asarray(original, dtype=np.float32)
    function = _student_function("convolve_layer")
    channels = [function(pixels[:, :, channel], SKIN_SOFTEN_KERNEL, 16) for channel in range(3)]
    combined = np.stack(channels, axis=2)
    filtered = _numpy_picture(combined)
    center = (original.width // 2, original.height // 2)
    before = original.getpixel(center)
    after = filtered.getpixel(center)
    print("SciPy dùng cùng một bảng trọng số cho ba bảng R, G, B; np.stack ghép ba kết quả thành ảnh RGB.")
    print("Pixel giữa: trước %s -> sau %s. Hình bên phải cho thấy màu sau khi ghép ba kênh." %
          (before, after))
    return _image_grid((original, filtered), ("ẢNH RGB BAN ĐẦU", "ẢNH SAU KHI GHÉP"), columns=2)


def preview_skin_evidence():
    """Show coloured inputs and the student's 0/255 decisions together."""
    rule = _student_function("skin_evidence")
    samples = (("DA (183,127,103)", SKIN_TONE),
               ("ĐỎ (225,62,66)", PIMPLE_RED),
               ("NỀN XANH (35,80,185)", SKIN_BACKGROUND))
    input_tiles = [Image.new("RGB", (80, 60), color) for _, color in samples]
    vote_tiles = [Image.new("RGB", (80, 60), (value, value, value))
                  for value in (rule(*color) for _, color in samples)]
    labels = [label for label, _ in samples] + ["ĐÁNH DẤU = %d" % rule(*color) for _, color in samples]
    print("Hàng trên là màu ban đầu. Hàng dưới là giá trị 0 hoặc 255 sau khi áp dụng cùng điều kiện RGB.")
    return _image_grid(tuple(input_tiles + vote_tiles), tuple(labels), columns=3, tile_size=(120, 90))


def preview_skin_mask():
    """Show the student's skin mask alone and over the original colours."""
    original = skin_sample_image()
    mask = np.asarray(_student_function("detect_skin")(original))
    print("skin_mask đánh dấu %d/%d pixel. Màu vàng chỉ đúng những vị trí có giá trị 255." %
          (int((mask > 0).sum()), mask.size))
    return _image_grid(
        (original, _mask_picture(mask, (245, 204, 166)),
         _mask_overlay(original, mask, (255, 210, 80))),
        ("ẢNH RGB", "VÙNG DA 0/255", "VÙNG DA TRÊN ẢNH"),
    )


def preview_pimple_mask():
    """Show the student's red-spot mask alone and over the original colours."""
    original = skin_sample_image()
    skin_mask = _student_function("detect_skin")(original)
    mask = np.asarray(_student_function("detect_pimples")(original, skin_mask))
    print("pimple_mask đánh dấu %d/%d pixel. Màu đỏ cho biết các giá trị 255 nằm ở đâu trên ảnh." %
          (int((mask > 0).sum()), mask.size))
    return _image_grid(
        (original, _mask_picture(mask, PIMPLE_RED),
         _mask_overlay(original, mask, (255, 35, 45), 0.7)),
        ("ẢNH RGB", "VÙNG ĐỎ 0/255", "VÙNG ĐỎ TRÊN ẢNH"),
    )


def preview_cleanup():
    """Show before, selective result, and a magnified colour difference."""
    original = skin_sample_image()
    cleaned = _require_image(_student_function("remove_pimples")(original), "remove_pimples")
    before = np.asarray(original, dtype=np.int16)
    after = np.asarray(cleaned, dtype=np.int16)
    difference = np.clip(np.abs(after - before) * 4, 0, 255).astype(np.uint8)
    sample_x, sample_y = original.width * 40 // 100, original.height * 58 // 100
    print("Pixel ở vùng đỏ: trước %s -> sau %s." %
          (tuple(before[sample_y, sample_x]), tuple(after[sample_y, sample_x])))
    print("Có %d/%d pixel đổi màu. Hình sai khác sáng ở nơi màu đã đổi; vùng tối được giữ nguyên." %
          (int(np.any(before != after, axis=2).sum()), before.shape[0] * before.shape[1]))
    return _image_grid(
        (original, cleaned, _numpy_picture(difference)),
        ("TRƯỚC", "SAU", "SAI KHÁC x4"),
    )


def skin_demo(size=DEMO_SIZE):
    """Show masks alone, masks over colour, and the selectively softened result."""
    original = skin_sample_image(size)
    skin_mask = _student_function("detect_skin")(original)
    pimple_mask = _student_function("detect_pimples")(original, skin_mask)
    cleaned = _require_image(_student_function("remove_pimples")(original), "remove_pimples")

    print("skin_mask đánh dấu %d pixel; pimple_mask đánh dấu %d pixel." %
          (int((np.asarray(skin_mask) > 0).sum()), int((np.asarray(pimple_mask) > 0).sum())))
    print("Mỗi vùng đánh dấu được phủ lên ảnh màu để em thấy chính xác pixel nào đã được chọn.")
    print("Ảnh cuối chỉ đổi màu trong pimple_mask; các pixel còn lại giữ nguyên.")
    return _image_grid(
        (original, _mask_picture(skin_mask, (245, 204, 166)),
         _mask_overlay(original, skin_mask, (255, 210, 80)),
         _mask_picture(pimple_mask, PIMPLE_RED),
         _mask_overlay(original, pimple_mask, (255, 35, 45), 0.7), cleaned),
        ("1 ẢNH RGB", "2 VÙNG DA", "3 VÙNG DA TRÊN ẢNH",
         "4 VÙNG ĐỎ", "5 VÙNG ĐỎ TRÊN ẢNH", "6 KẾT QUẢ"),
    )


# ===========================================================================
# Sample picture and grading
# ===========================================================================

def sample_image(size=DEMO_SIZE):
    """Test picture: colour gradient + white square + thin grid, so blur/sharpen show up.

    The white square sits off to the LEFT on purpose, so a left-right flip is obvious.
    """
    width, height = size
    across = np.linspace(COLOR_MIN, COLOR_MAX, width, dtype=np.uint8)
    down = np.linspace(COLOR_MIN, COLOR_MAX, height, dtype=np.uint8)
    frame = np.zeros((height, width, CHANNELS), dtype=np.uint8)
    frame[..., 0] = across[None, :]
    frame[..., 1] = down[:, None]
    frame[..., 2] = COLOR_MAX - across[None, :]
    frame[height // 4:height * 3 // 4:3, :] = COLOR_MIN
    frame[:, width // 4:width * 3 // 4:3] = COLOR_MIN
    frame[height // 3:height * 2 // 3, width // 6:width * 5 // 12] = COLOR_MAX
    return Image.fromarray(frame, "RGB")


def demo(fingers=0, size=DEMO_SIZE):
    """Run the filters on a still picture. Returns original and result side by side."""
    original = sample_image(size)
    result = process(original, fingers, size)
    gap = 8
    board = Image.new("RGB", (OUTPUT_SIZE[0] * 2 + gap, OUTPUT_SIZE[1]), PAPER_WARM)
    board.paste(original.resize(OUTPUT_SIZE, Image.NEAREST), (0, 0))
    board.paste(result.resize(OUTPUT_SIZE, Image.NEAREST), (OUTPUT_SIZE[0] + gap, 0))
    print("Giơ %s | Trái: ảnh gốc, Phải: sau bộ lọc" % _label(fingers))
    return board


TEST_RGB = (10, 20, 30)


def _flat_image(size, color=TEST_RGB):
    """A single-colour picture, used by the tests."""
    return Image.new("RGB", size, color)


def _try(name, test):
    """Run one test, print the verdict, return True when it passes."""
    try:
        problem = test()
    except MagicMirrorError as error:
        problem = str(error)
    except Exception as error:
        problem = "%s: %s" % (type(error).__name__, error)
    if problem:
        print("  CHUA  %s -> %s" % (name, problem))
        return False
    print("   OK   %s" % name)
    return True


def _test_scale_down():
    image = _student_function("scale_down")(_flat_image((8, 8)), 4, 4)
    if not isinstance(image, Image.Image) or image.size != (4, 4):
        return "phải trả về ảnh 4x4"
    return "" if image.load()[1, 1] == TEST_RGB else "chưa copy màu từ ảnh gốc sang"


def _test_scale_up():
    image = _student_function("scale_up")(_flat_image((4, 4)), 8, 8)
    if not isinstance(image, Image.Image) or image.size != (8, 8):
        return "phải trả về ảnh 8x8"
    return "" if image.load()[5, 5] == TEST_RGB else "chưa copy màu từ ảnh gốc sang"


def _test_grayscale():
    dot = _student_function("apply_grayscale")(_flat_image((4, 4))).load()[1, 1]
    if not dot[0] == dot[1] == dot[2]:
        return "ba giá trị R, G, B phải bằng nhau thì pixel mới có màu xám"
    average = sum(TEST_RGB) // CHANNELS
    return "" if dot[0] == average else "phải bằng (R+G+B)//3 = %d" % average


def _test_blur():
    if _student_function("apply_blur")(_flat_image((5, 5))).load()[2, 2] != TEST_RGB:
        return "ảnh một màu sau khi làm mờ phải giữ nguyên màu"
    dot = _flat_image((5, 5), _grey(COLOR_MIN))
    dot.load()[2, 2] = _grey(COLOR_MAX)
    middle = _student_function("apply_blur")(dot).load()[2, 2][0]
    return "" if COLOR_MIN < middle < COLOR_MAX else "chưa lấy trung bình 9 ô lân cận"


def _test_sharpen():
    if _student_function("apply_sharpen")(_flat_image((5, 5))).load()[2, 2] != TEST_RGB:
        return "ảnh một màu sau khi làm nét phải giữ nguyên màu"
    dot = _flat_image((5, 5), _grey(100))
    dot.load()[2, 2] = _grey(140)
    return "" if _student_function("apply_sharpen")(dot).load()[2, 2][0] > 140 else "chưa tăng tương phản"


TESTS = (
    ("scale_down  (thu nhỏ)", _test_scale_down),
    ("scale_up    (phóng to)", _test_scale_up),
    ("apply_grayscale (trắng đen)", _test_grayscale),
    ("apply_blur      (làm mờ)", _test_blur),
    ("apply_sharpen   (làm nét)", _test_sharpen),
)


def check_my_code():
    """Grade the five filter functions and print a report card."""
    print("=== TỰ CHẤM BÀI ===")
    passed = sum(1 for name, test in TESTS if _try(name, test))
    print("-" * 46)
    print("Kết quả: %d/%d hàm đã đúng." % (passed, len(TESTS)))
    if passed == len(TESTS):
        print("Tuyệt vời! Chạy magic_mirror.run() để soi gương thôi.")


# ---------------------------------------------------------------------------
# Skin Lab grading - kept separate so the original 5/5 grader does not change.
# ---------------------------------------------------------------------------

def _skin_test_image(size=(9, 9)):
    image = Image.new("RGB", size, SKIN_TONE)
    image.putpixel((size[0] // 2, size[1] // 2), PIMPLE_RED)
    return image


def _test_skin_convolution():
    layer = [[0 for _ in range(5)] for _ in range(5)]
    layer[2][2] = 9
    kernel = ((1, 1, 1), (1, 1, 1), (1, 1, 1))
    result = _student_function("convolve_layer")(layer, kernel, 9)
    values = np.asarray(result)
    if values.shape != (5, 5):
        return "phải trả một bảng số NumPy mới có kích thước (5, 5)"
    if values[2, 2] != 1:
        return "ô giữa phải là 9 chia đều cho cửa sổ 3x3, tức 1"
    if layer[2][2] != 9:
        return "đã ghi đè lên input; hãy đọc layer và ghi sang result"
    return ""


def _test_skin_evidence():
    rule = _student_function("skin_evidence")
    if rule(*SKIN_TONE) != COLOR_MAX or rule(92, 61, 49) != COLOR_MAX:
        return "luật cần nhận cả mẫu da sáng và tối trong bài kiểm tra"
    if rule(*SKIN_BACKGROUND) != COLOR_MIN:
        return "nền xanh không được đánh dấu là da"
    return ""


def _test_skin_mask():
    mask = np.asarray(_student_function("detect_skin")(_skin_test_image()))
    if mask.shape != (9, 9) or mask.dtype != np.uint8:
        return "phải trả skin_mask có kích thước (9, 9) và kiểu số uint8"
    if mask[4, 4] != COLOR_MAX:
        return "kết quả vùng 3x3 phải giữ pixel giữa là vùng da dù pixel đó có màu đỏ"
    blue = Image.new("RGB", (9, 9), SKIN_BACKGROUND)
    if np.asarray(_student_function("detect_skin")(blue))[4, 4] != COLOR_MIN:
        return "vùng nền xanh đang bị nhận nhầm là da"
    return ""


def _test_pimple_mask():
    image = _skin_test_image()
    skin_mask = _student_function("detect_skin")(image)
    mask = np.asarray(_student_function("detect_pimples")(image, skin_mask))
    if mask.shape != (9, 9) or mask.dtype != np.uint8:
        return "phải trả pimple_mask có kích thước (9, 9) và kiểu số uint8"
    if mask[4, 4] != COLOR_MAX:
        return "chưa tìm được chấm có độ đỏ cao hơn vùng da xung quanh"
    if mask[0, 0] != COLOR_MIN:
        return "góc không có vùng đỏ phải nhận giá trị 0"
    return ""


def _test_remove_pimples():
    image = _skin_test_image()
    before = image.copy()
    result = _student_function("remove_pimples")(image)
    if not isinstance(result, Image.Image) or result.size != image.size:
        return "phải trả về một ảnh PIL cùng kích thước"
    old = before.getpixel((4, 4))
    new = result.getpixel((4, 4))
    old_excess = old[0] - (old[1] + old[2]) / 2
    new_excess = new[0] - (new[1] + new[2]) / 2
    if new_excess >= old_excess:
        return "độ đỏ ở tâm chưa giảm sau khi làm mềm"
    if result.getpixel((0, 0)) != SKIN_TONE:
        return "pixel xa nốt đỏ phải được giữ nguyên"
    if image.getpixel((4, 4)) != PIMPLE_RED:
        return "không được sửa trực tiếp ảnh đầu vào"
    return ""


SKIN_TESTS = (
    ("convolve_layer", "convolve_layer  (bảng trọng số)", _test_skin_convolution),
    ("skin_evidence", "skin_evidence   (kiểm tra màu RGB)", _test_skin_evidence),
    ("detect_skin", "detect_skin     (xét vùng 3x3)", _test_skin_mask),
    ("detect_pimples", "detect_pimples  (đỏ hơn vùng 5x5)", _test_pimple_mask),
    ("remove_pimples", "remove_pimples  (làm mềm có chọn lọc)", _test_remove_pimples),
)


def check_skin_code():
    """Grade only the five functions in the isolated Skin Lab notebook."""
    print("=== TỰ CHẤM SKIN LAB ===")
    passed = 0
    progress = getattr(js, "MagicMirrorUI", None)
    for task_id, name, test in SKIN_TESTS:
        ok = _try(name, test)
        passed += int(ok)
        if progress is not None and hasattr(progress, "progress"):
            progress.progress(task_id, ok)
    print("-" * 54)
    print("Kết quả: %d/%d phần đã đúng." % (passed, len(SKIN_TESTS)))
    if passed == len(SKIN_TESTS):
        print("Tốt! Chạy magic_mirror.skin_demo(), rồi mới thử camera bằng run().")
