let currentUser = null;
let currentQrType = "url";
let currentCycle = "monthly";
let uploadedPdfUrl = null;

// Cycle Pricing Config (1st Month %50 OFF | 6-Month %20 OFF | Annual %10 OFF)
const CYCLE_PRICES = {
    monthly: {
        starter: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺199</s> <span style="color: #ef4444; font-weight: 800;">₺99</span>',
        advanced: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺399</s> <span style="color: #ef4444; font-weight: 800;">₺199</span>',
        business: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺899</s> <span style="color: #ef4444; font-weight: 800;">₺449</span>',
        subtextStarter: '🔥 İlk Aya Özel 1 Aylık Net %50 İndirimli Ödeme',
        subtextAdvanced: '🔥 İlk Aya Özel 1 Aylık Net %50 İndirimli Ödeme',
        subtextBusiness: '🔥 İlk Aya Özel 1 Aylık Net %50 İndirimli Ödeme'
    },
    semi_annual: {
        starter: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺199</s> <span style="color: #10b981; font-weight: 800;">₺159</span>',
        advanced: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺399</s> <span style="color: #10b981; font-weight: 800;">₺319</span>',
        business: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺899</s> <span style="color: #10b981; font-weight: 800;">₺719</span>',
        subtextStarter: '🔥 Tek Çekim 6 Aylık Toplam: 954 ₺ (Aylık 159 ₺)',
        subtextAdvanced: '🔥 Tek Çekim 6 Aylık Toplam: 1.914 ₺ (Aylık 319 ₺)',
        subtextBusiness: '🔥 Tek Çekim 6 Aylık Toplam: 4.314 ₺ (Aylık 719 ₺)'
    },
    annual: {
        starter: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺199</s> <span style="color: #6366f1; font-weight: 800;">₺179</span>',
        advanced: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺399</s> <span style="color: #6366f1; font-weight: 800;">₺359</span>',
        business: '<s style="font-size: 16px; color: #94a3b8; margin-right: 6px;">₺899</s> <span style="color: #6366f1; font-weight: 800;">₺809</span>',
        subtextStarter: '🔥 Tek Çekim Yıllık Toplam: 2.148 ₺ (Aylık 179 ₺ - 1 Yıl)',
        subtextAdvanced: '🔥 Tek Çekim Yıllık Toplam: 4.308 ₺ (Aylık 359 ₺ - 1 Yıl)',
        subtextBusiness: '🔥 Tek Çekim Yıllık Toplam: 9.708 ₺ (Aylık 809 ₺ - 1 Yıl)'
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
    const colorFields = ['fill', 'back', 'frame'];
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
    statusText.innerText = 'Yükleniyor... ⏳';

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
            statusText.innerText = `✅ PDF Yüklendi: ${file.name}`;
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

            if (link.classList.contains("nav-link")) link.classList.add("active");
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    document.getElementById("nav-auth-btn").addEventListener("click", () => {
        if (currentUser) {
            logout();
        } else {
            openModal("auth-modal");
        }
    });
}

// Type Selector
function initTypeSelector() {
    document.querySelectorAll(".type-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentQrType = btn.getAttribute("data-type");

            document.querySelectorAll(".type-form").forEach(f => f.style.display = "none");
            const targetForm = document.getElementById(`form-${currentQrType}`);
            if (targetForm) targetForm.style.display = "block";

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
        landingBox.style.display = "block";
        qrBox.style.display = "none";
        renderLandingPageMockup();
    }
}

function renderLandingPageMockup() {
    const payload = getQRFormPayload();
    const container = document.getElementById("mockup-landing-content");
    if (!container) return;

    if (payload.type === "url") {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px 10px;">
                <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
                <div style="font-size: 14px; font-weight: 700; color: #ffffff; word-break: break-all;">${payload.target_url || 'https://siteniz.com'}</div>
                <div style="font-size: 11px; color: #10b981; margin-top: 8px; font-weight: 600;">⚡ Doğrudan Web Sitesi Yönlendirmesi</div>
                <a href="${payload.target_url || '#'}" target="_blank" style="display: inline-block; margin-top: 16px; background: #6366f1; color: #fff; padding: 10px 16px; border-radius: 10px; text-decoration: none; font-size: 12px; font-weight: 700;">Siteyi Aç ↗</a>
            </div>
        `;
    } else if (payload.type === "vcard") {
        const v = payload.vcard_payload || {};
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; text-align: center;">
                <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fff; margin: 0 auto 10px auto;">
                    ${(v.full_name || 'A')[0].toUpperCase()}
                </div>
                <div style="font-size: 15px; font-weight: 800; color: #ffffff;">${v.full_name || 'Ad Soyad'}</div>
                <div style="font-size: 11px; color: #818cf8; margin-top: 2px;">${v.title || 'Unvan'}</div>
                <div style="font-size: 11px; color: #94a3b8;">${v.company || 'Şirket Adı'}</div>

                <div style="display: flex; gap: 6px; margin-top: 14px;">
                    <button style="flex: 1; background: #10b981; color: #fff; border: none; padding: 8px; border-radius: 8px; font-size: 10px; font-weight: 700;">📞 ${v.phone || 'Ara'}</button>
                    <button style="flex: 1; background: #6366f1; color: #fff; border: none; padding: 8px; border-radius: 8px; font-size: 10px; font-weight: 700;">✉️ E-posta</button>
                </div>
                ${v.direct_redirect ? '<div style="font-size: 10px; color: #f59e0b; margin-top: 10px; font-weight: 700;">⚡ Doğrudan .vcf İndirme Aktif</div>' : ''}
            </div>
        `;
    } else if (payload.type === "menu") {
        const m = payload.menu_payload || {};
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; text-align: center;">
                <div style="font-size: 28px; margin-bottom: 6px;">📄</div>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff;">${m.title || 'Restoran Adı'}</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${m.description || 'Menümüz ve Lezzetlerimiz'}</div>
                ${m.pdf_url ? '<div style="margin-top: 12px; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); padding: 8px; border-radius: 8px; font-size: 10px; color: #a5b4fc; font-weight: 700;">✅ PDF Menü Yüklendi</div>' : '<div style="margin-top: 12px; font-size: 10px; color: #ef4444;">PDF Henüz Yüklenmedi</div>'}
                ${m.direct_redirect ? '<div style="font-size: 10px; color: #f59e0b; margin-top: 8px; font-weight: 700;">⚡ Doğrudan PDF Yönlendirmesi Aktif</div>' : ''}
            </div>
        `;
    } else if (payload.type === "wifi") {
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; text-align: center;">
                <div style="font-size: 32px; margin-bottom: 6px;">📶</div>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff;">${getVal("wifi-ssid", "Wi-Fi Ağ Adı")}</div>
                <div style="font-size: 11px; color: #10b981; margin-top: 4px; font-weight: 700;">⚡ Kamera ile Otomatik Bağlantı</div>
            </div>
        `;
    }
}

// Live Preview Updater
async function updateLivePreview() {
    const payload = getQRFormPayload();
    let previewText = payload.target_url;
    if (payload.type === "vcard") {
        previewText = `BEGIN:VCARD\nVERSION:3.0\nN:${payload.vcard_payload?.full_name || 'Isim'}\nTEL:${payload.vcard_payload?.phone || ''}\nEND:VCARD`;
    } else if (payload.type === "menu") {
        previewText = payload.menu_payload?.pdf_url || "https://dijitalgru.com/menu";
    }
    if (!previewText) previewText = "https://dijitalgru.com";

    // Update frame label text
    const frameLabel = document.getElementById("preview-frame-text-label");
    if (frameLabel) {
        frameLabel.innerText = payload.settings?.frame_text || "Beni Tara!";
        frameLabel.style.color = payload.settings?.frame_color || payload.settings?.fill_color || "#a5b4fc";
    }

    renderLandingPageMockup();

    try {
        const res = await fetch("/api/qr/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: previewText, settings: payload.settings })
        });
        const data = await res.json();
        if (data.qr_image) {
            document.getElementById("preview-qr-img").src = data.qr_image;
        }
    } catch (err) {
        console.error("Preview error:", err);
    }
}

