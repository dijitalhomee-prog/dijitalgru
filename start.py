#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time
import sys
import os
import json
import base64
import subprocess

PORT = 8000
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/data'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            portfolio_data = []
            if os.path.exists('portfolio.json'):
                with open('portfolio.json', 'r', encoding='utf-8') as f:
                    try:
                        portfolio_data = json.load(f)
                    except Exception:
                        pass
                        
            blog_data = []
            if os.path.exists('blog.json'):
                with open('blog.json', 'r', encoding='utf-8') as f:
                    try:
                        blog_data = json.load(f)
                    except Exception:
                        pass
                        
            res = {"portfolio": portfolio_data, "blog": blog_data}
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path in ('/api/save-portfolio', '/api/delete-portfolio', '/api/save-blog', '/api/delete-blog'):
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                response_data = {"status": "success"}
                
                if self.path == '/api/save-portfolio':
                    response_data = self.handle_save_portfolio(payload)
                elif self.path == '/api/delete-portfolio':
                    response_data = self.handle_delete_portfolio(payload)
                elif self.path == '/api/save-blog':
                    response_data = self.handle_save_blog(payload)
                elif self.path == '/api/delete-blog':
                    response_data = self.handle_delete_blog(payload)
                    
                self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                err_res = {"status": "error", "message": str(e)}
                self.wfile.write(json.dumps(err_res, ensure_ascii=False).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def handle_save_portfolio(self, item):
        # 1. Process files
        pdf_path = item.get('pdfPath', '')
        image_path = item.get('image', '')
        
        added_files = []
        
        # Save PDF if provided in base64
        if 'pdfFile' in item and item['pdfFile']:
            pdf_data = item['pdfFile']
            pdf_filename = item['pdfFilename']
            if ',' in pdf_data:
                pdf_data = pdf_data.split(',')[1]
            pdf_bytes = base64.b64decode(pdf_data)
            
            # Save in correct category folder or default to tum-markalar/
            dest_dir = "tum-markalar"
            if item.get('category') == 'tech':
                dest_dir = "tum-markalar/yazilim-ve-web"
            elif item.get('category') == 'social':
                dest_dir = "tum-markalar/Sosyal Medya Yönetimi"
            elif item.get('category') == 'print':
                dest_dir = "tum-markalar/basili-ve-editoryal"
                
            os.makedirs(dest_dir, exist_ok=True)
            pdf_path = os.path.join(dest_dir, pdf_filename)
            with open(pdf_path, 'wb') as f:
                f.write(pdf_bytes)
            added_files.append(pdf_path)
            
        # Save Cover Image if provided in base64
        if 'imageFile' in item and item['imageFile']:
            img_data = item['imageFile']
            img_filename = item['imageFilename']
            if ',' in img_data:
                img_data = img_data.split(',')[1]
            img_bytes = base64.b64decode(img_data)
            
            dest_dir = "tum-markalar"
            os.makedirs(dest_dir, exist_ok=True)
            image_path = os.path.join(dest_dir, img_filename)
            with open(image_path, 'wb') as f:
                f.write(img_bytes)
            added_files.append(image_path)

        # 2. Update JSON database
        portfolio_data = []
        if os.path.exists('portfolio.json'):
            with open('portfolio.json', 'r', encoding='utf-8') as f:
                try:
                    portfolio_data = json.load(f)
                except Exception:
                    pass

        # Create clean brand object for JSON saving
        clean_item = {
            "id": item.get('id', 0),
            "title": item.get('title'),
            "client": item.get('client'),
            "category": item.get('category'),
            "catLabel": item.get('catLabel'),
            "desc": item.get('desc'),
            "icon": item.get('icon'),
            "gradient": item.get('gradient'),
            "metrics": item.get('metrics', []),
            "challenge": item.get('challenge')
        }
        if pdf_path:
            clean_item["pdfPath"] = pdf_path
        if image_path:
            clean_item["image"] = image_path

        git_action = "add"
        if clean_item["id"] > 0:
            # Edit existing
            idx = next((i for i, x in enumerate(portfolio_data) if x['id'] == clean_item['id']), -1)
            if idx != -1:
                portfolio_data[idx] = clean_item
                git_action = "update"
            else:
                clean_item["id"] = max([x['id'] for x in portfolio_data] + [0]) + 1
                portfolio_data.insert(0, clean_item)
        else:
            # Create new
            clean_item["id"] = max([x['id'] for x in portfolio_data] + [0]) + 1
            portfolio_data.insert(0, clean_item)

        with open('portfolio.json', 'w', encoding='utf-8') as f:
            json.dump(portfolio_data, f, ensure_ascii=False, indent=4)

        # 3. Auto-publish via Git
        git_status = self.run_git_flow(
            files_to_add=['portfolio.json'] + added_files,
            commit_message=f"feat: {git_action} brand {clean_item['title']} in portfolio"
        )
        
        return {
            "status": "success",
            "git": git_status,
            "item": clean_item
        }

    def handle_delete_portfolio(self, payload):
        item_id = payload.get('id')
        if not item_id:
            return {"status": "error", "message": "ID is required"}

        portfolio_data = []
        if os.path.exists('portfolio.json'):
            with open('portfolio.json', 'r', encoding='utf-8') as f:
                try:
                    portfolio_data = json.load(f)
                except Exception:
                    pass

        # Find target item
        target = next((x for x in portfolio_data if x['id'] == item_id), None)
        if not target:
            return {"status": "error", "message": "Item not found"}

        # Delete it
        portfolio_data = [x for x in portfolio_data if x['id'] != item_id]
        with open('portfolio.json', 'w', encoding='utf-8') as f:
            json.dump(portfolio_data, f, ensure_ascii=False, indent=4)

        # Git flow
        git_status = self.run_git_flow(
            files_to_add=['portfolio.json'],
            commit_message=f"feat: delete brand {target.get('title')} from portfolio"
        )

        return {"status": "success", "git": git_status}

    def handle_save_blog(self, post):
        added_files = []
        image_path = post.get('image', '')
        
        # Save Cover Image if provided in base64
        if 'imageFile' in post and post['imageFile']:
            img_data = post['imageFile']
            img_filename = post['imageFilename']
            if ',' in img_data:
                img_data = img_data.split(',')[1]
            img_bytes = base64.b64decode(img_data)
            
            image_path = img_filename
            with open(image_path, 'wb') as f:
                f.write(img_bytes)
            added_files.append(image_path)

        # Update JSON database
        blog_data = []
        if os.path.exists('blog.json'):
            with open('blog.json', 'r', encoding='utf-8') as f:
                try:
                    blog_data = json.load(f)
                except Exception:
                    pass

        clean_post = {
            "id": post.get('id', 0),
            "title": post.get('title'),
            "category": post.get('category'),
            "badge": post.get('badge'),
            "date": post.get('date'),
            "readTime": post.get('readTime'),
            "excerpt": post.get('excerpt'),
            "author": post.get('author', {}),
            "seo": post.get('seo', {}),
            "content": post.get('content')
        }
        if image_path:
            clean_post["image"] = image_path
            
        if post.get('imagePosition'):
            clean_post["imagePosition"] = post.get('imagePosition')

        git_action = "add"
        if clean_post["id"] > 0:
            idx = next((i for i, x in enumerate(blog_data) if x['id'] == clean_post['id']), -1)
            if idx != -1:
                blog_data[idx] = clean_post
                git_action = "update"
            else:
                clean_post["id"] = max([x['id'] for x in blog_data] + [0]) + 1
                blog_data.insert(0, clean_post)
        else:
            clean_post["id"] = max([x['id'] for x in blog_data] + [0]) + 1
            blog_data.insert(0, clean_post)

        with open('blog.json', 'w', encoding='utf-8') as f:
            json.dump(blog_data, f, ensure_ascii=False, indent=4)

        # Auto-publish
        git_status = self.run_git_flow(
            files_to_add=['blog.json'] + added_files,
            commit_message=f"feat: {git_action} blog post {clean_post['title']}"
        )

        return {
            "status": "success",
            "git": git_status,
            "item": clean_post
        }

    def handle_delete_blog(self, payload):
        post_id = payload.get('id')
        if not post_id:
            return {"status": "error", "message": "ID is required"}

        blog_data = []
        if os.path.exists('blog.json'):
            with open('blog.json', 'r', encoding='utf-8') as f:
                try:
                    blog_data = json.load(f)
                except Exception:
                    pass

        target = next((x for x in blog_data if x['id'] == post_id), None)
        if not target:
            return {"status": "error", "message": "Post not found"}

        blog_data = [x for x in blog_data if x['id'] != post_id]
        with open('blog.json', 'w', encoding='utf-8') as f:
            json.dump(blog_data, f, ensure_ascii=False, indent=4)

        # Git flow
        git_status = self.run_git_flow(
            files_to_add=['blog.json'],
            commit_message=f"feat: delete blog post {target.get('title')}"
        )

        return {"status": "success", "git": git_status}

    def run_git_flow(self, files_to_add, commit_message):
        try:
            # 1. Add files
            for file_path in files_to_add:
                if os.path.exists(file_path):
                    subprocess.run(["git", "add", file_path], check=True)
            
            # 2. Commit
            # Check if there are actual changes staged
            status_res = subprocess.run(["git", "diff", "--cached", "--quiet"])
            if status_res.returncode == 0:
                # No changes staged, skip commit & push
                return "no_changes"
                
            subprocess.run(["git", "commit", "-m", commit_message], check=True)
            
            # 3. Push in background so request doesn't hang too long
            # (But wait, we can run it synchronously with a short timeout to let the user know if it worked)
            res = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True, timeout=15)
            if res.returncode != 0:
                print("❌ Git push failed:", res.stderr)
                return "push_failed"
            return "success"
        except Exception as e:
            print("❌ Git flow failed:", e)
            return "local_saved_only"

def open_browser():
    time.sleep(1)  # Wait for server to start
    print(f"\n🌐 Web sitesi tarayıcıda açılıyor: http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}/admin.html")

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
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
