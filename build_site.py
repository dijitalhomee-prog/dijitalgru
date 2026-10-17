#!/usr/bin/env python3
"""Dijital Gru statik site derleyicisi (SEO / konumlandirma guncellemesi).

Calistirma:  python3 build_site.py
- Mevcut sayfalara ortak SEO duzeltmelerini uygular (idempotent).
- Yeni hizmet sayfalari, kariyer.html ve blog/*.html dosyalarini uretir.
- blog.html listesini statik HTML olarak doldurur.
- sitemap.xml ve robots.txt dosyalarini yeniler.
"""
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = "https://dijitalgru.com"
LASTMOD = "2026-10-17"
OG_IMAGE = SITE + "/Logo/logo-dikey-krem.png"
WA_URL = "https://wa.me/905376274415"

# --------------------------------------------------------------------------
# Yardimcilar
# --------------------------------------------------------------------------

def read(name):
    return (ROOT / name).read_text(encoding="utf-8").replace("\r\n", "\n")


def write(name, text):
    p = ROOT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    if name.endswith(".html"):
        text = loc_fix(text)
    p.write_text(text, encoding="utf-8")


LOC_RULES = [
    # merkezli ifadeleri
    (r"Şişli,? İstanbul merkezli", "İstanbul merkezli"),
    (r"İstanbul Şişli merkezli", "İstanbul merkezli"),
    (r"Şişli merkezli", "İstanbul merkezli"),
    (r"Dijital Gru Şişli(?=<|\")", "Dijital Gru İstanbul"),
    # LOKASYON karti -> HİZMET BÖLGESİ (küre ikonu)
    (r'fa-location-dot("></i></div>\s*<div>\s*<span>)LOKASYON</span>\s*<(h[234])>Şişli, İstanbul / Türkiye</\2>',
     r'fa-globe\1HİZMET BÖLGESİ</span>\n                                <\2>İstanbul &amp; Türkiye geneli</\2>'),
    # footer konum satiri
    (r'<i class="fa-solid fa-location-dot"></i> Şişli, İstanbul / Türkiye', '<i class="fa-solid fa-globe"></i> İstanbul &amp; Türkiye geneli'),
    # JSON-LD adres: sokak/posta kodu yok, sadece İstanbul/TR
    (r'\n\s*"streetAddress": "[^"]*",', ''),
    (r'\n\s*"postalCode": "[^"]*",', ''),
    (r'"addressLocality": "Şişli"', '"addressLocality": "İstanbul"'),
]


def loc_fix(s):
    for pat, rep in LOC_RULES:
        s = re.sub(pat, rep, s)
    return s


def attr(s):
    return escape(s, quote=True)


def slugify(t):
    tr = str.maketrans("çğıöşüÇĞİÖŞÜâîû", "cgiosuCGIOSUaiu")
    t = t.translate(tr).lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t


def seo_block(title, desc, canonical, og_type="website", image=OG_IMAGE):
    return (
        '    <link rel="canonical" href="%(c)s">\n'
        '    <meta property="og:type" content="%(t)s">\n'
        '    <meta property="og:site_name" content="Dijital Gru">\n'
        '    <meta property="og:url" content="%(c)s">\n'
        '    <meta property="og:title" content="%(ti)s">\n'
        '    <meta property="og:description" content="%(d)s">\n'
        '    <meta property="og:image" content="%(i)s">\n'
        '    <meta property="og:locale" content="tr_TR">\n'
        '    <meta name="twitter:card" content="summary_large_image">\n'
        '    <meta name="twitter:title" content="%(ti)s">\n'
        '    <meta name="twitter:description" content="%(d)s">\n'
        '    <meta name="twitter:image" content="%(i)s">\n'
    ) % {"c": canonical, "t": og_type, "ti": attr(title), "d": attr(desc), "i": image}


def jsonld(obj):
    return '    <script type="application/ld+json">\n    %s\n    </script>\n' % json.dumps(obj, ensure_ascii=False, indent=2).replace("\n", "\n    ")


def breadcrumb(items):
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": u}
            for i, (n, u) in enumerate(items)
        ],
    }


# --------------------------------------------------------------------------
# Sayfa meta verileri (her biri benzersiz)
# --------------------------------------------------------------------------

META = {
    "index.html": (
        "Lüks Markalar İçin Web Tasarım & Marka Kimliği Stüdyosu | Dijital Gru İstanbul",
        "Şişli merkezli tasarım stüdyosu: lüks restoran, beach club ve premium markalar için web tasarım, kurumsal kimlik ve özel yazılım. Ücretsiz teklif alın.",
        "/",
    ),
    "hizmetler.html": (
        "Web Tasarım, Marka Kimliği ve Yazılım Hizmetleri | Dijital Gru",
        "Restoran web sitesi, lüks marka kimliği, kurumsal web sitesi, özel yazılım ve QR menü. Dijital Gru tasarım stüdyosunun tüm hizmetleri tek sayfada.",
        "/hizmetler.html",
    ),
    "kurumsal.html": (
        "Hakkımızda: Web Tasarım & Marka Stüdyosu | Dijital Gru Şişli",
        "Dijital Gru'nun hikayesi, çalışma yaklaşımı ve birlikte çalıştığımız uzmanlar. Şişli İstanbul merkezli web tasarım ve marka stüdyosu.",
        "/kurumsal.html",
    ),
    "iletisim.html": (
        "İletişim & Teklif Al | Dijital Gru Tasarım Stüdyosu İstanbul",
        "Projeniz için Dijital Gru ile iletişime geçin. Şişli merkezli stüdyomuzdan form, telefon veya WhatsApp üzerinden hızlıca teklif alın.",
        "/iletisim.html",
    ),
    "designs.html": (
        "Projelerimiz: Restoran, Otel ve Marka Tasarımları | Dijital Gru",
        "Restoran, beach club, otel ve premium markalar için hazırladığımız web siteleri, kurumsal kimlikler, menüler ve sosyal medya tasarımları.",
        "/designs.html",
    ),
    "blog.html": (
        "Blog: Web Tasarım, Marka ve Dijital Strateji Yazıları | Dijital Gru",
        "Web tasarım, marka kimliği, SEO ve sosyal medya üzerine Dijital Gru stüdyosunun hazırladığı güncel rehber ve analiz yazıları.",
        "/blog.html",
    ),
    "gallery.html": (
        "Galeri: Çalışmalarımızdan Kareler | Dijital Gru Tasarım Stüdyosu",
        "Dijital Gru tasarım stüdyosunun marka, web ve prodüksiyon çalışmalarından seçilmiş görseller galerisi.",
        "/gallery.html",
    ),
    "takvim.html": (
        "2026 Özel Günler Takvimi | Dijital Gru Tasarım Stüdyosu",
        "2026 yılı özel gün ve kampanya takvimi: markanız için içerik ve sosyal medya planlamasını önceden yapın.",
        "/takvim.html",
    ),
    "yazilimlarimiz.html": (
        "Yazılımlarımız: GetKasa, QR Studio, PressKitlive | Dijital Gru",
        "Dijital Gru'nun kendi yazılım ürünleri: GetKasa, QR Studio, PressKitlive, GuestList SaaS ve Grid Planner. İşletmenize özel yazılım da geliştiriyoruz.",
        "/yazilimlarimiz.html",
    ),
    "ozel-yazilim.html": (
        "Özel Yazılım & SaaS Ürün Detayları | Dijital Gru Stüdyo",
        "Şirketlere özel web tabanlı yazılım, yönetim paneli ve SaaS platformlarının detayları: QR Studio, PressKitlive, GuestList ve Sinopia projeleri.",
        "/ozel-yazilim.html",
    ),
}

EXISTING_PAGES = [k for k in META.keys() if k != "gallery.html"]

