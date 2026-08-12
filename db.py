import sqlite3
import json
import os
import time

DATABASE_URL = os.environ.get("DATABASE_URL", "")

def is_postgres():
    return DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")

def get_db():
    if is_postgres():
        import psycopg2
        import psycopg2.extras
        # Fix legacy postgres:// URL format for SQLAlchemy/Psycopg
        url = DATABASE_URL.replace("postgres://", "postgresql://")
        conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.DictCursor)
        return conn
    else:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "dijitalgru_qr.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

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
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (email);")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("✅ Veritabanı bulut / lokal uyumlu başlatıldı.")
