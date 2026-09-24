let currentUser = null;
let currentQrType = "url";
let currentCycle = "monthly";
let uploadedPdfUrl = null;

// Cycle Pricing Config (6-Month %20 OFF | Annual %10 OFF)
const CYCLE_PRICES = {
    monthly: {
        starter: '<span style="color: #ffffff; font-weight: 800;">₺199</span>',
        advanced: '<span style="color: #ffffff; font-weight: 800;">₺399</span>',
        business: '<span style="color: #ffffff; font-weight: 800;">₺899</span>',
        subtextStarter: 'Aylık Düzenli Yenilemeli Ödeme',
        subtextAdvanced: 'Aylık Düzenli Yenilemeli Ödeme',
        subtextBusiness: 'Aylık Düzenli Yenilemeli Ödeme'
    },
    semi_annual: {
        starter: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺199</s> <span style="color: #10b981; font-weight: 800;">₺159</span>',
        advanced: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺399</s> <span style="color: #10b981; font-weight: 800;">₺319</span>',
        business: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺899</s> <span style="color: #10b981; font-weight: 800;">₺719</span>',
        subtextStarter: 'Tek Çekim 6 Aylık Toplam: 954 ₺ (Aylık 159 ₺)',
        subtextAdvanced: 'Tek Çekim 6 Aylık Toplam: 1.914 ₺ (Aylık 319 ₺)',
        subtextBusiness: 'Tek Çekim 6 Aylık Toplam: 4.314 ₺ (Aylık 719 ₺)'
    },
    annual: {
        starter: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺199</s> <span style="color: #6366f1; font-weight: 800;">₺179</span>',
        advanced: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺399</s> <span style="color: #6366f1; font-weight: 800;">₺359</span>',
        business: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺899</s> <span style="color: #6366f1; font-weight: 800;">₺809</span>',
        subtextStarter: 'Tek Çekim Yıllık Toplam: 2.148 ₺ (Aylık 179 ₺ - 1 Yıl)',
        subtextAdvanced: 'Tek Çekim Yıllık Toplam: 4.308 ₺ (Aylık 359 ₺ - 1 Yıl)',
        subtextBusiness: 'Tek Çekim Yıllık Toplam: 9.708 ₺ (Aylık 809 ₺ - 1 Yıl)'
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initTypeSelector();
    initColorInputs();
    checkAuthStatus();
    setupForms();
    updateLivePreview();
});

// Color swatch & Hex selector logic
function isColorMatch(c1, c2) {
    if (!c1 || !c2) return false;
    if (c1.trim().toUpperCase() === c2.trim().toUpperCase()) return true;
    try {
        const div = document.createElement('div');
        div.style.color = c1;
        document.body.appendChild(div);
        const rgb1 = getComputedStyle(div).color;
        div.style.color = c2;
        const rgb2 = getComputedStyle(div).color;
        document.body.removeChild(div);
        return rgb1 === rgb2;
    } catch (e) {
        return false;
    }
}

function initColorInputs() {
    const colorFields = ['fill', 'back', 'frame', 'frame-text'];
    colorFields.forEach(field => {
        const input = document.getElementById(`${field}-color`);
        const circle = document.getElementById(`${field}-preview-circle`);
        if (input && circle) {
            input.addEventListener('input', (e) => {
                let val = e.target.value;
                if (val && !val.startsWith('#')) val = '#' + val;
                circle.style.backgroundColor = val;

                // Sync swatches active state
                const group = input.closest('.form-group');
                if (group) {
                    const swatches = group.querySelectorAll('.color-swatch');
                    swatches.forEach(swatch => {
                        const bg = swatch.style.backgroundColor;
                        if (isColorMatch(bg, val)) {
                            swatch.classList.add('active');
                        } else {
                            swatch.classList.remove('active');
                        }
                    });
                }
                updateLivePreview();
            });
        }
    });
}

function selectPresetColor(field, hexColor, element) {
    const input = document.getElementById(`${field}-color`);
    const circle = document.getElementById(`${field}-preview-circle`);
    if (input && circle) {
        input.value = hexColor;
        circle.style.backgroundColor = hexColor;
    }

    // Update active glowing ring on swatches
    if (element) {
        const parent = element.parentElement;
        if (parent) {
            parent.querySelectorAll('.color-swatch').forEach(swatch => swatch.classList.remove('active'));
            element.classList.add('active');
        }
    } else {
        const group = input ? input.closest('.form-group') : null;
        if (group) {
            const swatches = group.querySelectorAll('.color-swatch');
            swatches.forEach(swatch => {
                const bg = swatch.style.backgroundColor;
                if (isColorMatch(bg, hexColor)) {
                    swatch.classList.add('active');
                } else {
                    swatch.classList.remove('active');
                }
            });
        }
    }
    updateLivePreview();
}

// PDF Upload Handler
async function handlePDFUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Lütfen geçerli bir PDF dosyası seçin.');
        return;
    }

    const formData = new FormData();
    formData.append('pdf_file', file);

    const statusText = document.getElementById('pdf-status-text');
    statusText.innerText = 'Yükleniyor... ';

    try {
        const token = localStorage.getItem('jwt_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/upload/pdf', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        const data = await res.json();
        if (data.status === 'success') {
            uploadedPdfUrl = data.pdf_url;
            statusText.innerText = `PDF Yüklendi: ${file.name}`;
            statusText.style.color = '#34d399';
            alert('PDF Menünüz başarıyla yüklendi!');
            updateLivePreview();
        } else {
            alert(data.error || 'PDF yükleme hatası oluştu.');
            statusText.innerText = 'Tıklayın ve PDF Menünüzü Seçin (.pdf)';
        }
    } catch (err) {
        alert('Sunucu bağlantı hatası oluştu.');
        statusText.innerText = 'Tıklayın ve PDF Menünüzü Seçin (.pdf)';
    }
}

