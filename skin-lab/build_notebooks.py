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
COURSE_VERSION = "2026.08.06.1"
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


TITLE = """# Skin Lab — đọc từng con số trước khi dùng bộ lọc

Em sẽ tự viết một pipeline gồm năm hàm. Cùng một pixel đỏ sẽ được theo dõi từ ảnh ban đầu,
qua các phép tính RGB, hai mask, rồi tới màu mới sau khi làm mềm.

Không có model và không có dữ liệu huấn luyện. Đây là bài minh họa cách máy xử lý pixel,
**không phải công cụ chẩn đoán hay đánh giá làn da**. Ánh sáng, camera, màu nền và màu da
đều có thể làm luật viết tay đoán sai.

Trang tự lưu code và chặng đang học trong trình duyệt. Em có thể dừng lại rồi quay lại làm tiếp.
Ảnh camera không được lưu. Muốn có bản sao mang sang máy khác, hãy bấm **Tải notebook**.
"""

SETUP = """## Chặng 0 — Khởi động

Chạy ô dưới để nạp công cụ vẽ hình, bộ tự chấm và camera. Sau đó em đi lần lượt từ Chặng 1
đến Chặng 5. Mỗi chặng đều có hình, phép tính thay số và một hàm cần hoàn thành.
"""

PHENOMENON = """## Nhìn cả đường đi của dữ liệu

Ảnh tổng hợp có nền xanh, một khuôn mặt và ba chấm đỏ cố ý đặt trên má. Hình tiếp theo cho
thấy đúng bốn kết quả mà chương trình phải tạo: ảnh ban đầu, vùng da, vùng chấm đỏ và ảnh
chỉ được làm mềm ở nơi mask bật.

Hãy chỉ vào một chấm đỏ và dự đoán: pixel đó sẽ bị luật RGB loại ở bước đầu hay vẫn được
tám pixel da xung quanh giữ lại?
"""

CONVOLUTION = """## Chặng 1 — Một kernel tính giá trị mới cho pixel giữa

Kernel là một bảng trọng số nhỏ. Với mỗi pixel, chương trình đặt kernel lên vùng lân cận,
nhân từng giá trị với trọng số nằm cùng vị trí, cộng các tích, rồi chia cho `divisor`.

Ví dụ có tám ô bằng `10`, ô giữa bằng `90`, và chín trọng số đều bằng `1`:

```text
total = 8 × 10 + 90 = 170
new_value = 170 / 9 = 18.89
```

Giá trị `90` tiến gần các hàng xóm `10`, nên điểm sáng bớt nổi bật. Đó là blur.
"""

PREDICT = """### Em tính trước, máy kiểm tra sau

Giá trị cho sẵn là cửa sổ 3×3 bên dưới. Hãy thay `___` bằng phép tính cho kết quả `170 / 9`.
OUTPUT đúng phải in hai số giống nhau.
"""

TASK_CONVOLVE = """### Nhiệm vụ 1 — Viết `convolve_layer`

- Giá trị cho sẵn: `layer`, `kernel`, `divisor` là các tham số được truyền vào hàm.
- INPUT từ bên ngoài: không có; bộ tự chấm gọi hàm bằng các giá trị cho sẵn.
- PROCESS: trượt kernel qua các ô có đủ hàng xóm, đọc từ `layer`, ghi sang `result` mới.
- OUTPUT chứng minh: với ma trận 5×5 có tâm bằng `9`, kernel toàn số `1` và `divisor=9`,
  tâm của kết quả bằng `1`; ô ở viền và ma trận ban đầu không đổi.
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

TASK_EVIDENCE = """### Nhiệm vụ 2 — Viết `skin_evidence`

- Giá trị cho sẵn: `red`, `green`, `blue` của một pixel.
- INPUT từ bên ngoài: không có; bộ tự chấm gọi hàm bằng các bộ ba RGB cho sẵn.
- PROCESS: tính `brightness`, `warmth`, `red_green_gap`, rồi kiểm tra đủ ba điều kiện.
- OUTPUT chứng minh: `(183, 127, 103)` trả `255`, còn `(35, 80, 185)` trả `0`.
"""

VOTES = """## Chặng 3 — Tám pixel xung quanh giữ vùng da liền nhau

