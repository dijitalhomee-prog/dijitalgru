/* Dijital Gru — tek noktadan site ayarları.
   E-posta / telefon değişirse yalnızca BURAYI güncelleyin.
   data-dg-email / data-dg-phone öznitelikli tüm bağlantılar bu değerlerle güncellenir.
   [EGEMEN DOLDURACAK: alan adlı e-posta, ör. info@dijitalgru.com] */
window.DG_SITE = {
    email: 'dijitalgru@gmail.com',
    phoneDisplay: '+90 537 627 44 15',
    phoneTel: '+905376274415',
    whatsapp: '905376274415',
    /* İstediğiniz hizmetin fiyatını yalnızca BURAYA yazın, örn: '₺15.000'.
       Boş ('') bırakırsanız kartta "Teklif alın" görünür. */
    prices: {
        'restoran-web': '₺5.999 + KDV',
        'marka-kimligi': '',
        'kurumsal-web': '₺5.999 + KDV',
        'ozel-yazilim': '',
        'qr-menu': '',
        'tek-sayfa-web': '₺5.999 + KDV',
        'otel-web': '₺5.999 + KDV',
        'mimarlik-web': '₺5.999 + KDV'
    }
};

document.addEventListener('DOMContentLoaded', function () {
    var c = window.DG_SITE;
    document.querySelectorAll('a[data-dg-email]').forEach(function (a) {
        a.href = 'mailto:' + c.email;
        a.textContent = c.email;
    });
    document.querySelectorAll('a[data-dg-phone]').forEach(function (a) {
        a.href = 'tel:' + c.phoneTel;
        a.textContent = c.phoneDisplay;
    });
    document.querySelectorAll('[data-price]').forEach(function (el) {
        var p = (c.prices || {})[el.getAttribute('data-price')];
        el.innerHTML = p
            ? '<em>Başlangıç</em><strong>' + p + '</strong>'
            : '<em>Fiyat için</em><strong>Teklif alın</strong>';
    });
});
