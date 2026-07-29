# Ghi chú cho giáo viên

Học sinh không cần đọc file này. Ở đây có đáp án và mấy chỗ dễ vấp.

## Bộ này gồm gì

Cắt từ `D:/magic-dust`: đồ chơi VFX (`index.html` + `src/`) và **một** đảo
GƯƠNG VÔ CỰC (`lessons/islandFXFORGE.html` + `lessons/engine/` + `py/`). Không
có bản đồ saga, không có node nào khác — mở đảo là vào thẳng.

**Bài tập của học sinh là Python thật, chạy thật.** Trang đồ chơi nạp Pyodide
ngay trong trình duyệt (`src/py-runtime.js`), đọc hai file trong `student/`, rồi
gọi hàm của các em: đổi số ngón tay thì gọi `on_fingers`, micro nghe được từ thì
gọi `on_voice`, và mỗi khung hình khi bật F/B/N thì gọi `flip`/`blur`/`blend`.
Sửa file rồi bấm `R` là nạp lại — không phải tải lại trang, không phải chờ
Pyodide khởi động lần nữa.

Phần mã máy chỉ sửa bốn chỗ so với bản gốc: `spells.js` và `studio-effects.js`
(trộn bảng hiệu ứng của học sinh), `main.js` (ba dòng: gọi `mountPython`, đẩy số
ngón tay và từ nghe được sang Python).

## Vì sao 96×72 chứ không phải cả khung hình

Đo bằng chính Pyodide trong trình duyệt (Python thuần, không numpy):

| cỡ | flip | blur |
|---|---|---|
| 64×48 | 250 hình/giây | 47 |
| **96×72** | **159** | **22** |
| 128×96 | 92 | 13 |
| 320×240 | 11 | 2 |

96×72 là chỗ `blur` — hàm nặng nhất — vẫn còn mượt. Muốn nét hơn thì đổi `W`,`H`
trong `src/py-runtime.js`, nhưng nhớ rằng Python chạy ở luồng chính nên hình 3D
sẽ khựng theo. Vì vậy phần ảnh chạy cách khung (`FRAME_EVERY = 2`).

## Thứ tự dạy đề nghị

1. Chơi trước, chưa động vào code: xoè tay, giơ 1–2 ngón, bấm `3`–`0`.
2. `student/spells.py` → `on_fingers`. Đây là bài `if/elif/else` đầu tiên mà
   **điều kiện là bàn tay thật của các em**. Sai thì thấy ngay, không cần chấm.
3. `on_voice` — cũng `if/elif/else`, nhưng so sánh chuỗi. Chỗ này lộ ra chuyện
   micro nghe "rồng" có khi ra "Rồng" hay "trồng"; đó là bài học về dữ liệu bẩn.
4. Đảo gương: viết `flip`/`blend` bằng Python trên lưới 8×8 rồi 256×256.
5. `student/image_spells.py`: đúng ba phép đó, giờ chạy trên camera. Điểm rơi
   của cả buổi — **cùng một phép tính, khác cái máy chạy nó**.
6. Video nền đen (`assets/my-fx/`) để cuối, coi như thưởng, và nó giải thích
   luôn vì sao `blend` phải cộng chứ không dán đè.

## Đáp án

Bản chạy được nằm ở repo riêng <https://github.com/nmnhut-it/magic-dust-kit-dap-an>
— học sinh tải về, thả vào `student/` là xong, và ở đó có `TU-CHAM.py` chấm
offline (không cần camera, không cần trình duyệt) nếu thầy cô muốn kiểm nhanh
trước buổi dạy. Bản chép dưới đây để tiện đọc trên giấy.

### `student/spells.py`

```python
def on_fingers(count):
    if count == 1:
        play_effect("dragon")
    elif count == 2:
        play_effect("phoenix")
    elif count == 3:
        play_effect("sakura")
    else:
        say("chưa gán phép cho số này")


def on_voice(word):
    if word == "rồng" or word == "dragon":
        play_effect("dragon")
    elif word == "hoa" or word == "sakura":
        play_effect("sakura")
    elif word == "mưa" or word == "rain":
        play_effect("rain")
    else:
        say("nghe được: " + word)
```

### `student/image_spells.py`

```python
def flip(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            f = (row * width + (width - 1 - col)) * 4
            out[o] = px[f]
            out[o + 1] = px[f + 1]
            out[o + 2] = px[f + 2]


def blur(px, out, width, height):
    for row in range(height):
        for col in range(width):
            do = xanh_la = xanh_duong = dem = 0
            for dr in (-1, 0, 1):
                nr = row + dr
                if nr < 0 or nr >= height:
                    continue
                for dc in (-1, 0, 1):
                    nc = col + dc
                    if nc < 0 or nc >= width:
                        continue
                    i = (nr * width + nc) * 4
                    do += px[i]
                    xanh_la += px[i + 1]
                    xanh_duong += px[i + 2]
                    dem += 1
            o = (row * width + col) * 4
            out[o] = do // dem
            out[o + 1] = xanh_la // dem
            out[o + 2] = xanh_duong // dem


def blend(px, layer, out, width, height):
    for i in range(0, len(px), 4):
        out[i] = min(255, px[i] + layer[i])
        out[i + 1] = min(255, px[i + 1] + layer[i + 1])
        out[i + 2] = min(255, px[i + 2] + layer[i + 2])
```