NEW_FOOTER_SERVICES = (
    '                        <li><a href="/restoran-web-sitesi-tasarimi.html">Restoran Web Sitesi Tasarımı</a></li>\n'
    '                        <li><a href="/luks-marka-kimligi-tasarimi.html">Lüks Marka Kimliği Tasarımı</a></li>\n'
    '                        <li><a href="/kurumsal-web-sitesi-tasarimi.html">Kurumsal Web Sitesi Tasarımı</a></li>\n'
    '                        <li><a href="/ozel-yazilim-gelistirme.html">Özel Yazılım Geliştirme</a></li>\n'
    '                        <li><a href="/qr-menu.html">QR Menü</a></li>\n'
    '                        <li><a href="/hizmetler.html">Tüm Hizmetler</a></li>\n'
)

FOOTER_BOTTOM_NEW = (
    '&copy; 2026 Dijital Gru Tasarım Stüdyosu. Tüm Hakları Saklıdır. '
    '<a href="/kariyer.html" style="font-size:12px;opacity:.55;margin-left:10px;">Kariyer</a>'
)


# --------------------------------------------------------------------------
# 1) Mevcut sayfalara ortak donusumler
# --------------------------------------------------------------------------

def common_transform(name, s):
    title, desc, canon = META[name]
    # title / description
    s = re.sub(r"<title>.*?</title>", "<title>%s</title>" % escape(title, quote=False), s, count=1, flags=re.S)
    if re.search(r'<meta name="description"', s):
        s = re.sub(r'<meta name="description" content="[^"]*"\s*/?>',
                   '<meta name="description" content="%s">' % attr(desc), s, count=1)
    else:
        s = s.replace("</title>", '</title>\n    <meta name="description" content="%s">' % attr(desc), 1)
    # eski canonical / og / twitter satirlarini temizle
    s = re.sub(r'\n[ \t]*<link rel="canonical"[^>]*>', "", s)
    s = re.sub(r'\n[ \t]*<meta property="og:[^>]*>', "", s)
    s = re.sub(r'\n[ \t]*<meta name="twitter:[^>]*>', "", s)
    s = re.sub(r'\n[ \t]*<meta name="keywords"[^>]*>', "", s) if name == "index.html" else s
    block = seo_block(title, desc, SITE + canon)
    s = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + "\n" + block.rstrip("\n"), s, count=1)

    # html lang
    if re.search(r"<html(?![^>]*lang=)", s):
        s = re.sub(r"<html", '<html lang="tr"', s, count=1)

    # ifadeler
    s = s.replace("Kreatif Reklam Ajansı", "Tasarım Stüdyosu")
    s = s.replace("kreatif reklam ve yazılım ajansı", "web tasarım, marka kimliği ve yazılım stüdyosu")

    # index.html -> /
    s = s.replace('href="index.html#', 'href="/#').replace('href="index.html"', 'href="/"')
    s = s.replace('href="./index.html"', 'href="/"')

    # alt metinler
    s = s.replace('alt="Dijital Gru"', 'alt="Dijital Gru logo"')

    # footer hizmet kolonu
    s = re.sub(
        r'(<h[34] class="footer-col-title">Hizmetlerimiz</h[34]>\s*<ul>\n)(.*?)(\s*</ul>)',
        lambda m: m.group(1) + NEW_FOOTER_SERVICES.rstrip("\n") + m.group(3),
        s, count=1, flags=re.S)
    # footer alt satir + kariyer linki
    s = re.sub(r"&copy; 2026 Dijital Gru[^<]*Tüm Hakları Saklıdır\.(?! <a href=\"/kariyer)", lambda m: FOOTER_BOTTOM_NEW, s)

    # surum
    s = s.replace("style.css?v=5.0", "style.css?v=5.2").replace("app.js?v=6.2", "app.js?v=6.2")
    return s


def fix_headings(name, s):
    # footer kolon basliklari -> h2
    s = re.sub(r'<h[34] class="footer-col-title">([^<]*)</h[34]>', r'<h2 class="footer-col-title">\1</h2>', s)
    if name == "iletisim.html":
        s = re.sub(r'<h4>(.*?)</h4>', r'<h2>\1</h2>', s, flags=re.S)
    if name == "index.html":
        s = re.sub(r'<h4>(.*?)</h4>', r'<h3>\1</h3>', s, flags=re.S)
    if name in ("ozel-yazilim.html", "yazilimlarimiz.html"):
        s = re.sub(r'<h3 class="pillar-title">(.*?)</h3>', r'<h2 class="pillar-title">\1</h2>', s, flags=re.S)
        s = re.sub(r'<h4 class="showcase-heading">(.*?)</h4>', r'<h3 class="showcase-heading">\1</h3>', s, flags=re.S)
    if name == "takvim.html":
        s = s.replace('<h3>Sosyal Medya Stratejinizi Birlikte Kuralım</h3>', '<h2>Sosyal Medya Stratejinizi Birlikte Kuralım</h2>')
        s = s.replace('<h4 class="row-title">', '<h3 class="row-title">')
    if name in ("designs.html", "blog.html"):
        s = re.sub(r'<h3 class="modal-title"([^>]*)>(.*?)</h3>', r'<h2 class="modal-title"\1>\2</h2>', s, flags=re.S)
    if name == "blog.html":
        s = s.replace('<h3 class="blog-card-title"', '<h2 class="blog-card-title"')
        s = re.sub(r'(<h2 class="blog-card-title"[^>]*>.*?)</h3>', r'\1</h2>', s, flags=re.S)
    return s


SUBJECT_SELECT = '''<div class="form-group form-group-select">
                            <select id="subject-field" name="subject_title" required>
                                <option value="" disabled selected>Konu seçiniz</option>
                                <option value="Proje Teklifi">Proje Teklifi</option>
                                <option value="Mevcut Proje">Mevcut Proje</option>
                                <option value="İş Başvurusu">İş Başvurusu</option>
                                <option value="Diğer">Diğer</option>
                            </select>
                            <label for="subject-field">Konu</label>
                        </div>
                        <div class="career-note" id="career-note" hidden>
                            <i class="fa-solid fa-circle-info"></i>
                            İş başvuruları bu formdan değerlendirilmez. Lütfen <a href="/kariyer.html">kariyer sayfamızı</a> inceleyin.
                        </div>'''


def swap_subject_field(s):
    pat = r'<div class="form-group">\s*<input type="text" id="subject-field"[^>]*>\s*<label for="subject-field">[^<]*</label>\s*</div>'
    new, n = re.subn(pat, SUBJECT_SELECT, s, count=1)
    return new, n


def ensure_honeypot(s):
    if 'name="website"' in s or 'id="contact-submit-btn"' not in s:
        return s
    hp = ('<div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true">'
          '<label>Web siteniz<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>\n                        ')
    return s.replace('<button type="submit" class="btn btn-primary btn-submit" id="contact-submit-btn"', hp + '<button type="submit" class="btn btn-primary btn-submit" id="contact-submit-btn"', 1)


INDEX_JSONLD = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": SITE + "/#organization",
    "name": "Dijital Gru",
    "url": SITE + "/",
    "logo": SITE + "/Logo/logo-dikey-krem.png",
    "image": OG_IMAGE,
    "description": "Şişli merkezli web tasarım ve marka stüdyosu. Lüks restoran, beach club, hospitality ve premium markalar için web sitesi, kurumsal kimlik ve özel yazılım.",
    "telephone": "+90 537 627 44 15",
    "email": "dijitalgru@gmail.com",
    "priceRange": "$$",
    "address": {
        "@type": "PostalAddress",
        "addressLocality": "İstanbul",
        "addressRegion": "İstanbul",
        "addressCountry": "TR",
    },
    "areaServed": [
        {"@type": "City", "name": "İstanbul"},
        {"@type": "Country", "name": "Türkiye"},
    ],
    "sameAs": [
        "https://www.instagram.com/dijitalgru/",
        "https://www.youtube.com/@DijitalGru",
    ],
    "makesOffer": [
        {"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}}
        for n in ["Restoran Web Sitesi Tasarımı", "Lüks Marka Kimliği Tasarımı",
                  "Kurumsal Web Sitesi Tasarımı", "Özel Yazılım Geliştirme", "QR Menü"]
    ],
}


