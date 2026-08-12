import hashlib
import time
import jwt
import os
import json
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db

# Fail-fast check for JWT_SECRET in Production
JWT_SECRET_ENV = os.environ.get("JWT_SECRET")
IS_PROD = os.environ.get("FLASK_ENV") == "production" or os.environ.get("RAILWAY_ENVIRONMENT_NAME") is not None

if not JWT_SECRET_ENV:
    if IS_PROD:
        raise RuntimeError("FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!")
    print("⚠️ WARNING: JWT_SECRET environment variable not set. Using local development secret.")
    SECRET_KEY = "dijitalgru_qr_dev_secret_key_2026_local_only"
else:
    SECRET_KEY = JWT_SECRET_ENV.strip()

def hash_password(password):
    """
    Generates a secure, unique-salted password hash using Werkzeug (pbkdf2:sha256).
    Each user receives an individual, randomly generated salt.
    """
    return generate_password_hash(password, method="pbkdf2:sha256")

def verify_password_with_migration(password, hashed):
    """
    Verifies password.
    Returns (is_valid, needs_migration).
    Supports seamless legacy pbkdf2_hmac hash auto-migration.
    """
    if not hashed or not password:
        return False, False
        
    # Werkzeug hash format check (scrypt:, pbkdf2:, bcrypt:, $)
    if ":" in hashed or hashed.startswith("$"):
        return check_password_hash(hashed, password), False
        
    # Legacy PBKDF2 HMAC fallback check
    try:
        legacy_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), b"dijitalgru_salt_2026", 100000).hex()
        if legacy_hash == hashed:
            return True, True # Match found, needs migration
    except Exception:
        pass
        
    return False, False

def verify_password(password, hashed):
    is_valid, _ = verify_password_with_migration(password, hashed)
    return is_valid

def create_token(user):
    payload = {
        "user_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "plan": user["plan"],
        "exp": int(time.time()) + (86400 * 30) # 30 days valid
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        return None

def register_user(name, email, password):
    clean_email = (email or "").lower().strip()
    clean_name = (name or "").strip()
    
    if not clean_name or len(clean_name) < 2:
        return None, "Lütfen geçerli bir ad soyad girin."
        
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        return None, "Lütfen geçerli bir e-posta adresi girin."
        
    if not password or len(password) < 6:
        return None, "Şifreniz en az 6 karakter olmalıdır."
        
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (clean_email,))
        if cursor.fetchone():
            conn.close()
            return None, "Bu e-posta adresi ile zaten kayıtlı bir hesap var. Lütfen giriş yapın."
            
        pwd_hash = hash_password(password)
        now = int(time.time())
        
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, plan, subscription_end, dynamic_qr_limit, created_at)
        VALUES (?, ?, ?, 'free', ?, 3, ?)
        """, (clean_name, clean_email, pwd_hash, now + (86400 * 7), now))
        
        user_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute("SELECT id, name, email, plan, subscription_end, dynamic_qr_limit FROM users WHERE id = ?", (user_id,))
        user = dict(cursor.fetchone())
        conn.close()
        
        token = create_token(user)
        return {"token": token, "user": user}, None
    except Exception as e:
        conn.close()
        return None, "Bu e-posta adresi ile zaten kayıtlı bir hesap var. Lütfen giriş yapın."

def login_user(email, password):
    clean_email = (email or "").lower().strip()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (clean_email,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None, "E-posta veya şifre hatalı."
        
    user = dict(row)
    is_valid, needs_migration = verify_password_with_migration(password, user["password_hash"])
    
    if not is_valid:
        conn.close()
        return None, "E-posta veya şifre hatalı."
        
    # Auto-migrate legacy hash to unique-salted Werkzeug hash
    if needs_migration:
        try:
            new_hash = hash_password(password)
            cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user["id"]))
            conn.commit()
            print(f"🔒 Auto-migrated password hash to Werkzeug for user {user['id']}")
        except Exception as ex:
            print(f"Password hash migration failed for user {user['id']}:", ex)
            
    conn.close()
    
    del user["password_hash"]
    token = create_token(user)
    return {"token": token, "user": user}, None

def get_user_by_id(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, plan, subscription_end, dynamic_qr_limit, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
