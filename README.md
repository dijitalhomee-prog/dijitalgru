# Dijital Gru QR Studio — SaaS Platformu

🚨 **KRİTİK GİT DEPOSU VE DEPLOYMENT UYARISI:**

> [!CAUTION]
> **BU KLASÖR YALNIZCA QR STUDIO SAAS SİSTEMİNE AİTTİR!**
> 
> - **Git Remote URL:** `https://github.com/dijitalhomee-prog/dijitalgru-qr-web.git`
> - **Canlı Yayın Adresi:** [https://qrdijitalgru.com/](https://qrdijitalgru.com/)
> - **Railway Servis Adı:** `dijitalgru-qr-web`
> 
> 🛑 **ÖNEMLİ:** Bu depodaki kodları **ASLA** Dijital Gru ana web sitesi deposu olan `dijitalhomee-prog/dijitalgru` adresine **push etmeyiniz**! Yanlış push işlemi `dijitalgru.com` ana sayfasının üzerine QR Studio uygulamasını yazarak ana sitenin çökmesine yol açar.

---

## 📌 Proje Hakkında
**QR Studio**, Dijital Gru bünyesinde geliştirilen dinamik QR kod oluşturma, dijital kartvizit (vCard), dijital restoran menüsü ve detaylı taranma analitiği sunan SaaS platformudur.

---

## 🛠 Mimari ve Proje Yapısı

- `app.py` — Flask Ana Uygulama & API Endpoint'leri
- `auth.py` — Kullanıcı Kimlik Doğrulama & Oturum Yönetimi
- `qr_engine.py` — QR Kod Üretim ve Kişiselleştirme Motoru
- `payments.py` — Ödeme Sistemleri & Abonelik Entegrasyonları
- `cloud_storage.py` — Görsel ve Dosya Bulut Depolama (S3 / Cloudinary vb.)
- `db.py` & `migrate_db.py` — Veritabanı Modelleri & Migrasyon Yönetimi
- `templates/` — Jinja2 HTML Şablonları (Dashboard, QR Oluşturucu, Landing)
- `static/` — CSS, JavaScript ve Statik Medya Dosyaları

---

## 🚀 Yayına Alma (Deployment Workflow)

Değişiklik yapmadan önce Git remote adresini her zaman kontrol edin:

```bash
git remote -v
# Çıktının aşağıdaki gibi olduğundan emin olun:
# origin https://github.com/dijitalhomee-prog/dijitalgru-qr-web.git (fetch)
# origin https://github.com/dijitalhomee-prog/dijitalgru-qr-web.git (push)
```

QR Studio sistemini güncellemek ve canlıya (`qrdijitalgru.com`) almak için:

```bash
git add .
git commit -m "feat: QR studio yeni güncelleme"
git push origin main
```

Railway platformu `dijitalgru-qr-web` servisi üzerinden otomatik olarak derleyip `https://qrdijitalgru.com/` adresinde yayına alacaktır.
