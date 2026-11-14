#!/usr/bin/env python3
"""Reklam sayfaları: restoran, otel ve mimarlık sayfalarını aynı şablondan üretir.
İdempotent: tekrar çalıştırılabilir. Çalıştırma: python3 tools/build_landing_pages.py
Sıra: Hero -> 3 özellik -> Portföy/örnek -> Süreç -> SSS -> Form (#teklif) -> Footer
"""
import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://dijitalgru.com"
LASTMOD = "2026-11-14"
LEAD_JS = "/lead-form.js?v=4"

RESTORAN = ROOT / "restoran-web-sitesi-tasarimi.html"
R_TITLE = "Restoran, Beach Club &amp; Gece Kulübü Web Sitesi Tasarımı | Dijital Gru İstanbul"
R_DESC = ("Restoran, kafe, beach club ve gece kulübü için rezervasyon odaklı, mobil uyumlu premium "
          "web sitesi tasarımı. İstanbul merkezli Dijital Gru.")

PRICE_STYLE = ("display:inline-flex;align-items:center;gap:10px;margin-top:18px;padding:10px 18px;"
               "border-radius:999px;background:rgba(220,169,99,.16);border:1px solid rgba(220,169,99,.5);"
               "color:#fff;font-weight:700;font-size:15px;")
FORM_SUB = "Birkaç soruyu yanıtlayın, kapsamınıza göre net bir teklif hazırlayalım."


def read(p):
    with open(p, encoding="utf-8", newline="") as f:
        s = f.read()
    return re.sub(r"\r+\n", "\n", s)


def write(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s.replace("\n", "\r\n"))


def form_block(sector, title, sub):
    return f'''            <div id="teklif" class="svc-form-wrap" style="margin-top: 40px; scroll-margin-top: 110px;">
                <div data-lead-form data-sector="{sector}" data-title="{title}" data-sub="{sub}"></div>
            </div>
'''


def add_lead_script(s):
    s = re.sub(r'<script src="/lead-form\.js\?v=\d+"></script>', f'<script src="{LEAD_JS}"></script>', s)
    if "/lead-form.js" in s:
        return s
    return re.sub(r'(\s*)(<script src="/?app\.js\?v=[^"]+"></script>)',
                  rf'\1<script src="{LEAD_JS}"></script>\1\2', s, count=1)


# --------------------------------------------------------------------------
# Sayfa içerikleri
# --------------------------------------------------------------------------

STEPS = [
    ("Keşif ve Konumlandırma", "{keşif}"),
    ("Tasarım Dili ve Prototip", "{tasarım}"),
    ("Geliştirme ve Entegrasyon", "{geliştirme}"),
    ("Yayın ve Görünürlük", "Alan adı, SEO ayarları ve Google işletme profili bağlantıları yapılır; yayın sonrası destek verilir."),
]

PROJECTS_RESTORAN = '''            <h2 class="svc-h2 svc-spaced">İlgili Projeler</h2>
            <div class="svc-project-grid">
                <a href="/designs.html" class="svc-project-card glass-card"><span class="svc-project-label">Yazılım &amp; Web Geliştirme</span><h3>Sinopia Mantı Web Sitesi</h3><p>Geleneksel lezzetleri dijital dünyaya taşıyan; minimalist tasarım dili, interaktif menü kurgusu ve yüksek performanslı mobil öncelikli altyapıya sahip kurumsal web sitesi.</p><span class="svc-hub-more">Projeyi İncele <i class="fa-solid fa-arrow-right"></i></span></a>
                <a href="/designs.html" class="svc-project-card glass-card"><span class="svc-project-label">Sosyal Medya Yönetimi</span><h3>Korto İstanbul</h3><p>İstanbul&#x27;daki çatı katı/teras konseptinin kreatif sosyal medya yönetimi ve Reels video çekimleri.</p><span class="svc-hub-more">Projeyi İncele <i class="fa-solid fa-arrow-right"></i></span></a>
                <a href="/designs.html" class="svc-project-card glass-card"><span class="svc-project-label">Sosyal Medya Yönetimi</span><h3>İsla Alaçatı</h3><p>Bohem ve egzotik lezzet duraklarından İsla Alaçatı için tasarlanan kurumsal kimlik, menü ve basılı grafik setleri.</p><span class="svc-hub-more">Projeyi İncele <i class="fa-solid fa-arrow-right"></i></span></a>
            </div>
            <!-- PROJE_GORSELI: Proje kartlarina gercek gorsel eklemek icin bu bolumu duzenleyin -->
'''