def transform_index(s):
    s = re.sub(
        r'<script type="application/ld\+json">\s*\{[^<]*?"AdvertisingAgency"[^<]*?</script>',
        lambda m: jsonld(INDEX_JSONLD).strip(),
        s, count=1, flags=re.S)
    s = s.replace("Dijital Gru Tasarım Stüdyosu</span>", "Web Tasarım &amp; Marka Stüdyosu</span>", 1) if "hero-badge" in s else s
    s = re.sub(
        r'(<h1 class="hero-title scroll-reveal">)\s*.*?(</h1>)',
        r'\1\n                    Lüks Markalar İçin <span class="gradient-text">Web Tasarım</span> &amp; Marka Kimliği Stüdyosu\n                \2',
        s, count=1, flags=re.S)
    # hizmet kartlari
    card_map = {
        "Şirketinize Özel Yazılım": "/ozel-yazilim-gelistirme.html",
        "Kreatif Strateji": "/luks-marka-kimligi-tasarimi.html",
    }
    for key, href in card_map.items():
        s = re.sub(
            r'href="[^"]*"((?:(?!</a>).)*?<h3 class="service-name">' + re.escape(key) + ")",
            lambda m: 'href="%s"%s' % (href, m.group(1)),
            s, count=1, flags=re.S)
    return s


def transform_hizmetler(s):
    s = s.replace('"AdvertisingAgency"', '"ProfessionalService"')
    s = s.replace("Kreatif Reklam &amp; Dijital Pazarlama Hizmetleri", "Web Tasarım, Marka Kimliği ve Yazılım Hizmetleri")
    s = s.replace("Kreatif Reklam & Dijital Pazarlama Hizmetleri", "Web Tasarım, Marka Kimliği ve Yazılım Hizmetleri")
    s = s.replace("360° Dijital Ajans Hizmetleri", "360° Dijital Stüdyo Hizmetleri")
    s = re.sub(r'(<h1 class="page-title"[^>]*>).*?(</h1>)',
               r"\1Lüks Markalar İçin Web Tasarım, Marka ve Yazılım Hizmetleri\2", s, count=1, flags=re.S)
    s = s.replace("profesyonel ajans hizmeti sunuyoruz", "profesyonel stüdyo hizmeti sunuyoruz")
    hub = build_hub_cards()
    if "<!-- HUB-START -->" in s:
        s = re.sub(r"<!-- HUB-START -->.*?<!-- HUB-END -->", hub, s, flags=re.S)
    else:
        s = s.replace("    <!-- Full Services Breakdown Section -->", hub + "\n\n    <!-- Full Services Breakdown Section -->", 1)
    return s


def transform_kurumsal(s):
    s = s.replace("— KREATİF KADROMUZ —", "— UZMAN ORTAKLARIMIZ —")
    s = s.replace("Geleceği Şekillendiren Ekibimiz", "Birlikte Çalıştığımız Uzmanlar")
    s = s.replace(
        "Her biri kendi alanında uzman, yenilikçi fikirleri ve teknik mükemmelliği hedefleyen ajans kadromuz.",
        "Projenizin her aşamasında yanınızda olan tasarım, yazılım, prodüksiyon ve reklam uzmanlarıyla birlikte çalışıyoruz.")
    s = re.sub(r'(<h1 class="page-title"[^>]*>).*?(</h1>)',
               r"\1Markaların Arkasındaki Tasarım &amp; Yazılım Stüdyosu\2", s, count=1, flags=re.S)
    s = s.replace("Geleneksel ajans kısıtlamalarını aşarak;", "Geleneksel kalıpların dışına çıkarak;")
    return s


def transform_blog_page(s):
    # statik liste + yer tutucu temizligi
    posts = load_posts()
    cards = "\n".join(static_card(p) for p in posts)
    side = "\n".join(
        '                    <li class="sidebar-project-item%s"><a href="/blog/%s.html" data-id="%s">%s</a></li>' %
        (" active" if i == 0 else "", p["slug"], p["id"], escape(p["title"])) for i, p in enumerate(posts))
    s = re.sub(r'(<ul class="sidebar-project-list" id="sidebar-project-list">).*?(</ul>)',
               lambda m: m.group(1) + "\n" + side + "\n                " + m.group(2), s, count=1, flags=re.S)
    s = re.sub(r'(<div class="portfolio-grid" id="designs-grid">).*?(</div>\s*\n\s*<!-- Empty State -->)',
               lambda m: m.group(1) + "\n" + cards + "\n                " + m.group(2), s, count=1, flags=re.S)
    s = re.sub(r'<div class="no-results" id="no-results"[^>]*>.*?</div>', '<div class="no-results" id="no-results" style="display:none"></div>', s, count=1, flags=re.S)
    s = re.sub(r'(<h3 class="modal-title" id="modal-title">)[^<]*(</h3>)', r"\1\2", s)
    s = re.sub(r'(<div class="modal-client" id="modal-client">).*?(</div>)', r"\1\2", s, flags=re.S)
    s = re.sub(r'(<span class="modal-cat" id="modal-cat">)[^<]*(</span>)', r"\1\2", s)
    s = s.replace("Kreatif Dünyadan Güncel İçgörüler", "Marka, Web Tasarım ve Dijital Strateji Yazıları")
    s = s.replace('href="index.html"', 'href="/"')
    return s


# --------------------------------------------------------------------------
# 2) Hizmet sayfalari
# --------------------------------------------------------------------------

PORTFOLIO = json.load(open(ROOT / "portfolio.json", encoding="utf-8"))
PBY = {p["title"]: p for p in PORTFOLIO}


def short(t, n=190):
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= n:
        return t
    cut = t[:n]
    k = max(cut.rfind(". "), cut.rfind(", "), cut.rfind(" "))
    return cut[:k].rstrip(",.") + "…"


