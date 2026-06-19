#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time
import sys

PORT = 8000
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser():
    time.sleep(1)  # Wait for server to start
    print(f"\n🌐 Web sitesi tarayıcıda açılıyor: http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}")

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 Dijital Gru Yerel Sunucusu http://localhost:{PORT} adresinde aktif.")
        print("🛑 Sunucuyu kapatmak için Terminal'de Ctrl+C tuşlarına basın.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Sunucu kapatıldı.")
            sys.exit(0)

if __name__ == "__main__":
    # Start browser thread
    threading.Thread(target=open_browser, daemon=True).start()
    # Start server
    run_server()
