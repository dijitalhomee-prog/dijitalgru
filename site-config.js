/* Dijital Gru — tek noktadan site ayarları.
   E-posta / telefon değişirse yalnızca BURAYI güncelleyin.
   data-dg-email / data-dg-phone öznitelikli tüm bağlantılar bu değerlerle güncellenir.
   [EGEMEN DOLDURACAK: alan adlı e-posta, ör. info@dijitalgru.com] */
window.DG_SITE = {
    email: 'dijitalgru@gmail.com',
    phoneDisplay: '+90 537 627 44 15',
    phoneTel: '+905376274415',
    whatsapp: '905376274415'
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
});
