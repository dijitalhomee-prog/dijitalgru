document.addEventListener('DOMContentLoaded', () => {
    fetch('blog.json?t=' + Date.now())
        .then(response => response.json())
        .then(blogData => {
            window.BLOG_DATA = blogData;
        const blogData = window.BLOG_DATA;

        // --- 2. Dynamic Mouse Tracker Glow Orb ---
        const glowOrb = document.getElementById('glow-orb');
        if (glowOrb) {
            document.addEventListener('mousemove', (e) => {
                window.requestAnimationFrame(() => {
                    glowOrb.style.left = e.clientX + 'px';
                    glowOrb.style.top = e.clientY + 'px';
                });
            });
        }

        // --- 3. Dynamic Rendering, Category Filter & Search Engine ---
        const designsGrid = document.getElementById('designs-grid');
        const sidebarProjectList = document.getElementById('sidebar-project-list');
        const noResults = document.getElementById('no-results');
        const searchInput = document.getElementById('blog-search');
    
        let currentCategory = 'all';
        let searchQuery = '';

        const renderBlog = () => {
            // Filter dataset based on category tabs and search inputs
            const filtered = blogData.filter(post => {
                const matchesCategory = currentCategory === 'all' || post.category === currentCategory;
                const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     post.category.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
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

            // 1. Populate Right-Side Grid with Glassmorphic Blog Cards
            designsGrid.innerHTML = filtered.map(post => `
                <div class="portfolio-item glass-card scroll-reveal revealed" data-id="${post.id}" style="display: flex; opacity: 1; transform: scale(1); flex-direction: column;">
                    <div class="blog-card-img-wrapper" style="height: 220px;">
                        ${post.image ? 
                            `<img src="${post.image}" alt="${post.title}" style="width:100%;height:100%;object-fit:cover;object-position:${post.imagePosition || '50% 35%'};border-radius:16px 16px 0 0;" loading="lazy">` :
                            `<div class="blog-card-placeholder ${post.gradient}">
                                <i class="fa-solid ${post.icon} blog-card-icon" style="font-size: 42px;"></i>
                                <div class="portfolio-particles"></div>
                            </div>`
                        }
                        <span class="blog-card-badge">${post.badge || post.category}</span>
                    </div>
                    <div class="blog-card-content" style="padding: 24px;">
                        <div class="blog-card-meta" style="margin-bottom: 12px; font-size: 12px;">
                            <span class="meta-date"><i class="fa-regular fa-calendar"></i> ${post.date}</span>
                            <span class="meta-read"><i class="fa-regular fa-clock"></i> ${post.readTime}</span>
                        </div>
                        <h3 class="blog-card-title" style="font-size: 18px; margin-bottom: 8px;">${post.title}</h3>
                        <p class="blog-card-excerpt" style="font-size: 13px; line-height: 1.5; margin-bottom: 18px;">${post.excerpt}</p>
                        <span class="blog-card-link" style="font-size: 13px;">Okumaya Başla <i class="fa-solid fa-arrow-right"></i></span>
                    </div>
                </div>
            `).join('');

            // 2. Populate Left-Side Sidebar list of titles
            sidebarProjectList.innerHTML = filtered.map((post, index) => `
                <li class="sidebar-project-item ${index === 0 && !searchQuery ? 'active' : ''}" id="sidebar-item-${post.id}">
                    <a data-id="${post.id}">${post.title}</a>
                </li>
            `).join('');

            // 3. Bind Sidebar Click scrolling (Scroll corresponding card into view)
            sidebarProjectList.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = link.getAttribute('data-id');
                    const targetCard = document.querySelector(`.portfolio-item[data-id="${id}"]`);
                    if (targetCard) {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                        sidebarProjectList.querySelectorAll('.sidebar-project-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        link.parentElement.classList.add('active');
                    }
                });
            });

            // Re-bind hover & click listeners to the new cards
            applyMagneticHover();
            bindCardClicks();
        };

        // --- 4. Cards Magnetic Hover Micro-Interaction ---
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

        // --- 5. Event Listeners for Filters & Search ---
        // Category tabs
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.getAttribute('data-filter');
                renderBlog();
            });
        });

        // Real-time search box in sidebar
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderBlog();
            });
        }

        // --- 6. Lightbox Article Modal Reader Engine ---
        const modal = document.getElementById('case-study-modal');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const modalPrevBtn = document.getElementById('modal-prev-btn');
        const modalNextBtn = document.getElementById('modal-next-btn');

        let activeModalIndex = 0;
        let loadedModalItems = [];

        const openBlogModal = (postId) => {
            const post = blogData.find(p => p.id === parseInt(postId));
            if (!post) return;

            // Populate active slider group based on current filtered/rendered cards
            loadedModalItems = blogData.filter(post => {
                const matchesCategory = currentCategory === 'all' || post.category === currentCategory;
                const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     post.category.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
            });

            activeModalIndex = loadedModalItems.findIndex(p => p.id === post.id);

            updateModalContent(post);
            modal.classList.add('active');
            modalOverlay.classList.add('active');
            document.body.classList.add('overflow-hidden');
        };

        const updateModalContent = (post) => {
            document.getElementById('modal-cat').textContent = post.category;
            document.getElementById('modal-title').textContent = post.title;
            document.getElementById('modal-client').innerHTML = `<i class="fa-regular fa-calendar"></i> ${post.date} | <i class="fa-regular fa-clock"></i> ${post.readTime}`;

            // Populate the actual detailed text content
            document.querySelector('.modal-body').innerHTML = post.content;

            // Visual side gradient and icon matches
            const visualBg = document.getElementById('modal-visual-bg');
            const visualIcon = document.getElementById('modal-visual-icon');

            if (post.image) {
                visualBg.className = 'modal-visual-bg';
                visualBg.style.backgroundImage = `url('${post.image}')`;
                visualBg.style.backgroundSize = 'cover';
                visualBg.style.backgroundPosition = 'center';
                visualIcon.style.display = 'none';
            } else {
                visualBg.className = 'modal-visual-bg';
                visualBg.style.backgroundImage = '';
                visualBg.classList.add(post.gradient);
                visualIcon.className = 'modal-visual-icon fa-solid';
                visualIcon.classList.add(post.icon);
                visualIcon.style.display = '';
            }

            // Dynamic SEO Update
            if (post.seo) {
                document.title = post.seo.title;
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) {
                    metaDesc.setAttribute('content', post.seo.description);
                }
                let metaKeywords = document.querySelector('meta[name="keywords"]');
                if (!metaKeywords) {
                    metaKeywords = document.createElement('meta');
                    metaKeywords.name = "keywords";
                    document.getElementsByTagName('head')[0].appendChild(metaKeywords);
                }
                metaKeywords.setAttribute('content', post.seo.keywords);
            } else {
                document.title = "Blog & Yayınlarımız | Dijital Gru Kreatif Reklam Ajansı";
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) {
                    metaDesc.setAttribute('content', "Yapay zeka, dijital marka konumlandırma stratejileri ve kullanıcı deneyimi (UX) tasarımı üzerine en güncel makaleler ve sektörel içgörüler.");
                }
                const metaKeywords = document.querySelector('meta[name="keywords"]');
                if (metaKeywords) {
                    metaKeywords.remove();
                }
            }
        };

        const closeBlogModal = () => {
            modal.classList.remove('active');
            modalOverlay.classList.remove('active');
            document.body.classList.remove('overflow-hidden');
        
            // Reset SEO Meta Info
            document.title = "Blog & Yayınlarımız | Dijital Gru Kreatif Reklam Ajansı";
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.setAttribute('content', "Yapay zeka, dijital marka konumlandırma stratejileri ve kullanıcı deneyimi (UX) tasarımı üzerine en güncel makaleler ve sektörel içgörüler.");
            }
            const metaKeywords = document.querySelector('meta[name="keywords"]');
            if (metaKeywords) {
                metaKeywords.remove();
            }
        
            // Clean URL parameter on modal close (go back to clean blog.html)
            if (window.location.search.includes('post=')) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        const bindCardClicks = () => {
            const cards = document.querySelectorAll('.portfolio-item');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.getAttribute('data-id');
                    openBlogModal(id);
                });
            });
        };

        // Modal sliding controls (Next / Previous post)
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

        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeBlogModal);
        if (modalOverlay) modalOverlay.addEventListener('click', closeBlogModal);

        // ESC close and left/right navigation keys
        document.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('active')) return;

            if (e.key === 'Escape') {
                closeBlogModal();
            } else if (e.key === 'ArrowLeft') {
                modalPrevBtn.click();
            } else if (e.key === 'ArrowRight') {
                modalNextBtn.click();
            }
        });

        // --- 7. Router: Auto-open post if requested via URL Query Parameter ?post=X ---
        const checkUrlRoute = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const postId = urlParams.get('post');
            if (postId) {
                // Auto open the requested post reader popup modal
                setTimeout(() => {
                    openBlogModal(postId);
                }, 300);
            }
        };

        // --- 8. Initial Setup ---
        renderBlog();
        checkUrlRoute();
    });
});
