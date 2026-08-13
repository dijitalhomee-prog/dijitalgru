import os
import time
import uuid
import json
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
            "monthly": {"price_per_month": 99.00, "total_price": 99.00, "months": 1, "label": "Aylık (İlk Aya Özel %50 İndirim)"},
            "semi_annual": {"price_per_month": 159.00, "total_price": 954.00, "months": 6, "label": "6 Aylık Peşin (%20 İndirimli)"},
            "annual": {"price_per_month": 179.00, "total_price": 2148.00, "months": 12, "label": "Yıllık Peşin (%10 İndirimli)"}
        }
    },
    "advanced": {
        "name": "Profesyonel (Advanced)",
        "dynamic_limit": 25,
        "pricing": {
            "monthly": {"price_per_month": 199.00, "total_price": 199.00, "months": 1, "label": "Aylık (İlk Aya Özel %50 İndirim)"},
            "semi_annual": {"price_per_month": 319.00, "total_price": 1914.00, "months": 6, "label": "6 Aylık Peşin (%20 İndirimli)"},
            "annual": {"price_per_month": 359.00, "total_price": 4308.00, "months": 12, "label": "Yıllık Peşin (%10 İndirimli)"}
        }
    },
    "business": {
        "name": "Kurumsal (Business)",
        "dynamic_limit": 100,
        "pricing": {
            "monthly": {"price_per_month": 449.00, "total_price": 449.00, "months": 1, "label": "Aylık (İlk Aya Özel %50 İndirim)"},
            "semi_annual": {"price_per_month": 719.00, "total_price": 4314.00, "months": 6, "label": "6 Aylık Peşin (%20 İndirimli)"},
            "annual": {"price_per_month": 809.00, "total_price": 9708.00, "months": 12, "label": "Yıllık Peşin (%10 İndirimli)"}
        }
    },
    "test": {
        "name": "iyzico Onay Testi",
        "dynamic_limit": 1,
        "pricing": {
            "monthly": {"price_per_month": 1.00, "total_price": 1.00, "months": 1, "label": "iyzico Canlılık Testi (1 ₺)"}
        }
    }
}

def get_iyzico_options():
    base_url = os.environ.get("IYZICO_BASE_URL", IYZICO_BASE_URL)
    base_url = base_url.replace("https://", "").replace("http://", "").strip("/")
    options = {
        'api_key': os.environ.get("IYZICO_API_KEY", IYZICO_API_KEY).strip(),
        'secret_key': os.environ.get("IYZICO_SECRET_KEY", IYZICO_SECRET_KEY).strip(),
        'base_url': base_url
    }
    return options