function getVal(id, defaultVal = "") {
    const el = document.getElementById(id);
    return el ? (el.value !== undefined ? el.value : defaultVal) : defaultVal;
}

function getQRFormPayload() {
    const title = getVal("qr-title", "Benim QR Kodum");
    const settings = {
        fill_color: getVal("fill-color", "#4F46E5"),
        back_color: getVal("back-color", "#FFFFFF"),
        frame_style: getVal("frame-style", "card"),
        frame_text: getVal("frame-text", "Beni Tara!"),
        frame_color: getVal("frame-color", "#4F46E5")
    };

    let target_url = "";
    let vcard_payload = null;
    let menu_payload = null;

    if (currentQrType === "url") {
        target_url = getVal("target-url", "https://qrdijitalgru.com");
    } else if (currentQrType === "vcard") {
        const directVcardEl = document.getElementById("direct-vcard-redirect");
        vcard_payload = {
            full_name: getVal("vcard-name", "Ad Soyad"),
            title: getVal("vcard-title", "Unvan"),
            company: getVal("vcard-company", "Şirket Adı"),
            phone: getVal("vcard-phone", "+90 5XX XXX XX XX"),
            email: getVal("vcard-email", "eposta@sirketiniz.com"),
            website: getVal("vcard-website", "https://siteniz.com"),
            address: getVal("vcard-address", "İstanbul, Türkiye"),
            bio: getVal("vcard-bio", ""),
            direct_redirect: directVcardEl ? directVcardEl.checked : false
        };
    } else if (currentQrType === "menu") {
        const directPdfEl = document.getElementById("direct-pdf-redirect");
        menu_payload = {
            title: getVal("menu-title", "Restoran / İşletme Adı"),
            description: getVal("menu-desc", "Menümüz ve Lezzetlerimiz"),
            pdf_url: uploadedPdfUrl,
            direct_redirect: directPdfEl ? directPdfEl.checked : true,
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
    } else if (currentQrType === "whatsapp") {
        const phone = getVal("wa-phone", "905000000000");
        const msg = encodeURIComponent(getVal("wa-msg", "Merhaba, bilgi almak istiyorum."));
        target_url = `https://wa.me/${phone}?text=${msg}`;
    }

    return {
        title,
        type: currentQrType,
        target_url,
        settings,
        vcard_payload,
        menu_payload
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
            alert("🎉 Hesabınız oluşturuldu ve hazırladığınız QR kod başarıyla hesabınıza kaydedildi!");
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
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: document.getElementById("login-email").value,
                password: document.getElementById("login-password").value
            })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem("jwt_token", data.token);
            closeModal("auth-modal");
            checkAuthStatus();
            const savedPending = await processPendingQRPurchaseOrSave(data.token);
            if (!savedPending) {
                alert("Giriş başarılı!");
            }
        } else {
            alert(data.error || "Giriş hatası");
        }
    });

    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("reg-name").value,
                email: document.getElementById("reg-email").value,
                password: document.getElementById("reg-password").value
            })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem("jwt_token", data.token);
            closeModal("auth-modal");
            checkAuthStatus();
            const savedPending = await processPendingQRPurchaseOrSave(data.token);
            if (!savedPending) {
                alert("Kayıt başarılı! Hesabınız oluşturuldu.");
            }
        } else {
            alert(data.error || "Kayıt hatası");
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
            alert("🎉 QR Kodunuz başarıyla hesabınıza kaydedildi!");
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
    try {
        await fetch(`/api/qr/${qrId}/update_folder`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ folder_name: folderName })
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
            if (document.getElementById("stat-plan")) document.getElementById("stat-plan").innerText = data.user.plan.toUpperCase();

            allQRCodes = data.qr_codes || [];
            renderQRList(allQRCodes);
        } else {
            const container = document.getElementById("qr-list-container");
            if (container) {
                container.innerHTML = `
                    <div class="glass-card" style="text-align: center; padding: 30px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                        <strong style="font-size: 15px;">Veriler yüklenemedi:</strong> ${data.error || 'Sunucu hatası oluştu. Lütfen tekrar deneyin.'}
                        <br>
                        <button onclick="loadDashboardData()" class="btn-primary" style="margin-top: 14px; padding: 8px 16px; font-size: 12px;">🔄 Tekrar Dene</button>
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
                    <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                    <strong style="font-size: 15px;">Bağlantı hatası:</strong> Veriler yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.
                    <br>
                    <button onclick="loadDashboardData()" class="btn-primary" style="margin-top: 14px; padding: 8px 16px; font-size: 12px;">🔄 Tekrar Dene</button>
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
    if (!confirm("Bu QR kodu silmek/arşive kaldırmak istediğinize emin misiniz?")) return;
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

function openQRAnalytics(qrId, title) {
    alert(`📊 "${title}" Analitik Bilgileri:\nEşsiz Ziyaretçiler ve Tüm Cihaz Taramaları başarıyla kaydedilmiştir.`);
}

// Render User QR Codes matching exact specification
function renderQRList(codes) {
    const container = document.getElementById("qr-list-container");
    if (!codes) codes = [];

    // Filter by Status
    let filtered = codes;
    if (currentStatusFilter !== "all") {
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
        const qrTypeLabel = (qr.type === "url") ? "🌐 Website" : ((qr.type === "vcard") ? "📇 vCard" : ((qr.type === "menu") ? "📄 PDF" : ((qr.type === "wifi") ? "📶 Wi-Fi" : "📝 Metin")));
        const isDynamicLabel = qr.is_dynamic ? "⚡ Dinamik" : "📌 Statik";

        return `
        <div class="glass-card" style="margin-bottom: 16px; padding: 18px 24px; border-radius: 20px; ${status === 'deleted' ? 'opacity: 0.55;' : ''}">
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
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 2px; flex-wrap: wrap;">
                            <span>🔗 <strong style="color:#ffffff; font-family:monospace;">${shareUrl}</strong></span>
                            <button onclick="copyShareLink('${shareUrl}', this)" style="background: transparent; border: none; color: #818cf8; cursor: pointer; padding: 0; font-size: 11px; font-weight: 700;">📋 Kopyala</button>
                            <span>📅 ${createdDate}</span>
                        </div>
                    </div>
                </div>

                <!-- Right Side Controls: Status Switch Toggle, Analytics Icon, Delete Icon -->
                <div style="display: flex; align-items: center; gap: 12px; shrink: 0;">
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

                    <!-- Analytics Icon Button -->
                    <button onclick="openQRAnalytics(${qr.id}, '${qr.title}')" title="Analizler" style="background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); color: #06b6d4; padding: 6px 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                        📊 Analitik
                    </button>

                    <!-- Delete Icon Button -->
                    <button onclick="deleteQRCode(${qr.id})" title="Sil" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700;">
                        🗑️ Sil
                    </button>
                </div>

            </div>

            <!-- BOTTOM STATS AND EXPORT BUTTONS ROW -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; gap: 12px;">
                
                <!-- Left: Eşsiz Tarama ve Toplam Tarama Numbers -->
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <div style="font-size: 12px; font-weight: 700; color: #06b6d4; background: rgba(6, 182, 212, 0.1); padding: 4px 10px; border-radius: 8px;">
                        👤 Eşsiz Tarama: <strong>${qr.unique_scans || 0}</strong> <span style="font-size: 10px; font-weight: 400; color: var(--text-muted);">(Farklı kişi/cihaz)</span>
                    </div>
                    <div style="font-size: 12px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: 8px;">
                        📱 Toplam Tarama: <strong>${qr.scan_count || qr.scans_count || 0}</strong> <span style="font-size: 10px; font-weight: 400; color: var(--text-muted);">(Tüm okutmalar)</span>
                    </div>
                </div>

                <!-- Right: Export Buttons (PNG, SVG, EPS) -->
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <a href="/api/qr/export/${qr.id}?format=png" class="btn-secondary" style="padding: 5px 10px; font-size: 11px;">📥 PNG İndir</a>
                    <a href="/api/qr/export/${qr.id}?format=svg" class="btn-secondary" style="padding: 5px 10px; font-size: 11px;">🎨 SVG (Vektörel)</a>
                    <a href="/api/qr/export/${qr.id}?format=eps" class="btn-primary" style="padding: 5px 10px; font-size: 11px;">📐 EPS (Vektörel Baskı)</a>
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
            btn.innerText = "✅ Kopyalandı!";
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
        clickedBtn.innerHTML = "Ödeme Başlatılıyor... ⏳";
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

// Auto close mobile drawer on tab navigation
document.addEventListener("DOMContentLoaded", () => {
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
