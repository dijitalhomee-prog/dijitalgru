/*!
 * QR Studio — Panel katmanı (QR listesi, indirme, analitik, düzenleme penceresi).
 * app.js ve studio.js'den SONRA yüklenir; aynı isimli global fonksiyonlar app.js'tekilerin yerini alır.
 * Kullanıcı verisi içeren tüm HTML escapeHtml() ile üretilir; satır içi onclick yerine data-* + delegasyon kullanılır.
 */

// ---------------------------------------------------------------------------
// Dosya indirme (Authorization başlığı ile fetch + blob)
// ---------------------------------------------------------------------------
function filenameFromDisposition(h) {
    if (!h) return "";
    let m = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(h);
    if (m) { try { return decodeURIComponent(m[1]).replace(/["']/g, "").trim(); } catch (_) {} }
    m = /filename\s*=\s*"?([^";]+)"?/i.exec(h);
    return m ? m[1].trim() : "";
}
function slugifyFileName(s) {
    return String(s || "qr").toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "qr";
}
async function fetchAndSaveFile(url, fallbackName, errLabel) {
    const token = localStorage.getItem("jwt_token");
    if (!token) { uiToast("Lütfen önce oturum açın."); return false; }
    try {
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) {
            let msg = "";
            try { msg = (await res.json()).error || ""; } catch (_) {}
            uiToast("❌ " + (msg || (errLabel + " indirilemedi (hata " + res.status + ").")));
            return false;
        }
        const blob = await res.blob();
        const name = filenameFromDisposition(res.headers.get("Content-Disposition")) || fallbackName;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(href), 4000);
        return true;
    } catch (err) {
        console.error("Download error:", err);
        uiToast("❌ " + errLabel + " indirilirken bağlantı hatası oluştu.");
        return false;
    }
}
async function downloadQRFile(qrId, fmt, title, btn) {
    fmt = String(fmt || "png").toLowerCase();
    const old = btn ? btn.innerText : "";
    if (btn) { btn.disabled = true; btn.innerText = "⏳ " + fmt.toUpperCase(); }
    try {
        await fetchAndSaveFile(`/api/qr/${encodeURIComponent(qrId)}/download?format=${encodeURIComponent(fmt)}`,
            `qr-${slugifyFileName(title)}.${fmt}`, fmt.toUpperCase());
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = old; }
    }
}
async function downloadQRAnalyticsDirect(qrId, format) {
    const f = format || "csv";
    await fetchAndSaveFile(`/api/qr/${encodeURIComponent(qrId)}/analytics/export?format=${encodeURIComponent(f)}`,
        `qr-analiz-${qrId}.${f === "xlsx" ? "xlsx" : f}`, "Analiz raporu");
}

// ---------------------------------------------------------------------------
// Klasör yardımcıları (escape'li)
// ---------------------------------------------------------------------------
function getCardFolderSelectOptionsHTML(currentFolder, codes) {
    const existing = new Set(DEFAULT_FOLDERS);
    customFolders.forEach(f => existing.add(f));
    if (currentFolder) existing.add(currentFolder);
    (codes || []).forEach(qr => { if (qr.folder_name) existing.add(qr.folder_name); });
    let html = "";
    Array.from(existing).forEach(f => {
        html += `<option value="${escapeHtml(f)}" ${f === currentFolder ? "selected" : ""}>📁 ${escapeHtml(f)}</option>`;
    });
    html += `<option value="__new__">➕ Yeni Klasör...</option>`;
    return html;
}

function populateFolderFilterSelect(codes) {
    const selectEl = byId("folder-filter-select");
    if (selectEl) {
        const folderSet = new Set(["Genel"]);
        customFolders.forEach(f => folderSet.add(f));
        (codes || []).forEach(qr => { if (qr.folder_name && qr.status !== "deleted") folderSet.add(qr.folder_name); });
        const live = (codes || []).filter(q => (q.status || "active") !== "deleted");
        let html = `<option value="all" ${currentFolderFilter === "all" ? "selected" : ""}>Tüm Klasörler (${live.length})</option>`;
        Array.from(folderSet).forEach(folder => {
            const count = live.filter(qr => (qr.folder_name || "Genel") === folder).length;
            html += `<option value="${escapeHtml(folder)}" ${currentFolderFilter === folder ? "selected" : ""}>📁 ${escapeHtml(folder)} (${count})</option>`;
        });
        selectEl.innerHTML = html;
    }
    // Stüdyo klasör listesini de güncel tut (sayfa yenilemeden)
    if (typeof refreshStudioFolderSelect === "function") refreshStudioFolderSelect();
}

async function updateQRFolder(qrId, folderName) {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    let targetFolder = folderName;
    if (folderName === "__new__") {
        const customName = await uiPrompt("Lütfen yeni klasör adını girin:", { title: "Yeni klasör", placeholder: "Klasör adı", okText: "Oluştur" });
        if (!customName || !customName.trim()) { loadDashboardData(); return; }
        targetFolder = customName.trim();
        currentFolderFilter = targetFolder;
    }
    try {
        const res = await fetch(`/api/qr/${qrId}/update_folder`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ folder_name: targetFolder })
        });
        if (res.ok) {
            customFolders.add(targetFolder);
            refreshStudioFolderSelect();
        } else {
            const d = await res.json().catch(() => ({}));
            uiToast("❌ " + (d.error || "Klasör güncellenemedi."));
        }
        loadDashboardData();
    } catch (err) {
        console.error("Folder update error:", err);
    }
}

// ---------------------------------------------------------------------------
// Panel verisi
// ---------------------------------------------------------------------------
function _dashError(container, strongText, detail) {
    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "glass-card";
    card.style.cssText = "text-align:center;padding:30px;color:#ef4444;border:1px solid rgba(239,68,68,0.3);";
    const s = document.createElement("strong");
    s.style.fontSize = "15px";
    s.textContent = strongText;
    card.appendChild(s);
    card.appendChild(document.createTextNode(" " + detail));
    card.appendChild(document.createElement("br"));
    const b = document.createElement("button");
    b.className = "btn-primary";
    b.style.cssText = "margin-top:14px;padding:8px 16px;font-size:12px;";
    b.textContent = "Tekrar Dene";
    b.addEventListener("click", () => loadDashboardData());
    card.appendChild(b);
    container.appendChild(card);
}