def create_checkout_form(user_info, plan_key, cycle="monthly", callback_url=""):
    """
    Initializes official iyzico Checkout Form for specific plan and billing cycle.
    Returns iyzico initialization response containing token and checkoutFormContent.
    """
    if plan_key not in PLANS:
        return None, "Geçersiz paket seçimi."

    plan_info = PLANS[plan_key]
    cycle_info = plan_info["pricing"].get(cycle, plan_info["pricing"]["monthly"])
    options = get_iyzico_options()

    basket_id = f"BASKET_{user_info['id']}_{plan_key}_{cycle}_{int(time.time())}"

    req_data = {
        'locale': 'tr',
        'conversationId': str(uuid.uuid4()),
        'price': str(cycle_info['total_price']),
        'paidPrice': str(cycle_info['total_price']),
        'currency': 'TRY',
        'basketId': basket_id,
        'paymentGroup': 'PRODUCT',
        'callbackUrl': callback_url,
        'registerCard': '1',
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
            'contactName': user_info.get('name', 'Müşteri'),
            'city': 'Istanbul',
            'country': 'Turkey',
            'address': 'İstanbul, Türkiye'
        },
        'billingAddress': {
            'contactName': user_info.get('name', 'Müşteri'),
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
        checkout_form = iyzipay.CheckoutFormInitialize().create(req_data, options)
        result_bytes = checkout_form.read()
        res_json = json.loads(result_bytes.decode('utf-8'))
        return res_json, None
    except Exception as e:
        return None, str(e)

def verify_and_process_iyzico_callback(token):
    """
    Retrieves and verifies payment status from iyzico for the given token.
    ONLY updates user subscription in DB if iyzico returns status=='success' & paymentStatus=='SUCCESS'.
    """
    if not token:
        return None, "Geçersiz veya eksik ödeme token'ı."

    options = get_iyzico_options()
    req_data = {
        'locale': 'tr',
        'conversationId': str(uuid.uuid4()),
        'token': token
    }

    try:
        checkout_result = iyzipay.CheckoutForm().retrieve(req_data, options)
        result_bytes = checkout_result.read()
        res_json = json.loads(result_bytes.decode('utf-8'))
    except Exception as e:
        return None, f"İyzico doğrulama isteği başarısız: {e}"

    if not res_json:
        return None, "İyzico doğrulama yanıtı alınamadı."

    status = res_json.get("status")
    payment_status = res_json.get("paymentStatus")

    if status != "success" or payment_status != "SUCCESS":
        error_msg = res_json.get("errorMessage") or res_json.get("message") or "Ödeme tamamlanamadı."
        print("[iyzico Callback Fail Raw Response]:", res_json)
        return {
            "status": "failure",
            "error": error_msg,
            "raw": res_json
        }, error_msg

    # Parse payment details
    basket_id = res_json.get("basketId", "")
    parts = basket_id.split("_")
    
    # Format: BASKET_{user_id}_{plan_key}_{cycle}_{timestamp}
    if len(parts) >= 4 and parts[0] == "BASKET":
        user_id = int(parts[1])
        plan_key = parts[2]
        cycle = parts[3]
    else:
        buyer_info = res_json.get("buyer", {})
        user_id = int(buyer_info.get("id", 0)) if buyer_info.get("id") else None
        plan_key = "starter"
        cycle = "monthly"

    if not user_id or plan_key not in PLANS:
        return None, "Ödeme doğrulandı ancak kullanıcı veya paket bilgisi eşleştirilemedi."

    plan_info = PLANS[plan_key]
    cycle_info = plan_info["pricing"].get(cycle, plan_info["pricing"]["monthly"])
    
    now = int(time.time())
    days = cycle_info["months"] * 30
    sub_end = now + (86400 * days)

    iyzico_payment_id = res_json.get("paymentId", f"iyzi_{uuid.uuid4().hex[:12]}")
    invoice_no = f"DJG2026{uuid.uuid4().hex[:8].upper()}"
    paid_price = float(res_json.get("paidPrice", cycle_info["total_price"]))

    conn = get_db()
    cursor = conn.cursor()

    try:
        # 1. Update user plan, limits and subscription end date
        cursor.execute("""
        UPDATE users 
        SET plan = ?, subscription_end = ?, dynamic_qr_limit = ?
        WHERE id = ?
        """, (plan_key, sub_end, plan_info["dynamic_limit"], user_id))

        # 2. Log subscription payment to database with source = 'iyzico'
        cursor.execute("""
        INSERT INTO subscriptions (user_id, plan_name, amount, status, iyzico_sub_id, invoice_no, source, refund_status, refund_date, created_at)
        VALUES (?, ?, ?, 'active', ?, ?, 'iyzico', 'none', 0, ?)
        """, (user_id, f"{plan_info['name']} - {cycle_info['label']}", paid_price, iyzico_payment_id, invoice_no, now))

        conn.commit()
        cursor.close()
    except Exception as ex:
        conn.rollback()
        conn.close()
        return None, f"Veritabanı güncelleme hatası: {ex}"

    conn.close()

    return {
        "status": "success",
        "message": f"{plan_info['name']} ({cycle_info['label']}) paketiniz başarıyla aktif edildi!",
        "plan": plan_key,
        "cycle": cycle,
        "user_id": user_id,
        "invoice_no": invoice_no,
        "amount": paid_price,
        "payment_id": iyzico_payment_id
    }, None
