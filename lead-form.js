/* Dijital Gru - Nitelikli teklif formu (reklam sayfaları)
 * Kullanım: <div data-lead-form data-sector="Restoran / Kafe"></div>
 * - Lead olayı tıklamada değil, sunucu formu kabul edince (success:true) tetiklenir.
 * - Aynı event_id Pixel'e (tarayıcı) ve sunucuya (Meta CAPI) gider; Meta tekilleştirir.
 * - Pazarlama izni yoksa Pixel de CAPI da çalışmaz.
 */
(function () {
    'use strict';

    var OPTIONS = {
        sector: ['Restoran', 'Otel', 'Mimarlık', 'Diğer'],
        role: ['Sahip / ortak', 'Genel müdür', 'Pazarlama', 'Yetkili çalışan', 'Diğer'],
        budget: ['30.000 TL altı', '30–49 bin TL', '50–79 bin TL', '80 bin TL+'],
        timeline: ['Hemen', '1 ay içinde', '1–3 ay', 'Sadece bilgi alıyorum']
    };
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

    /* UTM'ler URL'den alınır ve oturum boyunca saklanır (sayfalar arası gezinse de kaybolmaz) */
    function captureUtm() {
        var out = {};
        try {
            var q = new URLSearchParams(location.search);
            UTM_KEYS.concat(['fbclid']).forEach(function (k) {
                var v = q.get(k);
                if (v) sessionStorage.setItem('dg_' + k, v.slice(0, 200));
            });
            UTM_KEYS.concat(['fbclid']).forEach(function (k) { out[k] = sessionStorage.getItem('dg_' + k) || ''; });
        } catch (e) { /* sessionStorage kapalı olabilir */ }
        return out;
    }
    captureUtm();

    var CSS = '' +
        '.lf{background:#fbf8f3;color:#0c1330;border-radius:28px;padding:clamp(22px,3.5vw,40px);box-shadow:0 50px 80px -40px rgba(0,0,0,.6);font-family:"Plus Jakarta Sans",system-ui,sans-serif}' +
        '.lf *{box-sizing:border-box}' +
        '.lf h3{font-family:"Bricolage Grotesque","Outfit",sans-serif;font-size:26px;letter-spacing:-.02em;margin:0 0 6px;color:#0c1330}' +
        '.lf-sub{margin:0 0 20px;color:rgba(12,19,48,.64);font-size:14.5px;line-height:1.6}' +
        '.lf-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
        '.lf-full{grid-column:1/-1}' +
        '.lf-field label{display:block;font-size:12.5px;font-weight:700;letter-spacing:.02em;margin:0 0 6px;color:#0c1330}' +
        '.lf-field label small{font-weight:500;color:rgba(12,19,48,.55)}' +
        '.lf-field input,.lf-field select,.lf-field textarea{width:100%;padding:13px 14px;border:1.5px solid rgba(12,19,48,.16);border-radius:12px;background:#fff;color:#0c1330;font:500 15px "Plus Jakarta Sans",system-ui,sans-serif;outline:none;transition:border-color .2s,box-shadow .2s}' +
        '.lf-field textarea{min-height:104px;resize:vertical}' +
        '.lf-field input:focus,.lf-field select:focus,.lf-field textarea:focus{border-color:#dca963;box-shadow:0 0 0 3px rgba(220,169,99,.28)}' +
        '.lf-field.lf-bad input,.lf-field.lf-bad select,.lf-field.lf-bad textarea{border-color:#d64545}' +
        '.lf-err{display:none;margin:6px 0 0;font-size:12.5px;color:#c23b3b;font-weight:600}' +
        '.lf-field.lf-bad .lf-err{display:block}' +
        '.lf-kvkk{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.55;color:rgba(12,19,48,.78)}' +
        '.lf-kvkk input{width:20px;height:20px;margin-top:2px;flex:0 0 auto;accent-color:#8a6420}' +
        '.lf-kvkk a{color:#8a6420;text-decoration:underline;font-weight:600}' +
        '.lf-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
        '.lf-btn{width:100%;min-height:52px;border:0;border-radius:999px;background:#0c1330;color:#fbf8f3;font:700 16px "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;transition:transform .2s,background .2s}' +
        '.lf-btn:hover:not(:disabled){transform:translateY(-2px);background:#162252}' +
        '.lf-btn:disabled{opacity:.7;cursor:wait}' +
        '.lf-alert{display:none;margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#fdecec;border:1px solid #f1b4b4;color:#8f2525;font-size:14px;font-weight:600}' +
        '.lf-alert.on{display:block}' +
        '.lf-ok{text-align:center;padding:26px 6px}' +
        '.lf-ok i{font-size:52px;color:#18a572;margin-bottom:12px;display:block}' +
        '.lf-ok h3{font-size:26px}' +
        '.lf-ok p{color:rgba(12,19,48,.7);line-height:1.65;margin:8px 0 18px}' +
        '.lf-wa{display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff!important;font-weight:700;padding:13px 24px;border-radius:999px;text-decoration:none}' +
        '@media(max-width:640px){.lf-grid{grid-template-columns:1fr}}';

    function opts(list, placeholder) {
        return '<option value="" disabled selected>' + placeholder + '</option>' +
            list.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
    }

    function field(id, label, control, extraClass, hint) {
        return '<div class="lf-field ' + (extraClass || '') + '" data-field="' + id + '">' +
            '<label for="lf-' + id + '">' + label + (hint ? ' <small>' + hint + '</small>' : '') + '</label>' +
            control + '<p class="lf-err" role="alert"></p></div>';
    }

    function cookie(name) {
        var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : '';
    }

    function newEventId() {
        var r = Math.random().toString(36).slice(2, 10);
        return 'lead_' + Date.now().toString(36) + '_' + r;
    }

    function build(host) {
        var sector = host.getAttribute('data-sector') || '';
        var title = host.getAttribute('data-title') || 'Projenizi anlatın, size net bir teklif hazırlayalım';
        var sub = host.getAttribute('data-sub') || 'Formu doldurun, en geç 24 saat içinde size dönelim. Daha hızlı konuşmak isterseniz WhatsApp\'tan yazabilirsiniz.';
        var renderedAt = Date.now();

        var simple = host.getAttribute('data-variant') === 'tek';
        var pkg = host.getAttribute('data-package') || '';
        var sectorSel = simple
            ? field('sector', 'Sektör', '<input id="lf-sector" name="sector" type="text" maxlength="100" required placeholder="Örn. restoran, otel, mimarlık">', 'lf-full')
            : field('sector', 'Sektör', '<select id="lf-sector" name="sector" required>' + opts(OPTIONS.sector, 'Seçiniz') + '</select>');
        var detailFields = simple
            ? field('message', 'Ek ihtiyacınız var mı?', '<textarea id="lf-message" name="message" maxlength="2000" placeholder="İsteğe bağlı: ek sayfa, çok dil, menü, rezervasyon bağlantısı vb."></textarea>', 'lf-full', '(isteğe bağlı)')
            : field('role', 'Rolünüz', '<select id="lf-role" name="role" required>' + opts(OPTIONS.role, 'Seçiniz') + '</select>') +
              field('budget', 'Bütçe aralığı', '<select id="lf-budget" name="budget" required>' + opts(OPTIONS.budget, 'Seçiniz') + '</select>') +
              field('timeline', 'Ne zaman başlamak istiyorsunuz?', '<select id="lf-timeline" name="timeline" required>' + opts(OPTIONS.timeline, 'Seçiniz') + '</select>', 'lf-full') +
              field('message', 'İhtiyacınız', '<textarea id="lf-message" name="message" maxlength="2000" required placeholder="Ne yapmak istiyorsunuz? Kısaca anlatın."></textarea>', 'lf-full');
        var form = document.createElement('form');
        form.className = 'lf';
        form.noValidate = true;
        form.setAttribute('novalidate', '');
        form.setAttribute('onsubmit', 'return false');
        form.innerHTML =
            '<h3>' + title + '</h3><p class="lf-sub">' + sub + '</p>' +
            '<div class="lf-alert" role="alert"></div>' +
            '<div class="lf-grid">' +
            field('business', simple ? 'İşletme adı' : 'İşletme adı veya web sitesi', '<input id="lf-business" name="business" type="text" autocomplete="organization" maxlength="150" required>', 'lf-full') +
            field('name', 'Ad Soyad', '<input id="lf-name" name="name" type="text" autocomplete="name" maxlength="100" required>', 'lf-full') +
            field('phone', 'Telefon', '<input id="lf-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="05xx xxx xx xx">', '', '(telefon veya e-posta)') +
            field('email', 'E-posta', '<input id="lf-email" name="email" type="email" autocomplete="email" maxlength="254">', '', '(telefon veya e-posta)') +
            sectorSel +
            detailFields +
            '<div class="lf-field lf-full" data-field="kvkk"><label class="lf-kvkk"><input type="checkbox" id="lf-kvkk" name="kvkk" required>' +
            '<span><a href="/gizlilik.html" target="_blank" rel="noopener">Gizlilik ve KVKK Aydınlatma Metni</a>\'ni okudum; kişisel verilerimin teklif hazırlanması ve benimle iletişime geçilmesi amacıyla işlenmesini kabul ediyorum.</span></label>' +
            '<p class="lf-err" role="alert"></p></div>' +
            '</div>' +
            '<div class="lf-hp" aria-hidden="true"><label>Web siteniz<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
            '<button type="submit" class="lf-btn">Teklif İste</button>';
        host.innerHTML = '';
        host.appendChild(form);
        if (!simple && sector && OPTIONS.sector.indexOf(sector) !== -1) form.querySelector('#lf-sector').value = sector;

        function setErr(name, msg) {
            var wrap = form.querySelector('[data-field="' + name + '"]');
            if (!wrap) return;
            wrap.classList.toggle('lf-bad', !!msg);
            var p = wrap.querySelector('.lf-err');
            if (p) p.textContent = msg || '';
        }

        function clientValidate() {
            var d = {}, bad = null;
            ['business', 'name', 'email', 'phone', 'sector', 'role', 'budget', 'timeline', 'message'].forEach(function (k) {
                d[k] = form.elements[k] ? (form.elements[k].value || '').trim() : '';
                setErr(k, '');
            });
            setErr('kvkk', '');
            var rules = [
                ['business', d.business.length >= 2, 'Lütfen işletme adınızı veya web sitenizi yazın.'],
                ['name', d.name.length >= 2, 'Lütfen adınızı ve soyadınızı girin.'],
                ['phone', (!d.phone && !!d.email) || d.phone.replace(/\D/g, '').length >= 10, d.phone || d.email ? 'Lütfen geçerli bir telefon numarası girin.' : 'Telefon veya e-posta bilgisinden en az birini girin.'],
                ['email', (!d.email && !!d.phone) || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(d.email), d.email || d.phone ? 'Lütfen geçerli bir e-posta adresi girin.' : ''],
                ['sector', simple ? d.sector.length >= 2 : !!d.sector, simple ? 'Lütfen sektörünüzü yazın.' : 'Lütfen sektörünüzü seçin.'],
                ['role', simple || !!d.role, 'Lütfen rolünüzü seçin.'],
                ['budget', simple || !!d.budget, 'Lütfen bütçe aralığınızı seçin.'],
                ['timeline', simple || !!d.timeline, 'Lütfen başlama zamanını seçin.'],
                ['message', simple || d.message.length >= 5, 'Lütfen ihtiyacınızı kısaca yazın.'],
                ['kvkk', form.elements.kvkk.checked, 'Devam etmek için KVKK bilgilendirmesini onaylamanız gerekir.']
            ];
            rules.forEach(function (r) {
                if (!r[1]) { setErr(r[0], r[2]); if (!bad) bad = r[0]; }
            });
            return bad ? { bad: bad } : { data: d };
        }

        function showAlert(msg) {
            var a = form.querySelector('.lf-alert');
            a.textContent = msg || '';
            a.classList.toggle('on', !!msg);
        }

        function success(eventId, d) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: 'generate_lead', form_type: 'lead', form_sector: d.sector });
            /* Lead yalnızca burada (sunucu kabul ettikten sonra) ve event_id ile gider */
            if (typeof window.dgTrackLead === 'function') window.dgTrackLead(eventId);
            if (typeof window.gtag_report_conversion === 'function') window.gtag_report_conversion();
            var wa = 'https://wa.me/905376274415?text=' + encodeURIComponent('Merhaba Dijital Gru, formu doldurdum. (' + d.sector + ')');
            host.innerHTML = '<div class="lf"><div class="lf-ok"><i class="fa-solid fa-circle-check"></i>' +
                '<h3>Mesajınız bize ulaştı.</h3>' +
                '<p>Projenizi inceleyip en geç 24 saat içinde size döneceğiz. Daha hızlı konuşmak isterseniz WhatsApp\'tan yazabilirsiniz.</p>' +
                '<a class="lf-wa" href="' + wa + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" style="font-size:20px;margin:0"></i> WhatsApp ile Yazın</a></div></div>';
        }

        /* Kullanıcı düzelttikçe ilgili hata mesajı kalksın */
        function clearOnEdit(e) {
            var w = e.target.closest ? e.target.closest('[data-field]') : null;
            if (w) { var fn = w.getAttribute('data-field'); setErr(fn, ''); if (fn === 'phone') setErr('email', ''); if (fn === 'email') setErr('phone', ''); }
        }
        form.addEventListener('input', clearOnEdit);
        form.addEventListener('change', clearOnEdit);

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            showAlert('');
            var v = clientValidate();
            if (v.bad) {
                var el = form.querySelector('[data-field="' + v.bad + '"] input, [data-field="' + v.bad + '"] select, [data-field="' + v.bad + '"] textarea');
                if (el) el.focus();
                return;
            }
            var d = v.data;
            var eventId = newEventId();
            var utm = captureUtm();
            var marketing = !!(window.dgConsent && window.dgConsent.marketing);
            var btn = form.querySelector('.lf-btn');
            btn.disabled = true;
            btn.textContent = 'Gönderiliyor...';

            var payload = {
                form_type: 'lead',
                name: d.name, email: d.email, phone: d.phone, subject_title: 'Proje Teklifi',
                business: d.business, package: pkg,
                sector: d.sector, role: d.role, budget: d.budget, timeline: d.timeline, message: d.message,
                kvkk: true,
                website: form.elements.website.value,
                fill_ms: Date.now() - renderedAt,
                event_id: eventId,
                marketing_consent: marketing,
                page_url: location.origin + location.pathname + location.search
            };
            if (marketing) {
                payload.fbp = cookie('_fbp');
                payload.fbc = cookie('_fbc');
                if (!payload.fbc && utm.fbclid) payload.fbc = 'fb.1.' + Date.now() + '.' + utm.fbclid;
            }
            UTM_KEYS.forEach(function (k) { payload[k] = utm[k] || ''; });

            fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            }).then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (r) { return { status: res.status, ok: res.ok, body: r }; });
            }).then(function (r) {
                if (r.ok && r.body && r.body.success === true) { success(eventId, d); return; }
                btn.disabled = false; btn.textContent = 'Teklif İste';
                var b = r.body || {};
                if ((r.status === 400 || r.status === 429) && b.error) {
                    if (b.field && form.querySelector('[data-field="' + b.field + '"]')) setErr(b.field, b.error);
                    else showAlert(b.error);
                } else {
                    showAlert('Mesajınız şu an gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin veya WhatsApp\'tan yazın.');
                }
            }).catch(function () {
                btn.disabled = false; btn.textContent = 'Teklif İste';
                showAlert('Mesajınız şu an gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin veya WhatsApp\'tan yazın.');
            });
        });
    }

    function init() {
        var hosts = document.querySelectorAll('[data-lead-form]');
        if (!hosts.length) return;
        var st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        Array.prototype.forEach.call(hosts, build);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
