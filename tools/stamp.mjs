// Đóng dấu bản dựng: ghi cùng một con số vào build.txt (trang tải về để so) và
// vào src/build.js (nằm sẵn trong mã trang). Hai chỗ lệch nhau nghĩa là máy
// đang giữ bản cũ — trang tự nạp lại.
//
//     node tools/stamp.mjs        chạy trước mỗi lần deploy
import { writeFileSync } from 'node:fs';

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
writeFileSync('build.txt', stamp + '\n');
writeFileSync('src/build.js', `// Máy sinh ra, đừng sửa tay — xem tools/stamp.mjs\nexport const BUILD = '${stamp}';\n`);
console.log('ban dung:', stamp);
