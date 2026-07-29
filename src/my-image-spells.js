// ┌──────────────────────────────────────────────────────────────────────────┐
// │  BÀI TẬP 3 — BA PHÉP XỬ LÝ ẢNH, LẦN NÀY CHẠY TRÊN MẶT BẠN                │
// │  Ở đảo Gương Vô Cực bạn viết chúng bằng Python trên lưới 8×8. Cũng đúng  │
// │  phép tính đó thôi, giờ chạy 30 lần mỗi giây trên hình từ camera.        │
// └──────────────────────────────────────────────────────────────────────────┘
//
// MỘT KHUNG HÌNH LÀ GÌ Ở ĐÂY
// Máy đưa cho bạn một dải số dài, gọi là `px`. Mỗi ô ảnh chiếm 4 số liền nhau:
//
//     px[o]     đỏ        px[o + 1] xanh lá
//     px[o + 2] xanh dương  px[o + 3] độ đục (luôn để nguyên 255)
//
// Ô ở hàng `row`, cột `col` bắt đầu ở vị trí:
//
//     const o = (row * width + col) * 4;
//
// Giống hệt `image[row][col]` bên Python, chỉ là ba kênh màu nằm duỗi thẳng ra.
// Số vẫn chỉ từ 0 tới 255: cộng quá thì kẹp bằng Math.min(255, ...), trừ quá
// thì kẹp bằng Math.max(0, ...).
//
// CÁCH THỬ: mở trang, bấm phím
//     F — lật    B — làm mờ    N — chồng hai lớp    X — tắt hết
// Hàm nào bạn chưa viết thì màn hình báo tên hàm đó, chứ không chết lặng.

// ── LẬT NGANG ────────────────────────────────────────────────────────────────
// Trả về khung hình đã soi gương trái–phải.
// Bên Python bạn viết:  flipped[row][col] = image[row][last - col]
// Gợi ý: chạy hết mọi hàng; trong mỗi hàng, ô cột `col` lấy màu của ô cột
// `width - 1 - col`. Nhớ chép đủ ba kênh màu.
export function flip(px, out, width, height) {
  throw new Error('flip() chưa viết — mở src/my-image-spells.js');
}

// ── LÀM MỜ ───────────────────────────────────────────────────────────────────
// Mỗi ô lấy màu TRUNG BÌNH của chính nó và mấy ô hàng xóm. Càng lấy rộng thì
// càng mờ. Gợi ý cho bản đơn giản nhất: với mỗi ô, cộng màu của 9 ô trong
// khung vuông 3×3 quanh nó rồi chia 9. Ô ở sát mép thì bỏ qua hàng xóm nào
// nằm ngoài ảnh (dùng Math.max/Math.min để đừng đọc ra ngoài dải số).
export function blur(px, out, width, height) {
  throw new Error('blur() chưa viết — mở src/my-image-spells.js');
}

// ── CHỒNG HAI LỚP ────────────────────────────────────────────────────────────
// `layer` là lớp hiệu ứng quay trên nền đen, cùng kích thước với khung hình.
// Bên Python bạn viết:  min(255, base + layer) cho từng kênh màu.
// Ô đen của lớp hiệu ứng cộng vào 0 nên nền giữ nguyên; ô sáng thì đẩy nền lên.
export function blend(px, layer, out, width, height) {
  throw new Error('blend() chưa viết — mở src/my-image-spells.js');
}

// ── TỰ CHẤM ──────────────────────────────────────────────────────────────────
// Bấm phím T để máy chấm ba hàm trên bằng một ảnh tí hon 4×3 mà nó tự dựng.
// Đừng sửa phần dưới này — nó là người chấm bài, không phải bài của bạn.
export const CHECKS = [
  {
    name: 'flip',
    run() {
      const w = 3, h = 2, px = frame(w, h, (r, c) => [c * 10, r, 7]);
      const out = new Uint8ClampedArray(px.length);
      flip(px, out, w, h);
      return same(out, frame(w, h, (r, c) => [(w - 1 - c) * 10, r, 7]))
        ? null : 'ô ở cột col phải lấy màu của cột width - 1 - col';
    },
  },
  {
    name: 'blur',
    run() {
      const w = 3, h = 3, px = frame(w, h, (r, c) => (r === 1 && c === 1 ? [255, 255, 255] : [0, 0, 0]));
      const out = new Uint8ClampedArray(px.length);
      blur(px, out, w, h);
      const middle = out[(1 * w + 1) * 4], corner = out[0];
      if (middle >= 250) return 'ô giữa vẫn trắng nguyên — hình như chưa lấy trung bình với hàng xóm';
      if (corner === 0) return 'ô góc vẫn đen thui — ánh sáng chưa lan sang hàng xóm';
      return null;
    },
  },
  {
    name: 'blend',
    run() {
      const w = 2, h = 1;
      const px = frame(w, h, () => [200, 10, 0]);
      const layer = frame(w, h, (r, c) => (c === 0 ? [0, 0, 0] : [100, 100, 100]));
      const out = new Uint8ClampedArray(px.length);
      blend(px, layer, out, w, h);
      if (out[0] !== 200 || out[1] !== 10) return 'ô đen của lớp hiệu ứng phải giữ nguyên nền';
      if (out[4] !== 255) return 'ô sáng phải cộng vào nền rồi kẹp ở 255';
      return null;
    },
  },
];

function frame(w, h, colorAt) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const o = (r * w + c) * 4, rgb = colorAt(r, c);
    px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
  }
  return px;
}
function same(a, b) {
  for (let i = 0; i < b.length; i++) if (i % 4 !== 3 && a[i] !== b[i]) return false;
  return true;
}
