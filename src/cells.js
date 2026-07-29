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
    id: 'blend', kind: 'blend', title: 'blend — ghép lớp hiệu ứng',
    idea: `Ghép hai ảnh KHÔNG phải dán đè, mà là CỘNG ÁNH SÁNG. Chỗ nào của lớp hiệu ứng
màu đen thì ba số gần 0, cộng vào nền gần như không đổi gì — nền hiện ra qua.
Chỗ nào sáng thì đẩy nền sáng lên. Đó là lý do video hiệu ứng phải quay trên
nền đen: nền đen tự biến mất, khỏi cần cắt.`,
    input: 'Ảnh nền `image` và lớp hiệu ứng `layer`, cùng kích thước.',
    job: 'Cộng từng màu của hai ô cùng vị trí. Tổng vượt quá 255 thì kẹp lại bằng `min(255, ...)`, kẹp riêng từng màu.',
    output: 'Con rồng phát sáng nằm đè lên nền, nền vẫn nhìn thấy qua chỗ tối của lớp.',
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
    id: 'on_voice', kind: 'voice', title: 'on_voice — nói gì thì ra phép gì',
    idea: `Micro nghe được một TỪ thì máy gọi hàm này và đưa từ đó vào \`word\`, đã chuyển
sang chữ thường. Vẫn là \`if / elif / else\`, chỉ khác chỗ so sánh chuỗi thay vì
số. Một nhánh nhận được nhiều từ nhờ \`or\`.`,
    input: '`word` — từ máy nghe được, chữ thường, có dấu tiếng Việt.',
    job: '"rồng" hoặc "dragon" ra `dragon`; "hoa"/"sakura" ra `sakura`; "mưa"/"rain" ra `rain`; từ lạ thì `say(...)` đọc lại đúng từ đó.',
    output: 'Nói là ra phép. Từ nào máy nghe nhầm thì bạn thấy ngay nó nghe ra gì.',
    stub: `# word là chuỗi, nên so sánh bằng dấu nháy: word == "rồng"
# Dấu tiếng Việt tính là khác nhau: "rong" KHÔNG khớp "rồng".
# Muốn một nhánh nhận nhiều từ thì nối bằng or.
#
# Nhánh cuối nên đọc lại từ vừa nghe — đó là cách bạn biết micro nghe ra gì.
def on_voice(word):
    say("nghe được: " + word)
    # lượt của bạn: viết if / elif / else ở đây
`,
    answer: `def on_voice(word):
    if word == "rồng" or word == "dragon":
        play_effect("dragon")
    elif word == "hoa" or word == "sakura":
        play_effect("sakura")
    elif word == "mưa" or word == "rain":
        play_effect("rain")
    else:
        say("nghe được: " + word)
`,
    why: `\`or\` cho một nhánh nhận nhiều từ: chỉ cần MỘT vế đúng là cả điều kiện đúng.
Phải viết đủ \`word == "dragon"\` ở vế sau — viết tắt \`word == "rồng" or "dragon"\`
thì Python hiểu sai và nhánh nào cũng đúng. Nhánh \`else\` đọc lại từ vừa nghe,
nhờ đó bạn biết micro có nghe nhầm không.`,
  },
];
