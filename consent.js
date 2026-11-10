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
        '.dgc-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:100000;max-width:980px;margin:0 auto;' +
        'background:rgba(12,19,48,.96);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);' +
        'border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45);' +
        'padding:20px 22px;color:#fff;font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:14px;line-height:1.6;' +
        'animation:dgcIn .35s ease both}' +
        '@keyframes dgcIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
        '.dgc-title{font-family:"Outfit",system-ui,sans-serif;font-weight:700;font-size:16px;margin:0 0 6px;color:#fff}' +
        '.dgc-text{margin:0;color:rgba(255,255,255,.78)}' +
        '.dgc-text a{color:#dca963;font-weight:600}' +
        '.dgc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}' +
        '.dgc-btn{flex:1 1 130px;min-height:44px;padding:11px 18px;border-radius:12px;font:700 14px "Plus Jakarta Sans",system-ui,sans-serif;' +
        'cursor:pointer;border:1px solid #dca963;transition:transform .2s ease,background .2s ease,color .2s ease}' +
        '.dgc-btn:hover{transform:translateY(-2px)}' +
        '.dgc-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
        '.dgc-accept,.dgc-reject{background:#dca963;color:#0c1330}' +
        '.dgc-accept:hover,.dgc-reject:hover{background:#e8bd80}' +
        '.dgc-prefs{background:transparent;color:#fff;border-color:rgba(255,255,255,.35)}' +
        '.dgc-prefs:hover{border-color:#dca963;color:#dca963}' +
        '.dgc-panel{margin-top:16px;border-top:1px solid rgba(255,255,255,.12);padding-top:6px}' +
        '.dgc-panel[hidden]{display:none}' +
        '.dgc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}' +
        '.dgc-row h3{margin:0 0 2px;font-size:15px;font-family:"Outfit",system-ui,sans-serif;color:#fff}' +
        '.dgc-row p{margin:0;color:rgba(255,255,255,.7);font-size:13px}' +
        '.dgc-switch{position:relative;flex:0 0 auto;width:46px;height:26px;margin-top:2px}' +
        '.dgc-switch input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer;z-index:2}' +
        '.dgc-switch input:disabled{cursor:not-allowed}' +
        '.dgc-slider{position:absolute;inset:0;background:rgba(255,255,255,.2);border-radius:26px;transition:background .25s}' +
        '.dgc-slider:before{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .25s}' +
        '.dgc-switch input:checked+.dgc-slider{background:#dca963}' +
        '.dgc-switch input:checked+.dgc-slider:before{transform:translateX(20px)}' +
        '.dgc-switch input:disabled+.dgc-slider{opacity:.6}' +
        '.dgc-switch input:focus-visible+.dgc-slider{outline:2px solid #fff;outline-offset:2px}' +
        '.dgc-save{margin-top:14px;width:100%}' +
        '@media(max-width:600px){.dgc-banner{left:10px;right:10px;bottom:10px;padding:16px;max-height:88vh;overflow:auto}.dgc-btn{flex:1 1 100%}}' +
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
        banner.innerHTML =
            '<p class="dgc-title">Çerez Tercihleriniz</p>' +
            '<p class="dgc-text">Sitemiz zorunlu çerezlerle çalışır. İzin verirseniz ziyaret istatistiği (analitik) ve reklam ölçümü (pazarlama) için ek çerezler de kullanırız. ' +
            'Seçiminizi istediğiniz zaman değiştirebilirsiniz. Ayrıntılar için <a href="/gizlilik.html#cerezler">Gizlilik ve Çerez Bilgilendirmesi</a>.</p>' +
            '<div class="dgc-actions">' +
            '<button type="button" class="dgc-btn dgc-reject" id="dgc-reject">Reddet</button>' +
            '<button type="button" class="dgc-btn dgc-accept" id="dgc-accept">Kabul et</button>' +
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
        var target = openPanel ? banner.querySelector('#dgc-ana') : banner.querySelector('#dgc-accept');
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