// Tab Navigation
function initNavigation() {
    document.querySelectorAll(".nav-link, [data-target]").forEach(link => {
        link.addEventListener("click", (e) => {
            const targetId = link.getAttribute("data-target");
            if (!targetId) return;

            document.querySelectorAll(".page-section").forEach(sec => sec.classList.remove("active"));
            document.querySelectorAll(".nav-link").forEach(nl => nl.classList.remove("active"));

            const targetSec = document.getElementById(targetId);
            if (targetSec) targetSec.classList.add("active");

            const matchingNav = document.querySelector(`.nav-link[data-target="${targetId}"]`);
            if (matchingNav) matchingNav.classList.add("active");

            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    const authBtn = document.getElementById("nav-auth-btn");
    if (authBtn) {
        authBtn.addEventListener("click", handleNavAuthClick);
    }
}

function handleNavAuthClick() {
    if (currentUser) {
        logout();
    } else {
        openModal("auth-modal");
    }
}
window.handleNavAuthClick = handleNavAuthClick;

function filterStudioCategory(category) {
    document.querySelectorAll(".studio-cat-btn").forEach(btn => {
        if (btn.getAttribute("data-cat") === category) {
            btn.classList.add("active");
            btn.style.background = "var(--primary)";
            btn.style.borderColor = "var(--primary)";
            btn.style.color = "#ffffff";
        } else {
            btn.classList.remove("active");
            btn.style.background = "rgba(255, 255, 255, 0.05)";
            btn.style.borderColor = "var(--card-border)";
            btn.style.color = "var(--text-muted)";
        }
    });

    const dynamicGroup = document.getElementById("sec-group-dynamic");
    const staticGroup = document.getElementById("sec-group-static");

    if (category === "all") {
        if (dynamicGroup) dynamicGroup.style.display = "block";
        if (staticGroup) staticGroup.style.display = "block";
    } else if (category === "dynamic") {
        if (dynamicGroup) dynamicGroup.style.display = "block";
        if (staticGroup) staticGroup.style.display = "none";
        const firstDynamic = dynamicGroup ? dynamicGroup.querySelector(".type-btn") : null;
        if (firstDynamic) firstDynamic.click();
    } else if (category === "static") {
        if (dynamicGroup) dynamicGroup.style.display = "none";
        if (staticGroup) staticGroup.style.display = "block";
        const firstStatic = staticGroup ? staticGroup.querySelector(".type-btn") : null;
        if (firstStatic) firstStatic.click();
    }
}

function handlePrimarySocialInput(inputEl) {
    if (!inputEl) return;
    const val = inputEl.value.trim();
    const socialConfigs = {
        instagram: { fieldId: "vcard-social-instagram", prefix: "https://instagram.com/" },
        facebook: { fieldId: "vcard-social-facebook", prefix: "https://facebook.com/" },
        linkedin: { fieldId: "vcard-social-linkedin", prefix: "https://linkedin.com/in/" },
        pinterest: { fieldId: "vcard-social-pinterest", prefix: "https://pinterest.com/" },
        social: { fieldId: "vcard-social-instagram", prefix: "https://instagram.com/" }
    };

    const cfg = socialConfigs[currentQrType] || socialConfigs.instagram;
    const targetEl = document.getElementById(cfg.fieldId);
    if (targetEl) {
        if (val.startsWith("@")) {
            targetEl.value = cfg.prefix + val.substring(1);
        } else {
            targetEl.value = val;
        }
    }
    updateLivePreview();
}

// Type Selector
function initTypeSelector() {
    document.querySelectorAll(".type-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentQrType = btn.getAttribute("data-type");

            document.querySelectorAll(".type-form").forEach(f => f.style.display = "none");

            let formId = `form-${currentQrType}`;
            if (["menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"].includes(currentQrType)) {
                formId = "form-menu";
            } else if (["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook"].includes(currentQrType)) {
                formId = "form-vcard";
            } else if (["dynamic_whatsapp", "whatsapp"].includes(currentQrType)) {
                formId = "form-whatsapp";
            } else if (["url", "static_url"].includes(currentQrType)) {
                formId = "form-url";
            } else if (["wifi"].includes(currentQrType)) {
                formId = "form-wifi";
            } else if (["text", "sms", "phone"].includes(currentQrType)) {
                formId = "form-text";
            }

            const targetForm = document.getElementById(formId);
            if (targetForm) targetForm.style.display = "block";

            // Social platform specific configuration updates
            const socialConfigs = {
                instagram: {
                    title: "📸 Instagram Profil & Sayfa Ayarları",
                    label: "Instagram Profil Linki veya Kullanıcı Adı",
                    placeholder: "instagram.com/kullaniciadi veya @kullaniciadi",
                    hint: "Kullanıcı adınızı (@kullanici) veya direkt profil bağlantınızı yazabilirsiniz.",
                    bg: "rgba(225, 48, 108, 0.12)",
                    border: "rgba(225, 48, 108, 0.35)",
                    color: "#f472b6",
                    fieldId: "vcard-social-instagram"
                },
                facebook: {
                    title: "📘 Facebook Sayfa & Profil Ayarları",
                    label: "Facebook Sayfası veya Profil Linki",
                    placeholder: "facebook.com/sayfaadi",
                    hint: "Facebook sayfa URL'nizi veya profil bağlantınızı girin.",
                    bg: "rgba(24, 119, 242, 0.12)",
                    border: "rgba(24, 119, 242, 0.35)",
                    color: "#60a5fa",
                    fieldId: "vcard-social-facebook"
                },
                linkedin: {
                    title: "💼 LinkedIn Profil & Şirket Sayfası Ayarları",
                    label: "LinkedIn Profil veya Şirket Sayfası Linki",
                    placeholder: "linkedin.com/in/kullaniciadi veya linkedin.com/company/sirketadi",
                    hint: "LinkedIn kişisel veya şirket bağlantınızı girin.",
                    bg: "rgba(10, 102, 194, 0.12)",
                    border: "rgba(10, 102, 194, 0.35)",
                    color: "#38bdf8",
                    fieldId: "vcard-social-linkedin"
                },
                pinterest: {
                    title: "📌 Pinterest Pano & Profil Ayarları",
                    label: "Pinterest Pano veya Profil Linki",
                    placeholder: "pinterest.com/kullaniciadi",
                    hint: "Pinterest profilinizi veya pano bağlantınızı girin.",
                    bg: "rgba(230, 0, 35, 0.12)",
                    border: "rgba(230, 0, 35, 0.35)",
                    color: "#f87171",
                    fieldId: "vcard-social-pinterest"
                },
                social: {
                    title: "🌐 Sosyal Medya Profil & Bağlantı Ayarları",
                    label: "Sosyal Medya Profil / Web Bağlantısı",
                    placeholder: "instagram.com/kullaniciadi veya siteniz.com",
                    hint: "Ana sosyal medya veya profil bağlantınızı girin.",
                    bg: "rgba(129, 140, 248, 0.12)",
                    border: "rgba(129, 140, 248, 0.35)",
                    color: "#a5b4fc",
                    fieldId: "vcard-social-instagram"
                }
            };

            const headingEl = document.getElementById("vcard-form-heading");
            const boxEl = document.getElementById("vcard-primary-social-box");
            const labelEl = document.getElementById("vcard-primary-social-label");
            const inputEl = document.getElementById("vcard-primary-social-input");
            const hintEl = document.getElementById("vcard-primary-social-hint");

            if (socialConfigs[currentQrType]) {
                const cfg = socialConfigs[currentQrType];
                if (headingEl) headingEl.innerText = cfg.title;
                if (boxEl) {
                    boxEl.style.display = "block";
                    boxEl.style.background = cfg.bg;
                    boxEl.style.borderColor = cfg.border;
                }
                if (labelEl) {
                    labelEl.innerText = cfg.label;
                    labelEl.style.color = cfg.color;
                }
                if (inputEl) {
                    inputEl.placeholder = cfg.placeholder;
                    inputEl.style.borderColor = cfg.border;
                    const currentSocialVal = document.getElementById(cfg.fieldId) ? document.getElementById(cfg.fieldId).value : "";
                    inputEl.value = currentSocialVal;
                }
                if (hintEl) hintEl.innerText = cfg.hint;
            } else {
                if (headingEl) headingEl.innerText = currentQrType === "company_card" ? "Kurumsal Kartvizit Bilgileri" : "Dijital Kartvizit Bilgileri";
                if (boxEl) boxEl.style.display = "none";
            }

            // PDF Viewer vs Menu / Catalog form customization
            const menuHeadingEl = document.getElementById("menu-form-heading");
            const menuTitleLabelEl = document.getElementById("menu-title-label");
            const menuTitleInputEl = document.getElementById("menu-title");
            const menuDescLabelEl = document.getElementById("menu-desc-label");
            const menuDescInputEl = document.getElementById("menu-desc");
            const menuPdfLabelEl = document.getElementById("menu-pdf-upload-label");
            const pdfStatusTextEl = document.getElementById("pdf-status-text");
            const pdfStatusSubtextEl = document.getElementById("pdf-status-subtext");
            const directPdfTitleEl = document.getElementById("direct-pdf-label-title");
            const directPdfHintEl = document.getElementById("direct-pdf-label-hint");
            const menuAccHeaderEl = document.getElementById("menu-accordion-header-text");

            if (currentQrType === "pdf_viewer") {
                if (menuHeadingEl) menuHeadingEl.innerText = "📄 PDF Belge Görüntüleyici Ayarları";
                if (menuTitleLabelEl) menuTitleLabelEl.innerText = "Belge / Dosya Adı";
                if (menuTitleInputEl) menuTitleInputEl.placeholder = "Örn: 2026 Ürün Kullanım Kılavuzu & Garanti Belgesi.pdf";
                if (menuDescLabelEl) menuDescLabelEl.innerText = "Belge Açıklaması / Sürüm Notu (İsteğe Bağlı)";
                if (menuDescInputEl) menuDescInputEl.placeholder = "Örn: v2.4 Türkçe Kullanım Talimatları";
                if (menuPdfLabelEl) menuPdfLabelEl.innerText = "PDF Belgenizi Yükleyin (Zorunlu / Gerekli)";
                if (pdfStatusTextEl && !uploadedPdfUrl) pdfStatusTextEl.innerText = "Tıklayın ve PDF Belgenizi Seçin (.pdf)";
                if (pdfStatusSubtextEl) pdfStatusSubtextEl.innerText = "Kullanıcılar QR tarattığında PDF belgenizi doğrudan görüntüler";
                if (directPdfTitleEl) directPdfTitleEl.innerText = "Doğrudan PDF Belgesini Aç (Önerilen)";
                if (directPdfHintEl) directPdfHintEl.innerText = "Aktifleştiğinde kullanıcılar doğrudan PDF belgesini görüntüler.";
                if (menuAccHeaderEl) menuAccHeaderEl.innerText = "Belge Sahibi & İletişim Bilgileri (İsteğe Bağlı)";
            } else if (["menu", "pdf_catalog", "restaurant_menu"].includes(currentQrType)) {
                if (menuHeadingEl) menuHeadingEl.innerText = "📖 Online Katalog & Dijital Menü Ayarları";
                if (menuTitleLabelEl) menuTitleLabelEl.innerText = "İşletme / Katalog / Menü Adı";
                if (menuTitleInputEl) menuTitleInputEl.placeholder = "İşletme / Restoran Adı (Örn: Lezzet Cafe)";
                if (menuDescLabelEl) menuDescLabelEl.innerText = "Menü / Katalog Açıklaması";
                if (menuDescInputEl) menuDescInputEl.placeholder = "Kısa slogan veya bilgilendirme metni";
                if (menuPdfLabelEl) menuPdfLabelEl.innerText = "PDF Menü / Katalog Dosyası Yükleyin (İsteğe Bağlı)";
                if (pdfStatusTextEl && !uploadedPdfUrl) pdfStatusTextEl.innerText = "Tıklayın ve PDF Menü/Kataloğunuzu Seçin (.pdf)";
                if (pdfStatusSubtextEl) pdfStatusSubtextEl.innerText = "Müşterileriniz QR tarattığında hazırladığınız PDF menüyü/kataloğu görüntüler";
                if (directPdfTitleEl) directPdfTitleEl.innerText = "Doğrudan PDF Yönlendirmesi";
                if (directPdfHintEl) directPdfHintEl.innerText = "Aktifleştiğinde kullanıcılar herhangi bir sayfa görmez, doğrudan PDF dosyasına yönlendirilir.";
                if (menuAccHeaderEl) menuAccHeaderEl.innerText = "İşletme & İletişim Bilgileri (İsteğe Bağlı Kartvizit)";
            }

            // Automatically switch phone simulator to landing page mode for rich types
            if (["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook", "menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"].includes(currentQrType)) {
                switchPreviewMode("landing");
            } else {
                switchPreviewMode("qr");
            }

            updateLivePreview();
        });
    });

    // Input change listeners for live QR render
    document.querySelectorAll("input, select, textarea").forEach(el => {
        el.addEventListener("input", updateLivePreview);
    });
}

let currentPreviewMode = 'qr';

function switchPreviewMode(mode) {
    currentPreviewMode = mode;
    const qrTab = document.getElementById("tab-preview-qr");
    const landingTab = document.getElementById("tab-preview-landing");
    const qrBox = document.getElementById("preview-mode-qr-box");
    const landingBox = document.getElementById("preview-mode-landing-box");

    if (!qrTab || !landingTab) return;

    if (mode === 'qr') {
        qrTab.style.background = "var(--primary)";
        qrTab.style.color = "#ffffff";
        landingTab.style.background = "transparent";
        landingTab.style.color = "var(--text-muted)";
        qrBox.style.display = "flex";
        landingBox.style.display = "none";
    } else {
        landingTab.style.background = "var(--primary)";
        landingTab.style.color = "#ffffff";
        qrTab.style.background = "transparent";
        qrTab.style.color = "var(--text-muted)";
        if (landingBox) landingBox.style.display = "flex";
        qrBox.style.display = "none";
        renderLandingPageMockup();
    }
}

function downloadSimulatorVcard() {
    const payload = getQRFormPayload();
    const v = payload.vcard_payload || {};
    const name = v.full_name || 'Kişi Kartı';
    const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN;CHARSET=UTF-8:${name}`,
        `N;CHARSET=UTF-8:${name};;;;`,
    ];
    if (v.title) lines.push(`TITLE;CHARSET=UTF-8:${v.title}`);
    if (v.company) lines.push(`ORG;CHARSET=UTF-8:${v.company}`);
    if (v.phone) lines.push(`TEL;TYPE=CELL:${v.phone}`);
    if (v.phone2) lines.push(`TEL;TYPE=WORK:${v.phone2}`);
    if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${v.email}`);
    if (v.website) lines.push(`URL:${v.website}`);
    if (v.address) lines.push(`ADR;CHARSET=UTF-8:;;${v.address};;;;`);
    if (v.bio) lines.push(`NOTE;CHARSET=UTF-8:${v.bio}`);
    lines.push("END:VCARD");

    const vcfText = lines.join("\r\n");
    const blob = new Blob([vcfText], { type: "text/vcard;charset=utf-8" });
    const link = document.createElement("a");
    const safeName = name.replace(/\s+/g, '_');
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderLandingPageMockup() {
    const payload = getQRFormPayload();
    const container = document.getElementById("mockup-landing-content");
    if (!container) return;

    const wrapperStart = `
        <div style="width: 100%; min-height: 100%; box-sizing: border-box; background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 24px 16px 20px 16px; display: flex; flex-direction: column; justify-content: space-between; border-radius: 26px;">
            <div style="width: 100%;">
    `;
    const wrapperEnd = `
            </div>
            <div style="text-align: center; margin-top: auto; padding-top: 20px; font-size: 11px; color: #64748b; font-weight: 500;">
                Powered by <strong style="color: #818cf8;">Dijitalgru QR Studio</strong>
            </div>
        </div>
    `;

    if (payload.type === "vcard" || payload.type === "static_vcard") {
        const v = payload.vcard_payload || {};
        const fullName = v.full_name || 'Ad Soyad';
        const avatarSrc = v.avatar_url;
        const initial = (fullName.trim()[0] || 'A').toUpperCase();

        let avatarHTML = `<div style="width: 76px; height: 76px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; color: #fff; margin: 0 auto 12px auto; box-shadow: 0 0 25px rgba(99, 102, 241, 0.5); border: 2px solid rgba(255,255,255,0.2);">${initial}</div>`;
        if (avatarSrc) {
            avatarHTML = `
                <div style="position: relative; width: 76px; height: 76px; margin: 0 auto 12px auto;">
                    <img src="${avatarSrc}" onerror="this.style.display='none'; document.getElementById('avatar-fallback-sim').style.display='flex';" style="width: 76px; height: 76px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 25px rgba(99, 102, 241, 0.5); border: 2px solid #6366f1; display: block;" />
                    <div id="avatar-fallback-sim" style="display: none; position: absolute; top:0; left:0; width: 76px; height: 76px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; color: #fff; box-shadow: 0 0 25px rgba(99, 102, 241, 0.5); border: 2px solid rgba(255,255,255,0.2);">${initial}</div>
                </div>
            `;
        }

        let quickActionsHTML = '<div style="display: flex; gap: 6px; justify-content: center; margin-bottom: 16px;">';
        if (v.phone) {
            quickActionsHTML += `
                <a href="#" onclick="event.preventDefault()" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #ffffff; text-decoration: none; font-size: 10px; font-weight: 700;">
                    <span style="font-size: 16px;">📞</span>
                    <span>Arama</span>
                </a>
                <a href="#" onclick="event.preventDefault()" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; color: #34d399; text-decoration: none; font-size: 10px; font-weight: 700;">
                    <span style="font-size: 16px;">💬</span>
                    <span>WhatsApp</span>
                </a>
            `;
        }
        if (v.email) {
            quickActionsHTML += `
                <a href="#" onclick="event.preventDefault()" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; color: #a5b4fc; text-decoration: none; font-size: 10px; font-weight: 700;">
                    <span style="font-size: 16px;">✉️</span>
                    <span>E-posta</span>
                </a>
            `;
        }
        if (v.website) {
            quickActionsHTML += `
                <a href="#" onclick="event.preventDefault()" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); border-radius: 12px; color: #06b6d4; text-decoration: none; font-size: 10px; font-weight: 700;">
                    <span style="font-size: 16px;">🌐</span>
                    <span>Web Site</span>
                </a>
            `;
        }
        quickActionsHTML += '</div>';

        let detailsListHTML = '<div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">';
        if (v.phone) {
            detailsListHTML += `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
                    <div style="font-size: 14px; width: 28px; height: 28px; background: rgba(99,102,241,0.15); color: #818cf8; border-radius: 8px; display: flex; align-items: center; justify-content: center; shrink: 0;">📱</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Cep Telefonu</div>
                        <div style="font-size: 12px; font-weight: 600; color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${v.phone}</div>
                    </div>
                </div>
            `;
        }
        if (v.phone2) {
            detailsListHTML += `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
                    <div style="font-size: 14px; width: 28px; height: 28px; background: rgba(59,130,246,0.15); color: #60a5fa; border-radius: 8px; display: flex; align-items: center; justify-content: center; shrink: 0;">🏢</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">İş Telefonu</div>
                        <div style="font-size: 12px; font-weight: 600; color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${v.phone2}</div>
                    </div>
                </div>
            `;
        }
        if (v.email) {
            detailsListHTML += `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
                    <div style="font-size: 14px; width: 28px; height: 28px; background: rgba(236,72,153,0.15); color: #f472b6; border-radius: 8px; display: flex; align-items: center; justify-content: center; shrink: 0;">✉️</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">E-posta Adresi</div>
                        <div style="font-size: 12px; font-weight: 600; color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${v.email}</div>
                    </div>
                </div>
            `;
        }
        if (v.website) {
            detailsListHTML += `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
                    <div style="font-size: 14px; width: 28px; height: 28px; background: rgba(6,182,212,0.15); color: #22d3ee; border-radius: 8px; display: flex; align-items: center; justify-content: center; shrink: 0;">🌐</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Web Sitesi</div>
                        <div style="font-size: 12px; font-weight: 600; color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${v.website}</div>
                    </div>
                </div>
            `;
        }
        if (v.address) {
            detailsListHTML += `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
                    <div style="font-size: 14px; width: 28px; height: 28px; background: rgba(245,158,11,0.15); color: #fbbf24; border-radius: 8px; display: flex; align-items: center; justify-content: center; shrink: 0;">📍</div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Adres / Şehir</div>
                        <div style="font-size: 12px; font-weight: 600; color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${v.address}</div>
                    </div>
                </div>
            `;
        }
        detailsListHTML += '</div>';

        container.innerHTML = `
            ${wrapperStart}
                ${avatarHTML}
                <div style="font-size: 18px; font-weight: 800; color: #ffffff; text-align: center;">${fullName}</div>
                <div style="font-size: 12px; color: #818cf8; margin-top: 2px; font-weight: 600; text-align: center;">${v.title || 'Unvan'}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px; font-weight: 500; text-align: center;">${v.company || 'Şirket Adı'}</div>
                ${v.bio ? `<div style="font-size: 11px; color: #cbd5e1; margin-top: 10px; line-height: 1.4; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); text-align: left;">📝 ${v.bio}</div>` : ''}

                <button type="button" onclick="downloadSimulatorVcard()" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px; border-radius: 14px; font-size: 13px; font-weight: 800; color: #ffffff; border: none; background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); margin: 16px 0 12px 0; cursor: pointer; transition: all 0.2s ease;">
                    👤 Rehbere Kaydet (.vcf)
                </button>

                ${v.phone || v.email || v.website ? quickActionsHTML : ''}
                ${v.phone || v.phone2 || v.email || v.website || v.address ? detailsListHTML : ''}

                ${v.direct_redirect ? '<div style="font-size: 10px; color: #f59e0b; margin-top: 12px; font-weight: 700; background: rgba(245,158,11,0.1); padding: 6px; border-radius: 8px; text-align: center;">⚡ Doğrudan .vcf İndirme Aktif</div>' : ''}
            ${wrapperEnd}
        `;
    } else if (payload.type === "company_card") {
        const cName = getVal("comp-name", "Kurumsal Şirket Adı");
        const cTagline = getVal("comp-tagline", "Kurumsal Vizyon & Slogan");
        container.innerHTML = `
            ${wrapperStart}
                <div style="text-align: center; padding-top: 10px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; margin: 0 auto 12px auto; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);">🏢</div>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${cName}</div>
                    <div style="font-size: 12px; color: #60a5fa; margin-top: 4px; font-weight: 600;">${cTagline}</div>
                </div>
            ${wrapperEnd}
        `;
    } else if (payload.type === "social" || payload.type === "instagram" || payload.type === "linkedin" || payload.type === "pinterest" || payload.type === "facebook") {
        const title = payload.type.toUpperCase();
        container.innerHTML = `
            ${wrapperStart}
                <div style="text-align: center; padding-top: 10px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #ec4899, #8b5cf6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; margin: 0 auto 12px auto; box-shadow: 0 4px 20px rgba(236, 72, 153, 0.4);">📲</div>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${title} Profili</div>
                    <div style="font-size: 12px; color: #f472b6; margin-top: 4px; font-weight: 600;">Sosyal Medya Bağlantıları</div>
                </div>
            ${wrapperEnd}
        `;
    } else if (payload.type === "menu" || payload.type === "restaurant_menu" || payload.type === "pdf_catalog" || payload.type === "pdf_viewer") {
        const m = payload.menu_payload || {};
        container.innerHTML = `
            ${wrapperStart}
                <div style="text-align: center; padding-top: 10px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; margin: 0 auto 12px auto; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);">📖</div>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${m.title || 'Restoran & Menü'}</div>
                    <div style="font-size: 12px; color: #fbbf24; margin-top: 4px; font-weight: 600;">${m.description || 'Dijital Menümüz ve Lezzetlerimiz'}</div>
                    ${m.pdf_url ? '<div style="margin-top: 16px; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); padding: 12px; border-radius: 12px; font-size: 12px; color: #a5b4fc; font-weight: 700;">📄 PDF Menü Yüklendi</div>' : '<div style="margin-top: 16px; font-size: 11px; color: #94a3b8;">PDF Menü İnceleyin</div>'}
                </div>
            ${wrapperEnd}
        `;
    } else if (payload.type === "wifi") {
        const ssid = getVal("wifi-ssid", "Wi-Fi Ağ Adı");
        container.innerHTML = `
            ${wrapperStart}
                <div style="text-align: center; padding-top: 20px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; margin: 0 auto 14px auto; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);">📶</div>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${ssid}</div>
                    <div style="font-size: 12px; color: #34d399; margin-top: 6px; font-weight: 700;">Kamera ile Otomatik Bağlantı</div>
                </div>
            ${wrapperEnd}
        `;
    } else if (payload.type === "text") {
        const textVal = getVal("static-text", "Sabit Metin İçeriği");
        container.innerHTML = `
            ${wrapperStart}
                <div style="text-align: center; padding-top: 20px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; margin: 0 auto 14px auto; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">📝</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: pre-wrap; word-break: break-word;">${textVal}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 10px; font-weight: 600;">📌 Statik Veri</div>
                </div>
            ${wrapperEnd}
        `;
    } else {
        container.innerHTML = `
            ${wrapperStart}
                <div style="text-align: center; padding-top: 20px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; margin: 0 auto 14px auto; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">🌐</div>
                    <div style="font-size: 15px; font-weight: 800; color: #ffffff; word-break: break-all;">${payload.target_url || 'https://siteniz.com'}</div>
                    <div style="font-size: 12px; color: #10b981; margin-top: 8px; font-weight: 600;">⚡ Doğrudan Web Yönlendirmesi</div>
                </div>
            ${wrapperEnd}
        `;
    }
}

// Live Preview Updater
async function updateLivePreview() {
    const payload = getQRFormPayload();
    let previewText = "";

    if (["url", "static_url"].includes(payload.type)) {
        previewText = getVal("target-url", "");
    } else if (["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook"].includes(payload.type)) {
        const v = payload.vcard_payload || {};
        previewText = `BEGIN:VCARD\nVERSION:3.0\nN:${v.full_name || 'Isim'}\nTEL:${v.phone || ''}\nEMAIL:${v.email || ''}\nEND:VCARD`;
    } else if (["menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"].includes(payload.type)) {
        previewText = payload.menu_payload?.pdf_url || "https://qrdijitalgru.com/menu";
    } else if (payload.type === "wifi") {
        const ssid = getVal("wifi-ssid", "Dijitalgru_Wifi");
        const pass = getVal("wifi-pass", "12345678");
        previewText = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
    } else if (["whatsapp", "dynamic_whatsapp"].includes(payload.type)) {
        const phone = getVal("wa-phone", "905000000000");
        const msg = encodeURIComponent(getVal("wa-msg", "Merhaba, bilgi almak istiyorum."));
        previewText = `https://wa.me/${phone}?text=${msg}`;
    } else if (["text", "sms", "phone"].includes(payload.type)) {
        previewText = getVal("static-text", "Dijitalgru QR Studio");
    }

    // Representative sample QR fallback when input is empty
    if (!previewText || previewText.trim() === "") {
        previewText = "https://qrdijitalgru.com";
    }

    // Update frame label text
    const frameLabel = document.getElementById("preview-frame-text-label");
    if (frameLabel) {
        frameLabel.innerText = payload.settings?.frame_text || "Beni Tara!";
        frameLabel.style.color = payload.settings?.frame_text_color || "#a5b4fc";
    }

    renderLandingPageMockup();

    try {
        const res = await fetch("/api/qr/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: previewText, settings: payload.settings })
        });
        const data = await res.json();
        const imgUrl = data.qr_image || data.image;
        if (imgUrl) {
            const previewImgEl = document.getElementById("preview-qr-img");
            if (previewImgEl) previewImgEl.src = imgUrl;
        }
    } catch (err) {
        console.error("Preview error:", err);
    }
}