async function loadDashboardData() {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    const container = byId("qr-list-container");
    try {
        const res = await fetch("/api/qr/list", { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const st = data.stats || {};
            const put = (id, v) => { const el = byId(id); if (el) el.innerText = v; };
            const fmtNum = (n) => (Number(n) || 0).toLocaleString("tr-TR");
            put("stat-total-qr", fmtNum(st.total_qr));
            put("stat-total-scans", fmtNum(st.total_scans));
            put("stat-unique-visitors", fmtNum(st.unique_visitors));
            put("stat-avg-scans", (Math.round((Number(st.avg_scans_per_qr) || 0) * 10) / 10).toLocaleString("tr-TR"));
            // Efektif limit: sunucudaki user.dynamic_qr_limit (paket sayfasıyla aynı kaynak)
            put("stat-limit", `${st.dynamic_qr_count || 0} / ${(data.user || {}).dynamic_qr_limit}`);
            updateLimitBar(st.dynamic_qr_count, (data.user || {}).dynamic_qr_limit);

            const alertElem = byId("trial-expired-alert");
            const planElem = byId("stat-plan");
            if (data.user && data.user.trial_expired) {
                if (planElem) planElem.innerHTML = '<span style="color:#f87171;font-size:16px;font-weight:800;">DENEME DOLDU</span>';
                if (alertElem) alertElem.style.display = "block";
            } else {
                if (planElem) planElem.innerText = ((data.user || {}).plan || "free").toUpperCase();
                if (alertElem) alertElem.style.display = "none";
            }
            allQRCodes = data.qr_codes || [];
            renderQRList(allQRCodes);
        } else if (container) {
            _dashError(container, "Veriler yüklenemedi:", data.error || "Sunucu hatası oluştu. Lütfen tekrar deneyin.");
        }
    } catch (err) {
        console.error("Dashboard data load error:", err);
        if (container) _dashError(container, "Bağlantı hatası:", "Veriler yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
    }
}

// Dinamik limit çubuğu: #limit-progress-bar .bar-fill (yoksa kart içinde oluşturulur)
function updateLimitBar(used, limit) {
    let bar = byId("limit-progress-bar");
    if (!bar) {
        const host = byId("stat-limit") && byId("stat-limit").parentNode;
        if (!host) return;
        bar = document.createElement("div");
        bar.id = "limit-progress-bar";
        bar.className = "pn-limit-bar";
        host.appendChild(bar);
    }
    let fill = bar.querySelector(".bar-fill");
    if (!fill) {
        fill = document.createElement("span");
        fill.className = "bar-fill";
        bar.appendChild(fill);
    }
    const u = Number(used) || 0;
    const l = Number(limit);
    const pct = l > 0 ? Math.max(0, Math.min(100, Math.round((u / l) * 100))) : 0;
    fill.style.width = pct + "%";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Dinamik QR limit kullanımı");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(pct));
    bar.classList.toggle("is-high", pct >= 90);
}

function qrById(id) {
    return (allQRCodes || []).find(q => String(q.id) === String(id));
}

function _goTab(id) {
    const link = document.querySelector(`.nav-link[data-target="${id}"]`) || document.querySelector(`[data-target="${id}"]`);
    if (link) link.click();
}

// Kart eylemleri (hem kart içi düğmeler hem '…' / İndir menüleri bunu kullanır)
async function _panelDownload(id, fmt, title, btn) {
    fmt = String(fmt || "png").toLowerCase();
    if (btn) btn.disabled = true;
    uiToast(fmt.toUpperCase() + " dosyası hazırlanıyor...", "info");
    try {
        await fetchAndSaveFile(`/api/qr/${encodeURIComponent(id)}/download?format=${encodeURIComponent(fmt)}`,
            `qr-${slugifyFileName(title)}.${fmt}`, fmt.toUpperCase());
    } finally {
        if (btn) btn.disabled = false;
    }
}

function runPanelAction(b) {
    const id = Number(b.getAttribute("data-id"));
    const qr = qrById(id) || {};
    switch (b.getAttribute("data-act")) {
        case "restore": restoreQRCode(id); break;
        case "perm-delete": permanentDeleteQRCode(id); break;
        case "edit": openEditQRModal(id); break;
        case "delete": deleteQRCode(id); break;
        case "copy": copyShareLink(b.getAttribute("data-url") || "", b); break;
        case "analytics": openQRAnalyticsModal(id, qr.title || "QR Kod"); break;
        case "csv": downloadQRAnalyticsDirect(id, "csv"); break;
        case "dl": _panelDownload(id, b.getAttribute("data-fmt"), qr.title, b); break;
        case "go-studio": _goTab("studio-tab"); break;
    }
}

// ---- '…' ve İndir menüleri (erişilebilir; klavye + dışarı tıklama) ----
let _pnMenu = null;
function closePanelMenu(focusTrigger) {
    if (!_pnMenu) return;
    const m = _pnMenu;
    _pnMenu = null;
    if (m.list.parentNode) m.list.parentNode.removeChild(m.list);
    m.trigger.setAttribute("aria-expanded", "false");
    if (focusTrigger && m.trigger.isConnected) m.trigger.focus();
}
function _menuItem(act, id, label, icon, extra, cls) {
    return `<button type="button" role="menuitem" class="pn-menu-item${cls ? " " + cls : ""}" data-act="${act}" data-id="${id}"${extra || ""}>${suIcon(icon)}<span>${escapeHtml(label)}</span></button>`;
}
function _menuItemsHTML(kind, qr, id) {
    if (kind === "dl") {
        return [["png", "PNG (Görsel)"], ["jpg", "JPG (Görsel)"], ["svg", "SVG (Vektörel)"], ["pdf", "PDF"], ["eps", "EPS (Baskı)"]]
            .map(([f, l]) => _menuItem("dl", id, l, "download", ` data-fmt="${f}"`)).join("");
    }
    const isStatic = isStaticType(qr.type) || qr.is_dynamic === false || qr.is_dynamic === 0;
    return (isStatic ? "" : _menuItem("csv", id, "Analiz raporunu indir (CSV)", "chart") + '<div class="pn-menu-sep" role="separator"></div>') +
        _menuItem("delete", id, "Arşive kaldır", "archive", "", "danger");
}
function openPanelMenu(trigger) {
    if (_pnMenu && _pnMenu.trigger === trigger) { closePanelMenu(true); return; }
    closePanelMenu();
    const id = Number(trigger.getAttribute("data-id"));
    const kind = trigger.getAttribute("data-menu");
    const list = document.createElement("div");
    list.className = "pn-menu-list is-open";
    list.setAttribute("role", "menu");
    list.setAttribute("aria-label", kind === "dl" ? "İndirme biçimleri" : "Diğer işlemler");
    list.innerHTML = _menuItemsHTML(kind, qrById(id) || {}, id);
    document.body.appendChild(list);
    const r = trigger.getBoundingClientRect();
    const w = list.offsetWidth, h = list.offsetHeight;
    let left = kind === "more" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    list.style.left = left + "px";
    list.style.top = top + "px";
    trigger.setAttribute("aria-expanded", "true");
    _pnMenu = { list, trigger };
    list.addEventListener("click", (e) => {
        const it = e.target.closest("[data-act]");
        if (!it) return;
        closePanelMenu(true);
        runPanelAction(it);
    });
    list.addEventListener("keydown", (e) => {
        const items = Array.prototype.slice.call(list.querySelectorAll(".pn-menu-item"));
        const i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
        else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePanelMenu(true); }
        else if (e.key === "Tab") { closePanelMenu(false); }
    });
    const first = list.querySelector(".pn-menu-item");
    if (first) first.focus();
}
if (!window._pnMenuGlobals) {
    window._pnMenuGlobals = true;
    document.addEventListener("mousedown", (e) => {
        if (!_pnMenu) return;
        if (_pnMenu.list.contains(e.target) || _pnMenu.trigger.contains(e.target)) return;
        closePanelMenu(false);
    });
    document.addEventListener("scroll", (e) => { if (_pnMenu && !_pnMenu.list.contains(e.target)) closePanelMenu(false); }, true);
    window.addEventListener("resize", () => closePanelMenu(false));
}

function initPanelDelegation() {
    const c = byId("qr-list-container");
    if (!c || c._delegated) return;
    c._delegated = true;
    c.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b || !c.contains(b)) return;
        if (b.getAttribute("data-act") === "menu") { openPanelMenu(b); return; }
        closePanelMenu(false);
        runPanelAction(b);
    });
    c.addEventListener("keydown", (e) => {
        const t = e.target.closest && e.target.closest('[data-act="menu"]');
        if (t && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); if (!(_pnMenu && _pnMenu.trigger === t)) openPanelMenu(t); }
    });
    c.addEventListener("change", (e) => {
        const t = e.target;
        const act = t.getAttribute && t.getAttribute("data-act");
        if (!act) return;
        const id = Number(t.getAttribute("data-id"));
        if (act === "folder") updateQRFolder(id, t.value);
        else if (act === "toggle") toggleQRStatus(id, t.checked);
    });
}
document.addEventListener("DOMContentLoaded", initPanelDelegation);

function openQRAnalytics(qrId, title) {
    uiToast(`"${title}" için ayrıntılı rapora "Detaylı Analiz" düğmesinden ulaşabilirsiniz.`);
}

// ---------------------------------------------------------------------------
// QR listesi
// ---------------------------------------------------------------------------
const _B = (bg, bd, col) => `background:${bg};border:1px solid ${bd};color:${col};padding:6px 10px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;`;

