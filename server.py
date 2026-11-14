import hashlib
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
#   META_CAPI_TOKEN  : Meta Conversions API erisim anahtari (yoksa sunucu tarafi Lead gonderimi kapali)
#   META_PIXEL_ID    : Pixel kimligi (varsayilan 876755502162549)
#   META_TEST_EVENT_CODE : Events Manager > Test Events kodu (yalnizca test icin)

ALLOWED_SUBJECTS = ["Proje Teklifi", "Mevcut Proje", "İş Başvurusu", "Diğer"]
LEAD_SECTORS = ["Restoran / Kafe", "Beach club / Gece kulübü", "Otel", "Mimarlık", "Diğer"]
LEAD_ROLES = ["İşletme sahibi", "Yönetici / Pazarlama", "Mimar / Ofis sahibi", "Diğer"]
LEAD_BUDGETS = ["30–60 bin TL", "60–120 bin TL", "120 bin TL üzeri", "Henüz belirsiz"]
LEAD_TIMELINES = ["Hemen", "1 ay içinde", "2–3 ay içinde", "Sadece bilgi alıyorum"]
LEAD_MIN_FILL_MS = 2500  # bundan hizli doldurulan lead formlari bot sayilir
PIXEL_ID_DEFAULT = "876755502162549"
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

def owner_email(name, email, subject, message, date_str, extra=None):
    rows = [
        ("Ad Soyad", escape(name)),
        ("E-posta", '<a href="mailto:%s" style="color:#1a56db;">%s</a>' % (escape(email, quote=True), escape(email))),
        ("Konu", escape(subject)),
        ("Tarih", escape(date_str)),
    ]
    for k, v in (extra or []):
        rows.append((escape(k), escape(v)))
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
    extra_text = "".join("%s: %s\n" % (k, v) for k, v in (extra or []))
    text = "Web sitesinden yeni mesaj\n\nAd Soyad: %s\nE-posta: %s\nKonu: %s\nTarih: %s\n%s\nMesaj:\n%s\n" % (
        name, email, subject, date_str, extra_text, message)
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
            "Accept": "application/json",
            "User-Agent": "DijitalGru-Site/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print("[RESEND OK] status=%s to=%s body=%s" % (resp.status, to, body[:200]))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print("[RESEND ERROR] status=%s to=%s from=%s body=%s" % (e.code, to, sender, body[:500]))
        raise RuntimeError("Resend HTTP %s" % e.code)
    except Exception as e:
        print("[RESEND ERROR] baglanti hatasi to=%s: %r" % (to, e))
        raise


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


# --- Meta Conversions API (sunucu tarafi Lead) ------------------------------------