function normalizeUrlInput(val) {
    if (!val) return "";
    let str = String(val).trim();
    if (!str) return "";
    if (!/^https?:\/\//i.test(str) && !/^\/\//i.test(str) && !/^mailto:/i.test(str) && !/^tel:/i.test(str) && !/^data:/i.test(str)) {
        return "https://" + str;
    }
    return str;
}

function getVal(id, defaultVal = "") {
    const el = document.getElementById(id);
    return el ? (el.value !== undefined ? el.value : defaultVal) : defaultVal;
}

let uploadedVcardAvatarUrl = "";
let selectedVCardTheme = "midnight";
let selectedVCardPrimaryColor = "#6366f1";
let editSelectedVCardTheme = "midnight";
let editSelectedVCardPrimaryColor = "#6366f1";

function selectVCardTheme(themeKey, btnElem) {
    selectedVCardTheme = themeKey;
    const container = document.getElementById("vcard-theme-presets-grid");
    if (container) {
        container.querySelectorAll("button").forEach(b => {
            b.style.borderColor = "rgba(255,255,255,0.12)";
            b.style.transform = "none";
        });
    }
    if (btnElem) {
        btnElem.style.borderColor = "#6366f1";
        btnElem.style.transform = "translateY(-2px)";
    }
}

function updateVCardPrimaryColor(colorVal) {
    selectedVCardPrimaryColor = colorVal;
    const picker = document.getElementById("vcard-primary-color");
    if (picker) picker.value = colorVal;
}

function selectVCardAccentPreset(colorVal, swatchElem) {
    updateVCardPrimaryColor(colorVal);
}

function getVCardThemeSettings() {
    const colorPicker = document.getElementById("vcard-primary-color");
    const colorVal = colorPicker ? colorPicker.value : selectedVCardPrimaryColor;
    return JSON.stringify({
        theme: selectedVCardTheme || "midnight",
        primary_color: colorVal || "#6366f1"
    });
}

let cropRawImage = null;
let cropCanvas = null;
let cropCtx = null;
let cropScale = 1.0;
let cropOffsetX = 0;
let cropOffsetY = 0;
let isDraggingCrop = false;
let startDragX = 0;
let startDragY = 0;

function openAvatarCropModal(fileOrSrc) {
    cropCanvas = document.getElementById("avatar-crop-canvas");
    if (!cropCanvas) return;
    cropCtx = cropCanvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
        cropRawImage = img;
        cropScale = 1.0;
        cropOffsetX = 0;
        cropOffsetY = 0;
        
        const slider = document.getElementById("crop-zoom-slider");
        if (slider) slider.value = 1.0;
        const label = document.getElementById("crop-zoom-label");
        if (label) label.innerText = "1.0x";

        drawCropCanvas();
        openModal("avatar-crop-modal");
    };

    let targetSrc = fileOrSrc;
    if (!targetSrc || typeof targetSrc !== "string") {
        targetSrc = uploadedVcardAvatarUrl || getVal("vcard-avatar-url", "");
    }
    if (targetSrc) img.src = targetSrc;
}

function drawCropCanvas() {
    if (!cropRawImage || !cropCtx) return;

    const cw = cropCanvas.width; // 260
    const ch = cropCanvas.height; // 260
    cropCtx.clearRect(0, 0, cw, ch);

    // Calculate aspect fill dimensions
    const imgAspect = cropRawImage.width / cropRawImage.height;
    let baseW = cw;
    let baseH = ch;

    if (imgAspect > 1) {
        baseH = cw / imgAspect;
    } else {
        baseW = ch * imgAspect;
    }

    const renderW = baseW * cropScale;
    const renderH = baseH * cropScale;

    const centerX = (cw - renderW) / 2 + cropOffsetX;
    const centerY = (ch - renderH) / 2 + cropOffsetY;

    cropCtx.drawImage(cropRawImage, centerX, centerY, renderW, renderH);
}

function updateCropCanvasZoom(val) {
    cropScale = parseFloat(val);
    const label = document.getElementById("crop-zoom-label");
    if (label) label.innerText = `${cropScale.toFixed(1)}x`;
    drawCropCanvas();
}

function initCropCanvasEvents() {
    const wrapper = document.getElementById("crop-canvas-wrapper");
    if (!wrapper) return;

    const startDrag = (e) => {
        isDraggingCrop = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startDragX = clientX - cropOffsetX;
        startDragY = clientY - cropOffsetY;
    };

    const doDrag = (e) => {
        if (!isDraggingCrop) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        cropOffsetX = clientX - startDragX;
        cropOffsetY = clientY - startDragY;
        drawCropCanvas();
    };

    const stopDrag = () => {
        isDraggingCrop = false;
    };

    wrapper.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", doDrag);
    window.addEventListener("mouseup", stopDrag);

    wrapper.addEventListener("touchstart", startDrag, { passive: true });
    window.addEventListener("touchmove", doDrag, { passive: true });
    window.addEventListener("touchend", stopDrag);
}

