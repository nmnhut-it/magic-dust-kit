# Skin Lab

Skin Lab là bài học xử lý ảnh chạy hoàn toàn trong trình duyệt tại `/skin-lab/`.
Năm hàm bắt buộc dùng Python thuần; phần NumPy ở cuối là phần mở rộng ngắn.

Nguồn chuẩn:

- `build_notebooks.py`: nội dung và thứ tự các ô notebook.
- `skin_filters.py`: code bài tập.
- `skin_filters_solution.py`: code đáp án.
- `assets/magic_mirror.py`: minh hoạ, dữ liệu ảnh tổng hợp và bộ chấm.
- `assets/notebook.js`: giao diện notebook và autosave bằng `localStorage`.

Sau khi sửa nguồn, sinh lại notebook và kiểm tra:

```powershell
python build_notebooks.py
python -m unittest test_skin_project.py test_skin_notebook.py test_teaching_helpers.py
node --check assets/notebook.js
node test-skin-browser.mjs
```

Autosave chỉ lưu code, tiến độ và vị trí ô đang học trên đúng trình duyệt của
thiết bị hiện tại. Ảnh camera không được ghi vào `localStorage`. Học sinh có thể
bấm nút tải notebook nếu muốn mang bài sang thiết bị khác.
