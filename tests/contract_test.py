import sys
import os
import unittest
import json
import time

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from db import init_db, get_db

class TestDijitalgruQRContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = app.test_client()

    def test_01_index_page(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("Dijitalgru QR Studio", res.get_data(as_text=True))

    def test_02_qr_preview_api(self):
        res = self.client.post("/api/qr/preview", json={
            "text": "https://dijitalgru.com",
            "settings": {"fill_color": "#4F46E5", "frame_style": "card", "frame_text": "Beni Tara!"}
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("image", data)
        self.assertTrue(data["image"].startswith("data:image/png;base64,"))

    def test_03_user_register_and_login(self):
        email = f"testuser_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Test User",
            "email": email,
            "password": "Password123!"
        })
        self.assertEqual(reg_res.status_code, 200)
        reg_data = reg_res.get_json()
        self.assertIn("token", reg_data)

        # Login
        login_res = self.client.post("/api/auth/login", json={
            "email": email,
            "password": "Password123!"
        })
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.get_json()
        self.assertIn("token", login_data)

    def test_04_create_dynamic_qr_and_redirect(self):
        email = f"qr_creator_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "QR Creator",
            "email": email,
            "password": "Password123!"
        })
        token = reg_res.get_json()["token"]

        create_res = self.client.post("/api/qr/create", json={
            "title": "Broşür Kampanyası",
            "type": "url",
            "target_url": "https://dijitalgru.com/yeni-kampanya",
            "settings": {"fill_color": "#06B6D4"}
        }, headers={"Authorization": f"Bearer {token}"})

        self.assertEqual(create_res.status_code, 200)
        qr_data = create_res.get_json()
        short_code = qr_data["short_code"]

        # Test redirect engine
        redir_res = self.client.get(f"/r/{short_code}")
        self.assertEqual(redir_res.status_code, 302)
        self.assertEqual(redir_res.location, "https://dijitalgru.com/yeni-kampanya")

    def test_05_subscription_purchase_checkout_form(self):
        email = f"buyer_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Paket Alıcısı",
            "email": email,
            "password": "Password123!"
        })
        token = reg_res.get_json()["token"]

        buy_res = self.client.post("/api/subscriptions/purchase", json={
            "plan_key": "business",
            "cycle": "monthly"
        }, headers={"Authorization": f"Bearer {token}"})

        # Calling purchase MUST NOT grant business plan directly
        me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.get_json()["user"]["plan"], "free")

    def test_06_prevent_duplicate_email_registration(self):
        email = f"dup_check_{int(time.time())}@dijitalgru.com"
        reg1 = self.client.post("/api/auth/register", json={
            "name": "Original User",
            "email": email,
            "password": "Password123!"
        })
        self.assertEqual(reg1.status_code, 200)

        # Attempt duplicate registration with different casing
        reg2 = self.client.post("/api/auth/register", json={
            "name": "Duplicate User",
            "email": email.upper(),
            "password": "Password123!"
        })
        self.assertEqual(reg2.status_code, 400)
        data2 = reg2.get_json()
        self.assertIn("error", data2)
    def test_07_qr_list_endpoint(self):
        email = f"list_tester_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "List Tester",
            "email": email,
            "password": "Password123!"
        })
        token = reg_res.get_json()["token"]

        # Create 1 QR
        self.client.post("/api/qr/create", json={
            "title": "Test List Item",
            "type": "url",
            "target_url": "https://dijitalgru.com/test",
            "settings": {}
        }, headers={"Authorization": f"Bearer {token}"})

        # Fetch list
        list_res = self.client.get("/api/qr/list", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(list_res.status_code, 200)
        data = list_res.get_json()
        self.assertIn("qr_codes", data)
        self.assertIn("stats", data)
        self.assertIn("user", data)
        self.assertEqual(len(data["qr_codes"]), 1)
        self.assertEqual(data["stats"]["total_qr"], 1)

    def test_08_redirect_qr_speed_and_target(self):
        email = f"redir_tester_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Redir Tester",
            "email": email,
            "password": "Password123!"
        })
        token = reg_res.get_json()["token"]

        # Create QR code
        c_res = self.client.post("/api/qr/create", json={
            "title": "Hızlı Yönlendirme Testi",
            "type": "url",
            "target_url": "https://dijitalgru.com/hedef-sayfa",
            "settings": {}
        }, headers={"Authorization": f"Bearer {token}"})
        short_code = c_res.get_json()["short_code"]

        # Simulate unauthenticated QR scan (no login, no token)
        t0 = time.time()
        r_res = self.client.get(f"/r/{short_code}")
        duration = time.time() - t0

        self.assertLess(duration, 1.0, f"Redirection took too long: {duration:.3f}s")
        self.assertEqual(r_res.status_code, 302)
        self.assertEqual(r_res.location, "https://dijitalgru.com/hedef-sayfa")

    def test_09_secure_payment_flow(self):
        email = f"pay_tester_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Pay Tester",
            "email": email,
            "password": "Password123!"
        })
        token = reg_res.get_json()["token"]

        # 1. Calling /api/subscriptions/purchase MUST NOT activate plan directly
        p_res = self.client.post("/api/subscriptions/purchase", json={
            "plan_key": "business",
            "cycle": "monthly"
        }, headers={"Authorization": f"Bearer {token}"})
        
        # User plan MUST still be 'free'
        me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.get_json()["user"]["plan"], "free")

        # 2. Fake/invalid iyzico callback token MUST fail and NOT activate plan
        cb_res = self.client.post("/api/iyzico/callback", data={"token": "invalid_fake_token_123"})
        self.assertEqual(cb_res.status_code, 400)
        self.assertIn("Ödeme", cb_res.get_data(as_text=True))

        # Re-verify plan is still 'free'
        me_res2 = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res2.get_json()["user"]["plan"], "free")

if __name__ == "__main__":
    unittest.main()
