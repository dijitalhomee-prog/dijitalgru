import hashlib
import time
import jwt
import os
import json
from db import get_db

SECRET_KEY = os.environ.get("JWT_SECRET", "dijitalgru_qr_secret_key_2026_super_secure")

def hash_password(password):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), b"dijitalgru_salt_2026", 100000).hex()

def verify_password(password, hashed):
    return hash_password(password) == hashed

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
    conn.close()
    
    if not row:
        return None, "E-posta veya şifre hatalı."
        
    user = dict(row)
    if not verify_password(password, user["password_hash"]):
        return None, "E-posta veya şifre hatalı."
        
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