async function applyAvatarCrop() {
    if (!cropCanvas || !cropRawImage) return;
    
    // Render high-res 300x300 cropped PNG
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 300;
    exportCanvas.height = 300;
    const expCtx = exportCanvas.getContext("2d");

    // Clip to circle
    expCtx.beginPath();
    expCtx.arc(150, 150, 150, 0, Math.PI * 2);
    expCtx.clip();

    // Draw scaled/offset image
    const cw = 300;
    const ch = 300;
    const imgAspect = cropRawImage.width / cropRawImage.height;
    let baseW = cw;
    let baseH = ch;

    if (imgAspect > 1) {
        baseH = cw / imgAspect;
    } else {
        baseW = ch * imgAspect;
    }

    const scaleFactor = 300 / 260;
    const renderW = baseW * cropScale;
    const renderH = baseH * cropScale;
    const centerX = (cw - renderW) / 2 + (cropOffsetX * scaleFactor);
    const centerY = (ch - renderH) / 2 + (cropOffsetY * scaleFactor);

    expCtx.drawImage(cropRawImage, centerX, centerY, renderW, renderH);

    const croppedDataUrl = exportCanvas.toDataURL("image/png");
    uploadedVcardAvatarUrl = croppedDataUrl;

    const hiddenInput = document.getElementById("vcard-avatar-url");
    if (hiddenInput) hiddenInput.value = croppedDataUrl;

    const cropBtn = document.getElementById("vcard-avatar-crop-btn");
    const removeBtn = document.getElementById("vcard-avatar-remove-btn");
    if (cropBtn) cropBtn.style.display = "inline-block";
    if (removeBtn) removeBtn.style.display = "inline-block";

    updateLivePreview();
    closeModal("avatar-crop-modal");

    // Upload cropped blob to cloud API backend
    try {
        exportCanvas.toBlob(async (blob) => {
            if (!blob) return;
            const formData = new FormData();
            formData.append("avatar_file", blob, "cropped_avatar.png");
            const token = localStorage.getItem("jwt_token");
            const headers = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/upload/avatar", {
                method: "POST",
                headers: headers,
                body: formData
            });
            const data = await res.json();
            if (data.status === "success" && data.avatar_url) {
                uploadedVcardAvatarUrl = data.avatar_url;
                if (hiddenInput) hiddenInput.value = data.avatar_url;
                updateLivePreview();
            }
        }, "image/png");
    } catch (err) {
        console.error("Cloud crop upload error:", err);
    }
}

async function handleVcardAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const statusText = document.getElementById("vcard-avatar-status");
    const btnText = document.getElementById("vcard-avatar-btn-text");
    const cropBtn = document.getElementById("vcard-avatar-crop-btn");
    const removeBtn = document.getElementById("vcard-avatar-remove-btn");
    const hiddenInput = document.getElementById("vcard-avatar-url");

    if (statusText) {
        statusText.innerText = "⏳ Fotoğraf işleniyor...";
        statusText.style.color = "#f59e0b";
    }

    // 1. Immediate Base64 local preview
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedVcardAvatarUrl = e.target.result;
        if (hiddenInput) hiddenInput.value = uploadedVcardAvatarUrl;
        if (btnText) btnText.innerText = `✓ ${file.name.substring(0, 14)}`;
        if (cropBtn) cropBtn.style.display = "inline-block";
        if (removeBtn) removeBtn.style.display = "inline-block";
        
        // Auto open crop modal for positioning & zoom adjustment
        openAvatarCropModal(e.target.result);
        updateLivePreview();
    };
    reader.readAsDataURL(file);

    // 2. Upload to Cloud API Endpoint (/api/upload/avatar)
    try {
        const formData = new FormData();
        formData.append("avatar_file", file);

        const token = localStorage.getItem("jwt_token");
        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/upload/avatar", {
            method: "POST",
            headers: headers,
            body: formData
        });

        const data = await res.json();
        if (data.status === "success" && data.avatar_url) {
            if (!hiddenInput.value.startsWith("data:image")) {
                uploadedVcardAvatarUrl = data.avatar_url;
                if (hiddenInput) hiddenInput.value = uploadedVcardAvatarUrl;
            }
            if (statusText) {
                statusText.innerText = "✅ Fotoğraf hazır. (Dilerseniz 'Konumlandır & Kırp' butonu ile sürükleyip zoom yapabilirsiniz)";
                statusText.style.color = "#34d399";
            }
            updateLivePreview();
        } else {
            console.error("Avatar upload API error:", data.error);
        }
    } catch (err) {
        console.error("Avatar upload network error:", err);
    }
}

function removeVcardAvatar() {
    uploadedVcardAvatarUrl = "";
    const hiddenInput = document.getElementById("vcard-avatar-url");
    const fileInput = document.getElementById("vcard-avatar-file");
    const btnText = document.getElementById("vcard-avatar-btn-text");
    const cropBtn = document.getElementById("vcard-avatar-crop-btn");
    const removeBtn = document.getElementById("vcard-avatar-remove-btn");
    const statusText = document.getElementById("vcard-avatar-status");

    if (hiddenInput) hiddenInput.value = "";
    if (fileInput) fileInput.value = "";
    if (btnText) btnText.innerText = "Profil Fotoğrafı Seç / Yükle";
    if (cropBtn) cropBtn.style.display = "none";
    if (removeBtn) removeBtn.style.display = "none";
    if (statusText) {
        statusText.innerText = "Fotoğraf kaldırıldı. Baş harf ikonu varsayılan olarak gösterilecek.";
        statusText.style.color = "var(--text-muted)";
    }
    updateLivePreview();
}

function getQRFormPayload() {
    const title = getVal("qr-title", "Benim QR Kodum");
    const settings = {
        fill_color: getVal("fill-color", "#4F46E5"),
        back_color: getVal("back-color", "#FFFFFF"),
        frame_style: getVal("frame-style", "card"),
        frame_text: getVal("frame-text", "Beni Tara!"),
        frame_color: getVal("frame-color", "#4F46E5"),
        frame_text_color: getVal("frame-text-color", "#FFFFFF")
    };

    let target_url = "";
    let vcard_payload = null;
    let menu_payload = null;

    if (["url", "static_url"].includes(currentQrType)) {
        target_url = normalizeUrlInput(getVal("target-url", "https://qrdijitalgru.com"));
    } else if (["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook"].includes(currentQrType)) {
        const directVcardEl = document.getElementById("direct-vcard-redirect");
        vcard_payload = {
            full_name: getVal("vcard-name", "Ad Soyad"),
            title: getVal("vcard-title", "Unvan"),
            company: getVal("vcard-company", "Şirket Adı"),
            phone: getVal("vcard-phone", "+90 5XX XXX XX XX"),
            phone2: getVal("vcard-phone2", ""),
            email: getVal("vcard-email", "eposta@sirketiniz.com"),
            website: normalizeUrlInput(getVal("vcard-website", "")),
            address: getVal("vcard-address", "İstanbul, Türkiye"),
            bio: getVal("vcard-bio", ""),
            avatar_url: normalizeUrlInput(getVal("vcard-avatar-url", "")),
            card_image_url: normalizeUrlInput(getVal("vcard-card-image-url", "")),
            social_links: {
                instagram: normalizeUrlInput(getVal("vcard-social-instagram", "")),
                linkedin: normalizeUrlInput(getVal("vcard-social-linkedin", "")),
                twitter: normalizeUrlInput(getVal("vcard-social-twitter", "")),
                facebook: normalizeUrlInput(getVal("vcard-social-facebook", "")),
                youtube: normalizeUrlInput(getVal("vcard-social-youtube", "")),
                tiktok: normalizeUrlInput(getVal("vcard-social-tiktok", "")),
                pinterest: normalizeUrlInput(getVal("vcard-social-pinterest", ""))
            },
            theme_settings: getVCardThemeSettings(),
            direct_redirect: directVcardEl ? directVcardEl.checked : false
        };
    } else if (["menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"].includes(currentQrType)) {
        const directPdfEl = document.getElementById("direct-pdf-redirect");
        menu_payload = {
            title: getVal("menu-title", "Restoran / İşletme Adı"),
            description: getVal("menu-desc", "Menümüz ve Lezzetlerimiz"),
            pdf_url: uploadedPdfUrl,
            direct_redirect: directPdfEl ? directPdfEl.checked : true,
            contact_name: getVal("menu-contact-name", ""),
            contact_title: getVal("menu-contact-title", ""),
            phone: getVal("menu-phone", ""),
            phone2: getVal("menu-phone2", ""),
            email: getVal("menu-email", ""),
            website: normalizeUrlInput(getVal("menu-website", "")),
            address: getVal("menu-address", ""),
            card_image_url: getVal("menu-card-image-url", ""),
            categories: [
                {
                    name: "Menü Kategori 1",
                    items: [
                        { name: "Ürün 1", desc: "Ürün açıklaması", price: "100" }
                    ]
                }
            ]
        };
    } else if (currentQrType === "wifi") {
        const ssid = getVal("wifi-ssid", "Misafir_Wifi");
        const pass = getVal("wifi-pass", "12345678");
        target_url = `WIFI:S:${ssid};T:WPA;P:${pass};;`;
    } else if (["whatsapp", "dynamic_whatsapp"].includes(currentQrType)) {
        const phone = getVal("wa-phone", "905000000000");
        const msg = encodeURIComponent(getVal("wa-msg", "Merhaba, bilgi almak istiyorum."));
        target_url = `https://wa.me/${phone}?text=${msg}`;
    } else if (["text", "sms", "phone"].includes(currentQrType)) {
        target_url = getVal("static-text", "Dijitalgru QR Studio");
    }

    return {
        title,
        type: currentQrType,
        target_url,
        settings,
        vcard_payload,
        menu_payload,
        folder_name: getSelectedFolderName()
    };
}

// Auth Status Check
async function checkAuthStatus() {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        setUserLoggedOut();
        return;
    }

    try {
        const res = await fetch("/api/auth/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            setUserLoggedIn();
            loadDashboardData();
        } else {
            setUserLoggedOut();
        }
    } catch (err) {
        setUserLoggedOut();
    }
}

function setUserLoggedIn() {
    document.getElementById("nav-auth-btn").innerText = `Çıkış Yap (${currentUser.name})`;
    document.getElementById("nav-dash-link").style.display = "inline-block";
}

function setUserLoggedOut() {
    currentUser = null;
    localStorage.removeItem("jwt_token");
    document.getElementById("nav-auth-btn").innerText = "Giriş Yap / Kaydol";
    document.getElementById("nav-dash-link").style.display = "none";
}

function logout() {
    setUserLoggedOut();
    alert("Başarıyla çıkış yapıldı.");
    window.location.reload();
}

let pendingQRPayload = null;

async function processPendingQRPurchaseOrSave(token) {
    if (!pendingQRPayload) return false;

    const payload = pendingQRPayload;
    pendingQRPayload = null; // Clear immediately to prevent duplicate submissions

    try {
        const res = await fetch("/api/qr/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            alert(" Hesabınız oluşturuldu ve hazırladığınız QR kod başarıyla hesabınıza kaydedildi!");
            loadDashboardData();
            
            // Switch active view to Dashboard Tab
            document.querySelectorAll(".page-section").forEach(sec => sec.classList.remove("active"));
            document.querySelectorAll(".nav-link").forEach(nl => nl.classList.remove("active"));
            
            const dashSec = document.getElementById("dashboard-tab");
            if (dashSec) dashSec.classList.add("active");
            
            const dashLink = document.getElementById("nav-dash-link");
            if (dashLink) {
                dashLink.style.display = "inline-block";
                dashLink.classList.add("active");
            }
            return true;
        } else {
            alert("QR Kod kaydedilirken hata oluştu: " + (data.error || "Bilinmeyen hata"));
            return false;
        }
    } catch (err) {
        console.error("Pending QR save error:", err);
        return false;
    }
}

// Forms Submission
function setupForms() {
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Giriş Yapılıyor...";
        }
        try {
            const emailInput = document.getElementById("login-email");
            const passInput = document.getElementById("login-password");
            const cleanEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";
            const cleanPass = passInput ? passInput.value : "";

            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: cleanEmail,
                    password: cleanPass
                })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("jwt_token", data.token);
                const savedPending = await processPendingQRPurchaseOrSave(data.token);
                closeModal("auth-modal");
                checkAuthStatus();
                if (!savedPending) {
                    alert("✅ Giriş başarılı!");
                }
            } else {
                alert("❌ " + (data.error || "Giriş hatası. Lütfen e-posta ve şifrenizi kontrol edin."));
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("Sunucuya bağlanırken bir hata oluştu.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Giriş Yap";
            }
        }
    });

    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Kayıt Yapılıyor...";
        }
        try {
            const nameInput = document.getElementById("reg-name");
            const emailInput = document.getElementById("reg-email");
            const passInput = document.getElementById("reg-password");

            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nameInput ? nameInput.value.trim() : "",
                    email: emailInput ? emailInput.value.trim().toLowerCase() : "",
                    password: passInput ? passInput.value : ""
                })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem("jwt_token", data.token);
                const savedPending = await processPendingQRPurchaseOrSave(data.token);
                closeModal("auth-modal");
                checkAuthStatus();
                if (!savedPending) {
                    alert("✅ Kayıt başarılı! Hesabınız oluşturuldu.");
                }
            } else {
                alert("❌ " + (data.error || "Kayıt hatası oluştu."));
            }
        } catch (err) {
            console.error("Register error:", err);
            alert("Sunucuya bağlanırken bir hata oluştu.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Ücretsiz Üye Ol";
            }
        }
    });

    document.getElementById("save-qr-btn").addEventListener("click", async () => {
        const token = localStorage.getItem("jwt_token");
        const payload = getQRFormPayload();

        if (!token) {
            pendingQRPayload = payload; // Temporarily store draft in memory
            alert("QR Kodunuzu hesabınıza kaydetmek için lütfen ücretsiz üye olun veya giriş yapın.");
            openModal("auth-modal");
            return;
        }

        const res = await fetch("/api/qr/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            alert(" QR Kodunuz başarıyla hesabınıza kaydedildi!");
            loadDashboardData();
            document.getElementById("nav-dash-link").click();
        } else {
            alert(data.error || "Hata oluştu.");
        }
    });
}

