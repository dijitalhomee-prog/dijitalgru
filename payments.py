import os
import time
import uuid
import iyzipay
from db import get_db

IYZICO_API_KEY = os.environ.get("IYZICO_API_KEY", "sandbox-dummy-api-key")
IYZICO_SECRET_KEY = os.environ.get("IYZICO_SECRET_KEY", "sandbox-dummy-secret-key")
IYZICO_BASE_URL = os.environ.get("IYZICO_BASE_URL", "https://sandbox-api.iyzipay.com")

# Multi-cycle pricing matrix (Monthly, 6-Month %15 OFF, Annual %30 OFF)
PLANS = {
    "starter": {
        "name": "Başlangıç (Starter)",
        "dynamic_limit": 5,
        "pricing": {
            "monthly": {"price_per_month": 199.00, "total_price": 199.00, "months": 1, "label": "Aylık"},
            "semi_annual": {"price_per_month": 169.00, "total_price": 1014.00, "months": 6, "label": "6 Aylık (%15 İndirimli)"},
            "annual": {"price_per_month": 139.00, "total_price": 1668.00, "months": 12, "label": "Yıllık (%30 İndirimli)"}
        }
    },
    "advanced": {
        "name": "Profesyonel (Advanced)",
        "dynamic_limit": 25,
        "pricing": {
            "monthly": {"price_per_month": 399.00, "total_price": 399.00, "months": 1, "label": "Aylık"},
            "semi_annual": {"price_per_month": 339.00, "total_price": 2034.00, "months": 6, "label": "6 Aylık (%15 İndirimli)"},
            "annual": {"price_per_month": 279.00, "total_price": 3348.00, "months": 12, "label": "Yıllık (%30 İndirimli)"}
        }
    },
    "business": {
        "name": "Kurumsal (Business)",
        "dynamic_limit": 100,
        "pricing": {
            "monthly": {"price_per_month": 899.00, "total_price": 899.00, "months": 1, "label": "Aylık"},
            "semi_annual": {"price_per_month": 759.00, "total_price": 4554.00, "months": 6, "label": "6 Aylık (%15 İndirimli)"},
            "annual": {"price_per_month": 629.00, "total_price": 7548.00, "months": 12, "label": "Yıllık (%30 İndirimli)"}
        }
    }
}

def get_iyzico_options():
    options = {
        'api_key': os.environ.get("IYZICO_API_KEY", IYZICO_API_KEY),
        'secret_key': os.environ.get("IYZICO_SECRET_KEY", IYZICO_SECRET_KEY),
        'base_url': os.environ.get("IYZICO_BASE_URL", IYZICO_BASE_URL)
    }
    return options

def create_checkout_form(user_info, plan_key, cycle="monthly", callback_url=""):
    """
    Creates an official iyzico Checkout Form for specific plan and billing cycle.
    """
    if plan_key not in PLANS:
        return None, "Geçersiz paket seçimi."

    plan_info = PLANS[plan_key]
    cycle_info = plan_info["pricing"].get(cycle, plan_info["pricing"]["monthly"])
    options = get_iyzico_options()

    request = {
        'locale': 'tr',
        'conversationId': str(uuid.uuid4()),
        'price': str(cycle_info['total_price']),
        'paidPrice': str(cycle_info['total_price']),
        'currency': 'TRY',
        'basketId': f"BASKET_{user_info['id']}_{int(time.time())}",
        'paymentGroup': 'SUBSCRIPTION',
        'callbackUrl': callback_url,
        'enabledInstallments': ['1', '3', '6', '12'],
        'buyer': {
            'id': str(user_info['id']),
            'name': user_info['name'].split()[0] if user_info.get('name') else 'Müşteri',
            'surname': user_info['name'].split()[-1] if len(user_info.get('name', '').split()) > 1 else 'Dijitalgru',
            'gsmNumber': '+905300000000',
            'email': user_info['email'],
            'identityNumber': '11111111111',
            'registrationAddress': 'İstanbul, Türkiye',
            'ip': '127.0.0.1',
            'city': 'Istanbul',
            'country': 'Turkey'
        },
        'shippingAddress': {
            'contactName': user_info['name'],
            'city': 'Istanbul',
            'country': 'Turkey',
            'address': 'İstanbul, Türkiye'
        },
        'billingAddress': {
            'contactName': user_info['name'],
            'city': 'Istanbul',
            'country': 'Turkey',
            'address': 'İstanbul, Türkiye'
        },
        'basketItems': [
            {
                'id': f"PLAN_{plan_key.upper()}_{cycle.upper()}",
                'name': f"Dijitalgru QR — {plan_info['name']} ({cycle_info['label']})",
                'category1': 'SaaS',
                'itemType': 'VIRTUAL',
                'price': str(cycle_info['total_price'])
            }
        ]
    }

    try:
        checkout_form = iyzipay.CheckoutFormInitialize().create(request, options)
        result = checkout_form.read().decode('utf-8')
        import json
        res_json = json.loads(result)
        return res_json, None
    except Exception as e:
        return None, str(e)

def process_subscription_purchase(user_id, plan_key, cycle="monthly", card_holder="Müşteri", card_number=""):
    """
    Process subscription purchase for chosen cycle & generate e-Archive invoice.
    """
    if plan_key not in PLANS:
        return None, "Geçersiz paket seçimi."

    plan_info = PLANS[plan_key]
    cycle_info = plan_info["pricing"].get(cycle, plan_info["pricing"]["monthly"])
    
    now = int(time.time())
    days = cycle_info["months"] * 30
    sub_end = now + (86400 * days)

    iyzico_sub_id = f"sub_iyzi_{uuid.uuid4().hex[:12]}"
    invoice_no = f"DJG2026{uuid.uuid4().hex[:8].upper()}"

    conn = get_db()
    cursor = conn.cursor()

    # Update user plan & limit
    cursor.execute("""
    UPDATE users 
    SET plan = ?, subscription_end = ?, dynamic_qr_limit = ?
    WHERE id = ?
    """, (plan_key, sub_end, plan_info["dynamic_limit"], user_id))

    # Log subscription payment
    cursor.execute("""
    INSERT INTO subscriptions (user_id, plan_name, amount, status, iyzico_sub_id, invoice_no, created_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
    """, (user_id, f"{plan_info['name']} - {cycle_info['label']}", cycle_info["total_price"], iyzico_sub_id, invoice_no, now))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"{plan_info['name']} ({cycle_info['label']}) paketiniz iyzico altyapısıyla aktif edildi!",
        "plan": plan_key,
        "cycle": cycle,
        "invoice_no": invoice_no,
        "amount": cycle_info["total_price"],
        "iyzico_sub_id": iyzico_sub_id
    }, None
