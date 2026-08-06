"""Bài giải Skin Lab: hiểu cơ chế bằng số nhỏ, xử lý ảnh thật bằng NumPy và SciPy."""

# === TASK: shared ===
import numpy as np
from PIL import Image
from scipy import ndimage


SKIN_VOTE_KERNEL = (
    (1, 1, 1),
    (1, 1, 1),
    (1, 1, 1),
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
    """Dùng bảng trọng số với SciPy và trả về một bảng số NumPy mới."""
    values = np.asarray(layer, dtype=np.float32)
    weights = np.asarray(kernel, dtype=np.float32)
    filtered = ndimage.convolve(values, weights, mode="nearest")
    return filtered / divisor


# === TASK: skin_evidence ===
def skin_evidence(red, green, blue):
    """Áp dụng cùng một luật RGB cho một pixel hoặc cả ba kênh NumPy."""
    red = np.asarray(red, dtype=np.int16)
    green = np.asarray(green, dtype=np.int16)
    blue = np.asarray(blue, dtype=np.int16)

    brightness = (red + green + blue) // 3
    warmth = red - blue
    red_green_gap = red - green
    looks_like_skin = (
        (brightness >= 35) & (brightness <= 240)
        & (warmth >= 8)
        & (red_green_gap >= -10) & (red_green_gap <= 90)
    )
    result = np.where(looks_like_skin, MASK_ON, MASK_OFF).astype(np.uint8)
    return int(result) if result.ndim == 0 else result


# === TASK: detect_skin ===
def detect_skin(img):
    """Tạo ảnh đánh dấu vùng da từ ba kênh màu và vùng 3x3."""
    pixels = np.asarray(img.convert("RGB"), dtype=np.int16)
    raw_mask = skin_evidence(
        pixels[:, :, 0],
        pixels[:, :, 1],
        pixels[:, :, 2],
    )
    votes = convolve_layer(raw_mask, SKIN_VOTE_KERNEL, 9)
    needed = MASK_ON * SKIN_NEIGHBOURS_NEEDED / 9
    return np.where(votes >= needed, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: detect_pimples ===
def detect_pimples(img, skin_mask):
    """Tìm điểm đỏ nổi bật trong vùng 5x5 rồi mở rộng vùng được chọn."""
    pixels = np.asarray(img.convert("RGB"), dtype=np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    redness = np.maximum(0, red - (green + blue) / 2)
    local_redness = ndimage.uniform_filter(redness, size=5, mode="nearest")
    candidate = (
        (np.asarray(skin_mask) == MASK_ON)
        & (redness - local_redness >= PIMPLE_RED_GAP)
    )
    expanded = ndimage.maximum_filter(candidate, size=3, mode="nearest")
    return np.where(expanded, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: remove_pimples ===
def remove_pimples(img):
    """Làm mềm nơi pimple_mask bằng 255 và giữ nguyên mọi pixel còn lại."""
    source = img.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    skin_mask = detect_skin(source)
    pimple_mask = detect_pimples(source, skin_mask)

    weights = np.asarray(SOFTEN_KERNEL, dtype=np.float32)[:, :, None]
    softened = ndimage.convolve(pixels, weights, mode="nearest") / weights.sum()
    combined = np.where(pimple_mask[:, :, None] == MASK_ON, softened, pixels)
    output = np.clip(np.rint(combined), 0, 255).astype(np.uint8)
    return Image.fromarray(output, "RGB")
