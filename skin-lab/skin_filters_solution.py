"""Bài giải Skin Lab: một pipeline tích chập viết tay, không huấn luyện mô hình."""

# === TASK: shared ===
from PIL import Image


SKIN_VOTE_KERNEL = (
    (1, 1, 1),
    (1, 1, 1),
    (1, 1, 1),
)

LOCAL_RED_KERNEL = (
    (1, 1, 1, 1, 1),
    (1, 1, 1, 1, 1),
    (1, 1, 1, 1, 1),
    (1, 1, 1, 1, 1),
    (1, 1, 1, 1, 1),
)

SOFTEN_KERNEL = (
    (1, 2, 1),
    (2, 4, 2),
    (1, 2, 1),
)

MASK_OFF, MASK_ON = 0, 255
SKIN_NEIGHBOURS_NEEDED = 5
PIMPLE_RED_GAP = 24


# === TASK: convolve_layer ===
def convolve_layer(layer, kernel, divisor):
    """Trượt một kernel vuông qua ma trận số; giữ nguyên viền thiếu hàng xóm."""
    height = len(layer)
    width = len(layer[0])
    radius = len(kernel) // 2
    result = [row[:] for row in layer]

    for y in range(radius, height - radius):
        for x in range(radius, width - radius):
            total = 0
            for ky in range(-radius, radius + 1):
                for kx in range(-radius, radius + 1):
                    weight = kernel[ky + radius][kx + radius]
                    total += layer[y + ky][x + kx] * weight
            result[y][x] = total / divisor

    return result


# === TASK: skin_evidence ===
def skin_evidence(red, green, blue):
    """Một luật RGB viết tay; không phải mô hình học máy hay phép đo y khoa."""
    brightness = (red + green + blue) // 3
    warmth = red - blue
    red_green_gap = red - green

    looks_like_skin = (
        35 <= brightness <= 240
        and warmth >= 8
        and -10 <= red_green_gap <= 90
    )
    return MASK_ON if looks_like_skin else MASK_OFF


# === TASK: detect_skin ===
def detect_skin(img):
    """Kết hợp bằng chứng RGB với phiếu của 9 pixel trong một lớp tích chập."""
    width, height = img.size
    pixels = img.convert("RGB").load()
    raw_mask = [
        [skin_evidence(*pixels[x, y]) for x in range(width)]
        for y in range(height)
    ]
    votes = convolve_layer(raw_mask, SKIN_VOTE_KERNEL, 9)
    needed = MASK_ON * SKIN_NEIGHBOURS_NEEDED / 9
    return [
        [MASK_ON if votes[y][x] >= needed else MASK_OFF for x in range(width)]
        for y in range(height)
    ]


# === TASK: detect_pimples ===
def detect_pimples(img, skin_mask):
    """So độ đỏ của mỗi pixel với mức đỏ trung bình trong cửa sổ 5x5."""
    width, height = img.size
    pixels = img.convert("RGB").load()
    redness = [
        [max(0, pixels[x, y][0] - (pixels[x, y][1] + pixels[x, y][2]) / 2)
         for x in range(width)]
        for y in range(height)
    ]
    local_redness = convolve_layer(redness, LOCAL_RED_KERNEL, 25)
    candidates = [
        [MASK_ON if (
            skin_mask[y][x] == MASK_ON
            and redness[y][x] - local_redness[y][x] >= PIMPLE_RED_GAP
        ) else MASK_OFF for x in range(width)]
        for y in range(height)
    ]

    expanded = convolve_layer(candidates, SKIN_VOTE_KERNEL, 1)
    return [
        [MASK_ON if expanded[y][x] > 0 else MASK_OFF for x in range(width)]
        for y in range(height)
    ]


# === TASK: remove_pimples ===
def remove_pimples(img):
    """Làm mềm các pixel trong pimple mask và giữ nguyên phần còn lại."""
    source = img.convert("RGB")
    width, height = source.size
    pixels = source.load()
    skin_mask = detect_skin(source)
    pimple_mask = detect_pimples(source, skin_mask)

    channels = [
        [[pixels[x, y][channel] for x in range(width)] for y in range(height)]
        for channel in range(3)
    ]
    softened = [convolve_layer(layer, SOFTEN_KERNEL, 16) for layer in channels]

    result = source.copy()
    output = result.load()
    for y in range(height):
        for x in range(width):
            if pimple_mask[y][x] == MASK_ON:
                output[x, y] = tuple(
                    max(0, min(255, round(softened[channel][y][x])))
                    for channel in range(3)
                )
    return result