PAGES = [
    {
        "slug": "restoran-web-sitesi-tasarimi",
        "name": "Restoran Web Sitesi Tasarımı",
        "title": R_TITLE, "desc": R_DESC,
        "icon": "fa-utensils", "badge": "Hospitality Web Tasarımı",
        "sector": "Restoran",
        "h1": "Restoranınızın web sitesi, markanızın kalitesini yansıtıyor mu?",
        "sub": "Mekanınızın atmosferini ekrana taşıyan, misafiri rezervasyona yönlendiren premium web siteleri tasarlıyoruz.",
        "features": [
            ("fa-book-open", "Menü", "Kategorilere ayrılmış, hızlı açılan dijital menü. Fiyat ve ürün değişikliklerini teknik bilgi gerektirmeden güncelleyebileceğiniz bir yapı kurabiliriz."),
            ("fa-calendar-check", "Rezervasyon bağlantısı", "Kullandığınız rezervasyon yazılımına ya da WhatsApp'a tek dokunuşla yönlendiren net bir rezervasyon butonu."),
            ("fa-store", "Çoklu şube ve mobil", "Her şube için ayrı bilgi, harita ve iletişim alanı. Tasarım önce telefonda hızlı ve okunaklı olacak şekilde kurgulanır."),
        ],
        "portfolio": PROJECTS_RESTORAN,
        "keşif": "Mekanın konsepti, hedef misafir kitlesi ve rakipleri incelenir; sitenin hangi aksiyona hizmet edeceği netleşir.",
        "tasarım": "Marka renkleri, tipografi ve atmosfer fotoğraflarıyla sayfa akışı tasarlanır; prototip olarak onayınıza sunulur.",
        "geliştirme": "Hızlı, mobil uyumlu site kodlanır; menü, rezervasyon, harita ve sosyal medya bağlantıları eklenir.",
        "faq": [
            ("Restoran web sitesinin fiyatı neye göre değişir?", "Projeler 30.000 TL'den başlar. Sayfa sayısı, şube sayısı, dil sayısı, rezervasyon veya menü entegrasyonu ve içerik hazırlığı kapsamı belirler. Keşif görüşmesinden sonra net bir teklif paylaşırız."),
            ("Site ne kadar sürede hazırlanır?", "Kapsama göre değişir. Tek sayfalık tanıtım sitelerinde süre kısadır; çok sayfalı, menü ve rezervasyon entegrasyonlu sitelerde daha uzundur. Keşif görüşmesinden sonra net bir takvim paylaşırız."),
            ("Fotoğraf ve metin içeriği kimde olur?", "Mevcut fotoğraf ve metinlerinizi kullanırız. Eksik içerik için yönlendirme yapar, gerekirse içerik üretimini ayrıca planlarız."),
            ("Alan adı ve hosting nasıl işliyor?", "Mevcut alan adınız varsa onu kullanırız. Alan adı ve barındırma kurulumunu biz yapabiliriz; kayıtların hangi hesap adına açılacağını ve yıllık maliyetleri teklifte netleştiririz."),
            ("Revizyon hakkı var mı?", "Tasarım aşamasında onay ve düzeltme turları yapılır; kaç tur yapılacağı teklifte açıkça yazılır."),
            ("Sitede birden fazla dil olabilir mi?", "Evet. Türkçe'nin yanında İngilizce gibi ek diller eklenebilir; dil sayısı teklifin kapsamına dahil edilir."),
        ],
        "others": [("/qr-menu.html", "QR Menü"), ("/luks-marka-kimligi-tasarimi.html", "Lüks Marka Kimliği Tasarımı"), ("/kurumsal-web-sitesi-tasarimi.html", "Kurumsal Web Sitesi Tasarımı")],
        "form_title": "Mekanınız için teklif alın",
    },
    {
        "slug": "otel-web-sitesi-tasarimi",
        "name": "Otel Web Sitesi Tasarımı",
        "title": "Otel Web Sitesi Tasarımı | Butik Otel &amp; Konaklama | Dijital Gru İstanbul",
        "desc": ("Butik oteller için çok dilli, rezervasyon altyapısıyla uyumlu, hızlı ve mobil uyumlu "
                 "premium web sitesi tasarımı. İstanbul merkezli Dijital Gru."),
        "icon": "fa-hotel", "badge": "Otel Web Tasarımı",
        "sector": "Otel",
        "h1": "Butik oteliniz için deneyimi yansıtan bir web sitesi.",
        "sub": "Misafirin sizi doğrudan bulup doğrudan rezervasyon yaptığı, markanızın ruhunu yansıtan premium web siteleri tasarlıyoruz.",
        "features": [
            ("fa-language", "Çok dilli site", "Yabancı misafirler için Türkçe'nin yanında ek dillerde sayfa yapısı; dil seçimi her sayfada erişilebilir."),
            ("fa-key", "Rezervasyon altyapısı entegrasyonu", "Kullandığınız rezervasyon altyapısı entegrasyona izin veriyorsa siteye bağlarız; yoksa form ve WhatsApp tabanlı bir talep akışı kurarız."),
            ("fa-mobile-screen", "Mobil deneyim", "Oda, olanak ve çevre sayfaları telefonda hızlı açılır ve rahat gezilir."),
        ],
        "sample_img": "/web-ornekler/ornek-otel-b.webp",
        "sample_alt": "Otel web sitesi için örnek arayüz çizimi",
        "sample_h": "Örnek arayüz: otel ana sayfası",
        "sample_p": ("Aşağıdaki çizim, bir otel web sitesinin nasıl kurgulanabileceğini göstermek için hazırladığımız "
                     "örnek arayüzdür. Gerçek bir müşteri projesi değildir."),
        "keşif": "Otelin konsepti, hedef misafir kitlesi ve rakipleri incelenir; sitenin hangi aksiyona hizmet edeceği netleşir.",
        "tasarım": "Marka renkleri, tipografi ve fotoğraf yönü belirlenir; sayfa akışı prototip olarak sunulur.",
        "geliştirme": "Hızlı, mobil uyumlu site kodlanır; rezervasyon, harita ve sosyal medya bağlantıları kurulur.",
        "faq": [
            ("Otel web sitesinin fiyatı neye göre değişir?", "Projeler 30.000 TL'den başlar. Sayfa sayısı, dil sayısı, rezervasyon altyapısı entegrasyonu ve içerik hazırlığı kapsamı belirler. Keşif görüşmesinden sonra net bir teklif paylaşırız."),
            ("Site ne kadar sürede hazırlanır?", "Kapsama göre değişir. Sayfa sayısı, dil sayısı ve rezervasyon entegrasyonu süreyi belirler. Keşif görüşmesinden sonra net bir takvim paylaşırız."),
            ("Fotoğraf ve içerik bizden mi gelir?", "Mevcut fotoğraf ve metinlerinizi kullanırız. Eksik içerik için yönlendirme yapar, gerekirse içerik üretimini ayrıca planlarız."),
            ("Alan adı ve hosting nasıl işliyor?", "Mevcut alan adınız varsa onu kullanırız. Alan adı ve barındırma kurulumunu biz yapabiliriz; kayıtların hangi hesap adına açılacağını ve yıllık maliyetleri teklifte netleştiririz."),
            ("Revizyon hakkı var mı?", "Tasarım aşamasında onay ve düzeltme turları yapılır; kaç tur yapılacağı teklifte açıkça yazılır."),
            ("Çok dilli site yapabilir misiniz?", "Evet. Türkçe'nin yanında İngilizce gibi ek diller eklenebilir; dil sayısı teklifin kapsamına dahil edilir."),
        ],
        "others": [("/restoran-web-sitesi-tasarimi.html", "Restoran Web Sitesi"), ("/luks-marka-kimligi-tasarimi.html", "Lüks Marka Kimliği"), ("/kurumsal-web-sitesi-tasarimi.html", "Kurumsal Web Sitesi")],
        "form_title": "Otelinizin sitesi için teklif alın",
    },
    {
        "slug": "mimarlik-web-sitesi-tasarimi",
        "name": "Mimarlık Ofisi Web Sitesi Tasarımı",
        "title": "Mimarlık Ofisi Web Sitesi Tasarımı | Portfolyo Siteleri | Dijital Gru İstanbul",
        "desc": ("Mimarlık ve iç mimarlık stüdyoları için vaka çalışması ve proje filtrelemeli, hızlı, sade ve "
                 "mobil uyumlu portfolyo web sitesi tasarımı. İstanbul merkezli Dijital Gru."),
        "icon": "fa-compass-drafting", "badge": "Mimarlık Web Tasarımı",
        "sector": "Mimarlık",
        "h1": "Projeleriniz kadar güçlü bir dijital portföy.",
        "sub": "Projelerinizi mekânın kendisi kadar dikkatle sunan, sade ve güven veren portfolyo siteleri tasarlıyoruz.",
        "features": [
            ("fa-folder-open", "Vaka çalışmaları", "Her proje için problem, yaklaşım ve sonucu anlatan detay sayfası; görseller kaliteyi koruyarak hızlı açılır."),
            ("fa-filter", "Proje filtreleme", "Projeleri tür, konum ya da yıla göre filtrelenebilen sade bir grid yapısı."),
            ("fa-mobile-screen", "Mobil portföy", "Portföyünüz telefonda da büyük görsellerle, akıcı ve okunaklı şekilde gezilir."),
        ],
        "sample_img": "/web-ornekler/ornek-mimarlik-b.webp",
        "sample_alt": "Mimarlık ofisi web sitesi için örnek arayüz çizimi",
        "sample_h": "Örnek arayüz: mimarlık portfolyosu",
        "sample_p": ("Aşağıdaki çizim, bir mimarlık ofisi web sitesinin nasıl kurgulanabileceğini göstermek için hazırladığımız "
                     "örnek arayüzdür. Gerçek bir müşteri projesi değildir."),
        "keşif": "Ofisin yaklaşımı, öne çıkan proje türleri ve hedef müşteri kitlesi belirlenir; sitenin rolü netleşir.",
        "tasarım": "Tipografi, grid ve proje sunum biçimi tasarlanır; sayfa akışı prototip olarak sunulur.",
        "geliştirme": "Hızlı, mobil uyumlu portfolyo sitesi kodlanır; görseller performans için optimize edilir.",
        "faq": [
            ("Mimarlık sitesinin fiyatı neye göre değişir?", "Projeler 30.000 TL'den başlar. Proje sayısı, sayfa yapısı, dil sayısı ve içerik hazırlığı kapsamı belirler. Keşif görüşmesinden sonra net bir teklif paylaşırız."),
            ("Site ne kadar sürede hazırlanır?", "Proje sayısı, sayfa yapısı ve görsel hazırlığa göre değişir. Keşif görüşmesinden sonra net bir takvim paylaşırız."),
            ("Proje görsel ve metinleri kimden gelir?", "Mevcut proje fotoğraf ve metinlerinizi kullanırız. Eksik içerik için yönlendirme yapar, gerekirse içerik düzenlemesini ayrıca planlarız."),
            ("Alan adı ve hosting nasıl işliyor?", "Mevcut alan adınız varsa onu kullanırız. Alan adı ve barındırma kurulumunu biz yapabiliriz; kayıtların hangi hesap adına açılacağını ve yıllık maliyetleri teklifte netleştiririz."),
            ("Revizyon hakkı var mı?", "Tasarım aşamasında onay ve düzeltme turları yapılır; kaç tur yapılacağı teklifte açıkça yazılır."),
            ("Sitede birden fazla dil olabilir mi?", "Evet. Türkçe'nin yanında İngilizce gibi ek diller eklenebilir; dil sayısı teklifin kapsamına dahil edilir."),
        ],
        "others": [("/luks-marka-kimligi-tasarimi.html", "Lüks Marka Kimliği"), ("/kurumsal-web-sitesi-tasarimi.html", "Kurumsal Web Sitesi"), ("/otel-web-sitesi-tasarimi.html", "Otel Web Sitesi")],
        "form_title": "Ofisinizin sitesi için teklif alın",
    },
]


