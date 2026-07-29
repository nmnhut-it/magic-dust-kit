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

**Windows: bấm đúp vào `CHAY.bat`.** Hết. Máy chưa có Python thì nó tự cài
giúp, rồi mở trình duyệt luôn.

Máy Mac hoặc Linux, hoặc bạn thích gõ lệnh:

```bash
python serve.py
```

Rồi mở:

- đồ chơi → <http://localhost:8123/index.html>
- đảo gương → <http://localhost:8123/lessons/islandFXFORGE.html>

Dùng **Chrome** hoặc **Edge** nhé.

> **Đừng nhấp đúp vào `index.html`.** Mở kiểu `file://` thì trình duyệt không
> cho dùng camera. Cũng đừng dùng Live Server của VS Code — đảo gương cần hai
> dòng tiêu đề đặc biệt mà chỉ `serve.py` gửi kèm.

Lần đầu mở, trang phải tải Python về máy nên hơi lâu. Xong sẽ hiện
`Python sẵn sàng` ở góc phải.

---

# BÀI CỦA BẠN

Bạn sửa **đúng hai file**, cả hai nằm trong thư mục `student/`. Mọi thứ còn lại
trong bộ này là máy móc — cứ để yên.

Mở bằng bất cứ trình soạn thảo nào (Notepad cũng được, VS Code thì dễ nhìn
hơn). **Sửa xong lưu file, quay ra trang web bấm phím `R`** — máy nạp lại mã của
bạn ngay, không phải tải lại trang, không phải chờ Python khởi động lần nữa.

## Bài 1 — `student/spells.py`: chọn phép bằng tay và bằng giọng nói

Hai hàm, cả hai đều là bài `if / elif / else`. Máy đã viết sẵn khung, việc của
bạn là điền phần trong ruột.

```python
def on_fingers(count):    # máy đếm số ngón tay bạn giơ lên rồi gọi hàm này
    ...

def on_voice(word):       # micro nghe được một từ thì gọi hàm này
    ...
```

**Đề bài đang có trong file:**

| Bạn làm gì | Phải ra phép gì |
|---|---|
| giơ 1 ngón | `dragon` |
| giơ 2 ngón | `phoenix` |
| giơ 3 ngón | `sakura` |
| số khác | nói ra "chưa gán phép cho số này" |
| nói "rồng" / "dragon" | `dragon` |
| nói "hoa" / "sakura" | `sakura` |
| nói "mưa" / "rain" | `rain` |
| từ lạ | đọc lại đúng từ vừa nghe, để bạn biết máy nghe ra gì |

Trong hàm bạn gọi `play_effect("dragon")` để mở một lớp hiệu ứng, hoặc
`say("...")` để hiện chữ. Tên hiệu ứng dùng được: `dragon`, `koto`, `rose`,
`phoenix`, `butterfly`, `sakura`, `smoke`, `rain`, `flower`, `magic`,
`lightning`.

Bài này không cần ai chấm: giơ tay lên camera là thấy ngay mình đúng hay sai.

## Bài 2 — `student/image_spells.py`: ba phép xử lý ảnh

Ở đảo gương bạn viết `flip` và `blend` bằng Python trên lưới nhỏ, đủ để nhìn
từng con số. Ở đây **vẫn đúng phép tính đó**, nhưng máy gọi lại hàng chục lần
mỗi giây trên hình từ camera.

| Hàm | Việc của nó | Phím thử |
|---|---|---|
| `flip` | soi gương trái–phải | `F` |
| `blur` | mỗi ô lấy màu trung bình với hàng xóm | `B` |
| `blend` | ghép lớp hiệu ứng lên khung hình, kẹp ở 255 | `N` |

**Bấm `T` trước khi hỏi ai** — máy dựng một ảnh tí hon rồi chỉ đúng chỗ bạn
sai, kiểu `✖ blur: ô góc vẫn đen — ánh sáng chưa lan sang hàng xóm`.

## Mấy phím cần nhớ

| Phím | Việc |
|---|---|
| `R` | nạp lại `student/*.py` sau khi bạn sửa |
| `T` | máy tự chấm ba hàm xử lý ảnh và nói bạn sai ở đâu |
| `F` `B` `N` | chạy `flip` / `blur` / `blend` của bạn trên hình camera |
| `X` | tắt phép xử lý ảnh |

---

# THÊM PHÉP CỦA RIÊNG BẠN

Ba mức, từ dễ tới đáng khoe.

## Mức 1 — gán thêm một hiệu ứng có sẵn

Bộ này có sẵn 11 hiệu ứng mà đề bài mới dùng có ba. Thêm một nhánh `elif`, đặt
**trước** `else`, là xong:

