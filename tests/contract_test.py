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

    def test_10_secure_password_hashing_and_migration(self):
        # 1. New user registration uses Werkzeug unique salt hash
        email = f"secure_pwd_{int(time.time())}@dijitalgru.com"
        reg_res = self.client.post("/api/auth/register", json={
            "name": "Secure Pwd User",
            "email": email,
            "password": "MySuperSecretPassword123!"
        })
        self.assertEqual(reg_res.status_code, 200)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM users WHERE email = ?", (email,))
        pwd_hash = cursor.fetchone()["password_hash"]
        conn.close()

        self.assertTrue("scrypt:" in pwd_hash or "pbkdf2:" in pwd_hash or "$" in pwd_hash)
        self.assertNotEqual(pwd_hash, "dijitalgru_salt_2026")

        # 2. Simulate legacy user with fixed salt pbkdf2_hmac hash
        legacy_email = f"legacy_pwd_{int(time.time())}@dijitalgru.com"
        import hashlib
        legacy_pwd = "OldPassword123!"
        legacy_hash = hashlib.pbkdf2_hmac("sha256", legacy_pwd.encode("utf-8"), b"dijitalgru_salt_2026", 100000).hex()

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, plan, subscription_end, dynamic_qr_limit, created_at)
        VALUES ('Legacy User', ?, ?, 'free', 100000, 3, 100000)
        """, (legacy_email, legacy_hash))
        conn.commit()
        conn.close()

        # Login with legacy password -> login succeeds AND auto-migrates to Werkzeug format
        log_res = self.client.post("/api/auth/login", json={
            "email": legacy_email,
            "password": legacy_pwd
        })
        self.assertEqual(log_res.status_code, 200)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM users WHERE email = ?", (legacy_email,))
        migrated_hash = cursor.fetchone()["password_hash"]
        conn.close()

        self.assertNotEqual(migrated_hash, legacy_hash)
        self.assertTrue("scrypt:" in migrated_hash or "pbkdf2:" in migrated_hash or "$" in migrated_hash)

    def test_11_admin_panel_security_and_management(self):
        # 1. Non-admin user hitting /api/admin/users MUST receive 403 Forbidden
        normal_email = f"normal_user_{int(time.time())}@dijitalgru.com"
        reg_n = self.client.post("/api/auth/register", json={
            "name": "Normal User",
            "email": normal_email,
            "password": "Password123!"
        })
        normal_token = reg_n.get_json()["token"]

        forbidden_res = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {normal_token}"})
        self.assertEqual(forbidden_res.status_code, 403)
        self.assertIn("Erişim engellendi", forbidden_res.get_json()["error"])

        # 2. Promote user to admin in DB
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_admin = 1 WHERE email = ?", (normal_email,))
        conn.commit()
        conn.close()

        # Re-login to get updated admin token
        login_a = self.client.post("/api/auth/login", json={
            "email": normal_email,
            "password": "Password123!"
        })
        admin_token = login_a.get_json()["token"]

        # 3. GET /api/admin/stats as Admin
        stats_res = self.client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(stats_res.status_code, 200)
        self.assertIn("total_users", stats_res.get_json())

        # 4. GET /api/admin/users as Admin
        users_res = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(users_res.status_code, 200)

        # 5. Create a target test user
        target_email = f"target_sub_{int(time.time())}@dijitalgru.com"
        reg_t = self.client.post("/api/auth/register", json={
            "name": "Target User",
            "email": target_email,
            "password": "Password123!"
        })
        target_id = reg_t.get_json()["user"]["id"]

        # 6. Admin updates target user's plan to 'business'
        plan_up_res = self.client.post(f"/api/admin/users/{target_id}/update-plan", json={
            "plan": "business",
            "days": 60
        }, headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(plan_up_res.status_code, 200)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT plan FROM users WHERE id = ?", (target_id,))
        self.assertEqual(cursor.fetchone()["plan"], "business")
        conn.close()

        # 7. Admin suspends target user
        sus_res = self.client.post(f"/api/admin/users/{target_id}/suspend", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(sus_res.status_code, 200)

        # Suspended user CANNOT login
        failed_login = self.client.post("/api/auth/login", json={
            "email": target_email,
            "password": "Password123!"
        })
        self.assertIn("askıya alınmıştır", failed_login.get_json()["error"])

        # 8. Admin activates target user
        act_res = self.client.post(f"/api/admin/users/{target_id}/activate", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(act_res.status_code, 200)

        # 9. Admin deletes target user
        del_res = self.client.delete(f"/api/admin/users/{target_id}", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(del_res.status_code, 200)

        # 10. Audit logs contain recorded actions
        audit_res = self.client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(audit_res.status_code, 200)
        self.assertTrue(len(audit_res.get_json()["audit_logs"]) > 0)

    def test_12_accounting_and_revenue_tracking(self):
        # 1. Register admin user
        admin_email = f"acc_admin_{int(time.time())}@dijitalgru.com"
        reg_a = self.client.post("/api/auth/register", json={
            "name": "Acc Admin",
            "email": admin_email,
            "password": "Password123!"
        })
        admin_id = reg_a.get_json()["user"]["id"]

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_admin = 1 WHERE id = ?", (admin_id,))
        conn.commit()
        conn.close()

        login_a = self.client.post("/api/auth/login", json={
            "email": admin_email,
            "password": "Password123!"
        })
        admin_token = login_a.get_json()["token"]

        # Fetch initial baseline revenue before inserting new subscription
        init_sum = self.client.get("/api/admin/accounting/summary", headers={"Authorization": f"Bearer {admin_token}"}).get_json()
        initial_revenue = init_sum["total_revenue"]

        # 2. Register customer user and add a real iyzico subscription (149.00 TL)
        cust_email = f"acc_cust_{int(time.time())}@dijitalgru.com"
        reg_c = self.client.post("/api/auth/register", json={
            "name": "Acc Customer",
            "email": cust_email,
            "password": "Password123!"
        })
        cust_id = reg_c.get_json()["user"]["id"]

        now = int(time.time())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO subscriptions (user_id, plan_name, amount, status, iyzico_sub_id, invoice_no, source, refund_status, refund_date, created_at)
        VALUES (?, 'Starter - Monthly', 149.00, 'active', 'iyzi_12345', 'INV-12345', 'iyzico', 'none', 0, ?)
        """, (cust_id, now))
        conn.commit()
        conn.close()

        # 3. Admin manually updates plan of another user (source = 'manual_admin', amount = 0.00)
        target_email = f"acc_target_{int(time.time())}@dijitalgru.com"
        reg_t = self.client.post("/api/auth/register", json={
            "name": "Acc Target",
            "email": target_email,
            "password": "Password123!"
        })
        target_id = reg_t.get_json()["user"]["id"]

        self.client.post(f"/api/admin/users/{target_id}/update-plan", json={
            "plan": "business",
            "days": 30
        }, headers={"Authorization": f"Bearer {admin_token}"})

        # 4. GET /api/admin/accounting/summary
        # Total revenue MUST be initial_revenue + 149.00 (manual admin assignment 0.00 does not artificially inflate revenue!)
        sum_res = self.client.get("/api/admin/accounting/summary", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(sum_res.status_code, 200)
        summary_data = sum_res.get_json()
        self.assertEqual(summary_data["total_revenue"], initial_revenue + 149.00)

        # 5. GET /api/admin/accounting/transactions
        tx_res = self.client.get("/api/admin/accounting/transactions", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(tx_res.status_code, 200)
        txs = tx_res.get_json()["transactions"]
        self.assertTrue(len(txs) >= 2)

        # Find iyzico transaction and refund it
        iyzico_tx = next(t for t in txs if t["source"] == "iyzico" and t["user_id"] == cust_id)
        ref_res = self.client.post(f"/api/admin/accounting/refund/{iyzico_tx['id']}", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(ref_res.status_code, 200)

        # Re-fetch summary -> Total revenue MUST drop back to initial_revenue!
        sum_res2 = self.client.get("/api/admin/accounting/summary", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(sum_res2.get_json()["total_revenue"], initial_revenue)

        # 6. GET /api/admin/accounting/export (CSV output test)
        csv_res = self.client.get("/api/admin/accounting/export", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(csv_res.status_code, 200)
        csv_text = csv_res.get_data(as_text=True)
        self.assertIn("İşlem ID", csv_text)
        self.assertIn("İyzico (Gerçek Ödeme)", csv_text)
        self.assertIn("Admin Manuel", csv_text)

if __name__ == "__main__":
    unittest.main()
