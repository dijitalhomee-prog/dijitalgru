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

    // --- 2. Header Scroll Transition ---
    const header = document.getElementById('main-header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

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
    // --- 1. Fetch Databases dynamically with Cache-busting ---
    Promise.all([
        fetch('portfolio.json?t=' + Date.now()).then(r => r.json()),
        fetch('blog.json?t=' + Date.now()).then(r => r.json())
    ]).then(([portfolioData, blogData]) => {
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
                // 2 items from each key category:
                // - tech: ID 1, 2, 34
                // - social: ID 8 (Sinopia Mantı), 12 (Pozitif Başarı)
                // - branding: ID 25 (Pizza Dino), 26 (Letafia)
                // - print: ID 31 (Vela Ship), 33 (Galleria)
                const curatedIds = [1, 2, 34, 8, 12, 25, 26, 31, 33, 35];
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
                        <div class="portfolio-img-placeholder" style="background: #060a1a; padding: 0;">
                            <iframe src="${item.pdfPath}#view=FitH&toolbar=0" style="width: 100%; height: 100%; border: none; display: block; background: #060a1a; pointer-events: none;"></iframe>
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
                card.addEventListener('click', () => {
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
                visualSide.innerHTML = `
                    <iframe src="${item.pdfPath}#view=FitH&toolbar=0" style="width: 100%; height: 100%; min-height: 450px; border: none; border-radius: 24px 0 0 24px; display: block; background: #060a1a;" onclick="event.stopPropagation();"></iframe>
                `;
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
        const contactFormCard = document.querySelector('.contact-form-card');
        const contactForm = document.getElementById('contact-form');
        const btnResetForm = document.getElementById('btn-reset-form');

        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
            
                const submitBtn = contactForm.querySelector('.btn-submit');
                const originalText = submitBtn.querySelector('.btn-text').textContent;
            
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.querySelector('.btn-text').textContent = 'Gönderiliyor...';
                submitBtn.querySelector('.btn-icon').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

                const nameVal = document.getElementById('name').value;
                const emailVal = document.getElementById('email').value;
                const subjectVal = document.getElementById('subject').value || "Dijital Gru - Yeni Proje Teklifi";
                const messageVal = document.getElementById('message').value;

                // Simulate secure submission API delay
                setTimeout(() => {
                    // Reset button state
                    submitBtn.disabled = false;
                    submitBtn.querySelector('.btn-text').textContent = originalText;
                    submitBtn.querySelector('.btn-icon').innerHTML = '<i class="fa-solid fa-paper-plane"></i>';

                    // Construct mailto link dynamically
                    const emailTarget = "dijitalgru@gmail.com";
                    const mailtoBody = `Gönderen: ${nameVal}\nE-posta: ${emailVal}\n\nMesaj:\n${messageVal}`;
                    const mailtoUrl = `mailto:${emailTarget}?subject=${encodeURIComponent(subjectVal)}&body=${encodeURIComponent(mailtoBody)}`;
                
                    // Trigger mail client opening
                    window.location.href = mailtoUrl;

                    // Show success screen
                    contactFormCard.classList.add('success');
                    contactForm.reset();
                }, 1800);
            });
        }

        if (btnResetForm) {
            btnResetForm.addEventListener('click', () => {
                // Go back to form screen
                contactFormCard.classList.remove('success');
            });
        }
    });
});
