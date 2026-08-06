"""Sinh hai notebook Skin Lab từ nội dung và code nguồn ổn định.

Chỉ sửa file này và hai file skin_filters*.py. Không sửa trực tiếp .ipynb.
"""

import json
import pathlib
import re
import sys


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
COURSE_VERSION = "2026.08.06.5"
PRACTICE_FILE = "Skin_Lab.ipynb"
SOLUTION_FILE = "Skin_Lab_Answers.ipynb"
TASK_ORDER = (
    "shared",
    "convolve_layer",
    "skin_evidence",
    "detect_skin",
    "detect_pimples",
    "remove_pimples",
)


def _source(text):
    lines = text.strip("\n").split("\n")
    return [line + "\n" for line in lines[:-1]] + [lines[-1]]


def markdown_cell(cell_id, text):
    return {
        "id": cell_id,
        "cell_type": "markdown",
        "metadata": {"stable_id": cell_id},
        "source": _source(text),
    }


def code_cell(cell_id, text, tags=()):
    return {
        "id": cell_id,
        "cell_type": "code",
        "execution_count": None,
        "metadata": {"stable_id": cell_id, "tags": list(tags)},
        "outputs": [],
        "source": _source(text),
    }


def read_task_blocks(file_name):
    """Tách module Python theo marker; module vẫn chạy bình thường khi import."""
    text = (HERE / file_name).read_text(encoding="utf-8")
    marker = re.compile(r"^# === TASK: ([a-z_]+) ===\s*$", re.MULTILINE)
    matches = list(marker.finditer(text))
    blocks = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks[match.group(1)] = text[match.end():end].strip()
    missing = set(TASK_ORDER) - set(blocks)
    if missing:
        raise ValueError("Thiếu block code: %s" % ", ".join(sorted(missing)))
    return blocks


TITLE = """# Skin Lab — Máy tính thay đổi một pixel như thế nào?

Ta sẽ bắt đầu bằng một ảnh rất nhỏ: **7 hàng × 7 cột**. Trong ảnh có vùng da, nền xanh và một chấm đỏ ở giữa.
Ở mỗi bước, em chỉ cần theo dõi pixel giữa. Trang sẽ cho em thấy màu của pixel, các số được lấy ra, phép tính
với những số đó và màu xuất hiện sau phép tính.

Sau khi hiểu sáu bước trên ảnh nhỏ, em sẽ dùng **NumPy** và **SciPy** để làm đúng những việc đó trên cả ảnh.
Cuối bài, **MediaPipe Face Mesh** giới hạn vùng được phép xử lý vào bên trong khuôn mặt.

Đây là bài học về thuật toán xử lý ảnh, **không phải công cụ chẩn đoán hay đánh giá làn da**. Luật màu trong bài
có thể nhận sai khi ánh sáng, thiết bị chụp, màu da hoặc màu nền thay đổi.

Trang tự lưu code, lựa chọn trong các bảng và chặng em đã hoàn thành trên máy này. Em có thể đóng trang rồi quay lại.
Ảnh em chụp chỉ được dùng để tạo OUTPUT trên trang, không được đưa vào phần tự lưu. Muốn chuyển bài sang máy khác,
em bấm **Tải notebook**.
"""

SETUP = """## Trước khi bắt đầu

Chạy hai ô dưới. Ô đầu mở các hình minh họa. Ô thứ hai chuẩn bị NumPy, SciPy, Pillow cùng các con số dùng trong bài.
Em chưa cần sửa hai ô này. Đến cuối bài, em mới mở camera để chụp một tấm ảnh.
Ảnh 7×7 và ảnh tổng hợp có khuôn mặt đã cho sẵn, nên em vẫn làm được các bước chính mà không cần ảnh cá nhân.

Mỗi nhiệm vụ sau đó đều ghi rõ: dữ liệu nào đã cho sẵn, INPUT nào đến từ bên ngoài, em cần viết gì và OUTPUT nào
chứng minh hàm đã đúng. Sau khi sửa một hàm, chạy ô xem kết quả ngay dưới hàm đó.
"""

