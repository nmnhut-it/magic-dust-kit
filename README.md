# Magic Dust — Bộ Đồ Nghề

Bạn vừa bước qua Gương Vô Cực. Đây là xưởng của bạn: mã nguồn của chính đồ chơi
mà bạn vừa chơi, mở ra sửa được hết.

Trong này có hai thứ:

| | |
|---|---|
| `index.html` | **Đồ chơi VFX** — camera bật lên, tay bạn hiện trong khung, xoè bàn tay là bụi sáng bay ra |
| `lessons/islandFXFORGE.html` | **Đảo GƯƠNG VÔ CỰC** — bài học viết Python để lật ảnh, chồng lớp, chỉnh sáng |

---

## Chạy nó lên

Cần **Python 3** (máy nào cũng cài sẵn được, tải ở python.org) và **Chrome**
hoặc **Edge**.

```bash
python serve.py
```

Rồi mở:

- đồ chơi → <http://localhost:8123/index.html>
- đảo gương → <http://localhost:8123/lessons/islandFXFORGE.html>

> **Đừng mở file bằng cách nhấp đúp vào `index.html`.** Trình duyệt sẽ không cho
> dùng camera khi mở kiểu `file://`. Cũng đừng dùng Live Server của VS Code —
> đảo gương cần hai dòng tiêu đề đặc biệt mà chỉ `serve.py` gửi kèm (đọc phần
> đầu file đó nếu bạn tò mò tại sao).

Lần đầu vào đảo gương sẽ hơi lâu: trình duyệt phải tải cả một bộ Python về máy.

---

## Ba bài tập

Mọi thứ bạn cần sửa nằm trong **ba chỗ**, không phải mò khắp nơi.

### 1. Thần chú của riêng bạn — `src/my-spells.js`

Viết một hàm đặt từng hạt sáng vào chỗ của nó, đặt tên, gán cho số ngón tay.
Trong file đã có sẵn một ví dụ bốn dòng (vòng tròn xoáy) để bạn đọc trước.
Thêm xong, giơ đúng số ngón tay đó lên camera là niệm được.

### 2. Hiệu ứng video của bạn — `assets/my-fx/`

Bỏ một file video **quay trên nền đen** vào thư mục đó, khai báo một dòng trong
`src/my-spells.js`, thế là gọi được bằng phím. Vì sao phải nền đen thì bài tập 3
sẽ trả lời.

### 3. Ba phép xử lý ảnh — `src/my-image-spells.js`

Đây là bài chính. Ở đảo gương bạn viết `flip` và `blend` bằng Python trên lưới
8×8 — đủ nhỏ để nhìn thấy từng con số. Giờ viết lại bằng JavaScript, và chúng
chạy 30 lần mỗi giây trên khuôn mặt bạn:

| Hàm | Việc của nó | Phím thử |
|---|---|---|
| `flip` | soi gương trái–phải | `F` |
| `blur` | mỗi ô lấy màu trung bình với hàng xóm | `B` |
| `blend` | cộng lớp hiệu ứng lên khung hình, kẹp ở 255 | `N` |

Phím `X` tắt hết. Phím **`T` là máy tự chấm** ba hàm đó bằng một ảnh tí hon và
nói cho bạn sai ở đâu — bấm `T` trước khi hỏi ai.

Hàm nào chưa viết thì màn hình báo tên hàm còn thiếu; phần còn lại của đồ chơi
vẫn chạy bình thường, không sập.

---

## Khi có gì đó hỏng

- **Không thấy tay** → kiểm tra bạn đang ở `localhost` chứ không phải `file://`,
  và trình duyệt đã cho phép dùng camera. Ngồi cách camera khoảng một sải tay,
  phòng đủ sáng.
- **Đảo gương đứng ở "Loading Python"** → bạn đang mở bằng Live Server hoặc
  `python -m http.server`. Phải là `python serve.py`.
- **Đồ chơi báo `✖ ... chưa viết`** → đúng rồi đấy, đó là bài tập 3 đang chờ bạn.
- **Trong Console có mấy dòng đỏ về `.mp3` và `.efk`** → kệ nó. Bộ này cố ý
  không kèm file âm thanh; thiếu thì đồ chơi tự bỏ qua.

## Mấy phím tiện tay

`1`/`2` giữ để giả bộ giơ 1–2 ngón · `Space` niệm luôn · `3`–`0`, `D`, `R` gọi
hiệu ứng video · `G` thu gọn bảng thần chú · `M` đổi kiểu tách nền ·
`P` chụp ảnh.

## Bộ này lấy từ đâu

Cắt ra từ dự án Magic Dust của thầy Nhựt — <https://nmnhut.dev/magic-dust/>.
Bạn được sửa, được đăng bản của mình, được đem đi khoe.
