/*!
 * Sayfa içi bildirim ve diyaloglar — alert()/confirm()/prompt() yerine.
 *   uiToast(mesaj, tip?)        -> bloklamayan toast (tip: success|error|info; ✅/❌/⚠️ ile başlıyorsa otomatik)
 *   uiFlash(mesaj, tip?)        -> sayfa yenilenince gösterilecek toast
 *   uiConfirm(mesaj, opts?)     -> Promise<boolean>
 *   uiPrompt(mesaj, opts?)      -> Promise<string|null>
 *   uiShowText(baslik, metin)   -> kopyalanabilir metin modalı
 */
(function () {
  "use strict";

  var CSS =
    ".ud-toasts{position:fixed;right:16px;bottom:16px;z-index:100001;display:flex;flex-direction:column;gap:10px;" +
    "max-width:min(380px,calc(100vw - 32px));pointer-events:none}" +
    ".ud-toast{pointer-events:auto;cursor:pointer;background:rgba(15,23,42,.97);color:#e2e8f0;border:1px solid rgba(255,255,255,.12);" +
    "border-left:4px solid #6366f1;border-radius:12px;padding:12px 14px;font:600 13px/1.5 'Plus Jakarta Sans',system-ui,sans-serif;" +
    "white-space:pre-line;word-break:break-word;box-shadow:0 12px 32px rgba(0,0,0,.45);animation:udIn .22s ease-out}" +
    ".ud-toast.success{border-left-color:#10b981}.ud-toast.error{border-left-color:#ef4444}" +
    ".ud-toast.out{opacity:0;transform:translateY(8px);transition:all .2s}" +
    "@keyframes udIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
    ".ud-overlay{position:fixed;inset:0;z-index:100002;background:rgba(2,6,23,.78);backdrop-filter:blur(8px);display:flex;" +
    "align-items:center;justify-content:center;padding:16px;overflow-y:auto}" +
    ".ud-dialog{background:#151922;color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:22px;" +
    "width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow-y:auto;box-sizing:border-box;" +
    "font:500 14px/1.6 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.55)}" +
    ".ud-dialog h3{margin:0 0 10px;font-size:17px;font-weight:800;color:#fff}" +
    ".ud-dialog p{margin:0 0 16px;white-space:pre-line;word-break:break-word;color:#cbd5e1}" +
    ".ud-dialog input{width:100%;box-sizing:border-box;margin:0 0 16px;padding:11px 12px;border-radius:10px;" +
    "border:1px solid rgba(255,255,255,.18);background:#0b0f19;color:#fff;font:inherit}" +
    ".ud-btns{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}" +
    ".ud-btn{border-radius:10px;padding:10px 18px;font:700 13px 'Plus Jakarta Sans',system-ui,sans-serif;cursor:pointer;" +
    "border:1px solid transparent;transition:all .15s}" +
    ".ud-btn.primary{background:#6366f1;color:#fff}.ud-btn.primary:hover{background:#4f46e5}" +
    ".ud-btn.danger{background:#ef4444;color:#fff}.ud-btn.danger:hover{background:#dc2626}" +
    ".ud-btn.ghost{background:transparent;color:#cbd5e1;border-color:rgba(148,163,184,.45)}.ud-btn.ghost:hover{background:rgba(148,163,184,.15)}";

  function injectCss() {
    if (document.getElementById("ud-style")) return;
    var st = document.createElement("style");
    st.id = "ud-style";
    st.appendChild(document.createTextNode(CSS));
    document.head.appendChild(st);
  }

  function toastRoot() {
    injectCss();
    var r = document.getElementById("ud-toasts");
    if (!r) {
      r = document.createElement("div");
      r.id = "ud-toasts";
      r.className = "ud-toasts";
      r.setAttribute("aria-live", "polite");
      document.body.appendChild(r);
    }
    return r;
  }

  function autoType(msg) {
    var s = String(msg == null ? "" : msg).replace(/^\s+/, "");
    if (/^(✅|🎉|✔)/.test(s)) return "success";
    if (/^(❌|⚠|🚫|⛔)/.test(s)) return "error";
    return "info";
  }

  function toast(msg, type) {
    function show() {
      var t = document.createElement("div");
      var tp = type || autoType(msg);
      t.className = "ud-toast " + tp;
      t.setAttribute("role", tp === "error" ? "alert" : "status");
      t.textContent = String(msg == null ? "" : msg).trim();
      var root = toastRoot();
      root.appendChild(t);
      var gone = false;
      function close() {
        if (gone) return;
        gone = true;
        t.classList.add("out");
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
      }
      t.addEventListener("click", close);
      setTimeout(close, tp === "error" ? 7000 : 4500);
    }
    if (document.body) show();
    else document.addEventListener("DOMContentLoaded", show);
  }

  function flash(msg, type) {
    try { sessionStorage.setItem("ud_flash", JSON.stringify({ m: String(msg), t: type || null })); } catch (e) {}
  }

  function dialog(opts) {
    // opts: title, message, input{value,placeholder}|null, buttons:[{text,cls,value}], readonlyText
    injectCss();
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement;
      var ov = document.createElement("div");
      ov.className = "ud-overlay";
      var dlg = document.createElement("div");
      dlg.className = "ud-dialog";
      dlg.setAttribute("role", "dialog");
      dlg.setAttribute("aria-modal", "true");
      if (opts.title) { var h = document.createElement("h3"); h.textContent = opts.title; dlg.appendChild(h); }
      if (opts.message) { var p = document.createElement("p"); p.textContent = opts.message; dlg.appendChild(p); }
      var input = null;
      if (opts.input) {
        input = document.createElement("input");
        input.type = "text";
        input.value = opts.input.value || "";
        if (opts.input.placeholder) input.placeholder = opts.input.placeholder;
        if (opts.input.readonly) input.readOnly = true;
        dlg.appendChild(input);
      }
      var row = document.createElement("div");
      row.className = "ud-btns";
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
        resolve(v);
      }
      var primaryBtn = null;
      opts.buttons.forEach(function (b) {
        var el = document.createElement("button");
        el.type = "button";
        el.className = "ud-btn " + (b.cls || "ghost");
        el.textContent = b.text;
        el.addEventListener("click", function () {
          finish(b.value === "__input__" ? (input ? input.value : "") : b.value);
        });
        if (b.primary) primaryBtn = el;
        row.appendChild(el);
      });
      dlg.appendChild(row);
      ov.appendChild(dlg);
      ov.addEventListener("mousedown", function (e) { if (e.target === ov) finish(opts.cancelValue); });
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); finish(opts.cancelValue); }
        else if (e.key === "Enter" && input && !input.readOnly) { e.preventDefault(); finish(input.value); }
      }
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(ov);
      setTimeout(function () {
        try {
          if (input) { input.focus(); input.select(); }
          else if (primaryBtn) primaryBtn.focus();
        } catch (e) {}
      }, 30);
    });
  }

  function confirmDlg(message, o) {
    o = o || {};
    return dialog({
      title: o.title || "Onay",
      message: message,
      cancelValue: false,
      buttons: [
        { text: o.cancelText || "Vazgeç", cls: "ghost", value: false },
        { text: o.okText || "Evet, devam et", cls: o.danger ? "danger" : "primary", value: true, primary: true }
      ]
    });
  }

  function promptDlg(message, o) {
    o = o || {};
    return dialog({
      title: o.title || "Bilgi girin",
      message: message,
      input: { value: o.defaultValue || "", placeholder: o.placeholder || "" },
      cancelValue: null,
      buttons: [
        { text: "Vazgeç", cls: "ghost", value: null },
        { text: o.okText || "Tamam", cls: "primary", value: "__input__", primary: true }
      ]
    });
  }

  function showText(title, text) {
    return dialog({
      title: title,
      input: { value: text, readonly: true },
      cancelValue: null,
      buttons: [
        { text: "Kapat", cls: "ghost", value: null },
        { text: "Kopyala", cls: "primary", value: "__input__", primary: true }
      ]
    }).then(function (v) {
      if (v) {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v);
          toast("Bağlantı kopyalandı.", "success");
        } catch (e) {}
      }
    });
  }

  window.uiToast = toast;
  window.uiFlash = flash;
  window.uiConfirm = confirmDlg;
  window.uiPrompt = promptDlg;
  window.uiShowText = showText;

  document.addEventListener("DOMContentLoaded", function () {
    try {
      var f = sessionStorage.getItem("ud_flash");
      if (f) {
        sessionStorage.removeItem("ud_flash");
        var o = JSON.parse(f);
        toast(o.m, o.t || undefined);
      }
    } catch (e) {}
  });
})();
