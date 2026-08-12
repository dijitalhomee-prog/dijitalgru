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

    def test_05_subscription_purchase_mock(self):
        email = f"buyer_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Paket Alıcısı",
            "email": email,
            "password": "Password123!"
        })
        token = reg_res.get_json()["token"]

        buy_res = self.client.post("/api/subscriptions/purchase", json={
            "plan_key": "advanced",
            "card_holder": "Müşteri Adı"
        }, headers={"Authorization": f"Bearer {token}"})

        self.assertEqual(buy_res.status_code, 200)
        buy_data = buy_res.get_json()
        self.assertEqual(buy_data["status"], "success")
        self.assertIn("invoice_no", buy_data)

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
        self.assertIn("zaten kayıtlı", data2["error"].lower())

if __name__ == "__main__":
    unittest.main()
