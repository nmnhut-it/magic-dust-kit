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
COURSE_VERSION = "2026.08.06.3"
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


TITLE = """# Skin Lab — Xử lý ảnh với NumPy, SciPy, Pillow và MediaPipe

Trong bài này, em sẽ viết chương trình nhận một ảnh màu, tìm vùng da và vùng đỏ nổi bật, rồi chỉ làm mềm
những pixel đã được chọn. **Pillow** đọc và hiển thị ảnh, **NumPy** giữ các con số của ảnh, còn **SciPy**
thực hiện cùng một phép tính trên nhiều pixel.

Chương trình xử lý ảnh theo từng bước: lấy ảnh RGB từ camera, tách ba kênh màu, đánh dấu vùng da, đánh dấu
vùng đỏ rồi làm mềm vùng đó. Hai ảnh đen trắng dùng để đánh dấu được gọi là `skin_mask` và `pimple_mask`:
pixel màu trắng có giá trị `255` là vùng được chọn; pixel màu đen có giá trị `0` là vùng được giữ nguyên.

Ở phần cuối, MediaPipe Face Mesh tìm các điểm mốc quanh khuôn mặt và tạo `face_mask`. Chương trình chỉ
đổi một pixel khi pixel đó vừa nằm trong khuôn mặt, vừa được `skin_mask` đánh dấu là vùng da.

Mỗi bước đều có phép tính bằng số, hình minh họa và một câu kết luận. Em có thể dùng phép tính để kiểm tra
kết quả, rồi nhìn hình để biết chương trình đã chọn đúng vị trí hay chưa.

Đây là bài học về cách chương trình xử lý ảnh, **không phải công cụ chẩn đoán hay đánh giá làn da**. Ánh sáng,
camera và màu da khác nhau có thể làm các điều kiện RGB trong bài nhận sai.

Trang sẽ tự lưu code và phần em đang làm trên máy này. Em có thể đóng trang rồi quay lại học tiếp.
Ảnh camera không được lưu. Nếu muốn làm tiếp trên máy khác, hãy bấm **Tải notebook** để lưu bài thành một tệp.
"""

SETUP = """## Chặng 0 — Chuẩn bị thư viện

Chạy ô dưới để mở NumPy, SciPy, Pillow, hình minh họa, phần tự chấm và camera. Mỗi nhiệm vụ sẽ nói rõ dữ liệu
đã cho, dữ liệu bên ngoài (INPUT), việc cần làm (PROCESS) và kết quả đúng (OUTPUT). Sau khi sửa một hàm,
hãy chạy ô **Xem kết quả của hàm vừa viết** ngay bên dưới để kiểm tra.
"""

PHENOMENON = """## Bắt đầu từ màu trong ảnh

Ảnh mẫu có nền xanh, một khuôn mặt và ba vùng đỏ được đặt trên má. Hình đầu tiên cho thấy bốn kết quả
chương trình cần tạo: ảnh ban đầu, vùng da được đánh dấu, vùng đỏ được đánh dấu và ảnh sau khi làm mềm.

Tiếp theo, ta xem một pixel da `(183, 127, 103)` và một pixel đỏ `(225, 62, 66)`. Mỗi bộ ba số lần lượt
là lượng đỏ (R), xanh lá (G) và xanh dương (B) của pixel. Để xem riêng kênh R, chương trình giữ số R và
đặt G, B về `0`. Hai kênh còn lại cũng được tách theo cách đó. Sau cùng, ba kênh được ghép lại để kiểm tra
màu có giống ảnh ban đầu hay không.
"""

NUMPY_INTRO = """## NumPy lưu ảnh thành một bảng số

Pillow đọc tệp ảnh hoặc khung hình camera. `np.asarray(image)` đổi ảnh thành một bảng số NumPy.
`pixels.shape` cho biết kích thước của bảng theo thứ tự `(chiều cao, chiều rộng, số kênh màu)`.
Ví dụ, ảnh rộng 80 pixel và cao 60 pixel có `pixels.shape == (60, 80, 3)`. Số `3` là ba kênh R, G, B.

- `pixels[:, :, 0]` lấy cả kênh đỏ.
- `pixels[:, :, 1]` lấy cả kênh xanh lá.
- `pixels[:, :, 2]` lấy cả kênh xanh dương.
- `np.stack((red, green, blue), axis=2)` ghép ba kênh thành ảnh RGB.

Chạy hai ô dưới. OUTPUT phải có ảnh màu ban đầu, ba ảnh từng kênh, ảnh ghép lại và ảnh sai khác bằng 0.
"""