### Bốn bài thêm (`negative` · `grayscale` · `flip_vertical` · `drop_blue`)

```python
def negative(px, out, width, height):
    for i in range(0, len(px), 4):
        out[i] = 255 - px[i]
        out[i + 1] = 255 - px[i + 1]
        out[i + 2] = 255 - px[i + 2]


def grayscale(px, out, width, height):
    for i in range(0, len(px), 4):
        gray = (px[i] + px[i + 1] + px[i + 2]) // 3
        out[i] = gray
        out[i + 1] = gray
        out[i + 2] = gray


def flip_vertical(px, out, width, height):
    for row in range(height):
        for col in range(width):
            o = (row * width + col) * 4
            source = ((height - 1 - row) * width + col) * 4
            out[o] = px[source]
            out[o + 1] = px[source + 1]
            out[o + 2] = px[source + 2]


def drop_blue(px, out, width, height):
    for i in range(0, len(px), 4):
        out[i] = px[i]
        out[i + 1] = px[i + 1]
        out[i + 2] = 0
```

`grayscale` là bài đáng dừng lại nhất: nhiều em ghi trung bình vào đúng một
kênh rồi thắc mắc sao ảnh ngả đỏ. Người chấm phân biệt hai lỗi đó bằng hai câu
khác nhau — "ba kênh phải bằng nhau" và "đã bằng nhau nhưng chưa phải trung
bình cộng".

## Chấm tự động

`python cham.py` chấm cả hai file, không cần trình duyệt lẫn camera: nó dựng
một `magic_stage` giả rồi gọi thẳng `on_fingers`/`on_voice` và toàn bộ hàm ảnh.
`serve.py` gọi nó mỗi lần khởi động, nên bấm `CHAY.bat` là bảng chấm hiện ngay
trong cửa sổ đen trước khi trình duyệt mở. Trong trang thì phím `T` cho cùng
kết quả (`check_all()` nằm cuối `student/image_spells.py`).

Chấm ở ba chỗ dùng chung một bộ đề, nên không có chuyện máy chủ nói đạt mà
trang nói chưa.

## `blend` chưa xong thì phép video vẫn chạy

Đáng nói vì dễ hiểu nhầm: `play_effect(...)` do JavaScript ghép lớp
(`studio.playOverlay`), hoàn toàn không đi qua `blend` của học sinh. Bài 1 vì
vậy chơi được ngay từ đầu buổi, khi bài 2 còn trống. `blend` chỉ điều khiển ô
xem thử ở góc phải khi bấm `N` — và nếu hàm còn nguyên đề bài, `py-runtime.js`
so ảnh vào/ra rồi báo `blend() chưa đổi gì trên ảnh`, thay vì để màn hình im
lặng làm các em tưởng máy hỏng.

## Chỗ học sinh hay vấp

- **Quên bấm `R`.** Sửa file xong nhìn màn hình không đổi rồi tưởng mình sai.
  Nhắc các em: lưu file → bấm `R` → thấy dòng `Đã nạp lại student/*.py`.
- **Ghi đè lên `px`.** Có em viết `px[o] = px[f]` cho gọn; nửa ảnh sau sẽ lật
  đè lên phần vừa bị sửa. Đó là lý do hàm có hai danh sách riêng: đọc `px`,
  ghi `out`.
- **`blur` chia cứng cho 9.** Ô sát mép chỉ có 4 hoặc 6 hàng xóm, chia cho 9
  thì viền ảnh tối sầm. Phải đếm `dem` rồi chia cho `dem`.
- **`blur` đọc ra ngoài ảnh.** `nr`/`nc` âm trong Python KHÔNG lỗi — nó đếm
  ngược từ cuối danh sách, nên ảnh có vệt lạ chứ không báo gì. Phải `continue`
  khi ra ngoài.
- **`on_voice` so sánh chuỗi có dấu.** Micro trả về chữ thường nhưng có dấu
  tiếng Việt; `"rong"` sẽ không khớp `"rồng"`.
- **Video hiệu ứng không có nền đen** → cả khung sáng trắng khi bấm. Bằng chứng
  sống cho chuyện "cộng ánh sáng" chứ không phải "dán đè".

## Kiểm tra nhanh trước buổi dạy

```bash
python serve.py
```

Mở đồ chơi, chờ dòng `Python sẵn sàng`, bấm `T` — phải thấy ba dòng `✖` (đề bài
còn nguyên). Mở đảo gương, chạy một ô code — phải thấy cửa sổ so sánh ảnh.

## Camera trên máy trường

Camera chỉ chạy ở `localhost` hoặc HTTPS. Đơn giản nhất là mỗi máy tự chạy
`serve.py` của mình. Máy không có webcam vẫn học được: bấm `T` để chấm phần ảnh,
gõ `student.fingers(2)` trong Console để thử phần `if/elif`, và đảo gương thì
không cần camera.
