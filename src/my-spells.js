// ┌──────────────────────────────────────────────────────────────────────────┐
// │  BÀI TẬP 1 — THẦN CHÚ CỦA RIÊNG BẠN                                      │
// │  Cả file này là của bạn. Sửa thoải mái, hỏng thì xoá đi viết lại.        │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Một thần chú hạt là một HÀM đặt từng hạt sáng vào chỗ của nó. Máy gọi hàm
// của bạn đúng một lần cho mỗi hạt, và bạn nói cho nó biết hạt đó nằm ở đâu,
// màu gì, to bằng nào:
//
//     fn(i, n, st)
//       i  — hạt thứ mấy (0, 1, 2, … n-1)
//       n  — tổng số hạt
//       st — st(i, x, y, z, r, g, b, size)  đặt hạt i vào chỗ đó
//
// x, y, z chạy khoảng -60 tới 60 (0 là ngay đầu ngón tay bạn).
// r, g, b là độ sáng từng màu, cứ để trên 1 cho nó rực.
// size khoảng 0.3 (bụi li ti) tới 3 (đốm to).

const TAU = Math.PI * 2;
const R = Math.random;

// ── VÍ DỤ CÓ SẴN: một vòng tròn xoáy ─────────────────────────────────────────
// Đọc kỹ hàm này trước khi viết hàm của bạn — nó chỉ có bốn dòng.
function genRing(i, n, st) {
  const goc = (i / n) * TAU;            // rải đều các hạt quanh vòng tròn
  const banKinh = 22 + R() * 6;          // hơi rung một chút cho khỏi cứng
  const x = banKinh * Math.cos(goc);
  const y = banKinh * Math.sin(goc);
  st(i, x, y, (R() - .5) * 4, 1.2, .6, .2, 1.6);
}

// ── LƯỢT CỦA BẠN ─────────────────────────────────────────────────────────────
// Xoá phần thân hàm này và viết theo ý bạn. Vài ý để bắt đầu:
//   · mưa rơi:   x ngẫu nhiên, y từ trên cao xuống
//   · trái tim:  x = 16*sin(t)^3
//   · ngôi sao:  bán kính đổi qua lại giữa dài và ngắn theo i % 2
function genCuaBan(i, n, st) {
  const goc = R() * TAU;
  const banKinh = R() * 40;
  st(i, banKinh * Math.cos(goc), banKinh * Math.sin(goc), 0, .4, 1.0, .9, 1.0);
}

// ── BẢNG ĐĂNG KÝ ─────────────────────────────────────────────────────────────
// Thêm thần chú vào đây là máy biết ngay. `bloom` là độ chói (1 = thường,
// 3 = loá cả màn hình).
export const MY_SPELLS = {
  ring: { n: 'Vòng Lửa', color: '#d69a20', bloom: 2.6, fn: genRing },
  mine: { n: 'Thần Chú Của Tôi', color: '#78b2a5', bloom: 2.4, fn: genCuaBan },
};

// Giơ mấy ngón tay thì niệm thần chú nào. Máy đã dùng 1 và 2 rồi (Fireball,
// Chain Lightning), nên bạn còn 3 và 4.
export const MY_FINGERS = {
  3: 'ring',
  4: 'mine',
};

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  BÀI TẬP 2 — HIỆU ỨNG QUAY SẴN CỦA BẠN                                   │
// └──────────────────────────────────────────────────────────────────────────┘
// Bỏ file video vào thư mục `assets/my-fx/` rồi khai báo một dòng ở đây là gọi
// được bằng phím. Video nên quay trên NỀN ĐEN — máy cộng ánh sáng của video vào
// khung hình, nên chỗ đen sẽ tự biến mất, đúng phép `min(255, a + b)` bạn viết
// ở đảo Gương Vô Cực.
//
// Chưa có video thì cứ để trống `{}` — app vẫn chạy bình thường.
export const MY_FX = {
  // vidu: { n: 'Hiệu Ứng Của Tôi', file: './assets/my-fx/cua-toi.mp4', hotkey: 'v' },
};
