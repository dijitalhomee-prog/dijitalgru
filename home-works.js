/* Ana sayfa: hero mozaiği + "Seçilmiş İşler" — veri portfolio.json'dan (ID ile) çekilir.
   Hangi projelerin gösterileceği index.html'deki data-ids özniteliklerinden okunur. */
(function () {
    'use strict';

    var mosaic = document.getElementById('hero-mosaic');
    var works = document.getElementById('home-works');
    if (!mosaic && !works) return;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function idList(str) {
        return String(str || '').split(',').map(function (x) { return parseInt(x, 10); }).filter(Boolean);
    }

    function img(item, eager, extra) {
        var h = item.home;
        if (!h) return '';
        return '<img src="' + esc(h.src) + '" width="' + h.w + '" height="' + h.h + '"' + (h.pos || h.fit || h.bg ? ' style="' + (h.pos ? 'object-position:' + esc(h.pos) + ';' : '') + (h.fit ? 'object-fit:' + esc(h.fit) + ';' : '') + (h.bg ? 'background:' + esc(h.bg) + ';' : '') + '"' : '') + ' alt="' + esc(h.alt || item.title) + '"' +
            (eager ? ' fetchpriority="' + (extra || 'auto') + '" decoding="async"' : ' loading="lazy" decoding="async"') + '>';
    }

    function link(item) { return 'designs.html#proje-' + item.id; }

    fetch('portfolio.json?v=10').then(function (r) {
        if (!r.ok) throw new Error('portfolio.json');
        return r.json();
    }).then(function (data) {
        var byId = {};
        data.forEach(function (it) { byId[it.id] = it; });

        // --- Hero vitrin: tek büyük görsel, otomatik geçiş (data-ids sırasıyla) ---
        if (mosaic) {
            var items = idList((mosaic.getAttribute('data-ids') || '').replace(/\|/g, ',')).map(function (id) { return byId[id]; }).filter(function (it) { return it && it.home; });
            var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
            mosaic.innerHTML =
                '<div class="hx-stage">' + items.map(function (it, i) {
                    return '<a class="hx-slide' + (i === 0 ? ' is-active' : '') + '" href="' + link(it) + '" aria-label="' + esc(it.title) + ' projesini incele"' + (i === 0 ? '' : ' tabindex="-1" aria-hidden="true"') + '>' +
                        img(it, i === 0, 'high') + '</a>';
                }).join('') + '</div>' +
                '<div class="hx-stage-meta"><div class="hx-stage-cap"><strong></strong><span></span></div>' +
                '<div class="hx-stage-nav" role="tablist" aria-label="Proje seç">' + items.map(function (it, i) {
                    return '<button type="button" class="hx-dot' + (i === 0 ? ' is-active' : '') + '" aria-label="' + esc(it.title) + '" data-i="' + i + '"></button>';
                }).join('') + '<span class="hx-count"></span></div></div>';
            initStage(mosaic, items, pad);
        }

        // --- Seçilmiş işler ---
        if (works) {
            var n = 0;
            works.innerHTML = idList(works.getAttribute('data-ids')).map(function (id) {
                var it = byId[id];
                if (!it || !it.home) return '';
                n++;
                return '<a href="' + link(it) + '" class="hx-work scroll-reveal revealed" aria-label="' + esc(it.title) + ' — projeyi incele">' +
                    '<figure class="hx-work-media">' + img(it, false) + '</figure>' +
                    '<div class="hx-work-meta"><span class="hx-work-no" aria-hidden="true">' + (n < 10 ? '0' + n : n) + '</span><h3>' + esc(it.title) + '</h3><p>' + esc(it.catLabel) + '</p>' +
                    '<span class="hx-work-more">Projeyi incele <span aria-hidden="true">→</span></span></div></a>';
            }).join('');
        }
    }).catch(function (e) {
        console.warn('Ana sayfa işleri yüklenemedi:', e);
    });

    // Hero vitrin geçişi (reduced-motion'da otomatik geçiş yok)
    function initStage(root, items, pad) {
        var slides = root.querySelectorAll('.hx-slide');
        var dots = root.querySelectorAll('.hx-dot');
        var cap = root.querySelector('.hx-stage-cap');
        var count = root.querySelector('.hx-count');
        if (!slides.length) return;
        var cur = 0, timer = null;
        function show(i) {
            cur = (i + slides.length) % slides.length;
            slides.forEach(function (s, k) {
                var on = k === cur;
                s.classList.toggle('is-active', on);
                if (on) { s.removeAttribute('aria-hidden'); s.removeAttribute('tabindex'); }
                else { s.setAttribute('aria-hidden', 'true'); s.setAttribute('tabindex', '-1'); }
            });
            dots.forEach(function (d, k) { d.classList.toggle('is-active', k === cur); });
            cap.querySelector('strong').textContent = items[cur].title;
            cap.querySelector('span').textContent = items[cur].catLabel;
            count.textContent = pad(cur + 1) + ' / ' + pad(slides.length);
        }
        function play() {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            stop();
            timer = setInterval(function () { show(cur + 1); }, 5000);
        }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        dots.forEach(function (d) {
            d.addEventListener('click', function () { show(parseInt(d.getAttribute('data-i'), 10)); play(); });
        });
        root.addEventListener('mouseenter', stop);
        root.addEventListener('mouseleave', play);
        root.addEventListener('focusin', stop);
        root.addEventListener('focusout', play);
        show(0);
        play();
    }

    // Hafif, yavaş parallax (reduced-motion'da kapalı)
    function initParallax(root) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var cols = root.querySelectorAll('[data-parallax]');
        if (!cols.length) return;
        var ticking = false;
        function update() {
            var y = Math.min(window.scrollY, 900);
            cols.forEach(function (c) {
                var k = parseFloat(c.getAttribute('data-parallax')) || 0;
                c.style.transform = 'translate3d(0,' + (y * k).toFixed(1) + 'px,0)';
            });
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
        }, { passive: true });
    }
})();
