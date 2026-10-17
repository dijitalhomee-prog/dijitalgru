import http.server
import socketserver
import json
import os
import re
import smtplib
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

PORT = int(os.environ.get("PORT", 8000))

SITE_URL = "https://dijitalgru.com"
WHATSAPP_URL = "https://wa.me/905376274415"

# --- Ortam degiskenleri (Railway > Variables) -------------------------------
#   RESEND_API_KEY   : Resend API anahtari (zorunlu, ya da asagidaki SMTP_PASS)
#   CONTACT_TO       : Bildirimlerin gidecegi adres (varsayilan dijitalgru@gmail.com)
#   CONTACT_FROM     : Gonderen adresi, orn. "Dijital Gru <iletisim@dijitalgru.com>"
#                      (dogrulanmis alan adi gerekir; yoksa onboarding@resend.dev kullanilir)
#   SMTP_USER / SMTP_PASS (veya GMAIL_USER / GMAIL_APP_PASSWORD): Resend yoksa Gmail SMTP yedegi
#   LEADS_TOKEN      : /api/leads?token=... goruntuleme anahtari (tanimli degilse endpoint kapali)
#   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID : istege bagli ek bildirim

ALLOWED_SUBJECTS = ["Proje Teklifi", "Mevcut Proje", "İş Başvurusu", "Diğer"]
EMAIL_RE = re.compile(r"^[^@\s<>\"',;]+@[^@\s<>\"',;]+\.[^@\s<>\"',;]{2,}$")
TR_TZ = timezone(timedelta(hours=3))

RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 600  # saniye
_rate = {}
_rate_lock = threading.Lock()


def clean_line(value, limit):
    """Tek satirlik alanlar: satir sonlarini ve kontrol karakterlerini temizle (header injection korumasi)."""
    value = re.sub(r"[\r\n\t]+", " ", str(value or ""))
    value = re.sub(r"[\x00-\x1f\x7f]", "", value)
    return value.strip()[:limit]


def clean_text(value, limit):
    value = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)
    return value.strip()[:limit]


def rate_limited(ip):
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate.get(ip, []) if now - t < RATE_LIMIT_WINDOW]
        if len(hits) >= RATE_LIMIT_MAX:
            _rate[ip] = hits
            return True
        hits.append(now)
        _rate[ip] = hits
        return False


# --- E-posta sablonlari -------------------------------------------------------

def owner_email(name, email, subject, message, date_str):
    rows = [
        ("Ad Soyad", escape(name)),
        ("E-posta", '<a href="mailto:%s" style="color:#1a56db;">%s</a>' % (escape(email, quote=True), escape(email))),
        ("Konu", escape(subject)),
        ("Tarih", escape(date_str)),
    ]
    cells = "".join(
        '<tr><td style="padding:10px 12px;border:1px solid #e5e5e5;background:#f7f7f7;width:120px;font-weight:bold;">%s</td>'
        '<td style="padding:10px 12px;border:1px solid #e5e5e5;">%s</td></tr>' % (k, v) for k, v in rows)
    cells += (
        '<tr><td style="padding:10px 12px;border:1px solid #e5e5e5;background:#f7f7f7;font-weight:bold;vertical-align:top;">Mesaj</td>'
        '<td style="padding:10px 12px;border:1px solid #e5e5e5;white-space:pre-wrap;line-height:1.6;">%s</td></tr>' % escape(message))
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#1a1a1a;">'
        '<h2 style="font-size:18px;margin:0 0 16px;">Web sitesinden yeni mesaj</h2>'
        '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%%;border-collapse:collapse;font-size:14px;">%s</table>'
        '<p style="font-size:12px;color:#777;margin-top:16px;">Yanıtlamak için bu e-postayı doğrudan yanıtlayın, yanıt gönderenin adresine gider.</p>'
        '</div>' % cells)
    text = "Web sitesinden yeni mesaj\n\nAd Soyad: %s\nE-posta: %s\nKonu: %s\nTarih: %s\n\nMesaj:\n%s\n" % (
        name, email, subject, date_str, message)
    return "[Dijital Gru] %s — %s" % (subject, name), html, text


