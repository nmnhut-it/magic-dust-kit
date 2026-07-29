# Ghi chú cho giáo viên

Học sinh không cần đọc file này. Ở đây có đáp án và mấy chỗ dễ vấp.

## Bộ này gồm gì

Cắt từ `D:/magic-dust`: đồ chơi VFX (`index.html` + `src/`) và **một** đảo
GƯƠNG VÔ CỰC (`lessons/islandFXFORGE.html` + `lessons/engine/` + `py/`). Không
có bản đồ saga, không có node nào khác — mở đảo là vào thẳng.

Ba file học sinh sửa (`src/my-spells.js`, `src/my-image-spells.js`,
`assets/my-fx/`) là file MỚI, không có trong dự án gốc. Phần còn lại của `src/`
là mã gốc, chỉ sửa đúng bốn chỗ để nối bài của học sinh vào:
`spells.js` (trộn bảng thần chú + bảng gợi ý), `studio-effects.js` (trộn video),
`main.js` (một dòng gọi `mountPixelStage`).

## Thứ tự dạy đề nghị

1. Chơi đồ chơi trước — chưa động vào code. Xoè tay, giơ 1–2 ngón, bấm `3`–`0`.
2. Bài tập 1 (thần chú hạt): sửa số trong `genCuaBan` rồi xem đổi gì trên màn
   hình. Đây là bài "sửa thấy ngay", để lấy đà.
3. Đảo gương: viết `flip`/`blend` bằng Python trên lưới 8×8 và 256×256.
4. Bài tập 3: viết lại đúng hai phép đó bằng JavaScript trên camera. Chỗ này là
   cả điểm rơi của buổi học — **cùng một phép tính, khác cái máy chạy nó**.
5. Bài tập 2 (video nền đen) để cuối, coi như phần thưởng, và nó giải thích
   luôn vì sao `blend` phải cộng chứ không phải đè.

## Đáp án bài tập 3

Bấm `T` trong đồ chơi là máy tự chấm. Đây là bản đủ:

```js
export function flip(px, out, width, height) {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const o = (row * width + col) * 4;
      const from = (row * width + (width - 1 - col)) * 4;
      out[o] = px[from]; out[o + 1] = px[from + 1]; out[o + 2] = px[from + 2]; out[o + 3] = 255;
    }
  }
}

export function blur(px, out, width, height) {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let r = 0, g = 0, b = 0, dem = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nc < 0 || nr >= height || nc >= width) continue;
          const n = (nr * width + nc) * 4;
          r += px[n]; g += px[n + 1]; b += px[n + 2]; dem++;
        }
      }
      const o = (row * width + col) * 4;
      out[o] = r / dem; out[o + 1] = g / dem; out[o + 2] = b / dem; out[o + 3] = 255;
    }
  }
}

export function blend(px, layer, out, width, height) {
  for (let i = 0; i < px.length; i += 4) {
    out[i] = Math.min(255, px[i] + layer[i]);
    out[i + 1] = Math.min(255, px[i + 1] + layer[i + 1]);
    out[i + 2] = Math.min(255, px[i + 2] + layer[i + 2]);
    out[i + 3] = 255;
  }
}
```

## Chỗ học sinh hay vấp

- **Quên kênh alpha.** Không gán `out[o + 3] = 255` thì ảnh trong suốt, nhìn ra
  toàn màu nền. Bộ chạy đã tô sẵn 255 cho cả khung trước khi gọi hàm, nên lỗi
  này ít khi bung ra — nhưng nếu em nào tự tạo mảng mới thì gặp ngay.
- **Lật bằng cách đổi chỗ tại chỗ.** Có em viết `px[o] = px[from]` trên chính
  dải số đầu vào, nửa sau ảnh sẽ lật đè lên nửa đã lật. Vì vậy hàm có hai dải
  riêng: đọc `px`, ghi `out`.
- **`blur` đọc ra ngoài mép.** `nr`/`nc` âm hoặc vượt cỡ thì `px[n]` ra
  `undefined`, cộng vào thành `NaN`, ảnh đen thui. Bỏ qua hàng xóm ngoài ảnh và
  chia cho số ô thực sự cộng được (`dem`), đừng chia cứng cho 9.
- **`blend` nhân đôi vòng lặp.** Không cần `row`/`col` — cộng thẳng theo chỉ số
  `i` là xong, vì hai ảnh cùng kích thước. Ai đã viết bằng `row`/`col` cũng
  đúng, không cần bắt sửa.
- **Video hiệu ứng không có nền đen** → cả khung hình sáng trắng lên khi bấm.
  Đó là bằng chứng sống cho việc "cộng ánh sáng" chứ không phải "dán đè".

## Kiểm tra nhanh trước buổi dạy

```bash
python serve.py
```

Mở đồ chơi, bấm `T` — phải thấy ba dòng `✖ ... chưa viết` (đề bài còn nguyên).
Mở đảo gương, chạy thử một ô code — phải thấy cửa sổ so sánh ảnh mở ra.

## Camera trên máy trường

Camera chỉ chạy ở `localhost` hoặc HTTPS. Nếu muốn học sinh mở từ máy khác trong
phòng máy thì phải có HTTPS — đơn giản nhất là mỗi máy tự chạy `serve.py` của
mình. Máy nào không có webcam vẫn học được bài tập 3: bấm `T` để chấm, và đảo
gương thì không cần camera.
