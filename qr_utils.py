"""
QR Studio — ortak yardımcılar (sunucu tarafı tek kaynak).

Bu modül hem kayıt (create/update) hem de yönlendirme (/r/<kod>) katmanında
kullanılır; böylece daha önce basılmış (bozuk veri kaydeden) QR'lar da
tarandığında doğru çalışır. JS karşılığı: static/js/qr-utils.js
"""
import re
import json
import datetime
from urllib.parse import quote, unquote, urlparse, parse_qs

# --------------------------------------------------------------------------
# Tür grupları
# --------------------------------------------------------------------------
SOCIAL_TYPES = ("instagram", "linkedin", "pinterest", "facebook")
VCARD_TYPES = ("vcard", "company_card")
MENU_TYPES = ("menu", "pdf_catalog", "pdf_viewer", "restaurant_menu")
STATIC_RAW_TYPES = ("phone", "sms", "text", "wifi")          # QR'a ham içerik yazılır
STATIC_TYPES = ("static_url",) + STATIC_RAW_TYPES
WHATSAPP_TYPES = ("dynamic_whatsapp", "whatsapp")
DYNAMIC_TYPES = (
    "url", "vcard", "company_card", "menu", "pdf_catalog", "pdf_viewer",
    "restaurant_menu", "social", "dynamic_whatsapp", "whatsapp",
    "instagram", "linkedin", "pinterest", "facebook",
)

DANGEROUS_SCHEME_RE = re.compile(r"^\s*(javascript|data|vbscript|file|blob)\s*:", re.I)

# --------------------------------------------------------------------------
# Sosyal medya
# --------------------------------------------------------------------------
SOCIAL_BASES = {
    "instagram": "https://instagram.com/",
    "facebook": "https://facebook.com/",
    "pinterest": "https://pinterest.com/",
    "linkedin": "https://linkedin.com/in/",
    "twitter": "https://x.com/",
    "x": "https://x.com/",
    "tiktok": "https://tiktok.com/@",
    "youtube": "https://youtube.com/@",
}
SOCIAL_HOST_HINTS = {
    "instagram": "instagram.com", "facebook": "facebook.com", "pinterest": "pinterest.com",
    "linkedin": "linkedin.com", "twitter": "x.com", "x": "x.com",
    "tiktok": "tiktok.com", "youtube": "youtube.com",
}
_DOMAIN_LIKE_RE = re.compile(r"^(?:www\.|m\.)?[^\s/@:]+\.[^\s/@:.]{2,}(?:[/?#:].*)?$", re.I)
_USERNAME_RE = re.compile(r"^[\w.\-]+$", re.U)


def _host_has_dot(url):
    try:
        p = urlparse(url)
        host = p.hostname or ""
    except ValueError:
        # https://javascript:alert(1) gibi
        m = re.match(r"^https?://([^/:?#]+)", url, re.I)
        host = m.group(1) if m else ""
    return ("." in host), host


def normalize_social(platform, value):
    """
    '@kullanici' / 'kullanici' / 'instagram.com/kullanici' / tam URL -> tam profil URL.
    Alan adı içermeyen bozuk 'https://kullanici' değerlerini platform adresine çevirir.
    Güvenli olmayan şemalar ve çözümlenemeyen değerler için '' döner.
    """
    platform = (platform or "").lower().strip()
    v = str(value or "").strip()
    if not v:
        return ""
    if DANGEROUS_SCHEME_RE.match(v):
        return ""
    base = SOCIAL_BASES.get(platform)

    # Tam URL
    if re.match(r"^https?://", v, re.I):
        has_dot, host = _host_has_dot(v)
        if has_dot:
            return v
        # https://kullanici veya https://@kullanici -> kullanıcı adı olarak ele al
        rest = re.sub(r"^https?://", "", v, flags=re.I)
        v = rest
        if not base:
            return ""
    elif re.match(r"^//", v):
        v = "https:" + v
        return v if _host_has_dot(v)[0] else ""

    # alan adı gibi (instagram.com/kullanici, www.siteniz.com)
    if _DOMAIN_LIKE_RE.match(v):
        return "https://" + v

    if not base:
        return ""

    username = v.lstrip("@").strip().strip("/")
    if not username:
        return ""
    if platform == "linkedin":
        if re.match(r"^(in|company|school|pub)/", username, re.I):
            return "https://linkedin.com/" + quote(username, safe="/._-%")
        username = username.split("/")[0]
    else:
        username = username.split("/")[0] if "/" in username and platform in ("instagram", "tiktok", "youtube", "twitter", "x") else username
    if not username or not _USERNAME_RE.match(username.replace("/", "")):
        username = quote(username, safe="/._-")
    return base + username


