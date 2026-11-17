import datetime
import csv
import re
from flask import Flask, render_template, request, jsonify, redirect, send_file, Response, make_response
import time
import json
import urllib.request
from urllib.parse import quote
import uuid
import os
import io
import base64
import threading

from werkzeug.middleware.proxy_fix import ProxyFix
from PIL import Image
from db import init_db, get_db, is_postgres
from auth import register_user, login_user, decode_token, get_user_by_id
from qr_engine import generate_qr_image
from payments import create_checkout_form, verify_and_process_iyzico_callback, PLANS
from cloud_storage import upload_file_to_cloud
import meta_capi
from qr_utils import (
    SOCIAL_TYPES, VCARD_TYPES, MENU_TYPES, STATIC_TYPES, WHATSAPP_TYPES, DYNAMIC_TYPES,
    normalize_social_links, normalize_phone_for_wa, is_valid_wa_number, normalize_phone_e164,
    static_content_for, parse_wifi, parse_phone, parse_sms, parse_whatsapp_target,
    is_bot_request, mask_ip, to_istanbul, fmt_istanbul, TR_TZ_NAME,
)
from qr_service import (
    clean_text, loads, sanitize_settings, validate_content, resolve_target, SOCIAL_LABELS,
)
from plan_limits import FREE_DYNAMIC_LIMIT, limit_for_plan, plan_has_logo
from migrate_db import run_migrations

app = Flask(__name__, static_folder="static", template_folder="templates")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.config["SECRET_KEY"] = os.environ.get("JWT_SECRET", "dijitalgru_qr_secret_key_2026")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

# Initialize Database and Migrations on Startup
try:
    init_db()
    run_migrations()
except Exception as e:
    print(f"⚠️ DB initialization/migration note: {e}")

# --- Helper Auth Middleware ---
def get_current_user():
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header:
        token = auth_header.replace("Bearer ", "").strip()
    elif request.args.get("token"):
        token = request.args.get("token").strip()

    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return get_user_by_id(payload["user_id"])

# --- Health Check Endpoint (Zero-Downtime Deployment) ---
@app.route("/health")
@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "Dijitalgru QR Studio",
        "version": "2026.09.24.v3_social_fields_fix",
        "timestamp": int(time.time())
    }), 200

# --- Public Routes ---

@app.route("/")
def index():
    initial_qr = generate_qr_image("https://qrdijitalgru.com", {
        "fill_color": "#4F46E5",
        "back_color": "#FFFFFF",
        "frame_style": "card",
        "frame_text": "Beni Tara!",
        "frame_color": "#4F46E5",
        "frame_text_color": "#FFFFFF"
    }, format="base64")
    resp = make_response(render_template("index.html", initial_qr_image=initial_qr, meta_pixel_id=meta_capi.pixel_id()))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

def _get_geoip_data(visitor_ip):
    """
    Fetch real country and city from visitor IP using ip-api.com free tier.
    Falls back to neutral 'Bilinmiyor' if request fails or if IP is local/private/invalid.
    """
    if not visitor_ip or visitor_ip in ("127.0.0.1", "localhost", "::1", "unknown", "0.0.0.0"):
        return "Bilinmiyor", "Bilinmiyor"
    
    # Check for private IP ranges (10.x, 192.168.x, 127.x, 172.16-31.x)
    if visitor_ip.startswith("10.") or visitor_ip.startswith("192.168.") or visitor_ip.startswith("127."):
        return "Bilinmiyor", "Bilinmiyor"
    if visitor_ip.startswith("172."):
        parts = visitor_ip.split(".")
        if len(parts) >= 2 and parts[1].isdigit():
            val = int(parts[1])
            if 16 <= val <= 31:
                return "Bilinmiyor", "Bilinmiyor"
                
    try:
        url = f"http://ip-api.com/json/{visitor_ip}?fields=status,country,city&lang=tr"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "success":
                country = data.get("country") or "Bilinmiyor"
                city = data.get("city") or "Bilinmiyor"
                return country, city
    except Exception as e:
        print(f"[geoip lookup error] ip={visitor_ip}: {e}")
        
    return "Bilinmiyor", "Bilinmiyor"

def _log_scan_async(qr_id, visitor_ip, user_agent):
    """
    Background Thread: Asynchronously logs scan analytics without blocking user redirect.
    Opens and closes its own DB connection safely.
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        now = int(time.time())
        device_type = "Mobile" if ("Mobile" in user_agent or "Android" in user_agent or "iPhone" in user_agent) else "Desktop"
        browser = "Chrome" if "Chrome" in user_agent else ("Safari" if "Safari" in user_agent else "Other")
        
        country, city = _get_geoip_data(visitor_ip)
        
        cursor.execute("""
        INSERT INTO scan_logs (qr_id, scanned_at, ip_address, user_agent, device_type, browser, country, city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (qr_id, now, visitor_ip, user_agent, device_type, browser, country, city))
        
        cursor.execute("UPDATE qr_codes SET scans_count = COALESCE(scans_count, 0) + 1 WHERE id = ?", (qr_id,))
        conn.commit()
        cursor.close()
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        print(f"[scan log error] qr_id={qr_id}: {e}")
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

