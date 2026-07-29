# Magic Dust — Bộ Đồ Nghề

Bạn vừa bước qua Gương Vô Cực. Đây là xưởng của bạn: mã nguồn của chính đồ chơi
bạn vừa chơi. **Bạn viết Python, và Python của bạn điều khiển camera thật.**

Trong này có hai thứ:

| | |
|---|---|
| `index.html` | **Đồ chơi VFX** — camera bật lên, tay bạn hiện trong khung, và mã Python bạn viết quyết định phép nào hiện ra |
| `lessons/islandFXFORGE.html` | **Đảo GƯƠNG VÔ CỰC** — nơi bạn học lật ảnh, ghép lớp, chỉnh sáng trên lưới số nhỏ |

---

## Chạy nó lên

Cần **Python 3** (tải ở python.org) và **Chrome** hoặc **Edge**.

```bash
python serve.py
```

Rồi mở:

- đồ chơi → <http://localhost:8123/index.html>
- đảo gương → <http://localhost:8123/lessons/islandFXFORGE.html>

> **Đừng nhấp đúp vào `index.html`.** Mở kiểu `file://` thì trình duyệt không
> cho dùng camera. Cũng đừng dùng Live Server của VS Code — đảo gương cần hai
> dòng tiêu đề đặc biệt mà chỉ `serve.py` gửi kèm.

Lần đầu mở, trang phải tải Python về máy nên hơi lâu. Xong sẽ hiện
`Python sẵn sàng` ở góc phải.

---

## Bài của bạn nằm ở thư mục `student/`

Hai file Python, mở bằng bất cứ trình soạn thảo nào. **Sửa xong thì lưu file,
quay ra trang web bấm phím `R`** — máy nạp lại mã của bạn ngay, không phải tải
lại trang.

Mấy phím cần nhớ:

| Phím | Việc |
|---|---|
| `R` | nạp lại `student/*.py` sau khi bạn sửa |
| `T` | máy tự chấm ba hàm xử lý ảnh và nói bạn sai ở đâu |
| `F` `B` `N` | chạy `flip` / `blur` / `blend` của bạn trên hình camera |
| `X` | tắt phép xử lý ảnh |

### `student/spells.py` — chọn phép bằng tay và bằng giọng nói

Hai hàm, cả hai đều là bài `if / elif / else`:

```python
def on_fingers(count):    # máy đếm số ngón tay bạn giơ lên rồi gọi hàm này
    ...

def on_voice(word):       # micro nghe được một từ thì gọi hàm này
    ...
```

Trong hàm bạn gọi `play_effect("dragon")` để mở một lớp hiệu ứng, hoặc
`say("...")` để hiện chữ. Tên hiệu ứng dùng được: `dragon`, `koto`, `rose`,
`phoenix`, `butterfly`, `sakura`, `smoke`, `rain`, `flower`, `magic`,
`lightning`.

Giơ tay lên camera là thấy ngay mã của bạn chạy.

### `student/image_spells.py` — ba phép xử lý ảnh

Ở đảo gương bạn viết `flip` và `blend` bằng Python trên lưới 8×8, đủ nhỏ để
nhìn từng con số. Ở đây vẫn đúng phép tính đó, nhưng máy gọi nhiều lần mỗi giây
trên hình từ camera:

| Hàm | Việc của nó | Phím thử |
|---|---|---|
| `flip` | soi gương trái–phải | `F` |
| `blur` | mỗi ô lấy màu trung bình với hàng xóm | `B` |
| `blend` | ghép lớp hiệu ứng lên khung hình, kẹp ở 255 | `N` |

Bấm `T` trước khi hỏi ai — máy dựng một ảnh tí hon rồi chỉ đúng chỗ bạn sai.

### `assets/my-fx/` — hiệu ứng video của riêng bạn

Bỏ một file video **quay trên nền đen** vào đó, khai báo một dòng trong
`src/my-spells.js`, rồi gọi nó từ Python bằng `play_effect("tên_bạn_đặt")`.
Vì sao phải nền đen? Vì `blend` cộng ánh sáng chứ không dán đè — chỗ đen cộng
vào 0 nên biến mất.

---

## Khi có gì đó hỏng

- **Góc màn hình hiện `✖ SyntaxError: ... (line 48)`** → mã Python của bạn sai
  cú pháp ở đúng dòng đó. Sửa, lưu, bấm `R`.
- **`Chưa thấy hàm on_fingers()`** → bạn đổi tên hàm, hoặc chưa lưu file.
- **Không thấy tay** → phải mở qua `localhost` chứ không phải `file://`, và cho
  phép trình duyệt dùng camera. Ngồi cách camera một sải tay, phòng đủ sáng.
- **Đảo gương đứng ở "Loading Python"** → bạn đang mở bằng Live Server hoặc
  `python -m http.server`. Phải là `python serve.py`.
- **Console có mấy dòng đỏ về `.mp3` và `.efk`** → kệ nó, bộ này cố ý không kèm
  file âm thanh.

## Mấy phím tiện tay khác

`1`/`2` giữ để giả bộ giơ 1–2 ngón · `Space` niệm luôn · `3`–`0`, `D`, `R` gọi
hiệu ứng có sẵn · `G` thu gọn bảng thần chú · `M` đổi kiểu tách nền · `P` chụp ảnh.

Muốn thử mà không giơ tay: mở Console gõ `student.fingers(2)` hoặc
`student.voice("mưa")`.

## Bộ này lấy từ đâu

Cắt ra từ dự án Magic Dust của thầy Nhựt — <https://nmnhut.dev/magic-dust/>.
Bạn được sửa, được đăng bản của mình, được đem đi khoe.
