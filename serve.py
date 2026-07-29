#!/usr/bin/env python3
"""Máy chủ tĩnh có gửi kèm hai dòng tiêu đề cross-origin isolation.

Đảo GƯƠNG VÔ CỰC chạy Python bằng Pyodide trong một Web Worker, và nó cần
SharedArrayBuffer để lệnh `input()` của học sinh biết dừng lại chờ. Trình duyệt
chỉ cho dùng SharedArrayBuffer khi trang được "cross-origin isolated", tức là
phải có đúng hai tiêu đề bên dưới — `python -m http.server` KHÔNG gửi chúng,
Live Server của VS Code cũng không.

    python serve.py           # http://localhost:8123
    python serve.py 9000      # đổi cổng

Đồ chơi ở trang chủ (index.html) thì không cần hai tiêu đề này, nhưng cứ chạy
chung một máy chủ cho tiện. Camera chỉ hoạt động ở localhost hoặc HTTPS.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


def safe_print(line):
    """In một dòng chấm bài.

    Console Windows mặc định còn dùng bảng mã cũ, in tiếng Việt ra ký tự lạ.
    `CHAY.bat` đã bật sẵn UTF-8 (chcp 65001) và `main()` đổi luôn stdout sang
    UTF-8; đây chỉ là lưới an toàn cuối cùng cho máy nào vẫn không chịu.
    """
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.replace("✓", "OK").replace("✖", "!!").encode("ascii", "ignore").decode())


def grade_student_files():
    """Chấm `student/` ngay khi bật máy chủ, để học sinh thấy mình còn thiếu gì."""
    try:
        import cham
        lines, wrong = cham.check()
    except Exception as err:                     # chấm hỏng thì vẫn phải mở được trang
        print(f"(khong cham duoc bai: {type(err).__name__}: {err})")
        return
    safe_print("")
    safe_print("Bai trong student/ :")
    for line in lines:
        safe_print(line)
    if wrong:
        safe_print(f"  => con {wrong} cho chua xong."
                   " Sua file trong student/ roi bam R va T ngay trong trang.")
    else:
        safe_print("  => XONG HET BAI.")
    safe_print("")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")     # để bảng chấm bài đọc được tiếng Việt
    except Exception:
        pass
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    grade_student_files()
    server = ThreadingHTTPServer(("", port), partial(Handler, directory="."))
    print(f"Magic Dust chay o http://localhost:{port}")
    print(f"  do choi  -> http://localhost:{port}/index.html")
    print(f"  dao guong -> http://localhost:{port}/lessons/islandFXFORGE.html")
    print("Ctrl+C de dung.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("da dung")


if __name__ == "__main__":
    main()
