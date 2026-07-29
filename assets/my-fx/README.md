# Bỏ hiệu ứng của bạn vào đây

Một file `.mp4` hoặc `.webm`, **quay trên nền đen**. Máy cộng ánh sáng của video
vào khung hình, nên chỗ đen tự biến mất — đúng phép `min(255, nền + lớp)` bạn
viết ở đảo Gương Vô Cực.

Khai báo một dòng trong `src/my-spells.js`:

```js
export const MY_FX = {
  cuatoi: { n: 'Hiệu Ứng Của Tôi', file: './assets/my-fx/cua-toi.mp4', hotkey: 'v' },
};
```

Xong. Bấm `v` là chạy. Chỗ tìm video miễn phí: Pexels, Pixabay, Mixkit —
gõ "particles black background", "smoke black background".
