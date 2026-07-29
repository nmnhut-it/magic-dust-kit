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


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
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
