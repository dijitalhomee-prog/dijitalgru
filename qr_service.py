"""
QR Studio — içerik doğrulama / hazırlama ve /r/<kod> yönlendirme kararı.

* validate_content(): create/update için tür bazlı doğrulama (sunucu tarafı tek gerçek).
  İlgisiz alanlar yok sayılır (ör. instagram türünde vcard_payload.full_name kaydedilmez).
* resolve_target(): mevcut (eski/bozuk) ve yeni kayıtlar için yönlendirme kararı.
"""
import re
import json
from urllib.parse import quote

from qr_utils import (
    SOCIAL_TYPES, VCARD_TYPES, MENU_TYPES, STATIC_TYPES, WHATSAPP_TYPES,
    normalize_social, normalize_social_links, normalize_phone_for_wa, is_valid_wa_number,
    normalize_phone_e164, is_valid_phone, validate_url, build_static_target,
    build_whatsapp_url, parse_whatsapp_target, parse_phone, parse_sms, parse_wifi,
    static_content_for, DANGEROUS_SCHEME_RE,
)

_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")

SOCIAL_LABELS = {
    "instagram": "Instagram", "facebook": "Facebook", "linkedin": "LinkedIn", "pinterest": "Pinterest",
    "twitter": "X (Twitter)", "tiktok": "TikTok", "youtube": "YouTube",
}
SOCIAL_ORDER = ["instagram", "facebook", "linkedin", "pinterest", "twitter", "tiktok", "youtube"]


def clean_text(v, limit=500):
    if v is None:
        return ""
    s = _CTRL_RE.sub("", str(v)).strip()
    return s[:limit]


def loads(v, default):
    if v is None or v == "":
        return default
    if isinstance(v, (dict, list)):
        return v
    try:
        out = json.loads(v)
        return out if isinstance(out, type(default)) else default
    except Exception:
        return default


# --------------------------------------------------------------------------
# QR tasarım ayarları
# --------------------------------------------------------------------------
def sanitize_settings(settings, logo_allowed=False):
    s = settings if isinstance(settings, dict) else {}
    out = {}
    for key, default in (("fill_color", "#4F46E5"), ("back_color", "#FFFFFF"),
                         ("frame_color", "#4F46E5"), ("frame_text_color", "#FFFFFF")):
        v = str(s.get(key) or "").strip()
        out[key] = v if _COLOR_RE.match(v) else default
    out["frame_style"] = "none" if str(s.get("frame_style") or "card") == "none" else "card"
    out["frame_text"] = clean_text(s.get("frame_text") if s.get("frame_text") is not None else "Beni Tara!", 40) or "Beni Tara!"
    logo = str(s.get("logo_url") or "").strip()
    if logo_allowed and re.match(r"^(?:https?://[^/]+)?/p/media/[A-Za-z0-9_.\-]+$", logo):
        out["logo_url"] = re.sub(r"^https?://[^/]+", "", logo)
    return out


# --------------------------------------------------------------------------
# Tür bazlı içerik doğrulama
# --------------------------------------------------------------------------
def _clean_media(url):
    u = clean_text(url, 600)
    if not u:
        return ""
    if DANGEROUS_SCHEME_RE.match(u):
        return ""
    return u


def _clean_contacts(contacts):
    out = []
    for c in (contacts if isinstance(contacts, list) else [])[:12]:
        if not isinstance(c, dict):
            continue
        item = {
            "name": clean_text(c.get("name"), 120), "title": clean_text(c.get("title"), 120),
            "phone": normalize_phone_e164(c.get("phone")) if c.get("phone") else "",
            "email": clean_text(c.get("email"), 160),
        }
        if item["name"] or item["phone"] or item["email"]:
            out.append(item)
    return out


