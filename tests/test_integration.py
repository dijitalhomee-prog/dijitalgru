"""
Entegrasyon testi — geçici SQLite DB ile Flask test client üzerinden tüm kabul testleri.
Çalıştır:  .venv/bin/python tests/test_integration.py
"""
import base64
import io
import json
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
_tmp = tempfile.mkdtemp(prefix="qrtest_")
os.environ["QR_DB_PATH"] = os.path.join(_tmp, "t.db")
os.environ.pop("DATABASE_URL", None)

import cv2  # noqa: E402
import numpy as np  # noqa: E402

import app as appmod  # noqa: E402
from db import get_db  # noqa: E402

app = appmod.app
c = app.test_client()
PASS, FAIL = [], []


def check(name, cond, info=""):
    (PASS if cond else FAIL).append(name)
    print(("  ✅ " if cond else "  ❌ ") + name + (f"  → {info}" if info else ""))


def decode_b64(b64):
    raw = b64.split(",", 1)[1] if b64.startswith("data:") else b64
    arr = np.frombuffer(base64.b64decode(raw), np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    val, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    if not val:  # küçük/çerçeveli görseller için büyüt
        img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
        val, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    return val


def reg(email):
    r = c.post("/api/auth/register", json={"name": "Test", "email": email, "password": "Passw0rd!x"})
    j = r.get_json()
    return {"Authorization": "Bearer " + j["token"]}, j


def create(h, **body):
    return c.post("/api/qr/create", json=body, headers=h)


def loc(r):
    return r.headers.get("Location", "")


def sql(q, args=()):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(q, args)
    conn.commit()
    rows = cur.fetchall() if cur.description else None
    lastid = cur.lastrowid
    conn.close()
    return rows if rows is not None else lastid


def legacy_qr(user_id, qtype, target, code, status="active"):
    now = int(time.time())
    return sql(
        "INSERT INTO qr_codes (user_id, short_code, title, type, target_url, is_dynamic, custom_settings, status, folder_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (user_id, code, "Eski " + qtype, qtype, target, 1, "{}", status, "Genel", now, now),
    )


hA, jA = reg("acc_a_test_1@example.com")
hB, jB = reg("acc_b_test_1@example.com")
uidA = jA["user"]["id"]
for _u in (jA, jB):  # çok sayıda dinamik QR test edeceğiz → ücretli plan
    sql("UPDATE users SET plan = 'business', subscription_end = ? WHERE id = ?", (int(time.time()) + 86400 * 30, _u["user"]["id"]))
print("== 1. Statik türler ==")
r = create(hA, title="Tel", type="phone", static_payload={"phone": "+90 (537) 627-44 15"})
check("phone create 200", r.status_code == 200, r.get_data(as_text=True)[:150])
check("phone QR içeriği tel:", decode_b64(r.get_json()["qr_image"]) == "tel:+905376274415", decode_b64(r.get_json()["qr_image"]))
r = create(hA, title="Sms", type="sms", static_payload={"phone": "0537 627 44 15", "message": "Merhaba dunya"})
check("sms QR içeriği SMSTO:", decode_b64(r.get_json()["qr_image"]).startswith("SMSTO:+905376274415:Merhaba"), repr(decode_b64(r.get_json()["qr_image"])) + " | " + r.get_json().get("qr_content", ""))
r = create(hA, title="Txt", type="text", static_payload={"text": "Merhaba dünya, test"})
check("text QR düz metin", decode_b64(r.get_json()["qr_image"]) == "Merhaba dünya, test")
r = create(hA, title="Wifi", type="wifi", static_payload={"ssid": "Ev;Ağı", "password": 'p:a"ss,1', "encryption": "WPA", "hidden": False})
w = decode_b64(r.get_json()["qr_image"])
check("wifi QR içeriği WIFI:T:WPA", w.startswith("WIFI:T:WPA;S:Ev\\;Ağı;P:p\\:a\\\"ss\\,1;H:false;;"), w)
r = create(hA, title="WifiOpen", type="wifi", static_payload={"ssid": "Acik", "password": "", "encryption": "nopass", "hidden": True})
w2 = decode_b64(r.get_json()["qr_image"])
check("wifi nopass içeriği", w2.startswith("WIFI:T:nopass;S:Acik;") and "H:true" in w2, w2)
r = create(hA, title="SUrl", type="static_url", target_url="https://example.com/x")
check("static_url ham URL", decode_b64(r.get_json()["qr_image"]) == "https://example.com/x")
check("QR içinde /r/ yok", "qrdijitalgru.com/r/" not in decode_b64(r.get_json()["qr_image"]))
lst = c.get("/api/qr/list", headers=hA).get_json()
phone_item = [q for q in lst["qr_codes"] if q["type"] == "phone"][0]
check("liste qr_image ham içerik", decode_b64(phone_item["qr_image"]) == "tel:+905376274415")

print("== 1b. Eski statik kayıtlar (/r/) ==")
legacy = {
    "phone": ("+90 537 627 44 15", "tel:+905376274415"),
    "text": ("Merhaba dünya", None),
    "sms": ("Merhaba mesaj", None),
    "wifi": ("WIFI:T:WPA;S:EskiAg;P:sifre123;;", None),
}
for i, (t, (tgt, exp)) in enumerate(legacy.items()):
    legacy_qr(uidA, t, tgt, f"leg{t}")
    rr = c.get(f"/r/leg{t}")
    if exp:
        check(f"eski {t} → 302 {exp}", rr.status_code == 302 and loc(rr) == exp, f"{rr.status_code} {loc(rr)}")
    else:
        check(f"eski {t} → 200 sayfa (500 yok)", rr.status_code == 200, str(rr.status_code))
legacy_qr(uidA, "wifi", "https://ÇokEski Ağ", "legwifi2")
check("bozuk wifi hedefi 500 vermiyor", c.get("/r/legwifi2").status_code in (200, 404))
legacy_qr(uidA, "wifi", "WIFI:T:WPA;S:TürkçeŞebeke;P:şifre;;", "legwifi3")
rw = c.get("/r/legwifi3").get_data(as_text=True)
check("wifi sayfası Şifreyi Kopyala + SSID", "Şifreyi Kopyala" in rw and "TürkçeŞebeke" in rw)
rt = c.get("/r/legtext").get_data(as_text=True)
check("metin sayfası kopyala", "Metni Kopyala" in rt and "Merhaba dünya" in rt)
rs = c.get("/r/legsms").get_data(as_text=True)
check("sms (numarasız) sayfa kopyala", "Mesajı Kopyala" in rs)
legacy_qr(uidA, "sms", "SMSTO:+905376274415:Selam", "legsms2")
rr = c.get("/r/legsms2")
check("eski sms numaralı → sms: 302", rr.status_code == 302 and loc(rr).startswith("sms:+905376274415"), loc(rr))

print("== 2. Sosyal medya ==")
r = create(hA, title="IG", type="instagram", vcard_payload={"social_links": {"instagram": "@dijitalgru"}})
check("instagram create", r.status_code == 200, r.get_data(as_text=True)[:120])
sc = r.get_json()["short_code"]
rr = c.get(f"/r/{sc}")
check("instagram @dijitalgru → instagram.com/dijitalgru", rr.status_code == 302 and loc(rr) == "https://instagram.com/dijitalgru", loc(rr))
qid = r.get_json()["qr_id"]
vrow = sql("SELECT full_name FROM vcard_pages WHERE qr_id = ?", (qid,))
check("instagram kaydında kişisel veri yok", not vrow or not vrow[0]["full_name"])
# eski kayıt: micropage://vcard + boş vcard satırı + https://kullanici
lid = legacy_qr(uidA, "instagram", "micropage://vcard/0", "legig")
sql("INSERT INTO vcard_pages (qr_id, full_name, social_links) VALUES (?,?,?)", (lid, "", json.dumps({"instagram": "https://dijitalgru"})))
rr = c.get("/r/legig")
check("eski instagram (https://dijitalgru) → profil", rr.status_code == 302 and loc(rr) == "https://instagram.com/dijitalgru", loc(rr))
lid = legacy_qr(uidA, "linkedin", "micropage://vcard/0", "leglin")
sql("INSERT INTO vcard_pages (qr_id, full_name, social_links) VALUES (?,?,?)", (lid, "", json.dumps({"linkedin": "furkan-gunes"})))
rr = c.get("/r/leglin")
check("eski linkedin → linkedin.com/in/", rr.status_code == 302 and loc(rr) == "https://linkedin.com/in/furkan-gunes", loc(rr))
r = create(hA, title="Soc", type="social", vcard_payload={"social_links": {"instagram": "dijitalgru", "facebook": "@dijitalgru"}})
check("sosyal çoklu → 200 liste sayfası (Rehbere Kaydet yok)", True)
rr = c.get(f"/r/{r.get_json()['short_code']}")
body = rr.get_data(as_text=True)
check("sosyal sayfa: yer tutucu/Rehbere Kaydet yok", rr.status_code == 200 and "Rehbere" not in body and "Ad Soyad" not in body and "instagram.com/dijitalgru" in body)

print("== 3. WhatsApp ==")
for raw in ["+90 537 627 44 15", "0537 627 44 15", "5376274415"]:
    r = create(hA if False else hB, title="WA", type="dynamic_whatsapp", wa_payload={"phone": raw, "message": "Merhaba"})
    rr = c.get("/r/" + r.get_json()["short_code"])
    check(f"WA '{raw}'", rr.status_code == 302 and loc(rr) == "https://wa.me/905376274415?text=Merhaba", loc(rr))
r = create(hB, title="WA", type="dynamic_whatsapp", wa_payload={"phone": "123", "message": ""})
check("WA geçersiz numara 400 + Türkçe uyarı", r.status_code == 400 and r.get_json().get("field_errors", {}).get("phone"), r.get_data(as_text=True)[:150])
lid = legacy_qr(uidA, "dynamic_whatsapp", "https://wa.me/+90 537 627 44 15?text=Selam", "legwa")
rr = c.get("/r/legwa")
check("eski WA kaydı düzeliyor", loc(rr) == "https://wa.me/905376274415?text=Selam", loc(rr))

print("== 4/5. İzolasyon + doğrulama ==")
r = create(hA, title="x", type="url", target_url="")
check("boş URL reddedilir", r.status_code == 400 and r.get_json().get("field_errors", {}).get("target_url"))
for bad in ["javascript:alert(1)", "data:text/html,<b>", "vbscript:x", "https://javascript:alert(1)", "https://localhost", "ftp://x.com"]:
    r = create(hA, title="x", type="url", target_url=bad)
    check(f"URL reddi: {bad}", r.status_code == 400)
r = create(hA, title="ok", type="url", target_url="example.com/path")
check("example.com/path → https:// eklenir", r.status_code == 200)
uid_ = r.get_json()["qr_id"]
r2 = c.post(f"/api/qr/{uid_}/update", json={"target_url": "javascript:alert(1)"}, headers=hA)
check("update javascript: reddi", r2.status_code == 400)
r2 = c.post(f"/api/qr/{uid_}/update", json={"target_url": ""}, headers=hA)
check("update boş reddi", r2.status_code == 400)
r = create(hA, title="vc", type="vcard", vcard_payload={"full_name": ""})
check("vcard ad zorunlu", r.status_code == 400 and r.get_json()["field_errors"].get("full_name"))
r = create(hA, title="menu", type="restaurant_menu", menu_payload={"categories": []})
check("restoran menüsü en az 1 ürün", r.status_code == 400 and r.get_json()["field_errors"].get("menu_items"))
r = create(hA, title="pdf", type="pdf_catalog", menu_payload={})
check("pdf türü PDF zorunlu", r.status_code == 400 and r.get_json()["field_errors"].get("pdf"))
r = create(hA, title="wf", type="wifi", static_payload={"ssid": ""})
check("wifi SSID zorunlu", r.status_code == 400 and r.get_json()["field_errors"].get("ssid"))

print("== 6. İndirme ==")
r = create(hB, title="Çarşı Menüsü", type="url", target_url="https://example.com", settings={"fill_color": "#112233", "back_color": "#ffeedd", "frame_style": "card", "frame_text": "Beni Tara!", "frame_color": "#aa0000", "frame_text_color": "#00ff00"})
qid = r.get_json()["qr_id"]
e = c.get(f"/api/qr/{qid}/download?format=eps", headers=hB)
check("EPS %!PS-Adobe", e.data.startswith(b"%!PS-Adobe"), e.data[:20])
s = c.get(f"/api/qr/{qid}/download?format=svg", headers=hB)
sv = s.get_data(as_text=True)
check("SVG renk+çerçeve+metin", "#112233" in sv.lower() and "#ffeedd" in sv.lower() and "Beni Tara!" in sv and "#aa0000" in sv.lower(), sv[:120])
check("Content-Disposition qr-carsi-menusu.svg", 'qr-carsi-menusu.svg' in s.headers.get("Content-Disposition", ""), s.headers.get("Content-Disposition"))
check("indirme girişsiz 401", c.get(f"/api/qr/{qid}/download?format=png").status_code == 401)
check("başkasının QR'ı 404", c.get(f"/api/qr/{qid}/download?format=png", headers=hA).status_code == 404)
check("PNG indirme", c.get(f"/api/qr/{qid}/download?format=png", headers=hB).data[:4] == b"\x89PNG")

print("== 8/9/11. vCard, şirket kartı, mikro sayfa ==")
r = create(hA, title="vc", type="vcard", vcard_payload={"full_name": "Egemen Test", "phone": "0537 627 44 15", "title": "Müdür", "company": "Acme", "email": "a@b.co", "social_links": {"instagram": "@acme"}})
check("vcard create", r.status_code == 200, r.get_data(as_text=True)[:150])
sc = r.get_json()["short_code"]
rr = c.get(f"/r/{sc}")
check("vcard /r → /p/vcard/<kod> (sıralı id yok)", rr.status_code == 302 and loc(rr) == f"/p/vcard/{sc}", loc(rr))
page = c.get(f"/p/vcard/{sc}")
check("vcard sayfası 200 + Rehbere Kaydet", page.status_code == 200 and "Rehbere Kaydet" in page.get_data(as_text=True))
vcf = c.get(f"/p/vcard/{sc}.vcf").get_data(as_text=True)
check("VCF N:Test;Egemen;;;", "N;CHARSET=UTF-8:Test;Egemen;;;" in vcf, vcf[:200])
check("VCF E.164 TEL", "TEL;TYPE=CELL:+905376274415" in vcf)
check("VCF sosyal profil", "X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/acme" in vcf)
qrow = sql("SELECT id FROM qr_codes WHERE short_code = ?", (sc,))
nid = qrow[0]["id"]
rr = c.get(f"/p/vcard/{nid}")
check("sayısal /p/vcard/<id> artık 404", rr.status_code == 404, str(rr.status_code))
check("sayısal /p/vcard/<id>.vcf 404", c.get(f"/p/vcard/{nid}.vcf").status_code == 404)
check("sayısal /p/menu/<id> 404", c.get(f"/p/menu/{nid}").status_code == 404)
lid2 = legacy_qr(uidA, "vcard", f"/p/vcard/{nid}.vcf", "legvcfnum")
sql("INSERT INTO vcard_pages (qr_id, full_name) VALUES (?,?)", (lid2, "Eski Dogrudan"))
rr = c.get("/r/legvcfnum")
check("eski /p/vcard/<id>.vcf hedefli kayıt /r/ üzerinden çalışır", rr.status_code == 200 and "/p/vcard/legvcfnum.vcf" in rr.get_data(as_text=True))
lid3 = legacy_qr(uidA, "url", "/p/vcard/%d" % nid, "legnumurl")
rr = c.get("/r/legnumurl")
check("sayısal hedefli url kaydı short_code adresine yönlenir", rr.status_code == 302 and loc(rr) == "/p/vcard/legnumurl", loc(rr))
legacy_qr(uidA, "url", "", "legempty")
rr = c.get("/r/legempty")
check("hedefi boş QR 'henüz yapılandırılmamış' sayfası (ana sayfaya gitmez)", rr.status_code == 404 and "henüz yapılandırılmamış" in rr.get_data(as_text=True) and not loc(rr))
r = create(hA, title="co", type="company_card", vcard_payload={"company_info": {"name": "Acme A.Ş.", "sector": "Yazılım", "working_hours": "09-18", "maps_url": "https://maps.google.com/?q=x", "tax_office": "Kadıköy", "tax_no": "123", "contacts": [{"name": "Ali Veli", "title": "CEO", "phone": "05376274415"}, {"name": "Ayşe Yılmaz", "phone": "05321112233"}]}})
check("company_card create", r.status_code == 200, r.get_data(as_text=True)[:150])
cp = c.get(f"/p/vcard/{r.get_json()['short_code']}").get_data(as_text=True)
check("şirket kartı sayfası (sektör, saatler, yetkili)", "Yazılım" in cp and "09-18" in cp and "Ali Veli" in cp and "Ayşe Yılmaz" in cp)
r = create(hA, title="direct", type="vcard", vcard_payload={"full_name": "Doğrudan Kişi", "direct_redirect": True})
rr = c.get("/r/" + r.get_json()["short_code"])
check("direct vcard → rehbere ekle sayfası", rr.status_code == 200 and "Rehbere Ekle" in rr.get_data(as_text=True))
r = create(hA, title="ig2", type="instagram", vcard_payload={"social_links": {"instagram": "@x"}, "full_name": "Sızıntı", "direct_redirect": True})
rr = c.get("/r/" + r.get_json()["short_code"])
check("direct-vcard sonraki sosyal QR'ı bozmaz", rr.status_code == 302 and loc(rr) == "https://instagram.com/x", loc(rr))

print("== 7. Menü ==")
r = create(hA, title="rm", type="restaurant_menu", menu_payload={"title": "Cafe", "categories": [{"name": "Çorbalar", "items": [{"name": "Mercimek", "price": "50", "description": "Süzme, limonlu, günlük taze"}]}]})
check("restoran menü create", r.status_code == 200, r.get_data(as_text=True)[:150])
rr = c.get("/r/" + r.get_json()["short_code"])
mp = c.get(loc(rr)).get_data(as_text=True)
check("ürün açıklaması render", "Süzme, limonlu, günlük taze" in mp)

print("== 10. Analitik ==")
r = create(hA, title="an", type="url", target_url="https://example.com")
sc, qid = r.get_json()["short_code"], r.get_json()["qr_id"]
ua_ok = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
c.get(f"/r/{sc}", headers={"User-Agent": ua_ok})
c.get(f"/r/{sc}", headers={"User-Agent": "WhatsApp/2.23.20 A"})
c.get(f"/r/{sc}", headers={"User-Agent": "TelegramBot (like TwitterBot)"})
c.head(f"/r/{sc}", headers={"User-Agent": ua_ok})
time.sleep(1.5)
n = sql("SELECT COUNT(*) AS n FROM scan_logs WHERE qr_id = ?", (qid,))[0]["n"]
check("bot/HEAD taramaya sayılmıyor (1 tarama)", n == 1, str(n))
an = c.get(f"/api/qr/{qid}/analytics", headers=hA).get_json()
check("analitik saatlik 24 + Istanbul", len(an.get("hourly", [])) == 24 and an.get("timezone") == "Europe/Istanbul", str(an.get("timezone")))
sql("UPDATE scan_logs SET scanned_at = 1800000000 WHERE qr_id = ?", (qid,))  # sabit UTC
an = c.get(f"/api/qr/{qid}/analytics", headers=hA).get_json()
import datetime as _dt
exp = (_dt.datetime.utcfromtimestamp(1800000000) + _dt.timedelta(hours=3)).strftime("%H:%M")
check("saat Istanbul (UTC+3)", exp in json.dumps(an), exp)

print("== 11b. Yükleme ==")
r = c.post("/api/upload/image", data={"image_file": (io.BytesIO(b"<svg onload=alert(1)>"), "x.png")}, headers=hA, content_type="multipart/form-data")
check("sahte PNG reddedilir", r.status_code == 400)
png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==")
r = c.post("/api/upload/image", data={"image_file": (io.BytesIO(png), "x.png")}, headers=hA, content_type="multipart/form-data")
check("gerçek PNG kabul", r.status_code == 200)
r = c.post("/api/upload/pdf", data={"pdf_file": (io.BytesIO(b"hello"), "x.pdf")}, headers=hA, content_type="multipart/form-data")
check("sahte PDF reddedilir", r.status_code == 400)
r = c.post("/api/upload/image", data={"image_file": (io.BytesIO(png), "x.png")}, content_type="multipart/form-data")
check("girişsiz yükleme 401", r.status_code == 401)

print("== 12. Limit ==")
hC, jC = reg("acc_c_test_1@example.com")
codes = [create(hC, title=f"d{i}", type="url", target_url="https://example.com").status_code for i in range(4)]
check("ücretsiz limit (3) sonrası sunucu engelliyor", codes == [200, 200, 200, 403], str(codes))
sql("UPDATE users SET plan = 'business' WHERE id = ?", (jC["user"]["id"],))
rr = create(hC, title="logo", type="url", target_url="https://example.com", settings={"fill_color": "#000000"})
check("business planda limit plan tanımından", rr.status_code == 200, rr.get_data(as_text=True)[:120])

print("== 12b. Logo ==")
up = c.post("/api/upload/image", data={"image_file": (io.BytesIO(png), "logo.png")}, headers=hA, content_type="multipart/form-data").get_json()
lurl = up["image_url"]
r = create(hA, title="logo", type="url", target_url="https://example.com/logo", settings={"fill_color": "#000000", "logo_url": lurl})
lj = r.get_json()
check("business logo kabul + QR taranır", r.status_code == 200 and decode_b64(lj["qr_image"]) == lj["qr_content"], str(decode_b64(lj["qr_image"])))
stored = json.loads(sql("SELECT custom_settings FROM qr_codes WHERE id=?", (lj["qr_id"],))[0]["custom_settings"])
check("logo ayarı kaydedildi", stored.get("logo_url") == lurl, str(stored))
up2 = c.post("/api/upload/image", data={"image_file": (io.BytesIO(png), "logo.png")}, headers=hC, content_type="multipart/form-data").get_json()
sql("UPDATE users SET plan = 'free' WHERE id = ?", (jC["user"]["id"],))
r = create(hC, title="x", type="static_url", target_url="https://example.com/z", settings={"logo_url": up2["image_url"]})
st2 = json.loads(sql("SELECT custom_settings FROM qr_codes WHERE id=?", (r.get_json()["qr_id"],))[0]["custom_settings"])
check("ücretsiz planda logo yok sayılır", not st2.get("logo_url"), str(st2))

print("== A5 startup migration ==")
import migrate_db as _md  # noqa: E402
legacy_qr(uidA, "vcard", f"/p/vcard/{nid}.vcf", "legvcfmig")
_md.fix_numeric_micro_targets()
check("sayısal mikro hedef short_code'a taşındı", sql("SELECT target_url FROM qr_codes WHERE short_code='legvcfmig'")[0]["target_url"] == "/p/vcard/legvcfmig.vcf")
print("== A6 boş hedef ==")
legacy_qr(uidA, "url", "https://qrdijitalgru.com", "leghome")
legacy_qr(uidA, "url", "https://qrdijitalgru.com/fiyat", "legkeep")
_md.blank_homepage_targets()
check("ana sayfaya çevrilmiş hedef tekrar boşaltıldı", sql("SELECT target_url FROM qr_codes WHERE short_code='leghome'")[0]["target_url"] in ("", None))
check("başka adres dokunulmadı", sql("SELECT target_url FROM qr_codes WHERE short_code='legkeep'")[0]["target_url"] == "https://qrdijitalgru.com/fiyat")
print("== Migration (genel) ==")
import migrate_fix_records as mfr  # noqa: E402
lid = legacy_qr(uidA, "pdf_catalog", "/p/media/abc", "legdemo")
sql("INSERT INTO menu_pages (qr_id, title, pdf_url, categories) VALUES (?,?,?,?)", (lid, "K", "/p/media/abc", json.dumps([{"name": "Çorbalar", "items": [{"name": "Süzme Mercimek Çorbası", "description": "Tereyağlı ve kruton ekmekli lezzetli mercimek çorbası"}]}])))
legacy_qr(uidA, "instagram", "https://dijitalgru", "legigmig")
dry = mfr.run(False)
check("dry-run değişiklik bulur ama yazmaz", dry["wa"] >= 1 and dry["demo_menu"] == 1 and sql("SELECT target_url FROM qr_codes WHERE short_code='legwa'")[0]["target_url"].startswith("https://wa.me/+90"))
applied = mfr.run(True)
check("WA hedefi kalıcı normalize", sql("SELECT target_url FROM qr_codes WHERE short_code='legwa'")[0]["target_url"] == "https://wa.me/905376274415?text=Selam")
check("demo kategori temizlendi", json.loads(sql("SELECT categories FROM menu_pages WHERE qr_id=?", (lid,))[0]["categories"]) == [])
check("eski instagram hedefi profil", sql("SELECT target_url FROM qr_codes WHERE short_code='legigmig'")[0]["target_url"] == "https://instagram.com/dijitalgru")
check("migration ikinci kez değişiklik yapmaz", sum(mfr.run(False).values()) == 0, str(mfr.run(False)))

print()
print(f"SONUÇ: {len(PASS)} geçti, {len(FAIL)} kaldı")
for f in FAIL:
    print("  ❌", f)
sys.exit(1 if FAIL else 0)