// [ESKİ SÜRÜM — kullanılmıyor; yerini aşağıdaki renderQRList (kart tasarımı v2) aldı]
function _legacyRenderQRList(codes) {
    const container = byId("qr-list-container");
    if (!container) return;
    initPanelDelegation();
    if (!codes) codes = [];

    updateFilterCountsAndTabLabels(codes);
    populateFolderFilterSelect(codes);

    let filtered = codes;
    if (currentStatusFilter === "all") filtered = filtered.filter(qr => (qr.status || "active") !== "deleted");
    else filtered = filtered.filter(qr => (qr.status || "active") === currentStatusFilter);
    if (currentFolderFilter !== "all") filtered = filtered.filter(qr => (qr.folder_name || "Genel") === currentFolderFilter);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="glass-card" style="text-align:center;padding:40px;color:var(--text-muted);">Seçili filtrelerde gösterilecek QR kod bulunamadı.</div>`;
        return;
    }

    container.innerHTML = filtered.map(qr => {
        const id = Number(qr.id);
        const isStatic = isStaticType(qr.type) || qr.is_dynamic === false || qr.is_dynamic === 0;
        const shareUrl = qr.short_url || (qr.short_code ? `${window.location.origin}/r/${qr.short_code}` : "");
        const status = qr.status || "active";
        const createdDate = new Date((qr.created_at || Date.now() / 1000) * 1000).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const typeLabel = QR_TYPE_LABELS[qr.type] || String(qr.type || "QR");
        const img = safeAttrUrl(qr.qr_image);

        let controls;
        if (status === "deleted") {
            controls = `
                <button type="button" data-act="restore" data-id="${id}" title="Geri Yükle" style="${_B("rgba(16,185,129,0.15)", "rgba(16,185,129,0.3)", "#34d399")}">Geri Yükle</button>
                <button type="button" data-act="perm-delete" data-id="${id}" title="Kalıcı Sil" style="${_B("rgba(239,68,68,0.15)", "rgba(239,68,68,0.3)", "#ef4444")}">Kalıcı Sil</button>`;
        } else {
            controls = `
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;font-weight:700;color:var(--text-muted);">Klasör:</span>
                    <select data-act="folder" data-id="${id}" style="background:rgba(255,255,255,0.06);border:1px solid var(--card-border);color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;cursor:pointer;outline:none;">
                        ${getCardFolderSelectOptionsHTML(qr.folder_name || "Genel", allQRCodes)}
                    </select>
                </div>
                ${isStatic ? `<span style="font-size:11px;font-weight:700;color:#34d399;">♾️ Süresiz</span>` : `
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;font-weight:700;color:${status === "active" ? "#10b981" : "#f59e0b"};">${status === "active" ? "Aktif" : "Pasif"}</span>
                    <label class="switch" style="width:40px;height:22px;">
                        <input type="checkbox" ${status === "active" ? "checked" : ""} data-act="toggle" data-id="${id}">
                        <span class="slider" style="border-radius:20px;"></span>
                    </label>
                </div>`}
                <button type="button" data-act="edit" data-id="${id}" title="QR Kodu Düzenle" style="background:linear-gradient(135deg,#6366f1,#4f46e5);border:none;color:#fff;padding:7px 14px;border-radius:10px;cursor:pointer;font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:5px;box-shadow:0 4px 14px rgba(99,102,241,0.45);">✏️ Düzenle</button>
                <button type="button" data-act="delete" data-id="${id}" title="Arşive Kaldır" style="${_B("rgba(239,68,68,0.15)", "rgba(239,68,68,0.3)", "#ef4444")}">Arşive Kaldır</button>`;
        }

        const linkRow = isStatic
            ? `<span style="color:#cbd5e1;">Doğrudan içeriği taşır • sunucudan geçmez</span><span>${escapeHtml(createdDate)}</span>`
            : `<span><strong style="color:#fff;font-family:monospace;">${escapeHtml(shareUrl)}</strong></span>
               <button type="button" data-act="copy" data-url="${escapeHtml(shareUrl)}" style="background:transparent;border:none;color:#818cf8;cursor:pointer;padding:0;font-size:11px;font-weight:700;">Kopyala</button>
               <span>${escapeHtml(createdDate)}</span>`;

        const statsRow = isStatic
            ? `<div style="font-size:12px;font-weight:700;color:#94a3b8;background:rgba(148,163,184,0.1);padding:4px 10px;border-radius:8px;">🚫 Takip edilemez • Süresiz • Sınırsız</div>`
            : `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div style="font-size:12px;font-weight:700;color:#06b6d4;background:rgba(6,182,212,0.1);padding:4px 10px;border-radius:8px;">Eşsiz Tarama: <strong>${Number(qr.unique_scans) || 0}</strong></div>
                    <div style="font-size:12px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:4px 10px;border-radius:8px;">Toplam Tarama: <strong>${Number(qr.scan_count || qr.scans_count) || 0}</strong></div>
                    <button type="button" data-act="analytics" data-id="${id}" class="btn-secondary" style="padding:5px 10px;font-size:11px;font-weight:700;background:rgba(129,140,248,0.15);color:#a5b4fc;border:1px solid rgba(129,140,248,0.35);border-radius:8px;cursor:pointer;">📊 Detaylı Analiz</button>
               </div>`;

        const dl = (fmt, label, cls) => `<button type="button" data-act="dl" data-id="${id}" data-fmt="${fmt}" class="${cls}" style="padding:5px 10px;font-size:11px;cursor:pointer;">${label}</button>`;

        return `
        <div class="glass-card" style="margin-bottom:16px;padding:18px 24px;border-radius:20px;${status === "deleted" ? "opacity:0.65;border:1px dashed rgba(239,68,68,0.4);" : ""}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:1;min-width:280px;">
                    <div style="background:#fff;padding:4px;border-radius:10px;display:flex;flex-shrink:0;">
                        ${img ? `<img src="${escapeHtml(img)}" alt="QR" style="width:50px;height:50px;">` : `<div style="width:50px;height:50px;"></div>`}
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <h4 style="font-size:15px;font-weight:800;color:#fff;margin:0;word-break:break-word;">${escapeHtml(qr.title)}</h4>
                            <span style="font-size:10px;font-weight:700;background:${isStatic ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)"};color:${isStatic ? "#34d399" : "#a5b4fc"};padding:2px 8px;border-radius:6px;">${isStatic ? "Statik" : "Dinamik"}</span>
                            <span style="font-size:10px;font-weight:700;background:rgba(255,255,255,0.06);color:#e2e8f0;padding:2px 8px;border-radius:6px;">${escapeHtml(typeLabel)}</span>
                            ${status === "deleted" ? '<span style="font-size:10px;font-weight:700;background:rgba(239,68,68,0.2);color:#ef4444;padding:2px 8px;border-radius:6px;">Arşivlenmiş</span>' : ""}
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text-muted);margin-top:2px;flex-wrap:wrap;">${linkRow}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">${controls}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;gap:12px;">
                ${statsRow}
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    ${isStatic ? "" : `<button type="button" data-act="csv" data-id="${id}" class="btn-secondary" style="padding:5px 10px;font-size:11px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.35);font-weight:700;cursor:pointer;">📊 Analiz İndir (CSV)</button>`}
                    ${dl("png", "PNG", "btn-secondary")}${dl("jpg", "JPG", "btn-secondary")}${dl("svg", "SVG (Vektörel)", "btn-secondary")}${dl("pdf", "PDF", "btn-secondary")}${dl("eps", "EPS (Baskı)", "btn-primary")}
                </div>
            </div>
        </div>`;
    }).join("");
}

