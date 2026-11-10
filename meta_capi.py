"""
Meta Dönüşümler API (CAPI) entegrasyonu.

Ortam değişkenleri (Railway):
  META_PIXEL_ID          -> Piksel ID (tarayıcı + CAPI)
  META_CAPI_TOKEN        -> CAPI erişim belirteci (ASLA kodda tutulmaz)
  META_TEST_EVENT_CODE   -> (opsiyonel) Olay Yöneticisi > "Olayları test et" kodu.
                            Boşsa istekte test_event_code gönderilmez.
  META_CAPI_REQUIRE_CONSENT -> "0" yapılmazsa (varsayılan "1") sunucu olayları da
                            yalnızca kullanıcı çerez bandında "Kabul et" dediyse gönderilir (KVKK).

KİŞİSEL VERİ KURALI: T.C. kimlik no, kart bilgisi ve adres ASLA gönderilmez.
user_data içinde yalnızca SHA-256 ile hashlenmiş e-posta + telefon, ve hashlenmeyen
teknik alanlar (IP, user-agent, fbp, fbc) bulunur.
"""
import hashlib
import json
import os
import re
import threading
import time
import urllib.request

from db import get_db, is_postgres

GRAPH_VERSION = "v21.0"
SITE_URL = "https://qrdijitalgru.com/"

PLAN_SHORT_NAMES = {
    "starter": "Başlangıç",
    "advanced": "Profesyonel",
    "business": "Kurumsal",
}

# custom_data içine yalnızca bu alanlar girebilir (PII sızıntısına karşı beyaz liste)
_ALLOWED_CUSTOM_KEYS = {"value", "currency", "content_name"}


def _env(name):
    return (os.environ.get(name) or "").strip()


def pixel_id():
    return _env("META_PIXEL_ID")


def capi_enabled():
    return bool(pixel_id() and _env("META_CAPI_TOKEN"))


def consent_ok(req):
    """Kullanıcı çerez bandında 'Kabul et' dediyse True (mc_consent=1 çerezi)."""
    if _env("META_CAPI_REQUIRE_CONSENT") == "0":
        return True
    try:
        return req.cookies.get("mc_consent") == "1"
    except Exception:
        return False


# ---------------------------------------------------------------- hashing
def hash_email(email):
    v = (email or "").strip().lower().replace(" ", "")
    if not v or "@" not in v:
        return None
    return hashlib.sha256(v.encode("utf-8")).hexdigest()


def normalize_phone(raw):
    """Yalnızca rakamlar; Türkiye için 90 ile başlayacak şekilde normalize edilir."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if not digits:
        return None
    if digits.startswith("90") and len(digits) == 12:
        return digits
    if digits.startswith("0") and len(digits) == 11:
        return "90" + digits[1:]
    if len(digits) == 10:
        return "90" + digits
    return digits


def hash_phone(raw):
    p = normalize_phone(raw)
    if not p:
        return None
    return hashlib.sha256(p.encode("utf-8")).hexdigest()


def build_user_data(email=None, phone=None, ip=None, user_agent=None, fbp=None, fbc=None):
    ud = {}
    em = hash_email(email)
    ph = hash_phone(phone)
    if em:
        ud["em"] = [em]
    if ph:
        ud["ph"] = [ph]
    if ip:
        ud["client_ip_address"] = ip
    if user_agent:
        ud["client_user_agent"] = user_agent
    if fbp:
        ud["fbp"] = fbp
    if fbc:
        ud["fbc"] = fbc
    return ud


# ---------------------------------------------------------------- sending
def build_payload(event_name, event_id, event_source_url, user_data, custom_data=None):
    event = {
        "event_name": event_name,
        "event_time": int(time.time()),
        "event_id": str(event_id),
        "action_source": "website",
        "event_source_url": event_source_url or SITE_URL,
        "user_data": user_data or {},
    }
    if custom_data:
        event["custom_data"] = {k: v for k, v in custom_data.items() if k in _ALLOWED_CUSTOM_KEYS}
    payload = {"data": [event]}
    test_code = _env("META_TEST_EVENT_CODE")
    if test_code:  # boşsa hiç gönderilmez
        payload["test_event_code"] = test_code
    return payload


def _post(payload):
    try:
        url = f"https://graph.facebook.com/{GRAPH_VERSION}/{pixel_id()}/events"
        body = dict(payload)
        body["access_token"] = _env("META_CAPI_TOKEN")
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            out = resp.read().decode("utf-8", "ignore")
            print(f"[meta_capi] OK {payload['data'][0]['event_name']} -> {out[:200]}")
    except Exception as e:
        # Token loglanmaz
        msg = str(e)
        tok = _env("META_CAPI_TOKEN")
        if tok:
            msg = msg.replace(tok, "***")
        print(f"[meta_capi] ERROR sending event: {msg}")


def send_event(event_name, event_id, event_source_url, user_data, custom_data=None):
    """Arka plan thread'inde gönderir; hiçbir koşulda ana akışı bozmaz."""
    if not capi_enabled():
        return False
    try:
        payload = build_payload(event_name, event_id, event_source_url, user_data, custom_data)
        threading.Thread(target=_post, args=(payload,), daemon=True).start()
        return True
    except Exception as e:
        print(f"[meta_capi] build error: {e}")
        return False


