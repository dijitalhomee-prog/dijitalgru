# Dijital Gru QR Studio — SaaS Platformu

🚨 **KRİTİK GİT VE DEPLOYMENT MİMARİSİ UYARISI:**

> [!CAUTION]
> **DİKKAT: BU PROJE `dijitalhomee-prog/dijitalgru` DEPOSUNUN `qr-studio` DALINDA (BRANCH) ÇALIŞMAKTADIR!**
> 
> - **GitHub Deposu:** `https://github.com/dijitalhomee-prog/dijitalgru.git`
> - **Çalışma Dalı (Branch):** `qr-studio` ⚠️
> - **Canlı Yayın Adresi:** [https://qrdijitalgru.com/](https://qrdijitalgru.com/)
> - **Railway Servis Adı:** `dijitalgru-qr-web` (Yalnızca `qr-studio` dalını dinler)
> 
> 🛑 **KESİNLİKLE YAPILMAMASI GEREKEN HATA:**
> Bu klasörde çalışırken **ASLA `main` DALINA (BRANCH) GEÇMEYİN VE PUSH ETMEYİN!** (`git push origin main` yapmayınız!)
> `main` dalı Dijital Gru kurumsal web sitesine (`dijitalgru.com`) aittir. `main` dalına push yapmak `dijitalgru.com` ana sayfasının çökmesine neden olur.

---

## 📌 Proje Hakkında
**QR Studio**, Dijital Gru bünyesinde geliştirilen dinamik QR kod oluşturma, dijital kartvizit (vCard), dijital restoran menüsü ve detaylı taranma analitiği sunan SaaS platformudur.

---

## 🛠 Mimari ve Proje Yapısı

- `app.py` — Flask Ana Uygulama & API Endpoint'leri
- `auth.py` — Kullanıcı Kimlik Doğrulama & Oturum Yönetimi
- `qr_engine.py` — QR Kod Üretim ve Kişiselleştirme Motoru
- `payments.py` — Ödeme Sistemleri & Abonelik Entegrasyonları (iyzico)
- `cloud_storage.py` — Görsel ve Dosya Bulut Depolama
- `db.py` & `migrate_db.py` — Veritabanı Modelleri & Migrasyon Yönetimi
- `templates/` — Jinja2 HTML Şablonları (Dashboard, QR Oluşturucu, vCard Mikrosite)
- `static/` — CSS, JavaScript ve Statik Medya Dosyaları

---

## 🚀 Doğru Güncelleme ve Yayına Alma Adımları

QR Studio üzerinde bir değişiklik yaptıktan sonra canlıya (`qrdijitalgru.com`) almak için şu adımları izleyin:

```bash
# 1. Aktif dalın qr-studio olduğundan emin olun:
git branch
# Çıktıda * qr-studio görünmelidir.

# 2. Değişiklikleri commit edin:
git add .
git commit -m "feat: QR Studio yeni güncelleme"

# 3. YALNIZCA qr-studio dalına push edin:
git push origin qr-studio
```

Railway platformundaki `dijitalgru-qr-web` servisi `qr-studio` dalını otomatik algılayarak [qrdijitalgru.com](https://qrdijitalgru.com/) adresinde yayına alacaktır.

---

## 🧩 2026-11-17 — Genel Hata Düzeltmeleri (13 madde)

- **Statik türler** (telefon/SMS/metin/WiFi/web): QR görseli ham içeriği taşır (`tel:`, `SMSTO:`, `WIFI:`…); eski basılmış kayıtlar `/r/<kod>` üzerinde türe göre çözülür (`qr_service.resolve_target`).
- **Sosyal medya / WhatsApp**: ortak normalizasyon `qr_utils.py` (Python) ↔ `static/js/qr-utils.js` (JS) birebir aynı kuralları uygular; hem kayıtta hem `/r/` katmanında çalışır.
- **Doğrulama**: sunucu tarafı `qr_service.validate_content` (create + update); `javascript:`/`data:`/`vbscript:` reddedilir.
- **İndirme**: gerçek vektör EPS/SVG (`qr_engine.py`), kimlik doğrulamalı `/api/qr/<id>/download`.
- **Mikro sayfalar**: `/p/vcard/<short_code>`, `/p/menu/<short_code>`; eski sayısal adresler yönlenir. Şirket Kartı için `company_template.html`.
- **Paketler**: tek kaynak `plan_limits.py`; sunucu limit kontrolü; logo (Pro/Kurumsal) QR ortasına, hata düzeltme otomatik H.
- **Analitik**: panelde/CSV'de Europe/Istanbul, bot/HEAD sayılmaz, CSV'de IP maskeli.
- **Frontend**: `static/js/studio.js` (stüdyo), `panel.js` (panel), `qr-utils.js`.
- **Tek seferlik düzeltme**: `migrate_fix_records.py` (`--apply` önce yedek alır). Testler: `tests/test_qr_utils.py`, `tests/test_integration.py` (`QR_DB_PATH` ile geçici DB).

## 🎨 2026-11-17 — 2. Tur: Kalan Düzeltmeler + Genel Tasarım Geçişi

**Düzeltmeler**
- Stüdyo düzeni: ≥1024px solda form (1-2-3), sağda sticky (`top:24px`) önizleme + "QR Kodu Hesabıma Kaydet"; <1024px tek sütun, önizleme üstte, kaydet butonu alta sabit çubuk.
- `/api/admin/maintenance/*` (yedek/düzeltme) uçları silindi.
- Yönetici hesabı artık koda gömülü şifre kullanmaz. `ADMIN_EMAIL` + `ADMIN_PASSWORD` ortam değişkenleri **isteğe bağlıdır**: yoksa yeni yönetici oluşturulmaz (uyarı loglanır), mevcut hesap aynen çalışır.
- `/p/vcard/<sayı>`, `/p/menu/<sayı>`, `.vcf` sayısal adresleri 404 verir; `/r/` hedefindeki sayısal adresler açılışta `short_code` adresine taşınır (`migrate_db.fix_numeric_micro_targets`).
- Hedefi boş QR: ana sayfaya çevrilmez, "Bu QR kod henüz yapılandırılmamış" sayfası gösterilir. Eski otomatik onarımın ana sayfaya çevirdiği kayıtlar açılışta boşaltılır (`blank_homepage_targets`).
- Paket sayfası: gerçekte olmayan iddialar (aylık tarama limiti, özel alan adı, 7/24 VIP destek) kaldırıldı; limitler `plan_limits.py` ile aynı.
- Metin yanıtları gzip ile sıkıştırılır (Lighthouse mobil performans).

**Tasarım**
- CSS değişkenli ortak tasarım sistemi, SVG ikon seti (emoji yok), buton/alan varyantları, AA kontrast.
- Ana sayfa: hero, Nasıl çalışır, kullanım örnekleri, SSS.
- Stüdyo: adım şeridi, Dinamik/Statik açıklaması, kayıt sonrası başarı ekranı (kopyala, PNG/SVG/EPS indir), yükleme ilerleme çubukları.
- Panel: sade kartlar, "…" menüsü, arama + filtreler, limit çubuğu, boş durum, markalı onay penceresi (`confirmDialog`).
- Herkese açık mikro sayfalar: ortak `public_base.html` + `static/css/public.css` + `templates/_icons.html`; menüde sabit kategori sekmeleri; vCard'da "Rehbere Kaydet" birincil buton.