PHENOMENON = """## Ta cần tạo ra những hình nào?

Chạy ô dưới để xem ảnh ban đầu và ba kết quả cần tạo:

1. `skin_mask`: ô trắng là nơi luật màu tạm cho là da; ô đen là nơi không chọn.
2. `pimple_mask`: ô trắng là vùng đỏ nổi bật cần làm mềm; ô đen là nơi giữ nguyên.
3. Ảnh cuối: chỉ những ô trắng trong `pimple_mask` được thay bằng màu đã làm mềm.

Trong hai mask, **255 nghĩa là chọn** và **0 nghĩa là không chọn**. Đây chỉ là hai số giúp chương trình ghi nhớ
vị trí. Chúng không phải màu da và cũng không phải điểm đánh giá da.
"""

RGB_PIXEL = """## Cơ chế 1 — Một pixel là ba số RGB

Chạy bảng dưới rồi bấm vào pixel giữa của ảnh 7×7. Pixel đó có màu `(225, 62, 66)`, nghĩa là `R = 225`,
`G = 62`, `B = 66`. Kéo từng thanh để xem khi chỉ một số đổi thì màu của pixel đổi ra sao.

Khi tách kênh R, máy giữ `225` và đặt hai số còn lại về `0`, nên kết quả là `(225, 0, 0)`. Tách G và B cũng
làm đúng một việc như vậy. Bảng sẽ yêu cầu em dùng cơ chế này với một bộ số chưa xuất hiện trong ví dụ.
"""

NUMPY_INTRO = """## Từ một pixel sang cả ảnh bằng NumPy

Trong bảng vừa rồi, em đã chọn một ô bằng hàng và cột. NumPy dùng đúng cách đánh địa chỉ đó:

- `pixels[3, 3]` lấy ba số RGB của pixel ở hàng 3, cột 3.
- `pixels[:, :, 0]` lấy số R của **mọi pixel**.
- `pixels[:, :, 1]` lấy số G của mọi pixel.
- `pixels[:, :, 2]` lấy số B của mọi pixel.

Pillow đọc ảnh. `np.asarray(image)` biến ảnh thành một bảng số NumPy tên là `pixels`. Nếu ảnh cao 60, rộng 80 và có ba
kênh màu thì `pixels.shape` là `(60, 80, 3)`. Chạy hai ô dưới: OUTPUT sẽ ghi kích thước, ba số của một pixel,
rồi hiện ảnh gốc bên cạnh ba kênh R, G, B.
"""

LIBRARIES = """## Thư viện làm lại cùng phép tính trên mọi pixel

Các bảng tương tác cho em tính một pixel bằng số nhỏ. Trong dự án, ta gọi các hàm dưới đây để làm phép tính đó
ở mọi vị trí của ảnh:

| Việc cần làm | Hàm thực hiện việc đó |
|---|---|
| Nhân và cộng các số trong vùng 3×3 | `scipy.ndimage.convolve` |
| Tính trung bình các số trong vùng 5×5 | `scipy.ndimage.uniform_filter` |
| Biến một ô được chọn thành vùng 3×3 | `scipy.ndimage.maximum_filter` |
| Chọn màu mới hoặc màu ban đầu cho từng pixel | `np.where` |
| Giữ số màu trong khoảng 0 đến 255 | `np.clip` |
| Biến bảng số trở lại thành ảnh | `Image.fromarray` |

Em không cần tự viết hai vòng `for row` và `for column`. Em cần chọn đúng bảng số đưa vào hàm, rồi kiểm tra
OUTPUT bằng số và hình.
"""

