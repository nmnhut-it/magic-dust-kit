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
COURSE_VERSION = "2026.08.06.2"
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


TITLE = """# Skin Lab — NumPy, bộ lọc ảnh và MediaPipe Face Mesh

Em sẽ xây một pipeline xử lý ảnh thật bằng **NumPy + SciPy + Pillow**. Ta vẫn tính bằng số nhỏ để hiểu
cơ chế, nhưng code của dự án sẽ gọi thư viện trên cả lưới pixel, không viết vòng lặp Python cho từng pixel.

Đường đi của dữ liệu là: `camera RGB → ba kênh màu → skin mask → red-spot mask → làm mềm có chọn lọc`.
Ở phần cuối, MediaPipe Face Mesh tạo thêm `face_mask`; chương trình chỉ cho phép đổi màu ở nơi
`face_mask` và `skin_mask` cùng bật.

Mỗi ô quan sát phải có đủ **con số cụ thể + hình màu/overlay + câu giải thích**. Con số cho biết phép tính;
hình chỉ đúng vị trí pixel; câu giải thích nối hai phần đó thành một kết luận mà em có thể kiểm tra.

Đây là bài học về thuật toán xử lý ảnh, **không phải công cụ chẩn đoán hay đánh giá làn da**. Ánh sáng,
camera và màu da khác nhau đều có thể làm luật RGB viết tay đoán sai.

Trang tự lưu code và chặng đang học trong `localStorage`, nên em có thể dừng rồi quay lại làm tiếp.
Ảnh camera không được lưu. Muốn mang bài sang máy khác, hãy bấm **Tải notebook**.
"""

SETUP = """## Chặng 0 — Khởi động ba thư viện

Chạy ô dưới để nạp NumPy, SciPy, Pillow, hình minh họa, bộ tự chấm và camera. Mỗi nhiệm vụ có bốn phần rõ ràng:
giá trị cho sẵn, INPUT, PROCESS và OUTPUT. Sau khi sửa một hàm, chạy ô **Xem kết quả của hàm vừa viết** ngay bên dưới.
"""

PHENOMENON = """## Bắt đầu từ màu mà mắt nhìn thấy

Ảnh tổng hợp có nền xanh, một khuôn mặt và ba nốt đỏ cố ý đặt trên má. Hình đầu tiên cho thấy
đúng bốn kết quả mà chương trình cần tạo: ảnh ban đầu, vùng da, vùng nốt đỏ và ảnh chỉ được
làm mềm ở nơi mask bật.

Tiếp theo, ta lấy riêng một pixel da `(183, 127, 103)` và một pixel nốt đỏ `(225, 62, 66)`.
Mỗi pixel được tách thành ba đèn R, G, B rồi ghép lại. Nhờ vậy, OUTPUT không còn là một dãy số khó hiểu:
em nhìn thấy con số nào làm kênh đỏ mạnh lên và nhìn thấy màu sau khi ba kênh được ghép lại.
"""

NUMPY_INTRO = """## NumPy là cách ảnh được đặt trong bộ nhớ

Pillow đọc file ảnh hoặc khung hình camera. `np.asarray(image)` đổi ảnh thành một array có shape
`(height, width, 3)`. Số `3` cuối cùng là ba kênh R, G, B. Ví dụ ảnh 80×60 có shape `(60, 80, 3)`.

- `pixels[:, :, 0]` lấy cả kênh đỏ.
- `pixels[:, :, 1]` lấy cả kênh xanh lá.
- `pixels[:, :, 2]` lấy cả kênh xanh dương.
- `np.stack((red, green, blue), axis=2)` ghép ba kênh thành ảnh RGB.

Chạy hai ô dưới. OUTPUT phải có ảnh màu ban đầu, ba ảnh từng kênh, ảnh ghép lại và ảnh sai khác bằng 0.
"""

LIBRARIES = """## Cơ chế và thư viện chia nhau công việc

Ta học kỹ **cơ chế** để biết mỗi số có ý nghĩa gì, rồi dùng API thư viện để chạy nhanh trên cả ảnh:

| Cơ chế cần hiểu | Lệnh dùng trong dự án |
|---|---|
| Nhân kernel với vùng lân cận rồi cộng | `scipy.ndimage.convolve` |
| Tính trung bình độ đỏ trong cửa sổ 5×5 | `scipy.ndimage.uniform_filter` |
| Mở rộng vùng được chọn thêm một pixel | `scipy.ndimage.maximum_filter` |
| Chọn màu mới hoặc giữ màu cũ theo mask | `np.where` |
| Giữ giá trị màu trong 0..255 | `np.clip` |
| Đổi NumPy array thành ảnh | `Image.fromarray` |

Em không cần tự viết hai vòng `for row` và `for column`. Nhiệm vụ là nối đúng dữ liệu vào đúng API và giải thích
được array nào đi vào, phép tính nào xảy ra, array nào đi ra.
"""

