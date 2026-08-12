import os
import uuid
import time
import base64
import requests

from db import get_db, is_postgres

# Environment variables for S3 / R2 / Supabase Storage
S3_BUCKET = os.environ.get("S3_BUCKET_NAME", os.environ.get("SUPABASE_STORAGE_BUCKET", "qr-uploads"))
S3_ENDPOINT = os.environ.get("S3_ENDPOINT_URL", os.environ.get("SUPABASE_URL", ""))
S3_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID", os.environ.get("S3_ACCESS_KEY", os.environ.get("SUPABASE_SERVICE_KEY", "")))
S3_SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", os.environ.get("S3_SECRET_KEY", ""))
S3_PUBLIC_DOMAIN = os.environ.get("S3_PUBLIC_URL", os.environ.get("CLOUD_STORAGE_PUBLIC_URL", ""))

def upload_file_to_cloud(file_bytes, filename, content_type="application/pdf"):
    """
    Uploads file_bytes to S3/R2/Supabase cloud storage or PostgreSQL Cloud Storage.
    Returns public_url.
    """
    file_code = uuid.uuid4().hex[:10]
    ext = filename.split(".")[-1].lower() if "." in filename else "bin"
    cloud_filename = f"uploads/{file_code}.{ext}"

    # 1. Try S3 / R2 / Supabase Cloud Storage if configured
    if S3_ENDPOINT and S3_ACCESS_KEY:
        try:
            # Supabase Storage HTTP Upload
            if "supabase" in S3_ENDPOINT.lower():
                upload_url = f"{S3_ENDPOINT.rstrip('/')}/storage/v1/object/{S3_BUCKET}/{cloud_filename}"
                headers = {
                    "Authorization": f"Bearer {S3_ACCESS_KEY}",
                    "apikey": S3_ACCESS_KEY,
                    "Content-Type": content_type,
                    "x-upsert": "true"
                }
                res = requests.post(upload_url, headers=headers, data=file_bytes, timeout=10)
                if res.status_code in [200, 201]:
                    public_url = f"{S3_ENDPOINT.rstrip('/')}/storage/v1/object/public/{S3_BUCKET}/{cloud_filename}"
                    return public_url, file_code
            
            # S3 / boto3 fallback if boto3 installed
            try:
                import boto3
                s3_client = boto3.client(
                    's3',
                    endpoint_url=S3_ENDPOINT if S3_ENDPOINT else None,
                    aws_access_key_id=S3_ACCESS_KEY,
                    aws_secret_access_key=S3_SECRET_KEY
                )
                s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=cloud_filename,
                    Body=file_bytes,
                    ContentType=content_type
                )
                if S3_PUBLIC_DOMAIN:
                    public_url = f"{S3_PUBLIC_DOMAIN.rstrip('/')}/{cloud_filename}"
                else:
                    public_url = f"{S3_ENDPOINT.rstrip('/')}/{S3_BUCKET}/{cloud_filename}"
                return public_url, file_code
            except Exception:
                pass
        except Exception as e:
            print(f"Cloud Storage upload error: {e}")

    # 2. PostgreSQL Cloud Storage (Persistent DB Storage)
    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    now = int(time.time())

    conn = get_db()
    cursor = conn.cursor()

    # Ensure table exists
    try:
        if is_postgres():
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS pdf_files (
                id SERIAL PRIMARY KEY,
                file_code VARCHAR(100) UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                content_type VARCHAR(100) DEFAULT 'application/pdf',
                data_b64 TEXT NOT NULL,
                created_at BIGINT NOT NULL
            )
            """)
        else:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS pdf_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_code TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                content_type VARCHAR(100) DEFAULT 'application/pdf',
                data_b64 TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """)
        conn.commit()
    except Exception:
        pass

    cursor.execute("""
    INSERT INTO pdf_files (file_code, filename, content_type, data_b64, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (file_code, filename, content_type, b64_data, now))
    conn.commit()
    conn.close()

    public_url = f"/p/pdf/{file_code}.pdf"
    return public_url, file_code