def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#x27;"))


def jsonld(obj):
    return ('    <script type="application/ld+json">\n    '
            + json.dumps(obj, ensure_ascii=False, indent=2).replace("\n", "\n    ")
            + "\n    </script>\n")


def body_html(pg):
    descs = {0: pg["keşif"], 1: pg["tasarım"], 2: pg["geliştirme"]}
    steps = ""
    for i, (t, d) in enumerate(STEPS):
        d = descs.get(i, d)
        steps += (f'                <div class="service-row-card"><div class="service-num">0{i+1}</div><div class="service-info">'
                  f'<h3 class="service-title">{t}</h3><p class="service-desc">{d}</p></div></div>\n')
    feats = "".join(
        f'                <div class="svc-project-card glass-card"><span class="svc-project-label"><i class="fa-solid {ic}"></i></span>'
        f'<h3>{t}</h3><p>{esc(d)}</p></div>\n' for ic, t, d in pg["features"])
    faq = "".join(
        f'                <details class="svc-faq-item"><summary>{q}</summary><p>{esc(a)}</p></details>\n' for q, a in pg["faq"])
    others = "".join(f'<a href="{h}" class="btn btn-secondary">{t}</a>' for h, t in pg["others"])
    form = form_block(pg["sector"], pg["form_title"], FORM_SUB)
    if pg.get("portfolio"):
        portfolio = pg["portfolio"]
    else:
        portfolio = f'''            <h2 class="svc-h2 svc-spaced">{pg["sample_h"]}</h2>
            <div class="svc-intro glass-card">
                <p>{pg["sample_p"]}</p>
                <figure style="position: relative; margin: 20px 0 0;">
                    <span style="position: absolute; top: 14px; left: 14px; z-index: 2; background: #dca963; color: #0c1330; font-weight: 800; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; padding: 7px 14px; border-radius: 999px;">Örnek arayüz</span>
                    <img src="{pg["sample_img"]}" width="1200" height="896" alt="{pg["sample_alt"]}" loading="lazy" decoding="async" style="width: 100%; height: auto; border-radius: 16px; display: block;">
                    <figcaption style="margin-top: 10px; font-size: 13px; opacity: .7;">Örnek arayüz çizimi. Gerçek bir müşteri projesi değildir.</figcaption>
                </figure>
            </div>
'''
    return f'''    <section class="page-banner section-padding" style="padding-top: 140px; padding-bottom: 40px;">
        <div class="container">
            <div class="badge-reveal scroll-reveal">
                <span class="hero-badge"><i class="fa-solid {pg["icon"]}"></i> {pg["badge"]}</span>
            </div>
            <h1 class="page-title" style="margin-top: 16px;">{pg["h1"]}</h1>
            <p class="svc-price" style="{PRICE_STYLE}"><i class="fa-solid fa-tag" style="color:#dca963;"></i> 30.000 TL'den başlayan projeler</p>
            <p class="page-subtitle">{pg["sub"]}</p>
            <div style="margin-top: 28px;"><a href="#teklif" class="btn btn-primary glow-btn" id="svc-hero-cta">Teklif Al</a></div>
        </div>
    </section>

    <section class="section-padding" style="padding-top: 20px;">
        <div class="container svc-section">
            <h2 class="svc-h2">Bu sektöre özel neler sunuyoruz?</h2>
            <div class="svc-project-grid">
{feats}            </div>

{portfolio}
            <h2 class="svc-h2 svc-spaced">Nasıl Çalışıyoruz?</h2>
            <div class="svc-steps">
{steps}            </div>

            <h2 class="svc-h2 svc-spaced">Sık Sorulan Sorular</h2>
            <div class="svc-faq">
{faq}            </div>

{form}
            <h2 class="svc-h3-label">Diğer Hizmetlerimiz</h2>
            <div class="svc-related">{others}</div>
        </div>
    </section>

'''


