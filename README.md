# Dijital Gru — Kurumsal Web Sitesi

🚨 **KRİTİK GİT DEPOSU VE DEPLOYMENT UYARISI:**

> [!CAUTION]
> **BU KLASÖR YALNIZCA DİJİTAL GRU ANA WEB SİTESİNE AİTTİR!**
> 
> - **Git Remote URL:** `https://github.com/dijitalhomee-prog/dijitalgru.git`
> - **Canlı Yayın Adresi:** [https://dijitalgru.com/](https://dijitalgru.com/)
> - **Railway Servis Adı:** `web` (Dijital Gru Ana Web Sitesi)
> 
> 🛑 **ÖNEMLİ:** Bu depodaki kodları QR Studio deposu olan `dijitalhomee-prog/dijitalgru-qr-web` ile karıştırmayınız. Her iki projenin remote URL adresleri birbirinden kesin sınırlar ile ayrılmıştır.

---

## 📌 Proje Hakkında
Bu proje Dijital Gru'nun kurumsal pazarlama, hizmet sunumu, portfolio, yazılım ürün tanıtımları (GuestList, QR Studio vb.) ve ajans web sitesidir (HTML5 / CSS3 / Vanilla JS).

---

## 📂 Sayfa Yapısı & Mimari
- `index.html` — Ana Sayfa (Hero, Hizmet Özeti, Referanslar, Yazılımlar)
- `yazilimlarimiz.html` — SaaS & Özel Yazılımlarımız (GuestList, QR Studio, Isla WhatsApp vb.)
- `hizmetler.html` — Dijital Hizmetlerimiz (SEO, Web Geliştirme, Sosyal Medya)
- `kurumsal.html` — Hakkımızda, Ekip & Vizyon
- `ozel-yazilim.html` — Özel Yazılım Çözümleri
- `blog.html` — Blog & Makaleler
- `takvim.html` — 2026 Dijital & Sosyal Medya Takvimi
- `Procfile` — Railway Static Server Başlatıcı (`web: python3 -m http.server $PORT`)

---

## 🚀 Yayına Alma (Deployment Workflow)

Değişiklik yapmadan önce Git remote adresini kontrol edin:

```bash
git remote -v
# Çıktının aşağıdaki gibi olduğundan emin olun:
# origin https://github.com/dijitalhomee-prog/dijitalgru.git (fetch)
# origin https://github.com/dijitalhomee-prog/dijitalgru.git (push)
```

Ana web sitesini güncellemek ve canlıya (`dijitalgru.com`) almak için:

```bash
git add .
git commit -m "feat: site güncellemesi"
git push origin main
```

Railway otomatik olarak `dijitalgru.com` adresinde güncelleyecektir.