CONVOLUTION = """## Chặng 1 — SciPy chạy phép tích chập trên cả kênh màu

Kernel là một bảng trọng số nhỏ. Với mỗi pixel, chương trình đặt kernel lên vùng lân cận,
nhân từng giá trị với trọng số nằm cùng vị trí, cộng các tích, rồi chia cho `divisor`.

Ví dụ có tám ô bằng `10`, ô giữa bằng `90`, và chín trọng số đều bằng `1`:

```text
total = 8 × 10 + 90 = 170
new_value = 170 / 9 = 18.89
```

Giá trị `90` tiến gần các hàng xóm `10`, nên điểm sáng bớt nổi bật. Đó là blur.

Trong dự án, `ndimage.convolve(values, weights, mode="nearest")` thực hiện phép nhân-cộng này ở mọi vị trí.
`mode="nearest"` nghĩa là pixel ngoài mép ảnh lấy giá trị của pixel biên gần nhất. Sau đó ta chia cả array cho
`divisor`. Cơ chế vẫn là phép tính trên; SciPy chỉ thực hiện nó nhanh hơn vòng lặp Python.
"""

PREDICT = """### Em tính trước, máy kiểm tra sau

Giá trị cho sẵn là cửa sổ 3×3 bên dưới. Hãy thay `___` bằng phép tính cho kết quả `170 / 9`.
OUTPUT đúng phải in hai số giống nhau.
"""

TASK_CONVOLVE = """### Nhiệm vụ 1 — Nối dữ liệu vào `ndimage.convolve`

- Giá trị cho sẵn: `layer`, `kernel`, `divisor` là ba tham số của hàm; NumPy, SciPy đã được import.
- INPUT từ bên ngoài: không có; bộ tự chấm đưa một ma trận số vào hàm.
- PROCESS: đổi `layer` và `kernel` thành array `float32`; gọi `ndimage.convolve(values, weights, mode="nearest")`;
  chia toàn bộ kết quả cho `divisor`.
- OUTPUT chứng minh: trả một NumPy array mới shape `(5, 5)`; với tâm input bằng `9`, kernel toàn số `1`
  và `divisor=9`, tâm output bằng `1`; input vẫn giữ tâm bằng `9`.
"""

EVIDENCE = """## Chặng 2 — Thay số RGB để tạo một phiếu

Một pixel được đo bằng ba phép tính. Với pixel da mẫu `(183, 127, 103)`:

```text
brightness = (183 + 127 + 103) // 3 = 413 // 3 = 137
warmth = 183 - 103 = 80
red_green_gap = 183 - 127 = 56
```

Ba kết quả đều nằm trong giới hạn của bài, nên pixel này cho phiếu `255`.
Pixel nền xanh `(35, 80, 185)` có `warmth = 35 - 185 = -150`, không đạt `warmth >= 8`,
nên cho phiếu `0`.
"""

TASK_EVIDENCE = """### Nhiệm vụ 2 — Viết luật RGB chạy trên scalar hoặc cả array

- Giá trị cho sẵn: `red`, `green`, `blue` có thể là ba số hoặc ba NumPy array cùng shape.
- INPUT từ bên ngoài: chưa có ở bước này; màu camera sẽ đi vào sau qua `detect_skin`.
- PROCESS: tính `brightness`, `warmth`, `red_green_gap`; nối từng điều kiện bằng `&`; dùng
  `np.where(looks_like_skin, 255, 0).astype(np.uint8)`.
- OUTPUT chứng minh: pixel da mẫu trả `255`, nền xanh trả `0`; khi nhận cả lưới, hàm trả array `uint8`
  cùng chiều cao và chiều rộng với ba kênh đầu vào.
"""

VOTES = """## Chặng 3 — Tám pixel xung quanh giữ vùng da liền nhau

Pixel nốt đỏ `(225, 62, 66)` có `red_green_gap = 163`, vượt giới hạn `90`, nên phiếu riêng
của nó là `0`. Nhưng tám pixel da xung quanh đều cho `255`:

```text
votes = (8 × 255 + 0) / 9 = 2040 / 9 = 226.67
needed = 5 × 255 / 9 = 141.67
226.67 >= 141.67  →  skin_mask = 255
```

Như vậy chương trình không tin một pixel đứng riêng. Nó dùng thông tin của cả vùng 3×3.
"""