def _sha256(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def norm_phone(raw):
    """Telefonu yalnizca rakam ve ulke kodlu hale getirir (Meta icin hash oncesi)."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = "90" + digits[1:]
    elif len(digits) == 10:
        digits = "90" + digits
    return digits


def send_capi_lead(email, phone, event_id, source_url, ip, user_agent, fbp, fbc):
    """Pixel 'Lead' olayinin sunucu kopyasi. Ayni event_id ile Meta tekillestirir.
    Yalnizca e-posta ve telefon SHA-256 ile hashlenerek gonderilir; baska kisisel veri gonderilmez."""
    token = os.environ.get("META_CAPI_TOKEN", "").strip()
    if not token:
        print("[CAPI] META_CAPI_TOKEN tanimli degil, sunucu olayi atlandi")
        return None
    pixel_id = os.environ.get("META_PIXEL_ID", "").strip() or PIXEL_ID_DEFAULT
    version = os.environ.get("META_GRAPH_VERSION", "").strip() or "v21.0"
    user_data = {"em": [_sha256(email.strip().lower())]}
    if phone:
        user_data["ph"] = [_sha256(phone)]
    if ip:
        user_data["client_ip_address"] = ip
    if user_agent:
        user_data["client_user_agent"] = user_agent
    if fbp:
        user_data["fbp"] = fbp
    if fbc:
        user_data["fbc"] = fbc
    payload = {
        "data": [{
            "event_name": "Lead",
            "event_time": int(time.time()),
            "event_id": event_id,
            "action_source": "website",
            "event_source_url": source_url,
            "user_data": user_data,
        }],
        "access_token": token,
    }
    test_code = os.environ.get("META_TEST_EVENT_CODE", "").strip()
    if test_code:
        payload["test_event_code"] = test_code
    req = urllib.request.Request(
        "https://graph.facebook.com/%s/%s/events" % (version, pixel_id),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "DijitalGru-Site/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print("[CAPI OK] status=%s event_id=%s body=%s" % (resp.status, event_id, body[:300]))
            return body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print("[CAPI ERROR] status=%s event_id=%s body=%s" % (e.code, event_id, body[:500]))
    except Exception as e:
        print("[CAPI ERROR] baglanti hatasi event_id=%s: %r" % (event_id, e))
    return None


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

CANONICAL_HOST = "dijitalgru.com"
# Yonlendirme disinda kalan host'lar: Railway healthcheck ve yerel gelistirme
REDIRECT_EXEMPT_HOSTS = ("healthcheck.railway.app", "localhost", "127.0.0.1", "0.0.0.0")
REDIRECT_EXEMPT_PREFIXES = ("/api/", "/health")


class DijitalGruHandler(http.server.SimpleHTTPRequestHandler):
    def _redirect_to_canonical(self):
        """Host dijitalgru.com degilse (www dahil) ayni yola 301. True donerse yanit verildi."""
        host = (self.headers.get('Host', '') or '').split(':', 1)[0].strip().lower()
        if not host or host == CANONICAL_HOST or host in REDIRECT_EXEMPT_HOSTS:
            return False
        if self.path.startswith(REDIRECT_EXEMPT_PREFIXES):
            return False
        target = "https://%s%s" % (CANONICAL_HOST, self.path if self.path.startswith('/') else '/' + self.path)
        self.send_response(301)
        self.send_header('Location', target)
        self.send_header('Cache-Control', 'public, max-age=3600')
        self.send_header('Content-Length', '0')
        http.server.SimpleHTTPRequestHandler.end_headers(self)
        return True

    def do_HEAD(self):
        if self._redirect_to_canonical():
            return
        return super().do_HEAD()

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
            return self._json(429, {"success": False, "field": "rate_limit", "error": "Çok fazla deneme yaptınız, birkaç dakika sonra tekrar deneyin."})

        name = clean_line(data.get('name'), 100)
        email = clean_line(data.get('email'), 254)
        subject = clean_line(data.get('subject_title', data.get('subject')), 60)
        message = clean_text(data.get('message'), 5000)

        if len(name) < 2:
            return self._json(400, {"success": False, "field": "name", "error": "Lütfen adınızı ve soyadınızı girin."})
        if not EMAIL_RE.match(email):
            return self._json(400, {"success": False, "field": "email", "error": "Lütfen geçerli bir e-posta adresi girin."})
        if len(message) < 2:
            return self._json(400, {"success": False, "field": "message", "error": "Lütfen mesajınızı yazın."})
        if subject not in ALLOWED_SUBJECTS:
            subject = "Diğer"

        # Nitelikli lead formu (reklam sayfalari): ek alanlar, KVKK onayi ve bot kontrolu
        extra = []
        phone_raw = clean_line(data.get('phone'), 30)
        form_type = clean_line(data.get('form_type'), 20)
        if form_type == 'lead':
            try:
                fill_ms = float(data.get('fill_ms', 0))
            except (TypeError, ValueError):
                fill_ms = 0
            if fill_ms < LEAD_MIN_FILL_MS:
                print("[SPAM] lead formu cok hizli dolduruldu (%sms), yoksayildi" % int(fill_ms))
                return self._json(200, {"success": True})
            checks = [
                ('sector', 'Sektör', LEAD_SECTORS, 'Lütfen sektörünüzü seçin.'),
                ('role', 'Rol', LEAD_ROLES, 'Lütfen rolünüzü seçin.'),
                ('budget', 'Bütçe aralığı', LEAD_BUDGETS, 'Lütfen bütçe aralığınızı seçin.'),
                ('timeline', 'Başlama zamanı', LEAD_TIMELINES, 'Lütfen başlama zamanını seçin.'),
            ]
            for key, label, allowed, err in checks:
                val = clean_line(data.get(key), 60)
                if val not in allowed:
                    return self._json(400, {"success": False, "field": key, "error": err})
                extra.append((label, val))
            if len(message) < 5:
                return self._json(400, {"success": False, "field": "message", "error": "Lütfen ihtiyacınızı kısaca yazın."})
            if phone_raw and not (10 <= len(norm_phone(phone_raw)) <= 15):
                return self._json(400, {"success": False, "field": "phone", "error": "Lütfen geçerli bir telefon numarası girin."})
            if data.get('kvkk') not in (True, 'true', 'on', '1', 1):
                return self._json(400, {"success": False, "field": "kvkk", "error": "Devam etmek için KVKK bilgilendirmesini onaylamanız gerekir."})
            subject = "Proje Teklifi"
            extra.append(("Telefon", phone_raw or "-"))
            extra.append(("Sayfa", clean_line(data.get('page_url'), 200)))

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
                "extra": dict(extra) if extra else None,
            })
            with open(leads_file, "w", encoding="utf-8") as f:
                json.dump(leads[:500], f, ensure_ascii=False, indent=2)
        except Exception as ex:
            print("Lead kaydedilemedi:", ex)

        # 1) Bize gelen bildirim (kritik)
        to_addr = os.environ.get("CONTACT_TO", "dijitalgru@gmail.com").strip() or "dijitalgru@gmail.com"
        owner_sent = False
        try:
            subj, html, text = owner_email(name, email, subject, message, date_str, extra)
            send_mail(to_addr, subj, html, text, reply_to=email)
            owner_sent = True
            print("[MAIL] Bildirim gonderildi:", name, "-", subject)
        except Exception as e:
            print("[MAIL ERROR] Bildirim gonderilemedi:", repr(e))

        # Istege bagli Telegram bildirimi
        tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        tg_chat = os.environ.get("TELEGRAM_CHAT_ID")
        tg_sent = False
        if tg_token and tg_chat:
            try:
                tg_text = "Dijital Gru yeni form\n\nAd: %s\nE-posta: %s\nKonu: %s\n%s\n%s" % (
                    name, email, subject, "".join("%s: %s\n" % (k, v) for k, v in extra), message)
                payload = json.dumps({"chat_id": tg_chat, "text": tg_text}).encode('utf-8')
                req = urllib.request.Request(
                    "https://api.telegram.org/bot%s/sendMessage" % tg_token, data=payload,
                    headers={'Content-Type': 'application/json'})
                urllib.request.urlopen(req, timeout=5)
                tg_sent = True
            except Exception as e:
                print("Telegram bildirimi basarisiz:", e)

        if not (owner_sent or tg_sent):
            return self._json(502, {"success": False, "field": "server", "error": "Mesaj şu an gönderilemedi."})

        # Sunucu tarafi Lead (Meta CAPI): yalnizca form kabul edildiyse, pazarlama izni ve event_id varsa.
        event_id = clean_line(data.get('event_id'), 80)
        if data.get('marketing_consent') in (True, 'true', '1', 1) and re.match(r'^[A-Za-z0-9_.-]{8,80}$', event_id or ''):
            page_url = clean_line(data.get('page_url'), 300)
            if not page_url.startswith(SITE_URL):
                page_url = SITE_URL + '/'
            threading.Thread(target=send_capi_lead, daemon=True, args=(
                email, norm_phone(phone_raw) if phone_raw else '', event_id, page_url,
                self._client_ip(), self.headers.get('User-Agent', '')[:300],
                clean_line(data.get('fbp'), 100), clean_line(data.get('fbc'), 200))).start()

        # 2) Gonderene otomatik yanit: Resend'de yalnizca CONTACT_FROM (dogrulanmis alan adi) tanimliysa denenir.
        #    Basarisiz olsa da kullaniciya hata gosterilmez, sadece loglanir.
        kind, _cfg = mail_provider()
        autoreply_ok = kind == "smtp" or bool(os.environ.get("CONTACT_FROM", "").strip())
        if owner_sent and autoreply_ok:
            try:
                subj, html, text = auto_reply_email(name, subject)
                send_mail(email, subj, html, text, reply_to=to_addr)
            except Exception as e:
                print("[MAIL WARN] Otomatik yanit gonderilemedi:", repr(e))
        elif owner_sent:
            print("[MAIL] CONTACT_FROM tanimli degil, otomatik yanit atlandi")

        return self._json(200, {"success": True})

    def do_GET(self):
        if self._redirect_to_canonical():
            return
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
