/* Dijital Gru - Nitelikli teklif formu (reklam sayfaları)
 * Kullanım: <div data-lead-form data-sector="Restoran / Kafe"></div>
 * - Lead olayı tıklamada değil, sunucu formu kabul edince (success:true) tetiklenir.
 * - Aynı event_id Pixel'e (tarayıcı) ve sunucuya (Meta CAPI) gider; Meta tekilleştirir.
 * - Pazarlama izni yoksa Pixel de CAPI da çalışmaz.
 */
(function () {
    'use strict';

    var OPTIONS = {
        sector: ['Restoran / Kafe', 'Beach club / Gece kulübü', 'Otel', 'Mimarlık', 'Diğer'],
        role: ['İşletme sahibi', 'Yönetici / Pazarlama', 'Mimar / Ofis sahibi', 'Diğer'],
        budget: ['30–60 bin TL', '60–120 bin TL', '120 bin TL üzeri', 'Henüz belirsiz'],
        timeline: ['Hemen', '1 ay içinde', '2–3 ay içinde', 'Sadece bilgi alıyorum']
    };

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

        var sectorSel = field('sector', 'Sektör', '<select id="lf-sector" name="sector" required>' + opts(OPTIONS.sector, 'Seçiniz') + '</select>');
        var form = document.createElement('form');
        form.className = 'lf';
        form.noValidate = true;
        form.setAttribute('novalidate', '');
        form.innerHTML =
            '<h3>' + title + '</h3><p class="lf-sub">' + sub + '</p>' +
            '<div class="lf-alert" role="alert"></div>' +
            '<div class="lf-grid">' +
            field('name', 'Ad Soyad', '<input id="lf-name" name="name" type="text" autocomplete="name" maxlength="100" required>') +
            field('email', 'E-posta', '<input id="lf-email" name="email" type="email" autocomplete="email" maxlength="254" required>') +
            field('phone', 'Telefon', '<input id="lf-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="05xx xxx xx xx">', '', '(isteğe bağlı)') +
            sectorSel +
            field('role', 'Rolünüz', '<select id="lf-role" name="role" required>' + opts(OPTIONS.role, 'Seçiniz') + '</select>') +
            field('budget', 'Bütçe aralığı', '<select id="lf-budget" name="budget" required>' + opts(OPTIONS.budget, 'Seçiniz') + '</select>') +
            field('timeline', 'Ne zaman başlamak istiyorsunuz?', '<select id="lf-timeline" name="timeline" required>' + opts(OPTIONS.timeline, 'Seçiniz') + '</select>', 'lf-full') +
            field('message', 'İhtiyacınız', '<textarea id="lf-message" name="message" maxlength="2000" required placeholder="Ne yapmak istiyorsunuz? Kısaca anlatın."></textarea>', 'lf-full') +
            '<div class="lf-field lf-full" data-field="kvkk"><label class="lf-kvkk"><input type="checkbox" id="lf-kvkk" name="kvkk" required>' +
            '<span><a href="/gizlilik.html" target="_blank" rel="noopener">Gizlilik ve KVKK Aydınlatma Metni</a>\'ni okudum; kişisel verilerimin teklif hazırlanması ve benimle iletişime geçilmesi amacıyla işlenmesini kabul ediyorum.</span></label>' +
            '<p class="lf-err" role="alert"></p></div>' +
            '</div>' +
            '<div class="lf-hp" aria-hidden="true"><label>Web siteniz<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
            '<button type="submit" class="lf-btn">Teklif İste</button>';
        host.innerHTML = '';
        host.appendChild(form);
        if (sector && OPTIONS.sector.indexOf(sector) !== -1) form.querySelector('#lf-sector').value = sector;

        function setErr(name, msg) {
            var wrap = form.querySelector('[data-field="' + name + '"]');
            if (!wrap) return;
            wrap.classList.toggle('lf-bad', !!msg);
            var p = wrap.querySelector('.lf-err');
            if (p) p.textContent = msg || '';
        }

        function clientValidate() {
            var d = {}, bad = null;
            ['name', 'email', 'phone', 'sector', 'role', 'budget', 'timeline', 'message'].forEach(function (k) {
                d[k] = (form.elements[k].value || '').trim();
                setErr(k, '');
            });
            setErr('kvkk', '');
            var rules = [
                ['name', d.name.length >= 2, 'Lütfen adınızı ve soyadınızı girin.'],
                ['email', /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(d.email), 'Lütfen geçerli bir e-posta adresi girin.'],
                ['phone', !d.phone || d.phone.replace(/\D/g, '').length >= 10, 'Lütfen geçerli bir telefon numarası girin.'],
                ['sector', !!d.sector, 'Lütfen sektörünüzü seçin.'],
                ['role', !!d.role, 'Lütfen rolünüzü seçin.'],
                ['budget', !!d.budget, 'Lütfen bütçe aralığınızı seçin.'],
                ['timeline', !!d.timeline, 'Lütfen başlama zamanını seçin.'],
                ['message', d.message.length >= 5, 'Lütfen ihtiyacınızı kısaca yazın.'],
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
            if (w) setErr(w.getAttribute('data-field'), '');
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
            var marketing = !!(window.dgConsent && window.dgConsent.marketing);
            var btn = form.querySelector('.lf-btn');
            btn.disabled = true;
            btn.textContent = 'Gönderiliyor...';

            var payload = {
                form_type: 'lead',
                name: d.name, email: d.email, phone: d.phone, subject_title: 'Proje Teklifi',
                sector: d.sector, role: d.role, budget: d.budget, timeline: d.timeline, message: d.message,
                kvkk: true,
                website: form.elements.website.value,
                fill_ms: Date.now() - renderedAt,
                event_id: eventId,
                marketing_consent: marketing,
                page_url: location.origin + location.pathname
            };
            if (marketing) { payload.fbp = cookie('_fbp'); payload.fbc = cookie('_fbc'); }

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