TASK_SKIN = """### Nhiệm vụ 3 — Tạo skin mask cho cả ảnh

- Giá trị cho sẵn: `img` là ảnh PIL; `SKIN_VOTE_KERNEL` và số phiếu cần thiết đã có sẵn.
- INPUT từ bên ngoài: khi chạy camera, mỗi khung hình RGB là INPUT thật; bộ tự chấm dùng ảnh tổng hợp cố định.
- PROCESS: `np.asarray` đổi ảnh thành array; lấy ba kênh; gọi `skin_evidence`; gọi `convolve_layer` để lấy
  mức phiếu 3×3; dùng `np.where` tạo mask chỉ có `0` và `255`.
- OUTPUT chứng minh: NumPy array shape `(height, width)`, dtype `uint8`; tâm ảnh da có một nốt đỏ vẫn bằng
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
89.28 >= PIMPLE_RED_GAP (24)  →  candidate = 255
```
"""

TASK_PIMPLE = """### Nhiệm vụ 4 — Dùng hai filter SciPy để tìm vùng đỏ nổi bật

- Giá trị cho sẵn: `img`, `skin_mask`, kernel trung bình 5×5 và ngưỡng `24`.
- INPUT từ bên ngoài: ảnh RGB và skin mask của bước trước; camera cung cấp ảnh khi chạy dự án cuối.
- PROCESS: tính array `redness`; `uniform_filter(..., size=5)` lấy trung bình vùng 5×5;
  so độ chênh với ngưỡng; `maximum_filter(..., size=3)` mở rộng candidate thêm một pixel.
- OUTPUT chứng minh: pimple mask array `uint8`; tâm nốt đỏ bằng `255`, góc ảnh không có nốt đỏ bằng `0`.
"""

SOFTEN = """## Chặng 5 — Chỉ thay pixel nằm trong mask

Kernel làm mềm dùng trọng số lớn hơn ở giữa:

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
`194 - (111 + 94) / 2 = 91.5`. Pixel ở xa mask phải giữ nguyên.
"""

TASK_REMOVE = """### Nhiệm vụ 5 — Ghép ảnh bằng `np.where`

- Giá trị cho sẵn: `img` là ảnh cần xử lý; ba kernel và bốn hàm trước đã có.
- INPUT từ bên ngoài: một ảnh PIL; ở phần camera, đây là khung hình thật vừa chụp trong trình duyệt.
- PROCESS: tạo `skin_mask` và `pimple_mask`; đổi kernel thành shape `(3, 3, 1)` để SciPy không trộn R/G/B;
  làm mềm ba kênh trong một lần gọi; `np.where(pimple_mask[:, :, None] == 255, softened, pixels)`
  chọn màu mềm trong mask và giữ màu gốc ở ngoài mask.
- OUTPUT chứng minh: trả ảnh PIL cùng kích thước; độ đỏ ở tâm giảm, pixel xa giữ nguyên, input không bị sửa.
"""

CHECK = """## Tự chấm phần chính

Bấm chạy để kiểm tra từng hàm. Khi đạt `5/5`, tiến độ được tự lưu. Nếu em quay lại vào hôm
sau, trang vẫn nhớ code và các chặng đã vượt qua.
"""

DEMO = """## Ghép lại toàn bộ pipeline

OUTPUT gồm sáu hình: ảnh RGB, skin mask, skin overlay, red-spot mask, red-spot overlay và kết quả cuối.
Overlay giữ màu gốc rồi phủ màu trong suốt lên vùng mask, vì vậy em nhìn được cả **quyết định của máy** lẫn
**pixel thật bên dưới**. Nếu mask sai, sửa phần phát hiện; nếu mask đúng nhưng kết quả chưa hợp lý, kiểm tra
kernel làm mềm và điều kiện của `np.where`.
"""

NUMPY_MASK = """### Cùng một luật RGB, nhưng áp dụng cho cả ảnh

`pixels[:, :, 0]` lấy toàn bộ kênh đỏ; hai chỉ số còn lại là hàng và cột. Phép so sánh tạo
một lưới `True/False`. `np.where` đổi lưới đó thành mask `255/0`.
"""