def build_page(pg, base):
    url = f"{SITE}/{pg['slug']}.html"
    s = base.replace(R_TITLE, pg["title"]).replace(R_DESC, pg["desc"])
    s = s.replace(f"{SITE}/restoran-web-sitesi-tasarimi.html", url)
    blocks = re.compile(r'    <script type="application/ld\+json">.*?</script>\n', re.S)
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in pg["faq"]]}
    svc_ld = {"@context": "https://schema.org", "@type": "Service", "name": pg["name"], "serviceType": pg["name"],
              "description": pg["desc"].replace("&amp;", "&"), "url": url,
              "provider": {"@type": "ProfessionalService", "name": "Dijital Gru", "url": SITE + "/"},
              "areaServed": [{"@type": "City", "name": "İstanbul"}, {"@type": "Country", "name": "Türkiye"}]}
    bc_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Dijital Gru", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Hizmetler", "item": SITE + "/hizmetler.html"},
        {"@type": "ListItem", "position": 3, "name": pg["name"], "item": url}]}
    new_ld = jsonld(faq_ld) + jsonld(svc_ld) + jsonld(bc_ld)
    first = [True]

    def repl(m):
        if first[0]:
            first[0] = False
            return new_ld
        return ""
    s = blocks.sub(repl, s)
    start = s.index('    <section class="page-banner')
    end = s.index("    <!-- Footer -->")
    s = s[:start] + body_html(pg) + "\n" + s[end:]
    return add_lead_script(s)


