/* Dijital Gru - Çerez onayı (KVKK + ETK)
 * Varsayılan olarak zorunlu olmayan hiçbir script yüklenmez.
 * Analitik: Google Tag Manager + Google Analytics (GA4)
 * Pazarlama: Google Ads etiketi. Meta Pikseli ileride yalnızca "dg-consent-granted" olayıyla yüklenecek.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'dg_cookie_consent';
    var VERSION = 1;
    var SIX_MONTHS = 183 * 24 * 60 * 60 * 1000;
    var IDS = { gtm: 'GTM-W2PQLZM9', ga: 'G-74RKNLN04N', ads: 'AW-18158374918' };

    window.dataLayer = window.dataLayer || [];
    window.dgConsent = { necessary: true, analytics: false, marketing: false, decided: false };

    var loaded = { gtm: false, gtag: false, ga: false, ads: false };
    var marketingFired = false;
    var gtagFn = null;

    /* ---------- Depolama ---------- */
    function readStored() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var d = JSON.parse(raw);
            if (!d || d.v !== VERSION || !d.ts || Date.now() - d.ts > SIX_MONTHS) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            return { analytics: !!d.analytics, marketing: !!d.marketing };
        } catch (e) { return null; }
    }

    function writeStored(c) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, ts: Date.now(), analytics: !!c.analytics, marketing: !!c.marketing }));
        } catch (e) { /* depolama kapalıysa sessizce geç */ }
    }

    /* ---------- Script yükleyiciler (yalnızca izinle) ---------- */
    function loadGTM() {
        if (loaded.gtm) return;
        loaded.gtm = true;
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtm.js?id=' + IDS.gtm;
        document.head.appendChild(s);
    }

    function loadGtag(id) {
        if (!loaded.gtag) {
            loaded.gtag = true;
            gtagFn = function () { window.dataLayer.push(arguments); };
            var s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
            document.head.appendChild(s);
            gtagFn('js', new Date());
        }
        gtagFn('config', id);
        /* Dönüşüm olayları (gtag_report_conversion) yalnızca pazarlama izniyle çalışsın */
        if (id === IDS.ads) window.gtag = gtagFn;
    }

    function clearTrackingCookies() {
        var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); });
        var host = location.hostname.replace(/^www\./, '');
        names.forEach(function (n) {
            if (/^(_ga|_gid|_gat|_gcl|_fbp|_fbc|_gac)/.test(n)) {
                document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
                document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' + host;
            }
        });
    }

    /* ---------- Meta Pikseli (yalnızca pazarlama izniyle) ---------- */
    var PIXEL_ID = '876755502162549';
    var pixelLoaded = false;

    function loadMetaPixel() {
        if (pixelLoaded) return;
        pixelLoaded = true;
        /* Standart Meta Pixel yükleyicisi: fbevents.js yalnızca bu fonksiyon çağrılınca eklenir */
        (function (f, b, e, v, n, t, s) {
            if (f.fbq) return;
            n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
            if (!f._fbq) f._fbq = n;
            n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
            t = b.createElement(e); t.async = true; t.src = v;
            s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        /* Otomatik eşleştirme ve otomatik olayları kapat: ad/telefon/e-posta Piksele gönderilmez */
        window.fbq('set', 'autoConfig', false, PIXEL_ID);
        window.fbq('init', PIXEL_ID);
        window.fbq('track', 'PageView');
    }

    document.addEventListener('dg-consent-granted', loadMetaPixel);
    document.addEventListener('dg-consent-revoked', function () {
        if (window.fbq) window.fbq('consent', 'revoke');
    });

    /* İletişim/teklif formu gönderilince çağrılır. Hiçbir form verisi iletilmez. */
    window.dgTrackLead = function () {
        if (window.dgConsent.marketing && window.fbq) window.fbq('track', 'Lead');
    };

    /* ---------- İzni uygula ---------- */
    function apply(c) {
        var wasMarketing = window.dgConsent.marketing;
        var wasAnalytics = window.dgConsent.analytics;
        window.dgConsent.analytics = !!c.analytics;
        window.dgConsent.marketing = !!c.marketing;
        window.dgConsent.decided = true;

        window['ga-disable-' + IDS.ga] = !c.analytics;

        if (c.analytics) {
            loadGTM();
            if (!loaded.ga) { loaded.ga = true; loadGtag(IDS.ga); }
        }
        if (c.marketing) {
            if (!loaded.ads) { loaded.ads = true; loadGtag(IDS.ads); }
            if (!marketingFired) {
                marketingFired = true;
                document.dispatchEvent(new CustomEvent('dg-consent-granted', { detail: { analytics: !!c.analytics, marketing: true } }));
            }
        }
        if ((wasMarketing && !c.marketing) || (wasAnalytics && !c.analytics)) {
            clearTrackingCookies();
            document.dispatchEvent(new CustomEvent('dg-consent-revoked', { detail: { analytics: !!c.analytics, marketing: !!c.marketing } }));
        }
    }

    function save(c) {
        writeStored(c);
        apply(c);
    }

    /* ---------- Arayüz ---------- */
    var CSS = '' +
        '.dgc-banner,.dgc-banner *{box-sizing:border-box}' +
        '.dgc-banner{position:fixed;left:20px;bottom:20px;z-index:100000;width:calc(100% - 40px);max-width:380px;' +
        'background:rgba(14,20,44,.97);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
        'border:1px solid rgba(242,238,230,.12);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.45);' +
        'padding:16px 18px;color:#F2EEE6;font-family:\"Inter\",Inter,system-ui,sans-serif;font-size:13px;line-height:1.55;' +
        'animation:dgcIn .35s ease both;outline:0}' +
        '@keyframes dgcIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
        '.dgc-text{margin:0;color:rgba(242,238,230,.75)}' +
        '.dgc-text a{color:#dca963;font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
        '.dgc-actions{display:flex;align-items:center;gap:8px;margin-top:12px}' +
        '.dgc-btn{min-height:36px;padding:8px 16px;border-radius:999px;font:600 13px \"Inter\",Inter,system-ui,sans-serif;' +
        'cursor:pointer;border:1px solid transparent;transition:background .2s ease,color .2s ease,border-color .2s ease}' +
        '.dgc-btn:focus-visible{outline:2px solid #F2EEE6;outline-offset:2px}' +
        '.dgc-accept{background:#dca963;color:#0c1330;border-color:#dca963}' +
        '.dgc-accept:hover{background:#e8bd80}' +
        '.dgc-reject{background:transparent;color:#F2EEE6;border-color:rgba(242,238,230,.35)}' +
        '.dgc-reject:hover{border-color:#F2EEE6}' +
        '.dgc-prefs{background:transparent;color:rgba(242,238,230,.75);padding-left:8px;padding-right:8px;margin-left:auto;text-decoration:underline;text-underline-offset:3px}' +
        '.dgc-prefs:hover{color:#dca963}' +
        '.dgc-panel{margin-top:14px;border-top:1px solid rgba(242,238,230,.12);padding-top:4px;max-height:50vh;overflow:auto}' +
        '.dgc-panel[hidden]{display:none}' +
        '.dgc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid rgba(242,238,230,.08)}' +
        '.dgc-row h3{margin:0 0 2px;font-size:14px;font-family:\"Inter\",Inter,system-ui,sans-serif;font-weight:600;color:#F2EEE6}' +
        '.dgc-row p{margin:0;color:rgba(242,238,230,.7);font-size:12px}' +
        '.dgc-switch{position:relative;flex:0 0 auto;width:42px;height:24px;margin-top:2px}' +
        '.dgc-switch input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer;z-index:2}' +
        '.dgc-switch input:disabled{cursor:not-allowed}' +
        '.dgc-slider{position:absolute;inset:0;background:rgba(242,238,230,.2);border-radius:24px;transition:background .25s}' +
        '.dgc-slider:before{content:\"\";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#F2EEE6;transition:transform .25s}' +
        '.dgc-switch input:checked+.dgc-slider{background:#dca963}' +
        '.dgc-switch input:checked+.dgc-slider:before{transform:translateX(18px)}' +
        '.dgc-switch input:disabled+.dgc-slider{opacity:.6}' +
        '.dgc-switch input:focus-visible+.dgc-slider{outline:2px solid #F2EEE6;outline-offset:2px}' +
        '.dgc-save{margin-top:12px;width:100%}' +
        '@media(max-width:600px){.dgc-banner{left:0;right:0;bottom:0;width:100%;max-width:none;border-radius:12px 12px 0 0;border-width:1px 0 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));font-size:12.5px;box-shadow:0 -8px 32px rgba(0,0,0,.4)}.dgc-actions{margin-top:10px}.dgc-btn{min-height:34px;padding:7px 14px}}' +
        '@media(prefers-reduced-motion:reduce){.dgc-banner{animation:none}.dgc-btn{transition:none}}';

    var banner = null;

    function buildBanner() {
        if (banner) return banner;
        var st = document.createElement('style');
        st.id = 'dgc-style';
        st.textContent = CSS;
        document.head.appendChild(st);

        banner = document.createElement('div');
        banner.className = 'dgc-banner';
        banner.id = 'dg-cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Çerez tercihleri');
        banner.hidden = true;
        banner.setAttribute('tabindex', '-1');
        banner.innerHTML =
            '<p class="dgc-text">Analitik ve pazarlama çerezleri için onayınızı isteriz. Ayrıntılar: <a href="/gizlilik.html#cerezler">Gizlilik ve Çerez Bilgilendirmesi</a>.</p>' +
            '<div class="dgc-actions">' +
            '<button type="button" class="dgc-btn dgc-accept" id="dgc-accept">Kabul et</button>' +
            '<button type="button" class="dgc-btn dgc-reject" id="dgc-reject">Reddet</button>' +
            '<button type="button" class="dgc-btn dgc-prefs" id="dgc-prefs" aria-expanded="false" aria-controls="dgc-panel">Tercihler</button>' +
            '</div>' +
            '<div class="dgc-panel" id="dgc-panel" hidden>' +
            row('Zorunlu', 'Sitenin çalışması ve tercihinizin hatırlanması için gereklidir. Kapatılamaz.', 'dgc-nec', true, true) +
            row('Analitik', 'Sayfa görüntüleme ve etkileşimleri anonim istatistik olarak ölçer (Google Analytics, Google Tag Manager).', 'dgc-ana', false, false) +
            row('Pazarlama', 'Reklam performansını ölçer ve reklam kişiselleştirmesi sağlar (Google Ads, Meta Pikseli).', 'dgc-mkt', false, false) +
            '<button type="button" class="dgc-btn dgc-accept dgc-save" id="dgc-save">Seçimimi Kaydet</button>' +
            '</div>';
        document.body.appendChild(banner);

        banner.querySelector('#dgc-accept').addEventListener('click', function () { choose(true, true); });
        banner.querySelector('#dgc-reject').addEventListener('click', function () { choose(false, false); });
        banner.querySelector('#dgc-prefs').addEventListener('click', function () { togglePanel(); });
        banner.querySelector('#dgc-save').addEventListener('click', function () {
            choose(banner.querySelector('#dgc-ana').checked, banner.querySelector('#dgc-mkt').checked);
        });
        banner.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && window.dgConsent.decided) hide();
        });
        return banner;
    }

    function row(title, desc, id, checked, disabled) {
        return '<div class="dgc-row"><div><h3>' + title + '</h3><p>' + desc + '</p></div>' +
            '<label class="dgc-switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') +
            ' aria-label="' + title + '"><span class="dgc-slider"></span></label></div>';
    }

    function togglePanel(force) {
        var panel = banner.querySelector('#dgc-panel');
        var btn = banner.querySelector('#dgc-prefs');
        var open = typeof force === 'boolean' ? force : panel.hidden;
        panel.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
    }

    function choose(analytics, marketing) {
        save({ analytics: analytics, marketing: marketing });
        hide();
    }

    function hide() { if (banner) banner.hidden = true; }

    function show(openPanel) {
        buildBanner();
        banner.querySelector('#dgc-ana').checked = window.dgConsent.analytics;
        banner.querySelector('#dgc-mkt').checked = window.dgConsent.marketing;
        togglePanel(!!openPanel);
        banner.hidden = false;
        var target = openPanel ? banner.querySelector('#dgc-ana') : banner;
        if (target) target.focus({ preventScroll: true });
    }

    window.dgConsent.open = function () { show(true); };

    function init() {
        document.addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('[data-cookie-prefs]') : null;
            if (t) { e.preventDefault(); show(true); }
        });
        if (!window.dgConsent.decided) show(false);
    }

    /* Kayıtlı tercih varsa hemen uygula, yoksa hiçbir şey yükleme */
    var stored = readStored();
    if (stored) apply(stored);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
