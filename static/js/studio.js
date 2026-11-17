/*!
 * QR Studio — Stüdyo katmanı (tür bazlı formlar, payload, doğrulama, canlı önizleme, sıfırlama, kayıt).
 * app.js'den SONRA yüklenir; aynı isimli global fonksiyonlar app.js'tekilerin yerini alır
 * (initTypeSelector, getQRFormPayload, renderLandingPageMockup, updateLivePreview, handlePrimarySocialInput ...).
 * Bağımlılık: qr-utils.js (escapeHtml, normalizeSocial, validateUrl, buildStaticContent ...).
 */

// ---------------------------------------------------------------------------
// Küçük yardımcılar
// ---------------------------------------------------------------------------
function byId(id) { return document.getElementById(id); }
function fVal(id) {
    const el = byId(id);
    return el && el.value != null ? String(el.value).trim() : "";
}
function fChecked(id) { const el = byId(id); return !!(el && el.checked); }
function setDisp(id, show, disp) {
    const el = byId(id);
    if (el) el.style.display = show ? (disp || "block") : "none";
}
// Yalnızca güvenli şemalar (img src / href için)
function safeAttrUrl(u) {
    u = String(u == null ? "" : u).trim();
    return /^(https?:\/\/|\/(?!\/)|data:image\/(png|jpe?g|webp|gif|svg\+xml);)/i.test(u) ? u : "";
}

// ---------------------------------------------------------------------------
// Alan hataları (.field-error)
// ---------------------------------------------------------------------------
function clearFieldError(el) {
    if (!el || !el.id) return;
    el.classList.remove("has-error");
    document.querySelectorAll('.field-error[data-for="' + el.id + '"]').forEach(n => n.remove());
}
function clearFieldErrors(root) {
    const r = root || document;
    r.querySelectorAll(".field-error").forEach(n => n.remove());
    r.querySelectorAll(".has-error").forEach(n => n.classList.remove("has-error"));
}
function showFieldError(id, msg) {
    const el = byId(id);
    if (!el) return false;
    el.classList.add("has-error");
    let box = document.querySelector('.field-error[data-for="' + id + '"]');
    if (!box) {
        box = document.createElement("div");
        box.className = "field-error";
        box.setAttribute("data-for", id);
        box.setAttribute("role", "alert");
        el.insertAdjacentElement("afterend", box);
    }
    box.textContent = msg;
    return true;
}
function focusFirstError() {
    const first = Array.from(document.querySelectorAll(".field-error")).find(n => n.offsetParent !== null);
    if (!first) return;
    const t = byId(first.getAttribute("data-for"));
    const target = t || first;
    try { target.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
    if (t && typeof t.focus === "function" && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        try { t.focus({ preventScroll: true }); } catch (_) {}
    }
}

// Sunucu field_errors anahtarı -> form alanı (türe göre)
function serverFieldToId(key, type) {
    const phoneMap = { phone: "phone-number", sms: "sms-phone", dynamic_whatsapp: "wa-phone", whatsapp: "wa-phone", company_card: "comp-phone", vcard: "vcard-phone" };
    switch (key) {
        case "target_url": return "target-url";
        case "phone": return phoneMap[type] || "phone-number";
        case "message": return (type === "sms") ? "sms-message" : "wa-msg";
        case "text": return "static-text";
        case "ssid": return "wifi-ssid";
        case "password": return "wifi-pass";
        case "full_name": return "vcard-name";
        case "company_name": return type === "company_card" ? "comp-name" : "vcard-company";
        case "pdf": return "pdf-upload-box";
        case "menu_items": return type === "menu" || type === "restaurant_menu" ? "menu-categories-list-container" : "pdf-upload-box";
        case "social": return SOCIAL_SINGLE_TYPES.includes(type) ? "vcard-primary-social-input" : "vcard-social-instagram";
        default: return null;
    }
}

// Sunucu 400 {error, field_errors} -> alanlarda göster. Gösterdiyse true döner.
function applyServerFieldErrors(data) {
    if (!data || !data.field_errors || typeof data.field_errors !== "object") return false;
    const entries = Object.entries(data.field_errors);
    if (!entries.length) return false;
    clearFieldErrors();
    const loose = [];
    entries.forEach(([k, msg]) => {
        const id = serverFieldToId(k, currentQrType);
        const el = id ? byId(id) : null;
        if (el && el.offsetParent !== null) showFieldError(id, String(msg));
        else loose.push(String(msg));
    });
    focusFirstError();
    uiToast("⚠️ " + (loose.length ? loose.join(" ") : (data.error || "Lütfen işaretli alanları düzeltin.")));
    return true;
}

// ---------------------------------------------------------------------------
// Tür -> form eşlemesi ve arayüz düzeni
// ---------------------------------------------------------------------------
function typeFormId(t) {
    if (MENU_TYPES.includes(t)) return "form-menu";
    if (t === "company_card") return "form-company";
    if (t === "vcard" || t === "social" || SOCIAL_SINGLE_TYPES.includes(t)) return "form-vcard";
    if (WA_TYPES.includes(t)) return "form-whatsapp";
    if (t === "url" || t === "static_url") return "form-url";
    if (t === "phone") return "form-phone";
    if (t === "sms") return "form-sms";
    if (t === "text") return "form-text";
    if (t === "wifi") return "form-wifi";
    return "form-url";
}

const SOCIAL_UI = {
    instagram: { title: "📸 Instagram Profil Ayarları", label: "Instagram Profil Linki veya Kullanıcı Adı", placeholder: "instagram.com/kullaniciadi veya @kullaniciadi", bg: "rgba(225, 48, 108, 0.12)", border: "rgba(225, 48, 108, 0.35)", color: "#f472b6" },
    facebook: { title: "📘 Facebook Sayfa & Profil Ayarları", label: "Facebook Sayfası veya Profil Linki", placeholder: "facebook.com/sayfaadi", bg: "rgba(24, 119, 242, 0.12)", border: "rgba(24, 119, 242, 0.35)", color: "#60a5fa" },
    linkedin: { title: "💼 LinkedIn Profil & Şirket Sayfası Ayarları", label: "LinkedIn Profil veya Şirket Sayfası Linki", placeholder: "linkedin.com/in/kullaniciadi veya linkedin.com/company/sirketadi", bg: "rgba(10, 102, 194, 0.12)", border: "rgba(10, 102, 194, 0.35)", color: "#38bdf8" },
    pinterest: { title: "📌 Pinterest Pano & Profil Ayarları", label: "Pinterest Pano veya Profil Linki", placeholder: "pinterest.com/kullaniciadi", bg: "rgba(230, 0, 35, 0.12)", border: "rgba(230, 0, 35, 0.35)", color: "#f87171" }
};

const MENU_UI = {
    restaurant_menu: {
        heading: "🍽️ Restoran Dijital Menü Ayarları", titleLabel: "Restoran / İşletme Adı",
        titlePh: "İşletme Adı (Örn: Güneş Restoran & Cafe)", descLabel: "Açıklama / Slogan",
        descPh: "Örn: Günlük taze lezzetler, eşsiz İtalyan mutfağı",
        acc: "Restoran & İletişim Bilgileri (İsteğe Bağlı)", builder: true, theme: true, pdf: false, direct: false
    },
    pdf_viewer: {
        heading: "📄 PDF Belge Görüntüleyici Ayarları", titleLabel: "Belge / Dosya Adı",
        titlePh: "Örn: 2026 Ürün Kullanım Kılavuzu & Garanti Belgesi.pdf", descLabel: "Belge Açıklaması / Sürüm Notu (İsteğe Bağlı)",
        descPh: "Örn: v2.4 Türkçe Kullanım Talimatları", pdfLabel: "PDF Belgenizi Yükleyin (Zorunlu / Gerekli)",
        pdfStatus: "Tıklayın ve PDF Belgenizi Seçin (.pdf)", pdfSub: "Kullanıcılar QR tarattığında PDF belgenizi doğrudan görüntüler",
        directTitle: "Doğrudan PDF Belgesini Aç (Önerilen)", directHint: "Aktifleştiğinde kullanıcılar doğrudan PDF belgesini görüntüler.",
        acc: "Belge Sahibi & İletişim Bilgileri (İsteğe Bağlı)", builder: false, theme: false, pdf: true, direct: true
    },
    menu: {
        heading: "📖 Online Katalog & Dijital Menü Ayarları", titleLabel: "İşletme / Katalog / Menü Adı",
        titlePh: "İşletme / Restoran Adı (Örn: Lezzet Cafe)", descLabel: "Menü / Katalog Açıklaması",
        descPh: "Kısa slogan veya bilgilendirme metni", pdfLabel: "PDF Menü / Katalog Dosyası Yükleyin (İsteğe Bağlı)",
        pdfStatus: "Tıklayın ve PDF Menü/Kataloğunuzu Seçin (.pdf)", pdfSub: "Müşterileriniz QR tarattığında hazırladığınız PDF menüyü/kataloğu görüntüler",
        directTitle: "Doğrudan PDF Yönlendirmesi", directHint: "Aktifleştiğinde kullanıcılar herhangi bir sayfa görmez, doğrudan PDF dosyasına yönlendirilir.",
        acc: "İşletme & İletişim Bilgileri (İsteğe Bağlı Kartvizit)", builder: true, theme: true, pdf: true, direct: true
    }
};
MENU_UI.pdf_catalog = MENU_UI.menu;

function setTxt(id, text) { const el = byId(id); if (el) el.innerText = text; }

function toggleWifiPass() {
    const enc = byId("wifi-enc");
    setDisp("wifi-pass-group", !(enc && enc.value === "nopass"));
}

// Seçili türe göre formları / alt bölümleri göster-gizle
function applyTypeUI() {
    const t = currentQrType;
    clearFieldErrors();
    document.querySelectorAll(".type-form").forEach(f => { f.style.display = "none"; });
    const mainForm = byId(typeFormId(t));
    if (mainForm) mainForm.style.display = "block";

    // URL formu: dinamik / statik metinleri
    if (t === "url" || t === "static_url") {
        setTxt("url-form-label", t === "static_url" ? "Web Adresi (Statik QR — doğrudan koda yazılır)" : "Hedef Web Adresi (URL)");
        setTxt("url-form-hint", t === "static_url"
            ? "Adres doğrudan QR koduna yazılır; sunucudan geçmez, takip edilemez, süresi dolmaz."
            : "http:// veya https:// ile başlayan geçerli bir web adresi girin.");
    }

    // vCard / Sosyal / Şirket ortak form bölümü (form-vcard)
    const isVcard = t === "vcard";
    const isSocial = t === "social";
    const isSingleSocial = SOCIAL_SINGLE_TYPES.includes(t);
    const isCompany = t === "company_card";
    if (isCompany && byId("form-vcard")) byId("form-vcard").style.display = "block"; // yalnızca sosyal + tema bölümleri

    if (mainForm && (mainForm.id === "form-vcard" || isCompany)) {
        const box = byId("vcard-primary-social-box");
        setDisp("vcard-extra-details-container", isVcard);
        setDisp("vcard-avatar-group", isVcard);
        setDisp("direct-vcard-group", isVcard);
        setDisp("vcard-theme-accordion-item", isVcard || isCompany);
        setDisp("vcard-social-accordion-item", isVcard || isSocial || isCompany);
        setDisp("vcard-form-heading", !isCompany);
        if (box) box.style.display = isSingleSocial ? "block" : "none";
        if (isSocial) {
            const acc = byId("vcard-social-accordion-item");
            if (acc) {
                acc.classList.add("open");
                const arrow = acc.querySelector(".studio-accordion-arrow");
                if (arrow) arrow.innerText = "▲";
            }
        }
        if (isSingleSocial) {
            const cfg = SOCIAL_UI[t];
            setTxt("vcard-form-heading", cfg.title);
            if (box) { box.style.background = cfg.bg; box.style.borderColor = cfg.border; }
            const lab = byId("vcard-primary-social-label");
            if (lab) { lab.innerText = cfg.label; lab.style.color = cfg.color; }
            const inp = byId("vcard-primary-social-input");
            if (inp) { inp.placeholder = cfg.placeholder; inp.style.borderColor = cfg.border; }
            setTxt("vcard-primary-social-hint", "@kullaniciadi veya profil bağlantısı yazabilirsiniz; QR doğrudan bu profile yönlenir.");
        } else if (isSocial) {
            setTxt("vcard-form-heading", "🌐 Sosyal Medya Bağlantıları");
        } else if (isVcard) {
            setTxt("vcard-form-heading", "Dijital Kartvizit Bilgileri");
        }
    }

    // Menü / PDF
    if (MENU_UI[t]) {
        const u = MENU_UI[t];
        setTxt("menu-form-heading", u.heading);
        setTxt("menu-title-label", u.titleLabel);
        setTxt("menu-desc-label", u.descLabel);
        const ti = byId("menu-title"); if (ti) ti.placeholder = u.titlePh;
        const di = byId("menu-desc"); if (di) di.placeholder = u.descPh;
        setTxt("menu-accordion-header-text", u.acc);
        setDisp("menu-builder-section", u.builder);
        setDisp("menu-theme-section", u.theme);
        setDisp("menu-pdf-group", u.pdf);
        setDisp("direct-pdf-group", u.direct);
        if (u.pdf) {
            setTxt("menu-pdf-upload-label", u.pdfLabel);
            if (!uploadedPdfUrl) setTxt("pdf-status-text", u.pdfStatus);
            setTxt("pdf-status-subtext", u.pdfSub);
            setTxt("direct-pdf-label-title", u.directTitle);
            setTxt("direct-pdf-label-hint", u.directHint);
        }
        if (u.builder && typeof renderMenuBuilderUI === "function") renderMenuBuilderUI();
    }

    if (t === "wifi") toggleWifiPass();
    if (isCompany) renderCompanyContacts();

    const rich = ["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook", "menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"];
    switchPreviewMode(rich.includes(t) ? "landing" : "qr");
}

// Tür seçilince forma yumuşak kaydır (mobilde de çalışır)
function scrollToStudioForm() {
    const target = document.querySelector(".studio-grid") || byId(typeFormId(currentQrType));
    if (!target || !target.scrollIntoView) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function initTypeSelector() {
    document.querySelectorAll(".type-btn").forEach(btn => {
        if (btn._typeInit) return;
        btn._typeInit = true;
        btn.setAttribute("role", "button");
        if (!btn.hasAttribute("tabindex")) btn.setAttribute("tabindex", "0");
        btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");
        const choose = () => {
            const newType = btn.getAttribute("data-type");
            const changed = newType !== currentQrType;
            if (changed) resetStudioForm({ keepBasics: true });
            document.querySelectorAll(".type-btn").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); });
            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");
            currentQrType = newType;
            applyTypeUI();
            updateLivePreview();
            setTimeout(scrollToStudioForm, 80);
        };
        btn.addEventListener("click", choose);
        btn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
        });
    });
}