let allQRCodes = [];
let currentStatusFilter = "all";
let currentFolderFilter = "all";

function toggleCustomFolderInput(val) {
    const input = document.getElementById("custom-folder-input");
    if (input) {
        input.style.display = val === "__new__" ? "block" : "none";
        if (val === "__new__") input.focus();
    }
}

function getSelectedFolderName() {
    const selectEl = document.getElementById("qr-folder");
    if (!selectEl) return "Genel";
    if (selectEl.value === "__new__") {
        const customInput = document.getElementById("custom-folder-input");
        return (customInput && customInput.value.trim()) ? customInput.value.trim() : "Genel";
    }
    return selectEl.value || "Genel";
}

function getCardFolderSelectOptionsHTML(currentFolder, codes) {
    const defaultFolders = ["Genel", "Restoran Menüleri", "Kartvizitler", "Etkinlikler"];
    const existingFolders = new Set(defaultFolders);
    if (currentFolder) existingFolders.add(currentFolder);
    (codes || []).forEach(qr => {
        if (qr.folder_name) existingFolders.add(qr.folder_name);
    });

    let html = "";
    Array.from(existingFolders).forEach(f => {
        html += `<option value="${f}" ${f === currentFolder ? 'selected' : ''}>📁 ${f}</option>`;
    });
    html += `<option value="__new__">➕ Yeni Klasör...</option>`;
    return html;
}

function populateFolderFilterSelect(codes) {
    const selectEl = document.getElementById("folder-filter-select");
    if (!selectEl) return;

    const folderSet = new Set(["Genel"]);
    (codes || []).forEach(qr => {
        if (qr.folder_name && qr.status !== 'deleted') {
            folderSet.add(qr.folder_name);
        }
    });

    const activeFolderList = Array.from(folderSet);
    const nonDeletedCount = (codes || []).filter(q => (q.status || 'active') !== 'deleted').length;

    let optionsHTML = `<option value="all" ${currentFolderFilter === 'all' ? 'selected' : ''}>Tüm Klasörler (${nonDeletedCount})</option>`;
    activeFolderList.forEach(folder => {
        const count = (codes || []).filter(qr => (qr.folder_name || "Genel") === folder && (qr.status || 'active') !== 'deleted').length;
        optionsHTML += `<option value="${folder}" ${currentFolderFilter === folder ? 'selected' : ''}>📁 ${folder} (${count})</option>`;
    });

    selectEl.innerHTML = optionsHTML;
}

function updateFilterCountsAndTabLabels(codes) {
    if (!codes) codes = [];
    const countAll = codes.filter(q => (q.status || 'active') !== 'deleted').length;
    const countActive = codes.filter(q => (q.status || 'active') === 'active').length;
    const countPassive = codes.filter(q => q.status === 'passive').length;
    const countDeleted = codes.filter(q => q.status === 'deleted').length;

    const btnAll = document.querySelector('.filter-tab-btn[data-status="all"]');
    const btnActive = document.querySelector('.filter-tab-btn[data-status="active"]');
    const btnPassive = document.querySelector('.filter-tab-btn[data-status="passive"]');
    const btnDeleted = document.querySelector('.filter-tab-btn[data-status="deleted"]');

    if (btnAll) btnAll.innerText = `Tümü (${countAll})`;
    if (btnActive) btnActive.innerText = `Aktif (${countActive})`;
    if (btnPassive) btnPassive.innerText = `Pasif (${countPassive})`;
    if (btnDeleted) btnDeleted.innerText = `Arşiv / Silinmiş (${countDeleted})`;
}

function filterQRList(type, val) {
    if (type === "status") {
        currentStatusFilter = val;
        document.querySelectorAll(".filter-tab-btn").forEach(btn => {
            if (btn.getAttribute("data-status") === val) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    } else if (type === "folder") {
        currentFolderFilter = val;
    }
    renderQRList(allQRCodes);
}

async function updateQRFolder(qrId, folderName) {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;

    let targetFolder = folderName;
    if (folderName === "__new__") {
        const customName = prompt("Lütfen yeni klasör adını girin:");
        if (!customName || !customName.trim()) {
            loadDashboardData();
            return;
        }
        targetFolder = customName.trim();
        currentFolderFilter = targetFolder;
    }

    try {
        await fetch(`/api/qr/${qrId}/update_folder`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ folder_name: targetFolder })
        });
        loadDashboardData();
    } catch (err) {
        console.error("Folder update error:", err);
    }
}

async function updateQRStatus(qrId, status) {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    try {
        await fetch(`/api/qr/${qrId}/update_status`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ status: status })
        });
        loadDashboardData();
    } catch (err) {
        console.error("Status update error:", err);
    }
}

