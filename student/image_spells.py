# ============================================================================
#  BÀI TẬP 2 — CÁC PHÉP XỬ LÝ ẢNH
#  Cùng đề bài với trang làm bài. Sửa xong bấm R ở sân khấu, bấm T để chấm.
# ============================================================================

from magic_stage import new_image


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# Ô ở cột col phải lấy màu của ô cột  width - 1 - col  trong CÙNG hàng.
# Ảnh rộng 5 cột: cột 0 lấy cột 4 · cột 1 lấy cột 3 · cột 2 lấy chính nó.
def flip(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn: sửa cột bên phải dấu bằng cho đúng
            out[row][col] = image[row][col]


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# Hàng xóm của ô [row][col] là các ô [row + dr][col + dc] với dr, dc chạy
# -1, 0, 1. Hai chỗ dễ sai:
#   1. Ô sát mép chỉ có 4 hoặc 6 hàng xóm. Chia cứng cho 9 thì viền ảnh tối
#      sầm. Phải ĐẾM số ô cộng được rồi chia cho con số đó.
#   2. Hàng xóm rơi ra ngoài ảnh thì bỏ qua bằng continue. Chỉ số âm trong
#      Python KHÔNG báo lỗi — nó đếm ngược từ cuối, ảnh sẽ mọc vệt lạ ở mép.
def blur(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn: cộng màu các ô quanh đây rồi chia trung bình
            out[row][col] = image[row][col]


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# strength là MỘT số từ 0 tới 100 (phần trăm), không phải ảnh.
#     strength = 0   -> giữ nguyên ảnh nền
#     strength = 100 -> chỉ còn lớp trên
#     strength = 30  -> 70 phần nền + 30 phần lớp trên
#
# Công thức cho MỖI màu:
#     (nen * (100 - strength) + tren * strength) // 100
#
# Dùng // để kết quả là số nguyên; màu không nhận số lẻ.
def blend_alpha(image, layer, strength, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn: pha hai màu theo tỉ lệ
            out[row][col] = image[row][col]


# person     = ảnh người, dạng person[row][col] -> [đỏ, lá, dương]
# background = ảnh nền, cùng kích thước
# mask       = MẶT NẠ, mask[row][col] là MỘT SỐ chứ không phải ba:
#              255 chắc chắn là người · 0 chắc chắn là nền · ở giữa thì lửng lơ
# out        = ảnh bạn dựng ra
#
# Mốc chia là 128: lớn hơn thì coi là người.
def compose(person, mask, background, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn: hỏi mặt nạ rồi lấy màu từ đúng tấm ảnh
            out[row][col] = background[row][col]


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# layer = lớp hiệu ứng quay trên nền đen, cùng kích thước với image.
# Số màu chỉ chạy từ 0 tới 255, cộng quá thì kẹp bằng min(255, ...).
#
# Gợi ý: đặt tên cho hai ô trước cho dễ đọc, rồi mới cộng.
#     base = image[row][col]
#     glow = layer[row][col]
def blend(image, layer, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn: cộng ô của image với ô của layer rồi kẹp ở 255
            out[row][col] = image[row][col]


# Hai hàm bạn đã viết, giờ đem ra dùng lại:
#     blur(image, ket_qua, width, height)
#     compose(person, mask, background, ket_qua, width, height)
#     new_image(width, height)   -> tấm ảnh trống để chứa kết quả tạm
#
# Ý chính: "người" là ảnh GỐC, còn "nền" là bản ĐÃ LÀM MỜ.
def blur_background(image, mask, out, width, height):
    # lượt của bạn: làm mờ ra tấm tạm, rồi chọn theo mặt nạ
    out[0][0] = image[0][0]


# Bài này không có phép tính mới — chỉ gọi lại hàm CỦA BẠN.
#
#     blend(anh, lop, ket_qua, width, height)
#     compose(person, mask, background, ket_qua, width, height)
#     new_image(width, height)   -> một tấm ảnh trống để chứa kết quả tạm
#
# Đừng ghi kết quả tạm vào chính tấm đang đọc: hàm sẽ vừa đọc vừa sửa một chỗ.
def scene(person, mask, background, behind, front, out, width, height):
    # lượt của bạn: ba bước — nền+behind, dán người, phủ front
    compose(person, mask, background, out, width, height)


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# Lật thang sáng: giá trị mới = 255 - giá trị cũ, làm cho cả ba màu.
# Đặt tên ô trước cho gọn:  pixel = image[row][col]
def negative(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# Ba số phải BẰNG NHAU thì mắt mới thấy là ảnh xám.
# Tính trung bình MỘT lần rồi dùng ba lần, đừng tính lại ba lần.
# Chia lấy phần nguyên bằng //, vì màu phải là số nguyên.
def grayscale(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# So với flip: lần này chỗ đảo nằm ở HÀNG, còn cột thì giữ nguyên.
def flip_vertical(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]


# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
# out   = ảnh BẠN DỰNG RA. Ban đầu toàn màu đen, bạn ghi màu vào đây.
#
# Ảnh là bảng ô vuông xếp theo HÀNG và CỘT, đánh số từ 0:
#
#     image[row][col]  ->  [đỏ, xanh lá, xanh dương]     mỗi số từ 0 tới 255
#
#     image[0][0]      ô góc trên bên trái
#     image[0][1]      ô kế bên phải nó
#     image[1][0]      ô ngay bên dưới ô đầu
#
# Lấy riêng một màu thì thêm một dấu ngoặc nữa:
#     image[row][col][0] là đỏ · [1] xanh lá · [2] xanh dương
#
# width = số cột · height = số hàng
#
# Giữ nguyên đỏ và xanh lá, cho xanh dương bằng 0.
def drop_blue(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]