LIBRARIES = """## Các hàm có sẵn giúp xử lý cả ảnh

Ta tính một ví dụ nhỏ trước để hiểu mỗi số đến từ đâu. Sau đó, chương trình gọi các hàm có sẵn để thực hiện
cùng phép tính trên toàn bộ ảnh:

| Cơ chế cần hiểu | Lệnh dùng trong dự án |
|---|---|
| Nhân bảng trọng số với vùng lân cận rồi cộng | `scipy.ndimage.convolve` |
| Tính trung bình độ đỏ trong cửa sổ 5×5 | `scipy.ndimage.uniform_filter` |
| Mở rộng vùng được chọn thêm một pixel | `scipy.ndimage.maximum_filter` |
| Chọn màu mới hoặc giữ màu cũ theo ảnh đánh dấu | `np.where` |
| Giữ giá trị màu trong 0..255 | `np.clip` |
| Đổi bảng số NumPy thành ảnh | `Image.fromarray` |

Em không cần tự viết hai vòng `for row` và `for column`. Nhiệm vụ của em là đưa đúng dữ liệu vào từng hàm,
nói được phép tính đang làm gì và kiểm tra bảng số nhận được sau phép tính.
"""

CONVOLUTION = """## Chặng 1 — Tính màu mới từ các pixel xung quanh

Ta dùng một bảng trọng số nhỏ, trong thư viện gọi là `kernel`. Với mỗi pixel, chương trình đặt bảng này lên vùng lân cận,
nhân từng giá trị với trọng số nằm cùng vị trí, cộng các tích, rồi chia cho `divisor`.

Ví dụ có tám ô bằng `10`, ô giữa bằng `90`, và chín trọng số đều bằng `1`:

```text
total = 8 × 10 + 90 = 170
new_value = 170 / 9 = 18.89
```

Giá trị `90` giảm xuống gần các pixel xung quanh có giá trị `10`, nên điểm sáng bớt nổi bật. Đây là cách làm mờ ảnh.

Trong dự án, `ndimage.convolve(values, weights, mode="nearest")` thực hiện phép nhân-cộng này ở mọi vị trí.
`mode="nearest"` nghĩa là vị trí ngoài mép ảnh dùng giá trị của pixel biên gần nhất. Sau đó ta chia cả bảng kết quả cho
`divisor`. Cơ chế vẫn là phép tính trên; SciPy chỉ thực hiện nó nhanh hơn vòng lặp Python.
"""

PREDICT = """### Em tính trước, máy kiểm tra sau

Giá trị cho sẵn là cửa sổ 3×3 bên dưới. Hãy thay `___` bằng phép tính cho kết quả `170 / 9`.
OUTPUT đúng phải in hai số giống nhau.
"""

TASK_CONVOLVE = """### Nhiệm vụ 1 — Nối dữ liệu vào `ndimage.convolve`

- Giá trị cho sẵn: `layer`, `kernel`, `divisor` là ba tham số của hàm; NumPy, SciPy đã được import.
- INPUT từ bên ngoài: không có; bộ tự chấm gọi hàm với một bảng số cố định.
- Việc cần làm (PROCESS): đổi `layer` và `kernel` thành bảng số `float32`; gọi `ndimage.convolve(values, weights, mode="nearest")`;
  chia toàn bộ kết quả cho `divisor`.
- Kết quả đúng (OUTPUT): trả một bảng số NumPy mới có kích thước `(5, 5)`; khi tâm của `layer` bằng `9`,
  `kernel` gồm toàn số `1` và `divisor=9`, tâm của kết quả bằng `1`; `layer` ban đầu vẫn giữ tâm bằng `9`.
"""

EVIDENCE = """## Chặng 2 — Dùng ba số RGB để đánh dấu một pixel

Một pixel được đo bằng ba phép tính. Với pixel da mẫu `(183, 127, 103)`:

```text
brightness = (183 + 127 + 103) // 3 = 413 // 3 = 137
warmth = 183 - 103 = 80
red_green_gap = 183 - 127 = 56
```

Ba kết quả đều nằm trong giới hạn của bài, nên chương trình đánh dấu pixel này bằng `255`.
Pixel nền xanh `(35, 80, 185)` có `warmth = 35 - 185 = -150`, không đạt `warmth >= 8`,
nên pixel đó nhận giá trị `0`.
"""

