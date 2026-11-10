/*!
 * Meta Pixel + Çerez Onayı (KVKK)
 * - Pixel temel kodu SADECE "Kabul et" seçildiyse yüklenir.
 * - Tercih localStorage("mc_consent") içinde saklanır: "granted" | "denied".
 * - Sunucu tarafı CAPI için aynı tercih "mc_consent" çerezine (1/0) yansıtılır.
 * - Piksel ID koda yazılmaz: sunucu window.META_PIXEL_ID olarak enjekte eder (META_PIXEL_ID env).
 * - Kişisel veri (T.C. kimlik, kart, adres) ASLA piksele gönderilmez.
 */
(function () {
  "use strict";

  var PIXEL_ID = (window.META_PIXEL_ID || "").toString().trim();
  var LS_KEY = "mc_consent";

  function getConsent() {
    try { return localStorage.getItem(LS_KEY); } catch (e) { return null; }
  }

  function setCookie(granted) {
    try {
      var v = granted ? "1" : "0";
      document.cookie = "mc_consent=" + v + "; path=/; max-age=31536000; SameSite=Lax" +
        (location.protocol === "https:" ? "; Secure" : "");
    } catch (e) {}
  }

  // --- Standart Meta Pixel temel kodu (yalnızca onayla çağrılır) ---
  function loadPixel() {
    if (!PIXEL_ID || window.__mcPixelLoaded) return;
    window.__mcPixelLoaded = true;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
  }

  function consentGranted() { return getConsent() === "granted"; }

  // --- Tek seferlik olay yardımcısı ---
  // key: aynı olayın tekrar gönderilmesini engeller (sessionStorage; persist=true ise localStorage)
  function track(name, params, opts) {
    opts = opts || {};
    if (!PIXEL_ID || !consentGranted() || typeof window.fbq !== "function") return false;
    var store;
    try { store = opts.persist ? localStorage : sessionStorage; } catch (e) { store = null; }
    var onceKey = opts.once ? "mc_once_" + opts.once : null;
    if (onceKey && store && store.getItem(onceKey)) return false;
    try {
      var eid = opts.eventID ? String(opts.eventID) : genEventId();
      window.fbq("track", name, params || {}, { eventID: eid });
      if (onceKey && store) store.setItem(onceKey, "1");
      relay(name, eid, params);
      return true;
    } catch (e) { return false; }
  }
  var RELAY = { ViewContent: 1, InitiateCheckout: 1, AddPaymentInfo: 1 };
  function genEventId() {
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  // Aynı event_id ile sunucu tarafı (CAPI) gönderimi — tekilleştirme için
  function relay(name, eid, params) {
    if (!RELAY[name]) return;
    try {
      fetch("/api/meta/event", {
        method: "POST", keepalive: true, credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("jwt_token") || "") },
        body: JSON.stringify({ event_name: name, event_id: eid, params: params || {}, source_url: location.href.split("#")[0] })
      }).catch(function () {});
    } catch (e) {}
  }
  window.mcTrack = track;
  window.mcConsentGranted = consentGranted;

  // --- Paket fiyatları (payments.py PLANS ile birebir aynı; toplam tutar) ---
  var PLAN_TABLE = {
    starter:  { name: "Başlangıç",   monthly: 246,  semi_annual: 1402.20,  annual: 2952 },
    advanced: { name: "Profesyonel", monthly: 615,  semi_annual: 3505.50,  annual: 7380 },
    business: { name: "Kurumsal",    monthly: 1869, semi_annual: 10653.30, annual: 22435 }
  };
  window.mcPlanInfo = function (planKey, cycle) {
    var p = PLAN_TABLE[planKey];
    if (!p) return null;
    var c = (cycle === "semi_annual" || cycle === "annual") ? cycle : "monthly";
    return { name: p.name, value: p[c], cycle: c };
  };

  // --- Çerez onay bandı ---
  function injectBannerStyles() {
    if (document.getElementById("mc-consent-style")) return;
    var css =
      "#mc-consent-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:760px;margin:0 auto;" +
      "background:rgba(15,23,42,.97);color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:16px;" +
      "padding:16px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;box-shadow:0 18px 50px rgba(0,0,0,.5);" +
      "font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:13px;line-height:1.5;backdrop-filter:blur(10px)}" +
      "#mc-consent-banner p{margin:0;flex:1 1 320px}" +
      "#mc-consent-banner a{color:#818cf8;text-decoration:underline;cursor:pointer}" +
      "#mc-consent-banner .mc-btns{display:flex;gap:8px;flex:0 0 auto}" +
      "#mc-consent-banner button{border-radius:10px;padding:9px 18px;font-weight:700;font-size:13px;cursor:pointer;" +
      "font-family:inherit;transition:all .2s}" +
      "#mc-accept{background:#6366f1;color:#fff;border:1px solid #6366f1}#mc-accept:hover{background:#4f46e5}" +
      "#mc-reject{background:transparent;color:#cbd5e1;border:1px solid rgba(148,163,184,.5)}#mc-reject:hover{background:rgba(148,163,184,.15)}";
    var st = document.createElement("style");
    st.id = "mc-consent-style";
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  }

  function hideBanner() {
    var b = document.getElementById("mc-consent-banner");
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function choose(granted) {
    try { localStorage.setItem(LS_KEY, granted ? "granted" : "denied"); } catch (e) {}
    setCookie(granted);
    hideBanner();
    if (granted) {
      loadPixel();
      if (typeof window.__mcRecheck === "function") window.__mcRecheck();
    }
  }

  function showBanner() {
    if (document.getElementById("mc-consent-banner")) return;
    injectBannerStyles();
    var b = document.createElement("div");
    b.id = "mc-consent-banner";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Çerez tercihleri");
    b.innerHTML =
      '<p>Sitemizde reklam ölçümü için Meta Pixel (çerezler) kullanılmasına izin verir misiniz? ' +
      'Reddederseniz hiçbir reklam çerezi yüklenmez. Ayrıntılar için ' +
      '<a id="mc-privacy-link">Gizlilik Politikası</a>.</p>' +
      '<div class="mc-btns"><button type="button" id="mc-reject">Reddet</button>' +
      '<button type="button" id="mc-accept">Kabul et</button></div>';
    document.body.appendChild(b);
    document.getElementById("mc-accept").addEventListener("click", function () { choose(true); });
    document.getElementById("mc-reject").addEventListener("click", function () { choose(false); });
    document.getElementById("mc-privacy-link").addEventListener("click", function () {
      if (typeof window.openModal === "function" && document.getElementById("modal-privacy")) {
        window.openModal("modal-privacy");
      }
    });
  }

  // Footer'daki "Çerez Tercihleri" bağlantısı için
  window.mcResetConsent = function () {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    setCookie(false);
    showBanner();
  };

  // --- Başlangıç ---
  var current = getConsent();
  if (current === "granted") {
    setCookie(true);
    loadPixel(); // <head> içinde senkron çalışır (standart temel kod + init + PageView)
  } else if (current === "denied") {
    setCookie(false);
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(function () {
    if (!getConsent()) showBanner();

    // "Paketler & Fiyatlar" bölümü ekrana geldiğinde (oturum başına bir kez)
    var pricing = document.getElementById("pricing-tab");
    if (pricing && "IntersectionObserver" in window) {
      var fired = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !fired) {
            // Onay yoksa tüketme: onay sonradan verilirse tekrar denenebilsin
            if (track("ViewContent", { content_name: "Paketler" }, { once: "viewcontent_paketler" })) {
              fired = true;
              io.disconnect();
            }
          }
        });
      }, { threshold: 0.15 });
      io.observe(pricing);
      window.__mcRecheck = function () {
        if (fired) return;
        try { io.unobserve(pricing); io.observe(pricing); } catch (e) {}
      };
    }
  });
})();
