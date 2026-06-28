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
    const portfolioData = [
        // --- 1. YAZILIM & WEB (tech) - 3 items ---
        {
            id: 1,
            title: "Grid Planner Web Sitesi",
            client: "Dijital Gru Labs",
            category: "tech",
            catLabel: "Yazılım & UX/UI",
            desc: "Ajanslar ve içerik üreticileri için tasarlanmış yeni nesil görsel sosyal medya içerik planlama ve otomasyon platformu arayüz ve altyapı tasarımı.",
            icon: "fa-calendar-days",
            gradient: "tech-gradient",
            pdfPath: "tum-markalar/yazilim-ve-web/grid-planner.pdf",
            metrics: [
                { val: "99.8%", lbl: "Uptime Süresi" },
                { val: "+312%", lbl: "İş Akışı Verimliliği" }
            ],
            challenge: "Ajansların ve sosyal medya yöneticilerinin içerik planlama süreçlerindeki dağınıklığı gidermek, tamamen görsel ve sürükle-bırak mantığına dayanan estetik bir araç yaratmaktı. Dijital Gru olarak kullanıcı deneyimini en üst seviyeye taşıyacak akıcı bir arayüz ve robust bir backend mimarisi geliştirdik."
        },
        {
            id: 2,
            title: "Dijital Gru Web Sitesi",
            client: "Dijital Gru",
            category: "tech",
            catLabel: "Yazılım & Web Geliştirme",
            desc: "Kreatif ajansımızın modern brütalist ve glassmorphic estetik anlayışını yansıtan, yüksek performanslı etkileşimli kurumsal web sitesi.",
            icon: "fa-rocket",
            gradient: "creative-gradient",
            pdfPath: "tum-markalar/yazilim-ve-web/dijitalgru-yazilim.pdf",
            metrics: [
                { val: "< 0.8s", lbl: "Yüklenme Hızı" },
                { val: "100%", lbl: "Mobil Uyumlu" }
            ],
            challenge: "Kendi dijital vitrinimizi tasarlarken; Awwwards standartlarında akışkan animasyonlar, magnetic hover mikro etkileşimleri ve sol dizin tabanlı split-screen portfolyo yapısıyla ajansımızın teknik ve kreatif sınırlarını en üst seviyede sergiledik."
        },
        {
            id: 34,
            title: "Sinopia Mantı Web Sitesi",
            client: "Sinopia Gurme",
            category: "tech",
            catLabel: "Yazılım & Web Geliştirme",
            desc: "Geleneksel lezzetleri dijital dünyaya taşıyan; minimalist tasarım dili, interaktif menü kurgusu ve yüksek performanslı mobil öncelikli altyapıya sahip kurumsal web sitesi.",
            icon: "fa-globe",
            gradient: "tech-gradient",
            pdfPath: "tum-markalar/yazilim-ve-web/sinopiamantıweb.pdf",
            metrics: [
                { val: "< 1.0s", lbl: "Yüklenme Süresi" },
                { val: "100%", lbl: "Mobil & SEO Uyumu" }
            ],
            challenge: "Fenerbahçe Bağdat Caddesi'ndeki geleneksel Sinop mantısı restoranı Sinopia Mantı Evi için; modern lezzet estetiğini yansıtan, kullanıcıların menü detaylarına, alerjen bilgilerine ve kalori değerlerine saniyeler içinde erişebildiği, Yemeksepeti, Getir ve Trendyol Go entegrasyonlarına sahip, yüksek SEO performanslı ve akıcı bir tek sayfa (Single Page) web sitesi tasarlayıp geliştirmek."
        },

        // --- 2. SOSYAL MEDYA (social) - 12 items ---
        {
            id: 6,
            title: "Korto Alaçatı",
            client: "Korto Group",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Ege'nin kalbindeki popüler mekanın yaz sezonu odaklı enerjik sosyal medya stratejisi ve PR kurguları.",
            icon: "fa-umbrella-beach",
            gradient: "social-gradient",
            metrics: [
                { val: "+310%", lbl: "Erişim Büyümesi" },
                { val: "Yazlık", lbl: "Konsept Yönetimi" }
            ],
            challenge: "Yazlık mekanın samimi, sıcak ve eğlenceli ruhunu yansıtan, anlık hikaye akışları ve trend müziklerle harmanlanmış Reels serileri hazırlamak."
        },
        {
            id: 5,
            title: "Korto İstanbul",
            client: "Korto Group",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "İstanbul'un en prestijli çatı katı/teras konseptinin kreatif sosyal medya yönetimi ve Reels video çekimleri.",
            icon: "fa-city",
            gradient: "creative-gradient",
            metrics: [
                { val: "4K Canlı", lbl: "Kreatif Çekimler" },
                { val: "+195%", lbl: "Aylık Etkileşim" }
            ],
            challenge: "Boğaz manzarasının ve canlı müzik performanslarının yarattığı seçkin atmosferi sinematik 4K gece çekimleri ve dinamik kurgularla dijitalde parlatmak."
        },
        {
            id: 7,
            title: "Korto İzmir",
            client: "Korto Group",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Korto grubunun İzmir şubesi için kurgulanan kurumsal sosyal medya kimliği ve lokal hedef kitle odaklı reklam yönetimi.",
            icon: "fa-guitar",
            gradient: "brand-gradient",
            metrics: [
                { val: "Lokal", lbl: "Hedefli Reklamlar" },
                { val: "+140%", lbl: "Rezervasyon Oranı" }
            ],
            challenge: "İzmir'in seçkin dinleyici kitlesine hitap edecek, sahne alan sanatçıların enerjisini ve mekan konforunu ön plana çıkaran estetik paylaşımlar üretmek."
        },
        {
            id: 17,
            title: "İsla Alaçatı",
            client: "Isla Group",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Bohem ve egzotik lezzet duraklarından İsla Alaçatı için tasarlanan kurumsal kimlik, menü ve basılı grafik setleri.",
            icon: "fa-leaf",
            gradient: "brand-gradient",
            metrics: [
                { val: "Bohem", lbl: "Tasarım Dili" },
                { val: "Doğa Dostu", lbl: "Karton Baskılar" }
            ],
            challenge: "Mekanın botanik ve ahşap ağırlıklı doğallığını yansıtacak, kalın dokulu kraft kağıtlar, organik baskılar ve minimalist logotip tasarımı hazırlamak."
        },
        {
            id: 8,
            title: "Sinopia Mantı",
            client: "Sinopia Gurme",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Geleneksel Türk mantısını modern, sürdürülebilir bir gastronomi markası haline getiren minimalist logo, özel el yapımı ambalaj serileri ve modern menü tasarımları.",
            icon: "fa-bowl-food",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/sinopia-manti-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Gurme", lbl: "Gastronomi Kimliği" },
                { val: "Sürdürülebilir", lbl: "Kraft Ambalaj Seti" }
            ],
            challenge: "Sinopia Mantı'nın geleneksel unlu mamul ve mantı lezzetlerini çağdaş bir gurme restoran zinciri algısıyla buluşturarak; sürdürülebilir kraft paketleme alternatifleri, el çizimi zeytin dalı/başak illüstrasyonları ve modern Akdeniz tipografisi içeren bütünsel bir kurumsal kimlik ve sunum konsepti kurgulamak."
        },
        {
            id: 12,
            title: "Pozitif Başarı",
            client: "Pozitif Başarı",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Murat Karcıoğlu imzalı kişisel gelişim ve motivasyon odaklı kurumsal sosyal medya kimliği ve Reels serileri üretimi.",
            icon: "fa-brain",
            gradient: "creative-gradient",
            pdfPath: "tum-markalar/Sosyal Medya Yönetimi/Pozitif Başarı - Sosyal Medya yönetimi.pdf",
            metrics: [
                { val: "Motivasyon", lbl: "Görsel Kart Tasarımları" },
                { val: "+190%", lbl: "Organik Etkileşim" }
            ],
            challenge: "Kullanıcıların günlük motivasyon kartlarını, sesli meditasyonları ve yazıları saniyeler içinde okuyup dinleyebileceği, sakinleştirici renklerde minimalist sosyal medya şablonları kurgulamak."
        },
        {
            id: 21,
            title: "Dolce Far Niente",
            client: "Dolce Far Niente Co.",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "İtalyan 'tatlı boş oturma' felsefesini yansıtan premium lezzet ve kokteyl konseptinin kreatif sosyal medya yönetimi ve estetik Reels serileri.",
            icon: "fa-utensils",
            gradient: "social-gradient",
            metrics: [
                { val: "+175%", lbl: "Etkileşim Büyümesi" },
                { val: "Sinematik", lbl: "İtalyan Konsept" }
            ],
            challenge: "Dolce Far Niente felsefesinin (tatlı boş durma / keyif yapma) İtalyan trattoria sıcaklığı ve seçkinliğini yansıtan, ağır ritimli pürüzsüz Reels çekimleri, makro yemek videoları ve sıcak pastel renklerde stüdyo paylaşımları kurgulamak."
        },
        {
            id: 9,
            title: "Gusto Ephesus",
            client: "Gusto Ephesus",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Efes'in tarihi ve kültürel mirasından ilham alan premium gastronomi markasının kreatif sosyal medya yönetimi.",
            icon: "fa-wine-glass",
            gradient: "brand-gradient",
            metrics: [
                { val: "Kültürel", lbl: "Antik Çizgiler" },
                { val: "Premium", lbl: "Görsel Standart" }
            ],
            challenge: "Antik Efes tarihini modern gastronomi çizgileriyle birleştirerek markaya köklü ama çağdaş bir lüks algısı kazandıran özel sosyal medya tasarımları yaratmak."
        },
        {
            id: 11,
            title: "Restart İzmir",
            client: "Restart A.Ş.",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "İzmir merkezli inovasyon ve gelişim markası için hazırlanan kurumsal sosyal medya kimliği ve LinkedIn B2B içerik planlaması.",
            icon: "fa-rocket",
            gradient: "tech-gradient",
            metrics: [
                { val: "B2B", lbl: "LinkedIn İçerikleri" },
                { val: "SEO", lbl: "Uyumlu Altyapı" }
            ],
            challenge: "Restart'ın kurumsal gelişim ve danışmanlık kimliğini B2B kitleye yansıtacak, prestijli infografikler ve sade teknik özetler halinde kreatif içerikler hazırlamak."
        },
        {
            id: 4,
            title: "1890 Urla",
            client: "1890 Urla",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Tarihi ve doğayla iç içe otel ve restoran konseptinin prestijli kurumsal sosyal medya kimliği ve PR kurguları.",
            icon: "fa-key",
            gradient: "brand-gradient",
            metrics: [
                { val: "Premium", lbl: "İçerik Dili" },
                { val: "+160%", lbl: "Erişim Artışı" }
            ],
            challenge: "Urla'nın tarihi dokusunu ve 1890 yılından kalan mimari zarafeti yansıtacak, premium görsel standartlar ve lokal gastronomi turizmi odaklı sosyal medya içerikleri kurgulamak."
        },
        {
            id: 3,
            title: "Mathilda’s",
            client: "Mathilda Bar",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Gastronomi ve niş kokteyl konseptinin estetik Instagram kimliği, basılı/dijital menü tasarımı ve viral Reels kampanyaları yönetimi.",
            icon: "fa-martini-glass-citrus",
            gradient: "social-gradient",
            metrics: [
                { val: "1.2M+", lbl: "Organik Reels" },
                { val: "+190%", lbl: "Rezervasyon Artışı" }
            ],
            challenge: "Barın loş, mistik ve çekici kokteyl atmosferini, özel stüdyo ışıklandırmalarıyla çekilen karanlık ve estetik kokteyl hazırlık videolarıyla Instagram akışına yansıtmak."
        },
        {
            id: 10,
            title: "Snap İzmir",
            client: "Snap Burger",
            category: "social",
            catLabel: "Sosyal Medya Yönetimi",
            desc: "Snap İzmir'in dinamik kentsel enerjisini ve lezzetli menüsünü tanıtan genç ve trend Reels odaklı sosyal medya yönetimi.",
            icon: "fa-camera",
            gradient: "social-gradient",
            metrics: [
                { val: "+220%", lbl: "Etkileşim Artışı" },
                { val: "Dinamik", lbl: "Hızlı Video Kurgusu" }
            ],
            challenge: "Özellikle üniversiteli genç kitleyi çekmek için hızlı kurgulanmış, samimi, eğlenceli ve yemeğin çıtırlığını/lezzetini hissettiren dinamik ses geçişli videolar tasarlamak."
        },

        // --- 3. BRANDING (branding) - 8 items (Pizza Dino, Letafia, Aybüke Tosun, Galleria, Cacao, Bohemiam, Sinopia Mantı & Ekmek Arası) ---
        {
            id: 25,
            title: "Pizza Dino",
            client: "Pizza Dino Co.",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Ambalaj",
            desc: "Taş fırından yeni çıkmış çıtır pizzaları, dinamik ve eğlenceli dinozor temalı ambalajlarla buluşturan yüksek kaliteli kurumsal kimlik, dinamik menü tasarımı ve marka konsepti.",
            icon: "fa-pizza-slice",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/pizza-dino-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Dinamik", lbl: "Eğlenceli Karakter" },
                { val: "%100 Geri Dönüşüm", lbl: "Kutu & Ambalaj Seti" }
            ],
            challenge: "Geleneksel pizza restoran algısını, dinamik, genç ve eğlenceli bir dinozor temasıyla yeniden tanımlayarak; canlı renk paleti, özel pizza kutusu tasarımları, eğlenceli illüstrasyonlar ve bütünsel bir kurumsal kimlik kurgulamak."
        },
        {
            id: 26,
            title: "Letafia",
            client: "Letafia Shoes",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Marka Kimliği",
            desc: "El yapımı premium kadın ayakkabısı ve gelin koleksiyonlarının zarafetini modern estetikle buluşturan seçkin kurumsal kimlik, özel tipografi ve lüks ambalaj tasarımı.",
            icon: "fa-gem",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/letafia-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Premium", lbl: "Zarafet & El İşçiliği" },
                { val: "Lüks Ambalaj", lbl: "Kutu & Karton Tasarımı" }
            ],
            challenge: "Modern ve bağımsız kadının stilini yansıtan Letafia kadın ayakkabı markası için, özellikle gelin ve abiye koleksiyonlarının el yapımı zarafetini ön plana çıkaran; sofistike bir logo, pastel tonlarda seçkin bir renk paleti, yaldız folyo baskılı premium ayakkabı kutuları ve bütünsel bir lüks kurumsal kimlik kurgulamak."
        },
        {
            id: 27,
            title: "Aybüke Tosun",
            client: "Aybüke Tosun Photography",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Konsept",
            desc: "Doğum, aile ve düğün fotoğrafçılığının duyusal hikayelerini yansıtan pastel ve minimalist kurumsal kimlik, el yapımı monogram logo ve marka tasarımı.",
            icon: "fa-camera-retro",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/aybuke-tosun-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Sanatsal", lbl: "Fotoğraf Konsepti" },
                { val: "Minimalist", lbl: "Kurumsal Çizgi" }
            ],
            challenge: "İstanbul merkezli profesyonel fotoğraf sanatçısı Aybüke Tosun için; doğum, yenidoğan, aile ve düğün fotoğrafçılığının sıcak, duygusal ve güven veren doğasını yansıtan; minimalist pastel renk paleti, zarif bir monogram logo, el yapımı teşekkür kartları ve prestijli fotoğraf albümü ambalaj tasarımlarını kapsayan seçkin bir kurumsal kimlik kurgulamak."
        },
        {
            id: 28,
            title: "Galleria",
            client: "Galleria AVM",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Konsept",
            desc: "Türkiye'nin ilk ve öncü alışveriş merkezi Galleria için tasarlanan, modern mimari çizgiler ile lüks perakende deneyimini birleştiren kurumsal kimlik, logo ve yönlendirme tasarımları.",
            icon: "fa-store",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/galleria-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Öncü", lbl: "AVM Konsepti" },
                { val: "Lüks", lbl: "Yönlendirme Tasarımı" }
            ],
            challenge: "Alışveriş merkezinin çağdaş ve lüks atmosferini, ziyaretçilere rehberlik edecek zarif iç yönlendirme panoları, modern tipografi, estetik logo varyasyonları ve premium marka kimlik kılavuzu ile bütünleştirmek."
        },
        {
            id: 24,
            title: "Cacao",
            client: "Cacao Chocolatier",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Ambalaj",
            desc: "Kakao çekirdeğinin ham ve saf zarafetini lüks el yapımı çikolata ambalajlarıyla buluşturan özel kurumsal kimlik, premium folyo baskı detayları ve marka konsepti.",
            icon: "fa-cookie-bite",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/coca-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Artizan", lbl: "Lüks Çikolata Serisi" },
                { val: "Premium", lbl: "Yaldız Folyo Baskı" }
            ],
            challenge: "Kakao meyvesinin doğal ve ham kökenlerini, lüks artizan çikolata ambalajı çizgileriyle yeniden yorumlayarak; altın varaklı/folyo detaylar, yüksek kaliteli sürdürülebilir kutu tasarımları ve markaya özel çikolata kalıbı illüstrasyonları içeren seçkin bir kurumsal kimlik kurgulamak."
        },
        {
            id: 23,
            title: "Bohemiam",
            client: "Bohemiam Concept",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Konsept",
            desc: "Ege ve Akdeniz esintilerini bohem şıklığıyla birleştiren premium yaşam ve gastronomi konsepti için hazırlanan el yapımı kurumsal kimlik, sürdürülebilir ahşap/kraft ambalaj serileri ve bütünsel marka tasarımı.",
            icon: "fa-feather",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/bohemiam-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Boho-Chic", lbl: "Gastronomi & Yaşam" },
                { val: "%100 Doğal", lbl: "Ahşap & Kraft Doku" }
            ],
            challenge: "Bohem ve özgür ruhlu Akdeniz yaşam tarzını, lüks ve seçkin bir gastronomi/konsept marka algısıyla harmanlayarak; el yapımı organik kağıt dokuları, toprak tonlarındaki renk paleti, el çizimi floral detaylar ve sürdürülebilir doğal ambalaj çözümleri sunan premium bir kurumsal kimlik kurgulamak."
        },
        {
            id: 22,
            title: "Ekmek Arası",
            client: "Ekmek Arası TR",
            category: "branding",
            catLabel: "Kurumsal Kimlik & Ambalaj",
            desc: "Geleneksel sokak lezzetlerini modern bir fast-food zinciri kimliğiyle buluşturan minimalist logo, dinamik ambalaj setleri ve kurumsal kimlik tasarımı.",
            icon: "fa-bread-slice",
            gradient: "creative-gradient",
            pdfPath: "tum-markalar/ekmek-arasi-kurumsal-kimlik.pdf",
            metrics: [
                { val: "Modern", lbl: "Sokak Kültürü" },
                { val: "BRANDING", lbl: "Kurumsal Kimlik Seti" }
            ],
            challenge: "Geleneksel 'ekmek arası' sokak lezzetleri kültürünü, genç ve dinamik şehirli kitleye hitap edecek şekilde sadeleştirerek; yüksek enerjili renk paleti, brütalist yazı tipleri ve doğa dostu ambalaj tasarımlarıyla modern bir restoran zinciri kurumsal kimliğine dönüştürmek."
        },
        {
            id: 13,
            title: "Cahide Müzikhol",
            client: "Cahide Group",
            category: "other",
            catLabel: "Kurumsal Kimlik & Konsept",
            desc: "Türkiye'nin en ikonik eğlence markasının lüks basılı ve dijital ambalaj kurumsal kimlik setleri.",
            icon: "fa-music",
            gradient: "creative-gradient",
            metrics: [
                { val: "Custom", lbl: "Logo & Yazı Tipleri" },
                { val: "Lüks", lbl: "Konsept Tasarımı" }
            ],
            challenge: "Cahide'nin dünyaca ünlü eşsiz sahne şovlarını, karnaval havasını ve seçkin atmosferini yansıtacak kalın dokulu lüks karton kutular, gold yaldızlı davetiyeler ve brütalist basılı setler tasarlamak."
        },
        {
            id: 14,
            title: "Arabesque",
            client: "Cahide Group",
            category: "other",
            catLabel: "Kurumsal Kimlik",
            desc: "Mistik ve oryantal gastronomi konseptinin lüks basılı menü tasarımları, logo detayları ve kurumsal kimlik malzemeleri.",
            icon: "fa-drum",
            gradient: "social-gradient",
            metrics: [
                { val: "El Yapımı", lbl: "Özel Menü Kabartması" },
                { val: "Özgün", lbl: "Vurgu Renkleri" }
            ],
            challenge: "Mekanın mistik oryantal atmosferini lüks dokularla birleştirerek, ziyaretçilerin masaya oturduğu andan itibaren hissedeceği birinci sınıf kabartmalı deri menüler ve marka çizgileri tasarlamak."
        },
        {
            id: 15,
            title: "Beerhall",
            client: "Beerhall Group",
            category: "other",
            catLabel: "Kurumsal Kimlik & Ambalaj",
            desc: "Sokak kültürünü yansıtan pub konsepti için hazırlanan dinamik ambalaj setleri, Amerikan servisleri ve logolar.",
            icon: "fa-beer-mug-empty",
            gradient: "tech-gradient",
            metrics: [
                { val: "32 Çeşit", lbl: "Özel Ambalaj" },
                { val: "Genç", lbl: "Brütalist Çizgi" }
            ],
            challenge: "Beerhall'un samimi, renkli ve sokak lezzetleri odaklı konseptini, genç jenerasyonun ilgisini çekecek neon renk kodlu grafik ambalajlar ve logolar ile buluşturmak."
        },
        {
            id: 16,
            title: "Cahide Palazzo",
            client: "Cahide Palazzo",
            category: "other",
            catLabel: "Premium Kurumsal Kimlik",
            desc: "Cahide Palazzo'nun görkemli sahne prodüksiyonlarını ve lüks saray konseptini yansıtan kabartmalı gold kurumsal kimlik setleri.",
            icon: "fa-landmark",
            gradient: "creative-gradient",
            metrics: [
                { val: "Palazzo Gold", lbl: "Yaldız Baskı" },
                { val: "Monogram", lbl: "Özel Arma Tasarımı" }
            ],
            challenge: "Dev Palazzo sahnesinin şaşaasını ve saray ihtişamını, kalın kadife davetiyeler, kabartma monogramlar ve lüks peçete/servis detaylarıyla somutlaştırmak."
        },
        {
            id: 18,
            title: "Moretenders Bar Service",
            client: "Moretenders Co.",
            category: "other",
            catLabel: "Kurumsal Kimlik & Kreatif",
            desc: "Premium kokteyl catering ve bar hizmetleri markası için oluşturulan logo, özel üniforma tasarımları ve basılı tanıtım katalogları.",
            icon: "fa-champagne-glasses",
            gradient: "brand-gradient",
            metrics: [
                { val: "Kurumsal", lbl: "B2B Katalog Seti" },
                { val: "Özgün", lbl: "Tipografi & Çizim" }
            ],
            challenge: "Markanın niş ve seçkin partilere/etkinliklere hizmet veren üst segment çizgisini, monokrom minimalist detaylar ve altın yaldızlı kartvizitler ile taçlandırmak."
        },
        {
            id: 19,
            title: "Club 33",
            client: "Club 33 VIP",
            category: "other",
            catLabel: "VIP Kurumsal Kimlik",
            desc: "Seçkin kulübün VIP davetiyeleri, premium mat siyah broşürleri ve şık üyelik kartı tasarımları.",
            icon: "fa-dice",
            gradient: "creative-gradient",
            metrics: [
                { val: "VIP Kart", lbl: "Tasarımı" },
                { val: "Seçkin", lbl: "Renk Paleti" }
            ],
            challenge: "Kulübün gizemli ve elit havasını yansıtacak, monokrom minimalist detaylar ve metal dokulu VIP üyelik kartı tasarımları hazırlamak."
        },
        {
            id: 20,
            title: "Limoni Hotel",
            client: "Limoni Urla",
            category: "other",
            catLabel: "Kurumsal Kimlik & Otel Konsepti",
            desc: "Urla'nın en şirin butik otellerinden Limoni Hotel için tasarlanan narenciye kokulu logo, broşür ve oda anahtarlığı tasarımları.",
            icon: "fa-hotel",
            gradient: "tech-gradient",
            metrics: [
                { val: "Pastel", lbl: "Otel Konsepti" },
                { val: "Geri Dönüşümlü", lbl: "Kraft Anahtarlık" }
            ],
            challenge: "Oteldeki huzuru, yeşil bahçeleri ve limon ağaçlarını yansıtacak sarı-yeşil pastel tonlarında, doğa dostu ambalajlar, oda kartvizitleri ve tabela tasarımları yaratmak."
        },
        
        // --- 5. PRINT & EDITORIAL (print) - 3 items (Dijital Gru, Vela Ship & Jidar Fence) ---
        {
            id: 29,
            title: "Dijital Gru Tanıtım Kataloğu",
            client: "Dijital Gru",
            category: "print",
            catLabel: "Editöryal & Katalog Tasarımı",
            desc: "Ajansımızın kreatif vizyonunu, ödüllü projelerini ve özgün tasarım felsefesini yansıtan, minimalist ve brütalist tarzda tasarlanmış premium tanıtım kataloğu.",
            icon: "fa-book-open",
            gradient: "creative-gradient",
            metrics: [
                { val: "Mat Kuşe", lbl: "Kağıt Seçimi" },
                { val: "120 Sayfa", lbl: "Özgün Tasarım" }
            ],
            challenge: "Ajansın dinamik ve kurumsal duruşunu basılı mecrada en yüksek kalitede yansıtabilmek amacıyla; özel seçilmiş mat dokulu kağıt konsepti, cesur tipografik düzenler ve minimal grid sistemleri üzerine kurulu prestijli bir ajans kataloğu tasarlamak."
        },
        {
            id: 31,
            title: "Vela Ship",
            client: "Vela Ship",
            category: "print",
            catLabel: "Basılı Katalog Tasarımı",
            desc: "Uluslararası deniz taşımacılığı ve denizcilik sektörü için hazırlanan, markanın kurumsal gücünü ve global vizyonunu modern minimalizmle birleştiren seçkin basılı kurumsal katalog tasarımı.",
            icon: "fa-ship",
            gradient: "tech-gradient",
            pdfPath: "tum-markalar/basili-ve-editoryal/vela-ship-dergi.pdf",
            metrics: [
                { val: "Global", lbl: "Kurumsal Yayın" },
                { val: "Premium", lbl: "Basılı Katalog" }
            ],
            challenge: "Denizcilik sektörünün köklü ve güvenilir yapısını, modern deniz taşımacılığı dinamikleriyle harmanlayarak; yüksek kaliteli basılı malzemeler, mat kuşe kağıt seçimi, derin lacivert tonlarda premium renk paleti ve bütünsel bir prestijli kurumsal tanıtım kataloğu tasarlamak."
        },
        {
            id: 33,
            title: "Galleria",
            client: "Galleria AVM",
            category: "print",
            catLabel: "Basılı Katalog Tasarımı",
            desc: "Türkiye'nin ilk ve öncü alışveriş merkezi Galleria için tasarlanan, lüks perakende dünyasını ve prestijli mimarisini yansıtan özel basılı tanıtım kataloğu.",
            icon: "fa-store",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/basili-ve-editoryal/galleria-basili.pdf",
            metrics: [
                { val: "Mat Baskı", lbl: "Kuşe Kağıt" },
                { val: "Seçkin", lbl: "Marka Vitrini" }
            ],
            challenge: "Türkiye'nin öncü alışveriş merkezi Galleria için, lüks perakende deneyimini ve modern mimari yapısını fiziksel mecraya taşıyacak, özel baskı teknikleri ve şık tipografi ile donatılmış prestijli bir basılı katalog tasarlamak."
        },
        {
            id: 32,
            title: "Jidar Fence",
            client: "Jidar Fence",
            category: "print",
            catLabel: "Basılı Ürün Kataloğu",
            desc: "Çevre güvenliği, yüksek mukavemetli panel çit ve dekoratif tel örgü sistemleri üreten Jidar Fence için hazırlanan, endüstriyel gücü ve estetiği bir araya getiren premium ürün kataloğu tasarımı.",
            icon: "fa-shield-halved",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/basili-ve-editoryal/jidar-fence-basili.pdf",
            metrics: [
                { val: "Endüstriyel", lbl: "Ürün Sunumu" },
                { val: "Premium", lbl: "Mat Baskı" }
            ],
            challenge: "Çevre güvenliği ve panel çit sistemleri gibi endüstriyel ve teknik bir sektörü, sıkıcı olmaktan uzaklaştırarak; modern grid yapıları, yüksek kaliteli ürün fotoğrafları, teknik çizim şablonları ve premium mat kuşe kâğıt detaylarıyla donatılmış prestijli bir basılı ürün kataloğu haline getirmek."
        },
        {
            id: 35,
            title: "Shiso Menü Tasarımı",
            client: "Shiso Sushi & More",
            category: "print",
            catLabel: "Menü & Basılı Grafik",
            desc: "Premium Uzak Doğu restoran konsepti için hazırlanan; minimalist Japon estetiğini, modern gastronomi trendlerini ve özel dokulu kağıt konseptini birleştiren şık menü tasarımı.",
            icon: "fa-utensils",
            gradient: "brand-gradient",
            pdfPath: "tum-markalar/Shiso Menu\u0308 Tasar\u0131m\u0131.pdf",
            metrics: [
                { val: "Minimalist", lbl: "Japon Estetiği" },
                { val: "Premium", lbl: "Özel Dokulu Baskı" }
            ],
            challenge: "Uzak Doğu mutfağının en seçkin temsilcilerinden Shiso için; hem markanın sade ve dingin Uzak Doğu felsefesini yansıtan hem de misafirlerin premium gastronomi deneyimini görsel ve dokunsal olarak zenginleştiren, özel kağıt seçimli ve minimalist tipografili bütünsel bir menü sunum tasarımı hazırlamak."
        }
    ];

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
