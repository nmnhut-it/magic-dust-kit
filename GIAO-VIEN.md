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

1. Chơi trước, chưa động vào code: xoè tay, giơ 1–2 ngón (test bằng phím `1`/`2`
   nếu chưa có camera). **Lưu ý (2026-07):** không còn phím/từ khoá demo sẵn
   nào bắn ra rồng/phượng/hoa/mưa nữa — các hiệu ứng đó CHỈ hiện khi học sinh
   tự viết đúng `on_fingers`/`on_voice`/`main_loop`. Nếu muốn demo hiệu ứng cho
   cả lớp xem trước khi vào code, dùng `python -c "..."` gọi thẳng
   `play_effect` qua Console (`student.fingers(1)` rồi gõ code mẫu), không còn
   cách bấm phím tắt nào nữa.
2. `student/spells.py` → `on_fingers`. Đây là bài `if/elif/else` đầu tiên mà
   **điều kiện là bàn tay thật của các em**. Sai thì thấy ngay, không cần chấm.
3. `on_voice` — cũng `if/elif/else`, nhưng so sánh chuỗi. Chỗ này lộ ra chuyện
   micro nghe "rồng" có khi ra "Rồng" hay "trồng"; đó là bài học về dữ liệu bẩn.
4. Đảo gương: viết `flip`/`blend` bằng Python trên lưới 8×8 rồi 256×256.
5. `student/image_spells.py`: đúng ba phép đó, giờ chạy trên camera. Điểm rơi
   của cả buổi — **cùng một phép tính, khác cái máy chạy nó**.
6. Video nền đen (`assets/my-fx/`) để cuối, coi như thưởng, và nó giải thích
   luôn vì sao `blend` phải cộng chứ không dán đè.
7. `setup()` → `stage()` → `main_loop()`: ba bài thêm nối tiếp nhau — tự dựng
   bảng nút, tự dựng cả sân khấu, rồi tự viết vòng lặp chính đọc cảm biến thay
   vì để máy gọi hộ. Đây là mạch "càng về sau càng ít máy làm giùm."

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

### `student/image_spells.py` (và bốn bài thêm)

```python
def blur(image, out, width, height):
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

def blend(image, layer, out, width, height):
    for row in range(height):
        for col in range(width):
            base = image[row][col]
            glow = layer[row][col]
            out[row][col] = [min(255, base[0] + glow[0]),
                             min(255, base[1] + glow[1]),
                             min(255, base[2] + glow[2])]

def negative(image, out, width, height):
    for row in range(height):
        for col in range(width):
            pixel = image[row][col]
            out[row][col] = [255 - pixel[0], 255 - pixel[1], 255 - pixel[2]]

def grayscale(image, out, width, height):
    for row in range(height):
        for col in range(width):
            pixel = image[row][col]
            gray = (pixel[0] + pixel[1] + pixel[2]) // 3
            out[row][col] = [gray, gray, gray]

def flip_vertical(image, out, width, height):
    for row in range(height):
        for col in range(width):
            out[row][col] = image[height - 1 - row][col]

def drop_blue(image, out, width, height):
    for row in range(height):
        for col in range(width):
            pixel = image[row][col]
            out[row][col] = [pixel[0], pixel[1], 0]
```

Ảnh là mảng ba chiều `image[row][col][màu]`, giống hệt bên đảo Gương Vô Cực.

### `stage()` — không có đáp án đúng, đây là đáp án MẪU

```python
def stage():
    set_background("rung")
    set_behind("rain")
    set_front("dragon")

    add_button("Rồng Lửa", "dragon")
    add_button("Phượng Hoàng", "phoenix")
    add_button("Hoa Anh Đào", "sakura")
```

Đổi tên nền/hiệu ứng/nút thoải mái — miễn có ít nhất một `set_background` và
một `add_button` là qua bài (xem "Chấm tự động" bên dưới).

### `main_loop()` — bài thêm cuối cùng, tự viết vòng lặp chính

```python
async def main_loop():
    while True:
        count = fingers_now()
        word = heard_word()
        if count == 1 and word in ("rồng", "dragon"):
            play_effect("dragon")
        elif count == 2 and word in ("phượng", "phoenix"):
            play_effect("phoenix")
        elif count == 3 and word in ("hoa", "sakura"):
            play_effect("sakura")
        await asyncio.sleep(0.15)

run_loop(main_loop)
```

Không có đáp án đúng về LOGIC bên trong (học sinh viết nhánh khác cũng được),
nhưng **BẮT BUỘC** có `while` thật và `await asyncio.sleep(...)` — thiếu một
trong hai là rớt ngay, không cần chạy thử (xem "Chấm tự động" bên dưới). Đây
là bài duy nhất trong bộ dùng `asyncio`/`await` — máy chạy Python thẳng trên
luồng chính của trình duyệt (không Worker), nên một vòng `while True` không
nhường lại nhịp nào cho trình duyệt sẽ treo cứng cả trang. Cho học sinh hiểu
rõ điều này trước khi các em tự ý xoá dòng `await asyncio.sleep(...)` "cho
nhanh".