CONVOLUTION = """## SciPy đếm hoặc trộn các pixel xung quanh ra sao?

`convolve_layer` nhìn một vùng 3×3 quanh pixel đang tính. Nó nhân từng số trong vùng với số ở cùng vị trí trong
`kernel`, cộng chín kết quả, rồi chia cho `divisor`.

Ví dụ, tám ô xung quanh bằng `10`, ô giữa bằng `90`, còn chín số trong `kernel` đều bằng `1`:

```text
total = 8 × 10 + 90 = 170
new_value = 170 / 9 = 18.89
```

OUTPUT của pixel giữa là `18.89`. Số `90` đã được trộn với tám số `10`, nên pixel giữa bớt sáng.

`ndimage.convolve` làm phép nhân rồi cộng này ở mọi pixel. `mode="nearest"` chỉ nói cách xử lý mép ảnh: nếu vùng 3×3
đi ra ngoài ảnh, SciPy dùng lại giá trị của pixel biên gần nhất.
"""

TASK_CONVOLVE = """### Nhiệm vụ 1 — Hoàn thành `convolve_layer`

- **Dữ liệu đã cho sẵn:** `layer`, `kernel`, `divisor`; NumPy và SciPy đã được mở.
- **INPUT thật:** không có. Bộ tự chấm sẽ đưa một bảng 5×5 vào hàm.
- **Em cần viết:** đưa `values` và `weights` vào `ndimage.convolve`, rồi chia kết quả cho `divisor`.
- **OUTPUT để kiểm tra:** khi chỉ ô giữa của bảng bằng `9`, chín trọng số bằng `1` và `divisor = 9`, số ở giữa
  bảng kết quả phải bằng `1`. Bảng INPUT vẫn phải giữ số `9` ban đầu.
"""

EVIDENCE = """## Từ ba số RGB đến một ô trắng hoặc đen

Ta xét pixel `(183, 127, 103)`. Máy gán `R = 183`, `G = 127`, `B = 103`, rồi thay đúng ba số đó vào:

```text
brightness = (183 + 127 + 103) // 3 = 413 // 3 = 137
warmth = 183 - 103 = 80
red_green_gap = 183 - 127 = 56
```

Ba kết quả đều đạt các điều kiện trong code, nên OUTPUT của pixel này là `255`: ô trắng, được chọn.

Với nền xanh `(35, 80, 185)`, `warmth = 35 - 185 = -150`. Điều kiện cần `warmth >= 8`, nên OUTPUT là `0`:
ô đen, không chọn. Đây là một luật RGB viết tay để học cơ chế; nó không nhận đúng mọi màu da và mọi ánh sáng.
"""

TASK_EVIDENCE = """### Nhiệm vụ 2 — Hoàn thành `skin_evidence`

- **Dữ liệu đã cho sẵn:** `red`, `green`, `blue` là ba số, hoặc ba bảng số có cùng kích thước.
- **INPUT thật:** chưa có ở đây. Sau này `detect_skin` sẽ đưa màu của một ảnh vào hàm.
- **Em cần viết:** tính `warmth = red - blue`, `red_green_gap = red - green`, rồi đưa `looks_like_skin` vào `np.where`.
- **OUTPUT để kiểm tra:** `(183, 127, 103)` trả `255`; `(35, 80, 185)` trả `0`. Nếu INPUT là ba bảng, OUTPUT là
  một bảng `uint8` có cùng số hàng và cột.
"""

VOTES = """## Vì sao phải nhìn thêm tám pixel xung quanh?

Pixel đỏ giữa ảnh không đạt luật RGB, nên `raw_mask` của nó là `0`. Tám pixel xung quanh đạt luật và có giá trị `255`.
Trước khi đếm, chương trình đổi `255` thành `1`; số `0` vẫn là `0`:

```text
count = 1 + 1 + 1 + 1 + 0 + 1 + 1 + 1 + 1 = 8
8 >= 5  →  skin_mask của pixel giữa = 255
```

Như vậy, pixel giữa vẫn nằm trong vùng được chọn vì có 8 trong 9 pixel đạt luật, nhiều hơn mức cần là 5.
Ta đếm `0/1` vì kết quả dễ đọc hơn việc tính trung bình của `0/255`.
"""