// Dashboard Data
async function loadDashboardData() {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;

    try {
        const res = await fetch("/api/qr/list", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            if (document.getElementById("stat-total-qr")) document.getElementById("stat-total-qr").innerText = data.stats.total_qr;
            if (document.getElementById("stat-total-scans")) document.getElementById("stat-total-scans").innerText = data.stats.total_scans;
            if (document.getElementById("stat-unique-visitors")) document.getElementById("stat-unique-visitors").innerText = data.stats.unique_visitors || 0;
            if (document.getElementById("stat-avg-scans")) document.getElementById("stat-avg-scans").innerText = data.stats.avg_scans_per_qr || 0.0;
            if (document.getElementById("stat-limit")) document.getElementById("stat-limit").innerText = `${data.stats.dynamic_qr_count} / ${data.user.dynamic_qr_limit}`;
            
            const alertElem = document.getElementById("trial-expired-alert");
            const planElem = document.getElementById("stat-plan");

            if (data.user && data.user.trial_expired) {
                if (planElem) planElem.innerHTML = '<span style="color: #f87171; font-size: 16px; font-weight: 800;">DENEME DOLDU</span>';
                if (alertElem) alertElem.style.display = "block";
            } else {
                if (planElem) planElem.innerText = (data.user.plan || "free").toUpperCase();
                if (alertElem) alertElem.style.display = "none";
            }

            allQRCodes = data.qr_codes || [];
            renderQRList(allQRCodes);
        } else {
            const container = document.getElementById("qr-list-container");
            if (container) {
                container.innerHTML = `
                    <div class="glass-card" style="text-align: center; padding: 30px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <div style="font-size: 24px; margin-bottom: 8px;"></div>
                        <strong style="font-size: 15px;">Veriler yüklenemedi:</strong> ${data.error || 'Sunucu hatası oluştu. Lütfen tekrar deneyin.'}
                        <br>
                        <button onclick="loadDashboardData()" class="btn-primary" style="margin-top: 14px; padding: 8px 16px; font-size: 12px;"> Tekrar Dene</button>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error("Dashboard data load error:", err);
        const container = document.getElementById("qr-list-container");
        if (container) {
            container.innerHTML = `
                <div class="glass-card" style="text-align: center; padding: 30px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 24px; margin-bottom: 8px;"></div>
                    <strong style="font-size: 15px;">Bağlantı hatası:</strong> Veriler yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.
                    <br>
                    <button onclick="loadDashboardData()" class="btn-primary" style="margin-top: 14px; padding: 8px 16px; font-size: 12px;"> Tekrar Dene</button>
                </div>
            `;
        }
    }
}

async function toggleQRStatus(qrId, isChecked) {
    const status = isChecked ? "active" : "passive";
    await updateQRStatus(qrId, status);
}

async function deleteQRCode(qrId) {
    if (!confirm("Bu QR kodu arşive kaldırmak istediğinize emin misiniz?")) return;
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    try {
        await fetch(`/api/qr/${qrId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        loadDashboardData();
    } catch (err) {
        console.error("Delete error:", err);
    }
}

async function restoreQRCode(qrId) {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    try {
        await fetch(`/api/qr/${qrId}/restore`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        loadDashboardData();
    } catch (err) {
        console.error("Restore error:", err);
    }
}

async function permanentDeleteQRCode(qrId) {
    if (!confirm("Bu QR kodu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    try {
        await fetch(`/api/qr/${qrId}/permanent_delete`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        loadDashboardData();
    } catch (err) {
        console.error("Permanent delete error:", err);
    }
}

function openQRAnalytics(qrId, title) {
    alert(` "${title}" Analitik Bilgileri:\nEşsiz Ziyaretçiler ve Tüm Cihaz Taramaları başarıyla kaydedilmiştir.`);
}

// Render User QR Codes matching exact specification
function renderQRList(codes) {
    const container = document.getElementById("qr-list-container");
    if (!codes) codes = [];

    // Dynamically update tab labels & counts
    updateFilterCountsAndTabLabels(codes);
    populateFolderFilterSelect(codes);

    // Filter by Status
    let filtered = codes;
    if (currentStatusFilter === "all") {
        filtered = filtered.filter(qr => (qr.status || "active") !== "deleted");
    } else {
        filtered = filtered.filter(qr => (qr.status || "active") === currentStatusFilter);
    }

    // Filter by Folder
    if (currentFolderFilter !== "all") {
        filtered = filtered.filter(qr => (qr.folder_name || "Genel") === currentFolderFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 40px; color: var(--text-muted);">
                Seçili filtrelerde gösterilecek QR kod bulunamadı.
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(qr => {
        const shareUrl = qr.short_url || `${window.location.origin}/r/${qr.short_code}`;
        const status = qr.status || "active";
        const isChecked = status === "active" ? "checked" : "";
        const createdDate = new Date((qr.created_at || Date.now() / 1000) * 1000).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const qrTypeLabel = (qr.type === "url") ? " Website" : ((qr.type === "vcard") ? " vCard" : ((qr.type === "menu") ? " PDF" : ((qr.type === "wifi") ? " Wi-Fi" : " Metin")));
        const isDynamicLabel = qr.is_dynamic ? " Dinamik" : " Statik";

        let controlsHTML = "";
        if (status === "deleted") {
            controlsHTML = `
                <button onclick="restoreQRCode(${qr.id})" title="Geri Yükle" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 6px 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700;">
                     Geri Yükle
                </button>
                <button onclick="permanentDeleteQRCode(${qr.id})" title="Kalıcı Sil" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700;">
                     Kalıcı Sil
                </button>
            `;
        } else {
            controlsHTML = `
                <!-- Folder Selection Dropdown -->
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">Klasör:</span>
                    <select onchange="updateQRFolder(${qr.id}, this.value)" style="background: rgba(255,255,255,0.06); border: 1px solid var(--card-border); color: #ffffff; border-radius: 8px; padding: 4px 8px; font-size: 11px; cursor: pointer; outline: none;">
                        ${getCardFolderSelectOptionsHTML(qr.folder_name || "Genel", allQRCodes)}
                    </select>
                </div>

                <!-- Status Switch Toggle (Aktif / Pasif) -->
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; font-weight: 700; color: ${status === 'active' ? '#10b981' : '#f59e0b'};">
                        ${status === 'active' ? 'Aktif' : 'Pasif'}
                    </span>
                    <label class="switch" style="width: 40px; height: 22px;">
                        <input type="checkbox" ${isChecked} onchange="toggleQRStatus(${qr.id}, this.checked)">
                        <span class="slider" style="border-radius: 20px;"></span>
                    </label>
                </div>

                <!-- Edit QR Button -->
                <button onclick="openEditQRModal(${qr.id})" title="QR Kodu Düzenle" style="background: linear-gradient(135deg, #6366f1, #4f46e5); border: none; color: #ffffff; padding: 7px 14px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45); transition: all 0.2s ease;">
                    ✏️ Düzenle
                </button>

                <!-- Analytics Icon Button -->
                <button onclick="openQRAnalytics(${qr.id}, '${qr.title}')" title="Analizler" style="background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); color: #06b6d4; padding: 6px 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                     Analitik
                </button>

                <!-- Archive/Delete Icon Button -->
                <button onclick="deleteQRCode(${qr.id})" title="Arşive Kaldır" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700;">
                     Arşive Kaldır
                </button>
            `;
        }

        return `
        <div class="glass-card" style="margin-bottom: 16px; padding: 18px 24px; border-radius: 20px; ${status === 'deleted' ? 'opacity: 0.65; border: 1px dashed rgba(239, 68, 68, 0.4);' : ''}">
            <!-- SINGLE LINE HEADER ROW -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                
                <!-- Left: Image + Info Items in Single Row -->
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; flex: 1; min-width: 280px;">
                    <!-- QR Thumbnail -->
                    <div style="background: #ffffff; padding: 4px; border-radius: 10px; display: flex; shrink: 0;">
                        <img src="${qr.qr_image}" style="width: 50px; height: 50px;" />
                    </div>

                    <!-- Title & Short Link & Created Date -->
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <h4 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0;">${qr.title}</h4>
                            <span style="font-size: 10px; font-weight: 700; background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 2px 8px; border-radius: 6px;">${isDynamicLabel}</span>
                            <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.06); color: #e2e8f0; padding: 2px 8px; border-radius: 6px;">${qrTypeLabel}</span>
                            ${status === 'deleted' ? '<span style="font-size: 10px; font-weight: 700; background: rgba(239,68,68,0.2); color: #ef4444; padding: 2px 8px; border-radius: 6px;">Arşivlenmiş</span>' : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 2px; flex-wrap: wrap;">
                            <span> <strong style="color:#ffffff; font-family:monospace;">${shareUrl}</strong></span>
                            <button onclick="copyShareLink('${shareUrl}', this)" style="background: transparent; border: none; color: #818cf8; cursor: pointer; padding: 0; font-size: 11px; font-weight: 700;"> Kopyala</button>
                            <span> ${createdDate}</span>
                        </div>
                    </div>
                </div>

                <!-- Right Side Controls -->
                <div style="display: flex; align-items: center; gap: 12px; shrink: 0; flex-wrap: wrap;">
                    ${controlsHTML}
                </div>

            </div>

            <!-- BOTTOM STATS AND EXPORT BUTTONS ROW -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; gap: 12px;">
                
                <!-- Left: Eşsiz Tarama, Toplam Tarama & Analytics Modal Button -->
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <div style="font-size: 12px; font-weight: 700; color: #06b6d4; background: rgba(6, 182, 212, 0.1); padding: 4px 10px; border-radius: 8px;">
                         Eşsiz Tarama: <strong>${qr.unique_scans || 0}</strong>
                    </div>
                    <div style="font-size: 12px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: 8px;">
                        Toplam Tarama: <strong>${qr.scan_count || qr.scans_count || 0}</strong>
                    </div>
                    <button onclick="openQRAnalyticsModal(${qr.id}, '${escapeJsString(qr.title)}')" class="btn-secondary" style="padding: 5px 10px; font-size: 11px; font-weight: 700; background: rgba(129, 140, 248, 0.15); color: #a5b4fc; border: 1px solid rgba(129, 140, 248, 0.35); border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        📊 Detaylı Analiz
                    </button>
                </div>

                <!-- Right: Export Buttons (Analiz CSV, PNG, SVG, EPS) -->
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <button onclick="downloadQRAnalyticsDirect(${qr.id}, 'csv')" class="btn-secondary" style="padding: 5px 10px; font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 700; cursor: pointer;">
                        📊 Analiz İndir (CSV)
                    </button>
                    <a href="/api/qr/export/${qr.id}?format=png" class="btn-secondary" style="padding: 5px 10px; font-size: 11px;"> PNG İndir</a>
                    <a href="/api/qr/export/${qr.id}?format=svg" class="btn-secondary" style="padding: 5px 10px; font-size: 11px;"> SVG (Vektörel)</a>
                    <a href="/api/qr/export/${qr.id}?format=eps" class="btn-primary" style="padding: 5px 10px; font-size: 11px;"> EPS (Vektörel Baskı)</a>
                </div>

            </div>
        </div>
        `;
    }).join("");
}

function copyShareLink(url, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            const orig = btn.innerText;
            btn.innerText = "Kopyalandı!";
            btn.style.background = "#10b981";
            btn.style.color = "#ffffff";
            setTimeout(() => {
                btn.innerText = orig;
                btn.style.background = "";
                btn.style.color = "";
            }, 2000);
        }).catch(() => {
            prompt("Paylaşım Linkiniz:", url);
        });
    } else {
        prompt("Paylaşım Linkiniz:", url);
    }
}

// Modal Helpers
function openModal(id) {
    document.getElementById(id).classList.add("active");
}
function closeModal(id) {
    document.getElementById(id).classList.remove("active");
    if (id === "auth-modal") {
        pendingQRPayload = null; // Clear pending draft if user closes auth modal
    }
}

// Cycle Selector
function setBillingCycle(cycle) {
    currentCycle = cycle;
    document.querySelectorAll(".cycle-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`[data-cycle="${cycle}"]`).classList.add("active");

    const p = CYCLE_PRICES[cycle];
    document.getElementById("price-starter").innerHTML = `${p.starter} <span style="font-size: 14px; font-weight: 400; color: var(--text-muted);">/ ay</span>`;
    document.getElementById("price-advanced").innerHTML = `${p.advanced} <span style="font-size: 14px; font-weight: 400; color: var(--text-muted);">/ ay</span>`;
    document.getElementById("price-business").innerHTML = `${p.business} <span style="font-size: 14px; font-weight: 400; color: var(--text-muted);">/ ay</span>`;

    document.getElementById("subtext-starter").innerText = p.subtextStarter;
    document.getElementById("subtext-advanced").innerText = p.subtextAdvanced;
    document.getElementById("subtext-business").innerText = p.subtextBusiness;
}

// Buy Plan with iyzico Checkout
let pendingCheckoutPlan = null;

async function buyPlan(planName) {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        alert("Satın alma işlemi yapmak için lütfen giriş yapın veya ücretsiz hesap oluşturun.");
        openModal("auth-modal");
        return;
    }

    const clickedBtn = (typeof event !== "undefined" && event && event.target) ? event.target : null;
    const origText = clickedBtn ? clickedBtn.innerHTML : "";
    if (clickedBtn) {
        clickedBtn.disabled = true;
        clickedBtn.innerHTML = "Ödeme Başlatılıyor...";
    }

    try {
        const res = await fetch("/api/payment/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ plan_key: planName, plan: planName, cycle: currentCycle })
        });

        if (res.status === 401) {
            alert("Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.");
            localStorage.removeItem("jwt_token");
            openModal("auth-modal");
            return;
        }

        const data = await res.json();
        if (data.status === "requires_billing_info") {
            pendingCheckoutPlan = planName;
            if (data.user) {
                if (document.getElementById("billing-name")) document.getElementById("billing-name").value = data.user.name || "";
                if (document.getElementById("billing-identity")) document.getElementById("billing-identity").value = data.user.identity_number || "";
                if (document.getElementById("billing-gsm")) document.getElementById("billing-gsm").value = data.user.gsm_number || "";
                if (document.getElementById("billing-city")) document.getElementById("billing-city").value = data.user.city || "";
                if (document.getElementById("billing-address")) document.getElementById("billing-address").value = data.user.address || "";
            }
            alert(data.error || "Lütfen faturanız ve iyzico kart doğrulaması için bilgilerinizi tamamlayın.");
            openModal("billing-modal");
            return;
        }

        if (res.ok && data.status === "success") {
            if (data.checkout_form_content) {
                const container = document.getElementById("iyzico-checkout-container");
                if (container) {
                    container.innerHTML = data.checkout_form_content;
                    // Execute dynamic script tags returned inside iyzico checkoutFormContent
                    const scripts = container.getElementsByTagName("script");
                    for (let i = 0; i < scripts.length; i++) {
                        const newScript = document.createElement("script");
                        newScript.type = "text/javascript";
                        if (scripts[i].src) {
                            newScript.src = scripts[i].src;
                        } else {
                            newScript.text = scripts[i].text;
                        }
                        document.head.appendChild(newScript);
                    }
                }
                openModal("modal-iyzico-checkout");
            } else if (data.payment_page_url) {
                window.location.href = data.payment_page_url;
            } else {
                alert("Ödeme formu yüklenemedi. Lütfen tekrar deneyin.");
            }
        } else {
            alert(data.error || "Ödeme başlatılamadı.");
        }
    } catch (err) {
        alert("Sunucu bağlantı hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
        if (clickedBtn) {
            clickedBtn.disabled = false;
            clickedBtn.innerHTML = origText;
        }
    }
}

// Billing Form Submission Listener
const billingForm = document.getElementById("billing-form");
if (billingForm) {
    billingForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const token = localStorage.getItem("jwt_token");
        if (!token) return;

        const payload = {
            name: document.getElementById("billing-name").value.trim(),
            identity_number: document.getElementById("billing-identity").value.trim(),
            gsm_number: document.getElementById("billing-gsm").value.trim(),
            city: document.getElementById("billing-city").value.trim(),
            address: document.getElementById("billing-address").value.trim()
        };

        try {
            const res = await fetch("/api/user/update-billing", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.status === "success") {
                closeModal("billing-modal");
                if (pendingCheckoutPlan) {
                    const planToBuy = pendingCheckoutPlan;
                    pendingCheckoutPlan = null;
                    buyPlan(planToBuy);
                }
            } else {
                alert(data.error || "Bilgiler kaydedilemedi.");
            }
        } catch (err) {
            alert("Sunucu bağlantı hatası oluştu.");
        }
    });
}

// Mobile Navigation Hamburger Toggle
function toggleMobileMenu() {
    const nav = document.getElementById("nav-menu-links");
    const btn = document.getElementById("mobile-menu-btn");
    if (nav) {
        nav.classList.toggle("open");
        const isOpen = nav.classList.contains("open");
        if (btn) {
            btn.querySelector(".hamburger-icon").innerText = isOpen ? "✕" : "☰";
        }
    }
}

// Auto close mobile drawer on tab navigation & init crop events
document.addEventListener("DOMContentLoaded", () => {
    initCropCanvasEvents();
    const navLinks = document.querySelectorAll(".nav-link, #nav-auth-btn");
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            const nav = document.getElementById("nav-menu-links");
            const btn = document.getElementById("mobile-menu-btn");
            if (nav && nav.classList.contains("open")) {
                nav.classList.remove("open");
                if (btn) btn.querySelector(".hamburger-icon").innerText = "☰";
            }
        });
    });
});

// FAQ Accordion Toggle
function toggleFaq(btn) {
    const item = btn.closest(".faq-item");
    if (!item) return;

    const isActive = item.classList.contains("active");

    // Close other open FAQ items for clean single accordion behavior
    document.querySelectorAll(".faq-item").forEach(el => el.classList.remove("active"));

    if (!isActive) {
        item.classList.add("active");
    }
}

// Physical Business Card Front Image Upload Handler
async function handleCardImageUpload(input, type) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusElem = document.getElementById(`${type}-card-img-status`);
    const hiddenElem = document.getElementById(`${type}-card-image-url`);
    
    if (statusElem) statusElem.innerText = "⏳ Kartvizit görseli yükleniyor...";
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
        const res = await fetch("/api/upload/image", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.image_url) {
            if (hiddenElem) hiddenElem.value = data.image_url;
            if (statusElem) statusElem.innerText = "✅ Kartvizit ön yüz görseli yüklendi!";
            if (typeof updateLivePreview === "function") updateLivePreview();
        } else {
            if (statusElem) statusElem.innerText = "❌ Görsel yüklenemedi: " + (data.error || "Hata");
        }
    } catch (err) {
        console.error("Card image upload error:", err);
        if (statusElem) statusElem.innerText = "❌ Yükleme hatası oluştu.";
    }
}

// Edit QR Modal Avatar Upload Handler
async function handleEditAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusElem = document.getElementById('edit-vcard-avatar-status');
    const hiddenInput = document.getElementById('edit-vcard-avatar-url');
    const previewImg = document.getElementById('edit-vcard-avatar-preview');

    if (statusElem) {
        statusElem.innerText = '⏳ Profil fotoğrafı yükleniyor...';
        statusElem.style.color = '#f59e0b';
    }

    const formData = new FormData();
    formData.append('avatar_file', file);

    try {
        const res = await fetch('/api/upload/avatar', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && (data.avatar_url || data.image_url)) {
            const finalUrl = data.avatar_url || data.image_url;
            if (hiddenInput) hiddenInput.value = finalUrl;
            if (statusElem) {
                statusElem.innerText = '✅ Profil fotoğrafı yüklendi!';
                statusElem.style.color = '#34d399';
            }
            if (previewImg) {
                previewImg.src = finalUrl;
                previewImg.style.display = 'block';
            }
        } else {
            if (statusElem) {
                statusElem.innerText = '❌ Yükleme hatası: ' + (data.error || 'Bilinmeyen hata');
                statusElem.style.color = '#f43f5e';
            }
        }
    } catch (err) {
        console.error('Edit avatar upload error:', err);
        if (statusElem) {
            statusElem.innerText = '❌ Yükleme hatası oluştu.';
            statusElem.style.color = '#f43f5e';
        }
    }
}

// Edit QR Modal Card Image Upload Handler
async function handleEditCardImageUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const statusElem = document.getElementById('edit-vcard-card-img-status');
    const hiddenInput = document.getElementById('edit-vcard-card-image-url');
    const previewImg = document.getElementById('edit-vcard-card-img-preview');

    if (statusElem) {
        statusElem.innerText = '⏳ Kartvizit görseli yükleniyor...';
        statusElem.style.color = '#f59e0b';
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.image_url) {
            if (hiddenInput) hiddenInput.value = data.image_url;
            if (statusElem) {
                statusElem.innerText = '✅ Kartvizit ön yüz görseli yüklendi!';
                statusElem.style.color = '#34d399';
            }
            if (previewImg) {
                previewImg.src = data.image_url;
                previewImg.style.display = 'block';
            }
        } else {
            if (statusElem) {
                statusElem.innerText = '❌ Yükleme hatası: ' + (data.error || 'Bilinmeyen hata');
                statusElem.style.color = '#f43f5e';
            }
        }
    } catch (err) {
        console.error('Edit card image upload error:', err);
        if (statusElem) {
            statusElem.innerText = '❌ Yükleme hatası oluştu.';
            statusElem.style.color = '#f43f5e';
        }
    }
}