def _auto_reply_shell(inner_html):
    return (
        '<div style="background:#f3efe8;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">'
        '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%%;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">'
        '<tr><td style="background:#0c1330;padding:26px 32px;">'
        '<span style="font-size:22px;font-weight:bold;letter-spacing:.5px;color:#dca963;">Dijital Gru</span>'
        '<span style="font-size:12px;color:#c9c4b8;margin-left:10px;">Web Tasarım &amp; Marka Stüdyosu</span>'
        '</td></tr>'
        '<tr><td style="padding:32px;color:#1d2340;font-size:15px;line-height:1.7;">%s</td></tr>'
        '<tr><td style="padding:18px 32px;background:#faf7f1;color:#8a8576;font-size:12px;line-height:1.6;">'
        'Dijital Gru · İstanbul<br>'
        '<a href="%s" style="color:#8a8576;">dijitalgru.com</a> · +90 537 627 44 15'
        '</td></tr></table></div>' % (inner_html, SITE_URL))


def auto_reply_email(name, subject):
    first = escape(name.split()[0]) if name.split() else ""
    if subject == "İş Başvurusu":
        inner = (
            '<p style="margin:0 0 14px;">Merhaba %s,</p>'
            '<p style="margin:0 0 14px;">İlginiz için teşekkür ederiz. İş başvuruları bu iletişim formu üzerinden değerlendirilmediği için '
            'lütfen kariyer sayfamızı ziyaret edin ve portfolyonuzu oradaki adrese gönderin.</p>'
            '<p style="margin:24px 0;"><a href="%s/kariyer.html" style="display:inline-block;background:#dca963;color:#0c1330;'
            'text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:10px;">Kariyer Sayfası</a></p>'
            '<p style="margin:0;color:#5b6180;font-size:13px;">Proje teklifi için yazmak isterseniz formu yeniden “Proje Teklifi” konusuyla doldurabilirsiniz.</p>'
        ) % (first, SITE_URL)
        text = ("Merhaba %s,\n\nİlginiz için teşekkür ederiz. İş başvuruları bu form üzerinden değerlendirilmediği için "
                "lütfen kariyer sayfamızı ziyaret edin: %s/kariyer.html\n\nDijital Gru\n") % (name, SITE_URL)
    else:
        inner = (
            '<p style="margin:0 0 14px;">Merhaba %s,</p>'
            '<p style="margin:0 0 14px;"><strong>Talebiniz bize ulaştı.</strong> Projenizi inceleyip en geç 24 saat içinde size döneceğiz.</p>'
            '<p style="margin:0 0 14px;">Daha hızlı konuşmak isterseniz bize WhatsApp\'tan da yazabilirsiniz.</p>'
            '<p style="margin:24px 0;"><a href="%s" style="display:inline-block;background:#25d366;color:#ffffff;'
            'text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:10px;">WhatsApp\'tan Yazın</a></p>'
            '<p style="margin:0;color:#5b6180;font-size:13px;">Konu: %s</p>'
        ) % (first, WHATSAPP_URL, escape(subject))
        text = ("Merhaba %s,\n\nTalebiniz bize ulaştı. Projenizi inceleyip en geç 24 saat içinde size döneceğiz.\n"
                "Daha hızlı konuşmak isterseniz WhatsApp'tan yazabilirsiniz: %s\n\nDijital Gru\n") % (name, WHATSAPP_URL)
    return "Talebiniz bize ulaştı — Dijital Gru", _auto_reply_shell(inner), text


# --- Gonderim: Resend (tercih) / Gmail SMTP (yedek) --------------------------

def send_via_resend(api_key, sender, to, subject, html, text, reply_to=None):
    payload = {"from": sender, "to": [to], "subject": subject, "html": html, "text": text}
    if reply_to:
        payload["reply_to"] = reply_to
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
            "User-Agent": "dijitalgru-server/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        resp.read()