def _is_owner_trial_expired(qr_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT u.plan, u.subscription_end 
        FROM qr_codes q 
        JOIN users u ON q.user_id = u.id 
        WHERE q.id = ?
        """, (qr_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            p = row["plan"]
            sub_end = row["subscription_end"]
            now = int(time.time())
            return (p == "free" and sub_end and sub_end < now)
    except Exception:
        pass
    return False

def _error_page(heading, message, icon, status):
    resp = make_response(render_template("qr_error.html", heading=heading, message=message, icon=icon), status)
    resp.headers["Cache-Control"] = "no-store"
    return resp


def _err_not_found():
    return _error_page("QR Kod Bulunamadı", "Aradığınız QR kod sistemde bulunamadı veya silinmiş olabilir.", "🔍", 404)


def _err_paused():
    return _error_page("Bu QR Kod Pasife Alınmış", "Bu QR kod şu anda aktif değil. Lütfen QR kodun sahibiyle iletişime geçin.", "⏸️", 403)


def _err_target_missing():
    return _error_page("Hedef Adres Bulunamadı", "Bu QR kod için geçerli bir hedef tanımlanmamış. Lütfen QR kodun sahibiyle iletişime geçin.", "🧭", 404)


def _err_suspended():
    return _error_page("Hesap Askıya Alınmış", "Bu QR kodun bağlı olduğu hesap askıya alınmıştır.", "🚫", 403)


def _find_qr(ident):
    """short_code / custom_slug (veya eski sayısal id) ile QR + sahip bilgilerini bulur."""
    sql = """
        SELECT q.id, q.type, q.target_url, q.status, q.user_id, q.short_code, q.custom_slug, q.title,
               u.plan, u.subscription_end, u.account_status
        FROM qr_codes q LEFT JOIN users u ON q.user_id = u.id
        WHERE {where}
    """
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql.format(where="q.short_code = ? OR q.custom_slug = ?"), (ident, ident))
        row = cur.fetchone()
        legacy = False
        if not row and str(ident).isdigit() and len(str(ident)) <= 9:
            cur.execute(sql.format(where="q.id = ?"), (int(ident),))
            row = cur.fetchone()
            legacy = True
        cur.close()
        return (dict(row), legacy) if row else (None, False)
    finally:
        conn.close()


def _fetch_page_row(table, qr_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM {table} WHERE qr_id = ?", (qr_id,))
        row = cur.fetchone()
        cur.close()
        return dict(row) if row else None
    finally:
        conn.close()


def _request_visitor():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    return ip, request.headers.get("User-Agent", "")


def _maybe_log_scan(qr_id):
    """Bot / önizleme / HEAD isteklerini taramaya sayma."""
    ip, ua = _request_visitor()
    if is_bot_request(ua, request.method):
        return
    threading.Thread(target=_log_scan_async, args=(qr_id, ip, ua), daemon=True).start()


def _owner_gate(qr):
    """Sahibin hesap/deneme durumuna göre erişim kararı. None -> devam."""
    if qr.get("account_status") == "suspended":
        return _err_suspended()
    now = int(time.time())
    if qr.get("plan") == "free" and qr.get("subscription_end") and qr["subscription_end"] < now:
        return redirect("https://qrdijitalgru.com", code=302)
    if qr.get("status") in ("passive", "paused", "deleted", "archived"):
        return _err_paused()
    return None


def _page_url(kind, qr):
    return f"/p/{kind}/{qr.get('short_code')}"


@app.route("/r/<short_code>")
def redirect_qr(short_code):
    """
    Dinamik QR yönlendirme motoru. Hem yeni hem de eskiden basılmış kayıtlar türe göre çözülür
    (statik türler, sosyal medya, WhatsApp, mikro sayfalar). Hata sayfaları marka tasarımlıdır.
    """
    try:
        qr, _legacy = _find_qr(short_code)
    except Exception as ex:
        print(f"[/r/{short_code}] DB lookup error:", ex)
        return _error_page("Geçici Bir Sorun Oluştu", "Yönlendirme sırasında bir hata oluştu. Lütfen biraz sonra tekrar deneyin.", "⚠️", 500)

    # /r/ yalnızca short_code/custom_slug ile çalışır (sıralı id ile gezmeyi engelle)
    if not qr or (qr.get("short_code") != short_code and qr.get("custom_slug") != short_code):
        return _err_not_found()

    gate = _owner_gate(qr)
    if gate is not None:
        return gate

    vcard = menu = None
    t = qr.get("type")
    try:
        if t in VCARD_TYPES or t in SOCIAL_TYPES or t == "social":
            vcard = _fetch_page_row("vcard_pages", qr["id"])
        if t in MENU_TYPES:
            menu = _fetch_page_row("menu_pages", qr["id"])
    except Exception as ex:
        print(f"[/r/{short_code}] page lookup note:", ex)

    res = resolve_target(qr, vcard, menu)
    kind = res["kind"]

    if kind == "error":
        if res.get("reason") == "social_empty":
            return _error_page("Profil Bağlantısı Bulunamadı", "Bu QR kod için bir sosyal medya hesabı tanımlanmamış.", "🔗", 404)
        return _err_target_missing()

    _maybe_log_scan(qr["id"])

    if kind == "redirect":
        resp = redirect(res["url"], code=302)
        resp.headers["Cache-Control"] = "no-store"
        return resp
    if kind in ("text", "sms", "wifi"):
        resp = make_response(render_template("static_view.html", kind=kind, data=res["data"]))
        resp.headers["Cache-Control"] = "no-store"
        return resp
    if kind == "social_links":
        return render_template("social_links.html", links=res["links"])
    if kind == "micro_vcard":
        return redirect(_page_url("vcard", qr), code=302)
    if kind == "micro_menu":
        return redirect(_page_url("menu", qr), code=302)
    if kind == "vcf":
        row = vcard or _fetch_page_row("vcard_pages", qr["id"])
        if row:
            return render_template("vcard_auto_redirect.html", vcard=row, qr_id=qr["id"],
                                   vcf_url=f"/p/vcard/{qr['short_code']}.vcf")
        return _err_target_missing()
    return _err_target_missing()


def _clean_media_url(url):
    if not url:
        return url
    url_str = str(url).strip()
    import re
    return re.sub(r'^https?://(?:qrdijitalgru\.com)?/*p/media/', '/p/media/', url_str, flags=re.IGNORECASE)


def _json_load(v, default):
    if isinstance(v, (dict, list)):
        return v
    if not v:
        return default
    try:
        return json.loads(v)
    except Exception:
        return default


def _wa_digits_for(phone):
    d = normalize_phone_for_wa(phone) if phone else ""
    return d if is_valid_wa_number(d) else ""


def _vcf_escape(s):
    return (str(s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
            .replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n"))


def _vcf_fold(line):
    """RFC 6350: 75 oktetten uzun satırları katla."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    out, cur = [], ""
    for ch in line:
        if len((cur + ch).encode("utf-8")) > (75 if not out else 74):
            out.append(cur)
            cur = ch
        else:
            cur += ch
    out.append(cur)
    return "\r\n ".join(out)


def _split_name(full):
    parts = str(full or "").strip().split()
    if len(parts) <= 1:
        return (parts[0] if parts else ""), ""
    return " ".join(parts[:-1]), parts[-1]


def _vcf_photo_line(avatar_url):
    if not avatar_url:
        return None
    avatar_url = _clean_media_url(avatar_url)
    data = _load_media_bytes(avatar_url) if str(avatar_url).startswith("/p/media/") else None
    if data:
        ptype = "PNG" if data[:8] == b"\x89PNG\r\n\x1a\n" else ("GIF" if data[:3] == b"GIF" else "JPEG")
        return _vcf_fold(f"PHOTO;ENCODING=b;TYPE={ptype}:" + base64.b64encode(data).decode("ascii"))
    if re.match(r"^https?://", str(avatar_url), re.I):
        return _vcf_fold(f"PHOTO;VALUE=uri:{avatar_url}")
    return None


def build_vcf(v, qr_type="vcard"):
    """Rehber dosyası: N:Soyad;Ad;;; , E.164 numaralar, PHOTO, URL ve X-SOCIALPROFILE."""
    name = (v.get("full_name") or "").strip() or "Kişi Kartı"
    first, last = _split_name(name)
    lines = ["BEGIN:VCARD", "VERSION:3.0",
             f"FN;CHARSET=UTF-8:{_vcf_escape(name)}",
             f"N;CHARSET=UTF-8:{_vcf_escape(last)};{_vcf_escape(first)};;;"]
    if v.get("title"):
        lines.append(f"TITLE;CHARSET=UTF-8:{_vcf_escape(v['title'])}")
    if v.get("company"):
        lines.append(f"ORG;CHARSET=UTF-8:{_vcf_escape(v['company'])}")
    if v.get("phone"):
        lines.append(f"TEL;TYPE=CELL:{normalize_phone_e164(v['phone'])}")
    if v.get("phone2"):
        lines.append(f"TEL;TYPE=WORK:{normalize_phone_e164(v['phone2'])}")
    for c in (v.get("_contacts") or [])[:12]:
        if c.get("phone"):
            lines.append(f"TEL;TYPE=WORK:{normalize_phone_e164(c['phone'])}")
        if c.get("email"):
            lines.append(f"EMAIL;TYPE=INTERNET:{c['email']}")
    if v.get("email"):
        lines.append(f"EMAIL;TYPE=INTERNET:{v['email']}")
    if v.get("website"):
        lines.append(f"URL:{v['website']}")
    social = normalize_social_links(_json_load(v.get("social_links"), {}))
    for k, url in social.items():
        lines.append(f"URL;TYPE={k}:{url}")
        lines.append(f"X-SOCIALPROFILE;TYPE={k}:{url}")
    if v.get("address"):
        lines.append(f"ADR;CHARSET=UTF-8:;;{_vcf_escape(v['address'])};;;;")
    if v.get("bio"):
        lines.append(f"NOTE;CHARSET=UTF-8:{_vcf_escape(v['bio'])}")
    photo = _vcf_photo_line(v.get("avatar_url"))
    if photo:
        lines.append(photo)
    lines.append("END:VCARD")
    return "\r\n".join(lines) + "\r\n"


def _micro_gate(ident):
    qr, legacy = _find_qr(ident)
    if not qr:
        return None, None, _err_not_found()
    gate = _owner_gate(qr)
    if gate is not None:
        return None, None, gate
    return qr, legacy, None


@app.route("/p/vcard/<ident>")
def public_vcard(ident):
    want_vcf = ident.endswith(".vcf")
    if want_vcf:
        ident = ident[:-4]
    qr, legacy, err = _micro_gate(ident)
    if err is not None:
        return err
    t = qr.get("type")
    if t in SOCIAL_TYPES or t == "social":
        return redirect(f"/r/{qr['short_code']}", code=302)

    # Eski sayısal URL'ler aynı sayfanın rastgele kodlu adresine yönlenir
    if legacy and ident != qr.get("short_code"):
        return redirect(f"/p/vcard/{qr['short_code']}" + (".vcf" if want_vcf else ""), code=302)

    v = _fetch_page_row("vcard_pages", qr["id"])
    if not v:
        return _error_page("Kartvizit Bulunamadı", "Bu kartvizit sayfası bulunamadı.", "📇", 404)

    for k in ("card_image_url", "avatar_url"):
        if v.get(k):
            v[k] = _clean_media_url(v[k])
    company = _json_load(v.get("extra_json"), {}) if t == "company_card" else {}
    if company.get("logo_url"):
        company["logo_url"] = _clean_media_url(company["logo_url"])

    if want_vcf:
        v["_contacts"] = company.get("contacts") if company else []
        content = build_vcf(v, t)
        ua = request.headers.get("User-Agent", "").lower()
        is_android = any(k in ua for k in ["android", "dalvik", "stagefright", "downloadmanager"])
        resp = Response(content, mimetype="text/x-vcard" if is_android else "text/vcard")
        safe = _ascii_filename(v.get("full_name"), "kisi")
        disposition = "inline" if ("iphone" in ua or "ipad" in ua or is_android or "mobile" in ua) else "attachment"
        resp.headers["Content-Disposition"] = f'{disposition}; filename="{safe}.vcf"'
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return resp

    social = normalize_social_links(_json_load(v.get("social_links"), {}))
    theme = _json_load(v.get("theme_settings"), {})
    vcf_url = f"/p/vcard/{qr['short_code']}.vcf"
    phone_e164 = normalize_phone_e164(v.get("phone")) if v.get("phone") else ""
    wa_digits = _wa_digits_for(v.get("phone"))

    if t == "company_card":
        contacts = []
        for c in company.get("contacts") or []:
            contacts.append({"name": c.get("name"), "title": c.get("title"), "email": c.get("email"),
                             "tel": normalize_phone_e164(c["phone"]) if c.get("phone") else "",
                             "wa": _wa_digits_for(c.get("phone"))})
        social_list = [(k, SOCIAL_LABELS.get(k, k.title()), u) for k, u in social.items()]
        return render_template("company_template.html", vcard=v, company=company, contacts=contacts,
                               social_list=social_list, theme=theme, vcf_url=vcf_url, phone_e164=phone_e164)

    return render_template("vcard_template.html", vcard=v, social=social, theme=theme, vcf_url=vcf_url,
                           phone_e164=phone_e164, wa_digits=wa_digits)


@app.route("/p/menu/<ident>")
def public_menu(ident):
    qr, legacy, err = _micro_gate(ident)
    if err is not None:
        return err
    if legacy and ident != qr.get("short_code"):
        return redirect(f"/p/menu/{qr['short_code']}", code=302)

    menu_data = _fetch_page_row("menu_pages", qr["id"])
    if not menu_data:
        return _error_page("Menü Bulunamadı", "Bu menü / katalog sayfası bulunamadı.", "📄", 404)

    for k in ("card_image_url", "cover_url", "pdf_url"):
        if menu_data.get(k):
            menu_data[k] = _clean_media_url(menu_data[k])
    pdf_url = menu_data.get("pdf_url")
    if pdf_url in ("None", "null", "undefined", ""):
        pdf_url = None
        menu_data["pdf_url"] = None

    cats = _json_load(menu_data.get("categories"), [])
    clean_cats = []
    for c in cats if isinstance(cats, list) else []:
        items = [it for it in (c.get("items") or []) if isinstance(it, dict) and (it.get("name") or "").strip()]
        for it in items:
            it["description"] = (it.get("description") or it.get("desc") or "").strip()
        if items:
            clean_cats.append({"name": c.get("name") or "", "items": items})
    menu_data["categories"] = clean_cats

    # Yalnızca PDF varsa ve ürün yoksa doğrudan PDF'e git
    if pdf_url and (pdf_url.startswith("/") or pdf_url.startswith("http")) and not clean_cats \
            and not (menu_data.get("contact_name") or menu_data.get("phone") or menu_data.get("email")
                     or menu_data.get("address") or menu_data.get("website") or menu_data.get("card_image_url")):
        return redirect(pdf_url)

    theme_data = _json_load(menu_data.get("theme_settings"), {})
    return render_template("menu_template.html", menu=menu_data, theme=theme_data)

# --- REST API Endpoints ---

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.json or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    
    if not name or not email or not password:
        return jsonify({"error": "Lütfen tüm alanları doldurun."}), 400
        
    res, err = register_user(name, email, password)
    if err:
        return jsonify({"error": err}), 400

    # Meta CAPI: CompleteRegistration (event_id = yeni kullanıcı id'si; tarayıcıdaki eventID ile aynı)
    try:
        meta_capi.send_registration(request, res.get("user") or {})
    except Exception as e:
        print(f"[meta_capi] register hook error: {e}")

    return jsonify(res)

@app.route("/api/meta/event", methods=["POST"])
def api_meta_event():
    """Tarayıcı pikselinden gelen olayı aynı event_id ile Meta CAPI'ye iletir (tekilleştirme)."""
    try:
        data = request.get_json(silent=True) or {}
        user = None
        try:
            user = get_current_user()
        except Exception:
            user = None
        email = (user or {}).get("email")
        sent = meta_capi.send_client_event(
            request,
            data.get("event_name"),
            data.get("event_id"),
            data.get("source_url"),
            data.get("params"),
            email=email,
        )
        return jsonify({"ok": bool(sent)})
    except Exception as e:
        print(f"[meta_capi] /api/meta/event error: {e}")
        return jsonify({"ok": False}), 200

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "E-posta ve şifre gereklidir."}), 400
        
    res, err = login_user(email, password)
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify(res)

@app.route("/api/auth/me", methods=["GET"])
def api_me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
    # Ödeme yapmış (iyzico, iade edilmemiş) kullanıcıya fatura bildirimi göstermek için
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT invoice_no, plan_name, amount, created_at FROM subscriptions "
            "WHERE user_id = ? AND source = 'iyzico' AND status = 'active' "
            "AND (refund_status IS NULL OR refund_status = 'none') "
            "ORDER BY created_at DESC LIMIT 1", (user["id"],))
        row = cur.fetchone()
        conn.close()
        user = dict(user)
        user["paid_invoice"] = (
            {"invoice_no": row["invoice_no"], "plan_name": row["plan_name"],
             "amount": float(row["amount"]), "created_at": row["created_at"]}
            if row else None
        )
    except Exception as ex:
        print("[api_me] paid_invoice error:", ex)
    return jsonify({"user": user})

