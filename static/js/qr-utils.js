/*!
 * QR Studio — ortak istemci yardımcıları.
 * Sunucu karşılığı: qr_utils.py (davranış birebir aynı tutulur; hata metinleri de aynıdır).
 * Global fonksiyonlar: escapeHtml, normalizeSocial, normalizeSocialLinks, normalizePhoneForWa,
 * isValidWaNumber, normalizePhoneE164, isValidPhone, validateUrl, wifiEscape, buildWifiContent,
 * buildPhoneContent, buildSmsContent, buildStaticContent, buildWhatsappUrl, contrastRatio ...
 */
(function (root) {
    "use strict";

    // ------------------------------------------------------------------
    // Genel
    // ------------------------------------------------------------------
    function escapeHtml(v) {
        return String(v == null ? "" : v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Python urllib.parse.quote karşılığı (UTF-8, güvenli karakter kümesi ile)
    function pyQuote(s, safe) {
        safe = safe == null ? "/" : safe;
        var out = "";
        var str = String(s == null ? "" : s);
        for (var i = 0; i < str.length; ) {
            var cp = str.codePointAt(i);
            var ch = String.fromCodePoint(cp);
            i += ch.length;
            if (/[A-Za-z0-9_.\-~]/.test(ch) || safe.indexOf(ch) !== -1) {
                out += ch;
            } else {
                try {
                    out += encodeURIComponent(ch).replace(/[!'()*]/g, function (c) {
                        return "%" + c.charCodeAt(0).toString(16).toUpperCase();
                    });
                } catch (e) { /* tek başına surrogate: atla */ }
            }
        }
        return out;
    }

    var DANGEROUS_SCHEME_RE = /^\s*(javascript|data|vbscript|file|blob)\s*:/i;

    // ------------------------------------------------------------------
    // Sosyal medya
    // ------------------------------------------------------------------
    var SOCIAL_BASES = {
        instagram: "https://instagram.com/",
        facebook: "https://facebook.com/",
        pinterest: "https://pinterest.com/",
        linkedin: "https://linkedin.com/in/",
        twitter: "https://x.com/",
        x: "https://x.com/",
        tiktok: "https://tiktok.com/@",
        youtube: "https://youtube.com/@"
    };
    var SOCIAL_LABELS = {
        instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", pinterest: "Pinterest",
        twitter: "X / Twitter", x: "X / Twitter", tiktok: "TikTok", youtube: "YouTube"
    };
    var DOMAIN_LIKE_RE = /^(?:www\.|m\.)?[^\s/@:]+\.[^\s/@:.]{2,}(?:[/?#:].*)?$/i;
    var USERNAME_RE = /^[\p{L}\p{N}_.\-]+$/u;

    function hostHasDot(url) {
        var host = "";
        try {
            host = new URL(url).hostname || "";
        } catch (e) {
            var m = /^https?:\/\/([^\/:?#]+)/i.exec(url);
            host = m ? m[1] : "";
        }
        return [host.indexOf(".") !== -1, host];
    }

    function normalizeSocial(platform, value) {
        platform = String(platform || "").toLowerCase().trim();
        var v = String(value == null ? "" : value).trim();
        if (!v) return "";
        if (DANGEROUS_SCHEME_RE.test(v)) return "";
        var base = SOCIAL_BASES[platform];

        if (/^https?:\/\//i.test(v)) {
            if (hostHasDot(v)[0]) return v;
            // https://kullanici veya https://@kullanici -> kullanıcı adı olarak ele al
            v = v.replace(/^https?:\/\//i, "");
            if (!base) return "";
        } else if (/^\/\//.test(v)) {
            v = "https:" + v;
            return hostHasDot(v)[0] ? v : "";
        }

        // alan adı gibi (instagram.com/kullanici, www.siteniz.com)
        if (DOMAIN_LIKE_RE.test(v)) return "https://" + v;

        if (!base) return "";

        var username = v.replace(/^@+/, "").trim().replace(/^\/+|\/+$/g, "");
        if (!username) return "";
        if (platform === "linkedin") {
            if (/^(in|company|school|pub)\//i.test(username)) {
                return "https://linkedin.com/" + pyQuote(username, "/._-%");
            }
            username = username.split("/")[0];
        } else if (username.indexOf("/") !== -1 &&
                   ["instagram", "tiktok", "youtube", "twitter", "x"].indexOf(platform) !== -1) {
            username = username.split("/")[0];
        }
        if (!username || !USERNAME_RE.test(username.replace(/\//g, ""))) {
            username = pyQuote(username, "/._-");
        }
        return base + username;
    }

    function normalizeSocialLinks(links) {
        var out = {};
        if (!links || typeof links !== "object" || Array.isArray(links)) return out;
        Object.keys(links).forEach(function (k) {
            var n = normalizeSocial(k, links[k]);
            if (n) out[k] = n;
        });
        return out;
    }

    // ------------------------------------------------------------------
    // Telefon
    // ------------------------------------------------------------------
    function normalizePhoneForWa(raw) {
        var digits = String(raw == null ? "" : raw).replace(/\D/g, "");
        if (!digits) return "";
        if (digits.indexOf("00") === 0) {
            digits = digits.slice(2);
        } else if (digits.charAt(0) === "0") {
            digits = "90" + digits.slice(1);
        } else if (digits.length === 10 && digits.charAt(0) === "5") {
            digits = "90" + digits;
        }
        return digits;
    }

    function isValidWaNumber(digits) {
        if (!digits || !/^\d+$/.test(digits)) return false;
        if (digits.indexOf("90") === 0) return digits.length === 12;
        return digits.length >= 10 && digits.length <= 15;
    }

    function normalizePhoneE164(raw) {
        var s = String(raw == null ? "" : raw).trim();
        if (!s) return "";
        var plus = s.charAt(0) === "+";
        var digits = s.replace(/\D/g, "");
        if (!digits) return "";
        if (plus) return "+" + digits;
        if (digits.indexOf("00") === 0) return "+" + digits.slice(2);
        if (digits.charAt(0) === "0") return "+90" + digits.slice(1);
        if (digits.length === 10 && digits.charAt(0) === "5") return "+90" + digits;
        if (digits.indexOf("90") === 0 && digits.length === 12) return "+" + digits;
        return digits.length >= 11 ? "+" + digits : digits;
    }

    function isValidPhone(raw) {
        var e164 = normalizePhoneE164(raw);
        var d = e164.replace(/\D/g, "");
        if (e164.indexOf("+90") === 0) return d.length === 12;
        return d.length >= 7 && d.length <= 15;
    }

    // ------------------------------------------------------------------
    // URL doğrulama
    // ------------------------------------------------------------------
    var HOST_RE = /^(?=.{1,253}$)([\p{L}\p{N}](?:[\p{L}\p{N}_\-]{0,61}[\p{L}\p{N}])?)(\.[\p{L}\p{N}](?:[\p{L}\p{N}_\-]{0,61}[\p{L}\p{N}])?)+$/u;
    var IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

    function validateUrl(raw, allowRelative) {
        var v = String(raw == null ? "" : raw).trim();
        if (!v) return { ok: false, url: "", error: "Lütfen bir web adresi girin." };
        if (DANGEROUS_SCHEME_RE.test(v)) {
            return { ok: false, url: "", error: "Güvenlik nedeniyle bu adres türü kabul edilmiyor. Lütfen http:// veya https:// ile başlayan bir adres girin." };
        }
        if (/\s/.test(v)) return { ok: false, url: "", error: "Web adresi boşluk içeremez." };
        if (allowRelative && v.charAt(0) === "/" && v.indexOf("//") !== 0) {
            return { ok: true, url: v, error: "" };
        }
        if (v.indexOf("//") === 0) v = "https:" + v;
        if (!/^https?:\/\//i.test(v)) {
            if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(v) || /^(mailto|tel|sms|ftp):/i.test(v)) {
                return { ok: false, url: "", error: "Sadece http:// veya https:// ile başlayan adresler kabul edilir." };
            }
            v = "https://" + v;
        }
        var host = "";
        try {
            var u = new URL(v);
            host = u.hostname || "";
        } catch (e) {
            return { ok: false, url: "", error: "Geçerli bir web adresi girin (örn: https://siteniz.com)." };
        }
        if (!host || host.indexOf(".") === -1 || !(HOST_RE.test(host) || IPV4_RE.test(host))) {
            return { ok: false, url: "", error: "Geçerli bir alan adı girin (örn: siteniz.com)." };
        }
        return { ok: true, url: v, error: "" };
    }

    // ------------------------------------------------------------------
    // Statik içerik (QR görseline doğrudan yazılan standart içerik)
    // ------------------------------------------------------------------
    function wifiEscape(s) {
        return String(s == null ? "" : s).replace(/([\\;,:"])/g, "\\$1");
    }

    function buildWifiContent(ssid, password, enc, hidden) {
        enc = String(enc || "WPA").trim();
        if (["nopass", "none", "open", "sifresiz", "şifresiz"].indexOf(enc.toLowerCase()) !== -1) {
            enc = "nopass";
        } else if (enc.toUpperCase() === "WEP") {
            enc = "WEP";
        } else {
            enc = "WPA";
        }
        var h = hidden ? "true" : "false";
        if (enc === "nopass") return "WIFI:T:nopass;S:" + wifiEscape(ssid) + ";H:" + h + ";;";
        return "WIFI:T:" + enc + ";S:" + wifiEscape(ssid) + ";P:" + wifiEscape(password) + ";H:" + h + ";;";
    }

    function buildPhoneContent(phone) {
        return "tel:" + normalizePhoneE164(String(phone == null ? "" : phone).replace(/^tel:/i, ""));
    }

    function buildSmsContent(phone, message) {
        return "SMSTO:" + normalizePhoneE164(phone) + ":" + String(message == null ? "" : message);
    }

    // type: phone|sms|text|wifi|static_url ; fields: ilgili türün alanları
    function buildStaticContent(type, fields) {
        fields = fields || {};
        if (type === "phone") return buildPhoneContent(fields.phone);
        if (type === "sms") return buildSmsContent(fields.phone, fields.message);
        if (type === "wifi") {
            return buildWifiContent(fields.ssid, fields.password, fields.encryption || fields.enc, !!fields.hidden);
        }
        if (type === "static_url") {
            var r = validateUrl(fields.url);
            return r.ok ? r.url : String(fields.url == null ? "" : fields.url).trim();
        }
        return String(fields.text == null ? "" : fields.text);
    }

    // ------------------------------------------------------------------
    // WhatsApp
    // ------------------------------------------------------------------
    function buildWhatsappUrl(phone, message) {
        var url = "https://wa.me/" + normalizePhoneForWa(phone);
        if (message) url += "?text=" + pyQuote(String(message), "");
        return url;
    }

    // ------------------------------------------------------------------
    // Renk / kontrast (WCAG)
    // ------------------------------------------------------------------
    function parseHexColor(hex) {
        var h = String(hex == null ? "" : hex).trim().replace(/^#/, "");
        if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map(function (c) { return c + c; }).join("");
        if (!/^[0-9a-f]{6}$/i.test(h)) return null;
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }

    function relativeLuminance(hex) {
        var rgb = parseHexColor(hex);
        if (!rgb) return null;
        var c = rgb.map(function (v) {
            v = v / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    // -> oran (1..21) veya geçersiz renkte null
    function contrastRatio(hexA, hexB) {
        var la = relativeLuminance(hexA);
        var lb = relativeLuminance(hexB);
        if (la == null || lb == null) return null;
        var hi = Math.max(la, lb), lo = Math.min(la, lb);
        return (hi + 0.05) / (lo + 0.05);
    }

    // ------------------------------------------------------------------
    // Zaman (Europe/Istanbul)
    // ------------------------------------------------------------------
    function fmtIstanbul(ts) {
        try {
            var d = new Date(Number(ts) * 1000);
            if (isNaN(d.getTime())) return "-";
            var parts = new Intl.DateTimeFormat("sv-SE", {
                timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
            }).format(d);
            return parts; // "YYYY-MM-DD HH:MM:SS"
        } catch (e) {
            return "-";
        }
    }

    var api = {
        escapeHtml: escapeHtml,
        pyQuote: pyQuote,
        SOCIAL_BASES: SOCIAL_BASES,
        SOCIAL_LABELS: SOCIAL_LABELS,
        normalizeSocial: normalizeSocial,
        normalizeSocialLinks: normalizeSocialLinks,
        normalizePhoneForWa: normalizePhoneForWa,
        isValidWaNumber: isValidWaNumber,
        normalizePhoneE164: normalizePhoneE164,
        isValidPhone: isValidPhone,
        validateUrl: validateUrl,
        wifiEscape: wifiEscape,
        buildWifiContent: buildWifiContent,
        buildPhoneContent: buildPhoneContent,
        buildSmsContent: buildSmsContent,
        buildStaticContent: buildStaticContent,
        buildWhatsappUrl: buildWhatsappUrl,
        parseHexColor: parseHexColor,
        relativeLuminance: relativeLuminance,
        contrastRatio: contrastRatio,
        fmtIstanbul: fmtIstanbul
    };
    Object.keys(api).forEach(function (k) { root[k] = api[k]; });
})(typeof window !== "undefined" ? window : this);