TASK_SKIN = """### Nhiệm vụ 3 — Hoàn thành `detect_skin`

- **Dữ liệu đã cho sẵn:** ảnh PIL `img`, bảng 3×3 toàn số `1` và mức tối thiểu `5`.
- **INPUT thật:** một ảnh; ở cuối bài, đó là tấm ảnh em vừa chụp hoặc chọn từ máy.
- **Em cần viết:** đổi `raw_mask` từ `0/255` thành `binary` chỉ có `0/1`; dùng `convolve_layer` để đếm; so
  `neighbour_count` với `SKIN_NEIGHBOURS_NEEDED`.
- **OUTPUT để kiểm tra:** một bảng `uint8` chỉ có `0/255`. Pixel đỏ giữa vùng da phải là `255`; pixel giữa ảnh nền
  xanh phải là `0`.
"""

RED_GAP = """## Tìm một pixel đỏ hơn vùng ngay quanh nó

Màu đỏ mạnh chưa đủ để kết luận, vì cả vùng có thể đang ở dưới ánh sáng đỏ. Ta so pixel giữa với vùng 5×5 quanh nó.
Đầu tiên, chương trình tính một số tên là `redness`.

Với pixel đỏ `(225, 62, 66)`:

```text
redness_spot = 225 - (62 + 66) / 2 = 225 - 64 = 161
```

Với pixel da `(183, 127, 103)`:

```text
redness_skin = 183 - (127 + 103) / 2 = 183 - 115 = 68
```

Trong vùng 5×5 có pixel đỏ ở giữa và 24 pixel da. Trung bình của 25 số `redness` là:

```text
local_redness = (161 + 24 × 68) / 25 = 1793 / 25 = 71.72
red_gap = 161 - 71.72 = 89.28
89.28 >= 24  →  chọn pixel giữa
```

Sau đó, `maximum_filter` mở một ô được chọn thành vùng 3×3. Nhờ vậy, bước làm mềm không chỉ đổi đúng một chấm nhỏ.
"""

TASK_PIMPLE = """### Nhiệm vụ 4 — Hoàn thành `detect_pimples`

- **Dữ liệu đã cho sẵn:** ảnh `img`, `skin_mask`, vùng 5×5 và mốc so sánh `24`.
- **INPUT thật:** ảnh RGB cùng `skin_mask` của ảnh đó.
- **Em cần viết:** đưa `redness` vào `uniform_filter`; đưa `candidate` vào `maximum_filter`.
- **OUTPUT để kiểm tra:** `pimple_mask` là bảng `uint8`; pixel giữa vùng đỏ bằng `255`, còn góc ảnh bằng `0`.
"""

SOFTEN = """## Tính màu mới, rồi quyết định có dùng màu đó không

Đầu tiên, chương trình tính một màu mềm hơn cho pixel giữa. Bảng 3×3 cho pixel giữa trọng số `4`, bốn pixel
sát cạnh trọng số `2`, bốn pixel ở góc trọng số `1`. Tổng chín trọng số là `16`:

```text
1  2  1
2  4  2      tổng trọng số = 16
1  2  1
```

Pixel giữa là `(225, 62, 66)`. Tám pixel xung quanh đều là `(183, 127, 103)`. Tính riêng từng kênh:

```text
new_red   = (4 × 225 + 12 × 183) / 16 = 3096 / 16 = 193.5 → 194
new_green = (4 ×  62 + 12 × 127) / 16 = 1772 / 16 = 110.75 → 111
new_blue  = (4 ×  66 + 12 × 103) / 16 = 1500 / 16 = 93.75 → 94
```

Màu mềm là `(194, 111, 94)`. Sau đó `np.where` nhìn `pimple_mask` tại đúng vị trí này:

- mask bằng `255` → dùng màu mềm `(194, 111, 94)`;
- mask bằng `0` → giữ màu ban đầu `(225, 62, 66)`.

Vì vậy chương trình có thể tính màu mềm cho cả ảnh, nhưng chỉ thay các pixel đã được chọn.
"""