```python
    elif count == 4:
        play_effect("butterfly")
```

`else` phải nằm cuối cùng, vì nó là nhánh "không khớp cái nào ở trên". Đặt nó
lên trước thì mấy `elif` phía sau không bao giờ tới lượt.

## Mức 2 — video hiệu ứng của riêng bạn

**Bước 1.** Kiếm hoặc tự tạo một video **quay trên nền đen**, bỏ vào
`assets/my-fx/`, ví dụ `rong-lua.mp4`.

**Bước 2.** Khai báo một dòng trong `src/my-spells.js`. Đây là file khai báo,
không phải bài lập trình — cứ chép mẫu rồi đổi chữ:

```js
export const MY_FX = {
  ronglua: { n: 'Rồng Lửa', file: './assets/my-fx/rong-lua.mp4', hotkey: 'v' },
};
```

`ronglua` là tên bạn gọi từ Python · `n` là tên hiện trên bảng thần chú ·
`hotkey` là phím bấm thử cho nhanh (chọn phím chưa ai dùng).

**Bước 3.** Gọi nó từ `student/spells.py`, dùng đúng cái tên bên trái dấu hai
chấm:

```python
    if count == 1:
        play_effect("ronglua")
```

Lưu, bấm `R`, giơ tay lên.

**Vì sao bắt buộc nền đen?** Vì `blend` **cộng ánh sáng** chứ không dán đè:
`out[i] = min(255, px[i] + layer[i])`. Ô nào của video màu đen thì giá trị gần
`0`, cộng vào khung hình gần như không đổi gì — nền tự biến mất, khỏi cần cắt,
khỏi cần phông xanh. Ngược lại, video có nền xám hay có bầu trời sẽ làm cả
khung hình sáng trắng lên. Đó không phải máy hỏng, đó là phép cộng đang làm
đúng việc của nó.

**Tự tạo video bằng Gemini:** xem [`TAO-VIDEO-HIEU-UNG.md`](TAO-VIDEO-HIEU-UNG.md)
— có sáu prompt mẫu viết sẵn (rồng lửa, vòng phép, cánh hoa, sét, bụi sao,
bươm bướm) và cách kiểm xem nền đã đủ đen chưa.

## Mức 3 — phép xử lý ảnh của riêng bạn

`flip`, `blur`, `blend` chỉ là ba hàm Python bình thường, chạy trên một danh
sách số. Bạn viết được cái thứ tư. Vài ý để nghịch, sửa thẳng trong `flip` cho
nhanh rồi bấm `F`:

- **Âm bản:** `out[o] = 255 - px[o]` cho cả ba kênh màu.
- **Đen trắng:** tính trung bình `(đỏ + xanh lá + xanh dương) // 3` rồi ghi
  cùng một con số đó vào cả ba kênh.
- **Lật dọc:** giống `flip` nhưng đổi `row`, lấy hàng `height - 1 - row`.
- **Bỏ bớt một màu:** cho `out[o + 2] = 0` xem thế giới không còn màu xanh
  dương trông thế nào.
- **Mờ mạnh hơn:** đổi `blur` từ 3×3 sang 5×5, và để ý máy chậm đi bao nhiêu —
  đó chính là lý do bộ này chạy ảnh ở 96×72.

---

# BÊN DƯỚI NÓ CHẠY THẾ NÀO

Không có gì thần bí, và biết chỗ này thì lúc hỏng bạn tự sửa được.

**Python thật chạy trong trình duyệt.** Trang nạp **Pyodide** — bản Python được
biên dịch sang WebAssembly để chạy được trong tab web. Vì vậy lần đầu mở hơi
lâu (phải tải Python về), và vì vậy bạn viết Python thật chứ không phải một thứ
na ná.

**Máy đọc file của bạn bằng `fetch`.** `src/py-runtime.js` tải
`student/spells.py` và `student/image_spells.py` về rồi cho Pyodide chạy. Bấm
`R` là nó tải lại — kèm `?t=` phía sau đường dẫn để trình duyệt đừng đưa bản
cũ trong bộ nhớ đệm. Đây là lý do phải mở qua `localhost`: `fetch` không đọc
được file kiểu `file://`.

**`magic_stage` là cầu nối.** Máy đăng ký một module Python tên `magic_stage`
chứa `play_effect` và `say`; hai lệnh đó gọi ngược ra JavaScript để bật video
và hiện chữ. Nên `from magic_stage import play_effect, say` không tìm thấy gì
trên mạng cả — nó do chính trang này dựng ra.

**Ai gọi hàm của bạn:**

