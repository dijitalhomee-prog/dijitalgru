import sqlite3
import json
import os
import time

DATABASE_URL = os.environ.get("DATABASE_URL", "")

def is_postgres():
    db_url = os.environ.get("DATABASE_URL", "")
    return db_url.startswith("postgres://") or db_url.startswith("postgresql://")

class SmartCursor:
    def __init__(self, cursor, is_pg=False):
        self.cursor = cursor
        self.is_pg = is_pg
        self.last_inserted_id = None

    def execute(self, sql, params=()):
        if self.is_pg:
            sql_pg = sql.replace("?", "%s")
            if "INSERT INTO" in sql_pg.upper() and "RETURNING" not in sql_pg.upper():
                sql_pg += " RETURNING id"
                self.cursor.execute(sql_pg, params)
                try:
                    res = self.cursor.fetchone()
                    if res:
                        self.last_inserted_id = res["id"] if (isinstance(res, dict) or hasattr(res, 'keys')) else res[0]
                except Exception:
                    pass
                return self.cursor
            return self.cursor.execute(sql_pg, params)
        else:
            res = self.cursor.execute(sql, params)
            self.last_inserted_id = getattr(self.cursor, "lastrowid", None)
            return res

    @property
    def lastrowid(self):
        if self.is_pg:
            return self.last_inserted_id
        return getattr(self.cursor, "lastrowid", None)

    def fetchone(self):
        row = self.cursor.fetchone()
        if row and not isinstance(row, dict) and hasattr(row, 'keys'):
            return dict(row)
        return row

    def fetchall(self):
        rows = self.cursor.fetchall()
        if rows:
            return [dict(r) if (hasattr(r, 'keys') and not isinstance(r, dict)) else r for r in rows]
        return rows

    def __getattr__(self, name):
        return getattr(self.cursor, name)

class SmartConn:
    def __init__(self, conn, is_pg=False):
        self.conn = conn
        self.is_pg = is_pg

    def cursor(self):
        return SmartCursor(self.conn.cursor(), is_pg=self.is_pg)

    def commit(self):
        return self.conn.commit()

    def rollback(self):
        return self.conn.rollback()

    def close(self):
        return self.conn.close()

    def __getattr__(self, name):
        return getattr(self.conn, name)

def get_db():
    if is_postgres():
        import psycopg2
        import psycopg2.extras
        db_url = os.environ.get("DATABASE_URL", "")
        url = db_url.replace("postgres://", "postgresql://")
        raw_conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.DictCursor)
        return SmartConn(raw_conn, is_pg=True)
    else:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "dijitalgru_qr.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        raw_conn = sqlite3.connect(db_path)
        raw_conn.row_factory = sqlite3.Row
        return SmartConn(raw_conn, is_pg=False)

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    if is_postgres():
        # PostgreSQL Production Cloud Schemas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            plan VARCHAR(50) DEFAULT 'free',
            subscription_end BIGINT DEFAULT 0,
            dynamic_qr_limit INT DEFAULT 3,
            created_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS qr_codes (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            short_code VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            target_url TEXT NOT NULL,
            is_dynamic INT DEFAULT 1,
            custom_settings TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'active',
            scans_count INT DEFAULT 0,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scan_logs (
            id SERIAL PRIMARY KEY,
            qr_id INT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
            scanned_at BIGINT NOT NULL,
            ip_address VARCHAR(100),
            user_agent TEXT,
            device_type VARCHAR(50),
            browser VARCHAR(50),
            country VARCHAR(100) DEFAULT 'Turkey',
            city VARCHAR(100) DEFAULT 'İstanbul'
        );
        CREATE TABLE IF NOT EXISTS vcard_pages (
            id SERIAL PRIMARY KEY,
            qr_id INT UNIQUE NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
            full_name VARCHAR(255),
            title VARCHAR(255),
            company VARCHAR(255),
            phone VARCHAR(50),
            email VARCHAR(255),
            website TEXT,
            address TEXT,
            bio TEXT,
            avatar_url TEXT,
            social_links TEXT
        );
        CREATE TABLE IF NOT EXISTS menu_pages (
            id SERIAL PRIMARY KEY,
            qr_id INT UNIQUE NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
            title VARCHAR(255),
            description TEXT,
            cover_url TEXT,
            pdf_url TEXT,
            categories TEXT
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_name VARCHAR(100) NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            status VARCHAR(50) NOT NULL,
            iyzico_sub_id VARCHAR(100),
            invoice_no VARCHAR(100),
            created_at BIGINT NOT NULL
        );
        """)
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));")
        except Exception:
            pass
    else:
        # SQLite Schemas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            plan TEXT DEFAULT 'free',
            subscription_end INTEGER DEFAULT 0,
            dynamic_qr_limit INTEGER DEFAULT 3,
            created_at INTEGER NOT NULL
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            short_code TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            target_url TEXT NOT NULL,
            is_dynamic INTEGER DEFAULT 1,
            custom_settings TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            scans_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS scan_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            qr_id INTEGER NOT NULL,
            scanned_at INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            device_type TEXT,
            browser TEXT,
            country TEXT DEFAULT 'Turkey',
            city TEXT DEFAULT 'İstanbul',
            FOREIGN KEY (qr_id) REFERENCES qr_codes (id)
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vcard_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            qr_id INTEGER NOT NULL UNIQUE,
            full_name TEXT,
            title TEXT,
            company TEXT,
            phone TEXT,
            email TEXT,
            website TEXT,
            address TEXT,
            bio TEXT,
            avatar_url TEXT,
            social_links TEXT,
            FOREIGN KEY (qr_id) REFERENCES qr_codes (id)
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS menu_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            qr_id INTEGER NOT NULL UNIQUE,
            title TEXT,
            description TEXT,
            cover_url TEXT,
            pdf_url TEXT,
            categories TEXT,
            FOREIGN KEY (qr_id) REFERENCES qr_codes (id)
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_name TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            iyzico_sub_id TEXT,
            invoice_no TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_code TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            content_type TEXT DEFAULT 'application/pdf',
            data_b64 TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (email);")
    
    # Column migrations for existing tables
    for alter_cmd in [
        "ALTER TABLE menu_pages ADD COLUMN pdf_url TEXT",
        "ALTER TABLE menu_pages ADD COLUMN cover_url TEXT",
        "ALTER TABLE vcard_pages ADD COLUMN avatar_url TEXT",
        "ALTER TABLE vcard_pages ADD COLUMN social_links TEXT"
    ]:
        try:
            cursor.execute(alter_cmd)
        except Exception:
            pass

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("✅ Veritabanı bulut / lokal uyumlu başlatıldı.")