// Studio Accordion Toggle Handler
function toggleStudioAccordion(headerElem) {
    if (!headerElem) return;
    const item = headerElem.closest('.studio-accordion-item');
    if (!item) return;
    item.classList.toggle('open');
    const arrow = item.querySelector('.studio-accordion-arrow');
    if (arrow) {
        arrow.innerText = item.classList.contains('open') ? '▲' : '▼';
    }
}

// QR Analytics Modal & Data Export Handlers
let currentAnalyticsQRId = null;

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

async function openQRAnalyticsModal(qrId, title) {
    currentAnalyticsQRId = qrId;
    const modalTitle = document.getElementById("analytics-modal-title");
    if (modalTitle) modalTitle.innerText = `${title} — Tarama Analitiği`;

    if (document.getElementById("analytics-stat-total")) document.getElementById("analytics-stat-total").innerText = "⏳";
    if (document.getElementById("analytics-stat-unique")) document.getElementById("analytics-stat-unique").innerText = "⏳";
    if (document.getElementById("analytics-stat-top-device")) document.getElementById("analytics-stat-top-device").innerText = "⏳";
    if (document.getElementById("analytics-stat-top-city")) document.getElementById("analytics-stat-top-city").innerText = "⏳";
    if (document.getElementById("analytics-device-list")) document.getElementById("analytics-device-list").innerHTML = "Yükleniyor...";
    if (document.getElementById("analytics-city-list")) document.getElementById("analytics-city-list").innerHTML = "Yükleniyor...";
    if (document.getElementById("analytics-scans-tbody")) {
        document.getElementById("analytics-scans-tbody").innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--text-muted);">Veriler yükleniyor...</td></tr>`;
    }

    openModal("modal-qr-analytics");

    const token = localStorage.getItem("jwt_token");
    try {
        const res = await fetch(`/api/qr/${qrId}/analytics`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            if (document.getElementById("analytics-stat-total")) document.getElementById("analytics-stat-total").innerText = data.total_scans || 0;
            if (document.getElementById("analytics-stat-unique")) document.getElementById("analytics-stat-unique").innerText = data.unique_visitors || 0;

            const topDevice = data.devices && data.devices.length > 0 ? `${data.devices[0].device_type} (${data.devices[0].count})` : "-";
            if (document.getElementById("analytics-stat-top-device")) document.getElementById("analytics-stat-top-device").innerText = topDevice;

            const topCity = data.cities && data.cities.length > 0 ? `${data.cities[0].city} (${data.cities[0].count})` : "-";
            if (document.getElementById("analytics-stat-top-city")) document.getElementById("analytics-stat-top-city").innerText = topCity;

            // Render Devices List
            if (document.getElementById("analytics-device-list")) {
                if (data.devices && data.devices.length > 0) {
                    const total = data.total_scans || 1;
                    document.getElementById("analytics-device-list").innerHTML = data.devices.map(d => {
                        const pct = Math.round((d.count / total) * 100);
                        return `
                            <div style="margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 2px; color: #e2e8f0;">
                                    <span>${d.device_type}</span>
                                    <span>${d.count} (%${pct})</span>
                                </div>
                                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                                    <div style="height: 100%; width: ${pct}%; background: #6366f1;"></div>
                                </div>
                            </div>
                        `;
                    }).join("");
                } else {
                    document.getElementById("analytics-device-list").innerHTML = `<span style="color: var(--text-muted);">Henüz cihaz verisi kaydı bulunmuyor.</span>`;
                }
            }

            // Render Cities List
            if (document.getElementById("analytics-city-list")) {
                if (data.cities && data.cities.length > 0) {
                    const total = data.total_scans || 1;
                    document.getElementById("analytics-city-list").innerHTML = data.cities.map(c => {
                        const pct = Math.round((c.count / total) * 100);
                        return `
                            <div style="margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 2px; color: #e2e8f0;">
                                    <span>📍 ${c.city}</span>
                                    <span>${c.count} (%${pct})</span>
                                </div>
                                <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                                    <div style="height: 100%; width: ${pct}%; background: #f472b6;"></div>
                                </div>
                            </div>
                        `;
                    }).join("");
                } else {
                    document.getElementById("analytics-city-list").innerHTML = `<span style="color: var(--text-muted);">Henüz konum verisi kaydı bulunmuyor.</span>`;
                }
            }

            // Render Scans Table
            if (document.getElementById("analytics-scans-tbody")) {
                if (data.recent_scans && data.recent_scans.length > 0) {
                    document.getElementById("analytics-scans-tbody").innerHTML = data.recent_scans.map(s => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <td style="padding: 8px; color: #ffffff; font-weight: 600;">${s.formatted_date}</td>
                            <td style="padding: 8px;"><span style="background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${s.device_type}</span></td>
                            <td style="padding: 8px; color: var(--text-muted);">${s.browser || '-'}</td>
                            <td style="padding: 8px; color: #ffffff;">📍 ${s.city || 'Bilinmiyor'}, ${s.country || 'Türkiye'}</td>
                            <td style="padding: 8px; font-family: monospace; color: var(--text-muted);">${s.ip_address || '-'}</td>
                        </tr>
                    `).join("");
                } else {
                    document.getElementById("analytics-scans-tbody").innerHTML = `<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--text-muted);">Henüz kayıtlı tarama verisi bulunmuyor.</td></tr>`;
                }
            }

        } else {
            alert(data.error || "Analiz verileri alınamadı.");
            closeModal("modal-qr-analytics");
        }
    } catch (err) {
        console.error("Analytics fetch error:", err);
        alert("Sunucuya bağlanırken bir hata oluştu.");
        closeModal("modal-qr-analytics");
    }
}

function downloadAnalyticsFile(format) {
    if (!currentAnalyticsQRId) return;
    downloadQRAnalyticsDirect(currentAnalyticsQRId, format);
}

function downloadQRAnalyticsDirect(qrId, format) {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        alert("Lütfen önce oturum açın.");
        return;
    }
    const downloadUrl = `/api/qr/${qrId}/analytics/export?format=${format || 'csv'}&token=${encodeURIComponent(token)}`;
    window.location.href = downloadUrl;
}

// QR Code Edit Modal Handlers
let currentEditQRType = "url";

async function openEditQRModal(qrId) {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        alert("QR kodunu düzenlemek için lütfen önce giriş yapın.");
        openModal("auth-modal");
        return;
    }

    const saveBtn = document.getElementById("edit-qr-save-btn");
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = "💾 Değişiklikleri Kaydet";
    }

    document.getElementById("edit-qr-id").value = qrId;
    document.getElementById("edit-qr-title").value = "Yükleniyor...";
    document.getElementById("edit-qr-folder").value = "";
    document.getElementById("edit-qr-dynamic-fields").innerHTML = "Veriler yükleniyor...";

    openModal("modal-edit-qr");

    try {
        const res = await fetch(`/api/qr/${qrId}/details`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            currentEditQRType = data.type;
            document.getElementById("edit-qr-modal-header").innerText = `QR Kodu Düzenle (${data.title})`;
            document.getElementById("edit-qr-title").value = data.title || "";
            document.getElementById("edit-qr-folder").value = data.folder_name || "Genel";

            const container = document.getElementById("edit-qr-dynamic-fields");

            if (["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook"].includes(data.type)) {
                const v = data.vcard || {};
                const soc = v.social_links || {};
                let themeObj = { theme: 'midnight', primary_color: '#6366f1' };
                if (v.theme_settings) {
                    try {
                        themeObj = typeof v.theme_settings === 'string' ? JSON.parse(v.theme_settings) : v.theme_settings;
                    } catch(e) {}
                }
                editSelectedVCardTheme = themeObj.theme || 'midnight';
                editSelectedVCardPrimaryColor = themeObj.primary_color || '#6366f1';

                const socialEditConfigs = {
                    instagram: {
                        label: "📸 Instagram Profil Linki veya Kullanıcı Adı",
                        placeholder: "instagram.com/kullaniciadi veya @kullaniciadi",
                        color: "#f472b6",
                        val: soc.instagram || ""
                    },
                    facebook: {
                        label: "📘 Facebook Sayfa & Profil Linki",
                        placeholder: "facebook.com/sayfaadi",
                        color: "#60a5fa",
                        val: soc.facebook || ""
                    },
                    linkedin: {
                        label: "💼 LinkedIn Profil & Şirket Sayfası Linki",
                        placeholder: "linkedin.com/in/kullaniciadi",
                        color: "#38bdf8",
                        val: soc.linkedin || ""
                    },
                    pinterest: {
                        label: "📌 Pinterest Pano & Profil Linki",
                        placeholder: "pinterest.com/panoadi",
                        color: "#f87171",
                        val: soc.pinterest || ""
                    },
                    social: {
                        label: "🌐 Sosyal Medya Profil / Web Linki",
                        placeholder: "instagram.com/kullaniciadi",
                        color: "#a5b4fc",
                        val: soc.instagram || ""
                    }
                };

                let primarySocialHTML = "";
                if (socialEditConfigs[data.type]) {
                    const cfg = socialEditConfigs[data.type];
                    primarySocialHTML = `
                        <div style="background: rgba(255,255,255,0.04); padding: 14px 16px; border-radius: 14px; border: 1px solid ${cfg.color}; margin-bottom: 16px;">
                            <label class="form-label" style="color: ${cfg.color}; font-weight: 800; font-size: 13px;">${cfg.label}</label>
                            <input type="text" id="edit-vcard-primary-social" class="form-input" placeholder="${cfg.placeholder}" value="${cfg.val}" style="border-color: ${cfg.color};">
                            <div style="font-size: 11px; color: #cbd5e1; margin-top: 6px;">@kullaniciadi veya direkt bağlantı girebilirsiniz. Güncellediğiniz veri canlı QR kodunuza anında yansır.</div>
                        </div>
                    `;
                }

                container.innerHTML = `
                    ${primarySocialHTML}
                    <h4 style="color: var(--accent); margin-top: 0; margin-bottom: 14px; font-size: 14px;">📇 Profil & Kartvizit Detayları (Alt Bilgiler)</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label class="form-label">Ad Soyad</label>
                            <input type="text" id="edit-vcard-name" class="form-input" value="${v.full_name || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Unvan</label>
                            <input type="text" id="edit-vcard-title" class="form-input" value="${v.title || ''}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Şirket / Marka</label>
                        <input type="text" id="edit-vcard-company" class="form-input" value="${v.company || ''}">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label class="form-label">Cep Telefonu</label>
                            <input type="text" id="edit-vcard-phone" class="form-input" value="${v.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">İş Telefonu</label>
                            <input type="text" id="edit-vcard-phone2" class="form-input" value="${v.phone2 || ''}">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label class="form-label">E-posta</label>
                            <input type="email" id="edit-vcard-email" class="form-input" value="${v.email || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Web Sitesi</label>
                            <input type="text" id="edit-vcard-website" class="form-input" placeholder="siteniz.com" value="${v.website || ''}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Adres / Şehir</label>
                        <input type="text" id="edit-vcard-address" class="form-input" value="${v.address || ''}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Biyografi / Hakkında</label>
                        <textarea id="edit-vcard-bio" class="form-textarea" rows="2">${v.bio || ''}</textarea>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 16px; padding-top: 14px;">
                        <h4 style="color: #38bdf8; margin-top: 0; margin-bottom: 12px; font-size: 13px;">📷 Profil Fotoğrafı & Kartvizit Görselleri</h4>
                        
                        <!-- Profil Fotoğrafı Yükleme -->
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label class="form-label">Profil Fotoğrafı Yükleyin (JPG / PNG)</label>
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <label for="edit-vcard-avatar-file" class="btn-secondary" style="padding: 10px 14px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 10px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc; display: inline-flex; align-items: center; gap: 6px; margin: 0;">
                                    <span>📷</span>
                                    <span>Profil Fotoğrafı Seç / Yükle</span>
                                </label>
                                <input type="file" id="edit-vcard-avatar-file" accept="image/*" style="display: none;" onchange="handleEditAvatarUpload(this)">
                                <input type="hidden" id="edit-vcard-avatar-url" value="${v.avatar_url || ''}">
                                <img id="edit-vcard-avatar-preview" src="${v.avatar_url || ''}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #6366f1; display: ${v.avatar_url ? 'block' : 'none'};">
                            </div>
                            <div id="edit-vcard-avatar-status" style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${v.avatar_url ? '✅ Mevcut profil fotoğrafı yüklü.' : 'İsteğe bağlı profil görseli.'}</div>
                        </div>

                        <!-- Fiziksel Kartvizit Görseli (Jpeg) Yükleme -->
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label">Fiziksel Kartvizit Görseli Yükleyin (Ön Yüz Jpeg / Fotoğraf)</label>
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <label for="edit-vcard-card-image-file" class="btn-secondary" style="padding: 10px 14px; font-size: 12px; font-weight: 700; cursor: pointer; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; display: inline-flex; align-items: center; gap: 6px; margin: 0;">
                                    <span>🖼️</span>
                                    <span>Kartvizit Görseli (Jpeg) Seç / Yükle</span>
                                </label>
                                <input type="file" id="edit-vcard-card-image-file" accept="image/*" style="display: none;" onchange="handleEditCardImageUpload(this)">
                                <input type="hidden" id="edit-vcard-card-image-url" value="${v.card_image_url || ''}">
                                <img id="edit-vcard-card-img-preview" src="${v.card_image_url || ''}" style="height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); display: ${v.card_image_url ? 'block' : 'none'};">
                            </div>
                            <div id="edit-vcard-card-img-status" style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${v.card_image_url ? '✅ Mevcut kartvizit görseli yüklü.' : 'İsteğe bağlı ön yüz kartvizit görseli.'}</div>
                        </div>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 16px; padding-top: 14px;">
                        <h4 style="color: #6366f1; margin-top: 0; margin-bottom: 12px; font-size: 13px;">🎨 Açılış Sayfası Teması & Rengi</h4>
                        <div class="form-group">
                            <label class="form-label" style="font-size: 11px;">Hazır Tema Seçimi</label>
                            <select id="edit-vcard-theme-select" class="form-select">
                                <option value="midnight" ${editSelectedVCardTheme === 'midnight' ? 'selected' : ''}>Gece Koyu (Midnight)</option>
                                <option value="minimal_light" ${editSelectedVCardTheme === 'minimal_light' ? 'selected' : ''}>Minimal Beyaz (Light)</option>
                                <option value="purple" ${editSelectedVCardTheme === 'purple' ? 'selected' : ''}>Kraliyet Moru (Royal Purple)</option>
                                <option value="emerald" ${editSelectedVCardTheme === 'emerald' ? 'selected' : ''}>Zümrüt Yeşili (Emerald)</option>
                                <option value="crimson" ${editSelectedVCardTheme === 'crimson' ? 'selected' : ''}>Kızıl Yakut (Crimson)</option>
                                <option value="cobalt" ${editSelectedVCardTheme === 'cobalt' ? 'selected' : ''}>Kurumsal Mavi (Blue)</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-size: 11px;">Vurgu Rengi (Primary Accent)</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="color" id="edit-vcard-primary-color" value="${editSelectedVCardPrimaryColor}" style="width: 44px; height: 38px; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; background: transparent; cursor: pointer; padding: 2px;">
                                <span style="font-size: 12px; color: #94a3b8;">Özel marka vurgu renginiz</span>
                            </div>
                        </div>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 16px; padding-top: 14px;">
                        <h4 style="color: #f472b6; margin-top: 0; margin-bottom: 12px; font-size: 13px;">🌐 Sosyal Medya Profilleri</h4>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">Instagram</label>
                                <input type="text" id="edit-vcard-social-instagram" class="form-input" placeholder="instagram.com/kullanici" value="${soc.instagram || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">LinkedIn</label>
                                <input type="text" id="edit-vcard-social-linkedin" class="form-input" placeholder="linkedin.com/in/kullanici" value="${soc.linkedin || ''}">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">Twitter / X</label>
                                <input type="text" id="edit-vcard-social-twitter" class="form-input" placeholder="x.com/kullanici" value="${soc.twitter || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">Facebook</label>
                                <input type="text" id="edit-vcard-social-facebook" class="form-input" placeholder="facebook.com/kullanici" value="${soc.facebook || ''}">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label class="form-label" style="font-size: 11px;">YouTube</label>
                                <input type="text" id="edit-vcard-social-youtube" class="form-input" placeholder="youtube.com/@kanal" value="${soc.youtube || ''}">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label class="form-label" style="font-size: 11px;">TikTok</label>
                                <input type="text" id="edit-vcard-social-tiktok" class="form-input" placeholder="tiktok.com/@kullanici" value="${soc.tiktok || ''}">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label class="form-label" style="font-size: 11px;">Pinterest</label>
                                <input type="text" id="edit-vcard-social-pinterest" class="form-input" placeholder="pinterest.com/panoadi" value="${soc.pinterest || ''}">
                            </div>
                        </div>
                    </div>
                `;
            } else if (["menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"].includes(data.type)) {
                const m = data.menu || {};
                const isPdfViewer = data.type === "pdf_viewer";
                const modalHeading = isPdfViewer ? "📄 PDF Belge Görüntüleyici Ayarları" : "📖 Online Katalog & Dijital Menü Ayarları";
                const titleLabel = isPdfViewer ? "Belge / Dosya Adı" : "Mekan / İşletme Adı";
                const titlePlaceholder = isPdfViewer ? "Örn: Ürün Kullanım Kılavuzu.pdf" : "İşletme Adı (Örn: Lezzet Cafe)";
                const descLabel = isPdfViewer ? "Belge Açıklaması / Not" : "Açıklama / Slogan";
                const accTitle = isPdfViewer ? "📇 Belge Sahibi & İletişim Bilgileri (İsteğe Bağlı)" : "📇 İşletme İletişim Bilgileri";

                container.innerHTML = `
                    <h4 style="color: var(--accent); margin-top: 0; margin-bottom: 14px; font-size: 14px;">${modalHeading}</h4>
                    <div class="form-group">
                        <label class="form-label">${titleLabel}</label>
                        <input type="text" id="edit-menu-title" class="form-input" placeholder="${titlePlaceholder}" value="${m.title || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${descLabel}</label>
                        <input type="text" id="edit-menu-desc" class="form-input" value="${m.description || ''}">
                    </div>
                    
                    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 16px; padding-top: 14px;">
                        <h4 style="color: #818cf8; margin-top: 0; margin-bottom: 12px; font-size: 13px;">${accTitle}</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">Yetkili Adı / İsim</label>
                                <input type="text" id="edit-menu-contact-name" class="form-input" value="${m.contact_name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">Unvan / Görev</label>
                                <input type="text" id="edit-menu-contact-title" class="form-input" value="${m.contact_title || ''}">
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">Telefon</label>
                                <input type="text" id="edit-menu-phone" class="form-input" value="${m.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="font-size: 11px;">E-posta</label>
                                <input type="email" id="edit-menu-email" class="form-input" value="${m.email || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="font-size: 11px;">Web Sitesi</label>
                            <input type="text" id="edit-menu-website" class="form-input" placeholder="siteniz.com" value="${m.website || ''}">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-size: 11px;">Adres / Şehir</label>
                            <input type="text" id="edit-menu-address" class="form-input" value="${m.address || ''}">
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label">Hedef Web Adresi (URL) / Metin İçeriği</label>
                        <input type="text" id="edit-target-url" class="form-input" value="${data.target_url || ''}">
                    </div>
                `;
            }
        } else {
            alert(data.error || "QR detayları alınamadı.");
            closeModal("modal-edit-qr");
        }
    } catch (err) {
        console.error("QR details error:", err);
        alert("Bağlantı hatası oluştu.");
        closeModal("modal-edit-qr");
    }
}

