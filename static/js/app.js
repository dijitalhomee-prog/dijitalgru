let currentUser = null;
let currentQrType = "url";
let currentCycle = "monthly";
let uploadedPdfUrl = null;

// Cycle Pricing Config
const CYCLE_PRICES = {
    monthly: { starter: "₺199", advanced: "₺399", business: "₺899", text: "Aylık Düzenli Ödeme" },
    semi_annual: { starter: "₺169", advanced: "₺339", business: "₺764", text: "6 Aylık Peşin Toplam Ödeme" },
    annual: { starter: "₺139", advanced: "₺279", business: "₺629", text: "Yıllık Peşin Toplam Ödeme" }
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
                updateLivePreview();
            });
        }
    });
}

function selectPresetColor(field, hexColor) {
    const input = document.getElementById(`${field}-color`);
    const circle = document.getElementById(`${field}-preview-circle`);
    if (input && circle) {
        input.value = hexColor;
        circle.style.backgroundColor = hexColor;
        updateLivePreview();
    }
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
        frameLabel.style.color = payload.settings?.fill_color || "#a5b4fc";
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
            alert("Giriş başarılı!");
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
            alert("Kayıt başarılı! Hesabınız oluşturuldu.");
        } else {
            alert(data.error || "Kayıt hatası");
        }
    });

    document.getElementById("save-qr-btn").addEventListener("click", async () => {
        const token = localStorage.getItem("jwt_token");
        if (!token) {
            alert("QR Kod kaydetmek için lütfen giriş yapın.");
            openModal("auth-modal");
            return;
        }

        const payload = getQRFormPayload();
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
        }
    } catch (err) {
        console.error("Dashboard data load error:", err);
    }
}

// Render User QR Codes with Download Format Options (PNG, SVG, PDF) and Folder/Status Controls
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
        const folder = qr.folder_name || "Genel";

        return `
        <div class="glass-card" style="margin-bottom: 16px; padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; ${status === 'deleted' ? 'opacity: 0.6;' : ''}">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="background: #ffffff; padding: 6px; border-radius: 12px; display: flex;">
                    <img src="${qr.qr_image}" style="width: 70px; height: 70px;" />
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h4 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 0;">${qr.title}</h4>
                        <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; ${status === 'active' ? 'background: rgba(16,185,129,0.2); color: #10b981;' : (status === 'passive' ? 'background: rgba(245,158,11,0.2); color: #f59e0b;' : 'background: rgba(239,68,68,0.2); color: #ef4444;')}">
                            ${status === 'active' ? '🟢 Aktif' : (status === 'passive' ? '🟡 Pasif' : '🔴 Arşiv')}
                        </span>
                    </div>

                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">🎯 Hedef: ${qr.target_url}</div>
                    
                    <!-- Copyable Shareable Link Box -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                        <span style="font-size: 11px; color: #a5b4fc; font-weight: 600;">🔗 Paylaşım Linki:</span>
                        <span style="font-size: 11px; color: #ffffff; font-weight: 600; font-family: monospace;">${shareUrl}</span>
                        <button onclick="copyShareLink('${shareUrl}', this)" class="btn-secondary" style="padding: 3px 8px; font-size: 10px; margin-left: 4px; border-radius: 6px;">📋 Linki Kopyala</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <!-- Folder selector dropdown -->
                    <select onchange="updateQRFolder(${qr.id}, this.value)" style="background: rgba(255,255,255,0.05); color: #ffffff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; font-size: 11px;">
                        <option value="Genel" ${folder === 'Genel' ? 'selected' : ''}>📂 Genel</option>
                        <option value="Restoran Menüleri" ${folder === 'Restoran Menüleri' ? 'selected' : ''}>🍕 Restoran Menüleri</option>
                        <option value="Kartvizitler" ${folder === 'Kartvizitler' ? 'selected' : ''}>📇 Kartvizitler</option>
                        <option value="Etkinlikler" ${folder === 'Etkinlikler' ? 'selected' : ''}>🎉 Etkinlikler</option>
                    </select>

                    <!-- Status toggle selector -->
                    <select onchange="updateQRStatus(${qr.id}, this.value)" style="background: rgba(255,255,255,0.05); color: #ffffff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; font-size: 11px;">
                        <option value="active" ${status === 'active' ? 'selected' : ''}>🟢 Aktif Et</option>
                        <option value="passive" ${status === 'passive' ? 'selected' : ''}>🟡 Pasife Al</option>
                        <option value="deleted" ${status === 'deleted' ? 'selected' : ''}>🔴 Arşive Kaldır</option>
                    </select>

                    <div class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 11px;">
                        👁️ ${qr.scan_count || qr.scans_count || 0} Tarama
                    </div>
                </div>
                
                <!-- Format Download Export Buttons (PNG, SVG, PDF) -->
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <a href="/api/qr/export/${qr.id}?format=png" class="btn-secondary" style="padding: 6px 10px; font-size: 11px;">📥 PNG İndir</a>
                    <a href="/api/qr/export/${qr.id}?format=svg" class="btn-secondary" style="padding: 6px 10px; font-size: 11px;">🎨 SVG İndir</a>
                    <a href="/api/qr/export/${qr.id}?format=pdf" class="btn-primary" style="padding: 6px 10px; font-size: 11px;">📄 PDF Baskı</a>
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

    document.getElementById("subtext-starter").innerText = p.text;
    document.getElementById("subtext-advanced").innerText = p.text;
    document.getElementById("subtext-business").innerText = p.text;
}

// Buy Plan with iyzico Checkout
async function buyPlan(planName) {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        alert("Satın alma yapmak için lütfen giriş yapın.");
        openModal("auth-modal");
        return;
    }

    try {
        const res = await fetch("/api/payment/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ plan: planName, cycle: currentCycle })
        });
        const data = await res.json();
        if (res.ok && data.status === "success") {
            window.location.href = data.checkout_url;
        } else {
            alert(data.error || "Ödeme başlatılamadı.");
        }
    } catch (err) {
        alert("Sunucu hatası oluştu.");
    }
}