def _client_ip(req):
    ip = req.headers.get("X-Forwarded-For", "") or req.remote_addr or ""
    return ip.split(",")[0].strip() or None


# ---------------------------------------------------------------- event helpers
def send_registration(req, user):
    """CompleteRegistration (event_id = yeni kullanıcı id'si; tarayıcıdaki eventID ile aynı)."""
    try:
        if not capi_enabled() or not consent_ok(req):
            return False
        ud = build_user_data(
            email=user.get("email"),
            ip=_client_ip(req),
            user_agent=req.headers.get("User-Agent"),
            fbp=req.cookies.get("_fbp"),
            fbc=req.cookies.get("_fbc"),
        )
        return send_event(
            "CompleteRegistration",
            str(user.get("id")),
            req.headers.get("Referer") or SITE_URL,
            ud,
            {"content_name": "QR Studio Ücretsiz"},
        )
    except Exception as e:
        print(f"[meta_capi] registration error: {e}")
        return False


def _ensure_ctx_table(conn):
    cur = conn.cursor()
    pk = "SERIAL PRIMARY KEY" if is_postgres() else "INTEGER PRIMARY KEY AUTOINCREMENT"
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS meta_checkout_ctx (
        id {pk},
        token TEXT UNIQUE NOT NULL,
        fbp TEXT,
        fbc TEXT,
        ip TEXT,
        user_agent TEXT,
        source_url TEXT,
        consent INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL
    )
    """)
    conn.commit()


def save_checkout_ctx(req, token):
    """
    iyzico callback'i farklı site üzerinden POST ile döndüğü için SameSite çerezleri gelmez.
    Bu yüzden fbp/fbc/IP/UA/onay bilgisi ödeme formu açılırken (aynı site isteği) saklanır.
    Kart/kimlik/adres BURADA SAKLANMAZ.
    """
    if not token:
        return
    try:
        conn = get_db()
        try:
            _ensure_ctx_table(conn)
            cur = conn.cursor()
            cur.execute("DELETE FROM meta_checkout_ctx WHERE token = ?", (token,))
            # eski kayıtları temizle (7 gün)
            cur.execute("DELETE FROM meta_checkout_ctx WHERE created_at < ?", (int(time.time()) - 7 * 86400,))
            cur.execute(
                "INSERT INTO meta_checkout_ctx (token, fbp, fbc, ip, user_agent, source_url, consent, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    token,
                    req.cookies.get("_fbp"),
                    req.cookies.get("_fbc"),
                    _client_ip(req),
                    req.headers.get("User-Agent"),
                    req.headers.get("Referer") or SITE_URL,
                    1 if consent_ok(req) else 0,
                    int(time.time()),
                ),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        print(f"[meta_capi] save_checkout_ctx error: {e}")


def _load_ctx(token):
    try:
        conn = get_db()
        try:
            _ensure_ctx_table(conn)
            cur = conn.cursor()
            cur.execute("SELECT fbp, fbc, ip, user_agent, source_url, consent FROM meta_checkout_ctx WHERE token = ?", (token,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
    except Exception as e:
        print(f"[meta_capi] load ctx error: {e}")
        return None


def send_purchase(req, token, result):
    """
    Purchase — SADECE iyzico ödemesi sunucuda doğrulandıktan sonra çağrılır.
    result: verify_and_process_iyzico_callback başarı çıktısı.
    Dönüş: tarayıcı Purchase olayı için gerekli bilgiler (consent / event_id / value / name).
    """
    info = {
        "event_id": str(result.get("payment_id") or ""),
        "value": float(result.get("amount") or 0),
        "content_name": PLAN_SHORT_NAMES.get(result.get("plan"), str(result.get("plan") or "")),
    }
    try:
        if not capi_enabled() or result.get("already_processed"):
            return info
        ctx = _load_ctx(token) or {}
        if _env("META_CAPI_REQUIRE_CONSENT") != "0" and not ctx.get("consent"):
            return info

        email = phone = None
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute("SELECT email, gsm_number FROM users WHERE id = ?", (result.get("user_id"),))
            row = cur.fetchone()
            if row:
                email, phone = row["email"], row["gsm_number"]
        finally:
            conn.close()

        ud = build_user_data(
            email=email,
            phone=phone,
            ip=ctx.get("ip") or _client_ip(req),
            user_agent=ctx.get("user_agent") or req.headers.get("User-Agent"),
            fbp=ctx.get("fbp") or req.cookies.get("_fbp"),
            fbc=ctx.get("fbc") or req.cookies.get("_fbc"),
        )
        send_event(
            "Purchase",
            info["event_id"],
            ctx.get("source_url") or SITE_URL,
            ud,
            {"value": info["value"], "currency": "TRY", "content_name": info["content_name"]},
        )
    except Exception as e:
        print(f"[meta_capi] purchase error: {e}")
    return info