def _build_vcard(vp, qr_type, errors, partial=False):
    vp = vp if isinstance(vp, dict) else {}
    links = normalize_social_links(vp.get("social_links") if isinstance(vp.get("social_links"), dict) else {})
    card = {
        "full_name": clean_text(vp.get("full_name"), 160),
        "title": clean_text(vp.get("title"), 160),
        "company": clean_text(vp.get("company"), 160),
        "phone": normalize_phone_e164(vp.get("phone")) if vp.get("phone") else "",
        "phone2": normalize_phone_e164(vp.get("phone2")) if vp.get("phone2") else "",
        "email": clean_text(vp.get("email"), 160),
        "website": "",
        "address": clean_text(vp.get("address"), 400),
        "bio": clean_text(vp.get("bio"), 2000),
        "avatar_url": _clean_media(vp.get("avatar_url")),
        "card_image_url": _clean_media(vp.get("card_image_url")),
        "social_links": links,
        "theme_settings": vp.get("theme_settings"),
        "extra": None,
        "direct_redirect": bool(vp.get("direct_redirect")) if qr_type == "vcard" else False,
    }
    if vp.get("website"):
        ok, url, msg = validate_url(vp.get("website"))
        if ok:
            card["website"] = url
        else:
            errors["website"] = msg
    if card["email"] and not _EMAIL_RE.match(card["email"]):
        errors["email"] = "Geçerli bir e-posta adresi girin."
    if qr_type == "vcard":
        if not card["full_name"] and not (partial and "full_name" not in vp):
            errors["full_name"] = "Lütfen ad soyad girin."
    elif qr_type == "company_card":
        ci = vp.get("company_info") if isinstance(vp.get("company_info"), dict) else {}
        name = clean_text(ci.get("name") or vp.get("company"), 160)
        maps = ""
        if ci.get("maps_url"):
            ok, url, msg = validate_url(ci.get("maps_url"))
            if ok:
                maps = url
            else:
                errors["maps_url"] = "Geçerli bir Google Maps bağlantısı girin."
        extra = {
            "name": name,
            "logo_url": _clean_media(ci.get("logo_url")),
            "sector": clean_text(ci.get("sector"), 160),
            "tax_office": clean_text(ci.get("tax_office"), 160),
            "tax_no": clean_text(ci.get("tax_no"), 40),
            "working_hours": clean_text(ci.get("working_hours"), 600),
            "maps_url": maps,
            "contacts": _clean_contacts(ci.get("contacts")),
        }
        if not name and not (partial and "company_info" not in vp and "company" not in vp):
            errors["company_name"] = "Lütfen şirket adını girin."
        card["company"] = name
        card["extra"] = extra
        card["full_name"] = card["full_name"] or (extra["contacts"][0]["name"] if extra["contacts"] else name)
        if not card["avatar_url"] and extra["logo_url"]:
            card["avatar_url"] = extra["logo_url"]
    return card


def _clean_categories(cats):
    out = []
    for c in (cats if isinstance(cats, list) else [])[:60]:
        if not isinstance(c, dict):
            continue
        items = []
        for it in (c.get("items") if isinstance(c.get("items"), list) else [])[:300]:
            if not isinstance(it, dict):
                continue
            name = clean_text(it.get("name"), 160)
            if not name:
                continue
            items.append({
                "name": name,
                "price": clean_text(it.get("price"), 40),
                "description": clean_text(it.get("description") or it.get("desc"), 600),
                "image_url": _clean_media(it.get("image_url")),
            })
        if items:
            out.append({"name": clean_text(c.get("name"), 120) or "Kategori", "items": items})
    return out


def _build_menu(mp, qr_type, errors, partial=False):
    mp = mp if isinstance(mp, dict) else {}
    pdf_url = _clean_media(mp.get("pdf_url"))
    if pdf_url in ("None", "null", "undefined"):
        pdf_url = ""
    if qr_type == "restaurant_menu":
        pdf_url = ""
    cats = _clean_categories(mp.get("categories"))
    if qr_type == "pdf_viewer":
        cats = []
    n_items = sum(len(c["items"]) for c in cats)

    check_pdf = not (partial and "pdf_url" not in mp)
    check_items = not (partial and "categories" not in mp)
    if qr_type in ("pdf_viewer", "pdf_catalog") and not pdf_url:
        if check_pdf:
            errors["pdf"] = "Lütfen bir PDF dosyası yükleyin."
    elif qr_type == "menu" and not pdf_url and n_items == 0:
        if check_pdf and check_items:
            errors["pdf"] = "Lütfen bir PDF yükleyin veya en az 1 ürün ekleyin."
    elif qr_type == "restaurant_menu" and n_items == 0:
        if check_items:
            errors["menu_items"] = "Lütfen menüye en az 1 ürün ekleyin."

    website = ""
    if mp.get("website"):
        ok, url, msg = validate_url(mp.get("website"))
        if ok:
            website = url
        else:
            errors["website"] = msg
    return {
        "title": clean_text(mp.get("title"), 200),
        "description": clean_text(mp.get("description"), 1000),
        "cover_url": _clean_media(mp.get("cover_url")),
        "pdf_url": pdf_url or None,
        "categories": cats,
        "contact_name": clean_text(mp.get("contact_name"), 160),
        "contact_title": clean_text(mp.get("contact_title"), 160),
        "phone": normalize_phone_e164(mp.get("phone")) if mp.get("phone") else "",
        "phone2": normalize_phone_e164(mp.get("phone2")) if mp.get("phone2") else "",
        "email": clean_text(mp.get("email"), 160),
        "website": website,
        "address": clean_text(mp.get("address"), 400),
        "card_image_url": _clean_media(mp.get("card_image_url")),
        "social_links": normalize_social_links(mp.get("social_links") if isinstance(mp.get("social_links"), dict) else {}),
        "theme_settings": mp.get("theme_settings"),
        "direct_redirect": bool(mp.get("direct_redirect", True)) and qr_type != "restaurant_menu",
    }


