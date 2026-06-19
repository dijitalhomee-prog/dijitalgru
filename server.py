import http.server
import json
import base64
import os

class LogoUploadHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/save-logo':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
                filename = payload['filename']
                data_url = payload['data']
                
                # Extract base64 part
                if ',' in data_url:
                    base64_data = data_url.split(',')[1]
                else:
                    base64_data = data_url
                    
                image_bytes = base64.b64decode(base64_data)
                
                dest_dir = "/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images"
                os.makedirs(dest_dir, exist_ok=True)
                dest_path = os.path.join(dest_dir, filename)
                
                with open(dest_path, 'wb') as f:
                    f.write(image_bytes)
                    
                print(f"Saved {filename} to {dest_path}")
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "path": dest_path}).encode('utf-8'))
            except Exception as e:
                print(f"Error saving logo: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', 8000), LogoUploadHandler)
    print("Server starting on http://127.0.0.1:8000...")
    server.serve_forever()
