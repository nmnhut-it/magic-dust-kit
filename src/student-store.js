// student-store.js — chỗ giữ bài của học sinh trong chính trình duyệt các em.
//
// Trang làm bài (`index.html`) ghi vào đây khi làm xong; sân khấu thật
// (`san-khau.html`) đọc ra và chạy. Nhờ vậy máy nào không cài được Python vẫn học
// được: mở link, làm bài, ra sân khấu — không tài khoản, không GitHub.
//
// Máy nào có sẵn thư mục `student/` trên đĩa thì file trên đĩa vẫn được dùng
// khi chưa có bài nào trong localStorage.
const KEY = 'magicdust.kit.';

export function storedSource(file) {
  try { return localStorage.getItem(KEY + file); } catch { return null; }
}
