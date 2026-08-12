let allUsersCache = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAdminData();
});

function getAuthHeader() {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        window.location.href = "/panel";
        return null;
    }
    return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
}

async function loadAdminData() {
    const headers = getAuthHeader();
    if (!headers) return;

    try {
        // Load Stats
        const resStats = await fetch("/api/admin/stats", { headers });
        if (resStats.status === 403) {
            alert("⚠️ Erişim engellendi. Yönetici yetkiniz bulunmamaktadır.");
            window.location.href = "/panel";
            return;
        }
        if (resStats.ok) {
            const dataStats = await resStats.json();
            document.getElementById("stat-total-users").innerText = dataStats.total_users || 0;
            document.getElementById("stat-paid-users").innerText = dataStats.active_paid_users || 0;
            document.getElementById("stat-new-users").innerText = dataStats.new_users_this_month || 0;
            document.getElementById("stat-total-qrs").innerText = dataStats.total_qr_codes || 0;
            document.getElementById("stat-total-scans").innerText = dataStats.total_scans || 0;
        }

        // Load Users
        const resUsers = await fetch("/api/admin/users", { headers });
        if (resUsers.ok) {
            const dataUsers = await resUsers.json();
            allUsersCache = dataUsers.users || [];
            renderAdminUsersTable(allUsersCache);
        }

        // Load Audit Logs
        const resLogs = await fetch("/api/admin/audit-logs", { headers });
        if (resLogs.ok) {
            const dataLogs = await resLogs.json();
            renderAdminAuditLogs(dataLogs.audit_logs || []);
        }
    } catch (err) {
        console.error("Admin data load error:", err);
    }
}

function filterAdminUsers() {
    const q = (document.getElementById("admin-search-input").value || "").toLowerCase().strip?.() || document.getElementById("admin-search-input").value.toLowerCase().trim();
    const plan = document.getElementById("admin-filter-plan").value;
    const status = document.getElementById("admin-filter-status").value;

    const filtered = allUsersCache.filter(u => {
        const matchesQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchesPlan = !plan || u.plan === plan;
        const matchesStatus = !status || u.account_status === status;
        return matchesQ && matchesPlan && matchesStatus;
    });

    renderAdminUsersTable(filtered);
}

