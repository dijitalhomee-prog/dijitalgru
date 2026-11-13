document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Portfolio Dataset (20 Real-World Prestige Brand Case Studies) ---
    const loadPortfolioData = () => {
        if (window.location.protocol === 'file:') {
            console.log("Local file protocol detected. Using embedded dataset.");
            return Promise.resolve(window.PORTFOLIO_DATA_BACKUP);
        }
        return fetch('portfolio.json?v=10')
            .then(response => {
                if (!response.ok) throw new Error("Portfolio fetch failed");
                return response.json();
            })
            .catch(err => {
                console.warn("Fetch failed, falling back to embedded dataset:", err);
                return window.PORTFOLIO_DATA_BACKUP;
            });
    };

    loadPortfolioData().then(portfolioData => {
        // --- 1.5 (kaldırıldı) PDF'i olmayan kartlara otomatik not eklenmiyor ---

        // --- 2. Dynamic Mouse Tracker Glow Orb ---
        const glowOrb = document.getElementById('glow-orb');
        if (glowOrb) {
            document.addEventListener('mousemove', (e) => {
                glowOrb.style.left = e.clientX + 'px';
                glowOrb.style.top = e.clientY + 'px';
            });
        }

        // --- 3. Dynamic Rendering, Sidebar Population & Scroll Spy Engine ---
        const designsGrid = document.getElementById('designs-grid');
        const noResults = document.getElementById('no-results');
        const escAttr = (v) => String(v == null ? '' : v).replace(/"/g, '&quot;');
        let currentCategory = 'all';
        const matchesCategory = (item) => currentCategory === 'all' || (item.categories || [item.category]).includes(currentCategory);

        const renderAllDesigns = () => {
            // Filter items based on selected category tab
            const filtered = portfolioData.filter(matchesCategory);

            // Toggle Empty state display
            if (filtered.length === 0) {
                designsGrid.innerHTML = '';
                noResults.style.display = 'block';
                return;
            } else {
                noResults.style.display = 'none';
            }

            // Kartlar: ana sayfadaki "Seçilmiş İşler" ile aynı stil (görsel + marka adı + iş türü)
            designsGrid.innerHTML = filtered.map((item, index) => {
                const eager = index < 6;
                const h = item.home || null;
                const src = h ? h.src : item.thumb;
                const w = h ? h.w : item.thumbW;
                const ht = h ? h.h : item.thumbH;
                const st = h && (h.fit || h.bg || h.pos)
                    ? ` style="${h.pos ? 'object-position:' + h.pos + ';' : ''}${h.fit ? 'object-fit:' + h.fit + ';' : ''}${h.bg ? 'background:' + h.bg + ';' : ''}"` : '';
                const media = src
                    ? `<img class="portfolio-thumb" src="${src}" width="${w}" height="${ht}"${st} alt="${escAttr(item.title)} — ${escAttr(item.catLabel)}" ${eager ? 'fetchpriority="' + (index < 2 ? 'high' : 'auto') + '" decoding="async"' : 'loading="lazy" decoding="async"'}>`
                    : `<div class="portfolio-img-placeholder ${item.gradient}"><i class="fa-solid ${item.icon} portfolio-icon"></i></div>`;
                return `
                    <article class="portfolio-item dx-card" data-id="${item.id}" data-category="${item.category}" tabindex="0" role="button" aria-label="${escAttr(item.title)} projesini incele">
                        <figure class="dx-media${src && w && ht && (w / ht) < 1.6 && !(h && h.fit) ? ' dx-media--fit' : ''}">${media}</figure>
                        <div class="dx-meta">
                            <h3 class="portfolio-item-title">${item.title}</h3>
                            <p class="dx-type">${item.catLabel}</p>
                            <span class="dx-more">Projeyi incele <span aria-hidden="true">→</span></span>
                        </div>
                    </article>
                `;
            }).join('');

            bindCardClicks();

            // (PDF.js ile süreç içi thumbnail üretimi kaldırıldı: görseller thumbs/ altında hazır)
        };

        // --- 5. Tab Filtering Event Listeners ---
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.getAttribute('data-filter');
                renderAllDesigns();
            });
        });

        // --- 6. Lightbox Case-Study Modal Engine ---
        const modal = document.getElementById('case-study-modal');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const modalPrevBtn = document.getElementById('modal-prev-btn');
        const modalNextBtn = document.getElementById('modal-next-btn');

        let activeModalIndex = 0;
        let loadedModalItems = [];

        const openCaseStudyModal = (projectId) => {
            const item = portfolioData.find(p => p.id === parseInt(projectId));
            if (!item) return;

            // Set list of active slider projects based on the current filtered list
            loadedModalItems = portfolioData.filter(matchesCategory);

            activeModalIndex = loadedModalItems.findIndex(p => p.id === item.id);

            updateModalContent(item);
            modal.classList.add('active');
            modalOverlay.classList.add('active');
            document.body.classList.add('overflow-hidden');
        };


        // Seçili işin görselini (PDF / gradient) modal sol tarafına yazar
        const renderModalVisual = (item, workIndex) => {
            const works = item.works || [];
            const work = works[workIndex] || {};
            const pdf = work.pdfPath || null;
            const visualSide = document.querySelector('.modal-visual-side');
            if (pdf) {
                if (window.innerWidth <= 768) {
                    const thumb = work.thumb
                        ? `<img src="${work.thumb}" alt="${escAttr(item.title)}" style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block;">`
                        : '';
                    visualSide.innerHTML = `
                        <div class="modal-pdf-fallback-card">
                            <div class="pdf-fallback-canvas-wrapper">${thumb}</div>
                            <div class="pdf-fallback-overlay"></div>
                            <a href="pdf-viewer.html?file=${encodeURIComponent(pdf)}&title=${encodeURIComponent(item.title)}" target="_blank" class="modal-pdf-btn">
                                <i class="fa-solid fa-expand"></i> Tasarımları Gör (PDF)
                            </a>
                        </div>
                    `;
                } else {
                    visualSide.innerHTML = `
                        <iframe src="${pdf}#view=FitH&toolbar=0" style="width: 100%; height: 100%; min-height: 450px; border: none; border-radius: 24px 0 0 24px; display: block; background: #060a1a;" onclick="event.stopPropagation();"></iframe>
                    `;
                }
            } else {
                visualSide.innerHTML = `
                    <div class="modal-visual-bg ${item.gradient}" id="modal-visual-bg">
                        <i class="modal-visual-icon fa-solid ${item.icon}" id="modal-visual-icon"></i>
                        <div class="portfolio-particles"></div>
                    </div>
                `;
            }
        };

        const updateModalContent = (item) => {
            document.getElementById('modal-cat').textContent = item.catLabel;
            document.getElementById('modal-title').textContent = item.title;
            document.getElementById('modal-client').textContent = `Müşteri: ${item.client}`;

            const works = item.works && item.works.length ? item.works : [{ label: item.catLabel, challenge: item.challenge, pdfPath: item.pdfPath }];
            const multi = works.length > 1;

            let detailsHtml;
            if (multi) {
                const sections = works.map((w, i) => `
                    <div class="work-section">
                        <div class="work-section-head">
                            <h5 class="work-section-title">${w.section || w.label}</h5>
                            ${w.section ? `<span class="work-section-label">${w.label}</span>` : ''}
                        </div>
                        <p class="modal-desc">${w.challenge}</p>
                        ${w.pdfPath ? `<button type="button" class="work-view-btn" data-work="${i}">Tasarımları gör</button>` : ''}
                    </div>`).join('');
                detailsHtml = `
                    <h4 class="modal-section-title">Yapılan İşler</h4>
                    ${sections}
                `;
            } else {
                detailsHtml = `
                    <h4 class="modal-section-title">Proje Detayları</h4>
                    <p class="modal-desc">${works[0].challenge}</p>
                `;
            }

            // metrics alanı boşsa "Kazanımlar & Sonuç" bölümü hiç render edilmez
            const metricsHtml = (item.metrics && item.metrics.length) ? `
                <h4 class="modal-section-title">Kazanımlar &amp; Sonuç</h4>
                <div class="modal-metrics-grid">
                    ${item.metrics.map(m => `
                    <div class="modal-metric-card">
                        <div class="modal-metric-val">${m.val}</div>
                        <div class="modal-metric-lbl">${m.lbl}</div>
                    </div>`).join('')}
                </div>
            ` : '';

            document.querySelector('.modal-body').innerHTML = `
                ${detailsHtml}
                ${metricsHtml}
            `;

            let activeWork = works.findIndex(w => w.pdfPath);
            if (activeWork < 0) activeWork = 0;
            renderModalVisual(item, activeWork);

            const buttons = document.querySelectorAll('.work-view-btn');
            const markActive = (idx) => buttons.forEach(b => b.classList.toggle('active', Number(b.dataset.work) === idx));
            markActive(activeWork);
            buttons.forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.work);
                renderModalVisual(item, idx);
                markActive(idx);
            }));
        };

        const closeCaseStudyModal = () => {
            modal.classList.remove('active');
            modalOverlay.classList.remove('active');
            document.body.classList.remove('overflow-hidden');
            if (/^#proje-\d+$/.test(window.location.hash) && window.history && history.replaceState) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        };

        const bindCardClicks = () => {
            const cards = document.querySelectorAll('.portfolio-item');
            cards.forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('a')) {
                        return;
                    }
                    const id = card.getAttribute('data-id');
                    openCaseStudyModal(id);
                });
            });
        };

        // Modal Nav Button Listeners
        if (modalPrevBtn) {
            modalPrevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (loadedModalItems.length <= 1) return;
                activeModalIndex = (activeModalIndex - 1 + loadedModalItems.length) % loadedModalItems.length;
                updateModalContent(loadedModalItems[activeModalIndex]);
            });
        }

        if (modalNextBtn) {
            modalNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (loadedModalItems.length <= 1) return;
                activeModalIndex = (activeModalIndex + 1) % loadedModalItems.length;
                updateModalContent(loadedModalItems[activeModalIndex]);
            });
        }

        // Modal Closing Events
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCaseStudyModal);
        if (modalOverlay) modalOverlay.addEventListener('click', closeCaseStudyModal);

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('active')) return;

            if (e.key === 'Escape') {
                closeCaseStudyModal();
            } else if (e.key === 'ArrowLeft') {
                modalPrevBtn.click();
            } else if (e.key === 'ArrowRight') {
                modalNextBtn.click();
            }
        });

        // Helper: Render first page of PDF onto a thumbnail canvas (with caching and fixed width)
        function renderPdfThumbnail(pdfUrl, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            const cacheKey = 'pdf-thumb-cache-' + pdfUrl;
            let cachedData = null;
            try {
                cachedData = sessionStorage.getItem(cacheKey);
            } catch (e) {
                console.warn("sessionStorage is not accessible:", e);
            }

            if (cachedData) {
                container.innerHTML = `<img src="${cachedData}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block;" loading="lazy">`;
                return;
            }

            if (typeof pdfjsLib === 'undefined') {
                const spinner = container.querySelector('.spinner');
                if (spinner) spinner.remove();
                const icon = container.querySelector('.portfolio-icon');
                if (icon) {
                    icon.style.color = '#ffffff';
                    icon.style.opacity = '1';
                }
                return;
            }

            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

            pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
                return pdf.getPage(1);
            }).then(page => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                // Render at a high-quality fixed width to prevent layout-dependency bugs (e.g. 0px width on hidden elements)
                const targetWidth = 600;
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const scale = targetWidth / unscaledViewport.width;
                const viewport = page.getViewport({ scale: scale });

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.objectFit = 'cover';
                canvas.style.objectPosition = 'top center';
                canvas.style.display = 'block';

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                // Clear container and append canvas immediately so it loads visibly in real-time
                container.innerHTML = '';
                container.appendChild(canvas);

                return page.render(renderContext).promise.then(() => {
                    try {
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        sessionStorage.setItem(cacheKey, dataUrl);
                    } catch (e) {
                        console.warn("Could not cache PDF thumbnail:", e);
                    }
                });
            }).catch(err => {
                console.error("PDF thumbnail rendering failed:", err);
                const spinner = container.querySelector('.spinner');
                if (spinner) spinner.remove();
                const icon = container.querySelector('.portfolio-icon');
                if (icon) {
                    icon.style.color = '#ffffff';
                    icon.style.opacity = '1';
                }
            });
        }

        // --- 7. Initial Execution ---
        renderAllDesigns();

        // --- 7.1 Derin bağlantı: designs.html#proje-<id> ilgili proje modalını açar ---
        const hashProjectId = () => {
            const m = /^#proje-(\d+)$/.exec(window.location.hash);
            return m ? m[1] : null;
        };
        const openFromHash = () => {
            const id = hashProjectId();
            if (!id) return;
            if (currentCategory !== 'all') {
                const allBtn = document.querySelector('.tab-btn[data-filter="all"]');
                if (allBtn) allBtn.click();
            }
            openCaseStudyModal(id);
        };
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
        const hasDeepLink = !!hashProjectId();

        // --- 8. QR Studio Promo Pop-up Modal Handler ---
        const qrPromoModal = document.getElementById('qr-promo-modal');
        const qrPromoOverlay = document.getElementById('qr-promo-overlay');
        const qrPromoCloseBtn = document.getElementById('qr-promo-close-btn');
        const qrPromoSkipBtn = document.getElementById('qr-promo-skip-btn');
        const qrPromoCtaBtn = document.getElementById('qr-promo-cta-btn');

        if (qrPromoModal) {
            function openQrPromo() {
                qrPromoModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }

            function closeQrPromo() {
                qrPromoModal.classList.remove('active');
                document.body.style.overflow = '';
                try {
                    sessionStorage.setItem('qrdijitalgru_popup_closed', 'true');
                } catch (e) {
                    console.warn("Storage not available:", e);
                }
            }

            let isClosedInSession = false;
            try {
                isClosedInSession = sessionStorage.getItem('qrdijitalgru_popup_closed') === 'true';
            } catch (e) {}

            if (!isClosedInSession && !hasDeepLink) {
                setTimeout(() => {
                    openQrPromo();
                }, 900);
            }

            if (qrPromoCloseBtn) qrPromoCloseBtn.addEventListener('click', closeQrPromo);
            if (qrPromoSkipBtn) qrPromoSkipBtn.addEventListener('click', closeQrPromo);
            if (qrPromoOverlay) qrPromoOverlay.addEventListener('click', closeQrPromo);

            if (qrPromoCtaBtn) {
                qrPromoCtaBtn.addEventListener('click', () => {
                    closeQrPromo();
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && qrPromoModal.classList.contains('active')) {
                    closeQrPromo();
                }
            });
        }

        // --- 9. Presskit Live Promo Pop-up Modal Handler (https://www.presskitlive.com) ---
        const presskitPromoModal = document.getElementById('presskit-promo-modal');
        const presskitPromoOverlay = document.getElementById('presskit-promo-overlay');
        const presskitPromoCloseBtn = document.getElementById('presskit-promo-close-btn');
        const presskitPromoSkipBtn = document.getElementById('presskit-promo-skip-btn');
        const presskitPromoCtaBtn = document.getElementById('presskit-promo-cta-btn');

        if (presskitPromoModal) {
            function openPresskitPromo() {
                presskitPromoModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }

            function closePresskitPromo() {
                presskitPromoModal.classList.remove('active');
                document.body.style.overflow = '';
                try {
                    sessionStorage.setItem('presskitlive_popup_closed', 'true');
                } catch (e) {
                    console.warn("Storage not available:", e);
                }
            }

            let isClosedInSession = false;
            try {
                isClosedInSession = sessionStorage.getItem('presskitlive_popup_closed') === 'true';
            } catch (e) {}

            if (!isClosedInSession && !hasDeepLink) {
                setTimeout(() => {
                    openPresskitPromo();
                }, 900);
            }

            if (presskitPromoCloseBtn) presskitPromoCloseBtn.addEventListener('click', closePresskitPromo);
            if (presskitPromoSkipBtn) presskitPromoSkipBtn.addEventListener('click', closePresskitPromo);
            if (presskitPromoOverlay) presskitPromoOverlay.addEventListener('click', closePresskitPromo);

            if (presskitPromoCtaBtn) {
                presskitPromoCtaBtn.addEventListener('click', () => {
                    closePresskitPromo();
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && presskitPromoModal.classList.contains('active')) {
                    closePresskitPromo();
                }
            });
        }
    }).catch(err => {
        console.error("Failed to load portfolio data:", err);
        // Fallback: reveal scroll elements so the page content is visible even if fetch fails (e.g. on local file:// protocol)
        document.querySelectorAll('.scroll-reveal').forEach(el => {
            el.classList.add('revealed');
        });
    });
});