| Việc xảy ra | Máy gọi |
|---|---|
| MediaPipe nhìn thấy số ngón tay đổi | `on_fingers(count)` |
| Micro nghe ra một từ | `on_voice(word)` |
| Mỗi khung hình, khi đang bật `F`/`B`/`N` | `flip` / `blur` / `blend` |
| Bạn bấm `T` | `kiem_tra()` |

Nếu bạn đổi tên hàm hoặc chưa lưu file, máy sẽ nói thẳng
`Chưa thấy hàm on_fingers()`.

**Ảnh tới tay bạn dưới dạng gì.** Máy vẽ khung hình camera xuống một canvas
**96×72** rồi đưa cho bạn danh sách số `px`. Mỗi ô ảnh chiếm 4 số liền nhau —
đỏ, xanh lá, xanh dương, độ đục — nên ô ở hàng `row` cột `col` bắt đầu tại
`(row * width + col) * 4`. Bạn đọc `px`, ghi vào `out`.

**Vì sao bé thế?** Vì Python thuần (không numpy) chạy ở luồng chính, đo bằng
chính máy này:

| cỡ ảnh | `flip` | `blur` |
|---|---|---|
| 64×48 | 250 hình/giây | 47 |
| **96×72** | **159** | **22** |
| 320×240 | 11 | 2 |

96×72 là chỗ `blur` — hàm nặng nhất — vẫn còn mượt. Muốn nét hơn thì đổi `W`,
`H` trong `src/py-runtime.js`, nhưng hình sẽ khựng. Vì lý do đó phần ảnh còn
chạy cách khung (`FRAME_EVERY = 2`, xử lý một trong hai khung).

**Phần còn lại là gì:** `src/main.js` lo camera, MediaPipe (thư viện nhận dạng
bàn tay), và Three.js (bụi phép 3D). `src/spells.js` giữ bảng hiệu ứng có sẵn
và trộn thêm `MY_FX` của bạn vào. `serve.py` là máy chủ tí hon, tồn tại chỉ để
gửi kèm hai dòng tiêu đề `COOP`/`COEP` mà đảo gương cần.

---

## Khi có gì đó hỏng

- **Góc màn hình hiện `✖ SyntaxError: ... (line 48)`** → mã Python của bạn sai
  cú pháp ở đúng dòng đó. Sửa, lưu, bấm `R`.
- **`Chưa thấy hàm on_fingers()`** → bạn đổi tên hàm, hoặc chưa lưu file.
- **Sửa rồi mà màn hình không đổi** → quên bấm `R`. Bấm xong phải thấy dòng
  `Đã nạp lại student/*.py`.
- **Không thấy tay** → phải mở qua `localhost` chứ không phải `file://`, và cho
  phép trình duyệt dùng camera. Ngồi cách camera một sải tay, phòng đủ sáng.
- **Bấm phép mà cả khung hình trắng xoá** → video hiệu ứng của bạn không có nền
  đen. Xem lại mức 2 ở trên.
- **Ảnh có vệt lạ ở mép sau khi sửa `blur`** → chỉ số âm trong Python **không
  báo lỗi**, nó đếm ngược từ cuối danh sách. Phải `continue` khi hàng xóm rơi
  ra ngoài ảnh.
- **Đảo gương đứng ở "Loading Python"** → bạn đang mở bằng Live Server hoặc
  `python -m http.server`. Phải là `python serve.py`.
- **Console có mấy dòng đỏ về `.mp3` và `.efk`** → kệ nó, bộ này cố ý không kèm
  file âm thanh.

## Mấy phím tiện tay khác

`1`/`2` giữ để giả bộ giơ 1–2 ngón · `Space` niệm luôn · `3`–`0`, `D`, `R` gọi
hiệu ứng có sẵn · `G` thu gọn bảng thần chú · `M` đổi kiểu tách nền · `P` chụp ảnh.

Muốn thử mà không giơ tay: mở Console gõ `student.fingers(2)` hoặc
`student.voice("mưa")`.

## Bí quá thì có đáp án

Nằm ở repo riêng: <https://github.com/nmnhut-it/magic-dust-kit-dap-an>. Tải về,
kéo thư mục bộ đồ nghề này thả vào `CHEP-VAO.bat` là hai file đáp án vào đúng
chỗ, bài cũ của bạn được cất sang `student/bai-cua-toi/`.

Nhưng tự viết xong rồi hãy mở nhé — cái đáng học nằm ở lúc mình vật lộn với nó.

## Bộ này lấy từ đâu

Cắt ra từ dự án Magic Dust của thầy Nhựt — <https://nmnhut.dev/magic-dust/>.
Bạn được sửa, được đăng bản của mình, được đem đi khoe.