function formatDate(timestamp) {
    if (!timestamp || timestamp === 0) return "-";
    const dt = new Date(timestamp * 1000);
    return dt.toLocaleDateString("tr-TR", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderAdminUsersTable(users) {
    const tbody = document.getElementById("admin-users-tbody");
    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">Hiç kullanıcı bulunamadı.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const planClass = `badge-${u.plan || 'free'}`;
        const statusClass = u.account_status === 'suspended' ? 'badge-suspended' : 'badge-active';
        const statusText = u.account_status === 'suspended' ? '🚫 ASKIDA' : '✅ AKTİF';
        
        let suspendBtn = u.account_status === 'suspended' 
            ? `<button class="btn-action btn-activate" onclick="activateUser(${u.id}, '${u.email}')">Aktif Et</button>`
            : `<button class="btn-action btn-suspend" onclick="suspendUser(${u.id}, '${u.email}')">Askıya Al</button>`;

        return `
            <tr>
                <td>#${u.id}</td>
                <td>
                    <div style="font-weight: 800; color: white;">${u.name} ${u.is_admin ? '<span style="color: #facc15; font-size: 11px;">[ADMIN]</span>' : ''}</div>
                    <div style="font-size: 12px; color: #94a3b8;">${u.email}</div>
                </td>
                <td><span class="admin-badge ${planClass}">${(u.plan || 'free').toUpperCase()}</span></td>
                <td style="font-size: 13px;">${formatDate(u.subscription_end)}</td>
                <td style="font-weight: 700; color: #facc15;">${u.total_qr_count || 0} QR</td>
                <td><span class="admin-badge ${statusClass}">${statusText}</span></td>
                <td style="font-size: 13px;">${formatDate(u.created_at)}</td>
                <td>
                    <button class="btn-action btn-view" onclick="openUserDetailModal(${u.id})">Detay</button>
                    <button class="btn-action btn-plan" onclick="openPlanUpdateModal(${u.id}, '${u.email}', '${u.plan}')">Plan Değiştir</button>
                    ${suspendBtn}
                    <button class="btn-action btn-delete" onclick="openDeleteUserModal(${u.id}, '${u.email}')">Sil</button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderAdminAuditLogs(logs) {
    const tbody = document.getElementById("admin-logs-tbody");
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">Henüz işlem kaydı yok.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => {
        return `
            <tr>
                <td>#${l.id}</td>
                <td>
                    <div style="font-weight: 700;">${l.admin_name || 'Sistem'}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${l.admin_email || ''}</div>
                </td>
                <td><span class="admin-badge badge-starter">${l.action_type}</span></td>
                <td>${l.target_name ? `<strong>${l.target_name}</strong> (${l.target_email})` : `#${l.target_user_id || '-'}`}</td>
                <td style="font-size: 13px; color: #cbd5e1;">${l.details || ''}</td>
                <td style="font-size: 12px; color: #94a3b8;">${formatDate(l.created_at)}</td>
            </tr>
        `;
    }).join("");
}

async function openUserDetailModal(userId) {
    const headers = getAuthHeader();
    if (!headers) return;
    openModal('modal-user-detail');
    const container = document.getElementById("user-detail-content");
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #94a3b8;">Kullanıcı detayları getiriliyor...</div>`;

    try {
        const res = await fetch(`/api/admin/users/${userId}`, { headers });
        if (!res.ok) {
            container.innerHTML = `<div style="color: #ef4444;">Detaylar yüklenemedi.</div>`;
            return;
        }
        const data = await res.json();
        const u = data.user;
        const qrs = data.qr_codes || [];
        const subs = data.subscriptions || [];

        container.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.6); padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 16px; font-weight: 800; color: white;">${u.name}</div>
                <div style="font-size: 13px; color: #94a3b8;">E-posta: ${u.email} | ID: #${u.id}</div>
                <div style="margin-top: 8px; font-size: 13px;">
                    Aktif Plan: <strong style="color: #818cf8;">${u.plan.toUpperCase()}</strong> | 
                    QR Limiti: <strong>${u.dynamic_qr_limit}</strong> | 
                    Bitiş: <strong>${formatDate(u.subscription_end)}</strong>
                </div>
            </div>

            <h4 style="font-size: 15px; margin-bottom: 10px; color: #facc15;">📱 Oluşturulan QR Kodlar (${qrs.length})</h4>
            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
                ${qrs.length === 0 ? '<div style="font-size: 13px; color: #94a3b8;">Henüz QR kod oluşturulmamış.</div>' : 
                `<table style="width: 100%; font-size: 13px;">
                    <tr style="text-align: left; color: #94a3b8;"><th>Başlık</th><th>Tür</th><th>Kısa Kod</th><th>Tarama</th></tr>
                    ${qrs.map(q => `<tr><td>${q.title}</td><td>${q.type}</td><td><code>/r/${q.short_code}</code></td><td>${q.scans_count}</td></tr>`).join("")}
                </table>`}
            </div>

            <h4 style="font-size: 15px; margin-bottom: 10px; color: #34d399;">💳 Ödeme ve Abonelik Geçmişi (${subs.length})</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                ${subs.length === 0 ? '<div style="font-size: 13px; color: #94a3b8;">Henüz ödeme kaydı bulunmuyor.</div>' :
                `<table style="width: 100%; font-size: 13px;">
                    <tr style="text-align: left; color: #94a3b8;"><th>Paket</th><th>Tutar</th><th>Fatura No</th><th>Tarih</th></tr>
                    ${subs.map(s => `<tr><td>${s.plan_name}</td><td>${s.amount} ₺</td><td>${s.invoice_no || '-'}</td><td>${formatDate(s.created_at)}</td></tr>`).join("")}
                </table>`}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="color: #ef4444;">Hata oluştu.</div>`;
    }
}

function openPlanUpdateModal(userId, email, currentPlan) {
    document.getElementById("plan-modal-user-id").value = userId;
    document.getElementById("plan-modal-user-info").innerText = `${email} (Mevcut: ${currentPlan.toUpperCase()})`;
    document.getElementById("plan-modal-select").value = currentPlan;
    openModal("modal-update-plan");
}

async function submitPlanUpdate() {
    const userId = document.getElementById("plan-modal-user-id").value;
    const plan = document.getElementById("plan-modal-select").value;
    const days = parseInt(document.getElementById("plan-modal-days").value || "30");

    const headers = getAuthHeader();
    if (!headers) return;

    try {
        const res = await fetch(`/api/admin/users/${userId}/update-plan`, {
            method: "POST",
            headers,
            body: JSON.stringify({ plan, days })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            closeModal("modal-update-plan");
            loadAdminData();
        } else {
            alert("⚠️ " + (data.error || "Güncelleme başarısız."));
        }
    } catch (err) {
        alert("Hata oluştu.");
    }
}

async function suspendUser(userId, email) {
    if (!confirm(`"${email}" kullanıcısını askıya almak istediğinize emin misiniz?\nKullanıcı giriş yapamayacaktır.`)) return;
    const headers = getAuthHeader();
    if (!headers) return;

    try {
        const res = await fetch(`/api/admin/users/${userId}/suspend`, { method: "POST", headers });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            loadAdminData();
        } else {
            alert("⚠️ " + (data.error || "İşlem başarısız."));
        }
    } catch (err) {
        alert("Hata oluştu.");
    }
}

async function activateUser(userId, email) {
    if (!confirm(`"${email}" kullanıcısının hesabını tekrar aktif etmek istediğinize emin misiniz?`)) return;
    const headers = getAuthHeader();
    if (!headers) return;

    try {
        const res = await fetch(`/api/admin/users/${userId}/activate`, { method: "POST", headers });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            loadAdminData();
        } else {
            alert("⚠️ " + (data.error || "İşlem başarısız."));
        }
    } catch (err) {
        alert("Hata oluştu.");
    }
}

function openDeleteUserModal(userId, email) {
    document.getElementById("delete-modal-user-id").value = userId;
    document.getElementById("delete-modal-expected-email").value = email;
    document.getElementById("delete-modal-email-display").innerText = email;
    document.getElementById("delete-modal-confirm-input").value = "";
    openModal("modal-delete-user");
}

async function submitUserDelete() {
    const userId = document.getElementById("delete-modal-user-id").value;
    const expected = document.getElementById("delete-modal-expected-email").value.trim().toLowerCase();
    const typed = document.getElementById("delete-modal-confirm-input").value.trim().toLowerCase();

    if (typed !== expected) {
        alert("⚠️ E-posta adresi uyuşmuyor! Lütfen onaylamak için tam e-posta adresini yazın.");
        return;
    }

    const headers = getAuthHeader();
    if (!headers) return;

    try {
        const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", headers });
        const data = await res.json();
        if (res.ok) {
            alert("✅ " + data.message);
            closeModal("modal-delete-user");
            loadAdminData();
        } else {
            alert("⚠️ " + (data.error || "Silme işlemi başarısız."));
        }
    } catch (err) {
        alert("Hata oluştu.");
    }
}

function openModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

function logoutAdmin() {
    localStorage.removeItem("jwt_token");
    window.location.href = "/panel";
}
