// cells.js — chín đề bài của trang làm bài.
//
// Mỗi ô gồm: nguyên lý (máy làm gì với từng điểm ảnh), đề bài (vào gì, làm gì,
// ra gì), đoạn code có sẵn để học sinh sửa, và đáp án kèm lời giải thích —
// đáp án bị khoá bằng mật khẩu để bố mẹ mở ra giảng khi con bí.
//
// Ảnh demo: cảnh sân cổng Kotopia cho hầu hết các phép (nhiều màu, hai bên
// khác hẳn nhau nên lật là thấy ngay). Riêng `blend` dùng nền TỐI, vì cộng một
// lớp sáng lên nền vốn đã sáng thì trắng xoá, chẳng nhìn ra gì.
export const SCENE = './lessons/assets/storybook/portal-courtyard-v3.webp';
export const DARK_SCENE = './lessons/assets/camera-effects/plates/fx-boss.webp';
export const LAYER = './lessons/assets/camera-effects/plates/fx-dragon.webp';

// Khối chú thích dán đầu mỗi bài ảnh, để học sinh không phải nhớ px là gì.
const PIXEL_HEADER = `# px  = ảnh MÁY ĐƯA CHO BẠN — một danh sách số rất dài, chỉ đọc, đừng sửa
# out = ảnh BẠN DỰNG RA — cùng độ dài, ban đầu trống, bạn ghi màu vào đây
#
# Mỗi ô ảnh chiếm 4 số liền nhau: đỏ, xanh lá, xanh dương, độ đục.
# Ô ở hàng row, cột col bắt đầu tại:  o = (row * width + col) * 4
#   px[o] đỏ · px[o + 1] xanh lá · px[o + 2] xanh dương · px[o + 3] độ đục`;

