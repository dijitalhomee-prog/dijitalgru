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
        
    conn.close()

    # Always ensure primary admin user is configured
    ensure_admin_user()

if __name__ == "__main__":
    run_migrations()