SERVICES = [
    {
        "slug": "restoran-web-sitesi-tasarimi",
        "name": "Restoran Web Sitesi Tasarımı",
        "title": "Restoran, Beach Club & Gece Kulübü Web Sitesi Tasarımı | Dijital Gru İstanbul",
        "desc": "Restoran, kafe, beach club ve gece kulübü için rezervasyon odaklı, mobil uyumlu premium web sitesi tasarımı. Şişli İstanbul merkezli Dijital Gru.",
        "h1": "Restoran, Kafe, Beach Club ve Gece Kulübü İçin Web Sitesi Tasarımı",
        "badge": "Hospitality Web Tasarımı",
        "icon": "fa-utensils",
        "subtitle": "Mekanınızın atmosferini ekrana taşıyan, misafiri rezervasyona yönlendiren premium web siteleri tasarlıyoruz.",
        "intro_h": "Misafir sizi bulduğunda ilk izlenim web siteniz olur",
        "intro": [
            "Bir mekanı seçen kişi önce Google'a, sonra Instagram'a ve sonunda web sitesine bakar. Yavaş açılan, mobilde bozuk görünen ya da menüyü PDF olarak indirten bir site, ne kadar iyi bir mekanınız olursa olsun masayı başka yere kaptırır.",
            "Restoran, kafe, beach club ve gece kulübü için tasarladığımız sitelerde mekanın ruhunu yansıtan görsel dil, hızlı menü erişimi, rezervasyon ve WhatsApp yönlendirmesi ile Google'da yerel aramalarda görünürlük birlikte ele alınır.",
        ],
        "points": ["Mobil öncelikli, hızlı açılan tasarım", "Rezervasyon ve WhatsApp yönlendirmesi", "Dijital menü ve QR entegrasyonu", "Yerel SEO ve Google Haritalar uyumu"],
        "steps": [
            ("Keşif ve Konumlandırma", "Mekanın konsepti, hedef misafir kitlesi ve rakipleri analiz edilir; sitenin hangi aksiyona hizmet edeceği netleştirilir."),
            ("Tasarım Dili ve Prototip", "Marka renkleri, tipografi ve atmosfer fotoğrafları ile sayfa akışı tasarlanır. Onayınıza prototip olarak sunulur."),
            ("Geliştirme ve Entegrasyon", "Hızlı, mobil uyumlu site kodlanır; menü, rezervasyon, harita ve sosyal medya bağlantıları eklenir."),
            ("Yayın ve Görünürlük", "Alan adı, SEO ayarları ve Google işletme profili bağlantıları yapılır; yayın sonrası performans izlenir."),
        ],
        "projects": ["Sinopia Mantı Web Sitesi", "Korto İstanbul", "İsla Alaçatı"],
        "faq": [
            ("Restoran web sitesi ne kadar sürede hazırlanır?", "Kapsama göre değişir. Tek sayfalık tanıtım sitelerinde süre kısadır, çok sayfalı menü ve rezervasyon sistemli sitelerde daha uzundur. Keşif görüşmesinden sonra net bir takvim paylaşırız."),
            ("Menüyü kendim güncelleyebilir miyim?", "Evet. Menü ve duyuru alanlarını teknik bilgi gerektirmeden güncelleyebileceğiniz bir yapı kurabiliriz."),
            ("Rezervasyon sistemi siteye eklenebilir mi?", "Evet. Mevcut rezervasyon yazılımınızı entegre edebilir ya da WhatsApp ve form tabanlı bir rezervasyon akışı kurabiliriz."),
            ("Beach club ve gece kulübü için de çalışıyor musunuz?", "Evet. Etkinlik takvimi, masa rezervasyonu ve sezonluk kampanyalar gibi bu mekanlara özel ihtiyaçlara göre tasarım yapıyoruz."),
        ],
        "related": ["qr-menu", "luks-marka-kimligi-tasarimi", "kurumsal-web-sitesi-tasarimi"],
    },
    {
        "slug": "luks-marka-kimligi-tasarimi",
        "name": "Lüks Marka Kimliği Tasarımı",
        "title": "Lüks Marka Kimliği & Logo Tasarımı | Dijital Gru İstanbul Stüdyo",
        "desc": "Premium markalar, restoranlar ve otelleri için logo, renk ve tipografi sistemi ile eksiksiz kurumsal kimlik tasarımı. Şişli merkezli Dijital Gru.",
        "h1": "Lüks ve Premium Markalar İçin Marka Kimliği Tasarımı",
        "badge": "Marka Kimliği Stüdyosu",
        "icon": "fa-compass-drafting",
        "subtitle": "Logodan menüye, ambalajdan sosyal medyaya kadar markanızı tutarlı ve akılda kalıcı bir dünyaya dönüştürüyoruz.",
        "intro_h": "Lüks bir marka, tutarlılıkla algılanır",
        "intro": [
            "Premium segmentte müşteri ürününüzü değil, markanızın verdiği güveni satın alır. Farklı mecralarda farklı görünen bir marka, fiyatını savunmakta zorlanır.",
            "Konumlandırmadan başlayıp logo, renk paleti, tipografi, menü, afiş ve sosyal medya şablonlarına uzanan bütüncül bir kimlik sistemi hazırlarız. Böylece her temas noktasında aynı kaliteyi hissettirirsiniz.",
        ],
        "points": ["Marka konumlandırma ve hikaye", "Logo ve kimlik sistemi", "Menü, afiş ve basılı materyaller", "Sosyal medya şablonları"],
        "steps": [
            ("Marka Keşfi", "Vizyon, hedef kitle ve rakipler incelenir; markanın nerede durması gerektiği belirlenir."),
            ("Konsept ve Logo", "Birkaç yönlü konsept hazırlanır; seçilen yön logo, renk ve tipografi sistemine dönüştürülür."),
            ("Kimlik Sistemi", "Kullanım kuralları, menü, kartvizit, ambalaj ve dijital şablonlar tek bir rehberde toplanır."),
            ("Teslim ve Uygulama", "Tüm dosyalar teslim edilir; dilerseniz web sitesi ve sosyal medya uygulamasını da biz yaparız."),
        ],
        "projects": ["Letafia", "Galleria", "Bohemiam"],
        "faq": [
            ("Marka kimliği paketinde neler yer alır?", "Logo, renk paleti, tipografi, kullanım rehberi ve ihtiyaca göre menü, kartvizit, afiş ve sosyal medya şablonları. Kapsam görüşmede birlikte belirlenir."),
            ("Mevcut logomu yenileyebilir misiniz?", "Evet. Mevcut kimliğin güçlü yanlarını koruyarak yenileme veya sıfırdan tasarım seçeneklerini değerlendiririz."),
            ("Tasarım sürecinde kaç revizyon hakkım var?", "Her aşamada geri bildirimle ilerleriz. Revizyon kapsamını teklif aşamasında yazılı olarak netleştiririz."),
            ("Kimliği web sitesine de uygulıyor musunuz?", "Evet. Marka kimliği ile web sitesini aynı stüdyoda yaparak tutarlılığı garanti ederiz."),
        ],
        "related": ["restoran-web-sitesi-tasarimi", "kurumsal-web-sitesi-tasarimi", "qr-menu"],
    },
    {
        "slug": "kurumsal-web-sitesi-tasarimi",
        "name": "Kurumsal Web Sitesi Tasarımı",
        "title": "Kurumsal Web Sitesi Tasarımı İstanbul | Dijital Gru Stüdyo",
        "desc": "Hızlı, SEO uyumlu ve markanıza özel kurumsal web sitesi tasarımı. İstanbul Şişli merkezli Dijital Gru ile güven veren bir dijital vitrin kurun.",
        "h1": "Kurumsal Web Sitesi Tasarımı",
        "badge": "Kurumsal Web Tasarımı",
        "icon": "fa-laptop-code",
        "subtitle": "Markanızın güvenini ilk saniyede veren, hızlı ve arama motorlarına hazır kurumsal web siteleri.",
        "intro_h": "Web siteniz, satış ekibinizin 7/24 çalışan üyesidir",
        "intro": [
            "Potansiyel müşteri sizinle görüşmeden önce siteyi inceler. Eski görünen, yavaş açılan veya iletişim yolu belirsiz bir site, teklif talebinin hiç gelmemesine yol açar.",
            "Kurumsal sitelerinizi marka kimliğinize uygun, hızlı ve SEO hazır kurar; ziyaretçiyi doğru sayfalara ve teklif formuna yönlendiririz. Böylece site sadece var olmakla kalmaz, müşteri kazandırır.",
        ],
        "points": ["Marka kimliğine özel tasarım", "Mobil uyumlu ve hızlı altyapı", "SEO hazır sayfa yapısı", "Teklif formu ve ölçümleme"],
        "steps": [
            ("Hedef ve İçerik Planı", "Siteden beklediğiniz sonuç, hedef kitle ve sayfa yapısı belirlenir; içerik iskeleti çıkarılır."),
            ("Tasarım", "Marka diline uygun masaüstü ve mobil tasarımlar hazırlanır, onayınıza sunulur."),
            ("Geliştirme ve SEO", "Hızlı kodlama, başlık ve meta düzeni, site haritası ve şema işaretlemeleri eklenir."),
            ("Yayın ve Takip", "Siteyi yayına alır, ölçümlemeyi kurar ve ilk haftalarda performansı birlikte izleriz."),
        ],
        "projects": ["Dijital Gru Web Sitesi", "Grid Planner Web Sitesi", "Sinopia Mantı Web Sitesi"],
        "faq": [
            ("Kurumsal web sitesi kaç sayfa olmalı?", "İhtiyaca göre değişir. Genelde ana sayfa, hizmetler, hakkımızda, projeler ve iletişim ile başlanır; büyüdükçe blog ve yeni hizmet sayfaları eklenir."),
            ("Site yayına alındıktan sonra destek veriyor musunuz?", "Evet. Yayın sonrası güncelleme ve teknik destek seçeneklerini teklif aşamasında netleştiririz."),
            ("Sitem Google'da çıkar mı?", "Teknik SEO ve içerik yapısını doğru kurarız. Sıralama zaman ve rekabete bağlıdır; kimse sıra garantisi veremez."),
            ("Alan adı ve barındırmayı siz mi hallediyorsunuz?", "Evet, isterseniz alan adı ve barındırma kurulumunu da biz yapar, yönetimi size devrederiz."),
        ],
        "related": ["restoran-web-sitesi-tasarimi", "luks-marka-kimligi-tasarimi", "ozel-yazilim-gelistirme"],
    },
    {
        "slug": "ozel-yazilim-gelistirme",
        "name": "Özel Yazılım Geliştirme",
        "title": "Özel Yazılım Geliştirme & Web Uygulaması | Dijital Gru İstanbul",
        "desc": "İşletmenize özel web uygulaması, yönetim paneli ve SaaS yazılımı geliştirme. QR Studio ve GetKasa ürünlerinin geliştiricisi Dijital Gru.",
        "h1": "İşletmenize Özel Yazılım Geliştirme",
        "badge": "Özel Yazılım & SaaS",
        "icon": "fa-code",
        "subtitle": "Hazır araçların yetmediği yerde, işinize birebir uyan web uygulamaları ve yönetim panelleri geliştiriyoruz.",
        "intro_h": "Hazır yazılım işinize uymadığında",
        "intro": [
            "Birçok işletme rezervasyon, stok, misafir listesi veya raporlama için birden fazla araç kullanır ve bunları elle birleştirir. Bu hem zaman kaybettirir hem hataya açıktır.",
            "Kendi SaaS ürünlerimizi (QR Studio, GetKasa, PressKitlive, GuestList) geliştiren ekip olarak, işletmenize özel panel ve otomasyonları aynı mühendislik yaklaşımıyla hayata geçiririz.",
        ],
        "points": ["Web uygulaması ve yönetim paneli", "Otomasyon ve entegrasyon", "Bulut tabanlı, ölçeklenebilir mimari", "Kendi SaaS ürünlerimizden deneyim"],
        "steps": [
            ("İhtiyaç Analizi", "Mevcut iş akışınız incelenir; hangi süreçlerin yazılıma dönüşeceği ve önceliklerin ne olduğu belirlenir."),
            ("Tasarım ve Prototip", "Ekran akışları ve veri yapısı tasarlanır; çalışan bir prototip üzerinden onay alınır."),
            ("Geliştirme", "Yazılım aşamalar halinde geliştirilir; her aşamada test sürümü paylaşılır."),
            ("Yayın ve Destek", "Canlıya alma, eğitim ve sonraki geliştirmeler için destek planı yapılır."),
        ],
        "projects": ["Grid Planner Web Sitesi", "Sinopia Mantı Web Sitesi", "Limoni Hotel"],
        "faq": [
            ("Özel yazılım maliyeti nasıl belirlenir?", "Kapsam, ekran sayısı ve entegrasyonlara göre belirlenir. Analiz görüşmesinden sonra yazılı bir teklif sunarız."),
            ("Hangi teknolojileri kullanıyorsunuz?", "Projeye göre modern web teknolojileri ve bulut altyapıları kullanırız. Detayları keşif sonrası netleştiririz."),
            ("Hazır ürünleriniz özelleştirilebilir mi?", "Evet. QR Studio ve GetKasa gibi ürünlerimizi ihtiyacınıza göre uyarlayabiliriz."),
            ("Yazılımın kaynak koduna sahip olacak mıyım?", "Teslim koşulları ve mülkiyet sözleşmede açıkça yazılır. Bunu teklif aşamasında konuşuruz."),
        ],
        "related": ["qr-menu", "kurumsal-web-sitesi-tasarimi", "restoran-web-sitesi-tasarimi"],
        "custom_links": [("Yazılımlarımız sayfası", "/yazilimlarimiz.html")],
    },
    {
        "slug": "qr-menu",
        "name": "QR Menü",
        "title": "QR Menü Sistemi & Dijital Menü Tasarımı | Dijital Gru İstanbul",
        "desc": "Restoran, kafe ve oteller için QR menü ve dijital menü tasarımı. Dijitalgru QR Studio ile menünüzü anında güncelleyin, baskı maliyetinden kurtulun.",
        "h1": "QR Menü ve Dijital Menü Tasarımı",
        "badge": "Dijitalgru QR Studio",
        "icon": "fa-qrcode",
        "subtitle": "Menünüzü şık, hızlı ve anında güncellenebilir bir QR deneyimine dönüştürün.",
        "intro_h": "Menü basmak yerine bir kez kurun, istediğiniz an güncelleyin",
        "intro": [
            "Fiyat değişir, ürün biter, sezon menüsü yenilenir. Basılı menü her seferinde yeniden basım ve dağıtım demektir. Kötü hazırlanmış PDF menüler ise misafirin telefonunda açılmaz bile.",
            "Dijitalgru QR Studio ile marka tasarımınıza uygun, hızlı açılan bir QR menü kurarız. Menüyü kendiniz güncellersiniz, QR kodu masa ve materyallerinize bir kez uygularsınız.",
        ],
        "points": ["Marka tasarımına uygun dijital menü", "Anında güncelleme", "Masa ve mekan bazlı QR kodlar", "Basılı menü ile uyumlu tasarım"],
        "steps": [
            ("Menü ve Marka İncelemesi", "Mevcut menünüz, kategorileriniz ve marka dilinizi inceleriz."),
            ("Dijital Menü Tasarımı", "Mobilde hızlı açılan, okunaklı ve markanıza uygun menü arayüzü hazırlanır."),
            ("QR Kodların Hazırlanması", "Masa, vitrin ve basılı materyaller için QR kodlar üretilir ve tasarıma uygulanır."),
            ("Eğitim ve Yayın", "Menüyü nasıl güncelleyeceğinizi gösteririz; sistem canlıya alınır."),
        ],
        "projects": ["Shiso Menü Tasarımı", "Limoni Hotel Menü Tasarımı", "Pizza Dino"],
        "faq": [
            ("QR menüyü kendim güncelleyebilir miyim?", "Evet. Ürün, fiyat ve kategori değişikliklerini panelden anında yapabilirsiniz."),
            ("QR kod bir kez basılınca değişir mi?", "Hayır. QR kod aynı kalır, arkasındaki menü güncellenir. Dinamik QR yapısı bunu sağlar."),
            ("Basılı menü tasarımı da yapıyor musunuz?", "Evet. Dijital menü ile uyumlu basılı menü ve afiş tasarımlarını da hazırlıyoruz."),
            ("Dijitalgru QR Studio nedir?", "Kendi geliştirdiğimiz dinamik QR kod ve menü platformudur. Ayrıntıları qrdijitalgru.com adresinde bulabilirsiniz."),
        ],
        "related": ["restoran-web-sitesi-tasarimi", "luks-marka-kimligi-tasarimi", "ozel-yazilim-gelistirme"],
        "custom_links": [("Dijitalgru QR Studio'yu inceleyin", "https://qrdijitalgru.com/")],
    },
]
SVC_BY_SLUG = {s["slug"]: s for s in SERVICES}