def normalize_social_links(links):
    """dict[str,str] -> normalize edilmiş dict (boşlar atılır)."""
    out = {}
    if not isinstance(links, dict):
        return out
    for k, v in links.items():
        n = normalize_social(k, v)
        if n:
            out[k] = n
    return out


# --------------------------------------------------------------------------
# Telefon
# --------------------------------------------------------------------------
def normalize_phone_for_wa(raw):
    """WhatsApp (wa.me) için yalnızca rakam: 05xx -> 905xx, 5xxxxxxxxx -> 905xxxxxxxxx."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if not digits:
        return ""
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "90" + digits[1:]
    elif len(digits) == 10 and digits.startswith("5"):
        digits = "90" + digits
    return digits


def is_valid_wa_number(digits):
    if not digits or not digits.isdigit():
        return False
    if digits.startswith("90"):
        return len(digits) == 12
    return 10 <= len(digits) <= 15


def normalize_phone_e164(raw):
    """Boşluk/parantez/tire temizlenmiş E.164: +905376274415. Tanınmazsa temizlenmiş ham değer."""
    s = str(raw or "").strip()
    if not s:
        return ""
    plus = s.startswith("+")
    digits = re.sub(r"\D", "", s)
    if not digits:
        return ""
    if plus:
        return "+" + digits
    if digits.startswith("00"):
        return "+" + digits[2:]
    if digits.startswith("0"):
        return "+90" + digits[1:]
    if len(digits) == 10 and digits.startswith("5"):
        return "+90" + digits
    if digits.startswith("90") and len(digits) == 12:
        return "+" + digits
    return ("+" + digits) if len(digits) >= 11 else digits


def is_valid_phone(raw):
    d = re.sub(r"\D", "", normalize_phone_e164(raw))
    if normalize_phone_e164(raw).startswith("+90"):
        return len(d) == 12
    return 7 <= len(d) <= 15


# --------------------------------------------------------------------------
# URL doğrulama
# --------------------------------------------------------------------------
_HOST_RE = re.compile(r"^(?=.{1,253}$)([^\W_](?:[\w\-]{0,61}[^\W_])?)(\.[^\W_](?:[\w\-]{0,61}[^\W_])?)+$", re.U)


def validate_url(raw, allow_relative=False):
    """
    -> (ok, normalized_url, hata_mesajı)
    Sadece http/https; geçerli alan adı (nokta içermeli). javascript:/data:/vbscript: reddedilir.
    """
    v = str(raw or "").strip()
    if not v:
        return False, "", "Lütfen bir web adresi girin."
    if DANGEROUS_SCHEME_RE.match(v):
        return False, "", "Güvenlik nedeniyle bu adres türü kabul edilmiyor. Lütfen http:// veya https:// ile başlayan bir adres girin."
    if re.search(r"\s", v):
        return False, "", "Web adresi boşluk içeremez."
    if allow_relative and v.startswith("/") and not v.startswith("//"):
        return True, v, ""
    if v.startswith("//"):
        v = "https:" + v
    if not re.match(r"^https?://", v, re.I):
        if re.match(r"^[a-z][a-z0-9+.\-]*://", v, re.I) or re.match(r"^(mailto|tel|sms|ftp):", v, re.I):
            return False, "", "Sadece http:// veya https:// ile başlayan adresler kabul edilir."
        v = "https://" + v
    try:
        p = urlparse(v)
        host = p.hostname or ""
        p.port  # geçersiz portu yakalar
    except ValueError:
        return False, "", "Geçerli bir web adresi girin (örn: https://siteniz.com)."
    if not host or "." not in host or not (_HOST_RE.match(host) or re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host)):
        return False, "", "Geçerli bir alan adı girin (örn: siteniz.com)."
    return True, v, ""


# --------------------------------------------------------------------------
# Statik içerik (QR görseline doğrudan yazılan standart içerik)
# --------------------------------------------------------------------------
def wifi_escape(s):
    return re.sub(r'([\\;,:"])', r"\\\1", str(s or ""))


def build_wifi_content(ssid, password="", enc="WPA", hidden=False):
    enc = (enc or "WPA").strip()
    if enc.lower() in ("nopass", "none", "open", "sifresiz", "şifresiz"):
        enc = "nopass"
    elif enc.upper() in ("WEP",):
        enc = "WEP"
    else:
        enc = "WPA"
    h = "true" if hidden else "false"
    if enc == "nopass":
        return "WIFI:T:nopass;S:%s;H:%s;;" % (wifi_escape(ssid), h)
    return "WIFI:T:%s;S:%s;P:%s;H:%s;;" % (enc, wifi_escape(ssid), wifi_escape(password), h)


def parse_wifi(content):
    """Yeni ve eski ('WIFI:S:x;T:WPA;P:y;;') biçimleri, kaçışlı karakterlerle birlikte çözer."""
    s = str(content or "").strip()
    out = {"ssid": "", "password": "", "enc": "WPA", "hidden": False}
    if s[:5].upper() == "WIFI:":
        s = s[5:]
    fields = {}
    cur_key, buf, i, state = "", [], 0, "key"
    while i < len(s):
        ch = s[i]
        if ch == "\\" and i + 1 < len(s):
            buf.append(s[i + 1])
            i += 2
            continue
        if state == "key":
            if ch == ":":
                cur_key = "".join(buf).strip().upper()
                buf, state = [], "val"
            elif ch == ";":
                buf = []
            else:
                buf.append(ch)
        else:
            if ch == ";":
                fields[cur_key] = "".join(buf)
                buf, state = [], "key"
            else:
                buf.append(ch)
        i += 1
    if state == "val" and cur_key:
        fields[cur_key] = "".join(buf)
    out["ssid"] = fields.get("S", "")
    out["password"] = fields.get("P", "")
    t = (fields.get("T") or "WPA").strip()
    out["enc"] = "nopass" if t.lower() == "nopass" else ("WEP" if t.upper() == "WEP" else "WPA")
    out["hidden"] = str(fields.get("H", "")).lower() == "true"
    return out


def build_phone_content(phone):
    return "tel:" + normalize_phone_e164(re.sub(r"^tel:", "", str(phone or ""), flags=re.I))


def parse_phone(content):
    return re.sub(r"^tel:", "", str(content or "").strip(), flags=re.I).strip()


def build_sms_content(phone, message):
    return "SMSTO:%s:%s" % (normalize_phone_e164(phone), str(message or ""))


def parse_sms(content):
    """-> {'phone': str, 'message': str}. Eski kayıtlarda numara yoksa tüm içerik mesajdır."""
    s = str(content or "")
    m = re.match(r"^\s*smsto:([^:]*):(.*)$", s, re.I | re.S)
    if m:
        return {"phone": m.group(1).strip(), "message": m.group(2)}
    m = re.match(r"^\s*sms:([^?;]*)(?:[?;&]body=(.*))?$", s, re.I | re.S)
    if m:
        return {"phone": unquote(m.group(1)).strip(), "message": unquote(m.group(2) or "")}
    return {"phone": "", "message": s}


def static_content_for(qr_type, target_url):
    """QR görseline yazılacak standart içerik (yeni ve eski kayıtlar için)."""
    t = str(target_url or "")
    if qr_type == "phone":
        return build_phone_content(parse_phone(t))
    if qr_type == "sms":
        d = parse_sms(t)
        return build_sms_content(d["phone"], d["message"]) if d["phone"] else d["message"]
    if qr_type == "wifi":
        d = parse_wifi(t)
        return build_wifi_content(d["ssid"], d["password"], d["enc"], d["hidden"])
    return t  # text, static_url


def build_static_target(qr_type, sp, target_url=""):
    """
    static_payload (dict) -> (canonical_content, field_errors)
    sp yoksa eski istemci uyumluluğu için target_url ham değer kabul edilir.
    """
    sp = sp if isinstance(sp, dict) else {}
    errs = {}
    if qr_type == "static_url":
        ok, url, msg = validate_url(sp.get("url") or target_url)
        if not ok:
            errs["target_url"] = msg
        return url, errs
    if qr_type == "phone":
        raw = sp.get("phone") or parse_phone(target_url)
        if not str(raw or "").strip():
            errs["phone"] = "Lütfen bir telefon numarası girin."
        elif not is_valid_phone(raw):
            errs["phone"] = "Geçerli bir telefon numarası girin (örn: +90 537 627 44 15)."
        return build_phone_content(raw), errs
    if qr_type == "sms":
        if sp:
            phone, msg_text = sp.get("phone"), sp.get("message")
        else:
            d = parse_sms(target_url)
            phone, msg_text = d["phone"], d["message"]
        if not str(phone or "").strip():
            errs["phone"] = "Lütfen SMS gönderilecek telefon numarasını girin."
        elif not is_valid_phone(phone):
            errs["phone"] = "Geçerli bir telefon numarası girin (örn: +90 537 627 44 15)."
        return build_sms_content(phone, msg_text), errs
    if qr_type == "text":
        text = sp.get("text") if "text" in sp else target_url
        if not str(text or "").strip():
            errs["text"] = "Lütfen bir metin girin."
        elif len(str(text)) > 1200:
            errs["text"] = "Metin en fazla 1200 karakter olabilir."
        return str(text or ""), errs
    if qr_type == "wifi":
        if sp:
            d = {"ssid": sp.get("ssid"), "password": sp.get("password"),
                 "enc": sp.get("encryption") or sp.get("enc"), "hidden": bool(sp.get("hidden"))}
        else:
            d = parse_wifi(target_url)
        ssid = str(d.get("ssid") or "")
        pw = str(d.get("password") or "")
        enc = d.get("enc") or "WPA"
        content = build_wifi_content(ssid, pw, enc, d.get("hidden"))
        if not ssid.strip():
            errs["ssid"] = "Lütfen Wi-Fi ağ adını (SSID) girin."
        if "nopass" not in content and not pw:
            errs["password"] = "Lütfen Wi-Fi şifresini girin veya 'Şifresiz' seçin."
        elif "T:WPA" in content and pw and len(pw) < 8:
            errs["password"] = "WPA/WPA2 şifresi en az 8 karakter olmalıdır."
        return content, errs
    return str(target_url or ""), errs


# --------------------------------------------------------------------------
# WhatsApp
# --------------------------------------------------------------------------
def parse_whatsapp_target(target_url):
    """Mevcut hedeften (https://wa.me/<num>?text=...) numara + mesaj çıkarır (bozuk biçimler dahil)."""
    t = str(target_url or "").strip()
    phone, message = "", ""
    m = re.match(r"^(?:https?://)?(?:wa\.me|api\.whatsapp\.com/send\?phone=)/?([^?]*)(?:\?(.*))?$", t, re.I | re.S)
    if m:
        phone = unquote(m.group(1))
        qs = m.group(2) or ""
        q = parse_qs(qs, keep_blank_values=True)
        message = (q.get("text") or [""])[0]
    else:
        phone = t
    return phone, message


def build_whatsapp_url(phone, message=""):
    num = normalize_phone_for_wa(phone)
    url = "https://wa.me/" + num
    if message:
        url += "?text=" + quote(str(message), safe="")
    return url


# --------------------------------------------------------------------------
# Analitik yardımcıları
# --------------------------------------------------------------------------
_BOT_RE = re.compile(
    r"bot|crawler|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|slackbot|discord|"
    r"linkedinbot|skypeuripreview|preview|embedly|pinterest|google-|googlebot|bingpreview|yandex|"
    r"curl/|wget/|python-requests|go-http-client|okhttp/|java/|headless|lighthouse|monitor|uptime",
    re.I,
)


def is_bot_request(user_agent, method="GET"):
    if (method or "GET").upper() in ("HEAD", "OPTIONS"):
        return True
    ua = str(user_agent or "")
    if not ua.strip():
        return True
    return bool(_BOT_RE.search(ua))


def mask_ip(ip):
    ip = str(ip or "").strip()
    if not ip or ip == "-":
        return "-"
    if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", ip):
        return ".".join(ip.split(".")[:3] + ["0"])
    if ":" in ip:
        parts = ip.split(":")
        return ":".join(parts[:3]) + "::"
    return ip


TR_TZ_NAME = "Europe/Istanbul"
try:
    from zoneinfo import ZoneInfo
    _TR_TZ = ZoneInfo(TR_TZ_NAME)
except Exception:  # tzdata yoksa: Türkiye 2016'dan beri sabit UTC+3
    _TR_TZ = datetime.timezone(datetime.timedelta(hours=3))


def to_istanbul(ts):
    """Unix zaman damgası (UTC) -> Europe/Istanbul datetime."""
    return datetime.datetime.fromtimestamp(int(ts or 0), tz=datetime.timezone.utc).astimezone(_TR_TZ)


def fmt_istanbul(ts, fmt="%Y-%m-%d %H:%M:%S"):
    try:
        return to_istanbul(ts).strftime(fmt)
    except Exception:
        return "-"