TASK_REMOVE = """### Nhiệm vụ 5 — Hoàn thành `remove_pimples`

- **Dữ liệu đã cho sẵn:** ảnh `img`, bảng trọng số và bốn hàm em vừa hoàn thành.
- **INPUT thật:** một ảnh PIL; cuối bài, đây là tấm ảnh em vừa chụp hoặc chọn từ máy.
- **Em cần viết:** đưa `pixels` vào `ndimage.convolve`; đưa `pimple_mask` vào điều kiện của `np.where`.
  `pimple_mask[:, :, None]` dùng cùng một lựa chọn cho cả ba số R, G, B của mỗi pixel.
- **OUTPUT để kiểm tra:** một ảnh PIL cùng kích thước. Pixel đỏ giữa ảnh bớt nổi bật, pixel ở góc giữ nguyên và ảnh INPUT
  không bị sửa trực tiếp.
"""

CHECK = """## Kiểm tra năm hàm

Chạy ô dưới. Mỗi dòng sẽ ghi tên hàm, hàm đã đúng hay chưa và lý do nếu chưa đúng. OUTPUT cuối cùng cần là
`Kết quả: 5/5 phần đã đúng.` Trang tự lưu code, kết quả này và sáu bảng cơ chế để em có thể làm tiếp vào lần sau.
"""

DEMO = """## Nối năm hàm thành một chương trình

Chạy ô dưới. OUTPUT có sáu hình theo đúng thứ tự dữ liệu đi qua chương trình: ảnh RGB → `skin_mask` → vị trí
`skin_mask` phủ lên ảnh → `pimple_mask` → vị trí `pimple_mask` phủ lên ảnh → ảnh cuối.

Lớp màu phủ cho biết **đúng vị trí pixel** mà mask đã chọn. Nếu vị trí chọn sai, kiểm tra ba phép tính RGB, số đếm 3×3
hoặc độ chênh màu đỏ. Nếu vị trí đúng nhưng màu cuối sai, kiểm tra bảng trọng số và `np.where`.
"""

NUMPY_MASK = """### Cùng một luật RGB, nhưng áp dụng cho cả ảnh

`pixels[:, :, 0]` lấy toàn bộ kênh đỏ; hai chỉ số còn lại là hàng và cột. Phép so sánh tạo
một lưới `True/False`. `np.where` đổi lưới đó thành mask `255/0`.
"""

NUMPY_FILTERS = """## Thử thêm vài cách đổi ảnh quen thuộc

Chạy hai ô dưới để xem sáu phép đổi ảnh. Dưới mỗi hình đều có tên phép đổi. Khi so với ảnh gốc, em hãy trả lời:

1. Phép nào chỉ đổi các số của chính pixel đang xét?
2. Phép nào phải lấy thêm số từ các pixel xung quanh?
3. Với bảng làm nét, pixel giữa được nhân với số nào?
"""

NUMPY_CREATE = """### Tự sửa một phép đổi màu bằng NumPy

Đoạn code mẫu tăng kênh xanh dương thêm `40` và dùng `np.clip` để giữ số trong khoảng `0..255`.
Giá trị cho sẵn là ảnh mẫu. Dữ liệu bên ngoài (INPUT): không có. Việc cần làm (PROCESS): sao chép bảng số,
đổi đúng một kênh, giới hạn kết quả trong `0..255` rồi trả về. Kết quả đúng (OUTPUT) phải có ảnh trước, ảnh sau,
kích thước và kiểu số của bảng kết quả; ảnh đầu vào không bị sửa. Hãy thử đổi kênh hoặc đổi số cộng thêm.
"""