TASK_EVIDENCE = """### Nhiệm vụ 2 — Áp dụng điều kiện RGB cho một pixel hoặc cả ảnh

- Giá trị cho sẵn: `red`, `green`, `blue` có thể là ba số hoặc ba bảng NumPy có cùng kích thước.
- INPUT từ bên ngoài: chưa có ở bước này; màu camera sẽ đi vào sau qua `detect_skin`.
- Việc cần làm (PROCESS): tính `brightness`, `warmth`, `red_green_gap`; nối từng điều kiện bằng `&`; dùng
  `np.where(looks_like_skin, 255, 0).astype(np.uint8)`.
- Kết quả đúng (OUTPUT): pixel da mẫu trả `255`, nền xanh trả `0`; khi nhận cả ảnh, hàm trả một bảng số `uint8`
  cùng chiều cao và chiều rộng với ba kênh đầu vào.
"""

VOTES = """## Chặng 3 — Xét thêm tám pixel xung quanh

Pixel đỏ `(225, 62, 66)` có `red_green_gap = 163`, vượt giới hạn `90`, nên khi xét riêng nó nhận giá trị `0`.
Tám pixel da xung quanh đều nhận giá trị `255`:

```text
average = (8 × 255 + 0) / 9 = 2040 / 9 = 226.67
needed  = 5 × 255 / 9 = 141.67
226.67 >= 141.67  →  skin_mask = 255
```

Vì `226.67` lớn hơn `141.67`, pixel giữa vẫn được đánh dấu là vùng da. Kết quả của pixel giữa phụ thuộc
vào cả chín pixel trong vùng 3×3, không chỉ phụ thuộc vào màu của riêng nó.
"""

TASK_SKIN = """### Nhiệm vụ 3 — Đánh dấu vùng da trên cả ảnh

- Giá trị cho sẵn: `img` là ảnh PIL; `SKIN_VOTE_KERNEL` và số pixel tối thiểu đã có sẵn.
- INPUT từ bên ngoài: khi chạy camera, mỗi khung hình RGB là INPUT thật; bộ tự chấm dùng ảnh tổng hợp cố định.
- Việc cần làm (PROCESS): `np.asarray` đổi ảnh thành bảng số; lấy ba kênh; gọi `skin_evidence`; gọi
  `convolve_layer` để tính trung bình vùng 3×3; dùng `np.where` tạo `skin_mask` chỉ có `0` và `255`.
- Kết quả đúng (OUTPUT): bảng số NumPy có kích thước `(height, width)` và kiểu số `uint8`; tâm ảnh da có một vùng đỏ vẫn bằng
  `255`, còn tâm ảnh nền xanh bằng `0`.
"""

RED_GAP = """## Chặng 4 — So độ đỏ của pixel với vùng 5×5

Độ đỏ nổi trội của nốt đỏ là:

```text
redness_spot = 225 - (62 + 66) / 2 = 225 - 64 = 161
```

Độ đỏ của một pixel da xung quanh là:

```text
redness_skin = 183 - (127 + 103) / 2 = 183 - 115 = 68
```

Giả sử cửa sổ 5×5 có một nốt đỏ và 24 pixel da:

```text
local_redness = (161 + 24 × 68) / 25 = 1793 / 25 = 71.72
red_gap = 161 - 71.72 = 89.28
89.28 >= PIMPLE_RED_GAP (24)  →  pixel được chọn tạm thời
```
"""

TASK_PIMPLE = """### Nhiệm vụ 4 — Dùng hai hàm SciPy để tìm vùng đỏ nổi bật

- Giá trị cho sẵn: `img`, `skin_mask`, vùng tính trung bình 5×5 và mốc so sánh `24`.
- INPUT từ bên ngoài: ảnh RGB và skin mask của bước trước; camera cung cấp ảnh khi chạy dự án cuối.
- Việc cần làm (PROCESS): tính bảng `redness`; `uniform_filter(..., size=5)` lấy trung bình vùng 5×5;
  so độ chênh với mốc `24`; `maximum_filter(..., size=3)` mở rộng vùng tạm được chọn thêm một pixel.
- Kết quả đúng (OUTPUT): `pimple_mask` là bảng số `uint8`; tâm vùng đỏ bằng `255`, góc ảnh không có vùng đỏ bằng `0`.
"""

