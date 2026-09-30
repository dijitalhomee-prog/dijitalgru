import http.server
import socketserver
import json
import os
import smtplib
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

PORT = int(os.environ.get("PORT", 8000))

class DijitalGruHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path in ['/api/contact', '/submit-contact', '/api/contact/']:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            # Parse payload (JSON or Form URLencoded)
            data = {}
            try:
                content_type = self.headers.get('Content-Type', '')
                if 'application/json' in content_type:
                    data = json.loads(post_data)
                else:
                    parsed = urllib.parse.parse_qs(post_data)
                    data = {k: v[0] for k, v in parsed.items()}
            except Exception as e:
                print("Error parsing contact payload:", e)

            name = data.get('name', 'İsimsiz').strip()
            email = data.get('email', 'E-posta yok').strip()
            subject = data.get('subject_title', data.get('subject', 'Proje Talebi')).strip()
            message = data.get('message', '').strip()

            # 1. Store lead in leads.json for 100% data preservation
            lead_entry = {
                "id": int(datetime.utcnow().timestamp()),
                "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "name": name,
                "email": email,
                "subject": subject,
                "message": message,
                "user_agent": self.headers.get('User-Agent', '')
            }

            try:
                leads_file = os.path.join(os.path.dirname(__file__), "leads.json")
                leads = []
                if os.path.exists(leads_file):
                    with open(leads_file, "r", encoding="utf-8") as f:
                        leads = json.load(f)
                leads.insert(0, lead_entry)  # newest first
                with open(leads_file, "w", encoding="utf-8") as f:
                    json.dump(leads, f, ensure_ascii=False, indent=2)
                print(f"[LEAD SAVED] {name} ({email}) - {subject}")
            except Exception as ex:
                print("Error saving lead:", ex)

            # 2. Try SMTP Email Delivery (Gmail or custom SMTP if configured)
            smtp_user = os.environ.get("SMTP_USER", os.environ.get("GMAIL_USER", "dijitalgru@gmail.com"))
            smtp_pass = os.environ.get("SMTP_PASS", os.environ.get("GMAIL_APP_PASSWORD", ""))
            
            if smtp_pass:
                try:
                    msg = MIMEMultipart()
                    msg['From'] = f"Dijital Gru Web <{smtp_user}>"
                    msg['To'] = "dijitalgru@gmail.com"
                    msg['Subject'] = f" Dijital Gru Web İletişim: {subject}"
                    
                    body = f"""Dijital Gru Web Sitesinden Yeni İletişim Mesajı!

📌 Ad Soyad: {name}
✉️ E-posta: {email}
📋 Konu: {subject}
⏰ Tarih: {lead_entry['date']}

💬 MESAJ:
----------------------------------------
{message}
----------------------------------------
"""
                    msg.attach(MIMEText(body, 'plain', 'utf-8'))
                    
                    with smtplib.SMTP("smtp.gmail.com", 587) as server:
                        server.starttls()
                        server.login(smtp_user, smtp_pass)
                        server.sendmail(smtp_user, ["dijitalgru@gmail.com"], msg.as_string())
                    print("[SMTP SUCCESS] Email sent to dijitalgru@gmail.com")
                except Exception as smtp_err:
                    print("SMTP Email sending failed:", smtp_err)

            # 3. Try Telegram Bot notification if token set
            tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
            tg_chat = os.environ.get("TELEGRAM_CHAT_ID")
            if tg_token and tg_chat:
                try:
                    tg_text = f"🚀 *Dijital Gru Yeni İletişim Formu*\n\n👤 *Ad:* {name}\n📧 *E-posta:* {email}\n📌 *Konu:* {subject}\n\n💬 *Mesaj:*\n{message}"
                    url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
                    payload = json.dumps({"chat_id": tg_chat, "text": tg_text, "parse_mode": "Markdown"}).encode('utf-8')
                    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
                    urllib.request.urlopen(req, timeout=5)
                    print("[TELEGRAM SUCCESS] Notification sent to Telegram")
                except Exception as tg_err:
                    print("Telegram notification failed:", tg_err)

            # Return JSON response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            resp = {"success": True, "message": "Mesajınız başarıyla iletildi."}
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        # Serve static files as usual
        return super().do_POST()

    def do_GET(self):
        # Protected leads view endpoint
        if self.path == '/api/leads':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            leads_file = os.path.join(os.path.dirname(__file__), "leads.json")
            if os.path.exists(leads_file):
                with open(leads_file, "r", encoding="utf-8") as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b"[]")
            return
            
        return super().do_GET()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), DijitalGruHandler) as httpd:
        print(f"Dijital Gru Server listening on port {PORT}...")
        httpd.serve_forever()
