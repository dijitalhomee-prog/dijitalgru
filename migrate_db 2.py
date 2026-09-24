import os
import time
from werkzeug.security import generate_password_hash
from db import get_db, is_postgres

def ensure_admin_user():
    """
    Ensures that dijitalgru@gmail.com exists with password '459683758' (hashed via Werkzeug pbkdf2:sha256)
    and is set as is_admin = True in both PostgreSQL and SQLite.
    """
    conn = get_db()
    cursor = conn.cursor()
    admin_email = "dijitalgru@gmail.com"
    admin_pass = "459683758"
    hashed = generate_password_hash(admin_pass, method="pbkdf2:sha256")
    now = int(time.time())
    sub_end = now + (86400 * 3650) # 10 years
    
    try:
        if is_postgres():
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s)", (admin_email,))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                UPDATE users 
                SET password_hash = %s, is_admin = TRUE, account_status = 'active', plan = 'business', dynamic_qr_limit = 10000 
                WHERE id = %s
                """, (hashed, row['id']))
            else:
                cursor.execute("""
                INSERT INTO users (name, email, password_hash, plan, subscription_end, dynamic_qr_limit, is_admin, account_status, created_at)
                VALUES (%s, %s, %s, 'business', %s, 10000, TRUE, 'active', %s)
                """, ('Furkan Egemen Güneş', admin_email, hashed, sub_end, now))
        else:
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (admin_email,))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                UPDATE users 
                SET password_hash = ?, is_admin = 1, account_status = 'active', plan = 'business', dynamic_qr_limit = 10000 
                WHERE id = ?
                """, (hashed, row['id']))
            else:
                cursor.execute("""
                INSERT INTO users (name, email, password_hash, plan, subscription_end, dynamic_qr_limit, is_admin, account_status, created_at)
                VALUES (?, ?, ?, 'business', ?, 10000, 1, 'active', ?)
                """, ('Furkan Egemen Güneş', admin_email, hashed, sub_end, now))
        conn.commit()
        print("✅ Primary Admin User (dijitalgru@gmail.com) ensured.")
    except Exception as e:
        conn.rollback()
        print("⚠️ ensure_admin_user note:", e)
    finally:
        conn.close()

def cleanup_test_accounts():
    """
    Deletes all temporary test accounts created during live verification tests.
    Preserves real user accounts (e.g. dijitalgru@gmail.com).
    """
    conn = get_db()
    cursor = conn.cursor()
    test_patterns = [
        '%_test_%', 'user_test_%', 'admin_test_%', 'normal_anon_%', 
        'live_pwd_sec_%', 'clean_tester_%', 'prod_pay_security_%', 
        'live_verify_test_%', 'acc_admin_%', 'acc_cust_%', 'acc_target_%', 
        'acc_live_%', 'test_admin_%', 'contract_test_%', 'anon_user_%'
    ]
    
    try:
        for pat in test_patterns:
            if is_postgres():
                cursor.execute("SELECT id FROM users WHERE email LIKE %s AND LOWER(email) != LOWER('dijitalgru@gmail.com')", (pat,))
                rows = cursor.fetchall()
                for r in rows:
                    uid = r['id']
                    cursor.execute("DELETE FROM qr_codes WHERE user_id = %s", (uid,))
                    cursor.execute("DELETE FROM subscriptions WHERE user_id = %s", (uid,))
                    cursor.execute("DELETE FROM users WHERE id = %s", (uid,))
            else:
                cursor.execute("SELECT id FROM users WHERE email LIKE ? AND LOWER(email) != LOWER('dijitalgru@gmail.com')", (pat,))
                rows = cursor.fetchall()
                for r in rows:
                    uid = r['id']
                    cursor.execute("DELETE FROM qr_codes WHERE user_id = ?", (uid,))
                    cursor.execute("DELETE FROM subscriptions WHERE user_id = ?", (uid,))
                    cursor.execute("DELETE FROM users WHERE id = ?", (uid,))
        conn.commit()
        print("✅ Production test accounts cleanup complete.")
    except Exception as e:
        conn.rollback()
        print("⚠️ cleanup_test_accounts note:", e)
    finally:
        conn.close()