SOFTEN = """## Chặng 5 — Chỉ thay pixel nằm trong mask

Bảng trọng số làm mềm có số lớn hơn ở giữa:

```text
1  2  1
2  4  2      tổng trọng số = 16
1  2  1
```

Nếu tâm là `(225, 62, 66)` và tám pixel xung quanh đều là `(183, 127, 103)`:

```text
new_red   = (4 × 225 + 12 × 183) / 16 = 3096 / 16 = 193.5 → 194
new_green = (4 ×  62 + 12 × 127) / 16 = 1772 / 16 = 110.75 → 111
new_blue  = (4 ×  66 + 12 × 103) / 16 = 1500 / 16 = 93.75 → 94
```

Pixel mới là `(194, 111, 94)`. Độ đỏ nổi trội giảm từ `161` xuống
`194 - (111 + 94) / 2 = 91.5`. Pixel ở xa vùng được đánh dấu phải giữ nguyên.
"""

TASK_REMOVE = """### Nhiệm vụ 5 — Ghép ảnh bằng `np.where`

- Giá trị cho sẵn: `img` là ảnh cần xử lý; các bảng trọng số và bốn hàm trước đã có.
- INPUT từ bên ngoài: một ảnh PIL; ở phần camera, đây là khung hình thật vừa được trình duyệt nhận.
- Việc cần làm (PROCESS): tạo `skin_mask` và `pimple_mask`; thêm một chiều vào bảng trọng số để bảng có kích thước
  `(3, 3, 1)`, nhờ đó SciPy không trộn R/G/B;
  làm mềm ba kênh trong một lần gọi; `np.where(pimple_mask[:, :, None] == 255, softened, pixels)`
  chọn màu mềm trong mask và giữ màu gốc ở ngoài mask.
- Kết quả đúng (OUTPUT): trả ảnh PIL cùng kích thước; độ đỏ ở tâm giảm, pixel xa giữ nguyên, ảnh đầu vào không bị sửa.
"""

CHECK = """## Tự chấm phần chính

Bấm chạy để kiểm tra từng hàm. Khi đạt `5/5`, tiến độ được tự lưu. Nếu em quay lại vào hôm
sau, trang vẫn nhớ code và các chặng đã vượt qua.
"""

DEMO = """## Xem toàn bộ các bước xử lý

Kết quả (OUTPUT) gồm sáu hình: ảnh RGB, vùng da đen trắng, ảnh gốc có vùng da phủ màu vàng, vùng đỏ đen trắng,
ảnh gốc có vùng đỏ phủ màu đỏ và ảnh cuối. Ảnh phủ màu vẫn giữ màu gốc bên dưới, nên em biết chính xác
chương trình đã chọn pixel nào. Nếu vùng được chọn sai, hãy kiểm tra các điều kiện phát hiện. Nếu vùng được
chọn đúng nhưng ảnh cuối chưa đúng, hãy kiểm tra bảng trọng số làm mềm và điều kiện của `np.where`.
"""

NUMPY_MASK = """### Cùng một luật RGB, nhưng áp dụng cho cả ảnh

`pixels[:, :, 0]` lấy toàn bộ kênh đỏ; hai chỉ số còn lại là hàng và cột. Phép so sánh tạo
một lưới `True/False`. `np.where` đổi lưới đó thành mask `255/0`.
"""

NUMPY_FILTERS = """## Thử thêm vài cách đổi ảnh quen thuộc

Chạy hai ô dưới để xem cách đảo màu, tăng sáng, giữ một kênh màu, làm mờ, làm nét và tìm đường biên.
NumPy tính trực tiếp trên từng số trong bảng; SciPy dùng bảng trọng số để làm mờ, làm nét và tìm đường biên.
Hãy so các hình rồi chỉ ra: cách nào đổi mọi pixel, cách nào dùng các pixel xung quanh, và bảng nào có trọng số âm.
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

Chạy `try_public_photo(0)`, rồi đổi thành `1` hoặc `2`. Kết quả (OUTPUT) cho thấy ảnh thật, vùng được đánh dấu
là da, vùng đỏ được chọn và ảnh sau khi xử lý. Mục tiêu là tìm giới hạn của thuật toán, không phải nhận xét về người trong ảnh.
"""

FACE_MESH = """## Bài tập lớn — Giới hạn vùng xử lý bằng MediaPipe Face Mesh

Luật RGB chỉ nhìn màu, nên có thể nhận nhầm tường, tóc hoặc áo. MediaPipe Face Mesh giải quyết một câu hỏi khác:
**khuôn mặt đang nằm ở đâu?** Face Mesh tìm tối đa 478 điểm mốc trên khung hình khi bật `refineLandmarks`.
Ta lấy các điểm quanh viền mặt, chẳng hạn `10` ở trán, `454` bên phải, `152` ở cằm và
`234` bên trái, rồi nối chúng thành một đa giác trắng trên nền đen.

```text
face_mask = pixel nằm trong đường bao khuôn mặt
skin_mask = pixel đạt điều kiện RGB và đủ số pixel lân cận
allowed   = face_mask & skin_mask
output    = np.where(allowed[..., None], cleaned, original)
```

`[..., None]` thêm một chiều vào bảng đánh dấu hai chiều để cùng một lựa chọn được áp dụng cho cả R, G và B.
Face Mesh chỉ giới hạn vùng được phép xử lý; nó không chẩn đoán da và không tự quyết định pixel nào là vùng đỏ.
"""