PUBLIC_IMAGES = """## Kiểm chứng bằng ảnh công khai

Ba ảnh CC0 bên dưới đã được lưu sẵn trong bài, nên trang không cần tải ảnh từ nơi khác: hai chân dung có màu da và ánh sáng
khác nhau, cùng một ảnh cận cảnh bề mặt da. Nguồn: [William Stitt](https://commons.wikimedia.org/wiki/File:Face_portrait_(Unsplash).jpg),
[Eddie Kopp](https://commons.wikimedia.org/wiki/File:Young_woman%27s_face_(Unsplash).jpg) và
[Montavius Howard](https://commons.wikimedia.org/wiki/File:Human_skin_close-up.jpg).

Chạy `try_public_photo(0)`, rồi đổi số cuối thành `1` hoặc `2`. Mỗi lần chạy, OUTPUT cho thấy bốn hình có nhãn:
ảnh INPUT, `skin_mask`, `pimple_mask` và ảnh cuối. Hãy nhìn vị trí ô trắng trong hai mask để tìm chỗ luật màu nhận sai.
Mục tiêu là kiểm tra giới hạn của code, không phải nhận xét về người trong ảnh.
"""

FACE_GATE = """## Cơ chế 6 — Chỉ đổi pixel khi hai điều kiện cùng đúng

Luật RGB có thể chọn nhầm một vật có màu gần giống da. Face Mesh bổ sung một câu hỏi: pixel này có nằm trong khuôn mặt không?

- `face_mask = 1`: pixel nằm trong đường bao khuôn mặt.
- `skin_mask = 1`: pixel đạt luật màu và đủ số pixel lân cận.

Chương trình tính `allowed = face_mask & skin_mask`. Chỉ trường hợp `1 & 1` cho kết quả `1`. Ba trường hợp còn lại
đều giữ màu ban đầu. Chạy bảng dưới và thử đủ bốn cặp số.
"""

FACE_MESH = """## MediaPipe tạo `face_mask` như thế nào?

Face Mesh nhận ảnh và trả về tối đa 478 điểm trên khuôn mặt. Mỗi điểm có vị trí ngang và dọc. Ta chọn các điểm chạy
quanh viền mặt, trong đó có điểm `10` gần trán, `454` bên phải, `152` gần cằm và `234` bên trái. Nối các điểm này
thành một đường khép kín rồi tô phần bên trong bằng `1`; phần bên ngoài là `0`. Đó là `face_mask`.

```text
face_mask = pixel nằm trong đường bao khuôn mặt
skin_mask = pixel đạt điều kiện RGB và đủ số pixel lân cận
allowed   = face_mask & skin_mask
output    = np.where(allowed[..., None], cleaned, original)
```

`allowed[..., None]` dùng cùng giá trị `allowed` cho cả ba số R, G, B của pixel. Face Mesh chỉ cho biết vùng khuôn mặt;
nó không chẩn đoán da và không tự tìm vùng đỏ.
"""

PHOTO = """## Chụp một tấm ảnh rồi chạy chương trình

- **Dữ liệu đã cho sẵn:** năm hàm xử lý ảnh em đã viết và các điểm viền mặt của MediaPipe Face Mesh.
- **INPUT thật:** đúng một tấm ảnh em vừa chụp. Nếu không mở được camera, em bấm **Chọn ảnh từ máy**.
- **Em cần làm:** chạy ô dưới, căn khuôn mặt vào khung rồi bấm **Chụp một tấm**. Camera dừng ngay sau khi chụp.
  Face Mesh tìm đường bao khuôn mặt một lần; NumPy và SciPy cũng chỉ chạy một lần trên tấm ảnh đó.
- **OUTPUT để kiểm tra:** hình bên trái là ảnh INPUT có đường bao Face Mesh. Hình bên phải là ảnh sau khi chạy năm hàm.
  Dòng chữ dưới các nút cho biết chương trình đã tìm thấy khuôn mặt hay đã phải xử lý toàn bộ ảnh.

Ảnh được giữ trong OUTPUT của ô này để em quan sát, nhưng không được đưa vào `localStorage`. Khi em tải lại trang,
ảnh sẽ biến mất; code và tiến độ vẫn còn. Bài dùng kích thước xử lý 320×240 và hiển thị ở 480×360 để hình đủ rõ.
"""

