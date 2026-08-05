#!/usr/bin/env python3
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9811
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(os.path.join(path, "index.html")):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    with http.server.HTTPServer(("0.0.0.0", PORT), SPAHandler) as httpd:
        print(f"Serving frontend on port {PORT}")
        httpd.serve_forever()
