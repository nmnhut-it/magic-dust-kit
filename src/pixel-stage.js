// pixel-stage.js — chỗ ba hàm trong my-image-spells.js được đem ra dùng thật.
//
// Nó lấy từng khung hình từ camera, thu nhỏ lại cho máy chạy kịp, đưa dải số
// cho hàm của học sinh, rồi vẽ kết quả đè lên camera. Đây là file của MÁY —
// học sinh không cần sửa gì ở đây, nhưng đọc được thì càng tốt: nó chỉ có
// getImageData → gọi hàm của bạn → putImageData.
//
// Phím: F lật · B mờ · N chồng lớp · X tắt · T tự chấm
import { blend, blur, flip, CHECKS } from './my-image-spells.js';

const W = 320, H = 240;              // đủ nhỏ để chạy 30 hình/giây trên máy trường
const PLATE = './lessons/assets/camera-effects/plates/fx-dragon.webp';
const MODES = { f: 'flip', b: 'blur', n: 'blend' };

export function mountPixelStage(video) {
  const stage = document.createElement('canvas');
  stage.className = 'pixel-stage';
  stage.width = W; stage.height = H;
  Object.assign(stage.style, {
    position: 'fixed', right: '14px', bottom: '14px', width: '320px', height: '240px',
    borderRadius: '12px', border: '1px solid rgba(120,178,165,.5)', zIndex: 40,
    display: 'none', background: '#0b0f18', boxShadow: '0 8px 30px rgba(0,0,0,.45)',
  });
  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed', right: '14px', bottom: '258px', zIndex: 41, display: 'none',
    font: '700 12px/1.4 ui-monospace,Menlo,monospace', letterSpacing: '.8px',
    color: '#eaf4ff', background: 'rgba(11,15,24,.82)', padding: '6px 10px', borderRadius: '8px',
    maxWidth: '320px', whiteSpace: 'pre-wrap',
  });
  document.body.append(stage, label);

  const ctx = stage.getContext('2d', { willReadFrequently: true });
  const grab = document.createElement('canvas'); grab.width = W; grab.height = H;
  const grabCtx = grab.getContext('2d', { willReadFrequently: true });
  const say = text => { label.style.display = 'block'; label.textContent = text; };

  // Lớp hiệu ứng cho phép chồng: đọc một lần, giữ lại dùng mãi.
  let layer = null;
  const plate = new Image();
  plate.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(plate, 0, 0, W, H);
    layer = cx.getImageData(0, 0, W, H).data;
  };
  plate.src = PLATE;

  let mode = null, broken = null;
  const run = () => {
    requestAnimationFrame(run);
    if (!mode || !video || !video.videoWidth) return;
    grabCtx.drawImage(video, 0, 0, W, H);
    const src = grabCtx.getImageData(0, 0, W, H);
    const out = ctx.createImageData(W, H);
    for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;   // đục hết, khỏi trong suốt
    try {
      if (mode === 'flip') flip(src.data, out.data, W, H);
      else if (mode === 'blur') blur(src.data, out.data, W, H);
      else if (!layer) { say('Đang tải lớp hiệu ứng…'); return; }
      else blend(src.data, layer, out.data, W, H);
      if (broken) { broken = null; say(`${mode.toUpperCase()} · đang chạy`); }
    } catch (err) {
      // Một hàm chưa viết không được phép làm treo cả trang: dừng chế độ đó,
      // nói đúng tên hàm còn thiếu, và để mọi thứ khác chạy tiếp.
      broken = mode; mode = null; stage.style.display = 'none';
      say(`✖ ${String(err.message || err)}`);
      return;
    }
    ctx.putImageData(out, 0, 0);
  };
  requestAnimationFrame(run);

  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'x') { mode = null; stage.style.display = 'none'; say('Đã tắt phép xử lý ảnh'); return; }
    if (key === 't') { say(selfCheck()); return; }
    const picked = MODES[key];
    if (!picked) return;
    mode = picked; stage.style.display = 'block';
    say(`${picked.toUpperCase()} · đang chạy`);
  });
}

function selfCheck() {
  const lines = CHECKS.map(check => {
    let verdict;
    try { verdict = check.run(); } catch (err) { verdict = String(err.message || err); }
    return verdict ? `✖ ${check.name}: ${verdict}` : `✓ ${check.name}`;
  });
  return lines.join('\n');
}