async function saveQREdit(event) {
    event.preventDefault();
    const token = localStorage.getItem("jwt_token");
    if (!token) return;

    const qrId = document.getElementById("edit-qr-id").value;
    const title = document.getElementById("edit-qr-title").value.trim();
    const folderName = document.getElementById("edit-qr-folder").value.trim();

    const saveBtn = document.getElementById("edit-qr-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = "Kaydediliyor...";
    }

    const payload = {
        title: title,
        folder_name: folderName
    };

    if (currentEditQRType === "url" || currentEditQRType === "wifi" || currentEditQRType === "whatsapp" || currentEditQRType === "text" || currentEditQRType === "phone" || currentEditQRType === "sms") {
        const targetUrlEl = document.getElementById("edit-target-url");
        if (targetUrlEl) {
            let val = targetUrlEl.value.trim();
            if (currentEditQRType === "url") val = normalizeUrlInput(val);
            payload.target_url = val;
        }
    } else if (["vcard", "company_card", "social", "instagram", "linkedin", "pinterest", "facebook"].includes(currentEditQRType)) {
        let primarySocialVal = document.getElementById("edit-vcard-primary-social") ? document.getElementById("edit-vcard-primary-social").value.trim() : "";

        let socInsta = document.getElementById("edit-vcard-social-instagram") ? normalizeUrlInput(document.getElementById("edit-vcard-social-instagram").value) : "";
        let socFb = document.getElementById("edit-vcard-social-facebook") ? normalizeUrlInput(document.getElementById("edit-vcard-social-facebook").value) : "";
        let socLinkedin = document.getElementById("edit-vcard-social-linkedin") ? normalizeUrlInput(document.getElementById("edit-vcard-social-linkedin").value) : "";
        let socPinterest = document.getElementById("edit-vcard-social-pinterest") ? normalizeUrlInput(document.getElementById("edit-vcard-social-pinterest").value) : "";

        if (primarySocialVal) {
            if (primarySocialVal.startsWith("@")) {
                const prefixes = {
                    instagram: "https://instagram.com/",
                    facebook: "https://facebook.com/",
                    linkedin: "https://linkedin.com/in/",
                    pinterest: "https://pinterest.com/",
                    social: "https://instagram.com/"
                };
                const pref = prefixes[currentEditQRType] || "https://instagram.com/";
                primarySocialVal = pref + primarySocialVal.substring(1);
            } else {
                primarySocialVal = normalizeUrlInput(primarySocialVal);
            }

            if (currentEditQRType === "instagram") socInsta = primarySocialVal;
            if (currentEditQRType === "facebook") socFb = primarySocialVal;
            if (currentEditQRType === "linkedin") socLinkedin = primarySocialVal;
            if (currentEditQRType === "pinterest") socPinterest = primarySocialVal;
        }

        payload.vcard_payload = {
            full_name: document.getElementById("edit-vcard-name") ? document.getElementById("edit-vcard-name").value.trim() : "",
            title: document.getElementById("edit-vcard-title") ? document.getElementById("edit-vcard-title").value.trim() : "",
            company: document.getElementById("edit-vcard-company") ? document.getElementById("edit-vcard-company").value.trim() : "",
            phone: document.getElementById("edit-vcard-phone") ? document.getElementById("edit-vcard-phone").value.trim() : "",
            phone2: document.getElementById("edit-vcard-phone2") ? document.getElementById("edit-vcard-phone2").value.trim() : "",
            email: document.getElementById("edit-vcard-email") ? document.getElementById("edit-vcard-email").value.trim() : "",
            website: document.getElementById("edit-vcard-website") ? normalizeUrlInput(document.getElementById("edit-vcard-website").value) : "",
            address: document.getElementById("edit-vcard-address") ? document.getElementById("edit-vcard-address").value.trim() : "",
            bio: document.getElementById("edit-vcard-bio") ? document.getElementById("edit-vcard-bio").value.trim() : "",
            avatar_url: document.getElementById("edit-vcard-avatar-url") ? normalizeUrlInput(document.getElementById("edit-vcard-avatar-url").value) : "",
            card_image_url: document.getElementById("edit-vcard-card-image-url") ? normalizeUrlInput(document.getElementById("edit-vcard-card-image-url").value) : "",
            social_links: {
                instagram: socInsta,
                linkedin: socLinkedin,
                twitter: document.getElementById("edit-vcard-social-twitter") ? normalizeUrlInput(document.getElementById("edit-vcard-social-twitter").value) : "",
                facebook: socFb,
                youtube: document.getElementById("edit-vcard-social-youtube") ? normalizeUrlInput(document.getElementById("edit-vcard-social-youtube").value) : "",
                tiktok: document.getElementById("edit-vcard-social-tiktok") ? normalizeUrlInput(document.getElementById("edit-vcard-social-tiktok").value) : "",
                pinterest: socPinterest
            },
            theme_settings: JSON.stringify({
                theme: document.getElementById("edit-vcard-theme-select") ? document.getElementById("edit-vcard-theme-select").value : "midnight",
                primary_color: document.getElementById("edit-vcard-primary-color") ? document.getElementById("edit-vcard-primary-color").value : "#6366f1"
            })
        };
    } else if (["menu", "pdf_viewer", "pdf_catalog", "restaurant_menu"].includes(currentEditQRType)) {
        payload.menu_payload = {
            title: document.getElementById("edit-menu-title") ? document.getElementById("edit-menu-title").value.trim() : "",
            description: document.getElementById("edit-menu-desc") ? document.getElementById("edit-menu-desc").value.trim() : "",
            contact_name: document.getElementById("edit-menu-contact-name") ? document.getElementById("edit-menu-contact-name").value.trim() : "",
            contact_title: document.getElementById("edit-menu-contact-title") ? document.getElementById("edit-menu-contact-title").value.trim() : "",
            phone: document.getElementById("edit-menu-phone") ? document.getElementById("edit-menu-phone").value.trim() : "",
            email: document.getElementById("edit-menu-email") ? document.getElementById("edit-menu-email").value.trim() : "",
            website: document.getElementById("edit-menu-website") ? normalizeUrlInput(document.getElementById("edit-menu-website").value) : "",
            address: document.getElementById("edit-menu-address") ? document.getElementById("edit-menu-address").value.trim() : ""
        };
    }

    try {
        const res = await fetch(`/api/qr/${qrId}/update`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.status === "success") {
            closeModal("modal-edit-qr");
            alert("✅ QR Kodu başarıyla güncellendi!");
            loadDashboardData();
        } else {
            alert(data.error || "Güncelleme kaydedilemedi.");
        }
    } catch (err) {
        console.error("Save edit error:", err);
        alert("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = "💾 Değişiklikleri Kaydet";
        }
    }
}