@app.route("/api/qr/preview", methods=["POST"])
def api_qr_preview():
    data = request.json or {}
    text = data.get("text", "https://qrdijitalgru.com")
    if not text or not str(text).strip():
        text = "https://qrdijitalgru.com"
    settings = data.get("settings", {})
    
    b64_img = generate_qr_image(text, settings, format="base64")
    return jsonify({"status": "success", "image": b64_img, "qr_image": b64_img})

@app.route("/static/uploads/pdfs/<filename>")
def serve_legacy_static_pdf(filename):
    # 1. Check local static folder
    filepath = os.path.join(app.static_folder, "uploads", "pdfs", filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype="application/pdf")
        
    # 2. Fallback to PostgreSQL database pdf_files
    file_code = filename.replace("menu_", "").replace(".pdf", "")
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM pdf_files WHERE file_code = ? OR filename = ?", (file_code, filename))
        row = cursor.fetchone()
    except Exception as ex:
        conn.rollback()
        conn.close()
        return "PDF Bulunamadı", 404
    conn.close()
    
    if row:
        pdf_data = dict(row)
        pdf_bytes = base64.b64decode(pdf_data["data_b64"])
        response = Response(pdf_bytes, mimetype=pdf_data.get("content_type", "application/pdf"))
        response.headers["Content-Disposition"] = f'inline; filename="{pdf_data["filename"]}"'
        return response
        
    return "PDF Dosyası Bulunamadı", 404