def build_hub_cards():
    out = ['<!-- HUB-START -->',
           '    <section class="section-padding" style="padding-top: 10px; padding-bottom: 20px;">',
           '        <div class="container">',
           '            <h2 class="section-title" style="font-size: 28px; margin-bottom: 24px;">Uzmanlık Alanlarımız</h2>',
           '            <div class="svc-hub-grid">']
    for sv in SERVICES:
        out.append(
            '                <a href="/%s.html" class="svc-hub-card glass-card scroll-reveal">'
            '<span class="svc-hub-icon"><i class="fa-solid %s"></i></span>'
            '<h3>%s</h3><p>%s</p><span class="svc-hub-more">Detayları İncele <i class="fa-solid fa-arrow-right"></i></span></a>'
            % (sv["slug"], sv["icon"], escape(sv["name"]), escape(sv["subtitle"])))
    out += ['            </div>', '        </div>', '    </section>', '    <!-- HUB-END -->']
    return "\n".join(out)


def absolutize(html):
    """Goreli href/src degerlerini kok-mutlak yap (blog/ alt klasoru icin)."""
    return re.sub(r'(href|src)="(?!https?:|/|#|tel:|mailto:|data:|javascript:)([^"]*)"', r'\1="/\2"', html)


def shared_parts():
    h = read("hizmetler.html")
    gtm = re.search(r"<!-- Google Tag Manager -->.*?<!-- End Google Tag Manager -->", h, re.S).group(0)
    noscript = re.search(r"<!-- Google Tag Manager \(noscript\) -->.*?</noscript>", h, re.S).group(0)
    header = re.search(r"    <!-- Dynamic Grid Background -->.*?(?=    <!-- Inner Page Banner -->)", h, re.S).group(0)
    footer = re.search(r"    <!-- Footer -->.*?</footer>", h, re.S).group(0)
    head_assets = re.search(r"    <!-- Favicon -->.*?(?=</head>)", h, re.S).group(0)
    head_assets = head_assets.replace("style.css?v=5.0", "style.css?v=5.2")
    return gtm, noscript, header, footer, head_assets


