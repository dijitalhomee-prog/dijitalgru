"""
Tek seferlik, GENEL kayıt düzeltme (migration) betiği — hiçbir kullanıcıya özel işlem içermez.

Ne yapar (tüm hesaplar için aynı kurallar):
  1. WhatsApp hedeflerini https://wa.me/905xxxxxxxxx?text=... biçimine normalize eder.
  2. Instagram/LinkedIn/Pinterest/Facebook QR'larını doğrudan profil adresine çevirir
     (micropage://vcard/<id> yerine) ve kartvizit yer tutucularını ("Ad Soyad/Unvan/Şirket Adı") temizler.
  3. vcard_pages.social_links alanlarındaki bozuk değerleri (https://kullanici) platform adresine çevirir.
  4. PDF türlerinde (menu/pdf_catalog/pdf_viewer) PDF varken kaydedilmiş bilinen DEMO kategorileri
     ("Çorbalar / Süzme Mercimek…" vb.) temizler.
Statik türler (phone/sms/text/wifi) olduğu gibi bırakılır — /r/ katmanı eski formatı toleransla işler.

Kullanım:
  .venv/bin/python migrate_fix_records.py            # sadece rapor (dry-run)
  .venv/bin/python migrate_fix_records.py --apply    # ÖNCE yedek alır, sonra uygular
Yedek: SQLite → data/backups/ altına dosya kopyası; PostgreSQL → tüm ilgili tabloların JSON dökümü.
"""
import datetime
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from db import get_db, is_postgres  # noqa: E402
from qr_utils import (  # noqa: E402
    SOCIAL_TYPES, WHATSAPP_TYPES, MENU_TYPES, normalize_social, normalize_social_links,
    normalize_phone_for_wa, is_valid_wa_number, parse_whatsapp_target, build_whatsapp_url, validate_url,
)

PLACEHOLDERS = {"Ad Soyad", "Unvan", "Şirket Adı"}
DEMO_ITEMS = {
    ("Süzme Mercimek Çorbası", "Tereyağlı ve kruton ekmekli lezzetli mercimek çorbası"),
    ("Izgara Köfte", "Pirinç pilavı, közlenmiş biber ve domates ile"),
    ("Tavuk Külbastı", "Özel soslu tavuk göğsü, elma dilim patates"),
}
TABLES = ["users", "qr_codes", "vcard_pages", "menu_pages", "scan_logs", "subscriptions"]


def backup():
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    outdir = os.path.join(ROOT, "data", "backups")
    os.makedirs(outdir, exist_ok=True)
    if not is_postgres():
        src = os.environ.get("QR_DB_PATH") or os.path.join(ROOT, "data", "dijitalgru_qr.db")
        dst = os.path.join(outdir, f"dijitalgru_qr_{stamp}.db")
        shutil.copy2(src, dst)
        return dst
    dst = os.path.join(outdir, f"pg_backup_{stamp}.json")
    conn = get_db()
    cur = conn.cursor()
    dump = {}
    for t in TABLES:
        try:
            cur.execute(f"SELECT * FROM {t}")
            dump[t] = [dict(r) for r in cur.fetchall()]
        except Exception as e:
            conn.rollback()
            dump[t] = f"ERROR: {e}"
    conn.close()
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(dump, f, ensure_ascii=False, default=str)
    return dst


def jl(v, default):
    if isinstance(v, (dict, list)):
        return v
    try:
        return json.loads(v) if v else default
    except Exception:
        return default


def run(apply_changes):
    conn = get_db()
    cur = conn.cursor()
    stats = {"wa": 0, "social_qr": 0, "social_links": 0, "placeholders": 0, "demo_menu": 0}

    # 1) WhatsApp
    cur.execute("SELECT id, type, target_url FROM qr_codes WHERE type IN ('dynamic_whatsapp','whatsapp')")
    for r in cur.fetchall():
        phone, msg = parse_whatsapp_target(r["target_url"] or "")
        digits = normalize_phone_for_wa(phone)
        if not is_valid_wa_number(digits):
            continue
        new = build_whatsapp_url(digits, msg)
        if new != (r["target_url"] or ""):
            stats["wa"] += 1
            if apply_changes:
                cur.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (new, r["id"]))

    # 2) + 3) Sosyal türler ve vcard_pages.social_links
    cur.execute("SELECT id, type, target_url FROM qr_codes WHERE type IN ('instagram','linkedin','pinterest','facebook')")
    for q in cur.fetchall():
        cur.execute("SELECT id, full_name, title, company, social_links FROM vcard_pages WHERE qr_id = ?", (q["id"],))
        v = cur.fetchone()
        links = jl(v["social_links"], {}) if v else {}
        raw = links.get(q["type"]) or ""
        tu = q["target_url"] or ""
        if not raw and tu and not tu.startswith("micropage://") and not tu.endswith(".vcf") and not tu.startswith("/"):
            raw = tu
        prof = normalize_social(q["type"], raw)
        if prof and validate_url(prof)[0] and prof != tu:
            stats["social_qr"] += 1
            if apply_changes:
                cur.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (prof, q["id"]))
                if v:
                    cur.execute("UPDATE vcard_pages SET social_links = ? WHERE id = ?",
                                (json.dumps({q["type"]: prof}, ensure_ascii=False), v["id"]))
        if v:
            upd = {}
            for col in ("full_name", "title", "company"):
                if (v[col] or "").strip() in PLACEHOLDERS:
                    upd[col] = ""
            if upd:
                stats["placeholders"] += 1
                if apply_changes:
                    for col, val in upd.items():
                        cur.execute(f"UPDATE vcard_pages SET {col} = ? WHERE id = ?", (val, v["id"]))

    cur.execute("SELECT id, social_links FROM vcard_pages WHERE social_links IS NOT NULL AND social_links != ''")
    for v in cur.fetchall():
        links = jl(v["social_links"], {})
        if not isinstance(links, dict) or not links:
            continue
        fixed = normalize_social_links(links)
        if fixed != links:
            stats["social_links"] += 1
            if apply_changes:
                cur.execute("UPDATE vcard_pages SET social_links = ? WHERE id = ?",
                            (json.dumps(fixed, ensure_ascii=False), v["id"]))

    # 4) PDF türlerinde demo kategoriler
    cur.execute("""SELECT m.id, m.pdf_url, m.categories FROM menu_pages m JOIN qr_codes q ON q.id = m.qr_id
                   WHERE q.type IN ('menu','pdf_catalog','pdf_viewer')""")
    for m in cur.fetchall():
        if not m["pdf_url"]:
            continue
        cats = jl(m["categories"], [])
        if not isinstance(cats, list) or not cats:
            continue
        new_cats, changed = [], False
        for c in cats:
            items = c.get("items") or []
            kept = [i for i in items if (i.get("name"), i.get("description") or i.get("desc")) not in DEMO_ITEMS]
            if len(kept) != len(items):
                changed = True
            if kept:
                c = dict(c)
                c["items"] = kept
                new_cats.append(c)
            elif items:
                changed = True
        if changed:
            stats["demo_menu"] += 1
            if apply_changes:
                cur.execute("UPDATE menu_pages SET categories = ? WHERE id = ?",
                            (json.dumps(new_cats, ensure_ascii=False), m["id"]))

    if apply_changes:
        conn.commit()
    conn.close()
    return stats


if __name__ == "__main__":
    apply_changes = "--apply" in sys.argv
    if apply_changes:
        path = backup()
        print(f"💾 Yedek alındı: {path}")
    print(("UYGULANDI" if apply_changes else "DRY-RUN (değişiklik yok)"), json.dumps(run(apply_changes), ensure_ascii=False))
