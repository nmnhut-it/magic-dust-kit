// Đóng dấu bản dựng: ghi cùng một con số vào build.txt (trang tải về để so) và
// vào src/build.js (nằm sẵn trong mã trang). Hai chỗ lệch nhau nghĩa là máy
// đang giữ bản cũ — trang tự nạp lại.
//
// Đóng luôn con số đó vào courseVersion + ?v= của hai trang Skin Lab. Trước đây
// courseVersion phải sửa tay nên nó đứng yên ở 2026.08.07.2 suốt nhiều bản dựng,
// tức bản lưu trong máy học sinh ghi một số đời không bao giờ lệch với trang.
// Còn ?v= chỉ là lớp chắn phụ: _headers đã gửi no-store cho /skin-lab/*.
//
//     node tools/stamp.mjs        chạy trước mỗi lần deploy
import { readFileSync, writeFileSync } from 'node:fs';

const SKIN_PAGES = ['skin-lab/index.html', 'skin-lab/dap-an.html'];
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

writeFileSync('build.txt', stamp + '\n');
writeFileSync('src/build.js', `// Máy sinh ra, đừng sửa tay — xem tools/stamp.mjs\nexport const BUILD = '${stamp}';\n`);

for (const page of SKIN_PAGES) {
  const before = readFileSync(page, 'utf8');
  const after = before
    .replace(/(courseVersion: ")[^"]*(")/g, `$1${stamp}$2`)
    .replace(/(assets\/[\w.-]+\.(?:js|css)\?v=)[^"]*/g, `$1${stamp}`);
  if (!/courseVersion: "/.test(after)) throw new Error(`${page}: không thấy courseVersion để đóng dấu.`);
  if (after !== before) writeFileSync(page, after);
}

console.log('ban dung:', stamp);
