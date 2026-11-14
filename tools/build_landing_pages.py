#!/usr/bin/env python3
"""Reklam sayfaları: otel + mimarlık sayfalarını üretir, restoran sayfasına fiyat satırı ve form ekler.
İdempotent: tekrar çalıştırılabilir. Çalıştırma: python3 tools/build_landing_pages.py
"""
import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://dijitalgru.com"
LASTMOD = "2026-11-14"

RESTORAN = ROOT / "restoran-web-sitesi-tasarimi.html"
R_TITLE = "Restoran, Beach Club &amp; Gece Kulübü Web Sitesi Tasarımı | Dijital Gru İstanbul"
R_DESC = ("Restoran, kafe, beach club ve gece kulübü için rezervasyon odaklı, mobil uyumlu premium "
          "web sitesi tasarımı. İstanbul merkezli Dijital Gru.")

PRICE_STYLE = ("display:inline-flex;align-items:center;gap:10px;margin-top:18px;padding:10px 18px;"
               "border-radius:999px;background:rgba(220,169,99,.16);border:1px solid rgba(220,169,99,.5);"
               "color:#fff;font-weight:700;font-size:15px;")


def read(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read().replace("\r\n", "\n")


def write(p, s):
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s.replace("\n", "\r\n"))


def form_block(sector, title, sub):
    return f'''            <div id="teklif-formu" class="svc-form-wrap" style="margin-top: 40px; scroll-margin-top: 110px;">
                <div data-lead-form data-sector="{sector}" data-title="{title}" data-sub="{sub}"></div>
            </div>
'''


# --------------------------------------------------------------------------
# Restoran sayfasını güncelle
# --------------------------------------------------------------------------

def update_restoran():
    s = read(RESTORAN)
    if "svc-price" not in s:
        sub_re = re.compile(r'(<p class="page-subtitle">[^<]*</p>\n)')
        price = (f'            <p class="svc-price" style="{PRICE_STYLE}"><i class="fa-solid fa-tag" '
                 f'style="color:#dca963;"></i> 30.000 TL\'den başlayan projeler</p>\n')
        s, n = sub_re.subn(lambda m: m.group(1) + price, s, count=1)
        assert n == 1, "alt başlık bulunamadı"
    s = s.replace('<a href="/iletisim.html" class="btn btn-primary glow-btn" id="svc-hero-cta">',
                  '<a href="#teklif-formu" class="btn btn-primary glow-btn" id="svc-hero-cta">')
    s = s.replace('<a href="/iletisim.html" class="btn btn-primary glow-btn" id="svc-bottom-cta">',
                  '<a href="#teklif-formu" class="btn btn-primary glow-btn" id="svc-bottom-cta">')
    if "data-lead-form" not in s:
        marker = '            <h2 class="svc-h2 svc-spaced">Nasıl Çalışıyoruz?</h2>'
        assert marker in s
        block = form_block("Restoran / Kafe", "Mekanınız için teklif alın",
                           "Birkaç soruyu yanıtlayın, kapsamınıza göre net bir teklif hazırlayalım.")
        s = s.replace(marker, block + "\n" + marker, 1)
    s = add_lead_script(s)
    write(RESTORAN, s)


def add_lead_script(s):
    if "/lead-form.js" in s:
        return s
    return re.sub(r'(\s*)(<script src="/?app\.js\?v=[^"]+"></script>)',
                  r'\1<script src="/lead-form.js?v=2"></script>\1\2', s, count=1)


# --------------------------------------------------------------------------
# Yeni sayfalar
# --------------------------------------------------------------------------

