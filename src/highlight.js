// highlight.js — tô màu Python đủ dùng, không kéo thư viện nào về.
//
// Cách làm: một <pre> đã tô màu nằm dưới, một <textarea> trong suốt nằm chồng
// lên trên, hai lớp cùng font và cùng cuộn. Học sinh gõ vào textarea (nên vẫn
// có con trỏ, bôi đen, undo, gõ tiếng Việt bình thường), còn màu là của <pre>.
const KEYWORDS = /\b(def|return|if|elif|else|for|while|in|and|or|not|import|from|continue|break|pass|None|True|False|range|len|min|max|abs|int|str|print)\b/g;
const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escapeHtml(text) {
  return text.replace(/[&<>]/g, ch => ESCAPE[ch]);
}

// Tô theo thứ tự: chuỗi và ghi chú trước (chúng nuốt mọi thứ bên trong), rồi
// mới tới số và từ khoá trên phần còn lại.
export function paintPython(source) {
  const pieces = [];
  const pattern = /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*'|#[^\n]*)/g;
  let last = 0, match;
  while ((match = pattern.exec(source)) !== null) {
    pieces.push(paintCode(source.slice(last, match.index)));
    const cls = match[0].startsWith('#') ? 'c' : 's';
    pieces.push(`<span class="py-${cls}">${escapeHtml(match[0])}</span>`);
    last = match.index + match[0].length;
  }
  pieces.push(paintCode(source.slice(last)));
  return pieces.join('');
}

function paintCode(text) {
  return escapeHtml(text)
    .replace(/\b(\d+)\b/g, '<span class="py-n">$1</span>')
    .replace(KEYWORDS, '<span class="py-k">$1</span>');
}

export function mountCodeBox(host, source) {
  host.innerHTML = '<pre class="cb-paint" aria-hidden="true"></pre><textarea class="cb-input" spellcheck="false"></textarea>';
  const paint = host.querySelector('.cb-paint');
  const input = host.querySelector('.cb-input');
  input.value = source;

  const repaint = () => {
    // Dòng cuối trống sẽ bị <pre> nuốt mất, thêm một khoảng trắng cho chắc.
    paint.innerHTML = paintPython(input.value) + ' ';
    grow();
  };
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.max(input.scrollHeight, 60)}px`;
    paint.style.height = input.style.height;
  };

  input.addEventListener('input', repaint);
  input.addEventListener('scroll', () => { paint.scrollTop = input.scrollTop; });
  // Tab phải là bốn dấu cách, không phải nhảy sang nút kế bên — đây là ô code.
  input.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const { selectionStart: a, selectionEnd: b, value } = input;
    input.value = `${value.slice(0, a)}    ${value.slice(b)}`;
    input.selectionStart = input.selectionEnd = a + 4;
    repaint();
  });

  repaint();
  return {
    get value() { return input.value; },
    set value(text) { input.value = text; repaint(); },
    focus: () => input.focus(),
  };
}