def send_via_smtp(user, password, sender_name, to, subject, html, text, reply_to=None):
    msg = MIMEMultipart("alternative")
    msg["From"] = "%s <%s>" % (sender_name, user)
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=12) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(user, [to], msg.as_string())


def mail_provider():
    """('resend', cfg) | ('smtp', cfg) | (None, None)"""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if api_key:
        return "resend", {
            "api_key": api_key,
            "from": os.environ.get("CONTACT_FROM", "").strip() or "Dijital Gru <onboarding@resend.dev>",
        }
    smtp_user = os.environ.get("SMTP_USER", os.environ.get("GMAIL_USER", "dijitalgru@gmail.com"))
    smtp_pass = os.environ.get("SMTP_PASS", os.environ.get("GMAIL_APP_PASSWORD", ""))
    if smtp_pass:
        return "smtp", {"user": smtp_user, "password": smtp_pass}
    return None, None


def send_mail(to, subject, html, text, reply_to=None):
    kind, cfg = mail_provider()
    if kind == "resend":
        send_via_resend(cfg["api_key"], cfg["from"], to, subject, html, text, reply_to)
    elif kind == "smtp":
        send_via_smtp(cfg["user"], cfg["password"], "Dijital Gru", to, subject, html, text, reply_to)
    else:
        raise RuntimeError("E-posta saglayicisi tanimli degil (RESEND_API_KEY veya SMTP_PASS)")


# --- HTTP sunucusu ---------------------------------------------------------------

class DijitalGruHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # HTML sayfalari kisa sure onbelleklensin; icerik guncellemeleri hizli yansisin
        p = self.path.split('?', 1)[0]
        if p == '/' or p.endswith('.html'):
            self.send_header('Cache-Control', 'public, max-age=300')
        super().end_headers()

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _client_ip(self):
        fwd = self.headers.get('X-Forwarded-For', '')
        return (fwd.split(',')[0].strip() if fwd else self.client_address[0]) or 'unknown'

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Allow', 'GET, POST, OPTIONS')
        self.end_headers()

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        if path in ('/api/contact', '/submit-contact'):
            return self.handle_contact()
        return self._json(404, {"success": False, "error": "Not Found"})

    def handle_contact(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            length = 0
        if length <= 0 or length > 20000:
            return self._json(413 if length > 20000 else 400, {"success": False, "error": "Geçersiz istek."})

        raw = self.rfile.read(length).decode('utf-8', errors='replace')
        try:
            if 'application/json' in self.headers.get('Content-Type', ''):
                data = json.loads(raw)
            else:
                from urllib.parse import parse_qs
                data = {k: v[0] for k, v in parse_qs(raw).items()}
            if not isinstance(data, dict):
                raise ValueError("payload")
        except Exception:
            return self._json(400, {"success": False, "error": "Geçersiz istek."})

        # Honeypot: botlar gizli alani doldurur. Sessizce basarili gibi davran, hicbir sey gonderme.
        if str(data.get('website', '')).strip():
            print("[SPAM] honeypot dolu, istek yoksayildi")
            return self._json(200, {"success": True})

        if rate_limited(self._client_ip()):
            return self._json(429, {"success": False, "error": "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin."})

        name = clean_line(data.get('name'), 100)
        email = clean_line(data.get('email'), 254)
        subject = clean_line(data.get('subject_title', data.get('subject')), 60)
        message = clean_text(data.get('message'), 5000)

        if len(name) < 2:
            return self._json(400, {"success": False, "error": "Lütfen adınızı girin."})
        if not EMAIL_RE.match(email):
            return self._json(400, {"success": False, "error": "Lütfen geçerli bir e-posta adresi girin."})
        if len(message) < 5:
            return self._json(400, {"success": False, "error": "Lütfen mesajınızı yazın."})
        if subject not in ALLOWED_SUBJECTS:
            subject = "Diğer"

        date_str = datetime.now(TR_TZ).strftime("%d.%m.%Y %H:%M")

        # Yedek: lead kaydi (Railway disk kalici degildir; asil kayit e-postadir)
        try:
            leads_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leads.json")
            leads = []
            if os.path.exists(leads_file):
                with open(leads_file, "r", encoding="utf-8") as f:
                    leads = json.load(f)
            leads.insert(0, {
                "id": int(time.time()), "date": date_str, "name": name, "email": email,
                "subject": subject, "message": message,
            })
            with open(leads_file, "w", encoding="utf-8") as f:
                json.dump(leads[:500], f, ensure_ascii=False, indent=2)
        except Exception as ex:
            print("Lead kaydedilemedi:", ex)

        # 1) Bize gelen bildirim (kritik)
        to_addr = os.environ.get("CONTACT_TO", "dijitalgru@gmail.com").strip() or "dijitalgru@gmail.com"
        owner_sent = False
        try:
            subj, html, text = owner_email(name, email, subject, message, date_str)
            send_mail(to_addr, subj, html, text, reply_to=email)
            owner_sent = True
            print("[MAIL] Bildirim gonderildi:", name, "-", subject)
        except urllib.error.HTTPError as e:
            print("[MAIL ERROR] Bildirim gonderilemedi: HTTP", e.code, e.read()[:300])
        except Exception as e:
            print("[MAIL ERROR] Bildirim gonderilemedi:", e)

        # Istege bagli Telegram bildirimi
        tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        tg_chat = os.environ.get("TELEGRAM_CHAT_ID")
        tg_sent = False
        if tg_token and tg_chat:
            try:
                tg_text = "Dijital Gru yeni form\n\nAd: %s\nE-posta: %s\nKonu: %s\n\n%s" % (name, email, subject, message)
                payload = json.dumps({"chat_id": tg_chat, "text": tg_text}).encode('utf-8')
                req = urllib.request.Request(
                    "https://api.telegram.org/bot%s/sendMessage" % tg_token, data=payload,
                    headers={'Content-Type': 'application/json'})
                urllib.request.urlopen(req, timeout=5)
                tg_sent = True
            except Exception as e:
                print("Telegram bildirimi basarisiz:", e)

        if not (owner_sent or tg_sent):
            return self._json(502, {"success": False, "error": "Mesaj şu an gönderilemedi."})

        # 2) Gonderene otomatik yanit (basarisiz olsa da istek basarili sayilir)
        if owner_sent:
            try:
                subj, html, text = auto_reply_email(name, subject)
                send_mail(email, subj, html, text, reply_to=to_addr)
            except urllib.error.HTTPError as e:
                print("[MAIL WARN] Otomatik yanit gonderilemedi: HTTP", e.code, e.read()[:300])
            except Exception as e:
                print("[MAIL WARN] Otomatik yanit gonderilemedi:", e)

        return self._json(200, {"success": True})

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        # Lead listesi yalnizca LEADS_TOKEN tanimliysa ve dogru anahtar verilirse acilir
        if path == '/api/leads':
            from urllib.parse import urlparse, parse_qs
            token = os.environ.get("LEADS_TOKEN", "")
            given = parse_qs(urlparse(self.path).query).get("token", [""])[0]
            if not token or given != token:
                return self._json(404, {"error": "Not Found"})
            leads_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leads.json")
            data = []
            if os.path.exists(leads_file):
                with open(leads_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            return self._json(200, data)

        # Sunucu kodu ve kisisel veriler dogrudan indirilemesin
        if path in ('/server.py', '/leads.json', '/build_site.py'):
            return self._json(404, {"error": "Not Found"})

        return super().do_GET()


class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadedServer(("", PORT), DijitalGruHandler) as httpd:
        print("Dijital Gru Server listening on port %s..." % PORT)
        httpd.serve_forever()