// Tek alanlı sosyal türlerde canlı önizleme (normalize blur'da yapılır)
function handlePrimarySocialInput(inputEl) {
    if (inputEl) clearFieldError(inputEl);
    updateLivePreview();
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------
function readSocialLinks(platforms) {
    const out = {};
    platforms.forEach(p => { out[p] = normalizeSocial(p, fVal("vcard-social-" + p)) || ""; });
    return out;
}

function readCompanyContacts() {
    return companyContacts
        .map(c => ({ name: (c.name || "").trim(), title: (c.title || "").trim(), phone: (c.phone || "").trim(), email: (c.email || "").trim() }))
        .filter(c => c.name || c.phone || c.email);
}

function collectMenuCategories() {
    const out = [];
    (menuCategoriesData || []).forEach(cat => {
        const items = (cat.items || [])
            .filter(it => it && String(it.name || "").trim())
            .map(it => ({
                name: String(it.name).trim(),
                price: String(it.price || "").trim(),
                description: String(it.description || it.desc || "").trim(),
                image_url: String(it.image_url || "").trim()
            }));
        if (items.length) out.push({ name: String(cat.name || "").trim() || "Diğer", items });
    });
    return out;
}

function canUseQrLogo() {
    return !!(currentUser && (currentUser.is_admin || ["advanced", "business"].includes(currentUser.plan)));
}

function getQRFormPayload() {
    const t = currentQrType;
    const settings = {
        fill_color: getVal("fill-color", "#4F46E5"),
        back_color: getVal("back-color", "#FFFFFF"),
        frame_style: getVal("frame-style", "card"),
        frame_text: getVal("frame-text", "Beni Tara!"),
        frame_color: getVal("frame-color", "#4F46E5"),
        frame_text_color: getVal("frame-text-color", "#FFFFFF")
    };
    const logo = fVal("qr-logo-url");
    if (logo && canUseQrLogo()) settings.logo_url = logo;

    const p = {
        title: fVal("qr-title") || "Benim QR Kodum",
        type: t,
        folder_name: getSelectedFolderName(),
        settings
    };

    if (t === "url" || t === "static_url") {
        p.target_url = fVal("target-url");
    } else if (t === "phone") {
        p.static_payload = { phone: fVal("phone-number") };
    } else if (t === "sms") {
        p.static_payload = { phone: fVal("sms-phone"), message: fVal("sms-message") };
    } else if (t === "text") {
        p.static_payload = { text: fVal("static-text") };
    } else if (t === "wifi") {
        const enc = fVal("wifi-enc") || "WPA";
        p.static_payload = {
            ssid: fVal("wifi-ssid"),
            password: enc === "nopass" ? "" : (byId("wifi-pass") ? byId("wifi-pass").value : ""),
            encryption: enc,
            hidden: fChecked("wifi-hidden")
        };
    } else if (WA_TYPES.includes(t)) {
        p.wa_payload = { phone: fVal("wa-phone"), message: fVal("wa-msg") };
    } else if (t === "vcard") {
        p.vcard_payload = {
            full_name: fVal("vcard-name"),
            title: fVal("vcard-title"),
            company: fVal("vcard-company"),
            phone: fVal("vcard-phone"),
            phone2: fVal("vcard-phone2"),
            email: fVal("vcard-email"),
            website: fVal("vcard-website"),
            address: fVal("vcard-address"),
            bio: fVal("vcard-bio"),
            avatar_url: fVal("vcard-avatar-url"),
            card_image_url: fVal("vcard-card-image-url"),
            social_links: readSocialLinks(SOCIAL_PLATFORMS),
            theme_settings: getVCardThemeSettings(),
            direct_redirect: fChecked("direct-vcard-redirect")
        };
    } else if (t === "company_card") {
        const contacts = readCompanyContacts();
        const compName = fVal("comp-name");
        const logoUrl = fVal("comp-logo-url");
        p.vcard_payload = {
            company: compName,
            full_name: (contacts[0] && contacts[0].name) || compName,
            phone: fVal("comp-phone"),
            phone2: fVal("comp-phone2"),
            email: fVal("comp-email"),
            website: fVal("comp-website"),
            address: fVal("comp-address"),
            bio: fVal("comp-bio"),
            avatar_url: logoUrl,
            social_links: readSocialLinks(SOCIAL_PLATFORMS),
            theme_settings: getVCardThemeSettings(),
            company_info: {
                name: compName,
                logo_url: logoUrl,
                sector: fVal("comp-sector"),
                tax_office: fVal("comp-tax-office"),
                tax_no: fVal("comp-tax-no"),
                working_hours: byId("comp-hours") ? byId("comp-hours").value.trim() : "",
                maps_url: fVal("comp-maps"),
                contacts
            }
        };
    } else if (SOCIAL_SINGLE_TYPES.includes(t)) {
        p.vcard_payload = { social_links: { [t]: normalizeSocial(t, fVal("vcard-primary-social-input")) } };
    } else if (t === "social") {
        p.vcard_payload = { social_links: readSocialLinks(SOCIAL_PLATFORMS) };
    } else if (MENU_TYPES.includes(t)) {
        const ui = MENU_UI[t];
        const isRestaurant = t === "restaurant_menu";
        p.menu_payload = {
            title: fVal("menu-title"),
            description: fVal("menu-desc"),
            pdf_url: isRestaurant ? "" : (uploadedPdfUrl || ""),
            direct_redirect: isRestaurant ? false : fChecked("direct-pdf-redirect"),
            contact_name: fVal("menu-contact-name"),
            contact_title: fVal("menu-contact-title"),
            phone: fVal("menu-phone"),
            phone2: fVal("menu-phone2"),
            email: fVal("menu-email"),
            website: fVal("menu-website"),
            address: fVal("menu-address"),
            card_image_url: fVal("menu-card-image-url"),
            categories: ui.builder ? collectMenuCategories() : [],
            theme_settings: {
                primary_color: getVal("menu-theme-primary", "#818cf8"),
                bg_gradient: getVal("menu-theme-bg-preset", "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)"),
                card_bg: "rgba(30, 41, 59, 0.7)",
                text_color: "#f8fafc"
            }
        };
    }
    return p;
}

// ---------------------------------------------------------------------------
// İstemci doğrulaması (kaydet)
// ---------------------------------------------------------------------------
function socialErrorText(p) {
    return "Geçerli bir " + (SOCIAL_LABELS[p] || p) + " profil bağlantısı veya kullanıcı adı girin.";
}

function validateStudioForm() {
    const t = currentQrType;
    const errs = [];
    const add = (id, msg) => errs.push({ id, msg });

    if (t === "url" || t === "static_url") {
        const r = validateUrl(fVal("target-url"));
        if (!r.ok) add("target-url", r.error);
    } else if (t === "vcard") {
        if (!fVal("vcard-name")) add("vcard-name", "Lütfen ad soyad girin.");
        SOCIAL_PLATFORMS.forEach(p => {
            const raw = fVal("vcard-social-" + p);
            if (raw && !normalizeSocial(p, raw)) add("vcard-social-" + p, socialErrorText(p));
        });
    } else if (t === "company_card") {
        if (!fVal("comp-name")) add("comp-name", "Lütfen şirket adını girin.");
        const maps = fVal("comp-maps");
        if (maps) { const r = validateUrl(maps); if (!r.ok) add("comp-maps", r.error); }
        SOCIAL_PLATFORMS.forEach(p => {
            const raw = fVal("vcard-social-" + p);
            if (raw && !normalizeSocial(p, raw)) add("vcard-social-" + p, socialErrorText(p));
        });
    } else if (WA_TYPES.includes(t)) {
        const raw = fVal("wa-phone");
        if (!raw) add("wa-phone", "Lütfen WhatsApp numarasını girin.");
        else if (!isValidWaNumber(normalizePhoneForWa(raw))) add("wa-phone", "Geçerli bir WhatsApp numarası girin (örn: +90 537 627 44 15).");
    } else if (t === "phone") {
        const raw = fVal("phone-number");
        if (!raw) add("phone-number", "Lütfen telefon numarasını girin.");
        else if (!isValidPhone(raw)) add("phone-number", "Geçerli bir telefon numarası girin (örn: +90 537 627 44 15).");
    } else if (t === "sms") {
        const raw = fVal("sms-phone");
        if (!raw) add("sms-phone", "Lütfen telefon numarasını girin.");
        else if (!isValidPhone(raw)) add("sms-phone", "Geçerli bir telefon numarası girin (örn: +90 537 627 44 15).");
    } else if (t === "text") {
        if (!fVal("static-text")) add("static-text", "Metin boş olamaz.");
    } else if (t === "wifi") {
        if (!fVal("wifi-ssid")) add("wifi-ssid", "Lütfen Wi-Fi ağ adını (SSID) girin.");
        const enc = fVal("wifi-enc") || "WPA";
        const pass = byId("wifi-pass") ? byId("wifi-pass").value : "";
        if (enc !== "nopass") {
            if (!pass) add("wifi-pass", "Şifre boş olamaz. Şifresiz ağ için 'Şifresiz' seçin.");
            else if (enc === "WPA" && pass.length < 8) add("wifi-pass", "WPA/WPA2 şifresi en az 8 karakter olmalıdır.");
        }
    } else if (t === "pdf_viewer" || t === "pdf_catalog") {
        if (!uploadedPdfUrl) add("pdf-upload-box", "Lütfen bir PDF dosyası yükleyin.");
    } else if (t === "menu") {
        if (!uploadedPdfUrl && !collectMenuCategories().length) {
            add("pdf-upload-box", "Bir PDF yükleyin veya menü oluşturucudan en az bir ürün ekleyin.");
        }
    } else if (t === "restaurant_menu") {
        if (!collectMenuCategories().length) add("menu-categories-list-container", "Lütfen en az bir ürün ekleyin (ürün adı dolu olmalı).");
    } else if (SOCIAL_SINGLE_TYPES.includes(t)) {
        const raw = fVal("vcard-primary-social-input");
        if (!raw) add("vcard-primary-social-input", "Lütfen " + (SOCIAL_LABELS[t] || t) + " profil bağlantınızı veya kullanıcı adınızı girin.");
        else if (!normalizeSocial(t, raw)) add("vcard-primary-social-input", socialErrorText(t));
    } else if (t === "social") {
        let any = false;
        SOCIAL_PLATFORMS.forEach(p => {
            const raw = fVal("vcard-social-" + p);
            if (!raw) return;
            if (normalizeSocial(p, raw)) any = true;
            else add("vcard-social-" + p, socialErrorText(p));
        });
        if (!any && !errs.length) add("vcard-social-instagram", "En az bir sosyal medya hesabı girin.");
    }
    return { ok: errs.length === 0, errors: errs };
}

// ---------------------------------------------------------------------------
// Landing (telefon simülatörü) mockup
// ---------------------------------------------------------------------------
const MK_ROW = "display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;";
function mkRow(icon, label, value, tint) {
    return `<div style="${MK_ROW}"><div style="font-size:14px;width:28px;height:28px;background:${tint};border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon}</div>` +
        `<div style="flex:1;overflow:hidden;"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">${escapeHtml(label)}</div>` +
        `<div style="font-size:12px;font-weight:600;color:#f1f5f9;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${escapeHtml(value)}</div></div></div>`;
}
function mkAction(icon, label, bg, border, color) {
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:10px 4px;background:${bg};border:1px solid ${border};border-radius:12px;color:${color};font-size:10px;font-weight:700;"><span style="font-size:16px;">${icon}</span><span>${label}</span></div>`;
}
function mkHeroIcon(icon, grad, shadow, round) {
    return `<div style="width:64px;height:64px;background:${grad};border-radius:${round ? "50%" : "18px"};display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;margin:0 auto 12px auto;box-shadow:0 4px 20px ${shadow};">${icon}</div>`;
}
function mkCenter(inner) {
    return `<div style="text-align:center;padding-top:14px;">${inner}</div>`;
}
const SOCIAL_ICONS = { instagram: "📸", facebook: "📘", linkedin: "💼", pinterest: "📌", twitter: "𝕏", tiktok: "🎵", youtube: "▶️" };

// Eski genel mockup: vCard/menü dışındaki türler için kullanılır (yeni sürüm aşağıda).
function _legacyLandingMockup() {
    const container = byId("mockup-landing-content");
    if (!container) return;
    const payload = getQRFormPayload();
    const t = payload.type;

    const start = `<div style="width:100%;min-height:100%;box-sizing:border-box;background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);color:#fff;padding:24px 16px 20px 16px;display:flex;flex-direction:column;justify-content:space-between;border-radius:26px;"><div style="width:100%;">`;
    const end = `</div><div style="text-align:center;margin-top:auto;padding-top:20px;font-size:11px;color:#64748b;font-weight:500;">Powered by <strong style="color:#818cf8;">Dijitalgru QR Studio</strong></div></div>`;
    let body = "";

    if (t === "vcard") {
        const v = payload.vcard_payload;
        const fullName = v.full_name || "Ad Soyad";
        const initial = escapeHtml((fullName.trim()[0] || "A").toUpperCase());
        const av = safeAttrUrl(v.avatar_url);
        const circle = "width:76px;height:76px;border-radius:50%;";
        const avatar = av
            ? `<div style="${circle}margin:0 auto 12px auto;"><img src="${escapeHtml(av)}" alt="" style="${circle}object-fit:cover;box-shadow:0 0 25px rgba(99,102,241,0.5);border:2px solid #6366f1;display:block;"></div>`
            : `<div style="${circle}background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#fff;margin:0 auto 12px auto;box-shadow:0 0 25px rgba(99,102,241,0.5);border:2px solid rgba(255,255,255,0.2);">${initial}</div>`;
        let actions = "";
        if (v.phone) actions += mkAction("📞", "Arama", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.1)", "#fff") + mkAction("💬", "WhatsApp", "rgba(16,185,129,0.15)", "rgba(16,185,129,0.3)", "#34d399");
        if (v.email) actions += mkAction("✉️", "E-posta", "rgba(99,102,241,0.15)", "rgba(99,102,241,0.3)", "#a5b4fc");
        if (v.website) actions += mkAction("🌐", "Web Site", "rgba(6,182,212,0.15)", "rgba(6,182,212,0.3)", "#06b6d4");
        let rows = "";
        if (v.phone) rows += mkRow("📱", "Cep Telefonu", v.phone, "rgba(99,102,241,0.15)");
        if (v.phone2) rows += mkRow("🏢", "İş Telefonu", v.phone2, "rgba(59,130,246,0.15)");
        if (v.email) rows += mkRow("✉️", "E-posta Adresi", v.email, "rgba(236,72,153,0.15)");
        if (v.website) rows += mkRow("🌐", "Web Sitesi", v.website, "rgba(6,182,212,0.15)");
        if (v.address) rows += mkRow("📍", "Adres / Şehir", v.address, "rgba(245,158,11,0.15)");
        const socials = Object.entries(v.social_links || {}).filter(([, u]) => u).map(([p, u]) => mkRow(SOCIAL_ICONS[p] || "🔗", SOCIAL_LABELS[p] || p, u, "rgba(244,114,182,0.15)")).join("");
        body = `${avatar}
            <div style="font-size:18px;font-weight:800;color:#fff;text-align:center;">${escapeHtml(fullName)}</div>
            <div style="font-size:12px;color:#818cf8;margin-top:2px;font-weight:600;text-align:center;">${escapeHtml(v.title || "Unvan")}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;font-weight:500;text-align:center;">${escapeHtml(v.company || "Şirket Adı")}</div>
            ${v.bio ? `<div style="font-size:11px;color:#cbd5e1;margin-top:10px;line-height:1.4;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);text-align:left;">📝 ${escapeHtml(v.bio)}</div>` : ""}
            <button type="button" onclick="downloadSimulatorVcard()" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:14px;font-size:13px;font-weight:800;color:#fff;border:none;background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 15px rgba(16,185,129,0.3);margin:16px 0 12px 0;cursor:pointer;">👤 Rehbere Kaydet (.vcf)</button>
            ${actions ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:16px;">${actions}</div>` : ""}
            ${rows || socials ? `<div style="display:flex;flex-direction:column;gap:8px;text-align:left;">${rows}${socials}</div>` : ""}
            ${v.direct_redirect ? '<div style="font-size:10px;color:#f59e0b;margin-top:12px;font-weight:700;background:rgba(245,158,11,0.1);padding:6px;border-radius:8px;text-align:center;">⚡ Doğrudan .vcf İndirme Aktif</div>' : ""}`;
    } else if (t === "company_card") {
        const v = payload.vcard_payload;
        const ci = v.company_info;
        const logo = safeAttrUrl(ci.logo_url);
        const heroLogo = logo
            ? `<div style="width:84px;height:84px;margin:0 auto 12px auto;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(59,130,246,0.4);"><img src="${escapeHtml(logo)}" alt="" style="max-width:72px;max-height:72px;object-fit:contain;"></div>`
            : mkHeroIcon("🏢", "linear-gradient(135deg,#3b82f6,#1d4ed8)", "rgba(59,130,246,0.4)", false);
        const contactCards = ci.contacts.map(c => `<div style="${MK_ROW}flex-direction:column;align-items:flex-start;gap:2px;">
                <div style="font-size:12px;font-weight:700;color:#fff;">👤 ${escapeHtml(c.name || "Yetkili")}</div>
                ${c.title ? `<div style="font-size:10px;color:#818cf8;font-weight:600;">${escapeHtml(c.title)}</div>` : ""}
                ${c.phone ? `<div style="font-size:11px;color:#cbd5e1;">📞 ${escapeHtml(c.phone)}</div>` : ""}
                ${c.email ? `<div style="font-size:11px;color:#cbd5e1;">✉️ ${escapeHtml(c.email)}</div>` : ""}</div>`).join("");
        let rows = "";
        if (v.phone) rows += mkRow("📞", "Telefon", v.phone, "rgba(99,102,241,0.15)");
        if (v.email) rows += mkRow("✉️", "E-posta", v.email, "rgba(236,72,153,0.15)");
        if (v.website) rows += mkRow("🌐", "Web Sitesi", v.website, "rgba(6,182,212,0.15)");
        if (v.address) rows += mkRow("📍", "Adres", v.address, "rgba(245,158,11,0.15)");
        if (ci.maps_url) rows += mkRow("🗺️", "Konum", ci.maps_url, "rgba(16,185,129,0.15)");
        if (ci.working_hours) rows += `<div style="${MK_ROW}align-items:flex-start;"><div style="font-size:14px;">🕒</div><div style="font-size:11px;color:#e2e8f0;white-space:pre-wrap;">${escapeHtml(ci.working_hours)}</div></div>`;
        body = `<div style="text-align:center;">${heroLogo}
            <div style="font-size:19px;font-weight:800;color:#fff;">${escapeHtml(ci.name || "Şirket Adı")}</div>
            ${ci.sector ? `<div style="font-size:12px;color:#60a5fa;margin-top:3px;font-weight:600;">${escapeHtml(ci.sector)}</div>` : ""}
            ${v.bio ? `<div style="font-size:11px;color:#cbd5e1;margin:10px 0;line-height:1.4;">${escapeHtml(v.bio)}</div>` : ""}</div>
            <div style="display:flex;flex-direction:column;gap:8px;text-align:left;margin-top:12px;">${rows}${contactCards ? `<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-top:4px;">Yetkili Kişiler</div>${contactCards}` : ""}</div>`;
    } else if (t === "social") {
        const links = Object.entries(payload.vcard_payload.social_links).filter(([, u]) => u);
        body = mkCenter(mkHeroIcon("📲", "linear-gradient(135deg,#ec4899,#8b5cf6)", "rgba(236,72,153,0.4)", true) +
            '<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:14px;">Sosyal Medya Bağlantıları</div>') +
            (links.length
                ? `<div style="display:flex;flex-direction:column;gap:8px;text-align:left;">${links.map(([p, u]) => mkRow(SOCIAL_ICONS[p] || "🔗", SOCIAL_LABELS[p] || p, u, "rgba(244,114,182,0.15)")).join("")}</div>`
                : '<div style="text-align:center;font-size:11px;color:#94a3b8;">Soldaki alanlara hesaplarınızı ekleyin; burada bağlantı listesi olarak görünür.</div>');
    } else if (SOCIAL_SINGLE_TYPES.includes(t)) {
        const link = payload.vcard_payload.social_links[t];
        body = mkCenter(mkHeroIcon(SOCIAL_ICONS[t] || "📲", "linear-gradient(135deg,#ec4899,#8b5cf6)", "rgba(236,72,153,0.4)", true) +
            `<div style="font-size:16px;font-weight:800;color:#fff;">${escapeHtml(SOCIAL_LABELS[t] || t)} Profili</div>
             <div style="margin-top:14px;padding:12px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);border-radius:12px;font-size:12px;color:#c7d2fe;font-weight:700;">⚡ Doğrudan profile yönlenir</div>
             ${link ? `<div style="margin-top:10px;font-size:11px;color:#94a3b8;word-break:break-all;">${escapeHtml(link)}</div>` : ""}`);
    } else if (MENU_TYPES.includes(t)) {
        const m = payload.menu_payload;
        const items = (m.categories || []).reduce((n, c) => n + c.items.length, 0);
        body = mkCenter(mkHeroIcon("📖", "linear-gradient(135deg,#f59e0b,#d97706)", "rgba(245,158,11,0.4)", false) +
            `<div style="font-size:18px;font-weight:800;color:#fff;">${escapeHtml(m.title || "Restoran & Menü")}</div>
             <div style="font-size:12px;color:#fbbf24;margin-top:4px;font-weight:600;">${escapeHtml(m.description || "Dijital Menümüz ve Lezzetlerimiz")}</div>
             ${m.pdf_url ? '<div style="margin-top:16px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);padding:12px;border-radius:12px;font-size:12px;color:#a5b4fc;font-weight:700;">📄 PDF Yüklendi</div>' : ""}
             ${items ? `<div style="margin-top:12px;font-size:11px;color:#94a3b8;">🍽️ ${items} ürün eklendi</div>` : ""}`);
    } else {
        body = mkCenter(mkHeroIcon("📱", "linear-gradient(135deg,#6366f1,#4f46e5)", "rgba(99,102,241,0.4)", false) +
            '<div style="font-size:13px;color:#94a3b8;">Bu tür için açılış sayfası yoktur; QR kod doğrudan içeriği kullanır.</div>');
    }
    container.innerHTML = start + body + end;
}

// ---------------------------------------------------------------------------
// Canlı QR önizlemesi
// ---------------------------------------------------------------------------
function computePreviewText(p) {
    const t = p.type;
    if (t === "url") return SAMPLE_SHORT_LINK;
    if (t === "static_url") return fVal("target-url") ? buildStaticContent("static_url", { url: fVal("target-url") }) : "";
    if (t === "phone") return fVal("phone-number") ? buildStaticContent("phone", { phone: fVal("phone-number") }) : "";
    if (t === "sms") return fVal("sms-phone") ? buildStaticContent("sms", { phone: fVal("sms-phone"), message: fVal("sms-message") }) : "";
    if (t === "text") return fVal("static-text");
    if (t === "wifi") return fVal("wifi-ssid") ? buildStaticContent("wifi", p.static_payload) : "";
    if (WA_TYPES.includes(t)) {
        const digits = normalizePhoneForWa(fVal("wa-phone"));
        return digits ? buildWhatsappUrl(fVal("wa-phone"), fVal("wa-msg")) : "";
    }
    return SAMPLE_SHORT_LINK;
}

function updateContrastWarning() {
    const el = byId("contrast-warning");
    if (!el) return;
    const fill = getVal("fill-color", "#4F46E5");
    const back = getVal("back-color", "#FFFFFF");
    const ratio = contrastRatio(fill, back);
    const lf = relativeLuminance(fill);
    const lb = relativeLuminance(back);
    const low = ratio !== null && (ratio < 3 || (lf !== null && lb !== null && lf > lb));
    el.style.display = low ? "block" : "none";
}

let _previewTimer = null;
let _previewSeq = 0;
async function _fetchPreview(text, settings) {
    const seq = ++_previewSeq;
    try {
        const res = await fetch("/api/qr/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, settings })
        });
        const data = await res.json();
        if (seq !== _previewSeq) return; // daha yeni bir istek var
        const imgUrl = data.qr_image || data.image;
        const img = byId("preview-qr-img");
        if (imgUrl && img) img.src = imgUrl;
    } catch (err) {
        console.error("Preview error:", err);
    }
}

function updateLivePreview() {
    const payload = getQRFormPayload();
    let previewText = computePreviewText(payload);
    if (!previewText || previewText.trim() === "") previewText = "https://qrdijitalgru.com";

    const frameLabel = byId("preview-frame-text-label");
    if (frameLabel) {
        frameLabel.innerText = payload.settings.frame_text || "Beni Tara!";
        frameLabel.style.color = payload.settings.frame_text_color || "#a5b4fc";
    }
    updateContrastWarning();
    if (currentPreviewMode === "landing") renderLandingPageMockup();

    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => _fetchPreview(previewText, payload.settings), 180);
}

// ---------------------------------------------------------------------------
// Şirket kartı: yetkili kişiler + logo
// ---------------------------------------------------------------------------
function renderCompanyContacts() {
    const c = byId("comp-contacts-container");
    if (!c) return;
    if (!companyContacts.length) {
        c.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text-muted);border:1px dashed rgba(255,255,255,0.1);border-radius:12px;font-size:12px;">Henüz yetkili eklenmedi. “+ Yetkili Ekle” ile başlayın (opsiyonel).</div>';
        return;
    }
    const f = (i, field, ph, type, val) => `<input type="${type}" class="form-input" data-ci="${i}" data-cf="${field}" placeholder="${ph}" value="${escapeHtml(val || "")}" style="font-size:12px;">`;
    c.innerHTML = companyContacts.map((ct, i) => `
        <div class="company-contact-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:12px;font-weight:700;color:#a5b4fc;">👤 Yetkili ${i + 1}</span>
                <button type="button" data-ci-remove="${i}" style="background:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.3);color:#f43f5e;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:11px;">🗑️ Sil</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${f(i, "name", "Ad Soyad", "text", ct.name)}${f(i, "title", "Unvan", "text", ct.title)}
                ${f(i, "phone", "Telefon", "tel", ct.phone)}${f(i, "email", "E-posta", "email", ct.email)}
            </div>
        </div>`).join("");
}
function addCompanyContact() {
    companyContacts.push({ name: "", title: "", phone: "", email: "" });
    renderCompanyContacts();
    updateLivePreview();
}
function removeCompanyContact(i) {
    companyContacts.splice(i, 1);
    renderCompanyContacts();
    updateLivePreview();
}

// ---------------------------------------------------------------------------
// Yükleme altyapısı: XMLHttpRequest ile ilerleme çubuğu + dosya adı + Kaldır
// ---------------------------------------------------------------------------
function suIcon(name) {
    const P = {
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        check: '<polyline points="20 6 9 17 4 12"/>',
        x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
        more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
        archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
        search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'
    };
    return '<svg class="su-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || "") + '</svg>';
}

function xhrUpload(url, formData, onProgress) {
    return new Promise(resolve => {
        const x = new XMLHttpRequest();
        x.open("POST", url);
        const h = authHeaders();
        Object.keys(h).forEach(k => x.setRequestHeader(k, h[k]));
        if (x.upload && onProgress) {
            x.upload.onprogress = (e) => {
                if (e.lengthComputable && e.total > 0) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
            };
        }
        x.onload = () => {
            let d = {};
            try { d = JSON.parse(x.responseText); } catch (_) {}
            resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, data: d || {} });
        };
        x.onerror = () => resolve({ ok: false, status: 0, data: {}, networkError: true });
        x.onabort = () => resolve({ ok: false, status: 0, data: {}, networkError: true });
        x.send(formData);
    });
}

const _upWidgets = {};
function upWidget(key, anchor, input) {
    let w = _upWidgets[key];
    if (w && w.root.isConnected) { if (input) w.input = input; return w; }
    const root = document.createElement("div");
    root.className = "up-widget";
    root.setAttribute("data-up", key);
    root.innerHTML =
        '<div class="up-bar" role="progressbar" aria-label="Yükleme durumu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="up-fill"></div></div>' +
        '<div class="up-meta"><span class="up-fname"></span><span class="up-pct">0%</span></div>' +
        '<div class="up-chip">' + suIcon("file") + '<span class="up-name"></span><button type="button" class="up-remove">Kaldır</button></div>';
    if (anchor && anchor.insertAdjacentElement) anchor.insertAdjacentElement("afterend", root);
    else if (input && input.parentNode) input.parentNode.appendChild(root);
    const bar = root.querySelector(".up-bar");
    w = {
        root, input: input || null, onRemove: null,
        start(file) {
            root.className = "up-widget is-on is-loading";
            root.querySelector(".up-fname").textContent = file;
            this.progress(0);
        },
        progress(p) {
            root.querySelector(".up-fill").style.width = p + "%";
            bar.setAttribute("aria-valuenow", String(p));
            root.querySelector(".up-pct").textContent = p >= 100 ? "100% · işleniyor" : p + "%";
        },
        done(name, onRemove) {
            this.onRemove = onRemove || null;
            root.querySelector(".up-name").textContent = name;
            root.className = "up-widget is-on is-done";
        },
        fail() { root.className = "up-widget"; this.onRemove = null; },
        clear() { root.className = "up-widget"; this.onRemove = null; }
    };
    root.querySelector(".up-remove").addEventListener("click", () => { if (w.onRemove) w.onRemove(); });
    _upWidgets[key] = w;
    return w;
}
function clearUpWidget(key) { if (_upWidgets[key]) _upWidgets[key].clear(); }
function clearAllUploadWidgets() { Object.keys(_upWidgets).forEach(k => _upWidgets[k].clear()); }

async function uploadImageFile(file, onProgress) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await xhrUpload("/api/upload/image", fd, onProgress);
    if (r.networkError) {
        uiToast("❌ Sunucuya bağlanırken bir hata oluştu.");
        return null;
    }
    if (!r.ok || !r.data.image_url) {
        uiToast("❌ " + (r.data.error || "Görsel yüklenemedi."));
        return null;
    }
    return r.data.image_url;
}

// PDF (app.js'tekinin yerini alır; davranış aynı + ilerleme + Kaldır)
async function handlePDFUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith(".pdf")) {
        uiToast("Lütfen geçerli bir PDF dosyası seçin.");
        input.value = "";
        return;
    }
    const statusText = byId("pdf-status-text");
    const w = upWidget("pdf", byId("pdf-upload-box"), input);
    if (statusText) { statusText.innerText = "Yükleniyor..."; statusText.style.color = ""; }
    w.start(file.name);
    const fd = new FormData();
    fd.append("pdf_file", file);
    const r = await xhrUpload("/api/upload/pdf", fd, p => w.progress(p));
    const data = r.data || {};
    if (data.status === "success") {
        uploadedPdfUrl = data.pdf_url;
        if (statusText) { statusText.innerText = "PDF yüklendi"; statusText.style.color = "#34d399"; }
        w.done(file.name, removePdfUpload);
        uiToast("PDF dosyanız başarıyla yüklendi.", "success");
        updateLivePreview();
    } else {
        w.fail();
        uiToast(r.networkError ? "Sunucu bağlantı hatası oluştu." : (data.error || "PDF yükleme hatası oluştu."), "error");
        if (statusText) { statusText.innerText = statusText.dataset.dflt || "Tıklayın ve PDF dosyanızı seçin (.pdf)"; statusText.style.color = ""; }
        input.value = "";
    }
}
function removePdfUpload() {
    uploadedPdfUrl = null;
    const f = byId("pdf-file-input"); if (f) f.value = "";
    const statusText = byId("pdf-status-text");
    if (statusText) { statusText.innerText = statusText.dataset.dflt || "Tıklayın ve PDF dosyanızı seçin (.pdf)"; statusText.style.color = ""; }
    clearUpWidget("pdf");
    updateLivePreview();
}

// Profil fotoğrafı (kartvizit)
async function handleVcardAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusText = byId("vcard-avatar-status");
    const btnText = byId("vcard-avatar-btn-text");
    const cropBtn = byId("vcard-avatar-crop-btn");
    const removeBtn = byId("vcard-avatar-remove-btn");
    const hiddenInput = byId("vcard-avatar-url");
    const w = upWidget("vcard-avatar", statusText, input);

    if (statusText) { statusText.innerText = "Fotoğraf işleniyor..."; statusText.style.color = "#f59e0b"; }
    w.start(file.name);

    // 1. Anında yerel (base64) önizleme
    const reader = new FileReader();
    reader.onload = function (e) {
        uploadedVcardAvatarUrl = e.target.result;
        if (hiddenInput) hiddenInput.value = uploadedVcardAvatarUrl;
        if (btnText) btnText.innerText = file.name.substring(0, 14);
        if (cropBtn) cropBtn.style.display = "inline-block";
        if (removeBtn) removeBtn.style.display = "inline-block";
        if (typeof openAvatarCropModal === "function") openAvatarCropModal(e.target.result);
        updateLivePreview();
    };
    reader.readAsDataURL(file);

    // 2. Sunucuya yükle
    try {
        const fd = new FormData();
        fd.append("avatar_file", file);
        const r = await xhrUpload("/api/upload/avatar", fd, p => w.progress(p));
        const data = r.data || {};
        if (data.status === "success" && data.avatar_url) {
            if (hiddenInput && !hiddenInput.value.startsWith("data:image")) {
                uploadedVcardAvatarUrl = data.avatar_url;
                hiddenInput.value = uploadedVcardAvatarUrl;
            }
            if (statusText) {
                statusText.innerText = "Fotoğraf hazır. Dilerseniz “Konumlandır & Kırp” düğmesiyle sürükleyip yakınlaştırabilirsiniz.";
                statusText.style.color = "#34d399";
            }
            w.done(file.name, removeVcardAvatar);
            updateLivePreview();
        } else {
            w.fail();
            console.error("Avatar upload API error:", data.error);
            if (data.error) uiToast("❌ " + data.error);
            else if (r.networkError) uiToast("❌ Sunucuya bağlanırken bir hata oluştu.");
        }
    } catch (err) {
        w.fail();
        console.error("Avatar upload network error:", err);
    }
}

function removeVcardAvatar() {
    uploadedVcardAvatarUrl = "";
    const hiddenInput = byId("vcard-avatar-url");
    const fileInput = byId("vcard-avatar-file");
    const btnText = byId("vcard-avatar-btn-text");
    const cropBtn = byId("vcard-avatar-crop-btn");
    const removeBtn = byId("vcard-avatar-remove-btn");
    const statusText = byId("vcard-avatar-status");
    if (hiddenInput) hiddenInput.value = "";
    if (fileInput) fileInput.value = "";
    if (btnText) btnText.innerText = "Profil Fotoğrafı Seç / Yükle";
    if (cropBtn) cropBtn.style.display = "none";
    if (removeBtn) removeBtn.style.display = "none";
    if (statusText) {
        statusText.innerText = "Fotoğraf kaldırıldı. Baş harf simgesi varsayılan olarak gösterilecek.";
        statusText.style.color = "var(--text-muted)";
    }
    clearUpWidget("vcard-avatar");
    updateLivePreview();
}

// Kartvizit ön yüz görseli (type: "vcard" | "menu")
async function handleCardImageUpload(input, type) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusElem = byId(type + "-card-img-status");
    const hiddenElem = byId(type + "-card-image-url");
    const key = "card-" + type;
    const w = upWidget(key, statusElem, input);
    if (statusElem) statusElem.innerText = "Kartvizit görseli yükleniyor...";
    w.start(file.name);
    const url = await uploadImageFile(file, p => w.progress(p));
    if (url) {
        if (hiddenElem) hiddenElem.value = url;
        const prev = byId(type + "-card-img-preview");
        const safe = safeAttrUrl(url);
        if (prev && safe) { prev.src = safe; prev.style.display = "block"; }
        if (statusElem) statusElem.innerText = "Kartvizit ön yüz görseli yüklendi.";
        w.done(file.name, () => removeCardImage(type));
        updateLivePreview();
    } else {
        w.fail();
        input.value = "";
        if (statusElem) statusElem.innerText = statusElem.dataset.dflt || "Görsel yüklenemedi. Lütfen tekrar deneyin.";
    }
}
function removeCardImage(type) {
    const key = "card-" + type;
    const hidden = byId(type + "-card-image-url"); if (hidden) hidden.value = "";
    const w = _upWidgets[key];
    if (w && w.input) w.input.value = "";
    const prev = byId(type + "-card-img-preview");
    if (prev) { prev.removeAttribute("src"); prev.style.display = "none"; }
    const st = byId(type + "-card-img-status");
    if (st) { st.innerText = st.dataset.dflt || ""; st.style.color = ""; }
    clearUpWidget(key);
    updateLivePreview();
}

function _setLogoUI(prefix, url, btnDefaultText) {
    const prev = byId(prefix + "-preview");
    if (prev) {
        const safe = safeAttrUrl(url);
        if (safe) { prev.src = safe; prev.style.display = "block"; } else { prev.removeAttribute("src"); prev.style.display = "none"; }
    }
    const rm = byId(prefix + "-remove-btn");
    if (rm) rm.style.display = url ? "inline-block" : "none";
    setTxt(prefix + "-btn-text", url ? "Logoyu Değiştir" : btnDefaultText);
}

async function handleCompanyLogoUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const status = byId("comp-logo-status");
    const w = upWidget("comp-logo", status, input);
    if (status) { status.innerText = "Logo yükleniyor..."; status.style.color = "#f59e0b"; }
    w.start(file.name);
    const url = await uploadImageFile(file, p => w.progress(p));
    input.value = "";
    if (url) {
        byId("comp-logo-url").value = url;
        _setLogoUI("comp-logo", url, "Logo Seç / Yükle");
        if (status) { status.innerText = "Logo yüklendi."; status.style.color = "#34d399"; }
        w.done(file.name, removeCompanyLogo);
    } else {
        w.fail();
        if (status) {
            status.innerText = status.dataset.dflt || "";
            status.style.color = "";
        }
    }
    updateLivePreview();
}
function removeCompanyLogo() {
    const u = byId("comp-logo-url"); if (u) u.value = "";
    const f = byId("comp-logo-file"); if (f) f.value = "";
    _setLogoUI("comp-logo", "", "Logo Seç / Yükle");
    const status = byId("comp-logo-status");
    if (status) { status.innerText = status.dataset.dflt || ""; status.style.color = ""; }
    clearUpWidget("comp-logo");
    updateLivePreview();
}

// ---------------------------------------------------------------------------
// QR ortası logo (Profesyonel paket)
// ---------------------------------------------------------------------------
function updateLogoLockState() {
    const allowed = canUseQrLogo();
    const group = byId("qr-logo-group");
    if (group) group.classList.toggle("logo-locked", !allowed);
    const file = byId("qr-logo-file");
    if (file) file.disabled = !allowed;
    setTxt("qr-logo-hint", allowed
        ? "QR kodun tam ortasına marka logonuzu yerleştirin (PNG / JPG / WebP)."
        : "🔒 QR ortasına logo eklemek Profesyonel pakette aktiftir.");
    if (!allowed && fVal("qr-logo-url")) removeStudioLogo();
}
async function handleStudioLogoUpload(input) {
    if (!input.files || !input.files[0]) return;
    if (!canUseQrLogo()) {
        uiToast("🔒 QR ortasına logo eklemek Profesyonel pakette kullanılabilir.");
        input.value = "";
        return;
    }
    const file = input.files[0];
    const w = upWidget("qr-logo", byId("qr-logo-hint"), input);
    setTxt("qr-logo-btn-text", "Yükleniyor...");
    w.start(file.name);
    const url = await uploadImageFile(file, p => w.progress(p));
    input.value = "";
    if (url) {
        byId("qr-logo-url").value = url;
        studioLogoUrl = url;
        _setLogoUI("qr-logo", url, "Logo Yükle");
        setDisp("qr-logo-note", true);
        w.done(file.name, removeStudioLogo);
    } else {
        w.fail();
        _setLogoUI("qr-logo", fVal("qr-logo-url"), "Logo Yükle");
    }
    updateLivePreview();
}
function removeStudioLogo() {
    const u = byId("qr-logo-url"); if (u) u.value = "";
    const f = byId("qr-logo-file"); if (f) f.value = "";
    studioLogoUrl = "";
    _setLogoUI("qr-logo", "", "Logo Yükle");
    setDisp("qr-logo-note", false);
    clearUpWidget("qr-logo");
    updateLivePreview();
}

// Oturum durumu değişince logo kilidini güncelle (app.js'tekilerin yerini alır)
function setUserLoggedIn() {
    document.getElementById("nav-auth-btn").innerText = `Çıkış Yap (${currentUser.name})`;
    document.getElementById("nav-dash-link").style.display = "inline-block";
    updateLogoLockState();
}
function setUserLoggedOut() {
    currentUser = null;
    localStorage.removeItem("jwt_token");
    document.getElementById("nav-auth-btn").innerText = "Giriş Yap / Kaydol";
    document.getElementById("nav-dash-link").style.display = "none";
    updateLogoLockState();
}

// ---------------------------------------------------------------------------
// Paket limitleri (sunucu planından)
// ---------------------------------------------------------------------------
async function loadPlanLimits() {
    try {
        const res = await fetch("/api/subscriptions/plans");
        if (!res.ok) return;
        const data = await res.json();
        const plans = data.plans || {};
        const fill = (key, val) => {
            if (val == null) return;
            document.querySelectorAll('[data-plan-limit="' + key + '"]').forEach(el => { el.textContent = String(val); });
        };
        Object.keys(plans).forEach(k => fill(k, plans[k] && plans[k].dynamic_limit));
        fill("free", data.free_dynamic_limit);
    } catch (err) {
        console.warn("Plan limitleri alınamadı (HTML'deki varsayılanlar kullanılacak):", err);
    }
}

// ---------------------------------------------------------------------------
// Klasör select'i (stüdyo) — sayfa yenilenmeden güncellenir
// ---------------------------------------------------------------------------
function getKnownFolders() {
    const s = new Set(DEFAULT_FOLDERS);
    customFolders.forEach(f => s.add(f));
    (typeof allQRCodes !== "undefined" ? allQRCodes : []).forEach(q => {
        if (q && q.folder_name && q.status !== "deleted") s.add(q.folder_name);
    });
    return Array.from(s);
}
function refreshStudioFolderSelect(preferred) {
    const sel = byId("qr-folder");
    if (!sel) return;
    const cur = preferred != null ? preferred : sel.value;
    const folders = getKnownFolders();
    sel.innerHTML = "";
    folders.forEach(f => {
        const o = document.createElement("option");
        o.value = f;
        o.textContent = "📁 " + f;
        sel.appendChild(o);
    });
    const n = document.createElement("option");
    n.value = "__new__";
    n.textContent = "➕ Yeni Klasör Oluştur...";
    sel.appendChild(n);
    sel.value = (cur === "__new__" || folders.includes(cur)) ? cur : "Genel";
    toggleCustomFolderInput(sel.value);
}

// ---------------------------------------------------------------------------
// Formu sıfırla
// ---------------------------------------------------------------------------
function resetStudioForm(opts) {
    const keepBasics = !!(opts && opts.keepBasics);
    clearFieldErrors();

    document.querySelectorAll(".type-form").forEach(form => {
        form.querySelectorAll("input, textarea, select").forEach(el => {
            const ty = (el.type || "").toLowerCase();
            if (ty === "checkbox" || ty === "radio") el.checked = el.defaultChecked;
            else if (ty === "file") el.value = "";
            else if (el.tagName === "SELECT") {
                let idx = 0;
                Array.from(el.options).forEach((o, i) => { if (o.defaultSelected) idx = i; });
                el.selectedIndex = idx;
            } else el.value = el.defaultValue;
        });
    });

    // Avatar / kartvizit görseli / PDF / logo durumları
    clearAllUploadWidgets();
    uploadedVcardAvatarUrl = "";
    uploadedPdfUrl = null;
    ["vcard-avatar-crop-btn", "vcard-avatar-remove-btn"].forEach(id => setDisp(id, false));
    setTxt("vcard-avatar-btn-text", "Profil Fotoğrafı Seç / Yükle");
    ["vcard", "menu"].forEach(p => {
        const prev = byId(p + "-card-img-preview");
        if (prev) { prev.removeAttribute("src"); prev.style.display = "none"; }
    });
    document.querySelectorAll("[data-dflt]").forEach(el => {
        el.innerText = el.dataset.dflt;
        el.style.color = "";
    });
    _setLogoUI("comp-logo", "", "Logo Seç / Yükle");

    // Menü & yetkililer
    menuCategoriesData = [];
    if (typeof renderMenuBuilderUI === "function") renderMenuBuilderUI();
    companyContacts = [];
    renderCompanyContacts();

    // vCard teması
    selectedVCardTheme = "midnight";
    selectedVCardPrimaryColor = "#6366f1";
    const grid = byId("vcard-theme-presets-grid");
    if (grid) {
        grid.querySelectorAll("button").forEach(b => { b.style.borderColor = "rgba(255,255,255,0.12)"; b.style.transform = "none"; });
        const first = grid.querySelector("button");
        if (first) { first.style.borderColor = "#6366f1"; first.style.transform = "translateY(-2px)"; }
    }
    toggleWifiPass();

    if (!keepBasics) {
        const title = byId("qr-title"); if (title) title.value = "";
        const custom = byId("custom-folder-input"); if (custom) custom.value = "";
        refreshStudioFolderSelect("Genel");
        ["fill-color", "back-color", "frame-style", "frame-text", "frame-color", "frame-text-color"].forEach(id => {
            const el = byId(id);
            if (!el) return;
            if (el.tagName === "SELECT") {
                let idx = 0;
                Array.from(el.options).forEach((o, i) => { if (o.defaultSelected) idx = i; });
                el.selectedIndex = idx;
            } else el.value = el.defaultValue;
            el.dispatchEvent(new Event("input", { bubbles: true })); // renk dairesi + swatch senkronu
        });
        removeStudioLogo();
    }
    updateContrastWarning();
    updateLivePreview();
}

// Başarılı kayıt sonrası (hem normal kayıt hem bekleyen kayıt)
function onQRSavedSuccess(payload) {
    if (payload && payload.folder_name) customFolders.add(payload.folder_name);
    resetStudioForm();
    refreshStudioFolderSelect("Genel");
    applyTypeUI();
}

// ---------------------------------------------------------------------------
// Kayıt sonrası başarı ekranı (stüdyo üzerinde modal)
// ---------------------------------------------------------------------------
let _successState = null;

function closeQRSuccessModal(action) {
    const st = _successState;
    if (!st) return;
    _successState = null;
    if (st.release) st.release();
    if (st.overlay.parentNode) st.overlay.parentNode.removeChild(st.overlay);
    document.body.style.overflow = st.prevOverflow;
    // Kayıt tamamlandı: yinelenen kaydı önlemek için form her kapanışta sıfırlanır
    onQRSavedSuccess(st.payload);
    if (action === "dashboard") {
        const dashLink = byId("nav-dash-link");
        if (dashLink) dashLink.click();
    } else {
        const studioLink = document.querySelector('.nav-link[data-target="studio-tab"]');
        const studioSec = byId("studio-tab");
        if (studioSec && !studioSec.classList.contains("active") && studioLink) studioLink.click();
        if (action === "new") {
            const ti = byId("qr-title");
            if (ti && ti.focus) { try { ti.focus({ preventScroll: true }); } catch (_) {} }
        } else if (st.prevFocus && st.prevFocus.focus) {
            try { st.prevFocus.focus(); } catch (_) {}
        }
    }
}

function showQRSuccessModal(data, payload) {
    closeQRSuccessModal();
    data = data || {};
    const isStatic = isStaticType(payload.type);
    const shortUrl = isStatic ? "" : (data.short_code ? `${window.location.origin}/r/${data.short_code}` : (data.short_url || ""));
    const qrId = data.qr_id;
    const title = payload.title || "QR Kodum";
    const img = safeAttrUrl(data.qr_image);

    const overlay = document.createElement("div");
    overlay.className = "su-overlay";
    overlay.id = "qr-success-overlay";
    const linkBlock = isStatic
        ? `<div class="su-link-box static" id="qr-success-link">Statik QR: link yok</div>`
        : `<div class="su-link-box"><code id="qr-success-link" title="${escapeHtml(shortUrl)}">${escapeHtml(shortUrl)}</code>` +
          `<button type="button" class="su-btn" id="qr-success-copy">${suIcon("copy")}<span>Kopyala</span></button></div>`;
    overlay.innerHTML =
        `<div class="su-modal" id="qr-success-modal" role="dialog" aria-modal="true" aria-labelledby="qr-success-title">` +
        `<div class="su-check">${suIcon("check")}</div>` +
        `<h2 id="qr-success-title">QR kodunuz hazır</h2>` +
        `<p class="su-sub">“${escapeHtml(title)}” hesabınıza kaydedildi.</p>` +
        `<div class="su-qr">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(title)} QR kodu">` : ""}</div>` +
        linkBlock +
        `<div class="su-dl-row">` +
        ["png", "svg", "eps"].map(f => `<button type="button" class="su-btn" data-su-dl="${f}">${suIcon("download")}<span>${f.toUpperCase()} indir</span></button>`).join("") +
        `</div>` +
        `<div class="su-foot">` +
        `<button type="button" class="su-btn" id="qr-success-dash">${suIcon("grid")}<span>Panele git</span></button>` +
        `<button type="button" class="su-btn primary" id="qr-success-new">${suIcon("plus")}<span>Yeni QR oluştur</span></button>` +
        `</div>`;
    document.body.appendChild(overlay);

    const modal = overlay.querySelector("#qr-success-modal");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "su-btn";
    closeBtn.setAttribute("aria-label", "Kapat");
    closeBtn.style.cssText = "position:absolute;top:12px;right:12px;padding:8px;border-radius:10px;";
    closeBtn.innerHTML = suIcon("x");
    modal.style.position = "relative";
    modal.appendChild(closeBtn);

    _successState = {
        overlay, payload,
        prevFocus: document.activeElement,
        prevOverflow: document.body.style.overflow,
        release: window.uiTrapFocus ? window.uiTrapFocus(modal, () => closeQRSuccessModal()) : null
    };
    document.body.style.overflow = "hidden";

    closeBtn.addEventListener("click", () => closeQRSuccessModal());
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeQRSuccessModal(); });
    overlay.querySelector("#qr-success-dash").addEventListener("click", () => closeQRSuccessModal("dashboard"));
    overlay.querySelector("#qr-success-new").addEventListener("click", () => closeQRSuccessModal("new"));

    const copyBtn = overlay.querySelector("#qr-success-copy");
    if (copyBtn) copyBtn.addEventListener("click", async () => {
        const ok = await uiCopyText(shortUrl);
        if (!ok) { uiShowText("Kısa bağlantınız", shortUrl); return; }
        const label = copyBtn.querySelector("span");
        copyBtn.classList.add("ok");
        label.textContent = "Kopyalandı";
        clearTimeout(copyBtn._t);
        copyBtn._t = setTimeout(() => { copyBtn.classList.remove("ok"); label.textContent = "Kopyala"; }, 2000);
    });

    overlay.querySelectorAll("[data-su-dl]").forEach(b => b.addEventListener("click", async () => {
        const fmt = b.getAttribute("data-su-dl");
        if (qrId == null) { uiToast("Dosya şu an indirilemiyor. Panelinizden tekrar deneyin.", "error"); return; }
        b.disabled = true;
        try {
            await fetchAndSaveFile(`/api/qr/${encodeURIComponent(qrId)}/download?format=${encodeURIComponent(fmt)}`,
                `qr-${slugifyFileName(title)}.${fmt}`, fmt.toUpperCase());
        } finally { b.disabled = false; }
    }));

    setTimeout(() => { const p = overlay.querySelector("#qr-success-new"); if (p) p.focus(); }, 40);
}