def page_shell(title, desc, canonical, body, extra_head="", og_type="website", robots=None, active=None):
    gtm, noscript, header, footer, head_assets = shared_parts()
    header = absolutize(header).replace("nav-link active", "nav-link").replace("mobile-nav-link active", "mobile-nav-link")
    if active:
        header = header.replace('href="%s" class="nav-link"' % active, 'href="%s" class="nav-link active"' % active)
        header = header.replace('href="%s" class="mobile-nav-link"' % active, 'href="%s" class="mobile-nav-link active"' % active)
    robots_tag = '    <meta name="robots" content="%s">\n' % robots if robots else ""
    html = (
        '<!DOCTYPE html>\n<html lang="tr">\n<head>\n    %s\n\n    <meta charset="UTF-8">\n'
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "    <title>%s</title>\n    <meta name=\"description\" content=\"%s\">\n%s%s%s\n%s</head>\n<body>\n    %s\n\n%s\n%s\n\n%s\n\n"
        '    <script src="app.js?v=6.2"></script>\n</body>\n</html>\n'
    ) % (gtm, escape(title, quote=False), attr(desc), robots_tag,
         seo_block(title, desc, canonical, og_type), extra_head, head_assets,
         noscript, header, body, footer)
    return absolutize(html).replace('href="/index.html"', 'href="/"')


def project_cards(titles):
    cards = []
    for t in titles:
        p = PBY.get(t)
        if not p:
            continue
        cards.append(
            '                <a href="/designs.html" class="svc-project-card glass-card">'
            '<span class="svc-project-label">%s</span><h3>%s</h3><p>%s</p>'
            '<span class="svc-hub-more">Projeyi İncele <i class="fa-solid fa-arrow-right"></i></span></a>'
            % (escape(p.get("catLabel", "Proje")), escape(p["title"]), escape(short(p.get("desc", "")))))
    return "\n".join(cards)


def build_service_page(sv):
    steps = "\n".join(
        '                <div class="service-row-card"><div class="service-num">0%d</div><div class="service-info">'
        '<h3 class="service-title">%s</h3><p class="service-desc">%s</p></div></div>' % (i + 1, escape(t), escape(d))
        for i, (t, d) in enumerate(sv["steps"]))
    faq = "\n".join(
        '                <details class="svc-faq-item"><summary>%s</summary><p>%s</p></details>' % (escape(q), escape(a))
        for q, a in sv["faq"])
    points = "\n".join('                    <li><i class="fa-solid fa-check"></i> %s</li>' % escape(p) for p in sv["points"])
    intro = "\n".join("                <p>%s</p>" % escape(p) for p in sv["intro"])
    related = "".join(
        '<a href="/%s.html" class="btn btn-secondary">%s</a>' % (r, escape(SVC_BY_SLUG[r]["name"])) for r in sv["related"])
    for label, url in sv.get("custom_links", []):
        ext = ' target="_blank" rel="noopener"' if url.startswith("http") else ""
        related += '<a href="%s" class="btn btn-secondary"%s>%s</a>' % (url, ext, escape(label))
    body = '''    <section class="page-banner section-padding" style="padding-top: 140px; padding-bottom: 40px;">
        <div class="container">
            <div class="badge-reveal scroll-reveal">
                <span class="hero-badge"><i class="fa-solid %(icon)s"></i> %(badge)s</span>
            </div>
            <h1 class="page-title" style="margin-top: 16px;">%(h1)s</h1>
            <p class="page-subtitle">%(subtitle)s</p>
            <div style="margin-top: 28px;"><a href="/iletisim.html" class="btn btn-primary glow-btn" id="svc-hero-cta">Teklif Al</a></div>
        </div>
    </section>

    <section class="section-padding" style="padding-top: 20px;">
        <div class="container svc-section">
            <div class="svc-intro glass-card">
                <h2 class="svc-h2">%(intro_h)s</h2>
%(intro)s
                <ul class="svc-points">
%(points)s
                </ul>
            </div>

            <h2 class="svc-h2 svc-spaced">Nasıl Çalışıyoruz?</h2>
            <div class="svc-steps">
%(steps)s
            </div>

            <h2 class="svc-h2 svc-spaced">İlgili Projeler</h2>
            <div class="svc-project-grid">
%(projects)s
            </div>
            <!-- PROJE_GORSELI: Proje kartlarina gercek gorsel eklemek icin bu bolumu duzenleyin -->

            <h2 class="svc-h2 svc-spaced">Sık Sorulan Sorular</h2>
            <div class="svc-faq">
%(faq)s
            </div>

            <div class="svc-cta glass-card">
                <h2 class="svc-h2">Projenizi Konuşalım</h2>
                <p>İhtiyacınızı anlatın, size net bir kapsam ve teklif hazırlayalım.</p>
                <a href="/iletisim.html" class="btn btn-primary glow-btn" id="svc-bottom-cta"><i class="fa-solid fa-comments"></i> Teklif Al</a>
            </div>

            <h2 class="svc-h3-label">Diğer Hizmetlerimiz</h2>
            <div class="svc-related">%(related)s</div>
        </div>
    </section>
''' % {
        "icon": sv["icon"], "badge": escape(sv["badge"]), "h1": escape(sv["h1"]), "subtitle": escape(sv["subtitle"]),
        "intro_h": escape(sv["intro_h"]), "intro": intro, "points": points, "steps": steps,
        "projects": project_cards(sv["projects"]), "faq": faq, "related": related}
    url = "%s/%s.html" % (SITE, sv["slug"])
    faq_ld = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in sv["faq"]],
    }
    svc_ld = {
        "@context": "https://schema.org", "@type": "Service", "name": sv["name"], "serviceType": sv["name"],
        "description": sv["desc"], "url": url,
        "provider": {"@type": "ProfessionalService", "name": "Dijital Gru", "url": SITE + "/"},
        "areaServed": [{"@type": "City", "name": "İstanbul"}, {"@type": "Country", "name": "Türkiye"}],
    }
    bc = breadcrumb([("Dijital Gru", SITE + "/"), ("Hizmetler", SITE + "/hizmetler.html"), (sv["name"], url)])
    extra = jsonld(faq_ld) + jsonld(svc_ld) + jsonld(bc)
    return page_shell(sv["title"], sv["desc"], url, body, extra_head=extra, active="/hizmetler.html")


# --------------------------------------------------------------------------
# 3) Blog
# --------------------------------------------------------------------------

MONTHS = {"Ocak": 1, "Şubat": 2, "Mart": 3, "Nisan": 4, "Mayıs": 5, "Haziran": 6,
          "Temmuz": 7, "Ağustos": 8, "Eylül": 9, "Ekim": 10, "Kasım": 11, "Aralık": 12}