CONTENT_KEYS = ("target_url", "static_payload", "wa_payload", "vcard_payload", "menu_payload")


def validate_content(qr_type, data, legacy_target="", partial=False):
    """
    -> (clean, field_errors)
    clean = {"target_url": str, "vcard": dict|None, "menu": dict|None}
    Sadece qr_type'a ait alanlar okunur.
    """
    errors = {}
    clean = {"target_url": "", "vcard": None, "menu": None}
    t = qr_type

    if t == "url":
        ok, url, msg = validate_url(data.get("target_url") if data.get("target_url") is not None else legacy_target)
        if not ok:
            errors["target_url"] = msg
        clean["target_url"] = url
    elif t in STATIC_TYPES:
        sp = data.get("static_payload")
        raw = data.get("target_url") if data.get("target_url") is not None else legacy_target
        clean["target_url"], errs = build_static_target(t, sp, raw)
        errors.update(errs)
    elif t in WHATSAPP_TYPES:
        wa = data.get("wa_payload") if isinstance(data.get("wa_payload"), dict) else None
        if wa is None:
            p, m = parse_whatsapp_target(data.get("target_url") if data.get("target_url") is not None else legacy_target)
            wa = {"phone": p, "message": m}
        digits = normalize_phone_for_wa(wa.get("phone"))
        if not digits:
            errors["phone"] = "Lütfen WhatsApp telefon numarasını girin."
        elif not is_valid_wa_number(digits):
            errors["phone"] = "Geçersiz numara. Örnek: +90 537 627 44 15 veya 0537 627 44 15"
        else:
            clean["target_url"] = build_whatsapp_url(digits, clean_text(wa.get("message"), 1000))
    elif t in SOCIAL_TYPES:
        vp = data.get("vcard_payload") if isinstance(data.get("vcard_payload"), dict) else {}
        links = vp.get("social_links") if isinstance(vp.get("social_links"), dict) else {}
        n = normalize_social(t, links.get(t))
        if not n:
            errors["social"] = "Lütfen geçerli bir %s kullanıcı adı veya profil bağlantısı girin." % SOCIAL_LABELS.get(t, t)
        ok, url, _m = validate_url(n) if n else (False, "", "")
        if n and not ok:
            errors["social"] = "Geçerli bir %s profil bağlantısı girin." % SOCIAL_LABELS.get(t, t)
        clean["vcard"] = {"social_links": {t: n} if n else {}, "extra": None, "theme_settings": None}
        clean["target_url"] = n
    elif t == "social":
        vp = data.get("vcard_payload") if isinstance(data.get("vcard_payload"), dict) else {}
        links = normalize_social_links(vp.get("social_links") if isinstance(vp.get("social_links"), dict) else {})
        links = {k: v for k, v in links.items() if validate_url(v)[0]}
        if not links:
            errors["social"] = "Lütfen en az bir sosyal medya hesabı ekleyin."
        clean["vcard"] = {"social_links": links, "extra": None, "theme_settings": vp.get("theme_settings")}
        clean["target_url"] = "micropage://social"
    elif t in VCARD_TYPES:
        card = _build_vcard(data.get("vcard_payload"), t, errors, partial)
        clean["vcard"] = card
        clean["target_url"] = "micropage://vcard"
    elif t in MENU_TYPES:
        menu = _build_menu(data.get("menu_payload"), t, errors, partial)
        clean["menu"] = menu
        clean["target_url"] = "micropage://menu"
    else:
        errors["type"] = "Geçersiz QR türü."
    return clean, errors