REFLECT = """## Ghi lại điều em quan sát được

Sau khi thử ảnh mẫu hoặc ảnh em vừa chụp, hãy thêm một ô code hoặc ô chữ và ghi ba ý:

1. Một trường hợp luật nhận đúng vùng cần xử lý.
2. Một vật hoặc ánh sáng làm luật nhận nhầm.
3. Một thay đổi ở bảng trọng số hoặc mốc so sánh và kết quả em nhìn thấy.
"""


PREDICT_Q = """neighbourhood = [
    [10, 10, 10],
    [10, 90, 10],
    [10, 10, 10],
]

my_guess = ___
actual = sum(sum(row) for row in neighbourhood) / 9
print("Em tính:", my_guess, "| Máy tính:", actual)
"""

PREDICT_A = PREDICT_Q.replace("___", "170 / 9")

NUMPY_ARRAY_CODE = """import numpy as np

sample = magic_mirror.skin_sample_image()
pixels = np.asarray(sample, dtype=np.int16)
print("Kích thước bảng pixels:", pixels.shape, "= chiều cao, chiều rộng, ba kênh RGB")
print("Ba số của pixel da mẫu:", pixels[20, 40])
print("Kích thước bảng kênh đỏ:", pixels[:, :, 0].shape)
"""

NUMPY_MASK_CODE = """red = pixels[:, :, 0]
green = pixels[:, :, 1]
blue = pixels[:, :, 2]

brightness = (red + green + blue) // 3
warmth = red - blue
red_green_gap = red - green
looks_like_skin = (
    (brightness >= 35) & (brightness <= 240)
    & (warmth >= 8)
    & (red_green_gap >= -10) & (red_green_gap <= 90)
)
numpy_mask = np.where(looks_like_skin, 255, 0).astype(np.uint8)
magic_mirror.show_numpy_mask(numpy_mask)
"""

NUMPY_CREATE_CODE = """def my_numpy_filter(pixels):
    result = pixels.copy().astype(np.int16)
    result[:, :, 2] = np.clip(result[:, :, 2] + 40, 0, 255)
    return result.astype(np.uint8)

magic_mirror.preview_numpy_filter(my_numpy_filter)
"""


