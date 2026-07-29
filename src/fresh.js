// fresh.js — lo chuyện "máy đang giữ bản cũ".
//
// Trang tĩnh hay bị kẹt bản cũ trong bộ nhớ đệm; với trang này thì hậu quả nặng
// (mã cũ gặp dữ liệu mới là vỡ), nên kiểm thẳng: tải build.txt về, so với số
// bản dựng nằm sẵn trong mã. Lệch thì nạp lại, kèm một nút bấm tay cho chắc.
import { BUILD } from './build.js?v=4';

const ONCE = 'magicdust.kit.reloaded';

export async function checkFresh(onStale) {
  try {
    const latest = (await fetch('./build.txt', { cache: 'no-store' }).then(r => r.text())).trim();
    if (!latest || latest === BUILD) { sessionStorage.removeItem(ONCE); return; }
    // Chỉ tự nạp lại MỘT lần mỗi phiên, nếu không thì máy chủ hỏng sẽ làm trang
    // quay vòng vô tận.
    if (sessionStorage.getItem(ONCE) === latest) { onStale?.(latest); return; }
    sessionStorage.setItem(ONCE, latest);
    hardReload();
  } catch { /* mất mạng thì thôi, cứ chạy bản đang có */ }
}

// Xoá sạch bộ nhớ đệm rồi nạp lại — không dựa vào Ctrl+F5 của học sinh.
export async function hardReload() {
  try {
    if (self.caches) for (const key of await caches.keys()) await caches.delete(key);
  } catch { /* trình duyệt không cho thì bỏ qua */ }
  const url = new URL(location.href);
  url.searchParams.set('moi', Date.now().toString(36));
  location.replace(url.toString());
}
