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
