document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Portfolio Dataset (20 Real-World Prestige Brand Case Studies) ---
    fetch('portfolio.json?t=' + Date.now())
        .then(response => response.json())
        .then(portfolioData => {
        // --- 1.5 Dynamic Notice Injection for Brands without PDFs ---
        portfolioData.forEach(item => {
            if (!item.pdfPath) {
                item.desc = "Marka bilgisi eklenecektir. " + item.desc;
                item.challenge = "Marka bilgisi eklenecektir. " + item.challenge;
            }
        });

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
        const sidebarProjectList = document.getElementById('sidebar-project-list');
        const noResults = document.getElementById('no-results');
        let currentCategory = 'all';
        let scrollSpyObserver = null;

        const renderAllDesigns = () => {
            // Disconnect previous scroll spy if exists
            if (scrollSpyObserver) {
                scrollSpyObserver.disconnect();
            }

            // Filter items based on selected category tab
            const filtered = portfolioData.filter(item => {
                return currentCategory === 'all' || item.category === currentCategory;
            });

            // Toggle Empty state display
            if (filtered.length === 0) {
                designsGrid.innerHTML = '';
                sidebarProjectList.innerHTML = '';
                noResults.style.display = 'block';
                return;
            } else {
                noResults.style.display = 'none';
            }

            // 1. Populate Right-Side Gallery Grid
            designsGrid.innerHTML = filtered.map(item => {
                let mediaContent = `
                    <div class="portfolio-img-placeholder ${item.gradient}">
                        <i class="fa-solid ${item.icon} portfolio-icon"></i>
                        <div class="portfolio-particles"></div>
                    </div>
                `;
                if (item.pdfPath) {
                    mediaContent = `
                        <div class="portfolio-img-placeholder pdf-thumbnail-container" id="pdf-thumb-${item.id}" style="background: #060a1a; padding: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                            <div class="spinner" style="width: 30px; height: 30px; border-width: 2px;"></div>
                        </div>
                    `;
                }
                return `
                    <div class="portfolio-item glass-card scroll-reveal revealed" data-id="${item.id}" data-category="${item.category}" style="display: flex; opacity: 1; transform: scale(1);">
                        <div class="portfolio-img-wrapper">
                            ${mediaContent}
                        </div>
                        <div class="portfolio-info">
                            <span class="portfolio-cat">${item.catLabel}</span>
                            <h3 class="portfolio-item-title">${item.title}</h3>
                            <p class="portfolio-item-desc">${item.desc}</p>
                            <span class="portfolio-link">Projeyi İncele <i class="fa-solid fa-arrow-right"></i></span>
                        </div>
                    </div>
                `;
            }).join('');

            // 2. Populate Left-Side Sidebar Brand Name List
            sidebarProjectList.innerHTML = filtered.map((item, index) => `
                <li class="sidebar-project-item ${index === 0 ? 'active' : ''}" id="sidebar-item-${item.id}">
                    <a data-id="${item.id}">${item.title}</a>
                </li>
            `).join('');

            // 3. Bind Sidebar Click scrolling events (Scroll right card into view)
            sidebarProjectList.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = link.getAttribute('data-id');
                    const targetCard = document.querySelector(`.portfolio-item[data-id="${id}"]`);
                    if (targetCard) {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Style active state
                        sidebarProjectList.querySelectorAll('.sidebar-project-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        link.parentElement.classList.add('active');
                    }
                });
            });

            // 4. Implement Scroll Spy (Intersection Observer)
            // Highlights left sidebar brand list as user scrolls right-side masonry grid
            const observerOptions = {
                root: null,
                rootMargin: '-30% 0px -30% 0px', // trigger near screen viewport center
                threshold: 0.1
            };

            scrollSpyObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const cardId = entry.target.getAttribute('data-id');
                        const sidebarItem = document.getElementById(`sidebar-item-${cardId}`);
                        if (sidebarItem) {
                            sidebarProjectList.querySelectorAll('.sidebar-project-item').forEach(item => {
                                item.classList.remove('active');
                            });
                            sidebarItem.classList.add('active');
                        }
                    }
                });
            }, observerOptions);

            // Observe newly rendered cards
            document.querySelectorAll('.portfolio-item').forEach(card => {
                scrollSpyObserver.observe(card);
            });

            applyMagneticHover();
            bindCardClicks();

            // Trigger thumbnail renders
            filtered.forEach(item => {
                if (item.pdfPath) {
                    renderPdfThumbnail(item.pdfPath, `pdf-thumb-${item.id}`);
                }
            });
        };

        // --- 4. Cards Magnetic Hover Micro-Interaction Helper ---
        const applyMagneticHover = () => {
            const cards = document.querySelectorAll('.portfolio-item');
            cards.forEach(card => {
                card.addEventListener('mousemove', (e) => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left - (rect.width / 2);
                    const y = e.clientY - rect.top - (rect.height / 2);
                    card.style.transform = `perspective(1000px) rotateY(${x * 0.04}deg) rotateX(${-y * 0.04}deg) scale(1.02)`;
                });

                card.addEventListener('mouseleave', () => {
                    card.style.transform = '';
                });
            });
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
            loadedModalItems = portfolioData.filter(p => {
                return currentCategory === 'all' || p.category === currentCategory;
            });

            activeModalIndex = loadedModalItems.findIndex(p => p.id === item.id);

            updateModalContent(item);
            modal.classList.add('active');
            modalOverlay.classList.add('active');
            document.body.classList.add('overflow-hidden');
        };

        const updateModalContent = (item) => {
            document.getElementById('modal-cat').textContent = item.catLabel;
            document.getElementById('modal-title').textContent = item.title;
            document.getElementById('modal-client').textContent = `Müşteri: ${item.client}`;

            const bodyContent = `
                <h4 class="modal-section-title">Proje Detayları</h4>
                <p class="modal-desc">${item.challenge}</p>
            
                <h4 class="modal-section-title">Kazanımlar & Sonuç</h4>
                <div class="modal-metrics-grid">
                    <div class="modal-metric-card">
                        <div class="modal-metric-val">${item.metrics[0].val}</div>
                        <div class="modal-metric-lbl">${item.metrics[0].lbl}</div>
                    </div>
                    <div class="modal-metric-card">
                        <div class="modal-metric-val">${item.metrics[1].val}</div>
                        <div class="modal-metric-lbl">${item.metrics[1].lbl}</div>
                    </div>
                </div>
            `;

            document.querySelector('.modal-body').innerHTML = bodyContent;

            const visualSide = document.querySelector('.modal-visual-side');
            if (item.pdfPath) {
                if (window.innerWidth <= 768) {
                    visualSide.innerHTML = `
                        <div class="modal-pdf-fallback-card">
                            <div class="pdf-fallback-canvas-wrapper" id="pdf-canvas-wrap-${item.id}">
                                <div class="spinner" style="width: 30px; height: 30px; border-width: 2px;"></div>
                            </div>
                            <div class="pdf-fallback-overlay"></div>
                            <a href="pdf-viewer.html?file=${encodeURIComponent(item.pdfPath)}&title=${encodeURIComponent(item.title)}" target="_blank" class="modal-pdf-btn">
                                <i class="fa-solid fa-expand"></i> Tasarımları Gör (PDF)
                            </a>
                        </div>
                    `;
                    // Render PDF thumbnail as background
                    setTimeout(() => {
                        renderPdfThumbnail(item.pdfPath, `pdf-canvas-wrap-${item.id}`);
                    }, 50);
                } else {
                    visualSide.innerHTML = `
                        <iframe src="${item.pdfPath}#view=FitH&toolbar=0" style="width: 100%; height: 100%; min-height: 450px; border: none; border-radius: 24px 0 0 24px; display: block; background: #060a1a;" onclick="event.stopPropagation();"></iframe>
                    `;
                }
            } else {
                visualSide.innerHTML = `
                    <div class="modal-visual-bg" id="modal-visual-bg">
                        <i class="modal-visual-icon fa-solid" id="modal-visual-icon"></i>
                        <div class="portfolio-particles"></div>
                    </div>
                `;
                const visualBg = document.getElementById('modal-visual-bg');
                const visualIcon = document.getElementById('modal-visual-icon');

                visualBg.className = 'modal-visual-bg';
                visualBg.classList.add(item.gradient);

                visualIcon.className = 'modal-visual-icon fa-solid';
                visualIcon.classList.add(item.icon);
            }
        };

        const closeCaseStudyModal = () => {
            modal.classList.remove('active');
            modalOverlay.classList.remove('active');
            document.body.classList.remove('overflow-hidden');
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
        const renderPdfThumbnail = (pdfUrl, containerId) => {
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
                container.innerHTML = '<i class="fa-solid fa-file-pdf" style="font-size: 40px; color: rgba(255,255,255,0.15);"></i>';
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
                container.innerHTML = '<i class="fa-solid fa-file-pdf" style="font-size: 40px; color: rgba(255,255,255,0.15);"></i>';
            });
        };

        // --- 7. Initial Execution ---
        renderAllDesigns();
    }).catch(err => {
        console.error("Failed to load portfolio data:", err);
        // Fallback: reveal scroll elements so the page content is visible even if fetch fails (e.g. on local file:// protocol)
        document.querySelectorAll('.scroll-reveal').forEach(el => {
            el.classList.add('revealed');
        });
    });
});

