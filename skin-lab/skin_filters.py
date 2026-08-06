"""Bài thực hành Skin Lab: tự viết một lớp tích chập, không huấn luyện mô hình.

Em hoàn thành năm hàm theo đúng đường đi của dữ liệu:

    convolve_layer  ->  skin_evidence  ->  detect_skin
                    ->  detect_pimples ->  remove_pimples

Đây là bộ lọc minh hoạ cách máy xử lý pixel. Nó không chẩn đoán da hay thay thế
ý kiến của bác sĩ, và kết quả sẽ thay đổi theo ánh sáng, camera và màu nền.
"""

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
    """Trượt một kernel vuông qua ma trận số và trả về một ma trận mới.

    Các ô ở viền được giữ nguyên vì kernel không có đủ hàng xóm ở đó.
    """
    # NHIỆM VỤ 1.
    # Giá trị cho sẵn: layer, kernel và divisor được truyền vào hàm.
    # 1. Lấy height, width và radius = len(kernel) // 2.
    # 2. Tạo result là bản sao từng hàng: [row[:] for row in layer].
    # 3. Với mỗi ô không nằm ở viền, đặt total = 0.
    # 4. Dùng hai vòng lặp ky, kx để cộng:
    #       layer[y + ky][x + kx] * kernel[ky + radius][kx + radius]
    # 5. Ghi total / divisor vào result[y][x].
    # Nhớ đọc từ layer và ghi vào result, nếu không kết quả phía sau sẽ bị ảnh hưởng.
    pass


# === TASK: skin_evidence ===
def skin_evidence(red, green, blue):
    """Một luật RGB viết tay: pixel này có giống màu da dưới ánh sáng ấm không?"""
    # NHIỆM VỤ 2.
    # Giá trị cho sẵn: red, green, blue của một pixel được truyền vào hàm.
    # brightness = (red + green + blue) // 3
    # warmth = red - blue
    # red_green_gap = red - green
    # Trả MASK_ON nếu:
    #   35 <= brightness <= 240
    #   warmth >= 8
    #   -10 <= red_green_gap <= 90
    # Còn lại trả MASK_OFF.
    pass


# === TASK: detect_skin ===
def detect_skin(img):
    """Tìm vùng da bằng luật màu rồi cho mỗi pixel lấy phiếu của vùng 3x3."""
    width, height = img.size
    pixels = img.convert("RGB").load()

    # NHIỆM VỤ 3.
    # Giá trị cho sẵn: img là một ảnh PIL. Hãy tạo mask mới, không sửa img.
    # 1. Tạo raw_mask: ma trận height hàng x width cột.
    # 2. Mỗi ô gọi skin_evidence(*pixels[x, y]).
    # 3. Gọi convolve_layer(raw_mask, SKIN_VOTE_KERNEL, 9) để lấy mức phiếu trung bình.
    # 4. Nếu mức phiếu >= MASK_ON * SKIN_NEIGHBOURS_NEEDED / 9 thì bật mask.
    # Trả về mask gồm toàn MASK_OFF hoặc MASK_ON.
    pass


# === TASK: detect_pimples ===
def detect_pimples(img, skin_mask):
    """Tìm chấm đỏ hơn vùng da xung quanh, rồi nới mask ra thêm một ô."""
    width, height = img.size
    pixels = img.convert("RGB").load()

    # NHIỆM VỤ 4.
    # Giá trị cho sẵn: img và skin_mask từ nhiệm vụ trước.
    # 1. redness[y][x] = max(0, red - (green + blue) / 2).
    # 2. local_redness = convolve_layer(redness, LOCAL_RED_KERNEL, 25).
    # 3. Bật candidate nếu skin_mask đang bật và:
    #       redness[y][x] - local_redness[y][x] >= PIMPLE_RED_GAP
    # 4. Tích chập candidate bằng SKIN_VOTE_KERNEL với divisor=1.
    #    Ô nào kết quả > 0 thì bật: bước này phủ luôn các pixel sát chấm đỏ.
    pass


# === TASK: remove_pimples ===
def remove_pimples(img):
    """Làm mềm đúng vùng được phát hiện; mọi pixel khác phải giữ nguyên."""
    source = img.convert("RGB")
    width, height = source.size
    pixels = source.load()

    # NHIỆM VỤ 5.
    # Giá trị cho sẵn: img là ảnh cần xử lý. Hãy trả về một ảnh mới.
    # 1. Gọi detect_skin và detect_pimples.
    # 2. Tách ảnh thành ba ma trận red_layer, green_layer, blue_layer.
    # 3. Tích chập từng ma trận bằng SOFTEN_KERNEL, divisor=16.
    # 4. result = source.copy(). Chỉ ở nơi pimple_mask bật, ghi pixel đã làm mềm:
    #       tuple(max(0, min(255, round(value))) for value in (...))
    # 5. return result.
    pass