def iso_date(t):
    m = re.match(r"(?:(\d{1,2})\s+)?([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})", t.strip())
    if not m:
        return "2026-01-01"
    d = int(m.group(1)) if m.group(1) else 1
    return "%s-%02d-%02d" % (m.group(3), MONTHS.get(m.group(2), 1), d)


def related_service(p):
    t = (p["title"] + " " + p["category"]).lower()
    if "seo" in t or "google" in t:
        return "kurumsal-web-sitesi-tasarimi"
    if "logo" in t or "renk" in t or "marka" in t:
        return "luks-marka-kimligi-tasarimi"
    if "ajans" in t:
        return "kurumsal-web-sitesi-tasarimi"
    return "restoran-web-sitesi-tasarimi"


def load_posts():
    posts = json.load(open(ROOT / "blog.json", encoding="utf-8"))
    for p in posts:
        p["slug"] = slugify(p["title"])[:70].rstrip("-")
        p["iso"] = iso_date(p["date"])
    return posts


def clean_content(html):
    # author-box (eski yazar bloku) cikar: eslesen </div> bulana kadar
    while True:
        i = html.find('<div class="author-box"')
        if i < 0:
            break
        depth, j = 0, i
        for m in re.finditer(r"<div\b|</div>", html[i:]):
            depth += 1 if m.group(0).startswith("<div") else -1
            if depth == 0:
                j = i + m.end()
                break
        html = html[:i] + html[j:]
    html = html.replace("<h4", "<h4__").replace("</h4>", "</h4__>")
    html = html.replace("<h3", "<h2").replace("</h3>", "</h2>")
    html = html.replace("<h4__", "<h3").replace("</h4__>", "</h3>")
    return html


def static_card(p):
    img = ("/" + quote_path(p["image"])) if p.get("image") else ""
    return (
        '                <div class="portfolio-item glass-card scroll-reveal revealed" data-id="%s" style="display: flex; opacity: 1; transform: scale(1); flex-direction: column;">\n'
        '                    <div class="blog-card-img-wrapper" style="height: 220px;">\n'
        '                        <img src="%s" alt="%s" style="width:100%%;height:100%%;object-fit:cover;object-position:%s;border-radius:16px 16px 0 0;" loading="lazy">\n'
        '                        <span class="blog-card-badge">%s</span>\n'
        '                    </div>\n'
        '                    <div class="blog-card-content" style="padding: 24px;">\n'
        '                        <div class="blog-card-meta" style="margin-bottom: 12px; font-size: 12px;">\n'
        '                            <span class="meta-date"><i class="fa-regular fa-calendar"></i> %s</span>\n'
        '                            <span class="meta-read"><i class="fa-regular fa-clock"></i> %s</span>\n'
        '                        </div>\n'
        '                        <h3 class="blog-card-title" style="font-size: 18px; margin-bottom: 8px;"><a href="/blog/%s.html" style="color:inherit;text-decoration:none;">%s</a></h3>\n'
        '                        <p class="blog-card-excerpt" style="font-size: 13px; line-height: 1.5; margin-bottom: 18px;">%s</p>\n'
        '                        <a href="/blog/%s.html" class="blog-card-link" style="font-size: 13px;">Okumaya Başla <i class="fa-solid fa-arrow-right"></i></a>\n'
        '                    </div>\n'
        '                </div>'
    ) % (p["id"], img, attr(p["title"]), p.get("imagePosition", "50% 35%"), escape(p.get("badge") or p["category"]),
         escape(p["date"]), escape(p["readTime"]), p["slug"], escape(p["title"]), escape(p["excerpt"]), p["slug"])


def quote_path(f):
    from urllib.parse import quote
    return quote(f)


def build_blog_post(p):
    svc = SVC_BY_SLUG[related_service(p)]
    url = "%s/blog/%s.html" % (SITE, p["slug"])
    seo = p.get("seo") or {}
    title = seo.get("title") or (p["title"] + " | Dijital Gru")
    desc = seo.get("description") or p["excerpt"]
    img_url = SITE + "/" + quote_path(p["image"]) if p.get("image") else OG_IMAGE
    body = '''    <section class="page-banner section-padding" style="padding-top: 140px; padding-bottom: 20px;">
        <div class="container svc-article-wrap">
            <div class="badge-reveal"><span class="hero-badge"><i class="fa-regular fa-newspaper"></i> %(cat)s</span></div>
            <h1 class="page-title" style="margin-top: 16px;">%(title)s</h1>
            <p class="svc-article-meta">
                <span><i class="fa-regular fa-user"></i> F. Egemen Güneş</span>
                <span><i class="fa-regular fa-calendar"></i> <time datetime="%(iso)s">%(date)s</time></span>
                <span><i class="fa-regular fa-clock"></i> %(read)s</span>
            </p>
        </div>
    </section>
    <section class="section-padding" style="padding-top: 10px;">
        <article class="container svc-article-wrap svc-article">
            %(img)s
            %(content)s
            <aside class="svc-article-related glass-card">
                <h2 class="svc-h2">İlgili Hizmet: %(sname)s</h2>
                <p>%(ssub)s</p>
                <a href="/%(sslug)s.html" class="btn btn-primary">Hizmeti İncele</a>
                <a href="/iletisim.html" class="btn btn-secondary">Teklif Al</a>
            </aside>
            <p style="margin-top:28px;"><a href="/blog.html" class="svc-hub-more"><i class="fa-solid fa-arrow-left"></i> Tüm Yazılar</a></p>
        </article>
    </section>
''' % {
        "cat": escape(p["category"]), "title": escape(p["title"]), "iso": p["iso"], "date": escape(p["date"]),
        "read": escape(p["readTime"]),
        "img": ('<img class="svc-article-img" src="/%s" alt="%s" loading="eager">' % (quote_path(p["image"]), attr(p["title"]))) if p.get("image") else "",
        "content": clean_content(p["content"]),
        "sname": escape(svc["name"]), "ssub": escape(svc["subtitle"]), "sslug": svc["slug"]}
    art = {
        "@context": "https://schema.org", "@type": "Article", "headline": p["title"], "description": desc,
        "image": img_url, "datePublished": p["iso"], "dateModified": p["iso"],
        "author": {"@type": "Person", "name": "F. Egemen Güneş", "url": SITE + "/kurumsal.html"},
        "publisher": {"@type": "Organization", "name": "Dijital Gru",
                      "logo": {"@type": "ImageObject", "url": OG_IMAGE}},
        "mainEntityOfPage": url, "inLanguage": "tr",
    }
    bc = breadcrumb([("Dijital Gru", SITE + "/"), ("Blog", SITE + "/blog.html"), (p["title"], url)])
    html = page_shell(title, desc, url, body, extra_head=jsonld(art) + jsonld(bc), og_type="article", active="/blog.html")
    return html.replace('<meta property="og:image" content="%s">' % OG_IMAGE, '<meta property="og:image" content="%s">' % img_url)


# --------------------------------------------------------------------------
# 4) Kariyer
# --------------------------------------------------------------------------

def build_kariyer():
    body = '''    <section class="page-banner section-padding" style="padding-top: 140px; padding-bottom: 80px;">
        <div class="container svc-article-wrap">
            <h1 class="page-title">Kariyer</h1>
            <div class="svc-intro glass-card" style="margin-top: 28px;">
                <p>Şu an açık pozisyon yok.</p>
                <p>Yine de bizimle çalışmak isterseniz portfolyonuzu şu adrese gönderebilirsiniz:
                <strong><a href="mailto:KARIYER_EMAIL">KARIYER_EMAIL</a></strong></p>
                <p style="opacity:.7;font-size:14px;">Proje teklifi için lütfen <a href="/iletisim.html">iletişim sayfasını</a> kullanın.</p>
            </div>
        </div>
    </section>
'''
    return page_shell("Kariyer | Dijital Gru", "Dijital Gru kariyer sayfası.", SITE + "/kariyer.html", body, robots="noindex, follow")


