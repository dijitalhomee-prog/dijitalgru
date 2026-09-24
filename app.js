/* ==========================================================================
   DIJITAL GRU INTERACTIVE WEB EXPERIENCES (JAVASCRIPT)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Dynamic Glow Orb Tracker ---
    const glowOrb = document.getElementById('glow-orb');
    
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        
        // Use requestAnimationFrame for high performance rendering
        window.requestAnimationFrame(() => {
            glowOrb.style.left = `${x}px`;
            glowOrb.style.top = `${y}px`;
        });
    });

    // --- 2. Header & Floating Contact Bar Scroll Transition ---
    const header = document.getElementById('main-header');
    const floatingBar = document.getElementById('floating-contact-bar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Show floating contact bar after scrolling 200px down on mobile/tablet
        if (floatingBar) {
            if (window.scrollY > 200) {
                floatingBar.classList.add('active');
            } else {
                floatingBar.classList.remove('active');
            }
        }
    });

    // Initial check on page load
    if (floatingBar && window.scrollY > 200) {
        floatingBar.classList.add('active');
    }

    // --- 2.5 Floating Contact Bar Event Listeners & Conversion Tracking ---
    const floatingCallBtn = document.getElementById('floating-call-btn');
    const floatingWaBtn = document.getElementById('floating-wa-btn');
    const footerPhoneLink = document.querySelector('a[href^="tel:"]');

    if (floatingCallBtn) {
        floatingCallBtn.addEventListener('click', (e) => {
            if (typeof gtag_report_conversion === 'function') {
                e.preventDefault();
                gtag_report_conversion(floatingCallBtn.href);
            }
        });
    }

    if (floatingWaBtn) {
        floatingWaBtn.addEventListener('click', (e) => {
            if (typeof gtag_report_conversion === 'function') {
                // Let the browser open the new tab as normal, and send conversion in background
                gtag_report_conversion();
            }
        });
    }

    if (footerPhoneLink) {
        footerPhoneLink.addEventListener('click', (e) => {
            if (typeof gtag_report_conversion === 'function') {
                e.preventDefault();
                gtag_report_conversion(footerPhoneLink.href);
            }
        });
    }

    const headerCallBtn = document.getElementById('header-call-btn');
    const mobileCallBtn = document.getElementById('mobile-call-btn');

    if (headerCallBtn) {
        headerCallBtn.addEventListener('click', (e) => {
            if (typeof gtag_report_conversion === 'function') {
                e.preventDefault();
                gtag_report_conversion(headerCallBtn.href);
            }
        });
    }

    if (mobileCallBtn) {
        mobileCallBtn.addEventListener('click', (e) => {
            if (typeof gtag_report_conversion === 'function') {
                e.preventDefault();
                gtag_report_conversion(mobileCallBtn.href);
            }
        });
    }



    // --- 3. Mobile Hamburger Menu Toggle ---
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    const toggleMobileMenu = () => {
        mobileMenuToggle.classList.toggle('active');
        mobileNavDrawer.classList.toggle('active');
        document.body.classList.toggle('overflow-hidden'); // Prevent scroll when open
    };

    mobileMenuToggle.addEventListener('click', toggleMobileMenu);

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileNavDrawer.classList.contains('active')) {
                toggleMobileMenu();
            }
        });
    });

    // --- 4. Portfolio Dataset (20 Real-World Prestige Brand Case Studies) ---
    // --- 1. Fetch Databases dynamically with Cache-busting and Local Fallback ---
    const loadData = () => {
        if (window.location.protocol === 'file:') {
            console.log("Local file protocol detected. Using embedded dataset.");
            return Promise.resolve([window.PORTFOLIO_DATA_BACKUP, window.BLOG_DATA_BACKUP]);
        }
        return Promise.all([
            fetch('portfolio.json?t=' + Date.now()).then(r => {
                if (!r.ok) throw new Error("Portfolio fetch failed");
                return r.json();
            }),
            fetch('blog.json?t=' + Date.now()).then(r => {
                if (!r.ok) throw new Error("Blog fetch failed");
                return r.json();
            })
        ]).catch(err => {
            console.warn("Fetch failed, falling back to embedded dataset:", err);
            return [window.PORTFOLIO_DATA_BACKUP, window.BLOG_DATA_BACKUP];
        });
    };

    loadData().then(([portfolioData, blogData]) => {
        window.BLOG_DATA = blogData;
        // --- 4.5 Dynamic Notice Injection for Brands without PDFs ---
        portfolioData.forEach(item => {
            if (!item.pdfPath) {
                item.desc = "Marka bilgisi eklenecektir. " + item.desc;
                item.challenge = "Marka bilgisi eklenecektir. " + item.challenge;
            }
        });

        // --- 5. Static Portfolio Filter Tabs & Modal Binding Engine ---
        let currentCategory = 'all';

        // Apply interactive magnetic hover effect to static cards
        const applyMagneticHover = () => {
            const cards = document.querySelectorAll('.hero-logo-card, .portfolio-item, .blog-card');
        
            cards.forEach(card => {
                card.removeEventListener('mousemove', handleMagneticMove);
                card.removeEventListener('mouseleave', handleMagneticLeave);
            
                card.addEventListener('mousemove', handleMagneticMove);
                card.addEventListener('mouseleave', handleMagneticLeave);
            });
        };

        const handleMagneticMove = (e) => {
            const card = e.currentTarget;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left - (rect.width / 2);
            const y = e.clientY - rect.top - (rect.height / 2);
        
            card.style.transform = `perspective(1000px) rotateY(${x * 0.04}deg) rotateX(${-y * 0.04}deg) scale(1.02)`;
        };

        const handleMagneticLeave = (e) => {
            const card = e.currentTarget;
            card.style.transform = '';
        };

        // --- 5. Dynamic Portfolio Grid Rendering Engine ---
        const homePortfolioGrid = document.querySelector('.portfolio-grid');
        const tabBtns = document.querySelectorAll('.tab-btn');

        const renderHomePortfolio = () => {
            if (!homePortfolioGrid) return;

            // Filter items based on selected category tab
            let filtered = [];
            if (currentCategory === 'all') {
                // Curated premium selection for "Tümü":
                // - tech: ID 1, 2, 34
                // - social: ID 8 (Sinopia Mantı), 12 (Pozitif Başarı)
                // - branding: ID 25 (Pizza Dino), 26 (Letafia)
                // - print: ID 31 (Vela Ship), 33 (Galleria), 46 (Limoni Hotel Menü), 47 (Bi Nefes Cafe), 48 (Sinopia Mantı Menü)
                // - social: ID 44 (Nuba İstanbul), 45 (Dolce Far Niente)
                // - poster: ID 40 (Cahide Palazzo)
                const curatedIds = [1, 2, 34, 8, 12, 25, 26, 31, 33, 37, 38, 40, 43, 44, 45, 46, 47, 48];
                filtered = portfolioData.filter(item => curatedIds.includes(item.id));
            } else {
                // Show all items of this category
                filtered = portfolioData.filter(item => item.category === currentCategory);
            }

            // Render cards
            homePortfolioGrid.innerHTML = filtered.map(item => {
                let mediaContent = `
                    <div class="portfolio-img-placeholder ${item.gradient}">
                        <i class="fa-solid ${item.icon} portfolio-icon"></i>
                        <div class="portfolio-particles"></div>
                    </div>
                `;
                if (item.pdfPath) {
                    mediaContent = `
                        <div class="portfolio-img-placeholder pdf-thumbnail-container ${item.gradient}" id="pdf-thumb-${item.id}" style="padding: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                            <i class="fa-solid ${item.icon} portfolio-icon" style="font-size: 48px; color: rgba(255, 255, 255, 0.25);"></i>
                            <div class="spinner" style="width: 30px; height: 30px; border-width: 2px; position: absolute; border-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1) rgba(255, 255, 255, 0.1) rgba(255, 255, 255, 0.1);"></div>
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

            // Apply interactive hover animations and click bindings
            applyMagneticHover();
            bindCardClicks();

            // Trigger thumbnail renders
            filtered.forEach(item => {
                if (item.pdfPath) {
                    renderPdfThumbnail(item.pdfPath, `pdf-thumb-${item.id}`);
                }
            });
        };

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active from all buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                // Add active to current button
                btn.classList.add('active');

                currentCategory = btn.getAttribute('data-filter');

                // Dynamic re-render with smooth fade-in
                homePortfolioGrid.style.opacity = '0';
                homePortfolioGrid.style.transform = 'translateY(10px)';
                homePortfolioGrid.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

                setTimeout(() => {
                    renderHomePortfolio();
                    homePortfolioGrid.style.opacity = '1';
                    homePortfolioGrid.style.transform = 'translateY(0)';
                }, 300);
            });
        });
        // Slider navigation controls
        const slidePrevBtn = document.getElementById('slide-prev');
        const slideNextBtn = document.getElementById('slide-next');

        if (slidePrevBtn && slideNextBtn && homePortfolioGrid) {
            slidePrevBtn.addEventListener('click', () => {
                homePortfolioGrid.scrollBy({ left: -404, behavior: 'smooth' }); // card width + gap (380 + 24)
            });
            slideNextBtn.addEventListener('click', () => {
                homePortfolioGrid.scrollBy({ left: 404, behavior: 'smooth' }); // card width + gap (380 + 24)
            });
        }

        // Bind clicks to dynamically rendered cards to open Case-Study Lightbox Modal
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

        // --- 6. Lightbox Case-Study Modal Engine (Vanillas JS Multi-Level Lightbox) ---
        const modal = document.getElementById('case-study-modal');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const modalPrevBtn = document.getElementById('modal-prev-btn');
        const modalNextBtn = document.getElementById('modal-next-btn');

        let activeModalIndex = 0;
        let loadedModalItems = []; // Keeps track of currently filtered items to allow slider navigation

        const openCaseStudyModal = (projectId) => {
            const item = portfolioData.find(p => p.id === parseInt(projectId));
            if (!item) return;

            // Set list of active slider projects based on the current filtered list
            loadedModalItems = portfolioData.filter(p => {
                return currentCategory === 'all' || p.category === currentCategory;
            });

            // Find index of current item in the slider list
            activeModalIndex = loadedModalItems.findIndex(p => p.id === item.id);

            updateModalContent(item);

            modal.classList.add('active');
            document.body.classList.add('overflow-hidden');
        };

        const updateModalContent = (item) => {
            // Set values inside modal
            document.getElementById('modal-cat').textContent = item.catLabel;
            document.getElementById('modal-title').textContent = item.title;
            document.getElementById('modal-client').textContent = `Müşteri: ${item.client}`;
        
            // Detailed Case study content paragraphs (Consolidated for a single screen view without scrollbar)
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

            // Set visual side content
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

                // Clear previous gradient classes from visual side
                visualBg.className = 'modal-visual-bg';
                visualBg.classList.add(item.gradient);

                // Set FontAwesome icon
                visualIcon.className = 'modal-visual-icon fa-solid';
                visualIcon.classList.add(item.icon);
            }
        };

        const closeCaseStudyModal = () => {
            modal.classList.remove('active');
            document.body.classList.remove('overflow-hidden');
        };

        // Card click bindings are already handled on startup

        // Lightbox Modal slider navigation clicks
        modalPrevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (loadedModalItems.length <= 1) return;
            activeModalIndex = (activeModalIndex - 1 + loadedModalItems.length) % loadedModalItems.length;
            updateModalContent(loadedModalItems[activeModalIndex]);
        });

        modalNextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (loadedModalItems.length <= 1) return;
            activeModalIndex = (activeModalIndex + 1) % loadedModalItems.length;
            updateModalContent(loadedModalItems[activeModalIndex]);
        });

        // Close Modal event listeners
        modalCloseBtn.addEventListener('click', closeCaseStudyModal);
        modalOverlay.addEventListener('click', closeCaseStudyModal);

        // Keyboard ESC key listener to close modal and left/right keys to navigate
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

        // Expose modal opener globally for software showcase badges
        window.openPortfolioModal = openCaseStudyModal;

        // --- 6.5. About Us Accordion Toggle Engine ---
        const aboutHeader = document.getElementById('about-accordion-header');
        const aboutCard = document.getElementById('about-accordion-card');
        const aboutContent = document.getElementById('about-accordion-content');
        const aboutToggleLabel = document.querySelector('.about-toggle-label');

        if (aboutHeader && aboutCard && aboutContent) {
            function toggleAboutAccordion(expand) {
                const isExpanded = aboutCard.classList.contains('is-open');
                const shouldExpand = expand !== undefined ? expand : !isExpanded;
                
                if (shouldExpand) {
                    aboutCard.classList.add('is-open');
                    aboutHeader.setAttribute('aria-expanded', 'true');
                    if (aboutToggleLabel) aboutToggleLabel.textContent = 'Kapat';
                    aboutContent.style.maxHeight = aboutContent.scrollHeight + 100 + 'px';
                } else {
                    aboutCard.classList.remove('is-open');
                    aboutHeader.setAttribute('aria-expanded', 'false');
                    if (aboutToggleLabel) aboutToggleLabel.textContent = 'Detaylı İncele & Ekibimiz';
                    aboutContent.style.maxHeight = '0px';
                }
            }

            aboutHeader.addEventListener('click', () => toggleAboutAccordion());
            aboutHeader.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAboutAccordion();
                }
            });

            // Auto-open accordion when user clicks navbar links to #about
            document.querySelectorAll('a[href="#about"]').forEach(link => {
                link.addEventListener('click', () => {
                    toggleAboutAccordion(true);
                });
            });
        }

        // Initial startup bindings and dynamic portfolio render
        renderHomePortfolio();

        // --- 7. Dynamic Homepage Blog Grid (Latest 3 Posts from window.BLOG_DATA) ---
        const renderHomeBlog = () => {
            const grid = document.getElementById('home-blog-grid');
            if (!grid || !window.BLOG_DATA) return;

            // Sort by id descending → highest id = newest post
            const latest = [...window.BLOG_DATA]
                .sort((a, b) => b.id - a.id)
                .slice(0, 3);

            grid.innerHTML = latest.map(post => {
                const imgBlock = post.image
                    ? `<div style="overflow:hidden; border-radius: 16px 16px 0 0; height: 220px;">
                           <img src="${post.image}" alt="${post.title}" style="width:100%;height:100%;object-fit:cover;object-position:${post.imagePosition || '50% 35%'};display:block;" loading="lazy">
                       </div>`
                    : `<div class="blog-card-img-wrapper">
                           <div class="blog-card-placeholder ${post.gradient}">
                               <i class="fa-solid ${post.icon} blog-card-icon"></i>
                               <div class="portfolio-particles"></div>
                           </div>
                       </div>`;

                return `
                    <article class="blog-card glass-card scroll-reveal" data-id="${post.id}">
                        <div class="blog-card-img-wrapper" style="height:220px; position:relative;">
                            ${imgBlock}
                            <span class="blog-card-badge">${post.badge || post.category}</span>
                        </div>
                        <div class="blog-card-content">
                            <div class="blog-card-meta">
                                <span class="meta-date"><i class="fa-regular fa-calendar"></i> ${post.date}</span>
                                <span class="meta-read"><i class="fa-regular fa-clock"></i> ${post.readTime}</span>
                            </div>
                            <h3 class="blog-card-title">${post.title}</h3>
                            <p class="blog-card-excerpt">${post.excerpt}</p>
                            <a href="blog.html?post=${post.id}" class="blog-card-link">Devamını Oku <i class="fa-solid fa-arrow-right"></i></a>
                        </div>
                    </article>
                `;
            }).join('');

            // Re-apply magnetic hover to new cards
            applyMagneticHover();
        };

        renderHomeBlog();


        // --- 9. Interactive Stat Counter Animation ---
        const statNums = document.querySelectorAll('.stat-num');
        let countersStarted = false;

        const startCounters = () => {
            if (statNums.length === 0) return;
            statNums.forEach(stat => {
                const target = parseInt(stat.getAttribute('data-target'));
                let current = 0;
                const duration = 2000; // 2 seconds
                const increment = target / (duration / 16); // 60fps refresh rate roughly
            
                const counter = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        stat.textContent = target + (stat.textContent.includes('+') ? '+' : '');
                        clearInterval(counter);
                    } else {
                        stat.textContent = Math.floor(current) + (stat.textContent.includes('+') ? '+' : '');
                    }
                }, 16);
            });
        };

        // --- 9. Robust Intersection Observer for Staggered Scroll Reveals ---
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-link');

        const observerOptions = {
            root: null,
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px'
        };

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Scroll Reveal: Trigger animation class
                    if (entry.target.classList.contains('scroll-reveal')) {
                        entry.target.classList.add('revealed');
                    }
                
                    // Nested scroll reveal elements inside the section
                    const nestedReveals = entry.target.querySelectorAll('.scroll-reveal');
                    nestedReveals.forEach((el, index) => {
                        setTimeout(() => {
                            el.classList.add('revealed');
                        }, index * 120); // staggered entrance
                    });

                    // Trigger stat counters when entering 'about'
                    if (entry.target.id === 'about' && !countersStarted) {
                        startCounters();
                        countersStarted = true;
                    }

                    // Active Nav Link highlight
                    const currentId = entry.target.getAttribute('id');
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${currentId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }, observerOptions);

        // Observe sections and all reveal elements
        sections.forEach(sec => sectionObserver.observe(sec));
        document.querySelectorAll('.scroll-reveal').forEach(el => sectionObserver.observe(el));

        // --- 10. Premium Glassmorphic Contact Form Handling ---
        const allContactForms = document.querySelectorAll('form.contact-form, #main-contact-form, #contact-form');

        allContactForms.forEach(contactForm => {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
            
                const submitBtn = contactForm.querySelector('.btn-submit, button[type="submit"]');
                const btnSpan = submitBtn ? submitBtn.querySelector('span') : null;
                const originalText = btnSpan ? btnSpan.textContent : (submitBtn ? submitBtn.textContent : 'Mesaj Gönder');
            
                // Show loading state
                if (submitBtn) {
                    submitBtn.disabled = true;
                    if (btnSpan) btnSpan.textContent = 'Gönderiliyor...';
                    const icon = submitBtn.querySelector('i');
                    if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin';
                }

                const nameField = contactForm.querySelector('#name') || contactForm.querySelector('[name="name"]');
                const emailField = contactForm.querySelector('#email') || contactForm.querySelector('[name="email"]');
                const subjectField = contactForm.querySelector('#subject-field') || contactForm.querySelector('#subject') || contactForm.querySelector('[name="subject_title"]');
                const messageField = contactForm.querySelector('#message') || contactForm.querySelector('[name="message"]');

                const nameVal = nameField ? nameField.value : "";
                const emailVal = emailField ? emailField.value : "";
                const subjectVal = subjectField ? subjectField.value : "Dijital Gru - Web İletişim Teklifi";
                const messageVal = messageField ? messageField.value : "";

                // FormSubmit.co AJAX POST - Sends directly to dijitalgru@gmail.com
                const formData = new FormData();
                formData.append('name', nameVal);
                formData.append('email', emailVal);
                formData.append('subject', 'Dijital Gru Web İletişim: ' + subjectVal);
                formData.append('message', messageVal);
                formData.append('_captcha', 'false');

                fetch("https://formsubmit.co/ajax/dijitalgru@gmail.com", {
                    method: "POST",
                    body: formData
                })
                .then(async (response) => {
                    if (response.ok) {
                        // Display clean success alert inside the form card
                        let container = contactForm.parentElement;
                        contactForm.style.display = 'none';
                        
                        let successMsg = document.createElement('div');
                        successMsg.className = 'form-success-box';
                        successMsg.style.cssText = 'text-align: center; padding: 40px 20px; background: rgba(12, 19, 48, 0.9); border-radius: 20px; border: 1px solid rgba(220, 169, 99, 0.3);';
                        successMsg.innerHTML = `
                            <div style="font-size: 54px; color: #f59e0b; margin-bottom: 16px;"><i class="fa-solid fa-circle-check"></i></div>
                            <h3 style="font-family: var(--font-headings); font-size: 24px; font-weight: 800; color: #ffffff; margin-bottom: 10px;">Teşekkür Ederiz!</h3>
                            <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin-bottom: 24px; line-height: 1.6;">Mesajınız dijitalgru@gmail.com adresimize başarıyla iletildi. En kısa sürede sizinle iletişime geçeceğiz.</p>
                            <button onclick="location.reload()" class="btn btn-secondary" style="padding: 10px 24px; font-size: 14px;">Yeni Mesaj Gönder</button>
                        `;
                        container.appendChild(successMsg);

                        contactForm.reset();
                        
                        // Trigger Google Ads conversion tracking
                        if (typeof gtag_report_conversion === 'function') {
                            gtag_report_conversion();
                        }
                    } else {
                        throw new Error("Formsubmit delivery failed");
                    }
                })
                .catch(error => {
                    console.error("FormSubmit Error:", error);
                    // Fallback to mailto link if offline or blocked
                    const mailtoUrl = `mailto:dijitalgru@gmail.com?subject=${encodeURIComponent(subjectVal)}&body=${encodeURIComponent("Gönderen: " + nameVal + "\nE-posta: " + emailVal + "\n\nMesaj:\n" + messageVal)}`;
                    window.location.href = mailtoUrl;
                })
                .finally(() => {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        if (btnSpan) btnSpan.textContent = originalText;
                        const icon = submitBtn.querySelector('i');
                        if (icon) icon.className = 'fa-solid fa-paper-plane';
                    }
                });
            });
        });

        if (btnResetForm) {
            btnResetForm.addEventListener('click', () => {
                // Go back to form screen
                contactFormCard.classList.remove('success');
            });
        }

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
        // --- 14. QR Studio Promo Pop-up Modal Handler ---
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

            // Show popup smoothly after 900ms if not closed in current session
            let isClosedInSession = false;
            try {
                isClosedInSession = sessionStorage.getItem('qrdijitalgru_popup_closed') === 'true';
            } catch (e) {}

            if (!isClosedInSession) {
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

        // --- 15. Presskit Live Promo Pop-up Modal Handler (https://www.presskitlive.com) ---
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

            if (!isClosedInSession) {
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
        console.error("Failed to load portfolio or blog data:", err);
        // Fallback: reveal scroll elements so the page content is visible even if fetch fails (e.g. on local file:// protocol)
        document.querySelectorAll('.scroll-reveal').forEach(el => {
            el.classList.add('revealed');
        });
    });
});



