// cells.js — chín đề bài của trang làm bài.
//
// Mỗi ô gồm: nguyên lý (máy làm gì với từng điểm ảnh), đề bài (vào gì, làm gì,
// ra gì), đoạn code có sẵn để học sinh sửa, và đáp án kèm lời giải thích —
// đáp án bị khoá bằng mật khẩu để bố mẹ mở ra giảng khi con bí.
//
// ẢNH LÀ MẢNG HAI CHIỀU: image[row][col] cho ra [đỏ, xanh lá, xanh dương].
// Bản đầu duỗi ảnh thành một danh sách dài và bắt học sinh tự tính
// (row * width + col) * 4 — nhanh hơn chút nhưng trẻ con không hình dung nổi,
// nên đã bỏ. Đo tại chỗ: 55ms so với 70ms mỗi khung hình, đổi lấy sự dễ hiểu.
//
// Ảnh demo: cảnh sân cổng Kotopia cho hầu hết các phép (nhiều màu, hai bên
// khác hẳn nhau nên lật là thấy ngay). Riêng `blend` dùng nền TỐI, vì cộng một
// lớp sáng lên nền vốn đã sáng thì trắng xoá, chẳng nhìn ra gì.
export const SCENE = './lessons/assets/storybook/portal-courtyard-v3.webp';
export const DARK_SCENE = './lessons/assets/camera-effects/plates/fx-boss.webp';
export const LAYER = './lessons/assets/camera-effects/plates/fx-dragon.webp';
// Nhân vật có nền trong suốt: kênh độ đục của chính file này thành MẶT NẠ, nên
// bài ghép nền có đồ thật để chạy mà không cần chụp ảnh ai.
export const PERSON = './lessons/assets/mirror-wraith.webp';
// Bài cuối cần bốn lớp: nền, lớp sau lưng, người, hiệu ứng phủ trước.
export const BEHIND = './lessons/assets/camera-effects/plates/fx-boss.webp';

// Khối chú thích dán đầu mỗi bài ảnh, để học sinh không phải nhớ image là gì.
const PIXEL_HEADER = `# image = ảnh MÁY ĐƯA CHO BẠN. Chỉ đọc, đừng sửa.
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
# width = số cột · height = số hàng`;

// Phép nào ra clip nào. Trang làm bài dùng bảng này để CHIẾU THẬT hiệu ứng mà
// mã học sinh vừa gọi — gọi play_effect("dragon") mà chỉ thấy dòng chữ
// play_effect("dragon") thì chán chết.
export const EFFECT_CLIPS = {
  koto: './lessons/assets/camera-effects/overlays/koto-stag.mp4',
  dragon: './lessons/assets/camera-effects/overlays/dragon-strike.mp4',
  rose: './lessons/assets/camera-effects/overlays/spirit-rose.mp4',
  phoenix: './lessons/assets/camera-effects/overlays/spirit-phoenix.mp4',
  butterfly: './lessons/assets/camera-effects/overlays/crystal-butterflies.mp4',
  sakura: './lessons/assets/camera-effects/overlays/sakura-bloom.mp4',
  smoke: './lessons/assets/camera-effects/overlays/smoke-blue.mp4',
  lightning: './lessons/assets/camera-effects/overlays/lightning-ground.mp4',
  rain: './lessons/assets/camera-effects/overlays/rain-storm.mp4',
  flower: './lessons/assets/camera-effects/overlays/flower-pink.mp4',
  magic: './lessons/assets/camera-effects/overlays/glyph-white.mp4',
};

