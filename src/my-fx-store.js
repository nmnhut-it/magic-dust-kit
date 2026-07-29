// my-fx-store.js — hiệu ứng video của học sinh, cất ngay trong trình duyệt.
//
// Máy trường thường không cho chép file vào thư mục dự án, mà `localStorage`
// thì quá nhỏ cho một clip mp4. Nên clip được cất trong IndexedDB: nó nhận cả
// Blob và chứa được vài chục MB, sống qua cả tắt máy.
//
// Học sinh chọn file, đặt tên, rồi gọi từ Python đúng cái tên đó:
//     play_effect("rong_lua")
const DB_NAME = 'magicdust-fx';
const STORE = 'clips';
const MAX_BYTES = 40 * 1024 * 1024;

function openDb() {
  return new Promise((done, fail) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'name' });
    request.onsuccess = () => done(request.result);
    request.onerror = () => fail(request.error);
  });
}

function run(db, mode, work) {
  return new Promise((done, fail) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    request.onsuccess = () => done(request.result);
    request.onerror = () => fail(request.error);
  });
}

export async function listClips() {
  try {
    const db = await openDb();
    return await run(db, 'readonly', store => store.getAll());
  } catch { return []; }
}

export async function saveClip(name, file) {
  if (file.size > MAX_BYTES) throw new Error(`file nặng ${Math.round(file.size / 1e6)}MB, quá ${MAX_BYTES / 1e6}MB`);
  const db = await openDb();
  await run(db, 'readwrite', store => store.put({ name, blob: file, type: file.type }));
}

export async function removeClip(name) {
  const db = await openDb();
  await run(db, 'readwrite', store => store.delete(name));
}

// Tên gọi từ Python phải là một định danh Python hợp lệ, nếu không
// play_effect("rồng lửa") sẽ chẳng khớp gì cả.
export function tidyName(raw) {
  return String(raw).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')     // bỏ dấu tiếng Việt
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}