Pixel chấm đỏ `(225, 62, 66)` có `red_green_gap = 163`, vượt giới hạn `90`, nên phiếu riêng
của nó là `0`. Nhưng tám pixel da xung quanh đều cho `255`:

```text
votes = (8 × 255 + 0) / 9 = 2040 / 9 = 226.67
needed = 5 × 255 / 9 = 141.67
226.67 >= 141.67  →  skin_mask = 255
```

Như vậy chương trình không tin một pixel đứng riêng. Nó dùng thông tin của cả vùng 3×3.
"""

TASK_SKIN = """### Nhiệm vụ 3 — Viết `detect_skin`

- Giá trị cho sẵn: `img` là một ảnh PIL; `SKIN_VOTE_KERNEL` và số phiếu cần thiết đã có sẵn.
- INPUT từ bên ngoài: không có trong bộ tự chấm; camera chỉ được dùng ở phần thử cuối bài.
- PROCESS: tạo `raw_mask`, gọi `convolve_layer`, rồi đổi mỗi mức phiếu thành `0` hoặc `255`.
- OUTPUT chứng minh: tâm của ảnh da có một chấm đỏ vẫn bằng `255`; tâm ảnh xanh bằng `0`.
"""

RED_GAP = """## Chặng 4 — So độ đỏ của pixel với vùng 5×5

Độ đỏ nổi trội của chấm đỏ là:

```text
redness_spot = 225 - (62 + 66) / 2 = 225 - 64 = 161
```

Độ đỏ của một pixel da xung quanh là:

```text
redness_skin = 183 - (127 + 103) / 2 = 183 - 115 = 68
```

Giả sử cửa sổ 5×5 có một chấm đỏ và 24 pixel da:

```text
local_redness = (161 + 24 × 68) / 25 = 1793 / 25 = 71.72
red_gap = 161 - 71.72 = 89.28
89.28 >= PIMPLE_RED_GAP (24)  →  candidate = 255
```
"""

TASK_PIMPLE = """### Nhiệm vụ 4 — Viết `detect_pimples`

- Giá trị cho sẵn: `img`, `skin_mask`, kernel trung bình 5×5 và ngưỡng `24`.
- INPUT từ bên ngoài: không có trong bộ tự chấm; hàm nhận ảnh tổng hợp và mask cho sẵn.
- PROCESS: tính ma trận `redness`, mức đỏ trung bình cục bộ, candidate, rồi mở rộng vùng
  candidate thêm một ô bằng kernel 3×3.
- OUTPUT chứng minh: tâm chấm đỏ bằng `255`, còn góc ảnh không có chấm đỏ bằng `0`.
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

TASK_REMOVE = """### Nhiệm vụ 5 — Viết `remove_pimples`

- Giá trị cho sẵn: `img` là ảnh cần xử lý; ba kernel và bốn hàm trước đã có.
- INPUT từ bên ngoài: không có trong bộ tự chấm; hàm nhận ảnh tổng hợp cho sẵn.
- PROCESS: tạo ba ma trận màu, làm mềm từng ma trận, rồi chỉ ghi màu mới nơi mask bằng `255`.
- OUTPUT chứng minh: độ đỏ ở tâm giảm, pixel ở xa giữ nguyên và ảnh ban đầu không bị sửa.
"""

CHECK = """## Tự chấm phần chính

Bấm chạy để kiểm tra từng hàm. Khi đạt `5/5`, tiến độ được tự lưu. Nếu em quay lại vào hôm
sau, trang vẫn nhớ code và các chặng đã vượt qua.
"""

DEMO = """## Xem dữ liệu trung gian

Bốn hình giúp xác định lỗi nằm ở đâu: nếu mask sai, hãy sửa phần phát hiện; nếu mask đúng
nhưng ảnh kết quả chưa hợp lý, hãy kiểm tra kernel làm mềm và điều kiện ghi pixel.
"""

NUMPY_INTRO = """## Phần mở rộng — NumPy vừa đủ để xử lý cả lưới

Phần này không thuộc 5 phần bắt buộc và không tính vào `5/5`. Vòng lặp giúp em hiểu từng pixel;
NumPy cho phép viết cùng phép tính trên cả lưới. Ta chỉ dùng bốn ý: `np.asarray`, `.shape`, lấy
một kênh màu và boolean mask.
"""