export const CELLS = [
  {
    id: 'flip', kind: 'image', title: 'flip — soi gương trái phải',
    idea: `Lật ảnh KHÔNG phải xoay tấm ảnh. Máy chỉ chép màu sang chỗ khác: ô ngoài cùng
bên trái lấy màu của ô ngoài cùng bên phải, ô thứ hai từ trái lấy màu ô thứ hai
từ phải, cứ thế đổi chỗ từng cặp. Hàng giữ nguyên — chỉ số CỘT đảo lại.`,
    input: 'Ảnh `image` rộng `width` cột, cao `height` hàng.',
    job: 'Với mỗi ô, chép màu của ô đối xứng với nó qua trục dọc giữa ảnh sang `out`.',
    output: 'Ảnh trong gương: cảnh bên trái nhảy sang phải và ngược lại.',
    stub: `${PIXEL_HEADER}
#
# Ô ở cột col phải lấy màu của ô cột  width - 1 - col  trong CÙNG hàng.
# Ảnh rộng 5 cột: cột 0 lấy cột 4 · cột 1 lấy cột 3 · cột 2 lấy chính nó.
def flip(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn: sửa cột bên phải dấu bằng cho đúng
            out[row][col] = image[row][col]
`,
    answer: `def flip(image, out, width, height):
    for row in range(height):
        for col in range(width):
            out[row][col] = image[row][width - 1 - col]
`,
    why: `Chỉ một dòng. Bên trái dấu bằng là chỗ GHI (\`out[row][col]\`), bên phải là chỗ
LẤY màu (\`image[row][width - 1 - col]\`). Hàng \`row\` giống nhau ở cả hai bên vì
lật ngang không đụng tới hàng. Thử số cho dễ tin: ảnh rộng 5, ô cột 0 lấy
\`5 - 1 - 0\` = cột 4, đúng là ô ngoài cùng bên phải.`,
  },
  {
    id: 'blur', kind: 'image', title: 'blur — làm mờ',
    idea: `Ảnh nét là vì hai ô cạnh nhau có màu chênh nhau nhiều. Muốn mờ thì kéo các ô
lại gần nhau: mỗi ô lấy màu trung bình của chính nó và các ô hàng xóm quanh nó.
Chênh lệch bị san phẳng, mắt đọc ra là nhoè.`,
    input: 'Ảnh `image`; mỗi ô có tối đa 8 hàng xóm, ít hơn nếu nó nằm sát mép.',
    job: 'Cộng màu của ô và các hàng xóm CÓ THẬT, đếm xem cộng được mấy ô, rồi chia cho đúng con số đó.',
    output: 'Ảnh nhoè đi, cạnh vật thể không còn sắc.',
    stub: `${PIXEL_HEADER}
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
`,
    answer: `def blur(image, out, width, height):
    for row in range(height):
        for col in range(width):
            red = green = blue = count = 0
            for row_step in (-1, 0, 1):
                near_row = row + row_step
                if near_row < 0 or near_row >= height:
                    continue
                for col_step in (-1, 0, 1):
                    near_col = col + col_step
                    if near_col < 0 or near_col >= width:
                        continue
                    pixel = image[near_row][near_col]
                    red = red + pixel[0]
                    green = green + pixel[1]
                    blue = blue + pixel[2]
                    count = count + 1
            out[row][col] = [red // count, green // count, blue // count]
`,
    why: `Hai vòng lặp trong (\`row_step\`, \`col_step\` chạy -1, 0, 1) đi hết khối vuông 9 ô
quanh ô đang xét. \`continue\` bỏ qua ô nằm ngoài ảnh, nên \`count\` là số ô THẬT
SỰ cộng được: giữa ảnh 9, cạnh 6, góc 4. Chia cho \`count\` chứ không chia cho 9
— đó là lý do viền ảnh không bị tối. \`//\` là chia lấy phần nguyên, vì màu phải
là số nguyên.`,
  },
  {
    id: 'blend_alpha', kind: 'blend_alpha', title: 'blend_alpha — đè ảnh lên ảnh, pha theo tỉ lệ',
    idea: `\`blend\` cộng ánh sáng nên chỉ hợp với thứ tự PHÁT SÁNG: lửa, sét, hào quang.
Đem cộng một tấm ảnh thường lên ảnh khác thì trắng bệch, xấu ngay.

Muốn ĐÈ một tấm ảnh lên tấm khác thì phải PHA: lấy một phần của ảnh dưới cộng
với phần còn lại của ảnh trên. Đè 30% nghĩa là mỗi màu lấy 70 phần nền và 30
phần lớp trên, rồi chia cho 100. Đó chính là cái mà mọi phần mềm ảnh gọi là độ
mờ (alpha, opacity).`,
    input: '`image` (ảnh dưới), `layer` (ảnh đè lên), `strength` — một số 0..100: 0 là không đè gì, 100 là che hẳn.',
    job: 'Với mỗi màu: `(màu_nền × (100 - strength) + màu_trên × strength) // 100`.',
    output: 'Hai ảnh chồng nhau mờ ảo, chỉnh `strength` là chỉnh độ đậm nhạt.',
    stub: `${PIXEL_HEADER}
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
`,
    answer: `def blend_alpha(image, layer, strength, out, width, height):
    rest = 100 - strength
    for row in range(height):
        for col in range(width):
            base = image[row][col]
            top = layer[row][col]
            out[row][col] = [(base[0] * rest + top[0] * strength) // 100,
                             (base[1] * rest + top[1] * strength) // 100,
                             (base[2] * rest + top[2] * strength) // 100]
`,
    why: `\`rest\` tính một lần ngoài vòng lặp, vì nó không đổi — tính lại mấy nghìn lần
chẳng để làm gì. Thử \`strength = 0\` rồi \`= 100\` để tự kiểm: một đằng phải ra
đúng ảnh nền, một đằng ra đúng lớp trên. Hai mốc đó chứng minh công thức đúng
mà không cần tính tay.

Khi nào dùng cái nào: \`blend\` (cộng) cho thứ PHÁT SÁNG — lửa, sét, bụi phép.
\`blend_alpha\` (pha) cho thứ CHE MẤT phía sau — dán ảnh, làm mờ dần, chuyển
cảnh. Phần mềm dựng phim thật cũng chia đúng hai kiểu đó.`,
  },
  {
    id: 'compose', kind: 'compose', title: 'compose — ghép nền, người, rồi hiệu ứng',
    idea: `Phim trường xanh làm thế này: máy có một tấm MẶT NẠ nói rõ ô nào là người, ô
nào không. Ghép ảnh chỉ là đi từng ô rồi hỏi một câu — ô này là người hay là
nền? — và lấy màu từ tấm tương ứng. Đúng \`if / else\` bạn đã viết ở bài chọn
phép, lần này hỏi trên từng điểm ảnh.`,
    input: '`person` (ảnh người), `mask` (mặt nạ: `mask[row][col]` là một SỐ 0..255, càng lớn càng chắc là người), `background` (ảnh nền).',
    job: 'Ô nào mặt nạ lớn hơn 128 thì lấy màu của `person`, còn lại lấy màu của `background`.',
    output: 'Người đứng trên nền mới. Ghép tiếp `blend` nữa là có cả hiệu ứng phía trước.',
    stub: `# person     = ảnh người, dạng person[row][col] -> [đỏ, lá, dương]
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
`,
    answer: `def compose(person, mask, background, out, width, height):
    for row in range(height):
        for col in range(width):
            if mask[row][col] > 128:
                out[row][col] = person[row][col]
            else:
                out[row][col] = background[row][col]
`,
    why: `Vẫn là \`if / else\` của bài chọn phép, chỉ khác chỗ câu hỏi chạy trên từng ô
ảnh. \`mask[row][col]\` chỉ có MỘT số nên không cần ngoặc thứ ba — nó không phải
màu, nó là mức chắc chắn. Đổi 128 thành số khác là viền người dày mỏng khác
nhau; thử 60 rồi thử 200 để thấy.`,
  },
  {
    id: 'blend', kind: 'blend', title: 'blend — ghép lớp hiệu ứng',
    idea: `Ghép hai ảnh KHÔNG phải dán đè, mà là CỘNG ÁNH SÁNG. Chỗ nào của lớp hiệu ứng
màu đen thì ba số gần 0, cộng vào nền gần như không đổi gì — nền hiện ra qua.
Chỗ nào sáng thì đẩy nền sáng lên. Đó là lý do video hiệu ứng phải quay trên
nền đen: nền đen tự biến mất, khỏi cần cắt.`,
    input: 'Ảnh nền `image` và lớp hiệu ứng `layer`, cùng kích thước.',
    job: 'Cộng từng màu của hai ô cùng vị trí. Tổng vượt quá 255 thì kẹp lại bằng `min(255, ...)`, kẹp riêng từng màu.',
    output: 'Con rồng phát sáng nằm đè lên nền, nền vẫn nhìn thấy qua chỗ tối của lớp.',
    footnote: `Đây là bậc "đè hình A lên hình B". Ở sân khấu, \`layer\` chính là KHUNG HÌNH của
một đoạn video đang chạy — code y hệt, chỉ khác là máy gọi lại hàm này vài chục
lần mỗi giây, mỗi lần một khung khác.`,
    stub: `${PIXEL_HEADER}
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
`,
    answer: `def blend(image, layer, out, width, height):
    for row in range(height):
        for col in range(width):
            base = image[row][col]
            glow = layer[row][col]
            out[row][col] = [min(255, base[0] + glow[0]),
                             min(255, base[1] + glow[1]),
                             min(255, base[2] + glow[2])]
`,
    why: `\`base\` và \`glow\` chỉ là tên gọi cho hai ô cùng vị trí, đặt tên xong đọc dễ hơn
hẳn. \`min(255, a + b)\` giữ kết quả trong khoảng cho phép. Phải kẹp RIÊNG từng
màu: nếu tính một lần rồi dùng chung cho cả ba, ba màu bị cắt lệch nhau và điểm
ảnh đổi màu chứ không chỉ sáng lên.`,
  },
  {
    id: 'blur_background', kind: 'compose', title: 'blur_background — nền mờ, người vẫn nét',
    idea: `Bạn đã thấy trong mấy buổi họp trực tuyến: người thì nét, còn phòng phía sau
nhoè đi. Không có phép mới nào cả — chỉ là dùng lại \`blur\` và \`compose\` của
chính bạn: làm mờ CẢ tấm ảnh ra một chỗ riêng, rồi lấy mặt nạ mà chọn — ô nào
là người thì lấy ảnh gốc (nét), ô nào là nền thì lấy bản đã mờ.`,
    input: '`image` (khung hình), `mask` (mặt nạ người).',
    job: 'Gọi `blur` của bạn vào một tấm tạm (`new_image`), rồi `compose` để giữ người nét và lấy nền mờ.',
    output: 'Bạn nét căng, phòng phía sau nhoè hẳn.',
    stub: `# Hai hàm bạn đã viết, giờ đem ra dùng lại:
#     blur(image, ket_qua, width, height)
#     compose(person, mask, background, ket_qua, width, height)
#     new_image(width, height)   -> tấm ảnh trống để chứa kết quả tạm
#
# Ý chính: "người" là ảnh GỐC, còn "nền" là bản ĐÃ LÀM MỜ.
def blur_background(image, mask, out, width, height):
    # lượt của bạn: làm mờ ra tấm tạm, rồi chọn theo mặt nạ
    out[0][0] = image[0][0]
`,
    answer: `def blur_background(image, mask, out, width, height):
    blurred = new_image(width, height)
    blur(image, blurred, width, height)
    compose(image, mask, blurred, out, width, height)
`,
    why: `Đọc \`compose(image, mask, blurred, out, ...)\` thành lời: "ô nào là người thì lấy
\`image\` (nét), còn lại lấy \`blurred\`". Chỉ ba dòng, vì hai việc nặng đã nằm sẵn
trong hai hàm bạn viết hôm trước. Muốn nền mờ hơn nữa thì gọi \`blur\` hai lần
lên chính tấm tạm đó.`,
  },
  {
    id: 'scene', kind: 'scene', title: 'scene — dựng cả cảnh phim: nền · lớp sau · người · hiệu ứng trước',
    idea: `Đây là bài cuối, và nó KHÔNG có phép tính mới nào. Bạn chỉ gọi lại đúng hai
hàm mình đã viết, theo thứ tự của một cảnh phim thật:

  1. nền  +  lớp sau lưng   →  \`blend\`
  2. dán người lên tấm vừa dựng  →  \`compose\`
  3. phủ hiệu ứng ra phía trước  →  \`blend\` lần nữa

Thứ tự là tất cả. Dán người trước rồi mới cộng lớp sau thì lớp sau nằm đè lên
mặt bạn — sai hẳn cảnh.`,
    input: '`person`, `mask`, `background` (nền), `behind` (lớp sau lưng), `front` (hiệu ứng phủ trước).',
    job: 'Gọi `blend` và `compose` của chính bạn theo ba bước trên. Cần chỗ chứa kết quả tạm thì gọi `new_image(width, height)`.',
    output: 'Một khung hình hoàn chỉnh: bạn đứng giữa cảnh, có lớp sau lưng và hiệu ứng bay phía trước.',
    stub: `# Bài này không có phép tính mới — chỉ gọi lại hàm CỦA BẠN.
#
#     blend(anh, lop, ket_qua, width, height)
#     compose(person, mask, background, ket_qua, width, height)
#     new_image(width, height)   -> một tấm ảnh trống để chứa kết quả tạm
#
# Đừng ghi kết quả tạm vào chính tấm đang đọc: hàm sẽ vừa đọc vừa sửa một chỗ.
def scene(person, mask, background, behind, front, out, width, height):
    # lượt của bạn: ba bước — nền+behind, dán người, phủ front
    compose(person, mask, background, out, width, height)
`,
    answer: `def scene(person, mask, background, behind, front, out, width, height):
    back_layer = new_image(width, height)
    blend(background, behind, back_layer, width, height)

    with_person = new_image(width, height)
    compose(person, mask, back_layer, with_person, width, height)

    blend(with_person, front, out, width, height)
`,
    why: `Hai tấm tạm \`back_layer\` và \`with_person\` là chỗ chứa kết quả giữa chừng. Không có
chúng thì bước sau phải vừa đọc vừa ghi lên cùng một tấm, và ô nào ghi trước sẽ
làm hỏng ô đọc sau. Lần cuối ghi thẳng vào \`out\` vì không ai đọc \`out\` nữa.

Để ý: bạn không viết thêm phép tính nào cả. Hàm mình viết tuần trước giờ thành
đồ nghề để dựng cảnh — đó chính là cách người ta làm phần mềm.`,
  },
  {
    id: 'negative', kind: 'image', title: 'negative — âm bản', extra: true,
    idea: `Mỗi màu là một con số từ 0 (tối thui) tới 255 (sáng nhất). Âm bản là lật cái
thang đó: 0 thành 255, 255 thành 0, 100 thành 155. Chỗ đang sáng hoá tối, chỗ
tối hoá sáng — đúng như phim chụp ảnh ngày xưa.`,
    input: 'Ảnh `image`.',
    job: 'Với mỗi màu của mỗi ô, ghi vào `out` giá trị 255 trừ đi giá trị cũ.',
    output: 'Ảnh âm bản: trời sáng thành trời tối, cỏ xanh thành tím.',
    stub: `${PIXEL_HEADER}
#
# Lật thang sáng: giá trị mới = 255 - giá trị cũ, làm cho cả ba màu.
# Đặt tên ô trước cho gọn:  pixel = image[row][col]
def negative(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]
`,
    answer: `def negative(image, out, width, height):
    for row in range(height):
        for col in range(width):
            pixel = image[row][col]
            out[row][col] = [255 - pixel[0], 255 - pixel[1], 255 - pixel[2]]
`,
    why: `Không cần \`min\` hay \`max\`: giá trị cũ nằm trong 0..255 nên \`255 - giá trị\`
cũng luôn nằm trong 0..255. Viết \`out[row][col] = [ ... ]\` là dựng một ô mới
gồm ba số, chứ không sửa vào ô của \`image\` — đó là điều bắt buộc, vì mấy phép
khác còn phải đọc lại ảnh gốc.`,
  },
  {
    id: 'grayscale', kind: 'image', title: 'grayscale — đen trắng', extra: true,
    idea: `Mắt thấy MÀU là vì ba số chênh nhau: nhiều đỏ ít xanh thì ra đỏ. Khi cả ba
BẰNG NHAU, màu biến mất và chỉ còn độ sáng — đó chính là ảnh xám. Vậy muốn đen
trắng thì tính một con số đại diện rồi ghi con số đó vào cả ba.`,
    input: 'Ảnh màu `image`.',
    job: 'Tính trung bình cộng ba màu của ô, rồi ghi CÙNG con số đó vào cả ba màu của ô trong `out`.',
    output: 'Ảnh xám như báo cũ, vẫn còn chỗ sáng chỗ tối nhưng hết màu.',
    stub: `${PIXEL_HEADER}
#
# Ba số phải BẰNG NHAU thì mắt mới thấy là ảnh xám.
# Tính trung bình MỘT lần rồi dùng ba lần, đừng tính lại ba lần.
# Chia lấy phần nguyên bằng //, vì màu phải là số nguyên.
def grayscale(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]
`,
    answer: `def grayscale(image, out, width, height):
    for row in range(height):
        for col in range(width):
            pixel = image[row][col]
            gray = (pixel[0] + pixel[1] + pixel[2]) // 3
            out[row][col] = [gray, gray, gray]
`,
    why: `\`//\` là chia lấy phần nguyên; \`/\` sẽ cho ra số lẻ như 84.6667 và màu không
nhận số lẻ. Lỗi hay gặp: chỉ ghi \`gray\` vào một chỗ, hai chỗ kia vẫn màu cũ,
nên ảnh ngả đỏ chứ không xám. Người chấm phân biệt đúng hai lỗi đó bằng hai câu
khác nhau.`,
  },
  {
    id: 'flip_vertical', kind: 'image', title: 'flip_vertical — lộn đầu xuống chân', extra: true,
    idea: `Giống hệt \`flip\`, chỉ đổi trục: lần này số HÀNG đảo còn cột giữ nguyên. Hàng
trên cùng lấy màu hàng dưới cùng, như nhìn bóng mình dưới mặt hồ.`,
    input: 'Ảnh `image` cao `height` hàng.',
    job: 'Ô ở hàng `row` lấy màu của ô hàng `height - 1 - row`, cùng cột.',
    output: 'Ảnh lộn ngược từ trên xuống dưới.',
    stub: `${PIXEL_HEADER}
#
# So với flip: lần này chỗ đảo nằm ở HÀNG, còn cột thì giữ nguyên.
def flip_vertical(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]
`,
    answer: `def flip_vertical(image, out, width, height):
    for row in range(height):
        for col in range(width):
            out[row][col] = image[height - 1 - row][col]
`,
    why: `Chỉ một chỗ khác \`flip\`: \`height - 1 - row\` nằm ở ngoặc ĐẦU (chọn hàng), còn
\`col\` ở ngoặc sau giữ nguyên. Làm được cả hai bài là bạn đã nắm được ý chính:
ngoặc đầu chọn hàng, ngoặc sau chọn cột.`,
  },
  {
    id: 'drop_blue', kind: 'image', title: 'drop_blue — tắt kênh xanh dương', extra: true,
    idea: `Ba con số của một ô không phải "một màu chia ba", mà là ba nguồn sáng riêng
trộn lại. Tắt hẳn một nguồn là thấy ngay điều đó: bỏ xanh dương thì trời hết
xanh, cả ảnh ngả vàng cam vì chỉ còn đỏ và xanh lá.`,
    input: 'Ảnh màu `image`.',
    job: 'Chép nguyên đỏ và xanh lá; riêng xanh dương ghi 0.',
    output: 'Ảnh ám vàng cam, mất sạch sắc xanh dương.',
    stub: `${PIXEL_HEADER}
#
# Giữ nguyên đỏ và xanh lá, cho xanh dương bằng 0.
def drop_blue(image, out, width, height):
    for row in range(height):
        for col in range(width):
            # lượt của bạn
            out[row][col] = image[row][col]
`,
    answer: `def drop_blue(image, out, width, height):
    for row in range(height):
        for col in range(width):
            pixel = image[row][col]
            out[row][col] = [pixel[0], pixel[1], 0]
`,
    why: `Bài ngắn nhất nhưng dạy điều quan trọng nhất: ba số là ba màu riêng. Muốn
nghịch tiếp thì đổi chỗ \`pixel[0]\` với \`pixel[2]\` — đỏ và xanh dương hoán vị,
cả thế giới đổi màu.`,
  },
  {
    id: 'setup', kind: 'setup', title: 'setup — tự dựng bảng phép của bạn', extra: true,
    idea: `Tới đây bạn đã điều khiển phép bằng tay và bằng giọng nói. Còn một cách nữa:
tự dựng NÚT BẤM cho mình. Máy gọi \`setup()\` đúng một lần mỗi khi nạp mã, và
trong đó bạn gọi \`add_button("chữ trên nút", "tên phép")\` bao nhiêu lần tuỳ
thích — mỗi lời gọi mọc ra một nút thật ở góc phải sân khấu.`,
    input: 'Không có gì đưa vào. Hàm này chạy một lần lúc máy nạp mã của bạn.',
    job: 'Gọi `add_button(...)` cho ít nhất ba phép bạn thích, mỗi phép một nút.',
    output: 'Bảng nút của riêng bạn hiện ở sân khấu; bấm nút nào ra phép đó.',
    stub: `# Máy gọi setup() một lần sau khi nạp mã của bạn.
#     add_button("Rồng Lửa", "dragon")   -> mọc một nút, bấm là ra rồng
#
# Tên phép dùng được: dragon · koto · rose · phoenix · butterfly · sakura
#                     smoke · rain · flower · magic · lightning
# và cả hiệu ứng video bạn tự bỏ vào ở sân khấu.
def setup():
    # lượt của bạn: gọi add_button(...) cho mấy phép bạn thích
    pass
`,
    answer: `def setup():
    add_button("Rồng Lửa", "dragon")
    add_button("Phượng Hoàng", "phoenix")
    add_button("Hoa Anh Đào", "sakura")
    add_button("Mưa Giông", "rain")
`,
    why: `\`setup()\` chạy một lần, khác hẳn \`on_fingers\` chạy mỗi lần bạn đổi số ngón
tay. Chữ đầu là nhãn hiện trên nút, chữ sau là tên phép — hai thứ khác nhau,
nên nhãn cứ đặt tiếng Việt có dấu thoải mái. Muốn thêm nút thì thêm một dòng.`,
  },
  {
    id: 'on_fingers', kind: 'fingers', title: 'on_fingers — giơ mấy ngón thì ra phép gì',
    idea: `Máy nhìn camera, đếm số ngón tay bạn giơ lên, rồi GỌI hàm này và đưa con số đó
vào \`count\`. Việc của bạn là quyết định mỗi con số ứng với phép nào. Chuỗi
\`if / elif / else\` chạy từ trên xuống, gặp điều kiện đúng ĐẦU TIÊN thì làm việc
của nhánh đó rồi bỏ qua hết phần còn lại.`,
    input: '`count` — số ngón tay máy đếm được (1, 2, 3, hoặc số khác).',
    job: '1 ngón gọi `play_effect("dragon")`, 2 ngón `phoenix`, 3 ngón `sakura`, số khác thì `say(...)` một câu cho biết chưa gán.',
    output: 'Hiệu ứng đúng hiện lên khi bạn giơ tay; số lạ thì máy nói ra chứ không im lặng.',
    stub: `# Hai lệnh bạn gọi được:
#     play_effect("dragon")   mở một lớp hiệu ứng lên khung hình
#     say("chữ gì đó")        hiện một dòng chữ
#
# Tên hiệu ứng có sẵn: dragon · koto · rose · phoenix · butterfly · sakura
#                      smoke · rain · flower · magic · lightning
#
# else phải nằm CUỐI CÙNG, vì nó là nhánh "không khớp cái nào ở trên".
def on_fingers(count):
    say("thấy " + str(count) + " ngón tay")
    # lượt của bạn: thay dòng trên bằng if / elif / else gọi play_effect(...)
`,
    answer: `def on_fingers(count):
    if count == 1:
        play_effect("dragon")
    elif count == 2:
        play_effect("phoenix")
    elif count == 3:
        play_effect("sakura")
    else:
        say("chưa gán phép cho số này")
`,
    why: `\`==\` là so sánh (có bằng nhau không?), khác \`=\` là gán (đặt giá trị vào).
Thứ tự các nhánh ở bài này không quan trọng vì mỗi số chỉ khớp một nhánh, nhưng
\`else\` thì bắt buộc nằm cuối — đặt nó lên trước thì mấy \`elif\` sau không bao
giờ tới lượt.`,
  },
  {
    id: 'on_voice', kind: 'voice', title: 'on_voice — thế tay ĐÚNG và lời niệm ĐÚNG mới ra phép',
    idea: `Một mình lời nói thì dễ nhầm: micro nghe lỏm câu chuyện trong lớp là phép nhảy
ra loạn xạ. Phù thuỷ thật phải làm hai việc CÙNG LÚC — bắt đúng thế tay rồi mới
niệm. Trong Python, "cùng lúc" viết bằng \`and\`: cả hai vế đúng thì cả điều kiện
mới đúng.

\`fingers_now()\` cho biết ngay lúc này bạn đang giơ mấy ngón.`,
    input: '`word` — từ micro nghe được (chữ thường, có dấu). `fingers_now()` — số ngón tay đang giơ.',
    job: 'Rồng cần 1 ngón + "rồng"/"dragon". Phượng hoàng cần 2 ngón + "phượng"/"phoenix". Hoa anh đào cần 3 ngón + "hoa"/"sakura". Sai thế tay thì `say(...)` nhắc đúng số ngón cần giơ.',
    output: 'Nói suông không ra phép. Đúng thế tay mới ra — và đó là lúc trò ảo thuật thành thật.',
    stub: `# word là chuỗi, so sánh bằng dấu nháy: word == "rồng"
# fingers_now() là số ngón tay đang giơ NGAY LÚC NÀY.
#
# Nối hai điều kiện bằng and — cả hai đúng thì mới chạy:
#     if fingers_now() == 1 and (word == "rồng" or word == "dragon"):
#
# Dấu ngoặc quanh phần or là bắt buộc, nếu không Python hiểu sai thứ tự.
# Nhánh cuối nên nhắc bạn đang thiếu gì: đúng lời mà sai tay thì nói ra.
def on_voice(word):
    say("nghe được: " + word)
    # lượt của bạn: viết if / elif / else, mỗi nhánh kết hợp tay AND lời
`,
    answer: `def on_voice(word):
    fingers = fingers_now()
    if fingers == 1 and (word == "rồng" or word == "dragon"):
        play_effect("dragon")
    elif fingers == 2 and (word == "phượng" or word == "phoenix"):
        play_effect("phoenix")
    elif fingers == 3 and (word == "hoa" or word == "sakura"):
        play_effect("sakura")
    else:
        say("nghe " + word + " nhưng tay đang giơ " + str(fingers) + " ngón")
`,
    why: `Gọi \`fingers_now()\` MỘT lần rồi cất vào \`fingers\`: gọi lại ở mỗi nhánh thì
tay có thể đã đổi giữa chừng, và đọc cũng rối.

\`and\` khác \`or\`: \`and\` bắt cả hai vế đúng, \`or\` chỉ cần một. Ở đây cần cả hai —
đúng thế tay VÀ đúng lời niệm. Ngoặc quanh \`(word == ... or word == ...)\` là
bắt buộc: không có nó, Python đọc thành "(tay đúng và lời thứ nhất) hoặc (lời
thứ hai)", nên nói mỗi từ tiếng Anh là ra phép dù tay sai.

Nhánh \`else\` nói rõ đang thiếu vế nào — nghe đúng lời mà tay sai thì học sinh
biết ngay phải giơ mấy ngón.`,
  },

];
