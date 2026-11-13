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

        // --- Hero mozaiği: "28,8|16,26" => iki sütun ---
        if (mosaic) {
            var cols = (mosaic.getAttribute('data-ids') || '').split('|');
            var first = true;
            var html = cols.map(function (col, ci) {
                var tiles = idList(col).map(function (id, ti) {
                    var it = byId[id];
                    if (!it || !it.home) return '';
                    var cls = 'hx-tile ' + ((ci + ti) % 2 === 0 ? 'hx-tile--tall' : 'hx-tile--square');
                    var eager = ti === 0;
                    var priority = first ? 'high' : 'auto';
                    first = false;
                    return '<a class="' + cls + '" href="' + link(it) + '" aria-label="' + esc(it.title) + ' projesini incele">' +
                        img(it, eager, priority) + '<span class="hx-tile-label">' + esc(it.title) + '</span></a>';
                }).join('');
                return '<div class="hx-mosaic-col' + (ci % 2 ? ' hx-mosaic-col--offset' : '') + '" data-parallax="' + (ci % 2 ? '-0.03' : '0.04') + '">' + tiles + '</div>';
            }).join('');
            mosaic.innerHTML = html;
            initParallax(mosaic);
        }

        // --- Seçilmiş işler ---
        if (works) {
            works.innerHTML = idList(works.getAttribute('data-ids')).map(function (id) {
                var it = byId[id];
                if (!it || !it.home) return '';
                return '<a href="' + link(it) + '" class="hx-work scroll-reveal revealed" aria-label="' + esc(it.title) + ' — projeyi incele">' +
                    '<figure class="hx-work-media">' + img(it, false) + '</figure>' +
                    '<div class="hx-work-meta"><h3>' + esc(it.title) + '</h3><p>' + esc(it.catLabel) + '</p>' +
                    '<span class="hx-work-more">Projeyi incele <span aria-hidden="true">→</span></span></div></a>';
            }).join('');
        }
    }).catch(function (e) {
        console.warn('Ana sayfa işleri yüklenemedi:', e);
    });

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