# --------------------------------------------------------------------------
# Yönlendirme kararı (/r/<kod>) — yeni ve eski kayıtlar için
# --------------------------------------------------------------------------
def _social_links_from(vcard):
    if not vcard:
        return {}
    return loads(vcard.get("social_links"), {})


def resolve_target(qr, vcard=None, menu=None):
    """
    -> dict(kind=...)
       redirect: {"url"}
       text|sms|wifi: {"data": {...}}
       social_links: {"links": [(platform,label,url)]}
       micro_vcard|micro_menu|vcf
       error: {"reason"}
    """
    t = qr.get("type") or "url"
    tu = (qr.get("target_url") or "").strip()

    if t == "phone":
        num = parse_phone(tu)
        if not re.sub(r"\D", "", num):
            return {"kind": "error", "reason": "empty"}
        return {"kind": "redirect", "url": "tel:" + normalize_phone_e164(num)}

    if t == "sms":
        d = parse_sms(tu)
        phone = normalize_phone_e164(d["phone"]) if d["phone"] else ""
        if phone:
            url = "sms:" + phone
            if d["message"]:
                url += "?body=" + quote(d["message"], safe="")
            return {"kind": "redirect", "url": url}
        if not d["message"].strip():
            return {"kind": "error", "reason": "empty"}
        return {"kind": "sms", "data": {"phone": "", "message": d["message"]}}

    if t == "text":
        if not tu:
            return {"kind": "error", "reason": "empty"}
        return {"kind": "text", "data": {"text": qr.get("target_url") or ""}}

    if t == "wifi":
        d = parse_wifi(tu)
        if not d["ssid"]:
            return {"kind": "error", "reason": "empty"}
        return {"kind": "wifi", "data": d}

    if t in SOCIAL_TYPES:
        links = _social_links_from(vcard)
        raw = links.get(t) or ""
        if not raw and tu and not tu.startswith("micropage://") and not tu.endswith(".vcf") and not tu.startswith("/"):
            raw = tu
        n = normalize_social(t, raw)
        if n and validate_url(n)[0]:
            return {"kind": "redirect", "url": n}
        return {"kind": "error", "reason": "social_empty"}

    if t == "social":
        links = normalize_social_links(_social_links_from(vcard))
        links = {k: v for k, v in links.items() if validate_url(v)[0]}
        if not links and tu.startswith("http"):
            n = normalize_social("instagram", tu)
            if n and validate_url(n)[0]:
                links = {"instagram": n}
        if not links:
            return {"kind": "error", "reason": "social_empty"}
        if len(links) == 1:
            return {"kind": "redirect", "url": list(links.values())[0]}
        ordered = [(k, SOCIAL_LABELS.get(k, k.title()), links[k]) for k in SOCIAL_ORDER if k in links]
        ordered += [(k, SOCIAL_LABELS.get(k, k.title()), v) for k, v in links.items() if k not in SOCIAL_ORDER]
        return {"kind": "social_links", "links": ordered}

    if t in WHATSAPP_TYPES:
        phone, msg = parse_whatsapp_target(tu)
        digits = normalize_phone_for_wa(phone)
        if not is_valid_wa_number(digits):
            return {"kind": "error", "reason": "invalid_target"}
        return {"kind": "redirect", "url": build_whatsapp_url(digits, msg)}

    if t in MENU_TYPES:
        if tu.startswith("/") or re.match(r"^https?://", tu, re.I):
            if tu.startswith("//"):
                return {"kind": "micro_menu"}
            return {"kind": "redirect", "url": tu}
        return {"kind": "micro_menu"}

    if t in VCARD_TYPES:
        if t == "vcard" and tu.endswith(".vcf"):
            return {"kind": "vcf"}
        return {"kind": "micro_vcard"}

    # url / static_url / bilinmeyen
    if tu.startswith("micropage://vcard") or tu == "vcard":
        return {"kind": "micro_vcard"}
    if tu.startswith("micropage://menu") or tu in ("menu", "pdf"):
        return {"kind": "micro_menu"}
    if tu.startswith("/") and not tu.startswith("//"):
        return {"kind": "redirect", "url": tu}
    if not tu:
        return {"kind": "error", "reason": "empty"}
    ok, url, _m = validate_url(tu)
    if not ok:
        return {"kind": "error", "reason": "invalid_target"}
    return {"kind": "redirect", "url": url}