`grayscale` là bài đáng dừng lại nhất: nhiều em ghi trung bình vào đúng một
kênh rồi thắc mắc sao ảnh ngả đỏ. Người chấm phân biệt hai lỗi đó bằng hai câu
khác nhau — "ba kênh phải bằng nhau" và "đã bằng nhau nhưng chưa phải trung
bình cộng".

## Đáp án ngay trong trang, khoá bằng mật khẩu

Mỗi ô bài có nút **🔑 đáp án**. Bấm vào thì trang hỏi mật khẩu — mặc định là
`kot0pi@2026<3` (đổi trong `src/notebook.js`, hằng `PASSWORD_HASH`; băm bằng
djb2 nên mật khẩu không nằm nguyên văn trong mã nguồn). Mở một ô là mở luôn cả
trang cho tới khi tải lại.

Đáp án hiện kèm một đoạn **vì sao** — viết cho người lớn giảng lại, không phải
để chép: nó chỉ ra chỗ hai công thức khác nhau, vì sao chia cho `count` chứ
không phải 9, vì sao phải kẹp riêng từng kênh màu.

Nói thẳng để thầy cô liệu: đây là **cái chốt cửa, không phải khoá két**. Học
sinh nào chịu khó mở mã nguồn vẫn đọc được. Mục đích chỉ là để các em không lỡ
tay bấm ra đáp án khi đang bí.

## Phát hành bản mới

Sửa mã trong `src/` xong thì chạy `node tools/stamp.mjs` trước khi đưa lên
mạng. Nó ghi cùng một con số vào `build.txt` và `src/build.js`; trang tải
`build.txt` mỗi lần mở, thấy lệch với số nằm trong mã là tự nạp lại. Không có
bước này thì máy học sinh có thể chạy mã cũ nửa ngày mà không ai biết — đã gặp
thật, trang chết trắng vì mã cũ gặp dữ liệu mới.

## Chấm tự động

`python cham.py` chấm cả hai file, không cần trình duyệt lẫn camera: nó dựng
một `magic_stage` giả rồi gọi thẳng `on_fingers`/`on_voice` và toàn bộ hàm ảnh.
`serve.py` gọi nó mỗi lần khởi động, nên bấm `CHAY.bat` là bảng chấm hiện ngay
trong cửa sổ đen trước khi trình duyệt mở. Trong trang thì phím `T` cho cùng
kết quả (`check_all()` nằm cuối `student/image_spells.py`).

Chấm ở ba chỗ dùng chung một bộ đề, nên không có chuyện máy chủ nói đạt mà
trang nói chưa.

**`main_loop` chấm hai lớp, ở cả ba chỗ.** Lớp một soi thẳng MÃ NGUỒN thô tìm
từ khoá `while` và chuỗi `await asyncio.sleep(` — thiếu một trong hai là rớt
ngay, không chạy thử (tránh treo trình duyệt vì một `while True` không có
`await`). Lớp hai mới thật sự CHẠY `main_loop()` — vì đây là vòng lặp vô hạn,
cả `src/notebook.js` lẫn `cham.py` gọi nó qua `asyncio.wait_for(..., timeout=
1.2)` và coi `TimeoutError` là kết quả MONG ĐỢI (không phải lỗi), rồi soi
nhật ký xem `play_effect` có được gọi đúng với ngón tay/từ giả đặt trước hay
không.

**`add_button` nhận cả hàm riêng, không chỉ tên hiệu ứng.** `add_button(label,
effect)` — nếu `effect` là một hàm Python (không phải chuỗi), bấm nút chạy
đúng hàm đó thay vì `play_effect()` mặc định. Kỹ thuật: Pyodide chỉ giữ một
hàm Python đưa sang JS sống hết MỘT lượt gọi, nên `py-runtime.js` phải
`.copy()` nó lại lúc `add_button()` chạy (nút bấm về sau, lâu sau khi
`setup()`/`stage()` đã trả về) và `.destroy()` bản copy đó khi bấm `R` nạp
lại — nếu bỏ bước này, hàm sẽ chạy được đúng một lần đầu rồi báo lỗi.

**Bài `stage` không có đáp án đúng** — cả ba nơi chấm (`runStageCell` trong
`src/notebook.js`, phím `T`/`san-khau.html`, và `cham.py`) chỉ đòi ít nhất một
`set_background(...)` và một `add_button(...)`; không so khớp tên nền/hiệu
ứng cụ thể nào. Đây là bài duy nhất trong bộ cố ý chấm lỏng như vậy, vì đề bài
nói rõ "dựng cái bạn thấy đã mắt nhất". `stage()` chạy thật trên
`san-khau.html`: `set_background`/`set_behind`/`set_front` chọn đúng ba lớp
mà bài `scene` đã dạy, và sân khấu tự vào `scene` mode ngay khi nạp — không
cần bấm phím `S`.

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
- **`stage()` quên `set_background`.** Bài không đòi tên nền cụ thể, nhưng
  thiếu cả `set_background` lẫn `add_button` thì báo lỗi rõ ràng
  ("chưa chọn nền" / "chưa gắn nút nào") — không phải chấm sai, đọc kỹ thông
  báo là biết thiếu gì.

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