// app.js'teki bekleyen kayıt akışı: panele atmak yerine başarı ekranını gösterir
async function processPendingQRPurchaseOrSave(token) {
    if (!pendingQRPayload) return false;
    const payload = pendingQRPayload;
    pendingQRPayload = null; // çift gönderimi önlemek için hemen temizle
    try {
        const res = await fetch("/api/qr/create", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            if (payload.folder_name) customFolders.add(payload.folder_name);
            uiToast("Hesabınız oluşturuldu ve QR kodunuz hesabınıza kaydedildi.", "success");
            loadDashboardData();
            const dashLink = byId("nav-dash-link");
            if (dashLink) dashLink.style.display = "inline-block";
            const studioLink = document.querySelector('.nav-link[data-target="studio-tab"]');
            const studioSec = byId("studio-tab");
            if (studioSec && !studioSec.classList.contains("active") && studioLink) studioLink.click();
            showQRSuccessModal(data, payload);
            return true;
        }
        if (!applyServerFieldErrors(data)) {
            uiToast("QR kod kaydedilirken bir hata oluştu: " + (data.error || "Bilinmeyen hata"), "error");
        }
        return false;
    } catch (err) {
        console.error("Pending QR save error:", err);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Mobil sayfa önizlemesi — gerçek herkese açık şablonlarla aynı metin/etiketler
// ---------------------------------------------------------------------------
function _mkSection(title) {
    return `<div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin:14px 0 6px;text-align:left;letter-spacing:.04em;">${escapeHtml(title)}</div>`;
}

function renderLandingPageMockup() {
    const container = byId("mockup-landing-content");
    if (!container) return;
    const payload = getQRFormPayload();
    const t = payload.type;
    if (t !== "vcard" && !MENU_TYPES.includes(t)) { _legacyLandingMockup(); return; }

    const start = `<div style="width:100%;min-height:100%;box-sizing:border-box;background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);color:#fff;padding:24px 16px 20px 16px;display:flex;flex-direction:column;justify-content:space-between;border-radius:26px;"><div style="width:100%;">`;
    const end = `</div><div style="text-align:center;margin-top:auto;padding-top:20px;font-size:11px;color:#64748b;font-weight:500;">Powered by <strong style="color:#818cf8;">Dijitalgru QR Studio</strong></div></div>`;
    let body = "";

    if (t === "vcard") {
        const v = payload.vcard_payload;
        const fullName = v.full_name || "Ad Soyad";
        const initial = escapeHtml((fullName.trim()[0] || "A").toUpperCase());
        const av = safeAttrUrl(v.avatar_url);
        const circle = "width:76px;height:76px;border-radius:50%;";
        const avatar = av
            ? `<div style="${circle}margin:0 auto 12px auto;"><img src="${escapeHtml(av)}" alt="" style="${circle}object-fit:cover;box-shadow:0 0 25px rgba(99,102,241,0.5);border:2px solid #6366f1;display:block;"></div>`
            : `<div style="${circle}background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#fff;margin:0 auto 12px auto;box-shadow:0 0 25px rgba(99,102,241,0.5);border:2px solid rgba(255,255,255,0.2);">${initial}</div>`;
        let actions = "";
        if (v.phone) actions += mkAction("📞", "Ara", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.1)", "#fff") + mkAction("💬", "WhatsApp", "rgba(16,185,129,0.15)", "rgba(16,185,129,0.3)", "#34d399");
        if (v.email) actions += mkAction("✉️", "E-posta", "rgba(99,102,241,0.15)", "rgba(99,102,241,0.3)", "#a5b4fc");
        if (v.website) actions += mkAction("🌐", "Web", "rgba(6,182,212,0.15)", "rgba(6,182,212,0.3)", "#06b6d4");
        let rows = "";
        if (v.phone) rows += mkRow("📱", "Cep Telefonu", v.phone, "rgba(99,102,241,0.15)");
        if (v.phone2) rows += mkRow("🏢", "İş Telefonu", v.phone2, "rgba(59,130,246,0.15)");
        if (v.email) rows += mkRow("✉️", "E-posta Adresi", v.email, "rgba(236,72,153,0.15)");
        if (v.website) rows += mkRow("🌐", "Web Sitesi", v.website, "rgba(6,182,212,0.15)");
        if (v.address) rows += mkRow("📍", "Adres / Şehir", v.address, "rgba(245,158,11,0.15)");
        const socials = Object.entries(v.social_links || {}).filter(([, u]) => u).map(([p, u]) => mkRow(SOCIAL_ICONS[p] || "🔗", SOCIAL_LABELS[p] || p, u, "rgba(244,114,182,0.15)")).join("");
        const cardImg = safeAttrUrl(v.card_image_url);
        body = `${avatar}
            <div style="font-size:18px;font-weight:800;color:#fff;text-align:center;">${escapeHtml(fullName)}</div>
            ${v.title ? `<div style="font-size:12px;color:#818cf8;margin-top:2px;font-weight:600;text-align:center;">${escapeHtml(v.title)}</div>` : ""}
            ${v.company ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;font-weight:500;text-align:center;">${escapeHtml(v.company)}</div>` : ""}
            ${v.bio ? `<div style="font-size:11px;color:#cbd5e1;margin-top:10px;line-height:1.4;padding:8px 10px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);text-align:left;">${escapeHtml(v.bio)}</div>` : ""}
            <button type="button" onclick="downloadSimulatorVcard()" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;border-radius:14px;font-size:13px;font-weight:800;color:#fff;border:none;background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 15px rgba(16,185,129,0.3);margin:16px 0 12px 0;cursor:pointer;">Rehbere Kaydet (.vcf)</button>
            ${actions ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:6px;">${actions}</div>` : ""}
            ${socials ? _mkSection("Sosyal Medya") + `<div style="display:flex;flex-direction:column;gap:8px;text-align:left;">${socials}</div>` : ""}
            ${rows ? _mkSection("İletişim Bilgileri") + `<div style="display:flex;flex-direction:column;gap:8px;text-align:left;">${rows}</div>` : ""}
            ${cardImg ? _mkSection("Kartvizit") + `<img src="${escapeHtml(cardImg)}" alt="" style="width:100%;border-radius:12px;display:block;">` : ""}
            ${v.direct_redirect ? '<div style="font-size:10px;color:#f59e0b;margin-top:12px;font-weight:700;background:rgba(245,158,11,0.1);padding:6px;border-radius:8px;text-align:center;">Doğrudan .vcf indirme açık</div>' : ""}`;
    } else {
        const m = payload.menu_payload;
        const cats = m.categories || [];
        const items = cats.reduce((n, c) => n + c.items.length, 0);
        const price = (p) => (p && !/[₺$€]/.test(p) ? "₺" + p : p);
        const surface = "background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;";
        const tabs = cats.length > 1
            ? `<div style="display:flex;gap:6px;overflow:hidden;margin:14px 0 4px;">${cats.map((c, i) => `<span style="flex-shrink:0;padding:5px 11px;border-radius:999px;font-size:10px;font-weight:700;${i === 0 ? "background:#6366f1;color:#fff;" : "background:rgba(255,255,255,0.06);color:#cbd5e1;"}">${escapeHtml(c.name || "Diğer")}</span>`).join("")}</div>`
            : "";
        const list = cats.map(c => {
            const shown = c.items.slice(0, 4);
            const more = c.items.length - shown.length;
            return `<div style="text-align:left;margin-top:12px;"><div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:6px;">${escapeHtml(c.name || "Diğer")}</div>` +
                shown.map(it => `<div style="${surface}padding:9px 11px;margin-bottom:6px;"><div style="display:flex;justify-content:space-between;gap:8px;"><span style="font-size:12px;font-weight:700;color:#f1f5f9;">${escapeHtml(it.name)}</span>${it.price ? `<span style="font-size:12px;font-weight:800;color:#a5b4fc;white-space:nowrap;">${escapeHtml(price(it.price))}</span>` : ""}</div>` +
                    `${it.description ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px;">${escapeHtml(it.description)}</div>` : ""}</div>`).join("") +
                (more > 0 ? `<div style="font-size:10px;color:#64748b;">+${more} ürün daha</div>` : "") + `</div>`;
        }).join("");
        const pdfBlock = m.pdf_url
            ? `<div style="${surface}padding:14px;margin-top:14px;text-align:center;"><div style="font-size:13px;font-weight:800;color:#fff;">PDF Menü &amp; Katalog</div>` +
              `<div style="margin:10px 0 6px;padding:10px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#4f46e5);font-size:12px;font-weight:800;color:#fff;">PDF'i Tam Ekran Aç</div>` +
              `<div style="font-size:10px;color:#94a3b8;">Tüm sayfaları görmek için PDF'i tam ekran açmanız önerilir.</div></div>`
            : "";
        let rows = "";
        if (m.phone) rows += mkRow("📞", "Telefon · Hemen Ara", m.phone, "rgba(99,102,241,0.15)");
        if (m.phone2) rows += mkRow("💬", "WhatsApp", m.phone2, "rgba(16,185,129,0.15)");
        if (m.email) rows += mkRow("✉️", "E-posta", m.email, "rgba(236,72,153,0.15)");
        if (m.website) rows += mkRow("🌐", "Siteye Git", m.website, "rgba(6,182,212,0.15)");
        if (m.address) rows += mkRow("📍", "Adres · Haritada Gör", m.address, "rgba(245,158,11,0.15)");
        const hasContact = m.contact_name || rows;
        const cardImg = safeAttrUrl(m.card_image_url);
        const contact = hasContact
            ? `<div style="${surface}padding:14px;margin-top:16px;text-align:left;"><div style="font-size:13px;font-weight:800;color:#fff;">${escapeHtml(m.contact_name || "İşletme & İletişim Bilgileri")}</div>` +
              `${m.contact_title ? `<div style="font-size:11px;color:#94a3b8;">${escapeHtml(m.contact_title)}</div>` : ""}` +
              `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">${rows}</div>` +
              `${cardImg ? `<img src="${escapeHtml(cardImg)}" alt="" style="width:100%;border-radius:12px;display:block;margin-top:10px;">` : ""}</div>`
            : "";
        body = `<div style="text-align:center;padding-top:6px;"><div style="font-size:19px;font-weight:800;color:#fff;">${escapeHtml(m.title || "İşletme Adı")}</div>` +
            `${m.description ? `<div style="font-size:12px;color:#fbbf24;margin-top:4px;font-weight:600;">${escapeHtml(m.description)}</div>` : ""}</div>` +
            pdfBlock + tabs + list + contact +
            (!m.pdf_url && !items && !hasContact ? '<div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:16px;">Soldaki alanları doldurdukça sayfanız burada şekillenir.</div>' : "");
    }
    container.innerHTML = start + body + end;
}

// ---------------------------------------------------------------------------
// Kaydet
// ---------------------------------------------------------------------------
async function handleSaveQR() {
    clearFieldErrors();
    const v = validateStudioForm();
    if (!v.ok) {
        v.errors.forEach(e => showFieldError(e.id, e.msg));
        focusFirstError();
        uiToast("⚠️ Lütfen işaretli alanları düzeltin.");
        return;
    }
    const payload = getQRFormPayload();
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        pendingQRPayload = payload; // Taslak bellekte tutulur
        uiToast("QR Kodunuzu hesabınıza kaydetmek için lütfen ücretsiz üye olun veya giriş yapın.");
        openModal("auth-modal");
        return;
    }

    const btn = byId("save-qr-btn");
    if (btn) btn.disabled = true;
    try {
        const res = await fetch("/api/qr/create", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            if (payload.folder_name) customFolders.add(payload.folder_name);
            loadDashboardData();
            showQRSuccessModal(data, payload);
        } else if (res.status === 401) {
            uiToast("Oturumunuz sona erdi. Lütfen tekrar giriş yapın.");
            pendingQRPayload = payload;
            openModal("auth-modal");
        } else if (!applyServerFieldErrors(data)) {
            uiToast("⚠️ " + (data.error || "Hata oluştu."));
        }
    } catch (err) {
        console.error("QR save error:", err);
        uiToast("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Başlangıç bağları
// ---------------------------------------------------------------------------
function platformFromInputId(id) {
    let m = /^(?:edit-)?vcard-social-([a-z]+)$/.exec(id || "");
    if (m) return m[1];
    if (id === "vcard-primary-social-input") return currentQrType;
    if (id === "edit-vcard-primary-social") return (typeof currentEditQRType !== "undefined") ? currentEditQRType : "";
    return null;
}

function initStudioExtras() {
    // Varsayılan metinleri hatırla (sıfırlama için)
    ["vcard-avatar-status", "comp-logo-status", "pdf-status-text", "pdf-status-subtext", "vcard-card-img-status", "menu-card-img-status"].forEach(id => {
        const el = byId(id); if (el) el.dataset.dflt = el.innerText;
    });

    // Tek, delegasyonlu input dinleyicisi: hata temizle + canlı önizleme
    document.addEventListener("input", (e) => {
        const el = e.target;
        if (!el || !el.closest) return;
        clearFieldError(el);
        const ciIdx = el.getAttribute && el.getAttribute("data-ci");
        if (ciIdx != null && el.getAttribute("data-cf")) {
            const c = companyContacts[Number(ciIdx)];
            if (c) c[el.getAttribute("data-cf")] = el.value;
        }
        if (el.id === "wifi-enc") toggleWifiPass();
        if (el.closest(".studio-grid")) updateLivePreview();
    });

    // Alandan çıkınca: sosyal değerleri normalize et, WhatsApp numarasını doğrula
    document.addEventListener("focusout", (e) => {
        const el = e.target;
        if (!el || !el.id) return;
        const platform = platformFromInputId(el.id);
        if (platform && el.value.trim()) {
            const n = normalizeSocial(platform, el.value);
            if (n) { el.value = n; clearFieldError(el); updateLivePreview(); }
            else showFieldError(el.id, socialErrorText(platform));
        }
        if (el.id === "wa-phone" && el.value.trim()) {
            if (!isValidWaNumber(normalizePhoneForWa(el.value))) showFieldError("wa-phone", "Geçerli bir WhatsApp numarası girin (örn: +90 537 627 44 15).");
            else clearFieldError(el);
        }
    });

    // Yetkili kişiler: silme
    const cc = byId("comp-contacts-container");
    if (cc) cc.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ci-remove]");
        if (b) removeCompanyContact(Number(b.getAttribute("data-ci-remove")));
    });

    // Kilitli QR logo alanı
    const lbl = byId("qr-logo-btn");
    if (lbl) lbl.addEventListener("click", (e) => {
        if (!canUseQrLogo()) { e.preventDefault(); uiToast("🔒 QR ortasına logo eklemek Profesyonel pakette kullanılabilir."); }
    });

    refreshStudioFolderSelect();
    renderCompanyContacts();
    updateLogoLockState();
    applyTypeUI();
}