def build_pages():
    # Önce restoran (mevcut sayfa yerinde yeniden kurulur), diğerleri onun şablonundan türetilir.
    base = read(RESTORAN)
    write(RESTORAN, build_page(PAGES[0], base))
    base = read(RESTORAN)
    for pg in PAGES[1:]:
        write(ROOT / f"{pg['slug']}.html", build_page(pg, base))


# --------------------------------------------------------------------------
# Footer, hub, sitemap, site-config
# --------------------------------------------------------------------------

def add_footer_links():
    old = '<li><a href="/restoran-web-sitesi-tasarimi.html">Restoran Web Sitesi</a></li>'
    new = (old + '<li><a href="/otel-web-sitesi-tasarimi.html">Otel Web Sitesi</a></li>'
           '<li><a href="/mimarlik-web-sitesi-tasarimi.html">Mimarlık Web Sitesi</a></li>')
    n = 0
    for p in list(ROOT.glob("*.html")) + list(ROOT.glob("blog/*.html")):
        s = read(p)
        if old in s and "otel-web-sitesi-tasarimi.html\">Otel" not in s:
            write(p, s.replace(old, new))
            n += 1
    return n


def add_hub_cards():
    p = ROOT / "hizmetler.html"
    s = read(p)
    if "otel-web-sitesi-tasarimi" in s:
        return
    anchor = '                <a href="/luks-marka-kimligi-tasarimi.html" class="svc-hub-card'
    assert anchor in s
    def card(slug, icon, title, text, key):
        return (f'                <a href="/{slug}.html" class="svc-hub-card glass-card scroll-reveal"><span class="svc-hub-icon">'
                f'<i class="fa-solid {icon}"></i></span><h3>{title}</h3><p>{text}</p>'
                f'<span class="svc-hub-price" data-price="{key}"></span>'
                f'<span class="svc-hub-more">Detayları İncele <i class="fa-solid fa-arrow-right"></i></span></a>\n')
    cards = (card("otel-web-sitesi-tasarimi", "fa-hotel", "Otel Web Sitesi Tasarımı",
                  "Doğrudan rezervasyonu destekleyen, markanızın ruhunu yansıtan butik otel ve konaklama siteleri.", "otel-web")
             + card("mimarlik-web-sitesi-tasarimi", "fa-compass-drafting", "Mimarlık Ofisi Web Sitesi Tasarımı",
                    "Projelerinizi öne çıkaran, sade ve hızlı portfolyo siteleri.", "mimarlik-web"))
    write(p, s.replace(anchor, cards + anchor, 1))


def update_sitemap():
    p = ROOT / "sitemap.xml"
    s = read(p)
    for pg in PAGES:
        loc = f"{SITE}/{pg['slug']}.html"
        if loc in s:
            continue
        entry = (f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{LASTMOD}</lastmod>\n"
                 f"    <changefreq>monthly</changefreq>\n    <priority>0.90</priority>\n  </url>\n")
        s = s.replace("</urlset>", entry + "</urlset>")
    write(p, s)


def update_site_config():
    p = ROOT / "site-config.js"
    s = read(p)
    if "'restoran-web': '',".replace("'", "'") in s:
        s = s.replace("'restoran-web': '',", "'restoran-web': '₺30.000',")
    if "'otel-web'" not in s:
        s = s.replace("        'qr-menu': ''", "        'qr-menu': '',\n        'otel-web': '',\n        'mimarlik-web': ''")
    write(p, s)


if __name__ == "__main__":
    build_pages()
    print("footer güncellenen sayfa:", add_footer_links())
    add_hub_cards()
    update_sitemap()
    update_site_config()
    print("OK")