def build_skin_cells(solution):
    blocks = read_task_blocks("skin_filters_solution.py" if solution else "skin_filters.py")
    title = TITLE.replace("# Skin Lab —", "# Skin Lab (BÀI GIẢI) —") if solution else TITLE
    return [
        markdown_cell("skin-title", title),
        markdown_cell("skin-setup-note", SETUP),
        code_cell("skin-setup", "import magic_mirror\nmagic_mirror.skin_intro()", ("autoload",)),
        code_cell("skin-library-setup", blocks["shared"], ("autoload",)),
        markdown_cell("skin-phenomenon", PHENOMENON),
        code_cell("skin-overview", "magic_mirror.show_skin_pipeline_overview()"),
        markdown_cell("skin-rgb-pixel-note", RGB_PIXEL),
        code_cell("skin-mechanism-rgb", 'magic_mirror.show_mechanism("rgb_pixel")',
                  ("concept:rgb_pixel",)),
        code_cell("skin-pixel-channels", "magic_mirror.show_skin_pixel_channels()"),
        markdown_cell("numpy-intro", NUMPY_INTRO),
        code_cell("numpy-array", NUMPY_ARRAY_CODE),
        code_cell("numpy-channels", "magic_mirror.show_numpy_channels()"),
        markdown_cell("skin-library-map", LIBRARIES),
        markdown_cell("skin-evidence", EVIDENCE),
        code_cell("skin-mechanism-rule", 'magic_mirror.show_mechanism("rgb_rule")',
                  ("concept:rgb_rule",)),
        markdown_cell("skin-task-evidence-note", TASK_EVIDENCE),
        code_cell("task-skin-evidence", blocks["skin_evidence"],
                  ("autoload", "task:skin_evidence")),
        code_cell("skin-preview-evidence", "magic_mirror.preview_skin_evidence()"),
        markdown_cell("skin-votes", VOTES),
        code_cell("skin-mechanism-neighbours", 'magic_mirror.show_mechanism("neighbours")',
                  ("concept:neighbours",)),
        markdown_cell("skin-convolution", CONVOLUTION),
        code_cell("skin-convolution-math", "magic_mirror.show_convolution_math()"),
        markdown_cell("skin-task-convolve-note", TASK_CONVOLVE),
        code_cell("task-convolve-layer", blocks["convolve_layer"],
                  ("autoload", "task:convolve_layer")),
        code_cell("skin-preview-convolution", "magic_mirror.preview_library_convolution()"),
        markdown_cell("skin-task-detect-note", TASK_SKIN),
        code_cell("task-detect-skin", blocks["detect_skin"],
                  ("autoload", "task:detect_skin")),
        code_cell("skin-preview-mask", "magic_mirror.preview_skin_mask()"),
        markdown_cell("skin-red-gap", RED_GAP),
        code_cell("skin-mechanism-red-spot", 'magic_mirror.show_mechanism("red_spot")',
                  ("concept:red_spot",)),
        markdown_cell("skin-task-pimple-note", TASK_PIMPLE),
        code_cell("task-detect-pimples", blocks["detect_pimples"],
                  ("autoload", "task:detect_pimples")),
        code_cell("skin-preview-pimples", "magic_mirror.preview_pimple_mask()"),
        markdown_cell("skin-soften", SOFTEN),
        code_cell("skin-mechanism-soften", 'magic_mirror.show_mechanism("soften")',
                  ("concept:soften",)),
        markdown_cell("skin-task-remove-note", TASK_REMOVE),
        code_cell("task-remove-pimples", blocks["remove_pimples"],
                  ("autoload", "task:remove_pimples")),
        code_cell("skin-preview-cleanup", "magic_mirror.preview_cleanup()"),
        markdown_cell("skin-check-note", CHECK),
        code_cell("skin-check", "magic_mirror.check_skin_code()"),
        markdown_cell("skin-demo-note", DEMO),
        code_cell("skin-demo", "magic_mirror.skin_demo()"),
        markdown_cell("numpy-filters-note", NUMPY_FILTERS),
        code_cell("numpy-filter-gallery", "magic_mirror.numpy_filter_gallery()"),
        code_cell("numpy-kernel-gallery", "magic_mirror.numpy_kernel_gallery()"),
        markdown_cell("numpy-create-note", NUMPY_CREATE),
        code_cell("numpy-create", NUMPY_CREATE_CODE),
        markdown_cell("skin-public-images-note", PUBLIC_IMAGES),
        code_cell("skin-public-gallery", "magic_mirror.show_public_photo_gallery()"),
        code_cell("skin-public-test", "magic_mirror.try_public_photo(0)"),
        markdown_cell("skin-face-gate-note", FACE_GATE),
        code_cell("skin-mechanism-face", 'magic_mirror.show_mechanism("face_gate")',
                  ("concept:face_gate",)),
        markdown_cell("skin-face-mesh-note", FACE_MESH),
        code_cell("skin-face-mesh-map", "magic_mirror.show_face_mesh_map()"),
        code_cell("skin-face-mask-pipeline", "magic_mirror.show_face_mask_pipeline()"),
        markdown_cell("skin-photo-note", PHOTO),
        code_cell("skin-photo", "magic_mirror.capture_skin_photo()"),
        markdown_cell("skin-reflect", REFLECT),
    ]


def write(file_name, solution):
    notebook = {
        "cells": build_skin_cells(solution),
        "metadata": {
            "course": {"id": "skin-lab", "version": COURSE_VERSION},
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.11"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    path = HERE / file_name
    path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("Đã ghi %s (%d ô)" % (file_name, len(notebook["cells"])))


if __name__ == "__main__":
    write(PRACTICE_FILE, solution=False)
    write(SOLUTION_FILE, solution=True)
