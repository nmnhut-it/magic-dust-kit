# Tự tạo video hiệu ứng bằng Gemini

Mấy lớp hiệu ứng trong đồ chơi (rồng, phượng hoàng, hoa anh đào…) chỉ là **video
quay trên nền đen**. Bạn tự làm được cái của mình, rồi gọi nó từ Python.

---

## Vì sao phải là nền đen

Vì `blend` trong `student/image_spells.py` **cộng ánh sáng**, chứ không dán đè:

```python
out[i] = min(255, px[i] + layer[i])
```

Ô nào của video màu đen thì giá trị gần `0`, cộng vào khung hình gần như không
đổi gì — nền tự biến mất. Ô nào sáng thì đẩy khung hình sáng lên, thành ra hiệu
ứng "phát sáng" đè lên người bạn. Không cần cắt nền, không cần phông xanh.

Hệ quả: **video có nền xám, nền trắng, hay có bầu trời sẽ làm cả khung hình
sáng trắng lên.** Đó không phải lỗi máy, đó chính là phép cộng đang làm đúng
việc của nó.

---

## Các bước

### 1. Vào Gemini và yêu cầu tạo video

Mở <https://gemini.google.com>, chọn chế độ tạo video (Veo). Dán một trong mấy
prompt mẫu bên dưới. Viết prompt bằng **tiếng Anh** thì Veo hiểu sát ý hơn.

### 2. Tải file `.mp4` về

Bấm nút tải xuống ở góc video. Veo thường cho ra clip khoảng 8 giây, tỉ lệ 16:9.
Có kèm hình mờ SynthID của Google — không sao, dùng trong lớp bình thường.

### 3. Bỏ vào thư mục và khai báo một dòng

Chép file vào `assets/my-fx/`, ví dụ `rong-lua.mp4`. Mở `src/my-spells.js`:

```js
export const MY_FX = {
  ronglua: { n: 'Rồng Lửa', file: './assets/my-fx/rong-lua.mp4', hotkey: 'v' },
};
```

### 4. Gọi nó từ Python

Trong `student/spells.py`, dùng đúng cái tên bạn vừa đặt bên trái dấu hai chấm:

```python
def on_fingers(count):
    if count == 1:
        play_effect("ronglua")
    ...
```

Lưu file, quay ra trang web bấm `R`, giơ một ngón tay lên camera.

---

## Prompt mẫu

Câu **bắt buộc phải có** trong mọi prompt, dán nguyên vào cuối:

> on a pure solid black background, no background elements, no sky, no ground,
> no room, no people, no text, no watermark, no logo, static locked-off camera,
> the effect stays centered in frame

Không có mấy câu đó thì Veo hay tự thêm bối cảnh, và bối cảnh sáng sẽ phá phép
cộng ở bước trên.

### Rồng lửa bay qua

> A glowing fire dragon made of embers and flame flies across the frame from
> left to right, trailing sparks, on a pure solid black background, no
> background elements, no sky, no ground, no room, no people, no text, no
> watermark, no logo, static locked-off camera, the effect stays centered in
> frame.

### Vòng phép xoay

> A luminous cyan magic circle with rotating runes expands outward and pulses
> once, thin bright lines, particles drifting upward, on a pure solid black
> background, no background elements, no sky, no ground, no room, no people, no
> text, no watermark, no logo, static locked-off camera, the effect stays
> centered in frame.

### Cánh hoa rơi

> Slow falling pink cherry blossom petals drifting down through the frame,
> softly glowing edges, gentle motion, on a pure solid black background, no
> background elements, no sky, no ground, no room, no people, no text, no
> watermark, no logo, static locked-off camera, the effect fills the frame.

### Sét đánh xuống

> A single white-hot lightning bolt strikes down through the frame with fractal
> side branches and a blue-violet corona, flashing twice, on a pure solid black
> background, no background elements, no sky, no ground, no room, no people, no
> text, no watermark, no logo, static locked-off camera, the effect stays
> centered in frame.

### Bụi sao xoáy

> A swirling vortex of tiny golden sparks spiraling inward, shallow depth of
> field, warm glow, on a pure solid black background, no background elements, no
> sky, no ground, no room, no people, no text, no watermark, no logo, static
> locked-off camera, the effect stays centered in frame.

### Bươm bướm pha lê

> A swarm of translucent crystal butterflies with softly glowing wings flutters
> across the frame, on a pure solid black background, no background elements, no
> sky, no ground, no room, no people, no text, no watermark, no logo, static
> locked-off camera, the effect fills the frame.

---

## Kiểm tra trước khi dùng

Mở video vừa tải bằng trình xem ảnh bất kỳ, nhìn **góc và mép khung hình**:

| Thấy gì | Kết luận |
|---|---|
| Đen kịt như tắt màn hình | Dùng được ngay |
| Đen nhưng hơi xám | Vẫn dùng được, khung hình sẽ hơi sáng lên một chút |
| Có mây, có sàn, có tường, có bóng người | Làm lại, thêm mạnh mấy câu "no background" |

Muốn chắc chắn thì cứ bỏ vào `assets/my-fx/`, khai báo, rồi bấm phím `N` để xem
chính hàm `blend` của bạn ghép nó lên mặt bạn.

---

## Vài mẹo khi làm

- **Xin hẳn "nền đen tuyệt đối".** Veo hiểu "black background" là một cảnh tối,
  không phải màu đen thuần. Cứ lặp lại `pure solid black`, `no background
  elements` cho tới khi ra.
- **Đừng xin chuyển động máy quay.** "camera pans", "drone shot", "zoom in" sẽ
  làm cả lớp hiệu ứng trôi đi trong khi mặt bạn đứng yên — nhìn rất giả.
- **Một hiệu ứng một clip.** Xin "dragon and lightning and petals" thì được một
  clip lộn xộn, không dùng được cái nào.
- **8 giây là đủ.** Máy sẽ tự lặp lại clip khi bạn niệm phép lâu hơn.
- **Không cần tiếng.** Đồ chơi tắt tiếng của video, khỏi mất công xin nhạc nền.
- Nếu Gemini không cho tạo video (tài khoản không có Veo), tải clip miễn phí ở
  **Pexels**, **Pixabay** hoặc **Mixkit** — gõ tìm `particles black background`,
  `magic effect black background`.

---

## Cắt ngắn hoặc thu nhỏ file (không bắt buộc)

Clip Veo thường 5–10 MB, dùng thẳng được. Nếu máy chậm và bạn có sẵn `ffmpeg`:

```bash
ffmpeg -i rong-lua.mp4 -t 4 -an -vf scale=960:-2 -crf 28 rong-lua-nhe.mp4
```

`-t 4` giữ 4 giây đầu · `-an` bỏ tiếng · `scale=960:-2` thu nhỏ chiều ngang ·
`-crf 28` nén mạnh hơn.
