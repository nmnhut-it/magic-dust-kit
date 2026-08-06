"""Skin Lab: hiểu cơ chế bằng số nhỏ, xử lý ảnh thật bằng NumPy và SciPy.

Em hoàn thành năm hàm theo đường đi của dữ liệu:

    convolve_layer  ->  skin_evidence  ->  detect_skin
                    ->  detect_pimples ->  remove_pimples

Đây là bộ lọc minh họa cách máy xử lý pixel. Nó không chẩn đoán da hay thay thế
ý kiến của bác sĩ. Kết quả có thể đổi theo ánh sáng, camera và màu nền.
"""

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
    # NHIỆM VỤ 1.
    # Giá trị cho sẵn: layer, kernel và divisor.
    # 1. Đổi layer và kernel thành bảng số NumPy có kiểu số np.float32.
    # 2. Gọi ndimage.convolve(values, weights, mode="nearest").
    # 3. Chia toàn bộ bảng kết quả cho divisor rồi trả về.
    values = np.asarray(layer, dtype=np.float32)
    weights = np.asarray(kernel, dtype=np.float32)
    filtered = ndimage.convolve(___, ___, mode="nearest")
    return ___ / divisor


# === TASK: skin_evidence ===
def skin_evidence(red, green, blue):
    """Áp dụng cùng một luật RGB cho một pixel hoặc cả ba kênh NumPy."""
    red = np.asarray(red, dtype=np.int16)
    green = np.asarray(green, dtype=np.int16)
    blue = np.asarray(blue, dtype=np.int16)

    # NHIỆM VỤ 2.
    # Tính ba bảng brightness, warmth và red_green_gap.
    # Dùng &, không dùng and, vì mỗi điều kiện được áp dụng cho cả ảnh.
    brightness = (red + green + blue) // 3
    warmth = ___
    red_green_gap = ___
    looks_like_skin = (
        (brightness >= 35) & (brightness <= 240)
        & (warmth >= 8)
        & (red_green_gap >= -10) & (red_green_gap <= 90)
    )
    result = np.where(___, MASK_ON, MASK_OFF).astype(np.uint8)
    return int(result) if result.ndim == 0 else result


# === TASK: detect_skin ===
def detect_skin(img):
    """Tạo ảnh đánh dấu vùng da từ ba kênh màu và vùng 3x3."""
    # NHIỆM VỤ 3.
    # 1. Đổi ảnh PIL thành bảng pixels có kích thước (height, width, 3).
    # 2. Đưa ba kênh màu vào skin_evidence để tạo raw_mask.
    # 3. Tính mức trung bình trong vùng 3x3 bằng convolve_layer.
    # 4. Dùng np.where để tạo skin_mask chỉ gồm 0 và 255.
    pixels = np.asarray(img.convert("RGB"), dtype=np.int16)
    raw_mask = skin_evidence(
        pixels[:, :, 0],
        pixels[:, :, 1],
        pixels[:, :, 2],
    )
    votes = convolve_layer(___, SKIN_VOTE_KERNEL, 9)
    needed = MASK_ON * SKIN_NEIGHBOURS_NEEDED / 9
    return np.where(___ >= needed, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: detect_pimples ===
def detect_pimples(img, skin_mask):
    """Tìm điểm đỏ nổi bật trong vùng 5x5 rồi mở rộng vùng được chọn."""
    # NHIỆM VỤ 4.
    # uniform_filter tính trung bình vùng 5x5.
    # maximum_filter mở rộng vùng tạm được chọn sang các pixel sát bên.
    pixels = np.asarray(img.convert("RGB"), dtype=np.float32)
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    redness = np.maximum(0, red - (green + blue) / 2)
    local_redness = ndimage.uniform_filter(___, size=5, mode="nearest")
    candidate = (
        (np.asarray(skin_mask) == MASK_ON)
        & (redness - local_redness >= PIMPLE_RED_GAP)
    )
    expanded = ndimage.maximum_filter(___, size=3, mode="nearest")
    return np.where(expanded, MASK_ON, MASK_OFF).astype(np.uint8)


# === TASK: remove_pimples ===
def remove_pimples(img):
    """Làm mềm nơi pimple_mask bằng 255 và giữ nguyên mọi pixel còn lại."""
    # NHIỆM VỤ 5.
    # 1. Tạo skin_mask và pimple_mask bằng hai hàm trước.
    # 2. Thêm một chiều để kernel có kích thước (3, 3, 1), nhờ đó không trộn R, G, B.
    # 3. ndimage.convolve làm mềm ba kênh trong một lần gọi.
    # 4. np.where chỉ lấy màu mềm ở nơi pimple_mask bằng 255.
    source = img.convert("RGB")
    pixels = np.asarray(source, dtype=np.float32)
    skin_mask = detect_skin(source)
    pimple_mask = detect_pimples(source, skin_mask)

    weights = np.asarray(SOFTEN_KERNEL, dtype=np.float32)[:, :, None]
    softened = ndimage.convolve(___, weights, mode="nearest") / weights.sum()
    combined = np.where(___[:, :, None] == MASK_ON, softened, pixels)
    output = np.clip(np.rint(combined), 0, 255).astype(np.uint8)
    return Image.fromarray(output, "RGB")
