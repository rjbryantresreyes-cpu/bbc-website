"""Render the master Tools & Capabilities print doc to PDF via headless Chrome.
Serves the repo over http so /bbc-logo.png and web fonts resolve, then prints.
Run: python _tools/render-pdf.py
"""
import functools, http.server, socketserver, threading, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC = "/tools/downloads/bbc-tools-and-capabilities.print.html"
OUT = ROOT / "tools" / "downloads" / "bbc-tools-and-capabilities.pdf"
PORT = 8841

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page()
    page.goto(f"http://127.0.0.1:{PORT}{SRC}", wait_until="networkidle")
    page.pdf(path=str(OUT), format="Letter", print_background=True,
             margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    browser.close()

httpd.shutdown()
kb = OUT.stat().st_size / 1024
print(f"OK -> {OUT}  ({kb:.0f} KB)")