@app.route("/p/media/<file_code>")
@app.route("/p/pdf/<file_code>")
@app.route("/p/pdf/<file_code>.pdf")
def serve_media(file_code):
    for ext_suffix in [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
        if file_code.endswith(ext_suffix):
            file_code = file_code[:-len(ext_suffix)]
            break

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT filename, content_type, data_b64 FROM pdf_files WHERE file_code = ?", (file_code,))
        row = cursor.fetchone()
        cursor.close()
    except Exception as ex:
        conn.rollback()
        conn.close()
        return "Dosya Bulunamadı", 404
    conn.close()

    if not row:
        return "Dosya Bulunamadı", 404

    file_data = dict(row)
    content_type = file_data.get("content_type") or "application/octet-stream"
    safe_ext = "png" if "png" in content_type else ("jpg" if "jpeg" in content_type or "jpg" in content_type else ("pdf" if "pdf" in content_type else "bin"))

    local_path = os.path.join(app.static_folder, "uploads", "media", f"{file_code}.{safe_ext}")
    if os.path.exists(local_path):
        resp = send_file(local_path, mimetype=content_type)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp

    try:
        raw_bytes = base64.b64decode(file_data["data_b64"])
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(raw_bytes)
        resp = send_file(local_path, mimetype=content_type)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp
    except Exception as ex:
        print(f"Media decode error for {file_code}:", ex)
        return "Dosya Okunamadı", 500

MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _sniff_image(data):
    """Dosya içeriğine (magic bytes) bakarak görsel türünü döndürür; SVG vb. reddedilir."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg", "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif", "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None, None


@app.route("/api/upload/pdf", methods=["POST"])
def api_upload_pdf():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    if "pdf_file" not in request.files:
        return jsonify({"error": "Lütfen bir PDF dosyası seçin."}), 400
        
    file = request.files["pdf_file"]
    if file.filename == "":
        return jsonify({"error": "Dosya seçilmedi."}), 400
        
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Sadece PDF formatındaki dosyalar yüklenebilir."}), 400
        
    pdf_bytes = file.read(MAX_PDF_BYTES + 1)
    if len(pdf_bytes) > MAX_PDF_BYTES:
        return jsonify({"error": "PDF dosyası en fazla 15 MB olabilir."}), 413
    if not pdf_bytes.lstrip()[:5] == b"%PDF-" and pdf_bytes[:5] != b"%PDF-":
        return jsonify({"error": "Dosya geçerli bir PDF değil."}), 400
    pdf_url, file_code = upload_file_to_cloud(pdf_bytes, file.filename, content_type="application/pdf")
    
    return jsonify({"status": "success", "pdf_url": pdf_url, "filename": file.filename})

@app.route("/api/upload/avatar", methods=["POST"])
@app.route("/api/upload/image", methods=["POST"])
def api_upload_image():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
    file = request.files.get("avatar_file") or request.files.get("image_file") or request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"error": "Lütfen bir görsel dosyası seçin."}), 400

    img_bytes = file.read(MAX_IMAGE_BYTES + 1)
    if len(img_bytes) > MAX_IMAGE_BYTES:
        return jsonify({"error": "Görsel en fazla 5 MB olabilir."}), 413
    ext, content_type = _sniff_image(img_bytes)
    if not ext:
        return jsonify({"error": "Sadece JPG, PNG, WEBP veya GIF görselleri yüklenebilir."}), 400
    safe_name = (file.filename.rsplit(".", 1)[0] or "image")[:60] + "." + ext
    image_url, file_code = upload_file_to_cloud(img_bytes, safe_name, content_type=content_type)
    
    return jsonify({
        "status": "success", 
        "avatar_url": image_url, 
        "image_url": image_url, 
        "filename": safe_name
    })

def sanitize_slug(slug):
    if not slug:
        return None
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    clean = str(slug).translate(tr_map).lower().strip().replace(' ', '-')
    clean = re.sub(r'[^a-z0-9_-]', '', clean)
    return clean[:50] if clean else None

def _json_str(v, default="{}"):
    """dict/list/JSON-str -> güvenli JSON string"""
    if v is None or v == "":
        return default
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    try:
        json.loads(v)
        return v
    except Exception:
        return default


def _load_media_bytes(url):
    """/p/media/<kod> ile yüklenmiş görseli (logo) veritabanından okur."""
    m = re.match(r"^/p/media/([A-Za-z0-9_\-]+)", str(url or ""))
    if not m:
        return None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT data_b64 FROM pdf_files WHERE file_code = ?", (m.group(1),))
        row = cur.fetchone()
        conn.close()
        return base64.b64decode(row["data_b64"]) if row else None
    except Exception as ex:
        print("[logo] load error:", ex)
        return None


def _qr_content_for(qr, base_url, prefer_slug=False):
    """QR görseline yazılacak içerik: statik türlerde ham standart içerik, dinamiklerde /r/ kısa linki."""
    t = qr.get("type")
    if t in STATIC_TYPES:
        return static_content_for(t, qr.get("target_url"))
    code = (qr.get("custom_slug") if prefer_slug else None) or qr.get("short_code", "")
    return f"{base_url}/r/{code}"


def _render_qr(qr, fmt, base_url, prefer_slug=False):
    settings = loads(qr.get("custom_settings"), {})
    if not isinstance(settings, dict):
        settings = {}
    render_settings = dict(settings)
    if settings.get("logo_url"):
        lb = _load_media_bytes(settings.get("logo_url"))
        if lb:
            render_settings["_logo_bytes"] = lb
    return generate_qr_image(_qr_content_for(qr, base_url, prefer_slug), render_settings, format=fmt)


def _upsert_page(cursor, table, qr_id, values):
    """vcard_pages / menu_pages için ekle ya da yalnızca verilen kolonları güncelle."""
    cursor.execute(f"SELECT id FROM {table} WHERE qr_id = ?", (qr_id,))
    exists = cursor.fetchone()
    cols = list(values.keys())
    if exists:
        if cols:
            sets = ", ".join(f"{c} = ?" for c in cols)
            cursor.execute(f"UPDATE {table} SET {sets} WHERE qr_id = ?", [values[c] for c in cols] + [qr_id])
    else:
        names = ["qr_id"] + cols
        marks = ", ".join("?" for _ in names)
        cursor.execute(f"INSERT INTO {table} ({', '.join(names)}) VALUES ({marks})", [qr_id] + [values[c] for c in cols])


def _apply_content(cursor, qr_id, short_code, qr_type, clean, data, partial, current_target=""):
    """Doğrulanmış içeriği sayfa tablolarına yazar ve qr_codes.target_url değerini döndürür."""
    target = clean.get("target_url") or ""
    card = clean.get("vcard")
    menu = clean.get("menu")

    if card is not None:
        vp = data.get("vcard_payload") if isinstance(data.get("vcard_payload"), dict) else {}
        present = set(vp.keys()) if partial else None
        vals = {
            "full_name": card.get("full_name"), "title": card.get("title"), "company": card.get("company"),
            "phone": card.get("phone"), "phone2": card.get("phone2"), "email": card.get("email"),
            "website": card.get("website"), "address": card.get("address"), "bio": card.get("bio"),
            "avatar_url": card.get("avatar_url"), "card_image_url": card.get("card_image_url"),
            "social_links": json.dumps(card.get("social_links") or {}, ensure_ascii=False),
            "theme_settings": _json_str(card.get("theme_settings"), None),
            "extra_json": json.dumps(card.get("extra"), ensure_ascii=False) if card.get("extra") else None,
        }
        if present is not None:
            keep = {"extra_json": "company_info"}
            vals = {k: v for k, v in vals.items() if keep.get(k, k) in present}
            # Sosyal türlerde sadece social_links güncellenir
        if qr_type in SOCIAL_TYPES or qr_type == "social":
            vals = {k: v for k, v in vals.items() if k in ("social_links", "theme_settings")}
        _upsert_page(cursor, "vcard_pages", qr_id, vals)
        if qr_type in SOCIAL_TYPES:
            target = clean["target_url"]
        elif qr_type == "social":
            target = f"micropage://social/{qr_id}"
        elif qr_type == "vcard" and (card.get("direct_redirect") if not (partial and "direct_redirect" not in vp) else str(current_target).endswith(".vcf")):
            target = f"/p/vcard/{short_code}.vcf"
        else:
            target = f"micropage://vcard/{qr_id}"

    if menu is not None:
        mp = data.get("menu_payload") if isinstance(data.get("menu_payload"), dict) else {}
        present = set(mp.keys()) if partial else None
        vals = {
            "title": menu.get("title"), "description": menu.get("description"), "cover_url": menu.get("cover_url"),
            "pdf_url": menu.get("pdf_url"),
            "categories": json.dumps(menu.get("categories") or [], ensure_ascii=False),
            "contact_name": menu.get("contact_name"), "contact_title": menu.get("contact_title"),
            "phone": menu.get("phone"), "phone2": menu.get("phone2"), "email": menu.get("email"),
            "website": menu.get("website"), "address": menu.get("address"),
            "card_image_url": menu.get("card_image_url"),
            "social_links": json.dumps(menu.get("social_links") or {}, ensure_ascii=False),
            "theme_settings": _json_str(menu.get("theme_settings"), None),
        }
        if present is not None:
            vals = {k: v for k, v in vals.items() if k in present}
        _upsert_page(cursor, "menu_pages", qr_id, vals)
        # Güncel menü satırını oku (kısmi güncellemede doğru hedefi seçmek için)
        cursor.execute("SELECT pdf_url, categories FROM menu_pages WHERE qr_id = ?", (qr_id,))
        mrow = cursor.fetchone()
        cur_pdf = (mrow["pdf_url"] if mrow else None) or None
        direct_pref = menu.get("direct_redirect") if not (partial and "direct_redirect" not in mp) else (not str(current_target).startswith("micropage://"))
        if cur_pdf and (cur_pdf.startswith("/") or cur_pdf.startswith("http")) and direct_pref and qr_type != "restaurant_menu":
            target = cur_pdf
        else:
            target = f"micropage://menu/{qr_id}"
    return target


ALL_QR_TYPES = set(DYNAMIC_TYPES) | set(STATIC_TYPES)


@app.route("/api/qr/create", methods=["POST"])
def api_qr_create():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401

    if user.get("trial_expired"):
        return jsonify({
            "error": "7 Günlük Ücretsiz Deneme Süreniz Dolmuştur! QR kodlarınız pasife alınmıştır. Kullanmaya devam etmek ve yeni QR oluşturmak için lütfen bir abonelik paketi satın alın."
        }), 403

    data = request.get_json(silent=True) or {}
    title = clean_text(data.get("title"), 200) or "Yeni QR Kod"
    qr_type = str(data.get("type") or "url").strip()
    if qr_type not in ALL_QR_TYPES:
        return jsonify({"error": "Geçersiz QR türü.", "field_errors": {"type": "Geçersiz QR türü."}}), 400

    clean, field_errors = validate_content(qr_type, data)
    raw_custom_slug = (data.get("custom_slug") or data.get("slug") or "").strip()
    custom_slug = sanitize_slug(raw_custom_slug)
    if field_errors:
        return jsonify({"error": next(iter(field_errors.values())), "field_errors": field_errors}), 400

    settings = sanitize_settings(data.get("settings"), logo_allowed=plan_has_logo(user))

    short_code = uuid.uuid4().hex[:7]
    now = int(time.time())

    conn = get_db()
    cursor = conn.cursor()

    if custom_slug:
        cursor.execute("SELECT id FROM qr_codes WHERE short_code = ? OR custom_slug = ?", (custom_slug, custom_slug))
        if cursor.fetchone():
            conn.close()
            msg = f"'{custom_slug}' özel link uzantısı zaten kullanılıyor. Lütfen farklı bir uzantı seçin."
            return jsonify({"error": msg, "field_errors": {"custom_slug": msg}}), 400

    is_dynamic = 1 if qr_type in DYNAMIC_TYPES else 0

    # Sunucu tarafı limit kontrolü (yalnızca dinamik QR) — limit plan tanımından gelir
    if is_dynamic == 1:
        cursor.execute("SELECT COUNT(*) as count FROM qr_codes WHERE user_id = ? AND is_dynamic = 1", (user["id"],))
        count = cursor.fetchone()["count"]
        if count >= user["dynamic_qr_limit"]:
            conn.close()
            return jsonify({"error": f"Paketinizin dinamik QR oluşturma limitine ({user['dynamic_qr_limit']}) ulaştınız. Lütfen paketinizi yükseltin!"}), 403

    folder_name = clean_text(data.get("folder_name"), 100) or "Genel"

    cursor.execute("""
    INSERT INTO qr_codes (user_id, short_code, custom_slug, title, type, target_url, is_dynamic, custom_settings, status, folder_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    """, (user["id"], short_code, custom_slug, title, qr_type, clean["target_url"], is_dynamic, json.dumps(settings), folder_name, now, now))
    qr_id = cursor.lastrowid

    target = _apply_content(cursor, qr_id, short_code, qr_type, clean, data, partial=False)
    if target != clean["target_url"]:
        cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (target, qr_id))

    conn.commit()
    conn.close()

    app_url = request.host_url.rstrip("/")
    qr_row = {"type": qr_type, "short_code": short_code, "custom_slug": custom_slug,
              "target_url": target, "custom_settings": json.dumps(settings)}
    b64_qr = _render_qr(qr_row, "base64", app_url)
    qr_content = _qr_content_for(qr_row, app_url)

    return jsonify({
        "status": "success",
        "qr_id": qr_id,
        "short_code": short_code,
        "short_url": f"{app_url}/r/{short_code}",
        "qr_image": b64_qr,
        "qr_content": qr_content
    })


def _ascii_filename(title, fallback):
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    s = str(title or "").translate(tr_map).lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60]
    return s or fallback


@app.route("/api/qr/<int:qr_id>/download", methods=["GET"])
def api_qr_download(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Bu işlem için giriş yapmanız gerekir."}), 401
    try:
        fmt = (request.args.get("format") or "png").lower()
        if fmt not in ("png", "jpg", "jpeg", "svg", "eps", "pdf"):
            return jsonify({"error": "Desteklenmeyen format. png, jpg, svg, eps veya pdf seçin."}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM qr_codes WHERE id = ?", (qr_id,))
        row = cursor.fetchone()
        conn.close()

        # Sahiplik kontrolü: sahibi değilse varlığını da belli etme
        if not row or (row["user_id"] != user["id"] and not user.get("is_admin")):
            return jsonify({"error": "QR kod bulunamadı."}), 404

        qr = dict(row)
        app_url = request.host_url.rstrip("/")
        img_data = _render_qr(qr, fmt, app_url)

        mimetype = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml",
                    "eps": "application/postscript", "pdf": "application/pdf"}.get(fmt, "image/png")
        ext = "jpg" if fmt == "jpeg" else fmt
        filename = f"qr-{_ascii_filename(qr.get('title'), qr.get('short_code') or qr_id)}.{ext}"

        buffer = io.BytesIO(img_data)
        buffer.seek(0)
        resp = send_file(buffer, mimetype=mimetype, as_attachment=True, download_name=filename)
        resp.headers["Cache-Control"] = "private, no-store"
        return resp
    except Exception as e:
        app.logger.error(f"Error downloading QR #{qr_id}: {e}", exc_info=True)
        return jsonify({"error": "QR indirme sırasında bir hata oluştu."}), 500


@app.route("/api/qr/<int:qr_id>/update", methods=["POST"])
def api_qr_update(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401

    if user.get("trial_expired"):
        return jsonify({
            "error": "7 Günlük Ücretsiz Deneme Süreniz Dolmuştur! QR kodlarınızı düzenlemek için lütfen abonelik paketi satın alın."
        }), 403

    data = request.get_json(silent=True) or {}
    title = clean_text(data.get("title"), 200) if data.get("title") is not None else None
    status = data.get("status")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM qr_codes WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    qr_row = cursor.fetchone()
    if not qr_row:
        conn.close()
        return jsonify({"error": "QR kod bulunamadı."}), 404
    qr = dict(qr_row)
    qr_type = qr["type"]

    now = int(time.time())

    # İçerik alanı geldiyse tür kurallarıyla doğrula (sunucu tarafı)
    relevant = {
        "url": ("target_url",),
        "vcard": ("vcard_payload",), "company_card": ("vcard_payload",), "social": ("vcard_payload",),
    }.get(qr_type)
    if relevant is None:
        if qr_type in STATIC_TYPES:
            relevant = ("static_payload", "target_url")
        elif qr_type in WHATSAPP_TYPES:
            relevant = ("wa_payload", "target_url")
        elif qr_type in SOCIAL_TYPES:
            relevant = ("vcard_payload",)
        else:
            relevant = ("menu_payload",)
    has_content = any(data.get(k) is not None for k in relevant)
    clean = None
    if has_content:
        clean, field_errors = validate_content(qr_type, data, legacy_target=qr.get("target_url") or "", partial=True)
        if field_errors:
            conn.close()
            return jsonify({"error": next(iter(field_errors.values())), "field_errors": field_errors}), 400

    new_slug_val = None
    slug_given = "custom_slug" in data or "slug" in data
    if slug_given:
        raw_slug = data.get("custom_slug") if "custom_slug" in data else data.get("slug")
        new_slug_val = sanitize_slug(raw_slug)
        if new_slug_val:
            cursor.execute("SELECT id FROM qr_codes WHERE (short_code = ? OR custom_slug = ?) AND id != ?", (new_slug_val, new_slug_val, qr_id))
            if cursor.fetchone():
                conn.close()
                msg = f"'{new_slug_val}' özel link uzantısı başka bir QR kod tarafından kullanılıyor."
                return jsonify({"error": msg, "field_errors": {"custom_slug": msg}}), 400

    if has_content:
        target = _apply_content(cursor, qr_id, qr.get("short_code"), qr_type, clean, data, partial=True, current_target=qr.get("target_url") or "")
        if qr_type in ("url",) or qr_type in STATIC_TYPES or qr_type in WHATSAPP_TYPES or qr_type in SOCIAL_TYPES:
            target = clean["target_url"]
        cursor.execute("UPDATE qr_codes SET target_url = ?, updated_at = ? WHERE id = ?", (target, now, qr_id))
    if title:
        cursor.execute("UPDATE qr_codes SET title = ?, updated_at = ? WHERE id = ?", (title, now, qr_id))
    if status:
        if status not in ("active", "passive", "paused", "deleted", "archived"):
            conn.close()
            return jsonify({"error": "Geçersiz durum."}), 400
        cursor.execute("UPDATE qr_codes SET status = ?, updated_at = ? WHERE id = ?", (status, now, qr_id))
    if slug_given:
        cursor.execute("UPDATE qr_codes SET custom_slug = ?, updated_at = ? WHERE id = ?", (new_slug_val, now, qr_id))
    folder_name = clean_text(data.get("folder_name"), 100)
    if folder_name:
        cursor.execute("UPDATE qr_codes SET folder_name = ?, updated_at = ? WHERE id = ?", (folder_name, now, qr_id))
    if isinstance(data.get("settings"), dict):
        merged = sanitize_settings(data.get("settings"), logo_allowed=plan_has_logo(user))
        cursor.execute("UPDATE qr_codes SET custom_settings = ?, updated_at = ? WHERE id = ?", (json.dumps(merged), now, qr_id))

    conn.commit()
    conn.close()

    return jsonify({"status": "success", "message": "QR Kodu başarıyla güncellendi."})


@app.route("/api/qr/<int:qr_id>/details", methods=["GET"])
def api_qr_details(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM qr_codes WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "QR Kod bulunamadı."}), 404

    qr_data = dict(row)
    qr_type = qr_data["type"]

    vcard_data = None
    if qr_type in VCARD_TYPES or qr_type in SOCIAL_TYPES or qr_type == "social":
        cursor.execute("SELECT * FROM vcard_pages WHERE qr_id = ?", (qr_id,))
        vrow = cursor.fetchone()
        if vrow:
            vcard_data = dict(vrow)
            for k in ("card_image_url", "avatar_url"):
                if vcard_data.get(k):
                    vcard_data[k] = _clean_media_url(vcard_data[k])
            vcard_data["social_links"] = normalize_social_links(loads(vcard_data.get("social_links"), {}))
            vcard_data["company_info"] = loads(vcard_data.pop("extra_json", None), {})
            vcard_data["theme_settings"] = vcard_data.get("theme_settings")

    menu_data = None
    if qr_type in MENU_TYPES:
        cursor.execute("SELECT * FROM menu_pages WHERE qr_id = ?", (qr_id,))
        mrow = cursor.fetchone()
        if mrow:
            menu_data = dict(mrow)
            for k in ("card_image_url", "cover_url", "pdf_url"):
                if menu_data.get(k):
                    menu_data[k] = _clean_media_url(menu_data[k])
            menu_data["social_links"] = loads(menu_data.get("social_links"), {})
            menu_data["categories"] = loads(menu_data.get("categories"), [])
    conn.close()

    custom_settings = loads(qr_data.get("custom_settings"), {})
    tu = qr_data.get("target_url") or ""

    static_payload = None
    if qr_type == "phone":
        static_payload = {"phone": parse_phone(tu)}
    elif qr_type == "sms":
        static_payload = parse_sms(tu)
    elif qr_type == "text":
        static_payload = {"text": tu}
    elif qr_type == "wifi":
        w = parse_wifi(tu)
        static_payload = {"ssid": w["ssid"], "password": w["password"], "encryption": w["enc"], "hidden": w["hidden"]}
    elif qr_type == "static_url":
        static_payload = {"url": tu}

    wa_payload = None
    if qr_type in WHATSAPP_TYPES:
        p, m = parse_whatsapp_target(tu)
        wa_payload = {"phone": normalize_phone_for_wa(p), "message": m}

    app_url = request.host_url.rstrip("/")
    return jsonify({
        "id": qr_data["id"],
        "title": qr_data["title"],
        "type": qr_type,
        "target_url": tu,
        "status": qr_data["status"],
        "folder_name": qr_data.get("folder_name", "Genel"),
        "is_dynamic": qr_data.get("is_dynamic", 1),
        "custom_settings": custom_settings,
        "custom_slug": qr_data.get("custom_slug") or "",
        "short_code": qr_data.get("short_code"),
        "short_url": f"{app_url}/r/{qr_data.get('short_code')}",
        "qr_content": _qr_content_for(qr_data, app_url),
        "static_payload": static_payload,
        "wa_payload": wa_payload,
        "vcard": vcard_data,
        "menu": menu_data
    })


@app.route("/api/qr/<int:qr_id>", methods=["DELETE"])
@app.route("/api/qr/<int:qr_id>/delete", methods=["DELETE", "POST"])
def api_qr_delete(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE qr_codes SET status = 'deleted' WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "QR kod arşive kaldırıldı."})

@app.route("/api/qr/<int:qr_id>/permanent_delete", methods=["DELETE", "POST"])
def api_qr_permanent_delete(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM qr_codes WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    cursor.execute("DELETE FROM scan_logs WHERE qr_id = ?", (qr_id,))
    cursor.execute("DELETE FROM vcard_pages WHERE qr_id = ?", (qr_id,))
    cursor.execute("DELETE FROM menu_pages WHERE qr_id = ?", (qr_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "QR kod kalıcı olarak silindi."})

@app.route("/api/qr/<int:qr_id>/restore", methods=["POST"])
def api_qr_restore(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE qr_codes SET status = 'active' WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "QR kod tekrar aktif edildi."})
    
@app.route("/api/qr/list", methods=["GET"])
def api_qr_list():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
        SELECT 
            q.id, q.short_code, q.custom_slug, q.title, q.type, q.target_url, q.is_dynamic, q.custom_settings, q.status, q.scans_count, 
            COALESCE(q.folder_name, 'Genel') as folder_name, q.created_at, q.updated_at,
            COUNT(DISTINCT sl.ip_address) as unique_scans
        FROM qr_codes q
        LEFT JOIN scan_logs sl ON q.id = sl.qr_id
        WHERE q.user_id = ?
        GROUP BY q.id, q.short_code, q.custom_slug, q.title, q.type, q.target_url, q.is_dynamic, q.custom_settings, q.status, q.scans_count, q.folder_name, q.created_at, q.updated_at
        ORDER BY q.created_at DESC
        """, (user["id"],))
        rows = cursor.fetchall()
    except Exception as ex:
        conn.rollback()
        conn.close()
        print("Error in api_qr_list:", ex)
        return jsonify({"error": "QR listesi alınırken sunucu hatası oluştu."}), 500
    
    qr_codes = []
    app_url = request.host_url.rstrip("/")
    for r in rows:
        item = dict(r)
        active_code = item.get("custom_slug") or item.get("short_code", "")
        item["short_url"] = f"{app_url}/r/{active_code}"
        item["custom_slug"] = item.get("custom_slug") or ""
        item["scan_count"] = item.get("scans_count", 0)
        item["unique_scans"] = item.get("unique_scans", 0)
        item["folder_name"] = item.get("folder_name", "Genel")
        
        try:
            settings = json.loads(item["custom_settings"]) if item.get("custom_settings") else {}
        except Exception:
            settings = {}
            
        item["settings"] = settings
        item["qr_content"] = _qr_content_for(item, app_url)
        item["qr_image"] = _render_qr(item, "base64", app_url)
        qr_codes.append(item)
        
    # Stats
    try:
        cursor.execute("SELECT COUNT(*) as total_qr, COALESCE(SUM(scans_count), 0) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
        stats_row = cursor.fetchone()
        total_qr = stats_row["total_qr"] if stats_row else 0
        total_scans = stats_row["total_scans"] if stats_row else 0

        cursor.execute("SELECT COUNT(DISTINCT ip_address) as unique_visitors FROM scan_logs WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user["id"],))
        uv_row = cursor.fetchone()
        unique_visitors = uv_row["unique_visitors"] if uv_row else 0
    except Exception as ex:
        conn.rollback()
        print("Error fetching stats:", ex)
        total_qr = len(qr_codes)
        total_scans = 0
        unique_visitors = 0

    avg_scans = round(total_scans / total_qr, 1) if total_qr > 0 else 0.0
    dynamic_qr_count = len([q for q in qr_codes if q.get("is_dynamic")])

    conn.close()

    return jsonify({
        "qr_codes": qr_codes,
        "stats": {
            "total_qr": total_qr,
            "total_scans": total_scans,
            "unique_visitors": unique_visitors,
            "avg_scans_per_qr": avg_scans,
            "dynamic_qr_count": dynamic_qr_count
        },
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "plan": user["plan"],
            "dynamic_qr_limit": user["dynamic_qr_limit"]
        }
    })

@app.route("/api/qr/export/<int:qr_id>", methods=["GET"])
def api_export_qr(qr_id):
    return api_qr_download(qr_id)

@app.route("/api/qr/<int:qr_id>/update_folder", methods=["POST"])
def api_update_qr_folder(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim."}), 401
    folder_name = (request.json or {}).get("folder_name", "Genel")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE qr_codes SET folder_name = ? WHERE id = ? AND user_id = ?", (folder_name, qr_id, user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "folder_name": folder_name})

@app.route("/api/qr/<int:qr_id>/update_status", methods=["POST"])
def api_update_qr_status(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim."}), 401
    new_status = (request.json or {}).get("status", "active")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE qr_codes SET status = ? WHERE id = ? AND user_id = ?", (new_status, qr_id, user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "status": new_status})
        
    # Stats
    cursor.execute("SELECT COUNT(*) as total_qr, SUM(scans_count) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
    tot_row = cursor.fetchone()
    total_qr = (tot_row["total_qr"] if (tot_row and "total_qr" in tot_row) else 0) if tot_row else 0
    total_scans = (tot_row["total_scans"] if (tot_row and "total_scans" in tot_row) else 0) if tot_row else 0
    
    # Unique visitors (IP based) & avg scans
    cursor.execute("""
    SELECT COUNT(DISTINCT sl.ip_address) as unique_visitors 
    FROM scan_logs sl 
    JOIN qr_codes q ON sl.qr_id = q.id 
    WHERE q.user_id = ?
    """, (user["id"],))
    uv_row = cursor.fetchone()
    unique_visitors = (uv_row["unique_visitors"] if (uv_row and "unique_visitors" in uv_row) else 0) or 0
    avg_scans = round(total_scans / total_qr, 1) if total_qr > 0 else 0.0
    
    conn.close()
    
    return jsonify({
        "status": "success",
        "qr_codes": qr_codes,
        "stats": {
            "total_qr": total_qr or len(qr_codes),
            "total_scans": total_scans or 0,
            "unique_visitors": unique_visitors,
            "avg_scans_per_qr": avg_scans,
            "dynamic_qr_count": len(qr_codes)
        },
        "user": user
    })

@app.route("/api/analytics/dashboard", methods=["GET"])
def api_analytics_dashboard():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    
    # Total QRs & Total Scans
    cursor.execute("SELECT COUNT(*) as total_qr, SUM(scans_count) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
    tot_row = cursor.fetchone()
    total_qr = tot_row["total_qr"] or 0
    total_scans = tot_row["total_scans"] or 0
    
    cursor.execute("""
    SELECT COUNT(DISTINCT sl.ip_address) as unique_visitors 
    FROM scan_logs sl 
    JOIN qr_codes q ON sl.qr_id = q.id 
    WHERE q.user_id = ?
    """, (user["id"],))
    uv_row = cursor.fetchone()
    unique_visitors = (uv_row["unique_visitors"] if (uv_row and "unique_visitors" in uv_row) else 0) or 0
    avg_scans = round(total_scans / total_qr, 1) if total_qr > 0 else 0.0
    
    # Device breakdown
    cursor.execute("""
    SELECT sl.device_type, COUNT(*) as count 
    FROM scan_logs sl
    JOIN qr_codes q ON sl.qr_id = q.id
    WHERE q.user_id = ?
    GROUP BY sl.device_type
    """, (user["id"],))
    devices = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return jsonify({
        "total_qr": total_qr,
        "total_scans": total_scans,
        "unique_visitors": unique_visitors,
        "avg_scans_per_qr": avg_scans,
        "dynamic_limit": user["dynamic_qr_limit"],
        "plan": user["plan"],
        "devices": devices
    })

@app.route("/api/qr/<int:qr_id>/analytics", methods=["GET"])
def api_qr_analytics(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401

    conn = get_db()
    cursor = conn.cursor()

    # Verify ownership
    cursor.execute("SELECT id, title, scans_count, user_id FROM qr_codes WHERE id = ?", (qr_id,))
    qr = cursor.fetchone()
    if not qr or (qr["user_id"] != user["id"] and user["role"] != "admin"):
        conn.close()
        return jsonify({"error": "QR Kod bulunamadı veya erişim yetkiniz yok."}), 404

    # Unique visitors
    cursor.execute("SELECT COUNT(DISTINCT ip_address) as unique_visitors FROM scan_logs WHERE qr_id = ?", (qr_id,))
    uv_row = cursor.fetchone()
    unique_visitors = (uv_row["unique_visitors"] if uv_row and "unique_visitors" in uv_row else 0) or 0

    # Device breakdown
    cursor.execute("""
    SELECT COALESCE(device_type, 'Bilinmiyor') as device_type, COUNT(*) as count 
    FROM scan_logs 
    WHERE qr_id = ? 
    GROUP BY device_type 
    ORDER BY count DESC
    """, (qr_id,))
    devices = [dict(r) for r in cursor.fetchall()]

    # City breakdown
    cursor.execute("""
    SELECT COALESCE(city, 'Bilinmiyor') as city, COUNT(*) as count 
    FROM scan_logs 
    WHERE qr_id = ? 
    GROUP BY city 
    ORDER BY count DESC 
    LIMIT 10
    """, (qr_id,))
    cities = [dict(r) for r in cursor.fetchall()]

    # Recent 100 scan logs (UTC saklanır, Europe/Istanbul gösterilir)
    cursor.execute("""
    SELECT scanned_at, ip_address, device_type, browser, country, city, user_agent 
    FROM scan_logs 
    WHERE qr_id = ? 
    ORDER BY scanned_at DESC 
    LIMIT 100
    """, (qr_id,))
    raw_scans = cursor.fetchall()
    scans = []
    for r in raw_scans:
        item = dict(r)
        item["formatted_date"] = fmt_istanbul(item.get("scanned_at") or 0)
        item["ip_address"] = mask_ip(item.get("ip_address"))
        scans.append(item)

    # Saatlik yoğunluk (Istanbul saatine göre) — tüm tarama geçmişinden
    hourly = [0] * 24
    cursor.execute("SELECT scanned_at FROM scan_logs WHERE qr_id = ?", (qr_id,))
    for hr in cursor.fetchall():
        try:
            hourly[to_istanbul(hr["scanned_at"]).hour] += 1
        except Exception:
            pass

    conn.close()

    return jsonify({
        "qr_id": qr_id,
        "title": qr["title"],
        "total_scans": qr["scans_count"] or 0,
        "unique_visitors": unique_visitors,
        "devices": devices,
        "cities": cities,
        "recent_scans": scans,
        "hourly": hourly,
        "timezone": TR_TZ_NAME
    })

@app.route("/api/qr/<int:qr_id>/analytics/export", methods=["GET"])
def api_qr_analytics_export(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim. Lütfen önce giriş yapın."}), 401

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, title, user_id FROM qr_codes WHERE id = ?", (qr_id,))
    qr = cursor.fetchone()
    if not qr or (qr["user_id"] != user["id"] and user["role"] != "admin"):
        conn.close()
        return jsonify({"error": "QR Kod bulunamadı veya erişim yetkiniz yok."}), 404

    cursor.execute("""
    SELECT scanned_at, ip_address, device_type, browser, country, city, user_agent 
    FROM scan_logs 
    WHERE qr_id = ? 
    ORDER BY scanned_at DESC
    """, (qr_id,))
    scans = cursor.fetchall()
    conn.close()

    export_format = request.args.get("format", "csv").lower()

    raw_title = qr["title"] if (qr and qr.get("title")) else f"QR_{qr_id}"
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    ascii_title = str(raw_title).translate(tr_map)
    clean_title = "".join(c for c in ascii_title if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_') or f"QR_{qr_id}"

    if export_format == "json":
        json_data = []
        for s in scans:
            row = dict(s)
            row["scanned_at_formatted"] = fmt_istanbul(row.get("scanned_at") or 0)
            row["timezone"] = TR_TZ_NAME
            row["ip_address"] = mask_ip(row.get("ip_address"))
            json_data.append(row)
        
        json_bytes = json.dumps({
            "qr_id": qr_id,
            "title": qr["title"],
            "total_logs": len(json_data),
            "scan_logs": json_data
        }, ensure_ascii=False, indent=2).encode('utf-8')
        
        buffer = io.BytesIO(json_bytes)
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype="application/json",
            as_attachment=True,
            download_name=f"Analitik_{clean_title}_QR{qr_id}.json"
        )

    # Default CSV Export with UTF-8 BOM (\ufeff) for Excel compatibility
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)

    # CSV Header
    writer.writerow(["Tarih / Saat (Europe/Istanbul)", "Cihaz Tipi", "Tarayıcı", "Şehir", "Ülke", "IP Adresi (maskeli)", "User Agent"])

    def _csv_safe(v):
        # Excel formül enjeksiyonunu engelle (=, +, -, @ ile başlayan hücreler)
        v = str(v if v is not None else "-")
        return ("'" + v) if v[:1] in ("=", "+", "-", "@") else v

    for s in scans:
        writer.writerow([
            fmt_istanbul(s["scanned_at"] or 0),
            _csv_safe(s["device_type"] or "Bilinmiyor"),
            _csv_safe(s["browser"] or "Bilinmiyor"),
            _csv_safe(s["city"] or "Bilinmiyor"),
            _csv_safe(s["country"] or "Türkiye"),
            mask_ip(s["ip_address"]),
            _csv_safe(s["user_agent"] or "-")
        ])

    csv_bytes = output.getvalue().encode('utf-8')
    buffer = io.BytesIO(csv_bytes)
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"Analitik_{clean_title}_QR{qr_id}.csv"
    )

@app.route("/api/subscriptions/plans", methods=["GET"])
def api_get_plans():
    return jsonify({"plans": PLANS, "free_dynamic_limit": FREE_DYNAMIC_LIMIT})

@app.route("/api/user/update-billing", methods=["POST"])
def api_update_billing():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    data = request.json or {}
    name = (data.get("name") or "").strip()
    identity_number = (data.get("identity_number") or "").strip()
    gsm_number = (data.get("gsm_number") or "").strip()
    address = (data.get("address") or "").strip()
    city = (data.get("city") or "").strip()
    
    if not identity_number or len(identity_number) not in [10, 11] or not identity_number.isdigit():
        return jsonify({"error": "Lütfen 10 veya 11 haneli T.C. Kimlik / Vergi numaranızı girin."}), 400
        
    if not gsm_number or len(gsm_number) < 10:
        return jsonify({"error": "Lütfen 3D Secure doğrulaması için geçerli bir cep telefonu girin."}), 400
        
    if not address or len(address) < 5:
        return jsonify({"error": "Lütfen açık fatura adresinizi girin."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        UPDATE users 
        SET name = ?, identity_number = ?, gsm_number = ?, address = ?, city = ?
        WHERE id = ?
        """, (name if name else user["name"], identity_number, gsm_number, address, city if city else "Istanbul", user["id"]))
        conn.commit()
        return jsonify({"status": "success", "message": "Fatura ve güvenlik bilgileriniz kaydedildi."})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Güncelleme başarısız: {e}"}), 500
    finally:
        conn.close()

@app.route("/api/payment/checkout", methods=["POST"])
@app.route("/api/iyzico/checkout-form", methods=["POST"])
@app.route("/api/subscriptions/purchase", methods=["POST"])
def api_iyzico_checkout():
    """
    Initializes official iyzico payment checkout form.
    NEVER directly activates user plan without iyzico payment verification.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen satın alma işlemi yapmadan önce giriş yapın."}), 401
        
    data = request.json or {}
    plan_key = data.get("plan_key") or data.get("plan") or "starter"
    cycle = data.get("cycle") or "monthly"
    
    # Force strict HTTPS callback URL to eliminate Chrome's unencrypted form warning
    host_url = request.host_url.rstrip('/')
    if host_url.startswith("http://"):
        host_url = "https://" + host_url[7:]
    callback_url = f"{host_url}/api/iyzico/callback"
    
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr).split(',')[0].strip()
    from payments import create_checkout_form
    res_json, err = create_checkout_form(user, plan_key, cycle, callback_url, client_ip)
    
    if isinstance(res_json, dict) and res_json.get("status") == "requires_billing_info":
        return jsonify({
            "status": "requires_billing_info",
            "error": err,
            "missing_field": res_json.get("missing_field"),
            "user": user
        }), 400

    if err:
        return jsonify({"error": err, "status": "failure"}), 400
        
    if not res_json or res_json.get("status") != "success":
        error_msg = res_json.get("errorMessage") if res_json else "iyzico ödeme formu oluşturulamadı."
        return jsonify({"error": error_msg, "status": "failure"}), 400
        
    # Meta CAPI: callback farklı site üzerinden döneceği için fbp/fbc/IP/UA/onay bağlamını şimdi sakla
    try:
        meta_capi.save_checkout_ctx(request, res_json.get("token"))
    except Exception as e:
        print(f"[meta_capi] checkout ctx error: {e}")

    return jsonify({
        "status": "success",
        "checkout_form_content": res_json.get("checkoutFormContent"),
        "payment_page_url": res_json.get("paymentPageUrl"),
        "token": res_json.get("token")
    })

@app.route("/api/iyzico/callback", methods=["POST", "GET"])
def api_iyzico_callback():
    """
    Secure Webhook Callback from iyzico.
    Retrieves token, verifies payment with iyzico server, and ONLY updates DB if paymentStatus == 'SUCCESS'.
    """
    token = request.form.get("token") or request.args.get("token")
    if not token and request.json:
        token = request.json.get("token")
        
    from payments import verify_and_process_iyzico_callback
    res, err = verify_and_process_iyzico_callback(token)
    
    if err or not res or res.get("status") != "success":
        error_msg = err or (res.get("error") if res else "Ödeme doğrulanamadı.")
        print(f"[/api/iyzico/callback] Payment verification failed:", error_msg)
        import html as _html
        from urllib.parse import quote as _quote
        _reason_q = _quote(str(error_msg)[:200])
        error_msg = _html.escape(str(error_msg))
        return f"""
        <html>
            <head><title>Ödeme Başarısız</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: white;">
                <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
                    <h2 style="color: #ef4444;">⚠️ Ödeme Tamamlanamadı</h2>
                    <p>{error_msg}</p>
                    <a href="/?payment=failed&reason={_reason_q}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border-radius: 8px; text-decoration: none;">Panele Dön</a>
                </div>
                <script>
                    setTimeout(function() {{
                        window.location.href = "/?payment=failed&reason={_reason_q}";
                    }}, 4000);
                </script>
            </body>
        </html>
        """, 400
        
    plan = res.get("plan", "starter")

    # Meta: ödeme iyzico'dan sunucuda DOĞRULANDI -> CAPI Purchase (event_id = iyzico paymentId).
    # Callback tekrar çağrılırsa (already_processed) hiçbir şey gönderilmez.
    purchase = meta_capi.send_purchase(request, token, res)
    browser_purchase = bool(meta_capi.pixel_id()) and not res.get("already_processed") and bool(purchase.get("event_id"))

    def _js(v):
        return json.dumps(v, ensure_ascii=False).replace("<", "\\u003c")

    pixel_head = ""
    pixel_script = ""
    if meta_capi.pixel_id():
        pixel_head = (
            f'<script>window.META_PIXEL_ID = {_js(meta_capi.pixel_id())};</script>'
            '<script src="/static/js/meta-pixel.js?v=20261110_1"></script>'
        )
    if browser_purchase:
        _params = _js({
            "value": float(purchase["value"]),
            "currency": "TRY",
            "content_name": purchase["content_name"],
        })
        _opts = _js({"eventID": purchase["event_id"], "once": "purchase_" + purchase["event_id"], "persist": True})
        pixel_script = (
            "try { if (window.mcTrack) window.mcTrack('Purchase', " + _params + ", " + _opts + "); } catch (e) {}"
        )

    return f"""
    <html>
        <head><title>Ödeme Başarılı!</title>{pixel_head}</head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: white;">
            <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
                <h2 style="color: #10b981;">🎉 Ödemeniz Başarıyla Alındı!</h2>
                <p>Paketiniz <strong>{res.get('plan', '').upper()}</strong> başarıyla aktif edildi.</p>
                <p style="font-size: 13px; color: #94a3b8;">Fatura No: {res.get('invoice_no')}</p>
                <a href="/?payment=success&plan={plan}" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #10b981; color: white; border-radius: 8px; text-decoration: none;">Panele Git</a>
            </div>
            <script>
                {pixel_script}
                setTimeout(function() {{
                    window.location.href = "/?payment=success&plan={plan}";
                }}, 3500);
            </script>
        </body>
    </html>
    """, 200


# --- Admin System Helpers & Audit Logger ---

def log_admin_action(admin_id, target_user_id, action_type, details=""):
    try:
        conn = get_db()
        cursor = conn.cursor()
        now = int(time.time())
        cursor.execute("""
        INSERT INTO admin_actions (admin_id, target_user_id, action_type, details, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (admin_id, target_user_id, action_type, details, now))
        conn.commit()
        conn.close()
    except Exception as e:
        print("⚠️ log_admin_action error:", e)

def require_admin():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None, (jsonify({"error": "Yetkisiz erişim. Lütfen giriş yapın."}), 401)
        
    token = auth_header.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload:
        return None, (jsonify({"error": "Geçersiz veya süresi dolmuş oturum."}), 401)
        
    user = get_user_by_id(payload["user_id"])
    if not user:
        return None, (jsonify({"error": "Kullanıcı bulunamadı."}), 401)
        
    if not user.get("is_admin"):
        return None, (jsonify({"error": "Erişim engellendi. Yalnızca yöneticiler bu alana erişebilir."}), 403)
        
    if user.get("account_status") == "suspended":
        return None, (jsonify({"error": "Hesabınız askıya alınmıştır."}), 403)
        
    return user, None

# --- Admin Page Route ---

@app.route("/admin")
def admin_page():
    return render_template("admin.html")

# --- Admin API Endpoints ---

@app.route("/api/admin/stats", methods=["GET"])
def api_admin_stats():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM users")
    total_users = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as active_paid FROM users WHERE plan != 'free'")
    active_paid = cursor.fetchone()["active_paid"]
    
    now = int(time.time())
    month_start = now - (86400 * 30)
    cursor.execute("SELECT COUNT(*) as new_month FROM users WHERE created_at >= ?", (month_start,))
    new_users_month = cursor.fetchone()["new_month"]
    
    cursor.execute("SELECT COUNT(*) as total_qrs FROM qr_codes")
    total_qrs = cursor.fetchone()["total_qrs"]
    
    cursor.execute("SELECT COUNT(*) as total_scans FROM scan_logs")
    total_scans = cursor.fetchone()["total_scans"]
    
    conn.close()
    
    return jsonify({
        "total_users": total_users,
        "active_paid_users": active_paid,
        "new_users_this_month": new_users_month,
        "total_qr_codes": total_qrs,
        "total_scans": total_scans
    })

@app.route("/api/admin/users", methods=["GET"])
def api_admin_users():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    q = (request.args.get("q") or "").strip().lower()
    plan_filter = (request.args.get("plan") or "").strip()
    status_filter = (request.args.get("status") or "").strip()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT user_id, COUNT(*) as cnt
    FROM subscriptions
    WHERE (source IS NULL OR source = 'iyzico' OR source LIKE 'iyzi_%')
      AND (refund_status IS NULL OR refund_status != 'refunded')
    GROUP BY user_id
    """)
    paid_counts = {r["user_id"]: int(r["cnt"]) for r in cursor.fetchall()}

    cursor.execute("""
    SELECT 
        u.id, u.name, u.email, u.plan, u.subscription_end, u.dynamic_qr_limit, 
        u.is_admin, u.account_status, u.created_at,
        COUNT(DISTINCT q.id) as total_qr_count
    FROM users u
    LEFT JOIN qr_codes q ON u.id = q.user_id
    GROUP BY u.id, u.name, u.email, u.plan, u.subscription_end, u.dynamic_qr_limit, u.is_admin, u.account_status, u.created_at
    ORDER BY u.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    users = []
    for r in rows:
        d = dict(r)
        d["is_admin"] = bool(d.get("is_admin"))
        d["account_status"] = d.get("account_status") or "active"
        d["paid_subscriptions_count"] = paid_counts.get(d["id"], 0)
        
        name_str = (d.get("name") or "").lower()
        email_str = (d.get("email") or "").lower()
        
        # Apply filters
        if q and (q not in name_str and q not in email_str):
            continue
        if plan_filter and d.get("plan") != plan_filter:
            continue
        if status_filter and d["account_status"] != status_filter:
            continue
            
        users.append(d)
        
    return jsonify({"users": users})

@app.route("/api/admin/users/<int:user_id>", methods=["GET"])
def api_admin_user_detail(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, email, plan, subscription_end, dynamic_qr_limit, COALESCE(is_admin, FALSE) as is_admin, COALESCE(account_status, 'active') as account_status, created_at FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        return jsonify({"error": "Kullanıcı bulunamadı."}), 404
        
    user = dict(user_row)
    user["is_admin"] = bool(user["is_admin"])
    
    # User's QRs
    cursor.execute("SELECT id, title, type, short_code, target_url, scans_count, created_at FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    qrs = cursor.fetchall()
    
    # User's Subscriptions
    cursor.execute("SELECT id, plan_name, amount, status, iyzico_sub_id, invoice_no, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    subs = cursor.fetchall()
    
    conn.close()
    
    return jsonify({
        "user": user,
        "qr_codes": qrs,
        "subscriptions": subs
    })

@app.route("/api/admin/users/<int:user_id>/update-plan", methods=["POST"])
def api_admin_update_plan(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    data = request.json or {}
    new_plan = data.get("plan")
    days = int(data.get("days", 30))
    
    if new_plan not in ["free", "starter", "advanced", "business"]:
        return jsonify({"error": "Geçersiz plan seçimi."}), 400
        
    qr_limit = limit_for_plan(new_plan)
    
    now = int(time.time())
    if new_plan == "business":
        sub_end = now + (86400 * 365 * 10)
    elif new_plan != "free":
        sub_end = now + (86400 * days)
    else:
        sub_end = 0
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT email, plan FROM users WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        return jsonify({"error": "Kullanıcı bulunamadı."}), 404
        
    old_plan = target_user["plan"]
    amount = float(data.get("amount", 0.00))
    source = data.get("source", "manual_admin")
    invoice_no = data.get("invoice_no") or f"DJG2026{uuid.uuid4().hex[:8].upper()}"
    custom_plan_name = data.get("plan_name", f"{new_plan.capitalize()} Paket (Manuel)")
    
    cursor.execute("UPDATE users SET plan = ?, subscription_end = ?, dynamic_qr_limit = ? WHERE id = ?", (new_plan, sub_end, qr_limit, user_id))
    
    # Record plan assignment in subscriptions table
    cursor.execute("""
    INSERT INTO subscriptions (user_id, plan_name, amount, status, iyzico_sub_id, invoice_no, source, refund_status, refund_date, created_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?, 'none', 0, ?)
    """, (user_id, custom_plan_name, amount, f"iyzi_manual_{now}", invoice_no, source, now))
    
    conn.commit()
    conn.close()
    
    log_admin_action(
        admin_id=admin["id"],
        target_user_id=user_id,
        action_type="UPDATE_PLAN",
        details=f"Plan {old_plan} -> {new_plan} ({amount} TL, Kaynak: {source}, Bitiş: {days} gün sonra) olarak güncellendi."
    )
    
    return jsonify({"status": "success", "message": f"Kullanıcı planı {new_plan.upper()} olarak güncellendi."})

# --- Admin Accounting & Revenue Endpoints ---

@app.route("/api/admin/accounting/transactions/create", methods=["POST"])
def api_admin_create_transaction():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    data = request.json or {}
    user_input = str(data.get("user") or data.get("user_id") or "").strip()
    plan_name = str(data.get("plan_name") or "Özel Abonelik / Ödeme").strip()
    amount = float(data.get("amount", 0.00))
    source = data.get("source", "manual_admin")
    invoice_no = str(data.get("invoice_no") or "").strip() or f"DJG2026{uuid.uuid4().hex[:8].upper()}"
    update_user_plan = bool(data.get("update_user_plan", False))
    plan_key = data.get("plan_key", "starter")
    
    if not user_input:
        return jsonify({"error": "Geçerli bir kullanıcı e-postası veya ID girilmelidir."}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    user_id = None
    if user_input.isdigit():
        cursor.execute("SELECT id, email FROM users WHERE id = ?", (int(user_input),))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]
            
    if not user_id:
        cursor.execute("SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)", (user_input,))
        row = cursor.fetchone()
        if row:
            user_id = row["id"]
            
    if not user_id:
        conn.close()
        return jsonify({"error": f"'{user_input}' e-posta veya ID'sine sahip kullanıcı bulunamadı."}), 404
        
    now = int(time.time())
    
    cursor.execute("""
    INSERT INTO subscriptions (user_id, plan_name, amount, status, iyzico_sub_id, invoice_no, source, refund_status, refund_date, created_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?, 'none', 0, ?)
    """, (user_id, plan_name, amount, f"tx_manual_{now}", invoice_no, source, now))
    
    if update_user_plan and plan_key in ["starter", "advanced", "business"]:
        limits = {"starter": 5, "advanced": 25, "business": 100}
        days = int(data.get("days", 30))
        sub_end = now + (86400 * days)
        cursor.execute("UPDATE users SET plan = ?, subscription_end = ?, dynamic_qr_limit = ? WHERE id = ?", 
                       (plan_key, sub_end, limits.get(plan_key, 5), user_id))
                       
    conn.commit()
    conn.close()
    
    log_admin_action(
        admin_id=admin["id"],
        target_user_id=user_id,
        action_type="CREATE_TRANSACTION",
        details=f"Manuel Ödeme Kaydı Eklendi: {amount:.2f} TL, Kaynak: {source}, Fatura: {invoice_no}"
    )
    
    return jsonify({"status": "success", "message": f"{amount:.2f} ₺ tutarındaki ödeme ve fatura kaydı başarıyla eklendi."})

@app.route("/api/admin/accounting/summary", methods=["GET"])
def api_admin_accounting_summary():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Total Revenue (All valid paid subscriptions with amount > 0, excluding refunded)
    cursor.execute("""
    SELECT COALESCE(SUM(amount), 0.0) as total 
    FROM subscriptions 
    WHERE amount > 0 AND (refund_status IS NULL OR refund_status != 'refunded')
    """)
    total_revenue = float(cursor.fetchone()["total"])
    
    # 2. Monthly Revenue (Current Calendar Month)
    now_dt = datetime.datetime.now()
    first_of_this_month = datetime.datetime(now_dt.year, now_dt.month, 1)
    month_start_ts = int(first_of_this_month.timestamp())
    
    cursor.execute("""
    SELECT COALESCE(SUM(amount), 0.0) as month_total 
    FROM subscriptions 
    WHERE amount > 0 AND (refund_status IS NULL OR refund_status != 'refunded') AND created_at >= ?
    """, (month_start_ts,))
    this_month_revenue = float(cursor.fetchone()["month_total"])
    
    # 3. Yearly Revenue (Current Calendar Year)
    first_of_this_year = datetime.datetime(now_dt.year, 1, 1)
    year_start_ts = int(first_of_this_year.timestamp())
    cursor.execute("""
    SELECT COALESCE(SUM(amount), 0.0) as year_total 
    FROM subscriptions 
    WHERE amount > 0 AND (refund_status IS NULL OR refund_status != 'refunded') AND created_at >= ?
    """, (year_start_ts,))
    this_year_revenue = float(cursor.fetchone()["year_total"])
    
    # 4. Actual Paid Subscriptions, Normalized MRR & Monthly Breakdown
    cursor.execute("""
    SELECT plan_name, amount, created_at, user_id
    FROM subscriptions
    WHERE amount > 0 AND (refund_status IS NULL OR refund_status != 'refunded')
    ORDER BY created_at DESC
    """)
    paid_subs = cursor.fetchall()
    
    breakdown = {"starter": 0, "advanced": 0, "business": 0}
    mrr = 0.0
    
    tr_months = {
        1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran",
        7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"
    }
    
    monthly_stats = {}
    
    for r in paid_subs:
        p_name = (r["plan_name"] or "").lower()
        amt = float(r["amount"] or 0.0)
        ts = int(r["created_at"] or time.time())
        
        # Classification for breakdown
        if "starter" in p_name:
            breakdown["starter"] += 1
        elif "advanced" in p_name:
            breakdown["advanced"] += 1
        elif "business" in p_name:
            breakdown["business"] += 1

        # Calculate normalized MRR contribution
        if "yıllık" in p_name or "annual" in p_name or "12 ay" in p_name or amt >= 2000:
            mrr += (amt / 12.0)
        elif "6 aylık" in p_name or "semi" in p_name or "6 ay" in p_name:
            mrr += (amt / 6.0)
        else:
            mrr += amt
            
        # Group by month for month-by-month accounting list
        dt = datetime.datetime.fromtimestamp(ts)
        m_key = dt.strftime("%Y-%m")
        m_label = f"{tr_months.get(dt.month, '')} {dt.year}"
        
        if m_key not in monthly_stats:
            monthly_stats[m_key] = {
                "month_key": m_key,
                "month_label": m_label,
                "total_revenue": 0.0,
                "net_matrah": 0.0,
                "kdv_amount": 0.0,
                "count": 0
            }
            
        st = monthly_stats[m_key]
        st["total_revenue"] += amt
        st["net_matrah"] += (amt / 1.20)
        st["kdv_amount"] += (amt - (amt / 1.20))
        st["count"] += 1
        
    conn.close()
    
    # Sort monthly breakdown descending by month key (most recent first)
    monthly_breakdown = sorted(list(monthly_stats.values()), key=lambda x: x["month_key"], reverse=True)
    
    return jsonify({
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "this_year_revenue": this_year_revenue,
        "mrr": mrr,
        "active_paid_subscriptions": breakdown,
        "monthly_breakdown": monthly_breakdown
    })

@app.route("/api/admin/accounting/transactions", methods=["GET"])
def api_admin_accounting_transactions():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    plan_filter = (request.args.get("plan") or "").strip()
    source_filter = (request.args.get("source") or "").strip()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT 
        s.id, s.user_id, s.plan_name, s.amount, s.status, s.iyzico_sub_id, s.invoice_no,
        COALESCE(s.source, 'iyzico') as source, COALESCE(s.refund_status, 'none') as refund_status, COALESCE(s.refund_date, 0) as refund_date, s.created_at,
        u.name as user_name, u.email as user_email
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    txs = []
    for r in rows:
        d = dict(r)
        
        if plan_filter and plan_filter.lower() not in d["plan_name"].lower():
            continue
        if source_filter:
            sf = source_filter.lower()
            s_val = (d["source"] or "").lower()
            if sf == "manual_admin" and s_val not in ["manual_admin", "manual", "admin"] and not s_val.startswith("tx_manual") and not s_val.startswith("iyzi_manual"):
                continue
            elif sf == "iyzico" and "iyzico" not in s_val:
                continue
            elif sf == "havale_eft" and s_val not in ["havale_eft", "havale", "eft"]:
                continue
            elif sf == "kredi_karti" and s_val not in ["kredi_karti", "pos", "card"]:
                continue
            elif sf == "nakit" and s_val not in ["nakit", "cash"]:
                continue
            elif sf not in ["manual_admin", "iyzico", "havale_eft", "kredi_karti", "nakit"] and sf != s_val:
                continue
            
        amount = float(d["amount"])
        # KDV calculation: 20% VAT in Turkey (Gross amount = Matrah * 1.20)
        matrah = round(amount / 1.20, 2)
        kdv = round(amount - matrah, 2)
        
        d["matrah"] = matrah
        d["kdv"] = kdv
        txs.append(d)
        
    return jsonify({"transactions": txs})

@app.route("/api/admin/subscriptions/<int:sub_id>/update", methods=["POST"])
def api_admin_update_subscription(sub_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()
    
    update_fields = []
    params = []
    if "amount" in data:
        update_fields.append("amount = ?")
        params.append(float(data["amount"]))
    if "source" in data:
        update_fields.append("source = ?")
        params.append(data["source"])
    if "plan_name" in data:
        update_fields.append("plan_name = ?")
        params.append(data["plan_name"])
    if "invoice_no" in data:
        update_fields.append("invoice_no = ?")
        params.append(data["invoice_no"])
        
    if not update_fields:
        conn.close()
        return jsonify({"error": "Güncellenecek alan bulunamadı."}), 400
        
    params.append(sub_id)
    sql = f"UPDATE subscriptions SET {', '.join(update_fields)} WHERE id = ?"
    cursor.execute(sql, tuple(params))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "İşlem kaydı güncellendi."})

@app.route("/api/admin/accounting/export", methods=["GET"])
def api_admin_accounting_export():
    admin, err_resp = require_admin()
    if err_resp:
        token = request.args.get("token")
        if token:
            payload = decode_token(token)
            if payload:
                user = get_user_by_id(payload["user_id"])
                if user and user.get("is_admin"):
                    admin = user
                    err_resp = None
        if err_resp:
            return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        s.id, s.plan_name, s.amount, s.invoice_no, COALESCE(s.source, 'iyzico') as source, 
        COALESCE(s.refund_status, 'none') as refund_status, s.created_at,
        u.name as user_name, u.email as user_email
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    # UTF-8 BOM for Excel compatibility in Turkish
    csv_content = "\ufeffİşlem ID,Tarih,Müşteri Adı,E-posta,Plan,Kaynak,Toplam Tutar (TL),Matrah (KDV Haric),KDV %20 (TL),Fatura No,Durum,İade Durumu\n"
    
    for r in rows:
        d = dict(r)
        amount = float(d["amount"])
        matrah = round(amount / 1.20, 2)
        kdv = round(amount - matrah, 2)
        
        dt_str = time.strftime('%d.%m.%Y %H:%M', time.localtime(d['created_at'])) if d['created_at'] else '-'
        source_label = 'İyzico (Gerçek Ödeme)' if d['source'] == 'iyzico' else 'Admin Manuel'
        refund_label = 'İADE EDİLDİ' if d['refund_status'] == 'refunded' else 'Normal'
        
        line = f'"{d["id"]}","{dt_str}","{d["user_name"] or "-"}","{d["user_email"] or "-"}","{d["plan_name"]}","{source_label}","{amount:.2f}","{matrah:.2f}","{kdv:.2f}","{d["invoice_no"] or "-"}","Aktif","{refund_label}"\n'
        csv_content += line
        
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="muhasebe_gelir_raporu.csv"'}
    )

@app.route("/api/admin/accounting/refund/<int:subscription_id>", methods=["POST"])
def api_admin_accounting_refund(subscription_id):
    """
    Note: This endpoint updates internal subscription status to 'refunded' so it is automatically deducted from revenue summary.
    Actual payment refund must be processed separately via the official iyzico merchant dashboard.
    """
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    now = int(time.time())
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id, amount, plan_name FROM subscriptions WHERE id = ?", (subscription_id,))
    sub = cursor.fetchone()
    if not sub:
        conn.close()
        return jsonify({"error": "Abonelik kaydı bulunamadı."}), 404
        
    cursor.execute("UPDATE subscriptions SET refund_status = 'refunded', refund_date = ? WHERE id = ?", (now, subscription_id))
    conn.commit()
    conn.close()
    
    log_admin_action(
        admin_id=admin["id"],
        target_user_id=sub["user_id"],
        action_type="REFUND_RECORD",
        details=f"Abonelik #{subscription_id} ({sub['plan_name']}, {sub['amount']} TL) sistemde iade edildi olarak işaretlendi."
    )
    
    return jsonify({"status": "success", "message": "Abonelik iade edildi olarak işaretlendi ve muhasebe gelirinden düşüldü."})

@app.route("/api/admin/users/<int:user_id>/suspend", methods=["POST"])
def api_admin_suspend_user(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    if admin["id"] == user_id:
        return jsonify({"error": "Kendi admin hesabınızı askıya alamazsınız."}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET account_status = 'suspended' WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    log_admin_action(admin["id"], user_id, "SUSPEND_USER", "Hesap askıya alındı.")
    return jsonify({"status": "success", "message": "Kullanıcı hesabı askıya alındı."})

@app.route("/api/admin/users/<int:user_id>/activate", methods=["POST"])
def api_admin_activate_user(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET account_status = 'active' WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    log_admin_action(admin["id"], user_id, "ACTIVATE_USER", "Hesap tekrar aktif edildi.")
    return jsonify({"status": "success", "message": "Kullanıcı hesabı tekrar aktif edildi."})

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def api_admin_delete_user(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    if admin["id"] == user_id:
        return jsonify({"error": "Kendi admin hesabınızı silemezsiniz."}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        return jsonify({"error": "Kullanıcı bulunamadı."}), 404
        
    target_email = target_user["email"]
    
    # Delete user and cascading data
    cursor.execute("DELETE FROM scan_logs WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user_id,))
    cursor.execute("DELETE FROM vcard_pages WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user_id,))
    cursor.execute("DELETE FROM menu_pages WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user_id,))
    cursor.execute("DELETE FROM qr_codes WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM subscriptions WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    log_admin_action(admin["id"], None, "DELETE_USER", f"Kullanıcı ({target_email}, ID: {user_id}) ve tüm verileri kalıcı olarak silindi.")
    return jsonify({"status": "success", "message": "Kullanıcı ve tüm verileri kalıcı olarak silindi."})

@app.route("/api/admin/audit-logs", methods=["GET"])
def api_admin_audit_logs():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        a.id, a.admin_id, a.target_user_id, a.action_type, a.details, a.created_at,
        u_admin.name as admin_name, u_admin.email as admin_email,
        u_target.name as target_name, u_target.email as target_email
    FROM admin_actions a
    LEFT JOIN users u_admin ON a.admin_id = u_admin.id
    LEFT JOIN users u_target ON a.target_user_id = u_target.id
    ORDER BY a.created_at DESC
    LIMIT 100
    """)
    logs = cursor.fetchall()
    conn.close()
    
    return jsonify({"audit_logs": logs})

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Sunucu hatası oluştu. Lütfen tekrar deneyin."}), 500

@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "İstenen kaynak bulunamadı."}), 404
        return "Dosya bulunamadı", 404
    elif request.path.startswith("/p/") or request.path.startswith("/r/"):
        return _err_not_found()
    return render_template("index.html"), 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    debug_mode = os.environ.get("FLASK_ENV") == "development" or os.environ.get("FLASK_DEBUG") == "1"
    print(f"🚀 Dijitalgru QR SaaS Sunucusu Başlatılıyor: http://localhost:{port} (debug={debug_mode})")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