def run_migrations():
    conn = get_db()
    cursor = conn.cursor()
    print("🔄 Running database migrations...")
    
    # 1. Ensure folder_name column on qr_codes
    try:
        if is_postgres():
            cursor.execute("ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS folder_name VARCHAR(100) DEFAULT 'Genel';")
        else:
            cursor.execute("ALTER TABLE qr_codes ADD COLUMN folder_name TEXT DEFAULT 'Genel';")
        conn.commit()
        print("✅ Column folder_name migration complete.")
    except Exception as e:
        conn.rollback()
        print("⚠️ folder_name migration note:", e)

    # 2. Ensure case-insensitive email index on users
    try:
        if is_postgres():
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));")
        else:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (email);")
        conn.commit()
        print("✅ Email lower index migration complete.")
    except Exception as e:
        conn.rollback()
        print("⚠️ email index note:", e)
        
    # 3. Ensure index on qr_codes(short_code) and pdf_files(file_code) for instant lookups
    try:
        if is_postgres():
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_codes_short_code ON qr_codes (short_code);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_pdf_files_file_code ON pdf_files (file_code);")
        else:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_codes_short_code ON qr_codes (short_code);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_pdf_files_file_code ON pdf_files (file_code);")
        conn.commit()
        print("✅ Performance indexes ensured.")
    except Exception as e:
        conn.rollback()
        print("⚠️ Index migration note:", e)
        
    # 4. Ensure is_admin and account_status columns on users
    try:
        if is_postgres():
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;")
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active';")
        else:
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;")
            except Exception:
                pass
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active';")
            except Exception:
                pass
        conn.commit()
        print("✅ Admin & account_status columns ensured.")
    except Exception as e:
        conn.rollback()
        print("⚠️ Admin migration note:", e)

    # 5. Ensure source, refund_status, refund_date columns on subscriptions
    try:
        if is_postgres():
            cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'iyzico';")
            cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'none';")
            cursor.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS refund_date BIGINT DEFAULT 0;")
        else:
            try:
                cursor.execute("ALTER TABLE subscriptions ADD COLUMN source TEXT DEFAULT 'iyzico';")
            except Exception:
                pass
            try:
                cursor.execute("ALTER TABLE subscriptions ADD COLUMN refund_status TEXT DEFAULT 'none';")
            except Exception:
                pass
            try:
                cursor.execute("ALTER TABLE subscriptions ADD COLUMN refund_date INTEGER DEFAULT 0;")
            except Exception:
                pass
        conn.commit()
        print("✅ Subscriptions accounting columns ensured.")
    except Exception as e:
        conn.rollback()
        print("⚠️ Subscriptions migration note:", e)

    # 6. Ensure user identity & billing columns
    try:
        if is_postgres():
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_number VARCHAR(20) DEFAULT '';")
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS gsm_number VARCHAR(30) DEFAULT '';")
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';")
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';")
        else:
            for col, col_type in [("identity_number", "TEXT DEFAULT ''"), ("gsm_number", "TEXT DEFAULT ''"), ("address", "TEXT DEFAULT ''"), ("city", "TEXT DEFAULT ''")]:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type};")
                except Exception:
                    pass
        conn.commit()
        print("✅ Identity & billing columns ensured.")
    except Exception as e:
        conn.rollback()
        print("⚠️ Identity migration note:", e)

    # 7. Ensure vcard_pages & menu_pages card_image_url and contact columns
    try:
        for table in ["vcard_pages", "menu_pages"]:
            try:
                if is_postgres():
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS card_image_url TEXT;")
                else:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN card_image_url TEXT;")
            except Exception:
                pass
        
        try:
            if is_postgres():
                cursor.execute("ALTER TABLE vcard_pages ADD COLUMN IF NOT EXISTS theme_settings TEXT;")
            else:
                cursor.execute("ALTER TABLE vcard_pages ADD COLUMN theme_settings TEXT;")
        except Exception:
            pass
        
        menu_cols = [
            ("contact_name", "TEXT", "VARCHAR(255)"),
            ("contact_title", "TEXT", "VARCHAR(255)"),
            ("phone", "TEXT", "VARCHAR(100)"),
            ("phone2", "TEXT", "VARCHAR(100)"),
            ("email", "TEXT", "VARCHAR(255)"),
            ("website", "TEXT", "TEXT"),
            ("address", "TEXT", "TEXT"),
            ("social_links", "TEXT", "TEXT")
        ]
        for col_name, sqlite_type, pg_type in menu_cols:
            try:
                if is_postgres():
                    cursor.execute(f"ALTER TABLE menu_pages ADD COLUMN IF NOT EXISTS {col_name} {pg_type};")
                else:
                    cursor.execute(f"ALTER TABLE menu_pages ADD COLUMN {col_name} {sqlite_type};")
            except Exception:
                pass
        conn.commit()
        print("✅ Card image & menu contact columns ensured.")
    except Exception as e:
        conn.rollback()
        print("⚠️ Card image migration note:", e)

    # 8. Auto-repair empty target_url in qr_codes for pdf/menu/vcard types
    try:
        if is_postgres():
            cursor.execute("SELECT id, type, target_url FROM qr_codes WHERE target_url IS NULL OR target_url = '' OR target_url = 'None'")
        else:
            cursor.execute("SELECT id, type, target_url FROM qr_codes WHERE target_url IS NULL OR target_url = '' OR target_url = 'None'")
        empty_rows = cursor.fetchall()
        repaired_count = 0
        for r in empty_rows:
            qid = r['id']
            qtype = r['type']
            # Check menu_pages
            if is_postgres():
                cursor.execute("SELECT pdf_url FROM menu_pages WHERE qr_id = %s", (qid,))
            else:
                cursor.execute("SELECT pdf_url FROM menu_pages WHERE qr_id = ?", (qid,))
            mrow = cursor.fetchone()
            if mrow:
                pdf_url = mrow['pdf_url'] if isinstance(mrow, dict) else mrow[0]
                if pdf_url and (str(pdf_url).startswith('/') or str(pdf_url).startswith('http')):
                    new_target = str(pdf_url)
                else:
                    new_target = f"micropage://menu/{qid}"
                if is_postgres():
                    cursor.execute("UPDATE qr_codes SET target_url = %s WHERE id = %s", (new_target, qid))
                else:
                    cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (new_target, qid))
                repaired_count += 1
                continue

            # Check vcard_pages
            if is_postgres():
                cursor.execute("SELECT id FROM vcard_pages WHERE qr_id = %s", (qid,))
            else:
                cursor.execute("SELECT id FROM vcard_pages WHERE qr_id = ?", (qid,))
            vrow = cursor.fetchone()
            if vrow:
                new_target = f"micropage://vcard/{qid}"
                if is_postgres():
                    cursor.execute("UPDATE qr_codes SET target_url = %s WHERE id = %s", (new_target, qid))
                else:
                    cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (new_target, qid))
                repaired_count += 1
                continue
                
            # Default fallback by type
            if qtype in ["menu", "pdf_catalog", "pdf_viewer", "restaurant_menu"]:
                new_target = f"micropage://menu/{qid}"
            elif qtype in ["vcard", "company_card"]:
                new_target = f"micropage://vcard/{qid}"
            else:
                new_target = "https://qrdijitalgru.com"

            if is_postgres():
                cursor.execute("UPDATE qr_codes SET target_url = %s WHERE id = %s", (new_target, qid))
            else:
                cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (new_target, qid))
            repaired_count += 1

        conn.commit()
        if repaired_count > 0:
            print(f"✅ Repaired target_url for {repaired_count} empty QR codes.")
    except Exception as e:
        conn.rollback()
        print("⚠️ target_url auto-repair migration note:", e)

    # 9. Clean up any corrupted relative media URLs in vcard_pages and menu_pages
    try:
        corrupted_patterns = [
            ("https:///p/media/", "/p/media/"),
            ("https://p/media/", "/p/media/"),
            ("http:///p/media/", "/p/media/"),
            ("http://p/media/", "/p/media/"),
            ("https://qrdijitalgru.com/p/media/", "/p/media/"),
            ("http://qrdijitalgru.com/p/media/", "/p/media/")
        ]
        tables_cols = [
            ("vcard_pages", "card_image_url"),
            ("vcard_pages", "avatar_url"),
            ("menu_pages", "card_image_url"),
            ("menu_pages", "cover_url"),
            ("menu_pages", "pdf_url")
        ]
        for table, col in tables_cols:
            for bad, good in corrupted_patterns:
                try:
                    if is_postgres():
                        cursor.execute(f"UPDATE {table} SET {col} = REPLACE({col}, %s, %s) WHERE {col} LIKE %s", (bad, good, f"%{bad}%"))
                    else:
                        cursor.execute(f"UPDATE {table} SET {col} = REPLACE({col}, ?, ?) WHERE {col} LIKE ?", (bad, good, f"%{bad}%"))
                except Exception:
                    pass
        conn.commit()
        print("✅ Corrupted media URLs cleaned up in database.")
    except Exception as e:
        conn.rollback()
        print("⚠️ Media URL cleanup note:", e)
        
    conn.close()

    # Always ensure primary admin user is configured and test accounts cleaned up
    ensure_admin_user()
    cleanup_test_accounts()

if __name__ == "__main__":
    run_migrations()
