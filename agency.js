/* Reklam ajansı ana sayfası: reveal, header, hero kartları, işler (portfolio.json) */
(function () {
    'use strict';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reveal
    var els = document.querySelectorAll('.rv, .st');
    if ('IntersectionObserver' in window && !reduce) {
        var io = new IntersectionObserver(function (es) {
            es.forEach(function (e, i) {
                if (e.isIntersecting) {
                    setTimeout(function () { e.target.classList.add('in'); }, (i % 4) * 80);
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        els.forEach(function (el) { io.observe(el); });
    } else { els.forEach(function (el) { el.classList.add('in'); }); }

    // Header gölgesi
    var h = document.getElementById('main-header');
    if (h) window.addEventListener('scroll', function () { h.classList.toggle('scrolled', window.scrollY > 10); }, { passive: true });

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function ids(s) { return String(s || '').split(',').map(function (x) { return parseInt(x, 10); }).filter(Boolean); }
    function im(it, lazy) {
        var hm = it.home; if (!hm) return '';
        return '<img src="' + esc(hm.src) + '" width="' + hm.w + '" height="' + hm.h + '" alt="' + esc(hm.alt || it.title) + '"' +
            (lazy ? ' loading="lazy"' : '') + ' decoding="async">';
    }

    fetch('portfolio.json?v=10').then(function (r) { return r.json(); }).then(function (data) {
        var by = {}; data.forEach(function (i) { by[i.id] = i; });

        var works = document.getElementById('home-works');
        if (works) {
            works.innerHTML = ids(works.getAttribute('data-ids')).map(function (id) { return by[id]; })
                .filter(function (it) { return it && it.home; }).map(function (it) {
                    return '<a class="wk rv in" href="designs.html#proje-' + it.id + '" aria-label="' + esc(it.title) + '">' + im(it, true) +
                        '<div class="wk-meta"><div><h3>' + esc(it.title) + '</h3><p>' + esc(it.catLabel) + '</p></div><i class="fa-solid fa-arrow-right"></i></div></a>';
                }).join('');
        }

        // Hero kartları sabit: önde Sinopia, arkada Moretenders (index.html'de statik)
    }).catch(function (e) { console.warn('portfolio.json yüklenemedi', e); });
})();