# --------------------------------------------------------------------------
# 5) CSS
# --------------------------------------------------------------------------

CSS_MARK = "/* === DG-SEO-2026 === */"
CSS_BLOCK = CSS_MARK + '''
.svc-section, .svc-article-wrap { max-width: 1000px; margin: 0 auto; }
.svc-intro { padding: 36px; }
.svc-intro p, .svc-cta p { color: var(--text-light-muted); line-height: 1.8; margin: 0 0 14px; }
.svc-h2 { font-family: var(--font-headings); font-size: 28px; font-weight: 800; color: #fff; margin: 0 0 16px; }
.svc-h3-label { font-family: var(--font-headings); font-size: 18px; color: #fff; margin: 40px 0 14px; }
.svc-spaced { margin-top: 56px; }
.svc-points { list-style: none; padding: 0; margin: 20px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.svc-points li { color: #fff; font-weight: 600; font-size: 15px; }
.svc-points i { color: var(--accent-gold); margin-right: 8px; }
.svc-steps { display: flex; flex-direction: column; gap: 18px; }
.svc-project-grid, .svc-hub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
.svc-project-card, .svc-hub-card { display: flex; flex-direction: column; gap: 10px; padding: 26px; text-decoration: none; color: inherit; transition: transform .3s ease, border-color .3s ease; }
.svc-project-card:hover, .svc-hub-card:hover { transform: translateY(-5px); border-color: rgba(var(--accent-gold-rgb), .5); }
.svc-project-card h3, .svc-hub-card h3 { font-family: var(--font-headings); font-size: 20px; color: #fff; margin: 0; }
.svc-project-card p, .svc-hub-card p { color: var(--text-light-muted); font-size: 14px; line-height: 1.6; margin: 0; flex: 1; }
.svc-project-label { color: var(--accent-gold); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.svc-hub-icon { width: 46px; height: 46px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--accent-gold-rgb), .15); color: var(--accent-gold); font-size: 20px; }
.svc-hub-more { color: var(--accent-gold); font-weight: 700; font-size: 14px; text-decoration: none; }
.svc-faq { display: flex; flex-direction: column; gap: 12px; }
.svc-faq-item { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 18px 22px; }
.svc-faq-item summary { cursor: pointer; font-weight: 700; color: #fff; font-size: 16px; }
.svc-faq-item p { color: var(--text-light-muted); line-height: 1.7; margin: 12px 0 0; }
.svc-cta { text-align: center; padding: 44px 28px; margin-top: 56px; }
.svc-related { display: flex; flex-wrap: wrap; gap: 12px; }
.svc-article-meta { display: flex; flex-wrap: wrap; gap: 18px; color: var(--text-light-muted); font-size: 14px; margin-top: 14px; }
.svc-article-meta i { color: var(--accent-gold); margin-right: 6px; }
.svc-article-img { width: 100%; max-height: 420px; object-fit: cover; border-radius: 18px; margin-bottom: 28px; }
.svc-article { color: var(--text-light-muted); line-height: 1.85; font-size: 17px; }
.svc-article h2 { font-family: var(--font-headings); font-size: 26px; color: #fff; margin: 38px 0 14px; }
.svc-article h3 { font-family: var(--font-headings); font-size: 20px; color: #fff; margin: 28px 0 10px; }
.svc-article p { margin: 0 0 18px; }
.svc-article ul, .svc-article ol { margin: 0 0 20px 22px; }
.svc-article li { margin-bottom: 8px; }
.svc-article strong { color: #fff; }
.svc-article a { color: var(--accent-gold); }
.svc-article blockquote { border-left: 3px solid var(--accent-gold); margin: 24px 0; padding: 8px 20px; background: rgba(255,255,255,.04); border-radius: 0 12px 12px 0; }
.svc-article table { width: 100%; border-collapse: collapse; margin: 22px 0; font-size: 15px; }
.svc-article th, .svc-article td { border: 1px solid rgba(255,255,255,.12); padding: 10px 12px; text-align: left; }
.svc-article .modal-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 22px 0; }
.svc-article .modal-metric-card { padding: 16px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; text-align: center; }
.svc-article .modal-metric-val { display: block; color: var(--accent-gold); font-weight: 800; font-size: 22px; }
.svc-article-related { padding: 32px; margin-top: 44px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.svc-article-related h2, .svc-article-related p { flex-basis: 100%; margin: 0; }
.form-group select { width: 100%; padding: 26px 18px 10px 14px; font-size: 15px; font-family: var(--font-body); color: #fff; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; transition: all .3s ease; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23dca963' stroke-width='2' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 18px center; }
.form-group select:focus { border-color: var(--accent-gold); background-color: rgba(255,255,255,.07); }
.form-group select option { color: #0c1330; background: #fbf8f3; }
.form-group-select label { top: 8px; font-size: 11px; }
.career-note { margin: -8px 0 20px; padding: 12px 16px; border-radius: 12px; background: rgba(var(--accent-gold-rgb), .12); border: 1px solid rgba(var(--accent-gold-rgb), .35); color: #fff; font-size: 14px; line-height: 1.6; }
.career-note[hidden] { display: none; }
.career-note a { color: var(--accent-gold); font-weight: 700; }
'''


def update_css():
    css = read("style.css")
    if CSS_MARK in css:
        css = css[:css.index(CSS_MARK)].rstrip("\n") + "\n\n"
    else:
        css = css.rstrip("\n") + "\n\n"
    write("style.css", css + CSS_BLOCK)


# --------------------------------------------------------------------------
# 6) sitemap / robots
# --------------------------------------------------------------------------

def build_sitemap(posts):
    urls = [("/", "weekly", "1.00")]
    urls.append(("/hizmetler.html", "monthly", "0.90"))
    urls += [("/%s.html" % s["slug"], "monthly", "0.90") for s in SERVICES]
    urls += [("/yazilimlarimiz.html", "monthly", "0.80"), ("/ozel-yazilim.html", "monthly", "0.60"),
             ("/kurumsal.html", "monthly", "0.70"), ("/designs.html", "weekly", "0.80"),
             ("/blog.html", "weekly", "0.80")]
    urls += [("/blog/%s.html" % p["slug"], "monthly", "0.70") for p in posts]
    urls += [("/iletisim.html", "monthly", "0.80"), ("/takvim.html", "monthly", "0.50")]
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, cf, pr in urls:
        out.append("  <url>\n    <loc>%s%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n  </url>" % (SITE, u, LASTMOD, cf, pr))
    out.append("</urlset>\n")
    write("sitemap.xml", "\n".join(out))


def build_robots():
    write("robots.txt", "User-agent: *\nAllow: /\nAllow: /blog/\nAllow: /Logo/\nAllow: /style.css\nAllow: /app.js\nAllow: /designs.js\n\nSitemap: %s/sitemap.xml\n" % SITE)


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main():
    update_css()
    report = {}
    for name in EXISTING_PAGES:
        s = common_transform(name, read(name))
        if name == "index.html":
            s = transform_index(s)
        if name == "hizmetler.html":
            s = transform_hizmetler(s)
        if name == "kurumsal.html":
            s = transform_kurumsal(s)
        if name == "blog.html":
            s = transform_blog_page(s)
        if name in ("index.html", "iletisim.html"):
            s, n = swap_subject_field(s)
            report[name + " select"] = n
            s = ensure_honeypot(s)
        write(name, fix_headings(name, s))

    for sv in SERVICES:
        write(sv["slug"] + ".html", build_service_page(sv))
    write("kariyer.html", build_kariyer())

    posts = load_posts()
    for p in posts:
        write("blog/%s.html" % p["slug"], build_blog_post(p))
    build_sitemap(posts)
    build_robots()
    print("OK", report)
    for p in posts:
        print("blog/%s.html" % p["slug"])


if __name__ == "__main__":
    main()