export const CELLS = [
  {
    id: 'flip', kind: 'image', title: 'flip — soi gương trái phải',
    idea: `Lật ảnh KHÔNG phải xoay tấm ảnh. Máy chỉ chép màu sang chỗ khác: ô ngoài cùng
bên trái lấy màu của ô ngoài cùng bên phải, ô thứ hai từ trái lấy màu ô thứ hai
từ phải, cứ thế đổi chỗ từng cặp. Hàng thì giữ nguyên — chỉ cột đảo lại.`,
    input: 'Một tấm ảnh trong `px`, rộng `width` ô, cao `height` ô.',
    job: 'Với mỗi ô, tìm ô đối xứng của nó qua trục dọc giữa ảnh rồi chép ba kênh màu sang `out`.',
    output: 'Ảnh trong gương: cảnh bên trái nhảy sang phải và ngược lại.',
    stub: `${PIXEL_HEADER}
#
# Ô ở cột col phải lấy màu của ô cột  width - 1 - col  trong CÙNG hàng.
# Ví dụ ảnh rộng 5: cột 0 lấy cột 4, cột 1 lấy cột 3, cột 2 lấy chính nó.
def flip(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4          # chỗ GHI trong out
            # lượt của bạn: tính chỗ LẤY màu trong px rồi chép ba kênh sang out
            out[o] = px[o]
            out[o + 1] = px[o + 1]
            out[o + 2] = px[o + 2]
`,
    answer: `def flip(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4                       # chỗ ghi
            source = (row * width + (width - 1 - col)) * 4    # chỗ lấy màu
            out[o] = px[source]
            out[o + 1] = px[source + 1]
            out[o + 2] = px[source + 2]
`,
    why: `Hai công thức chỉ khác nhau ở chỗ cột: chỗ ghi dùng \`col\`, chỗ lấy dùng
\`width - 1 - col\`. Nhân 4 vì mỗi ô chiếm 4 số. Phải đọc \`px\` và ghi \`out\` —
nếu ghi đè lên \`px\` thì nửa ảnh sau sẽ lấy nhầm phần vừa bị sửa.`,
  },
  {
    id: 'blur', kind: 'image', title: 'blur — làm mờ',
    idea: `Ảnh nét là vì hai ô cạnh nhau có màu chênh nhau nhiều. Muốn mờ thì kéo các ô
lại gần nhau: mỗi ô lấy màu trung bình của chính nó và tám ô hàng xóm quanh nó.
Chênh lệch bị san phẳng, mắt đọc ra là nhoè.`,
    input: 'Ảnh trong `px`; mỗi ô có tối đa 8 hàng xóm (ít hơn nếu nó nằm sát mép).',
    job: 'Cộng màu của ô và các hàng xóm CÓ THẬT, đếm xem cộng được mấy ô, rồi chia cho đúng con số đó.',
    output: 'Ảnh nhoè đi, cạnh vật thể không còn sắc.',
    stub: `${PIXEL_HEADER}
#
# Hai chỗ dễ sai:
#   1. Ô sát mép chỉ có 4 hoặc 6 hàng xóm. Chia cứng cho 9 thì viền ảnh tối sầm.
#      Phải ĐẾM số ô cộng được rồi chia cho con số đó.
#   2. Hàng xóm rơi ra ngoài ảnh thì bỏ qua bằng continue. Chỉ số âm trong
#      Python KHÔNG báo lỗi — nó đếm ngược từ cuối danh sách, ảnh sẽ mọc vệt lạ.
def blur(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            # lượt của bạn: cộng màu các ô quanh đây rồi chia trung bình
            out[o] = px[o]
            out[o + 1] = px[o + 1]
            out[o + 2] = px[o + 2]
`,
    answer: `def blur(px, out, width, height):
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
                    i = (near_row * width + near_col) * 4
                    red += px[i]
                    green += px[i + 1]
                    blue += px[i + 2]
                    count += 1
            o = (row * width + col) * 4
            out[o] = red // count
            out[o + 1] = green // count
            out[o + 2] = blue // count
`,
    why: `Hai vòng lặp trong (\`row_step\`, \`col_step\` chạy -1, 0, 1) đi hết 9 ô của khối
vuông quanh ô đang xét. \`continue\` bỏ qua ô nằm ngoài ảnh, nên \`count\` là số ô
thật sự cộng được: giữa ảnh là 9, cạnh là 6, góc là 4. Chia cho \`count\` chứ
không chia cho 9 — đó là lý do viền ảnh không bị tối.`,
  },
  {
    id: 'blend', kind: 'blend', title: 'blend — ghép lớp hiệu ứng',
    idea: `Ghép hai ảnh KHÔNG phải dán đè, mà là CỘNG ÁNH SÁNG. Chỗ nào của lớp hiệu ứng
màu đen thì giá trị gần 0, cộng vào nền gần như không đổi gì — nền tự hiện ra
qua. Chỗ nào sáng thì đẩy nền sáng lên. Đó là lý do video hiệu ứng phải quay
trên nền đen: nền đen tự biến mất, khỏi cần cắt.`,
    input: 'Ảnh nền `px` và lớp hiệu ứng `layer`, cùng kích thước, cùng cách xếp số.',
    job: 'Cộng từng kênh màu của hai ảnh. Tổng vượt quá 255 thì kẹp lại bằng `min(255, ...)`, kẹp riêng từng kênh.',
    output: 'Con rồng phát sáng nằm đè lên nền, nền vẫn nhìn thấy qua chỗ tối của lớp.',
    stub: `${PIXEL_HEADER}
#
# layer = lớp hiệu ứng quay trên nền đen, cùng kích thước với px.
# Vì cả hai ảnh xếp số y như nhau nên duyệt thẳng từng ô, khỏi cần row/col.
# Số màu chỉ chạy từ 0 tới 255: cộng quá thì kẹp bằng min(255, ...).
def blend(px, layer, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn: cộng px[i] với layer[i] rồi kẹp bằng min(255, ...)
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]
`,
    answer: `def blend(px, layer, out, width, height):
    for i in range(0, len(px), 4):
        out[i] = min(255, px[i] + layer[i])
        out[i + 1] = min(255, px[i + 1] + layer[i + 1])
        out[i + 2] = min(255, px[i + 2] + layer[i + 2])
`,
    why: `\`range(0, len(px), 4)\` nhảy 4 số một bước, tức mỗi vòng đúng một ô ảnh.
\`min(255, a + b)\` giữ kết quả trong khoảng cho phép. Phải kẹp RIÊNG từng kênh:
nếu chỉ kẹp một lần rồi dùng chung, ba màu bị cắt lệch nhau và điểm ảnh đổi màu
chứ không chỉ sáng lên.`,
  },
  {
    id: 'negative', kind: 'image', title: 'negative — âm bản', extra: true,
    idea: `Mỗi kênh màu là một con số từ 0 (tối thui) tới 255 (sáng nhất). Âm bản là lật
cái thang đó: 0 thành 255, 255 thành 0, 100 thành 155. Chỗ nào đang sáng hoá
tối, chỗ tối hoá sáng — đúng như phim chụp ảnh ngày xưa.`,
    input: 'Ảnh trong `px`.',
    job: 'Với mỗi kênh màu, ghi vào `out` giá trị 255 trừ đi giá trị cũ.',
    output: 'Ảnh âm bản: trời sáng thành trời tối, cỏ xanh thành tím.',
    stub: `${PIXEL_HEADER}
#
# Lật thang sáng: giá trị mới = 255 - giá trị cũ, làm cho cả ba kênh màu.
def negative(px, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]
`,
    answer: `def negative(px, out, width, height):
    for i in range(0, len(px), 4):
        out[i] = 255 - px[i]
        out[i + 1] = 255 - px[i + 1]
        out[i + 2] = 255 - px[i + 2]
`,
    why: `Không cần \`min\` hay \`max\` ở đây: giá trị cũ nằm trong 0..255 nên
\`255 - giá trị\` cũng luôn nằm trong 0..255. Kênh thứ tư (độ đục) để nguyên,
đụng vào là ảnh trong suốt.`,
  },
  {
    id: 'grayscale', kind: 'image', title: 'grayscale — đen trắng', extra: true,
    idea: `Mắt thấy MÀU là vì ba kênh chênh nhau: nhiều đỏ ít xanh thì ra đỏ. Khi cả ba
kênh BẰNG NHAU, màu biến mất và chỉ còn độ sáng — đó chính là ảnh xám. Vậy
muốn đen trắng thì tính một con số đại diện rồi ghi con số đó vào cả ba kênh.`,
    input: 'Ảnh màu trong `px`.',
    job: 'Tính trung bình cộng của ba kênh, rồi ghi CÙNG con số đó vào cả ba kênh của `out`.',
    output: 'Ảnh xám như báo cũ, vẫn còn chỗ sáng chỗ tối nhưng hết màu.',
    stub: `${PIXEL_HEADER}
#
# Ba kênh phải BẰNG NHAU thì mắt mới thấy là ảnh xám.
# Tính trung bình MỘT lần rồi dùng ba lần, đừng tính lại ba lần.
def grayscale(px, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]
`,
    answer: `def grayscale(px, out, width, height):
    for i in range(0, len(px), 4):
        gray = (px[i] + px[i + 1] + px[i + 2]) // 3
        out[i] = gray
        out[i + 1] = gray
        out[i + 2] = gray
`,
    why: `\`//\` là phép chia lấy phần nguyên — màu phải là số nguyên, \`/\` sẽ cho ra số
lẻ như 84.6667. Lỗi hay gặp: chỉ ghi \`gray\` vào một kênh, hai kênh kia vẫn màu
cũ, nên ảnh ngả đỏ chứ không xám.`,
  },
  {
    id: 'flip_vertical', kind: 'image', title: 'flip_vertical — lộn đầu xuống chân', extra: true,
    idea: `Giống hệt \`flip\`, chỉ đổi trục: lần này HÀNG đảo còn cột giữ nguyên. Hàng
trên cùng lấy màu hàng dưới cùng, như nhìn bóng mình dưới mặt hồ.`,
    input: 'Ảnh trong `px`, cao `height` hàng.',
    job: 'Ô ở hàng `row` lấy màu của ô hàng `height - 1 - row`, cùng cột.',
    output: 'Ảnh lộn ngược từ trên xuống dưới.',
    stub: `${PIXEL_HEADER}
#
# So với flip: chỗ nào dùng col thì giờ dùng row, còn cột giữ nguyên.
def flip_vertical(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            # lượt của bạn
            out[o] = px[o]
            out[o + 1] = px[o + 1]
            out[o + 2] = px[o + 2]
`,
    answer: `def flip_vertical(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            source = ((height - 1 - row) * width + col) * 4
            out[o] = px[source]
            out[o + 1] = px[source + 1]
            out[o + 2] = px[source + 2]
`,
    why: `Chỉ một chỗ khác \`flip\`: \`height - 1 - row\` thay cho \`width - 1 - col\`.
Làm được cả hai là bạn đã hiểu công thức \`(row * width + col) * 4\` — muốn đổi
trục nào thì thay đúng phần đó.`,
  },
  {
    id: 'drop_blue', kind: 'image', title: 'drop_blue — tắt kênh xanh dương', extra: true,
    idea: `Ba con số của một ô không phải "một màu chia ba", mà là ba nguồn sáng riêng
trộn lại. Tắt hẳn một nguồn là thấy ngay điều đó: bỏ xanh dương thì trời hết
xanh, cả ảnh ngả vàng cam vì chỉ còn đỏ và xanh lá.`,
    input: 'Ảnh màu trong `px`.',
    job: 'Chép nguyên kênh đỏ và kênh xanh lá; riêng kênh xanh dương ghi 0.',
    output: 'Ảnh ám vàng cam, mất sạch sắc xanh dương.',
    stub: `${PIXEL_HEADER}
#
# Giữ nguyên đỏ và xanh lá, cho kênh xanh dương bằng 0.
def drop_blue(px, out, width, height):
    for i in range(0, len(px), 4):
        # lượt của bạn
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = px[i + 2]
`,
    answer: `def drop_blue(px, out, width, height):
    for i in range(0, len(px), 4):
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = 0
`,
    why: `Bài này ngắn nhất nhưng dạy điều quan trọng nhất: ba số là ba màu riêng.
Muốn nghịch tiếp thì thử đổi chỗ \`px[i]\` với \`px[i + 2]\` — đỏ và xanh dương
hoán vị, cả thế giới đổi màu.`,
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