PAGES = [
    {
        "slug": "otel-web-sitesi-tasarimi",
        "name": "Otel Web Sitesi Tasarımı",
        "title": "Otel Web Sitesi Tasarımı | Butik Otel &amp; Konaklama | Dijital Gru İstanbul",
        "desc": ("Otel ve butik konaklama işletmeleri için doğrudan rezervasyon odaklı, hızlı ve mobil uyumlu "
                 "premium web sitesi tasarımı. İstanbul merkezli Dijital Gru."),
        "icon": "fa-hotel",
        "badge": "Otel Web Tasarımı",
        "sector": "Otel",
        "h1": "Otel ve Butik Konaklama İşletmeleri İçin Web Sitesi Tasarımı",
        "sub": ("Misafirin sizi doğrudan bulup doğrudan rezervasyon yaptığı, markanızın ruhunu yansıtan "
                "premium web siteleri tasarlıyoruz."),
        "h2": "Misafir odayı görmeden önce web sitenizi görür",
        "intro": [
            "Otel seçerken misafir önce fotoğraflara, sonra odalara ve en son fiyata bakar. Yavaş açılan, mobilde dağınık görünen ya da rezervasyon adımı belirsiz bir site, ne kadar güzel bir otel işletmeniz olursa olsun misafiri aracı platformlara yönlendirir.",
            "Otel ve butik konaklama için tasarladığımız sitelerde güçlü bir görsel anlatım, oda ve hizmet sayfaları, net bir rezervasyon yönlendirmesi ve Google'da yerel aramalarda görünürlük birlikte ele alınır. Mevcut rezervasyon yazılımınız varsa siteye entegre edebilir, yoksa form ve WhatsApp tabanlı bir akış kurabiliriz.",
        ],
        "points": ["Mobil öncelikli, hızlı açılan tasarım", "Oda, olanak ve çevre sayfaları",
                   "Rezervasyon yazılımı entegrasyonu veya WhatsApp akışı", "Yerel SEO ve Google Haritalar uyumu"],
        "steps": [
            ("Keşif ve Konumlandırma", "Otelin konsepti, hedef misafir kitlesi ve rakipleri incelenir; sitenin hangi aksiyona hizmet edeceği netleşir."),
            ("Tasarım Dili ve Prototip", "Marka renkleri, tipografi ve fotoğraf yönü belirlenir; sayfa akışı prototip olarak sunulur."),
            ("Geliştirme ve Entegrasyon", "Hızlı, mobil uyumlu site kodlanır; rezervasyon, harita ve sosyal medya bağlantıları kurulur."),
            ("Yayın ve Görünürlük", "Alan adı, SEO ayarları ve Google işletme profili bağlantıları yapılır; yayın sonrası destek verilir."),
        ],
        "sample_img": "/web-ornekler/ornek-otel-b.jpg",
        "sample_alt": "Otel web sitesi için örnek arayüz çizimi",
        "sample_h": "Örnek arayüz: otel ana sayfası",
        "sample_p": ("Aşağıdaki çizim, bir otel web sitesinin nasıl kurgulanabileceğini göstermek için hazırladığımız "
                     "örnek arayüzdür. Gerçek bir müşteri projesi değildir."),
        "faq": [
            ("Otel web sitesi ne kadar sürede hazırlanır?", "Kapsama göre değişir. Sayfa sayısı, rezervasyon entegrasyonu ve içerik hazırlığı süreyi belirler. Keşif görüşmesinden sonra net bir takvim paylaşılır."),
            ("Mevcut rezervasyon sistemimizi siteye bağlayabilir misiniz?", "Sistemin sunduğu entegrasyon seçeneklerine bağlı olarak evet. Mümkün değilse form ve WhatsApp tabanlı bir rezervasyon talep akışı kurabiliriz."),
            ("Fotoğraf ve içerik bizden mi gelir?", "Mevcut fotoğraf ve metinlerinizi kullanırız. Eksik içerik için yönlendirme yapar, ihtiyaç olursa içerik üretimi için ayrıca planlama yaparız."),
            ("Site yayına girdikten sonra güncelleme yapabilir miyiz?", "Evet. Duyuru, fiyat ve oda bilgileri gibi alanları teknik bilgi gerektirmeden güncelleyebileceğiniz bir yapı kurabiliriz."),
        ],
        "others": [("/restoran-web-sitesi-tasarimi.html", "Restoran Web Sitesi"), ("/luks-marka-kimligi-tasarimi.html", "Lüks Marka Kimliği"), ("/kurumsal-web-sitesi-tasarimi.html", "Kurumsal Web Sitesi")],
        "form_title": "Otelinizin sitesi için teklif alın",
    },
    {
        "slug": "mimarlik-web-sitesi-tasarimi",
        "name": "Mimarlık Ofisi Web Sitesi Tasarımı",
        "title": "Mimarlık Ofisi Web Sitesi Tasarımı | Portfolyo Siteleri | Dijital Gru İstanbul",
        "desc": ("Mimarlık ofisleri ve iç mimarlar için projelerinizi öne çıkaran, hızlı, sade ve mobil uyumlu "
                 "portfolyo web sitesi tasarımı. İstanbul merkezli Dijital Gru."),
        "icon": "fa-compass-drafting",
        "badge": "Mimarlık Web Tasarımı",
        "sector": "Mimarlık",
        "h1": "Mimarlık Ofisleri ve İç Mimarlar İçin Web Sitesi Tasarımı",
        "sub": ("Projelerinizi mekânın kendisi kadar dikkatle sunan, sade ve güven veren portfolyo siteleri "
                "tasarlıyoruz."),
        "h2": "İyi bir proje, iyi sunulduğunda müşteri getirir",
        "intro": [
            "Bir mimarlık ofisini araştıran kişi önce projelere bakar. Düşük çözünürlüklü görseller, dağınık proje sayfaları ve mobilde bozuk bir düzen, ofisin işine verdiği özeni yansıtmaz.",
            "Mimarlık ofisleri ve iç mimarlar için tasarladığımız sitelerde proje görselleri ön plana çıkar; sade bir grid, net proje sayfaları, ofis ve ekip bilgisi ile kolay iletişim bir arada kurgulanır. Hızlı açılış ve Google'da görünürlük tasarımın parçasıdır.",
        ],
        "points": ["Proje odaklı, görsel ağırlıklı portfolyo yapısı", "Hızlı açılan, yüksek kaliteli görsel gösterimi",
                   "Proje, ofis ve iletişim sayfaları", "Yerel SEO ve Google Haritalar uyumu"],
        "steps": [
            ("Keşif ve Konumlandırma", "Ofisin yaklaşımı, öne çıkan proje türleri ve hedef müşteri kitlesi belirlenir; sitenin rolü netleşir."),
            ("Tasarım Dili ve Prototip", "Tipografi, grid ve proje sunum biçimi tasarlanır; sayfa akışı prototip olarak sunulur."),
            ("Geliştirme ve Entegrasyon", "Hızlı, mobil uyumlu portfolyo sitesi kodlanır; görseller performans için optimize edilir."),
            ("Yayın ve Görünürlük", "Alan adı, SEO ayarları ve Google işletme profili bağlantıları yapılır; yayın sonrası destek verilir."),
        ],
        "sample_img": "/web-ornekler/ornek-mimarlik-b.jpg",
        "sample_alt": "Mimarlık ofisi web sitesi için örnek arayüz çizimi",
        "sample_h": "Örnek arayüz: mimarlık portfolyosu",
        "sample_p": ("Aşağıdaki çizim, bir mimarlık ofisi web sitesinin nasıl kurgulanabileceğini göstermek için hazırladığımız "
                     "örnek arayüzdür. Gerçek bir müşteri projesi değildir."),
        "faq": [
            ("Mimarlık sitesi ne kadar sürede hazırlanır?", "Proje sayısı, sayfa yapısı ve görsel hazırlığa göre değişir. Keşif görüşmesinden sonra net bir takvim paylaşılır."),
            ("Projelerimizi kendimiz ekleyip güncelleyebilir miyiz?", "Evet. Yeni proje eklemeyi teknik bilgi gerektirmeden yapabileceğiniz bir yapı kurabiliriz."),
            ("Proje fotoğrafları sitede nasıl gösterilir?", "Görseller kaliteyi koruyarak hızlı açılacak şekilde optimize edilir. Galeri ve proje detay düzeni birlikte tasarlanır."),
            ("İç mimarlık ofisleri için de çalışıyor musunuz?", "Evet. İç mimarlık, mimarlık ve uygulama ofislerinin ihtiyaçlarına göre sayfa yapısı kuruyoruz."),
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
    steps = "".join(
        f'                <div class="service-row-card"><div class="service-num">0{i+1}</div><div class="service-info">'
        f'<h3 class="service-title">{t}</h3><p class="service-desc">{d}</p></div></div>\n'
        for i, (t, d) in enumerate(pg["steps"]))
    points = "".join(f'                    <li><i class="fa-solid fa-check"></i> {p}</li>\n' for p in pg["points"])
    intro = "".join(f"                <p>{esc(p)}</p>\n" for p in pg["intro"])
    faq = "".join(
        f'                <details class="svc-faq-item"><summary>{q}</summary><p>{a}</p></details>\n'
        for q, a in pg["faq"])
    others = "".join(f'<a href="{h}" class="btn btn-secondary">{t}</a>' for h, t in pg["others"])
    form = form_block(pg["sector"], pg["form_title"],
                      "Birkaç soruyu yanıtlayın, kapsamınıza göre net bir teklif hazırlayalım.")
    return f'''    <section class="page-banner section-padding" style="padding-top: 140px; padding-bottom: 40px;">
        <div class="container">
            <div class="badge-reveal scroll-reveal">
                <span class="hero-badge"><i class="fa-solid {pg["icon"]}"></i> {pg["badge"]}</span>
            </div>
            <h1 class="page-title" style="margin-top: 16px;">{pg["h1"]}</h1>
            <p class="page-subtitle">{pg["sub"]}</p>
            <div style="margin-top: 28px;"><a href="#teklif-formu" class="btn btn-primary glow-btn" id="svc-hero-cta">Teklif Al</a></div>
        </div>
    </section>

    <section class="section-padding" style="padding-top: 20px;">
        <div class="container svc-section">
            <div class="svc-intro glass-card">
                <h2 class="svc-h2">{pg["h2"]}</h2>
{intro}                <ul class="svc-points">
{points}                </ul>
            </div>

{form}
            <h2 class="svc-h2 svc-spaced">Nasıl Çalışıyoruz?</h2>
            <div class="svc-steps">
{steps}            </div>

            <h2 class="svc-h2 svc-spaced">{pg["sample_h"]}</h2>
            <div class="svc-intro glass-card">
                <p>{pg["sample_p"]}</p>
                <figure style="position: relative; margin: 20px 0 0;">
                    <span style="position: absolute; top: 14px; left: 14px; z-index: 2; background: #dca963; color: #0c1330; font-weight: 800; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; padding: 7px 14px; border-radius: 999px;">Örnek arayüz</span>
                    <img src="{pg["sample_img"]}" width="1200" height="896" alt="{pg["sample_alt"]}" loading="lazy" style="width: 100%; height: auto; border-radius: 16px; display: block;">
                    <figcaption style="margin-top: 10px; font-size: 13px; opacity: .7;">Örnek arayüz çizimi. Gerçek bir müşteri projesi değildir.</figcaption>
                </figure>
            </div>

            <h2 class="svc-h2 svc-spaced">Sık Sorulan Sorular</h2>
            <div class="svc-faq">
{faq}            </div>

            <div class="svc-cta glass-card">
                <h2 class="svc-h2">Projenizi Konuşalım</h2>
                <p>İhtiyacınızı anlatın, size net bir kapsam ve teklif hazırlayalım.</p>
                <a href="#teklif-formu" class="btn btn-primary glow-btn" id="svc-bottom-cta"><i class="fa-solid fa-comments"></i> Teklif Al</a>
            </div>

            <h2 class="svc-h3-label">Diğer Hizmetlerimiz</h2>
            <div class="svc-related">{others}</div>
        </div>
    </section>

'''


def build_page(pg, base):
    url = f"{SITE}/{pg['slug']}.html"
    s = base.replace(R_TITLE, pg["title"]).replace(R_DESC, pg["desc"])
    s = s.replace(f"{SITE}/restoran-web-sitesi-tasarimi.html", url)
    # JSON-LD blokları: hepsini kaldırıp yenilerini ilk blok yerine koy
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
    # gövde: page-banner'dan Footer yorumuna kadar
    start = s.index('    <section class="page-banner')
    end = s.index("    <!-- Footer -->")
    s = s[:start] + body_html(pg) + "\n" + s[end:]
    return s


def build_new_pages():
    # Restoran güncellendikten sonra (footer vb. aynı) temel olarak onu kullan.
    base = read(RESTORAN)
    for pg in PAGES:
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
    if "'restoran-web': ''," in s:
        s = s.replace("'restoran-web': '',", "'restoran-web': '₺30.000',")
    if "'otel-web'" not in s:
        s = s.replace("        'qr-menu': ''", "        'qr-menu': '',\n        'otel-web': '',\n        'mimarlik-web': ''")
    write(p, s)


if __name__ == "__main__":
    update_restoran()
    build_new_pages()
    for pg in PAGES:
        f = ROOT / f"{pg['slug']}.html"
        write(f, add_lead_script(read(f)))
    print("footer güncellenen sayfa:", add_footer_links())
    add_hub_cards()
    update_sitemap()
    update_site_config()
    print("OK")
