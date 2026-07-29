export default {
  index: 25,
  sideIslandId: "islandFXFORGE",
  sealsSagaNode: 25,
  title: "GƯƠNG VÔ CỰC",
  subtitle: "Vũ khí cổ xưa dùng để phong ấn Lord Null",
  bundle: {
    art: "assets/rookie-bundle.webp",
    name: "TÚI SOI GƯƠNG",
  },
  machine: {
    art: "assets/future-machine.webp",
    name: "KHUNG GƯƠNG VÔ CỰC",
    blurb: "một tấm gương giữ được nhiều hình phản chiếu cùng lúc và chồng chúng lại thành một khung hình duy nhất",
  },
  finish: {
    title: "✦ GƯƠNG ĐÃ NHẬN BẠN! ✦",
    sub: "Bạn vừa tự viết thần chú lật hình, thần chú chồng hai lớp và bộ chọn thần chú theo lời gọi. Bước qua gương là ra sân khấu thật: camera mở lên, bàn tay bạn hiện trong khung. Xoè cả bàn tay để triệu bụi sáng, rồi giơ một hoặc hai ngón và giữ yên cho phép thuật dồn lại. Đúng những phép bạn vừa viết, giờ chạy trên hình thật của chính bạn.",
    button: "BƯỚC QUA GƯƠNG",
    page: "../index.html",
  },
  modules: {
    old_computer: "../py/old_computer/__init__.py",
    camera_charm: "../py/camera_charm/__init__.py",
    voice_charm: "../py/voice_charm/__init__.py",
    pip_test: "../py/pip_test/__init__.py",
  },
  cells: [
    {
      intro: {
        title: "✦ GƯƠNG VÔ CỰC ✦",
        hook: "Trước mặt bạn là Gương Vô Cực, chặng cuối của cả hành trình. Chúa tể Vô Định đang trốn trong lòng gương, vì trong gương mọi hình phản chiếu đều chỉ là ánh sáng xếp thành lưới và hắn tưởng không ai đọc nổi lưới đó. Hôm nay bạn tự viết những thần chú đọc được nó, rồi dùng chính chúng để trục xuất hắn.",
        art: "assets/future-machine.webp",
      },
    },
    {
      npc: "Đầu tiên, hãy quan sát hình ảnh trước đã. ",
    },
    {
      code: `# dùng show_photos trong camera_charm để hiển thị ảnh
from camera_charm import show_photos

# Hai lớp ảnh rời nhau, chưa dính gì tới nhau

show_photos([("SPIRIT DRAGON", "dragon"), ("ERROR BEAST", "boss")], "TWO SEPARATE LAYERS")
`,
      label: "xem_hai_tam_anh.py",
      note: `RUN KIỂM CHỨNG
INPUT là hai tấm ảnh có sẵn trong bài. OUTPUT là cửa sổ lớn đặt hai tấm cạnh nhau ở đúng kích thước gốc: con rồng ánh sáng trên nền đen, và con quái khói tím cũng trên nền đen. Cửa sổ đứng yên tới khi bạn bấm TIẾP TỤC.`,
      expectOut: {
        kind: "studio_start",
        minCount: 1,
      },
      solution: `from camera_charm import show_photos

show_photos([("SPIRIT DRAGON", "dragon"), ("ERROR BEAST", "boss")], "TWO SEPARATE LAYERS")
`,
    },
    {
      npc: "Đây là câu đố Pip đặt ra cho bạn: làm sao đưa con rồng lao thẳng vào con quái trong CÙNG một khung hình? Bạn đoán thử xem gương phải làm gì với hai hình đó.",
    },
    {
      code: `from camera_charm import show_photos

# Đây là mục tiêu: 
show_photos([("SPIRIT DRAGON", "dragon"), ("ERROR BEAST", "boss"), ("DRAGON OVER BEAST", "goal")], "THE GOAL: ONE SINGLE FRAME")
`,
      label: "xem_dich_toi.py",
      note: `RUN KIỂM CHỨNG
INPUT vẫn là hai tấm ảnh cũ, cộng thêm tấm kết quả đã dựng sẵn. OUTPUT là cửa sổ ba tấm: con rồng, con quái, và khung hình cuối cùng có con rồng lao qua làn khói tím. Tấm thứ ba chính là thứ bạn sẽ tự dựng được ở cuối đảo — nhìn kỹ xem chỗ nào sáng lên, chỗ nào giữ nguyên.`,
      expectOut: {
        kind: "studio_start",
        minCount: 1,
      },
      solution: `from camera_charm import show_photos

show_photos([("SPIRIT DRAGON", "dragon"), ("ERROR BEAST", "boss"), ("DRAGON OVER BEAST", "goal")], "THE GOAL: ONE SINGLE FRAME")
`,
    },
    {
      quiz: {
        title: "Đoán cách đè hai tấm ảnh",
        questions: [
          {
            q: "Cả hai tấm ảnh đều được quay trên nền đen, và trong khung hình cuối cùng bạn thấy CẢ con rồng lẫn làn khói tím, không tấm nào che mất tấm nào. Cách xử lý nào hợp lý nhất?",
            a: [
              "Cộng ánh sáng của hai tấm tại từng ô, vì nền đen cộng vào gần như không thêm gì",
              "Lấy tấm thứ hai đặt chồng lên và xóa hẳn tấm thứ nhất",
              "Cắt đôi khung hình, để con rồng một nửa và con quái một nửa",
            ],
            correct: 0,
          },
          {
            q: "Trong khung hình cuối cùng, vùng nền đen của cả hai tấm vẫn tối. Điều đó gợi ý giá trị màu của vùng nền đen gần bằng bao nhiêu?",
            a: [
              "Gần bằng `0`, nên cộng vào chỗ nào cũng gần như không đổi chỗ đó",
              "Gần bằng `255`, nên nó luôn thắng mọi giá trị khác",
              "Bằng `-1`, nên nó trừ bớt ánh sáng của tấm kia",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Đúng hướng rồi đó. Nhưng muốn chồng được hai hình thì trước hết phải biết cách đã. Chúng ta không thể làm như hai tờ giấy chồng nhau hoàn toàn. Điều đó sẽ làm nền đen  hình này che mất hình kia đúng không? ",
    },
    {
      npc: "Trong lòng gương, một hình chỉ là bảng số: mỗi ô ghi ánh sáng ở chỗ đó mạnh hay yếu. Mình đọc cùng một hình ở hai độ mịn để thấy bảng số đó thô hay mịn ra sao.",
    },
    {
      code: `from camera_charm import load_plate, compare_frames

# Ảnh gốc, rồi chính nó đọc thành lưới ở hai độ mịn
fine = load_plate("dragon", 24)
coarse = load_plate("dragon", 8)

compare_frames([("GRID 24", fine, "dragon"), ("GRID 8", coarse, "dragon")], "FROM PICTURE TO NUMBERS", False)
`,
      label: "so_anh_that_voi_luoi.py",
      note: `RUN KIỂM CHỨNG
INPUT là tấm hiệu ứng con rồng có sẵn trong bài. OUTPUT là cửa sổ hai khung, mỗi khung đặt ảnh gốc sắc nét ngay cạnh lưới ô của chính nó: một khung chia 24 ô mỗi chiều, một khung chỉ còn 8 ô. Càng ít ô thì mỗi ô càng phải gánh một mảng rộng, nên lưới càng thô so với ảnh gốc bên cạnh — nhưng lưới mới là dạng mà vòng lặp Python duyệt được.`,
      expectOut: {
        kind: "studio_start",
        minCount: 3,
      },
      solution: `from camera_charm import load_plate, compare_frames

fine = load_plate("dragon", 24)
coarse = load_plate("dragon", 8)

compare_frames([("GRID 24", fine, "dragon"), ("GRID 8", coarse, "dragon")], "FROM PICTURE TO NUMBERS", False)
`,
    },
    {
      npc: "Số ô càng nhiều thì mỗi ô càng nhỏ và hình càng rõ; số ô càng ít thì mỗi ô phải gánh một mảng rộng nên hình nhòe đi. Giờ mình mở luôn phần số nằm sau bức tranh.",
    },
    {
      code: `from camera_charm import load_plate, compare_frames

# Lưới 8 ô để con số còn đọc được bằng mắt
small = load_plate("dragon", 8)
compare_frames([("GRID 8", small, "dragon")], "BRIGHTNESS OF EACH CELL", True)
`,
      label: "xem_con_so.py",
      note: `RUN KIỂM CHỨNG
INPUT là tấm hiệu ứng đọc ở lưới 8×8 cho con số còn đủ to. OUTPUT là cửa sổ hiện đúng bức tranh đó kèm bảng số: mỗi ô ghi độ sáng của chính nó và được tô đúng màu của nó. Ô càng sáng thì số càng lớn; ô nền tối có số gần 0.`,
      expectOut: {
        kind: "studio_start",
        minCount: 2,
      },
      solution: `from camera_charm import load_plate, compare_frames

small = load_plate("dragon", 8)
compare_frames([("GRID 8", small, "dragon")], "BRIGHTNESS OF EACH CELL", True)
`,
    },
    {
      quiz: {
        title: "Đọc lưới độ sáng",
        questions: [
          {
            q: "Một tấm hiệu ứng được đọc thành `fx` có 16 hàng và 16 cột, mỗi ô là `[red, green, blue]`. Hai ô có giá trị `fx[2][2] = [10, 12, 8]` và `fx[7][11] = [230, 240, 250]`. Ô nào nằm ở vùng sáng của tấm ảnh?",
            a: [
              "`fx[7][11]`, vì ba giá trị màu đều lớn nên độ sáng trung bình cao",
              "`fx[2][2]`, vì nó đứng ở hàng và cột nhỏ hơn",
              "Không xác định được, vì phải biết kích thước ảnh trước",
            ],
            correct: 0,
          },
          {
            q: "Với `pixel = [60, 90, 120]`, máy tính `light = (60 + 90 + 120) // 3`. Giá trị `light` là bao nhiêu?",
            a: [
              "`90`",
              "`270`",
              "`120`",
            ],
            correct: 0,
          },
          {
            q: "Cùng một tấm ảnh được đọc thành lưới 8×8 rồi lưới 24×24. So với lưới 24×24, lưới 8×8 khác ở chỗ nào?",
            a: [
              "Ít ô hơn nên mỗi ô gánh một mảng rộng hơn, hình vì thế thô hơn",
              "Nhiều ô hơn nên hình rõ hơn",
              "Số ô giữ nguyên, chỉ màu của từng ô đổi",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Trước khi nhờ máy sửa hộ, bạn tự sửa bằng tay đã. Bảng số dưới đây là tấm hiệu ứng con rồng thu về lưới 8×8 — kéo chuột chọn một vùng, rồi bấm SÁNG hoặc TỐI.",
    },
    {
      pixelBoard: {
        plate: "dragon",
        size: 8,
        text: "Mỗi lần bấm, cả vùng đang chọn cộng hoặc trừ 50 ở cả ba kênh màu, và ảnh bên trái đổi ngay. Số chạm 0 thì dừng ở 0, chạm 255 thì dừng ở 255 — bạn thử ép nó xuống dưới 0 xem có được không.",
        task: { mode: "dim", amount: 100, label: "nửa trái của ảnh (cột 0 tới cột 3)", region: { col0: 0, col1: 3 } },
      },
    },
    {
      npc: "Đã đọc được bảng số thì bạn ghi vào đó được luôn. Ghi đè giá trị lên một vùng ô, và hình trong gương phải đổi ngay đúng chỗ đó.",
    },
    {
      code: `from old_computer import say, say_num
from pip_test import count_color
from camera_charm import load_plate, compare_frames

before = load_plate("dragon", 8)

# Chép sang một lưới mới để vẫn giữ được ảnh gốc mà so sánh
after = []
for row in range(len(before)):
    line = []
    for col in range(len(before[row])):
        line.append(before[row][col])
    after.append(line)

# lượt của bạn: tô trắng vùng từ hàng 2 tới hàng 5 và từ cột 2 tới cột 5
for row in range(2, 6):
    for col in range(2, 6):
        after[row][col] = before[row][col]

# Pip chấm hộ bạn
say_num(count_color(after, [255, 255, 255]))

compare_frames([("BEFORE", before, "dragon"), ("AFTER", after, "result")], "PAINT A REGION BY HAND", True)
`,
      label: "tu_to_mot_vung.py",
      note: "ĐỀ BÀI\nINPUT là tấm hiệu ứng đọc ở lưới 8×8; `after` là bản chép của nó để bạn sửa mà vẫn giữ được ảnh gốc. Dòng gán trong vòng lặp đang chép lại đúng giá trị cũ nên chưa có gì đổi. Hãy gán `[255, 255, 255]` cho mỗi ô trong vùng đó để tô trắng. OUTPUT đúng là số `16` (vùng 4 hàng × 4 cột) và cửa sổ so sánh cho thấy một khối trắng vuông vắn xuất hiện giữa ảnh AFTER, kèm bảng số đổi thành 255.",
      expectOut: {
        all: [
          /^16$/,
        ],
      },
      solution: `from old_computer import say, say_num
from pip_test import count_color
from camera_charm import load_plate, compare_frames

before = load_plate("dragon", 8)

after = []
for row in range(len(before)):
    line = []
    for col in range(len(before[row])):
        line.append(before[row][col])
    after.append(line)

for row in range(2, 6):
    for col in range(2, 6):
        after[row][col] = [255, 255, 255]

# Pip chấm hộ bạn
say_num(count_color(after, [255, 255, 255]))

compare_frames([("BEFORE", before, "dragon"), ("AFTER", after, "result")], "PAINT A REGION BY HAND", True)
`,
    },
    {
      checkpoint: {
        text: "Một tấm ảnh là lưới hai chiều: `image[row][col]` là một ô giữ `[red, green, blue]`, và độ sáng của ô tính bằng `(red + green + blue) // 3`. Lưới đó ghi được: `image[row][col] = [255, 255, 255]` làm ô đó trắng. Muốn sửa cả một vùng thì cho hai vòng lặp chạy trên khoảng hàng và khoảng cột của vùng, ví dụ `range(2, 6)` đi qua các hàng 2, 3, 4 và 5.",
      },
    },
    {
      quiz: {
        title: "Ghi đè một vùng ô",
        questions: [
          {
            q: "Đọc đoạn Mật Ngữ này:\n```python\nfor row in range(2, 6):\n    for col in range(2, 6):\n        after[row][col] = [255, 255, 255]\n```\nĐoạn này ghi đè bao nhiêu ô?",
            a: [
              "`16` ô, vì 4 hàng nhân 4 cột",
              "`8` ô, vì 4 hàng cộng 4 cột",
              "`4` ô, vì mỗi vòng lặp chạy 4 lần",
            ],
            correct: 0,
          },
          {
            q: "Vẫn đoạn trên, nhưng đổi thành `after[row][col] = [0, 0, 0]`. Vùng đó trông thế nào trong ảnh kết quả?",
            a: [
              "Thành một khối đen, vì cả ba giá trị màu đều bằng 0",
              "Thành một khối trắng, vì 0 nghĩa là sáng nhất",
              "Không đổi, vì phải gán đủ ba lần cho ba kênh màu",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Mấy ô số vừa rồi là để bạn hiểu ảnh được ghi ra sao. Từ đây gương đưa hẳn tấm ảnh thật, 256 ô mỗi chiều: vẫn hai vòng lặp đó, nhưng hình hiện ra rõ nét.",
    },
    {
      npc: "Tô trắng một vùng thì mất hết hình cũ ở đó. Muốn giữ nguyên hình mà chỉ làm nó tối đi, mình trừ bớt cùng một số ở cả ba kênh màu của mọi ô.",
    },
    {
      npc: "Một kênh màu chỉ nhận số từ 0 tới 255. Ô đang tối sẵn mà trừ thêm sẽ rơi xuống dưới 0. Lệnh `max` trả về số lớn hơn trong hai số, nên `max(0, giá_trị)` chặn lại đúng ở 0.",
    },
    {
      npc: "Chiều ngược lại cũng vậy: cộng thêm thì ô sáng sẵn sẽ vượt quá 255. Lệnh `min` trả về số nhỏ hơn, nên `min(255, giá_trị)` giữ nó lại đúng ở 255. Một tấm ảnh, hai chiều chỉnh sáng.",
    },
    {
      code: `from pip_test import check_dim, check_blend
from camera_charm import load_plate, blank_grid, compare_frames

fx = load_plate("dragon", 256)
dim = blank_grid(len(fx), len(fx[0]))
bright = blank_grid(len(fx), len(fx[0]))
AMOUNT = 50

for row in range(len(fx)):
    for col in range(len(fx[row])):
        cell = fx[row][col]
        red = cell[0]  # lượt của bạn: trừ AMOUNT rồi chặn bằng max(0, ...)
        green = cell[1]  # lượt của bạn: làm tương tự với kênh xanh lá
        blue = cell[2]  # lượt của bạn: làm tương tự với kênh xanh dương
        dim[row][col] = [red, green, blue]
        bright[row][col] = [cell[0], cell[1], cell[2]]  # lượt của bạn: cộng AMOUNT rồi chặn bằng min(255, ...)

compare_frames([("GỐC", fx), ("TỐI ĐI 50", dim, "result"), ("SÁNG THÊM 50", bright, "result")], "TURN THE LIGHT UP AND DOWN")

# Xem xong rồi Pip mới chấm
check_dim(fx, dim, AMOUNT)
check_blend(fx, bright)
`,
      label: "chinh_do_sang_ca_tam_anh.py",
      note: "ĐỀ BÀI\nINPUT là tấm hiệu ứng con rồng ở độ nét thật, 256×256 ô; `AMOUNT` đã đặt sẵn bằng 50. Bốn dòng gán trong vòng lặp đang chép nguyên giá trị cũ nên chưa tấm nào đổi. Hãy dựng `dim` bằng cách trừ `AMOUNT` rồi chặn bằng `max(0, ...)`, và dựng `bright` bằng cách cộng `AMOUNT` rồi chặn bằng `min(255, ...)`. Ví dụ: kênh 200 khi trừ còn 150, kênh 20 dừng ở 0; kênh 230 khi cộng dừng ở 255. OUTPUT đúng là cửa sổ ba tấm gốc – tối – sáng, rồi in `EVERY CELL LOST 50 LIGHT`, `NOTHING WENT BELOW 0`, `ALL CHANNELS WITHIN 255` và `EFFECT AREA GOT BRIGHTER`.",
      expectOut: {
        all: [
          /EVERY CELL LOST 50 LIGHT/,
          /NOTHING WENT BELOW 0/,
          /ALL CHANNELS WITHIN 255/,
          /EFFECT AREA GOT BRIGHTER/,
        ],
      },
      solution: `from pip_test import check_dim, check_blend
from camera_charm import load_plate, blank_grid, compare_frames

fx = load_plate("dragon", 256)
dim = blank_grid(len(fx), len(fx[0]))
bright = blank_grid(len(fx), len(fx[0]))
AMOUNT = 50

for row in range(len(fx)):
    for col in range(len(fx[row])):
        cell = fx[row][col]
        red = max(0, cell[0] - AMOUNT)
        green = max(0, cell[1] - AMOUNT)
        blue = max(0, cell[2] - AMOUNT)
        dim[row][col] = [red, green, blue]
        bright[row][col] = [min(255, cell[0] + AMOUNT), min(255, cell[1] + AMOUNT), min(255, cell[2] + AMOUNT)]

compare_frames([("GỐC", fx), ("TỐI ĐI 50", dim, "result"), ("SÁNG THÊM 50", bright, "result")], "TURN THE LIGHT UP AND DOWN")

# Xem xong rồi Pip mới chấm
check_dim(fx, dim, AMOUNT)
check_blend(fx, bright)
`,
    },
    {
      quiz: {
        title: "Làm tối, làm sáng một ô",
        questions: [
          {
            q: "Một ô đang giữ `[30, 90, 200]`. Sau khi chạy đoạn này, ô đó giữ gì?\n```python\nred = max(0, cell[0] - 50)\ngreen = max(0, cell[1] - 50)\nblue = max(0, cell[2] - 50)\n```",
            a: [
              "`[0, 40, 150]`, vì 30 trừ 50 còn âm nên bị chặn lại ở 0",
              "`[-20, 40, 150]`, vì kênh đỏ xuống dưới 0",
              "`[30, 90, 200]`, vì `max` giữ lại giá trị cũ",
            ],
            correct: 0,
          },
          {
            q: "Muốn cả tấm ảnh sáng hơn thay vì tối đi, sửa dòng `red = max(0, cell[0] - 50)` thành dòng nào?",
            a: [
              "`red = min(255, cell[0] + 50)`",
              "`red = max(0, cell[0] + 50)`",
              "`red = min(255, cell[0] - 50)`",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Nhưng kẹp riêng từng kênh còn giấu một vết nứt. Ba tổng của một ô là 270, 292 và 130; kẹp xong còn `[255, 255, 130]`. Đỏ bị cắt 15, lục bị cắt 37, lam không mất gì.",
    },
    {
      npc: "Ba kênh bị cắt ba mức khác nhau nên màu của ô lệch đi. Nền càng sáng càng nhiều ô dính, nên ô luyện dưới đây quay lại tấm nền ngọn hải đăng cho vết nứt lộ ra.",
    },
    {
      npc: "Ngoài đời, chỗ ánh sáng chồng lên nhau quá mạnh thì cháy ra trắng chứ không ngả màu. Muốn biết ô nào đã quá mức, lấy `max(red, green, blue)` — `max` nhận ba số và trả về số lớn nhất.",
    },
    {
      code: `from pip_test import check_burn
from camera_charm import load_plate, blank_grid, compare_frames

scene = load_plate("scene", 256)
fx = load_plate("dragon", 256)
clamped = blank_grid(len(scene), len(scene[0]))
burned = blank_grid(len(scene), len(scene[0]))

for row in range(len(scene)):
    for col in range(len(scene[row])):
        base = scene[row][col]
        layer = fx[row][col]
        red = base[0] + layer[0]
        green = base[1] + layer[1]
        blue = base[2] + layer[2]
        clamped[row][col] = [min(255, red), min(255, green), min(255, blue)]
        # lượt của bạn: nếu số lớn nhất trong ba tổng đã vượt 255
        # thì đặt cả red, green, blue bằng 255
        burned[row][col] = [min(255, red), min(255, green), min(255, blue)]

compare_frames([("CLAMP EACH CHANNEL", clamped, "result"), ("BURN TO WHITE", burned, "result")], "WHERE THE COLOUR DRIFTS")

# Xem xong rồi Pip mới chấm
check_burn(scene, fx, burned)
`,
      label: "chay_trang_thay_vi_lech_mau.py",
      note: "ĐỀ BÀI\nINPUT là hai tấm ảnh có sẵn 256×256 ô: `scene` là nền ngọn hải đăng ban đêm — chọn nền sáng vì nó làm vết nứt lộ ra — và `fx` là lớp con rồng. Ba tổng `red`, `green`, `blue` đã được cộng sẵn chưa kẹp, và `clamped` đã dựng xong theo cách cũ để bạn so sánh. PROCESS của bạn nằm ở dòng gán `burned`: dùng một khối `if` xét `max(red, green, blue)`, nếu số đó vượt 255 thì đặt cả ba kênh bằng 255, còn lại giữ nguyên cách kẹp cũ. OUTPUT đúng phải mở cửa sổ đặt hai cách cạnh nhau rồi in `OVERBRIGHT CELLS BURNED WHITE` và `CALM CELLS KEPT THEIR COLOUR`.",
      expectOut: {
        all: [
          /OVERBRIGHT CELLS BURNED WHITE/,
          /CALM CELLS KEPT THEIR COLOUR/,
        ],
      },
      solution: `from pip_test import check_burn
from camera_charm import load_plate, blank_grid, compare_frames

scene = load_plate("scene", 256)
fx = load_plate("dragon", 256)
clamped = blank_grid(len(scene), len(scene[0]))
burned = blank_grid(len(scene), len(scene[0]))

for row in range(len(scene)):
    for col in range(len(scene[row])):
        base = scene[row][col]
        layer = fx[row][col]
        red = base[0] + layer[0]
        green = base[1] + layer[1]
        blue = base[2] + layer[2]
        clamped[row][col] = [min(255, red), min(255, green), min(255, blue)]
        if max(red, green, blue) > 255:
            red = 255
            green = 255
            blue = 255
        burned[row][col] = [min(255, red), min(255, green), min(255, blue)]

compare_frames([("CLAMP EACH CHANNEL", clamped, "result"), ("BURN TO WHITE", burned, "result")], "WHERE THE COLOUR DRIFTS")

# Xem xong rồi Pip mới chấm
check_burn(scene, fx, burned)
`,
    },
    {
      checkpoint: {
        text: "Ghép một lớp hiệu ứng quay trên nền đen lên nền là cộng từng kênh màu của hai ô cùng vị trí rồi kẹp lại: `min(255, ...)` chặn đầu trên khi cộng, `max(0, ...)` chặn đầu dưới khi trừ. Kẹp riêng từng kênh giữ được giá trị hợp lệ nhưng cắt ba kênh ba mức khác nhau, nên màu của ô lệch đi. Xét `max(red, green, blue) > 255` rồi đặt cả ba kênh bằng 255 thì ô quá sáng cháy ra trắng, không kênh nào bị cắt nhiều hơn kênh nào.",
      },
    },
    {
      quiz: {
        title: "Cháy trắng hay lệch màu",
        questions: [
          {
            q: "Ba tổng thô của một ô là `red = 270`, `green = 292`, `blue = 130`. Kẹp riêng từng kênh bằng `min(255, ...)` cho ra ô nào?",
            a: [
              "`[255, 255, 130]`",
              "`[255, 255, 255]`",
              "`[270, 292, 130]`",
            ],
            correct: 0,
          },
          {
            q: "Vẫn ba tổng `270`, `292`, `130`. Chạy đoạn này xong, ô đó giữ gì?\n```python\nif max(red, green, blue) > 255:\n    red = 255\n    green = 255\n    blue = 255\n```",
            a: [
              "`[255, 255, 255]`, vì 292 đã vượt 255 nên cả ba kênh cùng được đặt lại",
              "`[255, 255, 130]`, vì chỉ hai kênh vượt mức mới bị đổi",
              "`[270, 292, 130]`, vì khối `if` chỉ đọc chứ không gán lại",
            ],
            correct: 0,
          },
          {
            q: "Một ô có ba tổng thô là `red = 90`, `green = 120`, `blue = 60`. Chạy đoạn này xong, ô đó ra sao?\n```python\nif max(red, green, blue) > 255:\n    red = 255\n    green = 255\n    blue = 255\n```",
            a: [
              "Không làm gì, vì số lớn nhất là 120 vẫn chưa vượt 255",
              "Đặt cả ba kênh bằng 255, vì khối `if` chạy cho mọi ô",
              "Đặt cả ba kênh bằng 0, vì chưa ô nào đủ sáng",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Thần chú đầu tiên của gương là lật hình theo chiều ngang — đúng việc một tấm gương vẫn làm. Gương không xoay hình trong không gian đâu; nó chỉ đọc lại từng hàng theo thứ tự cột ngược lại.",
    },
    {
      npc: "Trong một hàng có `n` cột, cột cuối cùng mang chỉ số `n - 1`. Ô mới ở cột `col` nhận giá trị của ô cũ ở cột `n - 1 - col`.",
    },
    {
      code: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

fx = load_plate("dragon", 256)
flipped = blank_grid(len(fx), len(fx[0]))

for row in range(len(fx)):
    last = len(fx[row]) - 1
    for col in range(len(fx[row])):
        flipped[row][col] = fx[row][col]  # lượt của bạn: đổi thành ô đối xứng

compare_frames([("BEFORE FLIP", fx), ("AFTER FLIP", flipped, "result")], "MIRROR THE IMAGE")

# Xem xong rồi Pip mới chấm
check_flip(fx, flipped)
`,
      label: "viet_lenh_lat_anh.py",
      note: "ĐỀ BÀI\nINPUT là tấm hiệu ứng con rồng đọc ở độ nét thật, 256×256 ô. Dòng gán trong vòng lặp đang chép y nguyên từng ô nên ảnh không hề lật. Hãy sửa dòng đó để ô ở cột `col` nhận giá trị của ô đối xứng trong cùng hàng; biến `last` đã giữ sẵn chỉ số cột cuối cùng. OUTPUT đúng phải in cả hai dòng `IMAGE CHANGED SIDES` và `TWO FLIPS RESTORE THE SOURCE`, rồi mở cửa sổ đặt ảnh trước và ảnh sau cạnh nhau — con rồng phải quay đầu sang phía ngược lại.",
      expectOut: {
        all: [
          /IMAGE CHANGED SIDES/,
          /TWO FLIPS RESTORE THE SOURCE/,
        ],
      },
      solution: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

fx = load_plate("dragon", 256)
flipped = blank_grid(len(fx), len(fx[0]))

for row in range(len(fx)):
    last = len(fx[row]) - 1
    for col in range(len(fx[row])):
        flipped[row][col] = fx[row][last - col]

compare_frames([("BEFORE FLIP", fx), ("AFTER FLIP", flipped, "result")], "MIRROR THE IMAGE")

# Xem xong rồi Pip mới chấm
check_flip(fx, flipped)
`,
    },
    {
      checkpoint: {
        text: "Lật ngang một tấm ảnh là ghi lại từng hàng theo thứ tự cột ngược lại: `flipped[row][col] = image[row][last - col]`, với `last = len(image[row]) - 1`. Số hàng và số cột không đổi; chỉ vị trí của từng ô trong hàng đổi chỗ.",
      },
    },
    {
      quiz: {
        title: "Lật theo chiều ngang",
        questions: [
          {
            q: "Một hàng ảnh có 8 cột, đánh số từ 0 đến 7. Sau khi lật ngang, ô ở cột 2 của ảnh mới nhận giá trị của ô nào trong ảnh cũ?",
            a: [
              "Cột 5",
              "Cột 2",
              "Cột 6",
            ],
            correct: 0,
          },
          {
            q: "Bạn viết `flipped[row][col] = image[row][col]` trong vòng lặp lật ảnh. Kết quả nhận được là gì?",
            a: [
              "Ảnh mới giống hệt ảnh cũ, vì mỗi ô được chép đúng vị trí cũ",
              "Ảnh mới bị lật theo chiều dọc thay vì chiều ngang",
              "Máy báo lỗi vì thiếu biến `last`",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Thần chú thứ hai là chồng lớp. Mỗi hình phản chiếu đều nằm trên nền đen, mà đen nghĩa là các giá trị màu gần bằng 0. Cộng số 0 vào nền thì nền giữ nguyên.",
    },
    {
      npc: "Nên chồng một hình phản chiếu lên nền chỉ là cộng từng ô: chỗ nào hình sáng thì nền sáng lên, chỗ nào hình đen thì nền không đổi.",
    },
    {
      npc: "Một điều nữa: mỗi giá trị màu chỉ chạy tới 255. Cộng ra 300 thì phải kẹp lại còn 255, và `min(255, tong)` làm đúng việc đó.",
    },
    {
      code: `from old_computer import say, say_num

# Hai ô cùng vị trí: một ô của nền, một ô của lớp hiệu ứng
scene_pixel = [40, 52, 70]
fx_dark = [0, 0, 0]
fx_glow = [230, 240, 250]

say_num(min(255, scene_pixel[0] + fx_dark[0]))
say_num(min(255, scene_pixel[0] + fx_glow[0]))
say("Adding a black cell keeps the base")
`,
      label: "cong_hai_o.py",
      note: "RUN KIỂM CHỨNG\nBài này không có INPUT; ba ô đã được gán sẵn để bạn nhìn rõ phép cộng. PROCESS cộng kênh đỏ của nền với kênh đỏ của lớp hiệu ứng rồi kẹp bằng `min(255, ...)`. OUTPUT là `40` khi cộng với ô đen, `255` khi cộng với ô sáng (vì 40 + 230 = 270 đã vượt mức 255), và dòng nhắc lại luật.",
      expectOut: {
        all: [
          /^40$/,
          /^255$/,
          /Adding a black cell keeps the base/,
        ],
      },
      solution: `from old_computer import say, say_num

scene_pixel = [40, 52, 70]
fx_dark = [0, 0, 0]
fx_glow = [230, 240, 250]

say_num(min(255, scene_pixel[0] + fx_dark[0]))
say_num(min(255, scene_pixel[0] + fx_glow[0]))
say("Adding a black cell keeps the base")
`,
    },
    {
      code: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

boss = load_plate("boss", 256)
fx = load_plate("dragon", 256)
result = blank_grid(len(boss), len(boss[0]))

for row in range(len(boss)):
    for col in range(len(boss[row])):
        base = boss[row][col]
        layer = fx[row][col]
        red = base[0]  # lượt của bạn: cộng thêm layer[0] rồi kẹp bằng min(255, ...)
        green = base[1]  # lượt của bạn: làm tương tự với kênh xanh lá
        blue = base[2]  # lượt của bạn: làm tương tự với kênh xanh dương
        result[row][col] = [red, green, blue]

compare_frames([("BASE", boss), ("EFFECT LAYER", fx), ("AFTER ADD", result, "result")], "LAYER ONTO A BASE")

# Xem xong rồi Pip mới chấm
check_blend(boss, result)
`,
      label: "viet_lenh_cong_hai_lop.py",
      note: "ĐỀ BÀI\nINPUT là hai tấm ảnh có sẵn ở độ nét thật, 256×256 ô: `boss` là nền con quái lỗi trong màn khói tím, `fx` là lớp con rồng quay trên nền đen. Ba dòng gán `red`, `green`, `blue` đang chép nguyên nền nên lớp hiệu ứng chưa hiện ra. Hãy cộng thêm kênh tương ứng của `layer` vào từng dòng và kẹp kết quả bằng `min(255, ...)`. OUTPUT đúng phải in đủ ba dòng `ALL CHANNELS WITHIN 255`, `NOTHING GOT DARKER`, `EFFECT AREA GOT BRIGHTER`, rồi mở cửa sổ đặt nền, lớp hiệu ứng và kết quả cạnh nhau.",
      expectOut: {
        all: [
          /ALL CHANNELS WITHIN 255/,
          /NOTHING GOT DARKER/,
          /EFFECT AREA GOT BRIGHTER/,
        ],
      },
      solution: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

boss = load_plate("boss", 256)
fx = load_plate("dragon", 256)
result = blank_grid(len(boss), len(boss[0]))

for row in range(len(boss)):
    for col in range(len(boss[row])):
        base = boss[row][col]
        layer = fx[row][col]
        red = min(255, base[0] + layer[0])
        green = min(255, base[1] + layer[1])
        blue = min(255, base[2] + layer[2])
        result[row][col] = [red, green, blue]

compare_frames([("BASE", boss), ("EFFECT LAYER", fx), ("AFTER ADD", result, "result")], "LAYER ONTO A BASE")

# Xem xong rồi Pip mới chấm
check_blend(boss, result)
`,
    },
    {
      quiz: {
        title: "Cộng hai lớp ảnh",
        questions: [
          {
            q: "Ô nền là `[200, 180, 160]` và ô cùng vị trí của lớp hiệu ứng là `[0, 0, 0]`. Sau phép ghép `min(255, base + layer)` cho từng kênh, ô kết quả là gì?",
            a: [
              "`[200, 180, 160]`",
              "`[0, 0, 0]`",
              "`[255, 255, 255]`",
            ],
            correct: 0,
          },
          {
            q: "Ô nền là `[200, 180, 160]` và ô hiệu ứng là `[100, 100, 100]`. Vì sao kênh đỏ của kết quả là `255` chứ không phải `300`?",
            a: [
              "Vì `min(255, 300)` chọn số nhỏ hơn, mà mỗi kênh màu chỉ chạy tới 255",
              "Vì máy tự chia đôi tổng khi tổng quá lớn",
              "Vì kênh đỏ luôn được gán bằng 255 sau mỗi phép cộng",
            ],
            correct: 0,
          },
          {
            q: "Nếu bỏ hẳn `min(255, ...)` và chỉ viết `red = base[0] + layer[0]`, điều gì có thể xảy ra với vùng sáng nhất của khung hình?",
            a: [
              "Một số ô mang giá trị lớn hơn 255, tức là vượt ra ngoài mức màu hợp lệ",
              "Vùng sáng tự động tối lại cho vừa mức 255",
              "Số hàng và số cột của ảnh kết quả tăng lên",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Giờ quay lại câu đố gương đặt ra lúc đầu. Vẫn đúng phép cộng đó, chỉ đổi hai lớp mang vào thành con rồng và con quái — chính là hình bạn được xem ngay từ đầu.",
    },
    {
      code: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

dragon = load_plate("dragon", 256)
boss = load_plate("boss", 256)

result = blank_grid(len(dragon), len(dragon[0]))
for row in range(len(dragon)):
    for col in range(len(dragon[row])):
        a = dragon[row][col]
        b = boss[row][col]
        result[row][col] = [min(255, a[0] + b[0]), min(255, a[1] + b[1]), min(255, a[2] + b[2])]

compare_frames([("SPIRIT DRAGON", dragon), ("ERROR BEAST", boss), ("YOU BUILT THIS", result, "result"), ("GOAL", "goal")], "THE OPENING PUZZLE, SOLVED")

# Xem xong rồi Pip mới chấm
check_over(dragon, result, "DRAGON IS OVER THE BEAST")
`,
      label: "giai_cau_do_mo_man.py",
      note: "RUN KIỂM CHỨNG\nINPUT là hai lớp ảnh con rồng và con quái, cùng đọc ở độ nét thật, 256×256 ô. PROCESS dùng lại đúng phép cộng kèm `min(255, ...)` bạn vừa viết, không đổi một dòng nào. OUTPUT là dòng `DRAGON IS OVER THE BEAST` và cửa sổ bốn tấm: hai lớp rời, khung hình do chính bạn dựng, và tấm đích đã xem ở đầu đảo để bạn đối chiếu.",
      expectOut: {
        all: [
          /DRAGON IS OVER THE BEAST/,
        ],
      },
      solution: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

dragon = load_plate("dragon", 256)
boss = load_plate("boss", 256)

result = blank_grid(len(dragon), len(dragon[0]))
for row in range(len(dragon)):
    for col in range(len(dragon[row])):
        a = dragon[row][col]
        b = boss[row][col]
        result[row][col] = [min(255, a[0] + b[0]), min(255, a[1] + b[1]), min(255, a[2] + b[2])]

compare_frames([("SPIRIT DRAGON", dragon), ("ERROR BEAST", boss), ("YOU BUILT THIS", result, "result"), ("GOAL", "goal")], "THE OPENING PUZZLE, SOLVED")

# Xem xong rồi Pip mới chấm
check_over(dragon, result, "DRAGON IS OVER THE BEAST")
`,
    },
    {
      remember: "Một khung hình trong gương luôn được dựng từ hai thứ rời nhau: tấm nền và hình phản chiếu nằm trên nền đen. Gương giữ chúng riêng, rồi cộng lại đúng lúc cần hiện.",
    },
    {
      npc: "Ngoài kia bạn không gõ tên thần chú. Bạn niệm nó thành tiếng, và gương phải tự nghe lấy. Pip vừa mở cho bạn một cái bùa nghe tên là `voice_charm`.",
    },
    {
      npc: "`listen(spells)` mở micro và chờ. Bạn phát âm trong các từ trong `spells` thì nó trả về đúng từ đó; gương không nghe ra từ nào thì nó trả về chuỗi rỗng `\"\"`.",
    },
    {
      code: `from old_computer import say
from voice_charm import listen
from camera_charm import display

# INPUT thật: từ bạn niệm ra tiếng. Gương chỉ nhận ba từ trong danh sách này.
spells = ["dragon", "boss", "flip"]
command = listen(spells)

say("MIRROR HEARD:")
say(command)
display(command)
`,
      label: "nghe_than_chu.py",
      note: "RUN KIỂM CHỨNG\nINPUT là giọng của bạn. Khi chạy, gương mở micro và chờ vài giây — hãy niệm to một từ trong `spells`. Nếu micro chưa bật được thì gương hiện sẵn ba từ đó thành nút bấm, bạn chạm một nút cũng được. OUTPUT là dòng `MIRROR HEARD:` rồi tới đúng từ gương bắt được; không nghe ra từ nào thì dòng thứ hai trống.",
      expectOut: {
        all: [
          /MIRROR HEARD:/,
        ],
      },
      solution: `from old_computer import say
from voice_charm import listen
from camera_charm import display

spells = ["dragon", "boss", "flip"]
command = listen(spells)

say("MIRROR HEARD:")
say(command)
display(command)
`,
    },
    {
      npc: "Chọn theo điều kiện thì dùng `if`, `elif` và `else`. Nhánh `else` lo phần quan trọng: khi gương nghe ra một từ lạ, hoặc không nghe được gì, nó vẫn phải xử sự tử tế.",
    },
    {
      code: `from old_computer import say
from voice_charm import listen
from camera_charm import load_plate, compare_frames

spells = ["dragon", "boss"]
command = listen(spells)
scene = load_plate("scene", 16)

if command == "dragon":
    say("SPIRIT DRAGON SUMMONED")
    compare_frames([("BASE", scene, "scene"), ("SUMMONED LAYER", load_plate("dragon", 16), "dragon")], "KOTO")
elif command == "boss":
    say("ERROR BEAST SUMMONED")
    compare_frames([("BASE", scene, "scene"), ("SUMMONED LAYER", load_plate("boss", 16), "boss")], "BOSS")
else:
    say("UNKNOWN WORD")
`,
      label: "chon_hieu_ung_theo_loi.py",
      note: "RUN KIỂM CHỨNG\nINPUT là từ bạn niệm ra tiếng, do `listen(spells)` bắt được. PROCESS so từ đó với từng mốc bằng `if` và `elif`. OUTPUT phụ thuộc vào từ bạn niệm: `dragon` cho ra dòng `SPIRIT DRAGON SUMMONED` kèm cửa sổ đặt nền cạnh hình con rồng, `boss` cho ra con quái, còn im lặng cho hết giờ thì nhánh `else` chạy. Nhánh nào chạy cũng được tính là xong — điều cần thấy là bộ chọn đưa đúng từ tới đúng nhánh.",
      expectOut: [
        /SPIRIT DRAGON SUMMONED/,
        /ERROR BEAST SUMMONED/,
        /UNKNOWN WORD/,
      ],
      solution: `from old_computer import say
from voice_charm import listen
from camera_charm import load_plate, compare_frames

spells = ["dragon", "boss"]
command = listen(spells)
scene = load_plate("scene", 16)

if command == "dragon":
    say("SPIRIT DRAGON SUMMONED")
    compare_frames([("BASE", scene, "scene"), ("SUMMONED LAYER", load_plate("dragon", 16), "dragon")], "KOTO")
elif command == "boss":
    say("ERROR BEAST SUMMONED")
    compare_frames([("BASE", scene, "scene"), ("SUMMONED LAYER", load_plate("boss", 16), "boss")], "BOSS")
else:
    say("UNKNOWN WORD")
`,
    },
    {
      npc: "Gương còn nghe được thần chú `flip`, và từ đó không gọi hình phản chiếu nào cả — nó lật chính khung hình đang chiếu. Bạn hãy thêm nhánh cho nó.",
    },
    {
      code: `from camera_charm import play_effect, display

# Bốn từ này lần lượt được đưa vào bộ chọn, thay cho bốn lần nghe micro
heard = ["dragon", "boss", "flip", "meo meo"]

for command in heard:
    if command == "dragon":
        play_effect("dragon")
    elif command == "boss":
        play_effect("boss")
    else:
        display("UNKNOWN WORD")
`,
      label: "them_nhanh_lat_hinh.py",
      note: "ĐỀ BÀI\nINPUT là bốn từ đã gán sẵn trong `heard`, chạy lần lượt qua bộ chọn. Hai từ đầu đã có nhánh riêng và chiếu hiệu ứng bằng `play_effect`. Bộ chọn chưa biết từ `flip` nên nó rơi xuống nhánh `else`. Hãy thêm một nhánh `elif` cho `flip` gọi `display(\"MIRROR THE FRAME\")`, đặt trước `else`. OUTPUT đúng: hai lần chiếu hiệu ứng (`dragon`, `boss`), rồi dòng `MIRROR THE FRAME`, rồi dòng `UNKNOWN WORD`.",
      expectOut: { all: [/MIRROR THE FRAME/, /UNKNOWN WORD/, { kind: 'studio_start', text: /effect_play/, minCount: 2 }] },
      solution: `from camera_charm import play_effect, display

heard = ["dragon", "boss", "flip", "meo meo"]

for command in heard:
    if command == "dragon":
        play_effect("dragon")
    elif command == "boss":
        play_effect("boss")
    elif command == "flip":
        display("MIRROR THE FRAME")
    else:
        display("UNKNOWN WORD")
`,
    },
    {
      quiz: {
        title: "Bộ chọn hiệu ứng",
        questions: [
          {
            q: "Đọc đoạn Mật Ngữ này:\n```python\nif command == \"dragon\":\n    say(\"RONG\")\nelif command == \"boss\":\n    say(\"QUAI\")\nelse:\n    say(\"LA\")\n```\nVới `command = \"boss\"`, máy in ra gì?",
            a: [
              "`QUAI`",
              "`RONG`",
              "`QUAI` rồi `LA`",
            ],
            correct: 0,
          },
          {
            q: "Vẫn đoạn Mật Ngữ trên, nhưng lần này `command = \"rain\"`. Máy in ra gì?",
            a: [
              "`LA`, vì không mốc nào khớp nên nhánh `else` chạy",
              "Không in gì, vì `rain` không có trong chuỗi điều kiện",
              "`RONG`, vì máy chạy nhánh đầu tiên khi không tìm được mốc khớp",
            ],
            correct: 0,
          },
          {
            q: "Bạn muốn thêm từ `flip` vào bộ chọn đã có `dragon`, `boss` và một nhánh `else`. Đặt nhánh mới ở đâu thì đúng?",
            a: [
              "Thêm một nhánh `elif command == \"flip\":` đứng trước `else`",
              "Thêm sau `else`, vì `else` chỉ lo các từ đứng trước nó",
              "Thay `else` thành `elif command == \"flip\":` và bỏ hẳn nhánh cuối",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Tới lúc thả thần chú ra khỏi lưới 16 ô rồi. `play_effect(name)` chiếu lớp hiệu ứng cỡ thật lên hình bạn trong camera, vẫn bằng đúng phép cộng ánh sáng bạn vừa viết.",
    },
    {
      code: `from old_computer import say
from voice_charm import listen
from camera_charm import play_effect

spells = ["phoenix", "butterfly", "sakura"]
command = listen(spells)

if command == "phoenix":
    say("PHOENIX RISES")
    play_effect("phoenix")
elif command == "butterfly":
    say("BUTTERFLY SWARM")
    play_effect("butterfly")
elif command == "sakura":
    say("SAKURA BLOOM")
    play_effect("sakura")
else:
    say("UNKNOWN WORD")
`,
      label: "tha_than_chu_co_that.py",
      note: "RUN KIỂM CHỨNG\nINPUT là thần chú bạn niệm ra tiếng. PROCESS vẫn là chuỗi `if`/`elif`/`else` quen thuộc. OUTPUT lần này là lớp hiệu ứng cỡ thật chiếu đè lên hình camera của bạn, đúng theo từ bạn niệm: phượng hoàng bung cánh, đàn bướm pha lê, hoặc trận mưa hoa anh đào. Niệm từ nào cũng được tính là xong; gương không nghe ra từ nào thì nhánh `else` chạy, và như vậy cũng là đúng. Chỗ nào lớp hiệu ứng tối thì hình bạn giữ nguyên, chỗ nào nó sáng thì sáng bừng lên — đúng luật cộng ánh sáng bạn vừa viết.",
      expectOut: { all: [[
        /PHOENIX RISES/,
        /BUTTERFLY SWARM/,
        /SAKURA BLOOM/,
        /UNKNOWN WORD/,
      ], { kind: 'studio_start', text: /effect_play/, minCount: 1 }] },
      solution: `from old_computer import say
from voice_charm import listen
from camera_charm import play_effect

spells = ["phoenix", "butterfly", "sakura"]
command = listen(spells)

if command == "phoenix":
    say("PHOENIX RISES")
    play_effect("phoenix")
elif command == "butterfly":
    say("BUTTERFLY SWARM")
    play_effect("butterfly")
elif command == "sakura":
    say("SAKURA BLOOM")
    play_effect("sakura")
else:
    say("UNKNOWN WORD")
`,
    },
    {
      npc: "Trước khi đi tiếp, Pip nói thật cho bạn nghe `play_effect` là gì. Nó không có phép màu nào cả: nó chỉ mở một tệp video rồi đè lên khung hình.",
    },
    {
      code: `from old_computer import say
from camera_charm import show_effect_source

# Play the effect file on its own: no camera under it, no blending over it
show_effect_source("dragon")
show_effect_source("phoenix")
`,
      label: "xem_tep_goc.py",
      note: `RUN KIỂM CHỨNG
INPUT là hai tệp hiệu ứng có sẵn. OUTPUT là chính hai tệp đó chiếu một mình: không có camera bên dưới, cũng không pha trộn gì. Nhìn kỹ mà xem — mỗi tệp chỉ là ánh sáng nằm trên một hình chữ nhật ĐEN, đúng thứ bạn đã cộng bằng tay ở lưới 16 ô.`,
      expectOut: { kind: 'studio_start', text: /effect_play/, minCount: 2 },
      solution: `from old_computer import say
from camera_charm import show_effect_source

# Play the effect file on its own: no camera under it, no blending over it
show_effect_source("dragon")
show_effect_source("phoenix")
`,
    },
    {
      npc: "Và một đoạn video cũng không phải thứ gì lạ: nó là một DANH SÁCH ảnh, chiếu nối nhau thật nhanh. Mình lấy thử bốn khung hình ra khỏi đoạn con rồng.",
    },
    {
      code: `from old_computer import say, say_num
from pip_test import count_color
from camera_charm import load_plate, compare_frames

# Four real frames, taken straight out of the spirit-dragon video
frames = [load_plate("frame0", 16), load_plate("frame1", 16),
          load_plate("frame2", 16), load_plate("frame3", 16)]

say("FRAME COUNT:")
say_num(len(frames))

# Walk the list by index — the same way a for loop will in a moment
for i in range(len(frames)):
    say("frames[" + str(i) + "] is one picture")

compare_frames([("frames[0]", frames[0], "frame0"), ("frames[1]", frames[1], "frame1"),
                ("frames[2]", frames[2], "frame2"), ("frames[3]", frames[3], "frame3")],
               "A VIDEO IS A LIST OF PICTURES", False)
`,
      label: "video_la_danh_sach_anh.py",
      note: "RUN KIỂM CHỨNG\nINPUT là bốn khung hình được cắt ra từ chính đoạn video con rồng. OUTPUT là số `4` và cửa sổ đặt bốn khung cạnh nhau. Chúng chỉ khác nhau chút ít, vì chúng là bốn thời điểm liền nhau của cùng một chuyển động — chiếu nối tiếp đủ nhanh thì mắt thấy con rồng đang bay.",
      expectOut: {
        all: [
          /^4$/,
        ],
      },
      solution: `from old_computer import say, say_num
from pip_test import count_color
from camera_charm import load_plate, compare_frames

# Four real frames, taken straight out of the spirit-dragon video
frames = [load_plate("frame0", 16), load_plate("frame1", 16),
          load_plate("frame2", 16), load_plate("frame3", 16)]

say("FRAME COUNT:")
say_num(len(frames))

# Walk the list by index — the same way a for loop will in a moment
for i in range(len(frames)):
    say("frames[" + str(i) + "] is one picture")

compare_frames([("frames[0]", frames[0], "frame0"), ("frames[1]", frames[1], "frame1"),
                ("frames[2]", frames[2], "frame2"), ("frames[3]", frames[3], "frame3")],
               "A VIDEO IS A LIST OF PICTURES", False)
`,
    },
    {
      npc: "Giờ ghép hai điều đó lại. Bạn đã biết cộng hai lưới thành một khung hình. Một đoạn video chỉ là nhiều khung hình. Vậy làm một khung trước đã.",
    },
    {
      code: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

# play_effect is only this sum, applied to ONE frame.
def play_effect_myself(base, layer):
    result = blank_grid(len(base), len(base[0]))
    for row in range(len(base)):
        for col in range(len(base[row])):
            a = base[row][col]
            b = layer[row][col]
            result[row][col] = a  # lượt của bạn: cộng a với b theo từng kênh rồi kẹp bằng min(255, ...)
    return result

boss = load_plate("boss", 16)
fx = load_plate("frame1", 16)
shot = play_effect_myself(boss, fx)

# Pip chấm hộ bạn
check_over(boss, shot)

compare_frames([("BASE", boss, "boss"), ("ONE FX FRAME", fx, "frame1"), ("BLENDED", shot)], "BLEND ONE FRAME")
`,
      label: "tu_viet_play_effect.py",
      note: "ĐỀ BÀI\nINPUT là tấm nền và MỘT khung hình của lớp con rồng. Hãy hoàn thiện lệnh `play_effect_myself`: dòng gán trong vòng lặp đang chép nguyên ô nền, bạn sửa nó thành cộng `a` với `b` từng kênh rồi kẹp bằng `min(255, ...)`. OUTPUT đúng phải in `ONE FRAME DONE` và mở cửa sổ có khung hình đã ghép.",
      expectOut: {
        all: [
          /ONE FRAME DONE/,
        ],
      },
      solution: `from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

# play_effect is only this sum, applied to ONE frame.
def play_effect_myself(base, layer):
    result = blank_grid(len(base), len(base[0]))
    for row in range(len(base)):
        for col in range(len(base[row])):
            a = base[row][col]
            b = layer[row][col]
            result[row][col] = [min(255, a[0] + b[0]), min(255, a[1] + b[1]), min(255, a[2] + b[2])]
    return result

boss = load_plate("boss", 16)
fx = load_plate("frame1", 16)
shot = play_effect_myself(boss, fx)

# Pip chấm hộ bạn
check_over(boss, shot)

compare_frames([("BASE", boss, "boss"), ("ONE FX FRAME", fx, "frame1"), ("BLENDED", shot)], "BLEND ONE FRAME")
`,
    },
    {
      npc: "Xong một khung rồi. Mà bốn khung thì cũng chỉ là làm lại việc đó bốn lần — đúng chỗ để `for` ra tay.",
    },
    {
      code: `from old_computer import say
from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

def play_effect_myself(base, layer):
    result = blank_grid(len(base), len(base[0]))
    for row in range(len(base)):
        for col in range(len(base[row])):
            a = base[row][col]
            b = layer[row][col]
            result[row][col] = [min(255, a[0] + b[0]), min(255, a[1] + b[1]), min(255, a[2] + b[2])]
    return result

boss = load_plate("boss", 16)
frames = [load_plate("frame0", 16), load_plate("frame1", 16),
          load_plate("frame2", 16), load_plate("frame3", 16)]

# lượt của bạn: cho vòng for chạy qua từng khung, ghép từng khung rồi append vào shots
shots = []
say("WHOLE CLIP BLENDED")

labels = []
for i in range(len(shots)):
    labels.append(("shots[" + str(i) + "]", shots[i], "frame" + str(i)))
compare_frames(labels, "A FOR LOOP MAKES IT A VIDEO", False)
`,
      label: "for_noi_thanh_video.py",
      note: "ĐỀ BÀI\nINPUT là tấm nền `boss` và danh sách `frames` gồm bốn khung hình của lớp con rồng; lệnh `play_effect_myself(base, layer)` đã hoàn chỉnh sẵn trong ô này và trả về một khung hình đã ghép. Hãy dùng `for` chạy qua từng khung trong `frames`, gọi lệnh đó với `boss`, rồi `append` kết quả vào danh sách `shots`. OUTPUT đúng phải in `WHOLE CLIP BLENDED` và mở cửa sổ có đủ bốn khung hình đã ghép — đó chính là một đoạn video do bạn dựng.",
      expectOut: {
        all: [
          /WHOLE CLIP BLENDED/,
        ],
      },
      solution: `from old_computer import say
from pip_test import check_flip, check_blend, check_over
from camera_charm import load_plate, blank_grid, compare_frames

def play_effect_myself(base, layer):
    result = blank_grid(len(base), len(base[0]))
    for row in range(len(base)):
        for col in range(len(base[row])):
            a = base[row][col]
            b = layer[row][col]
            result[row][col] = [min(255, a[0] + b[0]), min(255, a[1] + b[1]), min(255, a[2] + b[2])]
    return result

boss = load_plate("boss", 16)
frames = [load_plate("frame0", 16), load_plate("frame1", 16),
          load_plate("frame2", 16), load_plate("frame3", 16)]

shots = []
for frame in frames:
    shots.append(play_effect_myself(boss, frame))
say("WHOLE CLIP BLENDED")

labels = []
for i in range(len(shots)):
    labels.append(("shots[" + str(i) + "]", shots[i], "frame" + str(i)))
compare_frames(labels, "A FOR LOOP MAKES IT A VIDEO", False)
`,
    },
    {
      remember: "`play_effect` không phải phép màu. Một đoạn video là một danh sách khung hình; ghép hiệu ứng vào video là cộng `min(255, base + layer)` cho MỘT khung, rồi để `for` lặp lại đúng việc đó trên mọi khung. Cái bạn viết trên lưới 16 ô và cái máy chạy trên khung 1280 ô là cùng một phép tính.",
    },
    {
      quiz: {
        title: "Một khung hình, rồi cả đoạn video",
        questions: [
          {
            q: "Bạn đã viết được lệnh ghép MỘT khung hình lên nền. Muốn ghép cả đoạn video 240 khung thì cần thêm gì?",
            a: [
              "Một vòng `for` chạy qua danh sách khung hình, gọi lại đúng lệnh đó cho từng khung",
              "Một phép tính hoàn toàn khác, vì video không giống ảnh",
              "Không cần gì thêm, vì lệnh tự chạy hết cả đoạn video",
            ],
            correct: 0,
          },
          {
            q: "Đoạn video hiệu ứng được quay trên nền đen. Vì sao chi tiết đó lại quan trọng khi ghép?",
            a: [
              "Vì ô đen có giá trị màu gần `0`, cộng vào nền thì nền gần như không đổi — chỉ phần sáng mới hiện lên",
              "Vì nền đen giúp tệp video nhẹ hơn khi tải về",
              "Vì máy chỉ đọc được video có nền đen",
            ],
            correct: 0,
          },
          {
            q: "Đọc đoạn Mật Ngữ này:\n```python\nshots = []\nfor frame in frames:\n    shots.append(play_effect_myself(boss, frame))\n```\nSau khi chạy, `shots` chứa gì?",
            a: [
              "Mỗi khung hình đã được ghép hiệu ứng lên nền, xếp theo đúng thứ tự cũ",
              "Chỉ khung hình cuối cùng, vì mỗi vòng lặp ghi đè lần trước",
              "Danh sách `frames` ban đầu, chưa ghép gì",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Nhưng để ý mà xem: lớp hiệu ứng đang phủ đè lên cả mặt bạn. Tới giờ gương mới chỉ biết chồng phẳng, nó chưa biết trong khung hình đâu là người.",
    },
    {
      npc: "Đây là lá bùa cuối cùng. `find_human()` đi hỏi TỪNG Ô một câu duy nhất: ô này có nằm trên người không? Trả lời xong cả lưới là ra viền người.",
    },
    {
      npc: "Trước khi dùng `find_human`, Pip cho bạn xem ruột của nó. `human_mask()` trả về một lưới chỉ gồm 1 và 0: ô nào nằm trên người thì là 1.",
    },
    {
      code: 'from camera_charm import human_mask, blank_grid, compare_frames\n\n# human_mask asks every cell one question: is this cell on a person?\n# 1 = yes, 0 = no. Nothing more magical than that.\nmask = human_mask(16)\n\npainted = blank_grid(len(mask), len(mask[0]))\nfor row in range(len(mask)):\n    for col in range(len(mask[row])):\n        # lượt của bạn: tô [60, 140, 255] vào ô là người, [10, 14, 20] vào ô còn lại\n        painted[row][col] = [10, 14, 20]\n\ncompare_frames([("PAINTED BY HAND", painted)], "IF THE CELL IS HUMAN, PAINT IT BLUE", False)\n',
      label: "to_mau_nguoi.py",
      note: "ĐỀ BÀI\nINPUT là hình camera của bạn, đọc thành lưới 16 ô. `human_mask(16)` trả về `mask`, trong đó `mask[row][col]` bằng `1` nếu ô đó nằm trên người và `0` nếu không. Hãy dùng `if` để tô `[60, 140, 255]` (xanh dương) vào những ô là người, và `[10, 14, 20]` vào những ô còn lại. OUTPUT là một hình bóng người màu xanh dương do chính vòng lặp của bạn tô ra.",
      expectOut: { kind: 'studio_start', text: /human_mask/, minCount: 1 },
      solution: 'from camera_charm import human_mask, blank_grid, compare_frames\n\n# human_mask asks every cell one question: is this cell on a person?\n# 1 = yes, 0 = no. Nothing more magical than that.\nmask = human_mask(16)\n\npainted = blank_grid(len(mask), len(mask[0]))\nfor row in range(len(mask)):\n    for col in range(len(mask[row])):\n        if mask[row][col] == 1:\n            painted[row][col] = [60, 140, 255]\n        else:\n            painted[row][col] = [10, 14, 20]\n\ncompare_frames([("PAINTED BY HAND", painted)], "IF THE CELL IS HUMAN, PAINT IT BLUE", False)\n',
    },
    {
      remember: "`human_mask()` chỉ trả lời một câu cho từng ô: ô này có nằm trên người không, 1 hay 0. Có lưới đó rồi thì `if mask[row][col] == 1` cho bạn quyết định vẽ gì lên người và vẽ gì lên nền. `find_human` cũng làm đúng vậy, chỉ khác là nó xếp sẵn các lớp giúp bạn.",
    },
    {
      npc: "Có viền người rồi thì gương kẹp bạn vào GIỮA: nền và hiệu ứng `behind` vẽ trước, tới lượt các ô thuộc về người, rồi hiệu ứng `front` vẽ sau cùng.",
    },
    {
      code: `from old_computer import say
from camera_charm import find_human

# find_human does the loop you just wrote, then stacks the layers for you:
#   scene  = replaces the room, drawn first
#   behind = an effect between the room and you
#   front  = an effect in front of you, close to the lens
find_human(scene="forest", behind="dragon", front="sakura")
say("A FRAME WITH REAL DEPTH")
`,
      label: "bua_tim_nguoi.py",
      note: "RUN KIỂM CHỨNG\nINPUT là hình camera của bạn. PROCESS: `find_human` xét từng ô trong khung hình và hỏi ô đó có thuộc về người hay không; các ô trả lời CÓ gộp lại thành viền người. Sau đó gương xếp bốn lớp — rừng phép thay cho căn phòng, con rồng đi phía SAU lưng bạn, bạn ở giữa, cánh hoa rơi phía TRƯỚC mặt bạn. OUTPUT là khung hình có chiều sâu thật: con rồng bị bạn che bớt, còn cánh hoa thì phủ lên bạn. Vẫn đúng luật cộng ánh sáng cũ, chỉ khác chỗ đứng trong chồng lớp.",
      expectOut: { all: [/A FRAME WITH REAL DEPTH/, { kind: 'studio_start', text: /human_layers/, minCount: 1 }] },
      solution: `from old_computer import say
from camera_charm import find_human

# find_human does the loop you just wrote, then stacks the layers for you:
#   scene  = replaces the room, drawn first
#   behind = an effect between the room and you
#   front  = an effect in front of you, close to the lens
find_human(scene="forest", behind="dragon", front="sakura")
say("A FRAME WITH REAL DEPTH")
`,
    },
    {
      code: `from camera_charm import find_human

# lượt của bạn: đổi ba lớp này thành màn diễn của riêng bạn
# behind: dragon / phoenix / butterfly / smoke / lightning
# front: sakura / flower
find_human(scene="forest", behind="phoenix", front="flower")
`,
      label: "man_dien_cua_ban.py",
      note: "XƯỞNG CỦA BẠN — không chấm điểm. Đổi `behind` và `front` để dựng màn diễn của riêng bạn, rồi chạy lại. Thử đặt cùng một hiệu ứng vào `behind` rồi vào `front` để thấy rõ khác biệt: ở `behind` nó bị bạn che, ở `front` nó phủ lên bạn.",
      expectOut: null,
      solution: `from camera_charm import find_human

# lượt của bạn: đổi ba lớp này thành màn diễn của riêng bạn
# behind: dragon / phoenix / butterfly / smoke / lightning
# front: sakura / flower
find_human(scene="forest", behind="phoenix", front="flower")
`,
    },
    {
      quiz: {
        title: "Thứ tự xa gần",
        questions: [
          {
            q: "Bạn gọi `find_human(scene=\"forest\", behind=\"dragon\", front=\"sakura\")`. Trong khung hình kết quả, con rồng và cánh hoa nằm ở đâu so với bạn?",
            a: [
              "Con rồng ở sau lưng nên bị bạn che bớt; cánh hoa ở trước mặt nên phủ lên bạn",
              "Cả hai đều phủ lên bạn, vì hiệu ứng luôn nằm trên cùng",
              "Cả hai đều bị bạn che, vì người luôn nằm trên cùng",
            ],
            correct: 0,
          },
          {
            q: "`find_human` phải trả lời câu hỏi nào cho TỪNG ô của khung hình?",
            a: [
              "Ô này có nằm trên người hay không",
              "Ô này sáng hơn hay tối hơn ô bên cạnh",
              "Ô này nên đổi sang màu gì",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Và bạn không bị bó trong mấy lớp Pip đưa đâu. Tự làm một đoạn video sáng trên nền đen — vẽ, quay, hay nhờ máy dựng đều được — rồi `play_my_effect()` sẽ chiếu chính nó lên hình bạn. Bạn có thể dùng Gemini để tạo video nhé, nhớ hỏi chú Nhựt để lấy prompt :D ",
    },
    {
      code: `from old_computer import say
from camera_charm import play_my_effect

# Chọn một tệp video từ máy của bạn; tệp chỉ được đọc trong trình duyệt
play_my_effect()
`,
      label: "lop_hieu_ung_cua_ban.py",
      note: "XƯỞNG CỦA BẠN — không chấm điểm. INPUT là một tệp video bạn chọn từ thiết bị; nếu bấm hủy thì bài dùng lớp có sẵn để không bị ngắt. Đoạn video càng đúng kiểu SÁNG TRÊN NỀN ĐEN thì ghép càng đẹp, vì phép cộng giữ phần sáng và bỏ qua phần đen. OUTPUT là chính đoạn video đó nằm trên hình camera của bạn.",
      expectOut: null,
      solution: `from old_computer import say
from camera_charm import play_my_effect

play_my_effect()
`,
    },
    {
      npc: "Một mình giọng nói thì chưa đủ. Gương còn nhìn được bàn tay bạn nữa: `listen()` chọn thần chú nào, còn `watch()` đếm số ngón tay để biết niệm mạnh tới đâu.",
    },
    {
      code: `from old_computer import say, say_num
from voice_charm import listen
from camera_charm import watch, play_effect, display

# Hai INPUT thật cùng lúc: một từ miệng bạn, một từ bàn tay bạn
spells = ["dragon", "boss"]
command = listen(spells)
power = watch()

say(command)
say_num(power)

if power >= 3:
    display("FULL POWER CAST")
    play_effect("phoenix")
else:
    display("WEAK CAST")
    play_effect("sakura")
`,
      label: "giong_noi_va_ban_tay.py",
      note: "ĐỀ BÀI\nBài này có HAI input thật. `listen(spells)` nghe thần chú bạn niệm; `watch()` đợi bàn tay bạn giơ lên và trả về số ngón tay đang mở. Hãy chạy thử vài lần: đổi thần chú, và đổi số ngón tay giơ lên. OUTPUT là từ nghe được, số ngón tay đếm được, rồi `FULL POWER CAST` khi bạn giơ từ 3 ngón trở lên, ngược lại là `WEAK CAST`. Giơ mấy ngón cũng được tính là xong; hãy chạy hai lần với số ngón khác nhau để thấy cả hai nhánh.",
      expectOut: [
        /FULL POWER CAST/,
        /WEAK CAST/,
      ],
      solution: `from old_computer import say, say_num
from voice_charm import listen
from camera_charm import watch, play_effect, display

spells = ["dragon", "boss"]
command = listen(spells)
power = watch()

say(command)
say_num(power)

if power >= 3:
    display("FULL POWER CAST")
    play_effect("phoenix")
else:
    display("WEAK CAST")
    play_effect("sakura")
`,
    },
    {
      npc: "Bạn có đủ mảnh rồi đấy: nghe được lời, đếm được ngón tay, tìm được người, xếp được lớp. Giờ Pip đưa bạn khung sườn, bạn ghép chúng thành một màn diễn hoàn chỉnh.",
    },
    {
      npc: "Mảnh đầu là hai lệnh nhỏ chỉ lo VIỆC NGHĨ. Chúng không chạm vào camera hay micro, nên bạn thử được ngay bằng giá trị tự đặt.",
    },
    {
      code: 'from old_computer import say\n\n# These two functions are the brain of the show. They never touch the camera\n# or the microphone: a value goes in, a decision comes out.\n\ndef pick_effect(command):\n    """Return the effect-layer name for the word that was heard."""\n    # lượt của bạn: dragon -> "dragon", boss -> "boss", còn lại -> "sakura"\n    return "sakura"\n\ndef pick_depth(power):\n    """3 fingers or more puts the effect IN FRONT; fewer puts it BEHIND."""\n    # lượt của bạn: trả về "front" hoặc "behind"\n    return "behind"\n\n# Try them with fixed values — no microphone, no camera needed\nsay(pick_effect("dragon"))\nsay(pick_effect("boss"))\nsay(pick_depth(4))\nsay(pick_depth(1))\n',
      label: "du_an_1_bo_nao.py",
      note: "ĐỀ BÀI\nBài này không có INPUT thật; bạn tự đưa giá trị vào để thử. Hãy hoàn thiện hai lệnh: `pick_effect(command)` trả về `\"dragon\"` khi nghe `dragon`, `\"boss\"` khi nghe `boss`, còn lại trả về `\"sakura\"`; `pick_depth(power)` trả về `\"front\"` khi số ngón từ 3 trở lên, ngược lại `\"behind\"`. OUTPUT đúng gồm bốn dòng theo thứ tự: `dragon`, `boss`, `front`, `behind`.",
      expectOut: { all: [/^dragon$/m, /^boss$/m, /^front$/m, /^behind$/m] },
      solution: 'from old_computer import say\n\n# These two functions are the brain of the show. They never touch the camera\n# or the microphone: a value goes in, a decision comes out.\n\ndef pick_effect(command):\n    """Return the effect-layer name for the word that was heard."""\n    if command == "dragon":\n        return "dragon"\n    elif command == "boss":\n        return "boss"\n    else:\n        return "sakura"\n\ndef pick_depth(power):\n    """3 fingers or more puts the effect IN FRONT; fewer puts it BEHIND."""\n    if power >= 3:\n        return "front"\n    else:\n        return "behind"\n\n# Try them with fixed values — no microphone, no camera needed\nsay(pick_effect("dragon"))\nsay(pick_effect("boss"))\nsay(pick_depth(4))\nsay(pick_depth(1))\n',
    },
    {
      npc: "Mảnh thứ hai là phần CHẠY THẬT. `run_show` đọc hai input thật, hỏi hai lệnh vừa viết, rồi mới xếp lớp — mỗi lệnh lo đúng một việc.",
    },
    {
      code: 'from old_computer import say\nfrom voice_charm import listen\nfrom camera_charm import watch, find_human, play_effect, display\n\ndef pick_effect(command):\n    if command == "dragon":\n        return "dragon"\n    elif command == "boss":\n        return "boss"\n    else:\n        return "sakura"\n\ndef pick_depth(power):\n    if power >= 3:\n        return "front"\n    else:\n        return "behind"\n\ndef run_show():\n    """Read the two real inputs, ask the two functions, then stack the layers."""\n    command = listen(["dragon", "boss", "sakura"])\n    power = watch()\n    effect = pick_effect(command)\n    depth = pick_depth(power)\n    display("SPELL: " + effect)\n    # lượt của bạn: gọi find_human với scene="forest" và đặt effect vào\n    # đúng chỗ — behind hay front, tuỳ theo depth\n    say("SHOW DONE")\n\nrun_show()\n',
      label: "du_an_2_man_dien.py",
      note: "ĐỀ BÀI\nINPUT là giọng nói và bàn tay của bạn. Hai lệnh `pick_effect` và `pick_depth` đã có sẵn đầy đủ trong ô này. Trong `run_show`, hãy gọi `find_human(scene=\"forest\", ...)` và đặt `effect` vào đúng chỗ: nếu `depth` là `\"front\"` thì truyền qua tham số `front`, ngược lại truyền qua `behind`. OUTPUT đúng in `SPELL:`, `DEPTH:` rồi `SHOW DONE`, và dựng đúng màn diễn bạn vừa gọi ra.",
      expectOut: { all: [/SHOW DONE/, { kind: 'studio_start', text: /human_layers/, minCount: 1 }] },
      solution: 'from old_computer import say\nfrom voice_charm import listen\nfrom camera_charm import watch, find_human, play_effect, display\n\ndef pick_effect(command):\n    if command == "dragon":\n        return "dragon"\n    elif command == "boss":\n        return "boss"\n    else:\n        return "sakura"\n\ndef pick_depth(power):\n    if power >= 3:\n        return "front"\n    else:\n        return "behind"\n\ndef run_show():\n    """Read the two real inputs, ask the two functions, then stack the layers."""\n    command = listen(["dragon", "boss", "sakura"])\n    power = watch()\n    effect = pick_effect(command)\n    depth = pick_depth(power)\n    display("SPELL: " + effect)\n    if depth == "front":\n        find_human(scene="forest", front=effect)\n    else:\n        find_human(scene="forest", behind=effect)\n    say("SHOW DONE")\n\nrun_show()\n',
    },
    {
      remember: "Một chương trình lớn được ghép từ nhiều lệnh nhỏ, mỗi lệnh lo đúng một việc: `pick_effect` và `pick_depth` chỉ NGHĨ nên thử được bằng giá trị tự đặt, còn `run_show` mới đọc INPUT thật và gọi chúng. Tách như vậy thì hỏng chỗ nào biết ngay chỗ đó.",
    },
    {
      quiz: {
        title: "Ghép các mảnh thành một chương trình",
        questions: [
          {
            q: "Vì sao `pick_depth(power)` thử được ngay mà không cần camera?",
            a: [
              "Vì nó chỉ nhận một con số rồi trả về một chuỗi — nó không tự đi đọc bàn tay",
              "Vì camera luôn trả về 3 ngón nếu không thấy tay",
              "Vì mọi lệnh trong Python đều chạy được khi không có camera",
            ],
            correct: 0,
          },
          {
            q: "Trong `run_show`, thứ tự nào đúng?",
            a: [
              "Đọc INPUT thật trước, hỏi `pick_effect`/`pick_depth` để quyết định, rồi mới xếp lớp",
              "Xếp lớp trước, rồi mới đọc INPUT để xem có hợp không",
              "Gọi `pick_effect` trước khi có `command`, vì lệnh tự biết phải chờ",
            ],
            correct: 0,
          },
        ],
      },
    },
    {
      npc: "Còn một chuyện nữa. Màn diễn vừa rồi chỉ nghe được ĐÚNG MỘT lần rồi tắt. Một sân khấu thật thì phải nghe mãi: niệm xong một thần chú, gương chờ bạn niệm tiếp.",
    },
    {
      npc: "Muốn làm mãi thì dùng `while True`. Nó lặp không có điểm dừng sẵn, nên chính bạn phải đặt cửa ra: nghe thấy `stop` thì `break`.",
    },
    {
      code: 'from old_computer import say\nfrom voice_charm import listen\nfrom camera_charm import watch, find_human, play_effect, display\n\ndef pick_effect(command):\n    if command == "dragon":\n        return "dragon"\n    elif command == "boss":\n        return "boss"\n    else:\n        return "sakura"\n\ndef pick_depth(power):\n    if power >= 3:\n        return "front"\n    else:\n        return "behind"\n\ndef cast_once(command, power):\n    """Perform once: pick the layer, pick its place, then stack."""\n    effect = pick_effect(command)\n    depth = pick_depth(power)\n    display("CAST: " + effect)\n    if depth == "front":\n        find_human(scene="forest", front=effect)\n    else:\n        play_effect(effect)\n\nspells = ["dragon", "boss", "stop"]\n\n# lượt của bạn — viết ba bước vào thân vòng lặp, đúng thứ tự này:\n#   1. nghe thấy "stop"  -> display("SHOW OVER") rồi break\n#   2. chưa dừng         -> power = watch()   (đếm ngón tay)\n#   3. rồi               -> cast_once(command, power)\nwhile True:\n    command = listen(spells)\n    break        # <- xoá dòng này khi bạn đã viết xong ba bước trên\n',
      label: "du_an_3_san_khau_mo.py",
      note: "ĐỀ BÀI\nINPUT là giọng nói và bàn tay bạn, lặp lại bao nhiêu lần tùy bạn. Các lệnh `pick_effect`, `pick_depth` và `cast_once` đã có sẵn đầy đủ trong ô này. Hãy hoàn thiện vòng `while True`: mỗi lần nghe được một từ, nếu đó là `stop` thì nói `SHOW OVER` bằng cả `say` lẫn `display` rồi `break`; nếu không thì đọc số ngón tay bằng `watch()` và gọi `cast_once(command, power)`. Giơ ít ngón thì lớp hiệu ứng chồng phẳng lên cả khung hình; giơ từ 3 ngón trở lên thì nó được xếp quanh người bạn. Khi bạn RUN, Pip chạy chính đoạn code này: màn hình mở TOÀN MÀN HÌNH, gương nghe bạn ở dải dưới đáy, và mỗi lần bạn niệm một thần chú thì màn diễn chạy ngay trước mắt. Nói `stop` để hạ màn và quay lại bài học.",
      expectOut: { all: [/SHOW OVER/, { kind: 'studio_start', text: /human_layers|effect_play/, minCount: 2 }] },
      solution: 'from old_computer import say\nfrom voice_charm import listen\nfrom camera_charm import watch, find_human, play_effect, display\n\ndef pick_effect(command):\n    if command == "dragon":\n        return "dragon"\n    elif command == "boss":\n        return "boss"\n    else:\n        return "sakura"\n\ndef pick_depth(power):\n    if power >= 3:\n        return "front"\n    else:\n        return "behind"\n\ndef cast_once(command, power):\n    """Perform once: pick the layer, pick its place, then stack."""\n    effect = pick_effect(command)\n    depth = pick_depth(power)\n    display("CAST: " + effect)\n    if depth == "front":\n        find_human(scene="forest", front=effect)\n    else:\n        play_effect(effect)\n\nspells = ["dragon", "boss", "stop"]\n\nwhile True:\n    command = listen(spells)\n    if command == "stop":\n        display("SHOW OVER")\n        break\n    power = watch()\n    cast_once(command, power)\n',
    },
    {
      checkpoint: {
        text: "`while True` lặp mãi vì điều kiện của nó không bao giờ sai, nên vòng lặp kiểu này BẮT BUỘC phải có `break` ở bên trong — nếu không thì chương trình không bao giờ dừng. Ở đây cửa ra là từ `stop`: nghe thấy nó thì thoát, còn mọi từ khác đều đi diễn thêm một lần nữa.",
      },
    },
    {
      quiz: {
        title: "Sân khấu mở mãi",
        questions: [
          {
            q: "Vì sao vòng `while True` trong bài này bắt buộc phải có `break`?",
            a: [
              "Vì điều kiện `True` không bao giờ sai, nên không có `break` thì vòng lặp chạy mãi không dừng",
              "Vì `while` chỉ chạy đúng một lần nếu thiếu `break`",
              "Vì `break` là cách duy nhất để đọc được thần chú tiếp theo",
            ],
            correct: 0,
          },
          {
            q: "Bạn niệm lần lượt `dragon`, rồi `boss`, rồi `stop`. Máy in ra gì?",
            a: [
              "`CAST: dragon`, rồi `CAST: boss`, rồi `SHOW OVER`",
              "Chỉ `SHOW OVER`, vì vòng lặp chỉ xét từ cuối cùng",
              "Chỉ `CAST: dragon`, vì `break` chạy ngay sau lần đầu",
            ],
            correct: 0,
          },
          {
            q: "Nếu bỏ hẳn nhánh `if command == \"stop\"` đi thì chuyện gì xảy ra?",
            a: [
              "Gương nghe và diễn mãi, không có cách nào thoát khỏi vòng lặp",
              "Vòng lặp tự dừng sau khi hết danh sách `spells`",
              "Máy báo lỗi ngay khi chạy dòng `while True`",
            ],
            correct: 0,
          },
        ],
      },
    },
  ],
  ritual: {},
};