CAMERA = """## Chạy dự án với INPUT thật từ camera

Camera là dữ liệu bên ngoài (INPUT) của bài. Mỗi khung 480×360 được xử lý ngay trong trình duyệt. Chế độ mặc định
tính trên ảnh 240×180 rồi phóng lên và làm mượt phần nằm giữa các pixel. Nếu máy khỏe, chọn **Nét (320×240)**;
nếu máy chậm, chọn **Tiết kiệm (160×120)**.

MediaPipe vẽ đường bao khuôn mặt và tạo `face_mask`. NumPy và SciPy chỉ đổi pixel nằm trong vùng đó.
Trang không tự lưu ảnh camera. Nếu camera bị chặn, em vẫn hoàn thành bài bằng ảnh tổng hợp và ba ảnh công khai.
"""

REFLECT = """## Ghi lại điều em quan sát được

Sau khi thử ảnh mẫu hoặc camera, hãy thêm một ô code hoặc ô chữ và ghi ba ý:

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
        code_cell("skin-setup", "import magic_mirror\nmagic_mirror.skin_intro()"),
        markdown_cell("skin-phenomenon", PHENOMENON),
        code_cell("skin-overview", "magic_mirror.show_skin_pipeline_overview()"),
        code_cell("skin-pixel-channels", "magic_mirror.show_skin_pixel_channels()"),
        markdown_cell("numpy-intro", NUMPY_INTRO),
        code_cell("numpy-array", NUMPY_ARRAY_CODE),
        code_cell("numpy-channels", "magic_mirror.show_numpy_channels()"),
        markdown_cell("skin-library-map", LIBRARIES),
        markdown_cell("skin-convolution", CONVOLUTION),
        code_cell("skin-convolution-math", "magic_mirror.show_convolution_math()"),
        markdown_cell("skin-predict-note", PREDICT),
        code_cell("skin-predict", PREDICT_A if solution else PREDICT_Q),
        markdown_cell("skin-task-convolve-note", TASK_CONVOLVE),
        code_cell("task-convolve-layer", blocks["shared"] + "\n\n" + blocks["convolve_layer"],
                  ("autoload", "task:convolve_layer")),
        code_cell("skin-preview-convolution", "magic_mirror.preview_library_convolution()"),
        markdown_cell("skin-evidence", EVIDENCE),
        code_cell("skin-evidence-math", "magic_mirror.show_skin_evidence_math()"),
        markdown_cell("skin-task-evidence-note", TASK_EVIDENCE),
        code_cell("task-skin-evidence", blocks["skin_evidence"],
                  ("autoload", "task:skin_evidence")),
        code_cell("skin-preview-evidence", "magic_mirror.preview_skin_evidence()"),
        markdown_cell("skin-votes", VOTES),
        code_cell("skin-vote-math", "magic_mirror.show_skin_vote_math()"),
        markdown_cell("skin-task-detect-note", TASK_SKIN),
        code_cell("task-detect-skin", blocks["detect_skin"],
                  ("autoload", "task:detect_skin")),
        code_cell("skin-preview-mask", "magic_mirror.preview_skin_mask()"),
        markdown_cell("skin-red-gap", RED_GAP),
        code_cell("skin-red-gap-math", "magic_mirror.show_red_gap_math()"),
        markdown_cell("skin-task-pimple-note", TASK_PIMPLE),
        code_cell("task-detect-pimples", blocks["detect_pimples"],
                  ("autoload", "task:detect_pimples")),
        code_cell("skin-preview-pimples", "magic_mirror.preview_pimple_mask()"),
        markdown_cell("skin-soften", SOFTEN),
        code_cell("skin-soften-math", "magic_mirror.show_soften_math()"),
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
        markdown_cell("skin-face-mesh-note", FACE_MESH),
        code_cell("skin-face-mesh-map", "magic_mirror.show_face_mesh_map()"),
        code_cell("skin-face-mask-pipeline", "magic_mirror.show_face_mask_pipeline()"),
        markdown_cell("skin-camera-note", CAMERA),
        code_cell("skin-camera", "magic_mirror.run()"),
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
