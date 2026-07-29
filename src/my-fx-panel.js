// my-fx-panel.js — khung "hiệu ứng của bạn" trên sân khấu.
//
// Chọn một file .mp4 quay trên NỀN ĐEN, đặt tên, xong gọi từ Python:
//     play_effect("ten_ban_dat")
// Không cần chép file vào thư mục nào, không cần sửa my-spells.js.
import { listClips, saveClip, removeClip, tidyName } from './my-fx-store.js?v=3';

export async function mountFxPanel({ register, say }) {
  const ui = build();
  const urls = new Map();

  async function refresh() {
    const clips = await listClips();
    ui.list.textContent = '';
    for (const clip of clips) {
      if (!urls.has(clip.name)) {
        const url = URL.createObjectURL(clip.blob);
        urls.set(clip.name, url);
        register(clip.name, url);
      }
      ui.list.appendChild(row(clip.name));
    }
    ui.empty.style.display = clips.length ? 'none' : 'block';
  }

  function row(name) {
    const el = document.createElement('div');
    el.className = 'fx-row';
    const label = document.createElement('code');
    label.textContent = `play_effect("${name}")`;
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'xoá hiệu ứng này';
    del.onclick = async () => { await removeClip(name); urls.delete(name); refresh(); say(`Đã xoá ${name}.`); };
    el.append(label, del);
    return el;
  }

  ui.file.onchange = async () => {
    const file = ui.file.files?.[0];
    ui.file.value = '';
    if (!file) return;
    const name = tidyName(ui.name.value || file.name.replace(/\.[^.]+$/, ''));
    if (!name) { say('Đặt cho nó một cái tên bằng chữ thường không dấu nhé.', true); return; }
    try {
      await saveClip(name, file);
      ui.name.value = '';
      await refresh();
      say(`Xong. Gọi nó bằng play_effect("${name}") — nhớ video phải quay trên nền đen.`);
    } catch (err) { say(`Không cất được: ${err.message}`, true); }
  };
  ui.toggle.onclick = () => {
    const open = ui.panel.classList.toggle('open');
    ui.toggle.textContent = open ? '✕ ĐÓNG' : '＋ HIỆU ỨNG CỦA BẠN';
  };

  await refresh();
}

function build() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button class="fx-toggle">＋ HIỆU ỨNG CỦA BẠN</button>
    <section class="fx-panel">
      <p class="fx-help">Chọn một video <b>.mp4 quay trên nền đen</b>, đặt tên, rồi gọi
      nó từ Python. Chỗ đen của video cộng vào 0 nên nền tự biến mất — nền sáng sẽ
      làm trắng cả khung hình.</p>
      <div class="fx-add">
        <input class="fx-name" placeholder="tên, ví dụ rong_lua" maxlength="24">
        <label class="fx-pick">⭑ CHỌN FILE<input type="file" accept="video/*" hidden></label>
      </div>
      <div class="fx-list"></div>
      <p class="fx-empty">Chưa có hiệu ứng nào của bạn.</p>
    </section>`;
  document.body.appendChild(wrap);
  const q = sel => wrap.querySelector(sel);
  return { panel: q('.fx-panel'), toggle: q('.fx-toggle'), name: q('.fx-name'),
           file: q('.fx-pick input'), list: q('.fx-list'), empty: q('.fx-empty') };
}
