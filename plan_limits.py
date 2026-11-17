"""
Paket limitleri — TEK KAYNAK.
Paket sayfası, panel ("Dinamik Limit Kullanımı"), admin ve sunucu tarafı limit
kontrolü bu değerlerden beslenir. users.dynamic_qr_limit kolonu sadece önbellektir;
etkin limit her zaman `effective_dynamic_limit()` ile plan tanımından hesaplanır.
"""

FREE_DYNAMIC_LIMIT = 3
PLAN_LIMITS = {
    "starter": 5,
    "advanced": 25,
    "business": 100,
    "test": 1,
}
# Logo ekleme özelliğine sahip paketler (Profesyonel ve Kurumsal)
LOGO_PLANS = ("advanced", "business")


def limit_for_plan(plan):
    return PLAN_LIMITS.get(plan, FREE_DYNAMIC_LIMIT)


def effective_dynamic_limit(user):
    """Yöneticiler kendi (yüksek) limitini korur; diğer herkes için plan tanımı geçerlidir."""
    if not user:
        return FREE_DYNAMIC_LIMIT
    if user.get("is_admin"):
        try:
            return max(int(user.get("dynamic_qr_limit") or 0), limit_for_plan(user.get("plan")))
        except Exception:
            return limit_for_plan(user.get("plan"))
    return limit_for_plan(user.get("plan"))


def plan_has_logo(user):
    return bool(user) and (bool(user.get("is_admin")) or user.get("plan") in LOGO_PLANS)
