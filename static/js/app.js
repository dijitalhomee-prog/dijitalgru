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
        vcard_payload = {
            full_name: getVal("vcard-name", "Ad Soyad"),
            title: getVal("vcard-title", "Unvan"),
            company: getVal("vcard-company", "Şirket Adı"),
            phone: getVal("vcard-phone", "+90 5XX XXX XX XX"),
            email: getVal("vcard-email", "eposta@sirketiniz.com"),
            website: getVal("vcard-website", "https://siteniz.com"),
            address: getVal("vcard-address", "İstanbul, Türkiye"),
            bio: getVal("vcard-bio", "")
        };
    } else if (currentQrType === "menu") {
        menu_payload = {
            title: getVal("menu-title", "Restoran / İşletme Adı"),
            description: getVal("menu-desc", "Menümüz ve Lezzetlerimiz"),
            pdf_url: uploadedPdfUrl,
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
            document.getElementById("stat-total-qr").innerText = data.stats.total_qr;
            document.getElementById("stat-total-scans").innerText = data.stats.total_scans;
            document.getElementById("stat-limit").innerText = `${data.stats.dynamic_qr_count} / ${data.user.dynamic_qr_limit}`;
            document.getElementById("stat-plan").innerText = data.user.plan.toUpperCase();

            renderQRList(data.qr_codes);
        }
    } catch (err) {
        console.error("Dashboard data load error:", err);
    }
}

// Render User QR Codes with Download Format Options (PNG, JPEG, SVG)
function renderQRList(codes) {
    const container = document.getElementById("qr-list-container");
    if (!codes || codes.length === 0) {
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 40px; color: var(--text-muted);">
                Henüz oluşturulmuş bir QR kodunuz bulunmuyor. Stüdyodan hemen ilk QR kodunuzu oluşturun!
            </div>
        `;
        return;
    }

    container.innerHTML = codes.map(qr => `
        <div class="glass-card" style="margin-bottom: 16px; padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="background: #ffffff; padding: 6px; border-radius: 12px; display: flex;">
                    <img src="${qr.qr_image}" style="width: 70px; height: 70px;" />
                </div>
                <div>
                    <h4 style="font-size: 16px; font-weight: 700; color: #ffffff;">${qr.title}</h4>
                    <div style="font-size: 12px; color: var(--accent); margin-top: 4px;">🎯 Hedef: ${qr.target_url}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Kısa Link: ${window.location.origin}/r/${qr.short_code}</div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <div class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 12px;">
                    👁️ ${qr.scan_count} Tarama
                </div>
                
                <!-- Format Download Buttons -->
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <a href="/api/qr/${qr.id}/download?format=png" class="btn-secondary" style="padding: 6px 10px; font-size: 11px;">📥 PNG</a>
                    <a href="/api/qr/${qr.id}/download?format=jpeg" class="btn-secondary" style="padding: 6px 10px; font-size: 11px;">📥 JPEG</a>
                    <a href="/api/qr/${qr.id}/download?format=svg" class="btn-primary" style="padding: 6px 10px; font-size: 11px;">📥 SVG (Baskı)</a>
                </div>
            </div>
        </div>
    `).join("");
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