// [ESKİ SÜRÜM — kullanılmıyor; yerini aşağıdaki copyShareLink aldı]
function _legacyCopyShareLink(url, btn) {
    const done = () => {
        if (!btn) return;
        const orig = btn.innerText;
        btn.innerText = "Kopyalandı!";
        btn.style.background = "#10b981";
        btn.style.color = "#ffffff";
        setTimeout(() => { btn.innerText = orig; btn.style.background = ""; btn.style.color = ""; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(() => uiShowText("Paylaşım Linkiniz", url));
    } else {
        uiShowText("Paylaşım Linkiniz", url);
    }
}

// ---------------------------------------------------------------------------
// Analitik penceresi
// ---------------------------------------------------------------------------
function _setHTML(id, html) { const el = byId(id); if (el) el.innerHTML = html; }
function _setText(id, text) { const el = byId(id); if (el) el.innerText = text; }

function _barList(items, labelKey, color, prefix, total) {
    return items.map(d => {
        const pct = Math.round(((Number(d.count) || 0) / (total || 1)) * 100);
        return `<div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:2px;color:#e2e8f0;"><span>${prefix}${escapeHtml(d[labelKey] || "Bilinmiyor")}</span><span>${Number(d.count) || 0} (%${pct})</span></div>
            <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};"></div></div></div>`;
    }).join("");
}

function _renderHourly(hourly) {
    const box = byId("analytics-hourly");
    if (!box) return;
    if (!Array.isArray(hourly) || hourly.length !== 24) {
        box.innerHTML = '<span style="color:var(--text-muted);">Saatlik veri bulunmuyor.</span>';
        return;
    }
    const nums = hourly.map(n => Number(n) || 0);
    const max = Math.max.apply(null, nums) || 1;
    const bars = nums.map((n, h) => {
        const hh = String(h).padStart(2, "0");
        const height = n ? Math.max(6, Math.round((n / max) * 100)) : 3;
        return `<div title="${hh}:00 — ${n} tarama" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;">
            <div style="width:100%;height:70px;display:flex;align-items:flex-end;"><div style="width:100%;height:${height}%;background:${n ? "linear-gradient(180deg,#818cf8,#6366f1)" : "rgba(255,255,255,0.08)"};border-radius:3px 3px 0 0;"></div></div>
            <span style="font-size:8px;color:#64748b;">${h % 3 === 0 ? hh : ""}</span></div>`;
    }).join("");
    box.innerHTML = `<div style="display:flex;gap:2px;align-items:flex-end;">${bars}</div>`;
}

async function openQRAnalyticsModal(qrId, title) {
    currentAnalyticsQRId = qrId;
    _setText("analytics-modal-title", `${title} — Tarama Analitiği`);
    ["analytics-stat-total", "analytics-stat-unique", "analytics-stat-top-device", "analytics-stat-top-city"].forEach(id => _setText(id, "⏳"));
    _setText("analytics-device-list", "Yükleniyor...");
    _setText("analytics-city-list", "Yükleniyor...");
    _setText("analytics-hourly", "Yükleniyor...");
    _setHTML("analytics-scans-tbody", `<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-muted);">Veriler yükleniyor...</td></tr>`);
    openModal("modal-qr-analytics");

    try {
        const res = await fetch(`/api/qr/${encodeURIComponent(qrId)}/analytics`, { headers: authHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            uiToast(data.error || "Analiz verileri alınamadı.");
            closeModal("modal-qr-analytics");
            return;
        }
        const devices = data.devices || [];
        const cities = data.cities || [];
        const total = data.total_scans || 1;
        _setText("analytics-stat-total", data.total_scans || 0);
        _setText("analytics-stat-unique", data.unique_visitors || 0);
        _setText("analytics-stat-top-device", devices.length ? `${devices[0].device_type} (${devices[0].count})` : "-");
        _setText("analytics-stat-top-city", cities.length ? `${cities[0].city} (${cities[0].count})` : "-");
        _setHTML("analytics-device-list", devices.length ? _barList(devices, "device_type", "#6366f1", "", total) : `<span style="color:var(--text-muted);">Henüz cihaz verisi kaydı bulunmuyor.</span>`);
        _setHTML("analytics-city-list", cities.length ? _barList(cities, "city", "#f472b6", "📍 ", total) : `<span style="color:var(--text-muted);">Henüz konum verisi kaydı bulunmuyor.</span>`);
        _renderHourly(data.hourly);

        const scans = data.recent_scans || [];
        _setHTML("analytics-scans-tbody", scans.length ? scans.map(s => {
            // Tarih/saat sunucudan (Europe/Istanbul) gelir; yoksa aynı saat dilimiyle biçimlendir
            const when = s.formatted_date || (s.scanned_at ? fmtIstanbul(s.scanned_at) : "-");
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:8px;color:#fff;font-weight:600;">${escapeHtml(when)}</td>
                <td style="padding:8px;"><span style="background:rgba(99,102,241,0.15);color:#a5b4fc;padding:2px 6px;border-radius:4px;font-weight:600;">${escapeHtml(s.device_type || "-")}</span></td>
                <td style="padding:8px;color:var(--text-muted);">${escapeHtml(s.browser || "-")}</td>
                <td style="padding:8px;color:#fff;">📍 ${escapeHtml(s.city || "Bilinmiyor")}, ${escapeHtml(s.country || "Türkiye")}</td>
                <td style="padding:8px;font-family:monospace;color:var(--text-muted);">${escapeHtml(s.ip_address || "-")}</td></tr>`;
        }).join("") : `<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-muted);">Henüz kayıtlı tarama verisi bulunmuyor.</td></tr>`);
    } catch (err) {
        console.error("Analytics fetch error:", err);
        uiToast("Sunucuya bağlanırken bir hata oluştu.");
        closeModal("modal-qr-analytics");
    }
}

// ---------------------------------------------------------------------------
// Düzenleme penceresi
// ---------------------------------------------------------------------------
function _eIn(id, label, value, o) {
    o = o || {};
    return `<div class="form-group"${o.last ? ' style="margin-bottom:0;"' : ""}><label class="form-label"${o.small ? ' style="font-size:11px;"' : ""}>${label}</label>` +
        `<input type="${o.type || "text"}" id="${id}" class="form-input" placeholder="${escapeHtml(o.ph || "")}" value="${escapeHtml(value == null ? "" : value)}"></div>`;
}
function _eArea(id, label, value, rows) {
    return `<div class="form-group"><label class="form-label">${label}</label><textarea id="${id}" class="form-textarea" rows="${rows || 2}">${escapeHtml(value == null ? "" : value)}</textarea></div>`;
}
function _eRow2(a, b) { return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${a}${b}</div>`; }
function _eNote(text) {
    return `<div style="font-size:11px;color:#fbbf24;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:8px 10px;margin-bottom:14px;">${escapeHtml(text)}</div>`;
}
const EDIT_SOCIAL_PH = {
    instagram: "instagram.com/kullanici", facebook: "facebook.com/kullanici", linkedin: "linkedin.com/in/kullanici",
    pinterest: "pinterest.com/panoadi", twitter: "x.com/kullanici", tiktok: "tiktok.com/@kullanici", youtube: "youtube.com/@kanal"
};
function _eSocialGrid(soc) {
    const cells = SOCIAL_PLATFORMS.map(p => _eIn("edit-vcard-social-" + p, SOCIAL_LABELS[p] || p, soc[p] || "", { small: true, ph: EDIT_SOCIAL_PH[p] }));
    let html = "";
    for (let i = 0; i < cells.length; i += 2) html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${cells[i]}${cells[i + 1] || ""}</div>`;
    return html;
}

function _parseTheme(raw) {
    let t = { theme: "midnight", primary_color: "#6366f1" };
    if (raw) { try { t = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) {} }
    return t;
}
function _themeBlock(themeObj) {
    const opts = [["midnight", "Gece Koyu (Midnight)"], ["minimal_light", "Minimal Beyaz (Light)"], ["purple", "Kraliyet Moru (Royal Purple)"],
        ["emerald", "Zümrüt Yeşili (Emerald)"], ["crimson", "Kızıl Yakut (Crimson)"], ["cobalt", "Kurumsal Mavi (Blue)"]];
    const color = /^#[0-9a-f]{6}$/i.test(themeObj.primary_color || "") ? themeObj.primary_color : "#6366f1";
    return `<div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:14px;">
        <h4 style="color:#6366f1;margin:0 0 12px;font-size:13px;">🎨 Açılış Sayfası Teması & Rengi</h4>
        <div class="form-group"><label class="form-label" style="font-size:11px;">Hazır Tema Seçimi</label>
        <select id="edit-vcard-theme-select" class="form-select">${opts.map(([v, l]) => `<option value="${v}" ${themeObj.theme === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="form-group" style="margin-bottom:0;"><label class="form-label" style="font-size:11px;">Vurgu Rengi</label>
        <input type="color" id="edit-vcard-primary-color" value="${color}" style="width:44px;height:38px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;cursor:pointer;padding:2px;"></div></div>`;
}

let editCompanyInfo = {};

function _editHTML(data) {
    const t = data.type;
    const st = data.static_payload || {};
    if (t === "url" || t === "static_url") {
        const url = t === "static_url" ? (st.url || data.target_url || "") : (data.target_url || "");
        return (t === "static_url" ? _eNote("Statik QR: adres doğrudan koda yazılıdır. Değiştirirseniz basılı kodunuzu yenilemeniz gerekir.") : "") +
            _eIn("edit-target-url", "Hedef Web Adresi (URL)", url, { last: true, ph: "https://siteniz.com" });
    }
    if (t === "phone") return _eNote("Statik QR: içerik doğrudan koda yazılıdır; değiştirirseniz basılı kodunuzu yenilemeniz gerekir.") + _eIn("edit-static-phone", "Telefon Numarası", st.phone, { type: "tel", last: true, ph: "+90 537 627 44 15" });
    if (t === "sms") return _eNote("Statik QR: içerik doğrudan koda yazılıdır; değiştirirseniz basılı kodunuzu yenilemeniz gerekir.") + _eIn("edit-static-phone", "Telefon Numarası", st.phone, { type: "tel", ph: "+90 537 627 44 15" }) + _eArea("edit-static-message", "Mesaj", st.message, 3);
    if (t === "text") return _eNote("Statik QR: içerik doğrudan koda yazılıdır; değiştirirseniz basılı kodunuzu yenilemeniz gerekir.") + _eArea("edit-static-text", "Metin", st.text, 4);
    if (t === "wifi") {
        const enc = st.encryption || "WPA";
        return _eNote("Statik QR: içerik doğrudan koda yazılıdır; değiştirirseniz basılı kodunuzu yenilemeniz gerekir.") +
            _eIn("edit-wifi-ssid", "Ağ Adı (SSID)", st.ssid) + _eIn("edit-wifi-pass", "Şifre", st.password) +
            `<div class="form-group"><label class="form-label">Şifreleme Türü</label><select id="edit-wifi-enc" class="form-select">
                <option value="WPA" ${enc === "WPA" ? "selected" : ""}>WPA/WPA2</option><option value="WEP" ${enc === "WEP" ? "selected" : ""}>WEP</option>
                <option value="nopass" ${enc === "nopass" ? "selected" : ""}>Şifresiz</option></select></div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#e2e8f0;"><input type="checkbox" id="edit-wifi-hidden" ${st.hidden ? "checked" : ""}> Gizli Ağ</label>`;
    }
    if (WA_TYPES.includes(t)) {
        const w = data.wa_payload || {};
        return _eIn("edit-wa-phone", "WhatsApp Numarası", w.phone, { type: "tel", ph: "+90 537 627 44 15" }) + _eArea("edit-wa-msg", "Hazır Mesaj", w.message, 3);
    }
    if (SOCIAL_SINGLE_TYPES.includes(t)) {
        const soc = (data.vcard || {}).social_links || {};
        const cfg = SOCIAL_UI[t];
        return `<div style="background:rgba(255,255,255,0.04);padding:14px 16px;border-radius:14px;border:1px solid ${cfg.color};">
            <label class="form-label" style="color:${cfg.color};font-weight:800;font-size:13px;">${escapeHtml(cfg.label)}</label>
            <input type="text" id="edit-vcard-primary-social" class="form-input" placeholder="${escapeHtml(cfg.placeholder)}" value="${escapeHtml(soc[t] || "")}" style="border-color:${cfg.color};">
            <div style="font-size:11px;color:#cbd5e1;margin-top:6px;">@kullaniciadi veya direkt bağlantı girebilirsiniz. QR bu profile doğrudan yönlenir.</div></div>`;
    }
    if (t === "social") {
        const soc = (data.vcard || {}).social_links || {};
        return `<h4 style="color:#f472b6;margin:0 0 12px;font-size:14px;">🌐 Sosyal Medya Hesapları</h4>${_eSocialGrid(soc)}`;
    }
    if (t === "vcard" || t === "company_card") {
        const v = data.vcard || {};
        const soc = v.social_links || {};
        const isCompany = t === "company_card";
        editCompanyInfo = (isCompany && (v.company_info || data.company_info)) || {};
        const ci = editCompanyInfo;
        const head = isCompany
            ? `<h4 style="color:var(--accent);margin:0 0 14px;font-size:14px;">🏢 Şirket Bilgileri</h4>` +
              _eIn("edit-vcard-company", "Şirket Adı (zorunlu)", v.company || ci.name) +
              _eRow2(_eIn("edit-comp-sector", "Sektör", ci.sector), _eIn("edit-comp-maps", "Google Maps Konum Linki", ci.maps_url, { ph: "https://maps.google.com/..." })) +
              _eRow2(_eIn("edit-comp-tax-office", "Vergi Dairesi", ci.tax_office), _eIn("edit-comp-tax-no", "Vergi No", ci.tax_no)) +
              _eArea("edit-comp-hours", "Çalışma Saatleri", ci.working_hours, 3) +
              `<input type="hidden" id="edit-vcard-name" value="${escapeHtml(v.full_name || "")}">`
            : `<h4 style="color:var(--accent);margin:0 0 14px;font-size:14px;">📇 Profil & Kartvizit Detayları</h4>` +
              _eRow2(_eIn("edit-vcard-name", "Ad Soyad", v.full_name), _eIn("edit-vcard-title", "Unvan", v.title)) +
              _eIn("edit-vcard-company", "Şirket / Marka", v.company);
        const avatar = safeAttrUrl(v.avatar_url);
        return head +
            _eRow2(_eIn("edit-vcard-phone", "Cep Telefonu", v.phone), _eIn("edit-vcard-phone2", "İş Telefonu", v.phone2)) +
            _eRow2(_eIn("edit-vcard-email", "E-posta", v.email, { type: "email" }), _eIn("edit-vcard-website", "Web Sitesi", v.website, { ph: "siteniz.com" })) +
            _eIn("edit-vcard-address", "Adres / Şehir", v.address) + _eArea("edit-vcard-bio", "Biyografi / Hakkında", v.bio, 2) +
            `<div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:14px;">
                <h4 style="color:#38bdf8;margin:0 0 12px;font-size:13px;">${isCompany ? "🖼️ Şirket Logosu" : "📷 Profil Fotoğrafı"}</h4>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <label for="edit-vcard-avatar-file" class="btn-secondary" style="padding:10px 14px;font-size:12px;font-weight:700;cursor:pointer;border-radius:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;display:inline-flex;align-items:center;gap:6px;margin:0;">${isCompany ? "🖼️ Logo Seç / Yükle" : "📷 Profil Fotoğrafı Seç / Yükle"}</label>
                    <input type="file" id="edit-vcard-avatar-file" accept="image/*" style="display:none;" onchange="handleEditAvatarUpload(this)">
                    <input type="hidden" id="edit-vcard-avatar-url" value="${escapeHtml(v.avatar_url || "")}">
                    <img id="edit-vcard-avatar-preview" alt="" ${avatar ? `src="${escapeHtml(avatar)}"` : ""} style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #6366f1;display:${avatar ? "block" : "none"};">
                </div>
                <div id="edit-vcard-avatar-status" style="font-size:11px;color:#94a3b8;margin-top:4px;">${avatar ? "✅ Mevcut görsel yüklü." : "İsteğe bağlı."}</div>
            </div>` +
            _themeBlock(_parseTheme(v.theme_settings)) +
            `<div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:14px;"><h4 style="color:#f472b6;margin:0 0 12px;font-size:13px;">🌐 Sosyal Medya Profilleri</h4>${_eSocialGrid(soc)}</div>`;
    }
    if (MENU_TYPES.includes(t)) {
        const m = data.menu || {};
        const isPdf = t === "pdf_viewer";
        return `<h4 style="color:var(--accent);margin:0 0 14px;font-size:14px;">${isPdf ? "📄 PDF Belge Görüntüleyici Ayarları" : "📖 Online Katalog & Dijital Menü Ayarları"}</h4>` +
            _eIn("edit-menu-title", isPdf ? "Belge / Dosya Adı" : "Mekan / İşletme Adı", m.title, { ph: isPdf ? "Örn: Ürün Kullanım Kılavuzu.pdf" : "Örn: Lezzet Cafe" }) +
            _eIn("edit-menu-desc", isPdf ? "Belge Açıklaması / Not" : "Açıklama / Slogan", m.description) +
            `<div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:14px;"><h4 style="color:#818cf8;margin:0 0 12px;font-size:13px;">${isPdf ? "📇 Belge Sahibi & İletişim" : "📇 İşletme İletişim Bilgileri"}</h4>` +
            _eRow2(_eIn("edit-menu-contact-name", "Yetkili Adı / İsim", m.contact_name, { small: true }), _eIn("edit-menu-contact-title", "Unvan / Görev", m.contact_title, { small: true })) +
            _eRow2(_eIn("edit-menu-phone", "Telefon", m.phone, { small: true }), _eIn("edit-menu-email", "E-posta", m.email, { small: true, type: "email" })) +
            _eIn("edit-menu-website", "Web Sitesi", m.website, { small: true, ph: "siteniz.com" }) +
            _eIn("edit-menu-address", "Adres / Şehir", m.address, { small: true, last: true }) + `</div>`;
    }
    return _eIn("edit-target-url", "İçerik", data.target_url, { last: true });
}

async function openEditQRModal(qrId) {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        uiToast("QR kodunu düzenlemek için lütfen önce giriş yapın.");
        openModal("auth-modal");
        return;
    }
    const saveBtn = byId("edit-qr-save-btn");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = "💾 Değişiklikleri Kaydet"; }
    byId("edit-qr-id").value = qrId;
    byId("edit-qr-title").value = "Yükleniyor...";
    byId("edit-qr-folder").value = "";
    byId("edit-qr-dynamic-fields").textContent = "Veriler yükleniyor...";
    clearFieldErrors(byId("modal-edit-qr"));
    openModal("modal-edit-qr");

    try {
        const res = await fetch(`/api/qr/${encodeURIComponent(qrId)}/details`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            uiToast(data.error || "QR detayları alınamadı.");
            closeModal("modal-edit-qr");
            return;
        }
        currentEditQRType = data.type;
        byId("edit-qr-modal-header").innerText = `QR Kodu Düzenle (${data.title || ""})`;
        byId("edit-qr-title").value = data.title || "";
        byId("edit-qr-folder").value = data.folder_name || "Genel";
        byId("edit-qr-dynamic-fields").innerHTML = _editHTML(data);
    } catch (err) {
        console.error("QR details error:", err);
        uiToast("Bağlantı hatası oluştu.");
        closeModal("modal-edit-qr");
    }
}

const _EDIT_KEY_TO_ID = {
    target_url: () => "edit-target-url",
    phone: (t) => t === "sms" || t === "phone" ? "edit-static-phone" : (WA_TYPES.includes(t) ? "edit-wa-phone" : "edit-vcard-phone"),
    message: (t) => WA_TYPES.includes(t) ? "edit-wa-msg" : "edit-static-message",
    text: () => "edit-static-text", ssid: () => "edit-wifi-ssid", password: () => "edit-wifi-pass",
    full_name: () => "edit-vcard-name", company_name: () => "edit-vcard-company",
    social: (t) => SOCIAL_SINGLE_TYPES.includes(t) ? "edit-vcard-primary-social" : "edit-vcard-social-instagram"
};
function _applyEditServerErrors(data, type) {
    if (!data || !data.field_errors || typeof data.field_errors !== "object") return false;
    const loose = [];
    Object.entries(data.field_errors).forEach(([k, msg]) => {
        const id = _EDIT_KEY_TO_ID[k] ? _EDIT_KEY_TO_ID[k](type) : null;
        if (!(id && showFieldError(id, String(msg)))) loose.push(String(msg));
    });
    focusFirstError();
    uiToast("⚠️ " + (loose.length ? loose.join(" ") : (data.error || "Lütfen işaretli alanları düzeltin.")));
    return true;
}

function _eVal(id) { return fVal(id); }

// Düzenleme formunu doğrula + payload üret. {errors:[{id,msg}], body:{}}
function _buildEditBody(t) {
    const errs = [];
    const body = {};
    const add = (id, msg) => errs.push({ id, msg });
    if (t === "url" || t === "static_url") {
        const r = validateUrl(_eVal("edit-target-url"));
        if (!r.ok) add("edit-target-url", r.error);
        body.target_url = _eVal("edit-target-url");
    } else if (t === "phone" || t === "sms") {
        const raw = _eVal("edit-static-phone");
        if (!raw) add("edit-static-phone", "Lütfen telefon numarasını girin.");
        else if (!isValidPhone(raw)) add("edit-static-phone", "Geçerli bir telefon numarası girin (örn: +90 537 627 44 15).");
        body.static_payload = t === "phone" ? { phone: raw } : { phone: raw, message: _eVal("edit-static-message") };
    } else if (t === "text") {
        if (!_eVal("edit-static-text")) add("edit-static-text", "Metin boş olamaz.");
        body.static_payload = { text: _eVal("edit-static-text") };
    } else if (t === "wifi") {
        const enc = _eVal("edit-wifi-enc") || "WPA";
        const pass = byId("edit-wifi-pass") ? byId("edit-wifi-pass").value : "";
        if (!_eVal("edit-wifi-ssid")) add("edit-wifi-ssid", "Lütfen Wi-Fi ağ adını (SSID) girin.");
        if (enc !== "nopass") {
            if (!pass) add("edit-wifi-pass", "Şifre boş olamaz. Şifresiz ağ için 'Şifresiz' seçin.");
            else if (enc === "WPA" && pass.length < 8) add("edit-wifi-pass", "WPA/WPA2 şifresi en az 8 karakter olmalıdır.");
        }
        body.static_payload = { ssid: _eVal("edit-wifi-ssid"), password: enc === "nopass" ? "" : pass, encryption: enc, hidden: fChecked("edit-wifi-hidden") };
    } else if (WA_TYPES.includes(t)) {
        const raw = _eVal("edit-wa-phone");
        if (!raw) add("edit-wa-phone", "Lütfen WhatsApp numarasını girin.");
        else if (!isValidWaNumber(normalizePhoneForWa(raw))) add("edit-wa-phone", "Geçerli bir WhatsApp numarası girin (örn: +90 537 627 44 15).");
        body.wa_payload = { phone: raw, message: _eVal("edit-wa-msg") };
    } else if (SOCIAL_SINGLE_TYPES.includes(t)) {
        const raw = _eVal("edit-vcard-primary-social");
        const n = normalizeSocial(t, raw);
        if (!n) add("edit-vcard-primary-social", raw ? socialErrorText(t) : "Lütfen profil bağlantınızı veya kullanıcı adınızı girin.");
        body.vcard_payload = { social_links: { [t]: n } };
    } else if (t === "social" || t === "vcard" || t === "company_card") {
        const links = {};
        let any = false;
        SOCIAL_PLATFORMS.forEach(p => {
            const raw = _eVal("edit-vcard-social-" + p);
            const n = normalizeSocial(p, raw);
            if (raw && !n) add("edit-vcard-social-" + p, socialErrorText(p));
            if (n) any = true;
            links[p] = n || "";
        });
        if (t === "social") {
            if (!any && !errs.length) add("edit-vcard-social-instagram", "En az bir sosyal medya hesabı girin.");
            body.vcard_payload = { social_links: links };
        } else {
            const vp = {
                full_name: _eVal("edit-vcard-name"), title: _eVal("edit-vcard-title"), company: _eVal("edit-vcard-company"),
                phone: _eVal("edit-vcard-phone"), phone2: _eVal("edit-vcard-phone2"), email: _eVal("edit-vcard-email"),
                website: _eVal("edit-vcard-website"), address: _eVal("edit-vcard-address"), bio: _eVal("edit-vcard-bio"),
                avatar_url: _eVal("edit-vcard-avatar-url"), social_links: links,
                theme_settings: JSON.stringify({ theme: _eVal("edit-vcard-theme-select") || "midnight", primary_color: _eVal("edit-vcard-primary-color") || "#6366f1" })
            };
            if (t === "vcard") {
                if (!vp.full_name) add("edit-vcard-name", "Lütfen ad soyad girin.");
            } else {
                if (!vp.company) add("edit-vcard-company", "Lütfen şirket adını girin.");
                const maps = _eVal("edit-comp-maps");
                if (maps) { const r = validateUrl(maps); if (!r.ok) add("edit-comp-maps", r.error); }
                const ci = Object.assign({}, editCompanyInfo, {
                    name: vp.company, logo_url: vp.avatar_url, sector: _eVal("edit-comp-sector"),
                    tax_office: _eVal("edit-comp-tax-office"), tax_no: _eVal("edit-comp-tax-no"),
                    working_hours: byId("edit-comp-hours") ? byId("edit-comp-hours").value.trim() : "", maps_url: maps
                });
                if (!ci.contacts) ci.contacts = [];
                if (!vp.full_name) vp.full_name = (ci.contacts[0] && ci.contacts[0].name) || vp.company;
                vp.company_info = ci;
            }
            body.vcard_payload = vp;
        }
    } else if (MENU_TYPES.includes(t)) {
        body.menu_payload = {
            title: _eVal("edit-menu-title"), description: _eVal("edit-menu-desc"),
            contact_name: _eVal("edit-menu-contact-name"), contact_title: _eVal("edit-menu-contact-title"),
            phone: _eVal("edit-menu-phone"), email: _eVal("edit-menu-email"),
            website: _eVal("edit-menu-website"), address: _eVal("edit-menu-address")
        };
    }
    return { errors: errs, body };
}

async function saveQREdit(event) {
    event.preventDefault();
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    const modal = byId("modal-edit-qr");
    clearFieldErrors(modal);

    const built = _buildEditBody(currentEditQRType);
    if (built.errors.length) {
        built.errors.forEach(e => showFieldError(e.id, e.msg));
        focusFirstError();
        uiToast("⚠️ Lütfen işaretli alanları düzeltin.");
        return;
    }
    const qrId = byId("edit-qr-id").value;
    const payload = Object.assign({ title: byId("edit-qr-title").value.trim(), folder_name: byId("edit-qr-folder").value.trim() }, built.body);

    const saveBtn = byId("edit-qr-save-btn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = "Kaydediliyor..."; }
    try {
        const res = await fetch(`/api/qr/${encodeURIComponent(qrId)}/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === "success") {
            if (payload.folder_name) customFolders.add(payload.folder_name);
            closeModal("modal-edit-qr");
            uiToast("✅ QR Kodu başarıyla güncellendi!");
            loadDashboardData();
        } else if (!_applyEditServerErrors(data, currentEditQRType)) {
            uiToast("⚠️ " + (data.error || "Güncelleme kaydedilemedi."));
        }
    } catch (err) {
        console.error("Save edit error:", err);
        uiToast("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = "💾 Değişiklikleri Kaydet"; }
    }
}

// ---------------------------------------------------------------------------
// Panel v2: araç çubuğu (arama + filtreler), kartlar, boş durum
// ---------------------------------------------------------------------------
let panelSearchTerm = "";
let panelTypeFilter = "all";

function _isAutoSelect(el) { return el && (el.dataset.auto === "1" || el.options.length <= 1); }

function ensurePanelToolbar(container) {
    if (!container || !container.parentNode) return;
    // Yalnızca HTML'de OLMAYAN elemanlar için araç çubuğu üretilir (çift oluşturma yok)
    if (!byId("panel-toolbar")) {
        let html = "";
        if (!byId("panel-search")) {
            html += `<div class="pn-search">${suIcon("search")}<input type="search" id="panel-search" placeholder="QR başlığında ara" aria-label="QR başlığında ara" autocomplete="off"></div>`;
        }
        if (!byId("filter-type")) html += `<select id="filter-type" data-auto="1" aria-label="Türe göre filtrele"></select>`;
        if (!byId("filter-folder") && !byId("folder-filter-select")) html += `<select id="filter-folder" data-auto="1" aria-label="Klasöre göre filtrele"></select>`;
        if (!byId("filter-status") && !document.querySelector(".filter-tab-btn")) html += `<select id="filter-status" data-auto="1" aria-label="Duruma göre filtrele"></select>`;
        if (html) {
            const tb = document.createElement("div");
            tb.id = "panel-toolbar";
            tb.className = "pn-toolbar";
            tb.setAttribute("role", "search");
            tb.innerHTML = html;
            container.parentNode.insertBefore(tb, container);
        }
    }
    const search = byId("panel-search");
    if (search && !search._pnBound) {
        search._pnBound = true;
        let t = null;
        search.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(() => { panelSearchTerm = search.value; renderQRList(allQRCodes); }, 150);
        });
    }
    const typeSel = byId("filter-type");
    if (typeSel && !typeSel._pnBound) {
        typeSel._pnBound = true;
        typeSel.addEventListener("change", () => { panelTypeFilter = typeSel.value || "all"; renderQRList(allQRCodes); });
    }
    const folderSel = byId("filter-folder");
    if (folderSel && !folderSel._pnBound) {
        folderSel._pnBound = true;
        folderSel.addEventListener("change", () => filterQRList("folder", folderSel.value || "all"));
    }
    const statusSel = byId("filter-status");
    if (statusSel && !statusSel._pnBound) {
        statusSel._pnBound = true;
        statusSel.addEventListener("change", () => filterQRList("status", statusSel.value || "all"));
    }
}

function syncPanelFilters(codes) {
    const live = codes.filter(q => (q.status || "active") !== "deleted");
    const typeSel = byId("filter-type");
    if (typeSel) {
        if (_isAutoSelect(typeSel)) {
            const types = Array.from(new Set(codes.map(q => q.type).filter(Boolean)));
            typeSel.innerHTML = `<option value="all">Tüm türler</option>` +
                types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(QR_TYPE_LABELS[t] || t)}</option>`).join("");
            typeSel.dataset.auto = "1";
        }
        if (!Array.from(typeSel.options).some(o => o.value === panelTypeFilter)) panelTypeFilter = "all";
        typeSel.value = panelTypeFilter;
    }
    const folderSel = byId("filter-folder");
    if (folderSel) {
        if (_isAutoSelect(folderSel)) {
            const set = new Set(["Genel"]);
            customFolders.forEach(f => set.add(f));
            live.forEach(q => { if (q.folder_name) set.add(q.folder_name); });
            folderSel.innerHTML = `<option value="all">Tüm klasörler (${live.length})</option>` +
                Array.from(set).map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)} (${live.filter(q => (q.folder_name || "Genel") === f).length})</option>`).join("");
            folderSel.dataset.auto = "1";
        }
        if (Array.from(folderSel.options).some(o => o.value === currentFolderFilter)) folderSel.value = currentFolderFilter;
    }
    const statusSel = byId("filter-status");
    if (statusSel) {
        if (_isAutoSelect(statusSel)) {
            const c = (s) => codes.filter(q => (q.status || "active") === s).length;
            statusSel.innerHTML = `<option value="all">Tümü (${live.length})</option><option value="active">Aktif (${c("active")})</option>` +
                `<option value="passive">Pasif (${c("passive")})</option><option value="deleted">Arşiv (${c("deleted")})</option>`;
            statusSel.dataset.auto = "1";
        }
        if (Array.from(statusSel.options).some(o => o.value === currentStatusFilter)) statusSel.value = currentStatusFilter;
    }
}

const _EMPTY_ILLU = '<svg class="pn-illu" viewBox="0 0 160 160" fill="none" aria-hidden="true">' +
    '<rect x="22" y="22" width="116" height="116" rx="22" fill="rgba(99,102,241,.12)" stroke="rgba(129,140,248,.5)" stroke-width="2" stroke-dasharray="6 6"/>' +
    '<rect x="44" y="44" width="30" height="30" rx="6" fill="#818cf8"/><rect x="86" y="44" width="30" height="30" rx="6" fill="#6366f1"/>' +
    '<rect x="44" y="86" width="30" height="30" rx="6" fill="#6366f1"/><rect x="86" y="86" width="12" height="12" rx="3" fill="#a5b4fc"/>' +
    '<rect x="104" y="86" width="12" height="12" rx="3" fill="#818cf8"/><rect x="86" y="104" width="12" height="12" rx="3" fill="#818cf8"/>' +
    '<circle cx="124" cy="124" r="18" fill="#10b981"/><path d="M124 115v18M115 124h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>';

function renderPanelEmptyState(container) {
    const ext = byId("panel-empty-state");
    const tb = byId("panel-toolbar");
    if (tb) tb.style.display = "none";
    if (ext && !container.contains(ext)) {
        ext.style.display = "block";
        container.innerHTML = "";
        if (!ext._pnBound) {
            ext._pnBound = true;
            ext.addEventListener("click", (e) => {
                if (e.target.closest("#panel-empty-cta, [data-act=\"go-studio\"]")) _goTab("studio-tab");
            });
        }
        return;
    }
    container.innerHTML = `<div id="panel-empty-state" class="glass-card pn-empty">${_EMPTY_ILLU}` +
        `<h3>Henüz QR kodunuz yok</h3>` +
        `<p>İlk QR kodunuzu QR Stüdyosu'nda dakikalar içinde oluşturabilir, tarama istatistiklerini buradan takip edebilirsiniz.</p>` +
        `<button type="button" class="su-btn primary" data-act="go-studio">${suIcon("plus")}<span>İlk QR'ınızı oluşturun</span></button></div>`;
}

function _qrCardHTML(qr, codes) {
    const id = Number(qr.id);
    const isStatic = isStaticType(qr.type) || qr.is_dynamic === false || qr.is_dynamic === 0;
    const shareUrl = qr.short_url || (qr.short_code ? `${window.location.origin}/r/${qr.short_code}` : "");
    const status = qr.status || "active";
    const deleted = status === "deleted";
    const createdDate = new Date((qr.created_at || Date.now() / 1000) * 1000).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const typeLabel = QR_TYPE_LABELS[qr.type] || String(qr.type || "QR");
    const img = safeAttrUrl(qr.qr_image);
    const title = qr.title || "Adsız QR";
    const total = Number(qr.scan_count || qr.scans_count) || 0;
    const unique = Number(qr.unique_scans) || 0;

    const linkRow = isStatic
        ? `<span>Statik QR: link yok</span>`
        : `<code title="${escapeHtml(shareUrl)}">${escapeHtml(shareUrl)}</code>` +
          `<button type="button" class="pn-copy" data-act="copy" data-url="${escapeHtml(shareUrl)}" aria-label="${escapeHtml(title)} bağlantısını kopyala">${suIcon("copy")}<span>Kopyala</span></button>`;

    let side = "";
    if (!deleted) {
        const state = isStatic
            ? `<span class="inf">Süresiz</span>`
            : `<span class="${status === "active" ? "on" : "off"}">${status === "active" ? "Aktif" : "Pasif"}</span>` +
              `<label class="switch" style="width:40px;height:22px;"><input type="checkbox" ${status === "active" ? "checked" : ""} data-act="toggle" data-id="${id}" aria-label="${escapeHtml(title)} durumunu değiştir"><span class="slider" style="border-radius:20px;"></span></label>`;
        const scans = isStatic
            ? `<div class="pn-scans">Takip edilemez</div>`
            : `<div class="pn-scans"><strong>${total.toLocaleString("tr-TR")}</strong> tarama${unique ? ` · ${unique.toLocaleString("tr-TR")} eşsiz` : ""}</div>`;
        side = `<div class="pn-side"><div class="pn-state">${state}</div>${scans}</div>`;
    }

    const folderSelect = deleted ? "" :
        `<label>Klasör: <select data-act="folder" data-id="${id}" aria-label="Klasör">${getCardFolderSelectOptionsHTML(qr.folder_name || "Genel", codes)}</select></label>`;

    const actions = deleted
        ? `<button type="button" class="pn-btn ok" data-act="restore" data-id="${id}">${suIcon("undo")}<span>Geri yükle</span></button>` +
          `<button type="button" class="pn-btn danger" data-act="perm-delete" data-id="${id}">${suIcon("trash")}<span>Kalıcı sil</span></button>`
        : `<button type="button" class="pn-btn primary" data-act="edit" data-id="${id}" title="QR kodunu düzenle">${suIcon("edit")}<span>Düzenle</span></button>` +
          (isStatic ? "" : `<button type="button" class="pn-btn" data-act="analytics" data-id="${id}">${suIcon("chart")}<span>Analitik</span></button>`) +
          `<button type="button" class="pn-btn" data-act="menu" data-menu="dl" data-id="${id}" aria-haspopup="menu" aria-expanded="false">${suIcon("download")}<span>İndir</span></button>` +
          `<span class="pn-spacer"></span>` +
          `<button type="button" class="pn-btn" data-act="menu" data-menu="more" data-id="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="Diğer işlemler">${suIcon("more")}</button>`;

    return `<article class="glass-card pn-card${deleted ? " is-deleted" : ""}" aria-label="${escapeHtml(title)}">
        <div class="pn-top">
            <div class="pn-thumb">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(title)} QR kodu">` : `<span></span>`}</div>
            <div class="pn-main">
                <div class="pn-title-row">
                    <h4 class="pn-title">${escapeHtml(title)}</h4>
                    <span class="pn-badge">${escapeHtml(typeLabel)}</span>
                    <span class="pn-badge ${isStatic ? "sta" : "dyn"}">${isStatic ? "Statik" : "Dinamik"}</span>
                    ${deleted ? '<span class="pn-badge arc">Arşivlendi</span>' : ""}
                </div>
                <div class="pn-link">${linkRow}</div>
            </div>
            ${side}
        </div>
        <div class="pn-meta">${folderSelect}<span>Oluşturulma: ${escapeHtml(createdDate)}</span></div>
        <div class="pn-actions">${actions}</div>
    </article>`;
}

function renderQRList(codes) {
    const container = byId("qr-list-container");
    if (!container) return;
    initPanelDelegation();
    closePanelMenu(false);
    if (!codes) codes = [];

    ensurePanelToolbar(container);
    updateFilterCountsAndTabLabels(codes);
    populateFolderFilterSelect(codes);
    syncPanelFilters(codes);

    const ext = byId("panel-empty-state");
    if (codes.length === 0) { renderPanelEmptyState(container); return; }
    if (ext && !container.contains(ext)) ext.style.display = "none";
    const tb = byId("panel-toolbar");
    if (tb) tb.style.display = "";

    let filtered = codes;
    if (currentStatusFilter === "all") filtered = filtered.filter(qr => (qr.status || "active") !== "deleted");
    else filtered = filtered.filter(qr => (qr.status || "active") === currentStatusFilter);
    if (currentFolderFilter !== "all") filtered = filtered.filter(qr => (qr.folder_name || "Genel") === currentFolderFilter);
    if (panelTypeFilter !== "all") filtered = filtered.filter(qr => qr.type === panelTypeFilter);
    const term = String(panelSearchTerm || "").trim().toLocaleLowerCase("tr");
    if (term) filtered = filtered.filter(qr => String(qr.title || "").toLocaleLowerCase("tr").includes(term));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="glass-card pn-noresult" role="status">Sonuç bulunamadı. Arama veya filtreleri değiştirerek tekrar deneyin.</div>`;
        return;
    }
    container.innerHTML = filtered.map(qr => _qrCardHTML(qr, allQRCodes)).join("");
}

function copyShareLink(url, btn) {
    uiCopyText(url).then((ok) => {
        if (!ok) { uiShowText("Paylaşım bağlantınız", url); return; }
        if (!btn) { uiToast("Bağlantı kopyalandı.", "success"); return; }
        const label = btn.querySelector("span");
        const orig = label ? label.textContent : btn.innerText;
        if (label) label.textContent = "Kopyalandı"; else btn.innerText = "Kopyalandı";
        btn.classList.add("is-ok");
        clearTimeout(btn._t);
        btn._t = setTimeout(() => {
            if (label) label.textContent = orig; else btn.innerText = orig;
            btn.classList.remove("is-ok");
        }, 2000);
    });
}

// ---------------------------------------------------------------------------
// Markalı onaylı arşivleme / kalıcı silme (app.js'tekilerin yerini alır)
// ---------------------------------------------------------------------------
async function deleteQRCode(qrId) {
    const qr = qrById(qrId) || {};
    const ok = await confirmDialog({
        title: "QR kodunu arşive kaldır",
        message: `“${qr.title || "Bu QR kod"}” arşive taşınacak. Dilerseniz daha sonra geri yükleyebilirsiniz.`,
        confirmText: "Arşive kaldır",
        danger: true
    });
    if (!ok) return;
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    try {
        const res = await fetch(`/api/qr/${qrId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) uiToast("QR kod arşive taşındı.", "success");
        else uiToast("QR kod arşive taşınamadı. Lütfen tekrar deneyin.", "error");
        loadDashboardData();
    } catch (err) {
        console.error("Delete error:", err);
        uiToast("Bağlantı hatası oluştu. Lütfen tekrar deneyin.", "error");
    }
}

async function permanentDeleteQRCode(qrId) {
    const qr = qrById(qrId) || {};
    const ok = await confirmDialog({
        title: "QR kodunu kalıcı olarak sil",
        message: `“${qr.title || "Bu QR kod"}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
        confirmText: "Kalıcı olarak sil",
        danger: true
    });
    if (!ok) return;
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    try {
        const res = await fetch(`/api/qr/${qrId}/permanent_delete`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) uiToast("QR kod kalıcı olarak silindi.", "success");
        else uiToast("QR kod silinemedi. Lütfen tekrar deneyin.", "error");
        loadDashboardData();
    } catch (err) {
        console.error("Permanent delete error:", err);
        uiToast("Bağlantı hatası oluştu. Lütfen tekrar deneyin.", "error");
    }
}