NUMPY_MASK = """### Cùng một luật RGB, nhưng áp dụng cho cả ảnh

`pixels[:, :, 0]` lấy toàn bộ kênh đỏ; hai chỉ số còn lại là hàng và cột. Phép so sánh tạo
một lưới `True/False`. `np.where` đổi lưới đó thành mask `255/0`.
"""

NUMPY_FILTERS = """### Xưởng filter NumPy

Chạy hai ô dưới để xem đảo màu, tăng sáng, giữ một kênh màu, blur, sharpen và dò cạnh.
Hàm tích chập NumPy đã được cung cấp sẵn; em chỉ cần đọc và thay các số trong kernel.
"""

NUMPY_CREATE = """### Tự sửa một filter nhỏ

Đoạn code mẫu tăng kênh xanh dương thêm `40` và dùng `np.clip` để giữ số trong khoảng
`0..255`. Hãy đổi kênh hoặc đổi số, rồi chạy lại. OUTPUT đúng là một bảng trước/sau;
ảnh đầu vào không bị sửa.
"""

CAMERA = """## Thử INPUT thật từ camera

Camera là INPUT thật của bài. Trang xử lý khung hình ngay trong trình duyệt và không lưu ảnh.
Nếu máy chậm, chọn **Nhanh (60×45)**. Nếu camera bị chặn, em vẫn hoàn thành được bài bằng
ảnh tổng hợp ở trên.
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
        markdown_cell("skin-convolution", CONVOLUTION),
        code_cell("skin-convolution-math", "magic_mirror.show_convolution_math()"),
        markdown_cell("skin-predict-note", PREDICT),
        code_cell("skin-predict", PREDICT_A if solution else PREDICT_Q),
        markdown_cell("skin-task-convolve-note", TASK_CONVOLVE),
        code_cell("task-convolve-layer", blocks["shared"] + "\n\n" + blocks["convolve_layer"],
                  ("autoload", "task:convolve_layer")),
        markdown_cell("skin-evidence", EVIDENCE),
        code_cell("skin-evidence-math", "magic_mirror.show_skin_evidence_math()"),
        markdown_cell("skin-task-evidence-note", TASK_EVIDENCE),
        code_cell("task-skin-evidence", blocks["skin_evidence"],
                  ("autoload", "task:skin_evidence")),
        markdown_cell("skin-votes", VOTES),
        code_cell("skin-vote-math", "magic_mirror.show_skin_vote_math()"),
        markdown_cell("skin-task-detect-note", TASK_SKIN),
        code_cell("task-detect-skin", blocks["detect_skin"],
                  ("autoload", "task:detect_skin")),
        markdown_cell("skin-red-gap", RED_GAP),
        code_cell("skin-red-gap-math", "magic_mirror.show_red_gap_math()"),
        markdown_cell("skin-task-pimple-note", TASK_PIMPLE),
        code_cell("task-detect-pimples", blocks["detect_pimples"],
                  ("autoload", "task:detect_pimples")),
        markdown_cell("skin-soften", SOFTEN),
        code_cell("skin-soften-math", "magic_mirror.show_soften_math()"),
        markdown_cell("skin-task-remove-note", TASK_REMOVE),
        code_cell("task-remove-pimples", blocks["remove_pimples"],
                  ("autoload", "task:remove_pimples")),
        markdown_cell("skin-check-note", CHECK),
        code_cell("skin-check", "magic_mirror.check_skin_code()"),
        markdown_cell("skin-demo-note", DEMO),
        code_cell("skin-demo", "magic_mirror.skin_demo()"),
        markdown_cell("numpy-intro", NUMPY_INTRO),
        code_cell("numpy-array", NUMPY_ARRAY_CODE),
        markdown_cell("numpy-mask-note", NUMPY_MASK),
        code_cell("numpy-mask", NUMPY_MASK_CODE),
        markdown_cell("numpy-filters-note", NUMPY_FILTERS),
        code_cell("numpy-filter-gallery", "magic_mirror.numpy_filter_gallery()"),
        code_cell("numpy-kernel-gallery", "magic_mirror.numpy_kernel_gallery()"),
        markdown_cell("numpy-create-note", NUMPY_CREATE),
        code_cell("numpy-create", NUMPY_CREATE_CODE),
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