NUMPY_FILTERS = """## Thử thêm vài filter quen thuộc

Chạy hai ô dưới để xem đảo màu, tăng sáng, giữ một kênh màu, blur, sharpen và dò cạnh.
NumPy làm phép toán theo từng phần tử; SciPy chạy kernel blur, sharpen và edge. Hãy so các hình rồi chỉ ra:
filter nào đổi mọi pixel, filter nào dùng hàng xóm, và kernel nào có trọng số âm.
"""

NUMPY_CREATE = """### Tự sửa một filter NumPy nhỏ

Đoạn code mẫu tăng kênh xanh dương thêm `40` và dùng `np.clip` để giữ số trong khoảng `0..255`.
Giá trị cho sẵn là ảnh mẫu. INPUT từ bên ngoài: không có. PROCESS: copy array, đổi đúng một kênh, clip rồi return.
OUTPUT phải có ảnh trước/sau và dòng giải thích shape, dtype; ảnh đầu vào không bị sửa. Hãy đổi kênh hoặc đổi số.
"""

PUBLIC_IMAGES = """## Kiểm chứng bằng ảnh công khai

Ba ảnh CC0 bên dưới đã được lưu trong project, không tải nóng từ trang khác: hai chân dung có màu da và ánh sáng
khác nhau, cùng một ảnh cận cảnh bề mặt da. Nguồn: [William Stitt](https://commons.wikimedia.org/wiki/File:Face_portrait_(Unsplash).jpg),
[Eddie Kopp](https://commons.wikimedia.org/wiki/File:Young_woman%27s_face_(Unsplash).jpg) và
[Montavius Howard](https://commons.wikimedia.org/wiki/File:Human_skin_close-up.jpg).

Chạy `try_public_photo(0)`, rồi đổi thành `1` hoặc `2`. OUTPUT cho thấy ảnh thật, vùng luật nhận là da,
vùng luật nhận là nốt đỏ và kết quả. Mục tiêu là tìm giới hạn của thuật toán, không phải nhận xét về người trong ảnh.
"""

FACE_MESH = """## Bài tập lớn — MediaPipe Face Mesh tạo face mask

Luật RGB chỉ nhìn màu, nên có thể nhận nhầm tường, tóc hoặc áo. MediaPipe Face Mesh giải quyết một câu hỏi khác:
**khuôn mặt đang nằm ở đâu?** Trình duyệt chạy model Face Mesh trên khung camera và nhận tối đa 478 landmark khi
bật `refineLandmarks`. Ta lấy các điểm quanh viền mặt, chẳng hạn `10` ở trán, `454` bên phải, `152` ở cằm và
`234` bên trái, rồi nối chúng thành một đa giác trắng trên nền đen.

```text
face_mask = pixel nằm trong đa giác Face Mesh
skin_mask = pixel đạt luật RGB và đủ phiếu lân cận
allowed   = face_mask & skin_mask
output    = np.where(allowed[..., None], cleaned, original)
```

`[..., None]` thêm một chiều để cùng mask 2D điều khiển cả ba kênh R/G/B. Face Mesh chỉ giới hạn vùng được phép
xử lý; nó không chẩn đoán da và không tự quyết định pixel nào là nốt đỏ.
"""

CAMERA = """## Chạy dự án với INPUT thật từ camera

Camera là INPUT thật của bài. Mỗi khung 480×360 được xử lý ngay trong trình duyệt; chế độ mặc định tính ở
240×180 rồi phóng lại bằng nội suy mượt, không dùng kiểu phóng pixel vuông. Nếu máy khỏe, chọn **Nét (320×240)**;
nếu máy chậm, chọn **Tiết kiệm (160×120)**.

MediaPipe vẽ đường viền Face Mesh và tạo face mask ở hậu trường. NumPy/SciPy chỉ đổi pixel nằm trong face mask.
Trang không tự lưu ảnh camera. Nếu camera bị chặn, em vẫn hoàn thành bài bằng ảnh tổng hợp và ba ảnh công khai.
"""

REFLECT = """## Ghi lại điều em quan sát được

Sau khi thử ảnh mẫu hoặc camera, hãy thêm một ô code hoặc ô chữ và ghi ba ý:

1. Một trường hợp luật nhận đúng vùng cần xử lý.
2. Một vật hoặc ánh sáng làm luật nhận nhầm.
3. Một thay đổi kernel hoặc threshold và kết quả em nhìn thấy.
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
print("shape:", pixels.shape, "= height, width, RGB")
print("pixel da mẫu:", pixels[20, 40])
print("kênh đỏ có shape:", pixels[:, :, 0].shape)
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
