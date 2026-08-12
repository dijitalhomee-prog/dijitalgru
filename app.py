from flask import Flask, render_template, request, jsonify, redirect, send_file, Response
import time
import json
import uuid
import os
import io
import base64
import threading

from PIL import Image
from db import init_db, get_db, is_postgres
from auth import register_user, login_user, decode_token, get_user_by_id
from qr_engine import generate_qr_image
from payments import create_checkout_form, verify_and_process_iyzico_callback, PLANS
from cloud_storage import upload_file_to_cloud
from migrate_db import run_migrations

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.environ.get("JWT_SECRET", "dijitalgru_qr_secret_key_2026")

# Initialize Database and Migrations on Startup
try:
    init_db()
    run_migrations()
except Exception as e:
    print(f"⚠️ DB initialization/migration note: {e}")

# --- Helper Auth Middleware ---
def get_current_user():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    token = auth_header.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload:
        return None
    return get_user_by_id(payload["user_id"])

# --- Public Routes ---

@app.route("/")
def index():
    initial_qr = generate_qr_image("https://qrdijitalgru.com", {
        "fill_color": "#4F46E5",
        "back_color": "#FFFFFF",
        "frame_style": "card",
        "frame_text": "Beni Tara!",
        "frame_color": "#4F46E5"
    }, format="base64")
    return render_template("index.html", initial_qr_image=initial_qr)

def _log_scan_async(qr_id, visitor_ip, user_agent):
    """
    Background Thread: Asynchronously logs scan analytics without blocking user redirect.
    Opens and closes its own DB connection safely.
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        now = int(time.time())
        device_type = "Mobile" if ("Mobile" in user_agent or "Android" in user_agent or "iPhone" in user_agent) else "Desktop"
        browser = "Chrome" if "Chrome" in user_agent else ("Safari" if "Safari" in user_agent else "Other")
        
        cursor.execute("""
        INSERT INTO scan_logs (qr_id, scanned_at, ip_address, user_agent, device_type, browser, country, city)
        VALUES (?, ?, ?, ?, ?, ?, 'Türkiye', 'İstanbul')
        """, (qr_id, now, visitor_ip, user_agent, device_type, browser))
        
        cursor.execute("UPDATE qr_codes SET scans_count = COALESCE(scans_count, 0) + 1 WHERE id = ?", (qr_id,))
        conn.commit()
        cursor.close()
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        print(f"[scan log error] qr_id={qr_id}: {e}")
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.route("/r/<short_code>")
def redirect_qr(short_code):
    """
    Ultra-fast Dynamic QR short URL redirect engine (<50ms).
    Target is ALWAYS the QR's own target_url/file, NEVER /panel or static admin page.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, type, target_url, status FROM qr_codes WHERE short_code = ?", (short_code,))
        qr_row = cursor.fetchone()
        cursor.close()
    except Exception as ex:
        conn.rollback()
        conn.close()
        print(f"[/r/{short_code}] DB lookup error:", ex)
        return "<h3>⚠️ Sunucu Hatası</h3><p>Yönlendirme sırasında bir Hata oluştu.</p>", 500
        
    conn.close()
    
    if not qr_row:
        return "<h3>⚠️ QR Kod Bulunamadı</h3><p>Aradığınız QR kod sistemde bulunamadı veya silinmiş olabilir.</p>", 404
        
    qr = dict(qr_row)
    qr_id = qr["id"]
    status = qr.get("status", "active")
    target_url = (qr.get("target_url") or "").strip()
    
    if status in ["passive", "paused", "deleted", "archived"]:
        return "<h3>🟡 Bu QR Kod Pasife Alınmıştır</h3><p>Bu QR kod şu anda aktif değildir.</p>", 403
        
    if not target_url:
        return "<h3>⚠️ Hedef Adres Bulunamadı</h3><p>Bu QR kod için geçerli bir hedef bulunamadı.</p>", 404

    # ---- Async Scan Analytics Logging (Non-blocking Thread) ----
    visitor_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(',')[0].strip()
    user_agent = request.headers.get("User-Agent", "")
    
    threading.Thread(
        target=_log_scan_async,
        args=(qr_id, visitor_ip, user_agent),
        daemon=True
    ).start()

    # ---- Target Resolution: ALWAYS redirect instantly to target_url ----
    if target_url.startswith("micropage://vcard") or target_url == "vcard":
        return redirect(f"/p/vcard/{qr_id}", code=302)
    elif target_url.startswith("micropage://menu") or target_url == "menu" or target_url == "pdf":
        return redirect(f"/p/menu/{qr_id}", code=302)
    elif target_url.startswith("/"):
        return redirect(target_url, code=302)
    elif not (target_url.startswith("http://") or target_url.startswith("https://")):
        target_url = "https://" + target_url
        
    return redirect(target_url, code=302)

@app.route("/p/vcard/<int:qr_id>")
def public_vcard(qr_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vcard_pages WHERE qr_id = ?", (qr_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return "Kartvizit Bulunamadı", 404
        
    vcard_data = dict(row)
    return render_template("vcard_template.html", vcard=vcard_data)

@app.route("/p/vcard/<int:qr_id>.vcf")
def download_vcard(qr_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vcard_pages WHERE qr_id = ?", (qr_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return "Kartvizit Bulunamadı", 404
        
    v = dict(row)
    name = v.get("full_name", "Kişi Kartı")
    title = v.get("title", "")
    org = v.get("company", "")
    phone = v.get("phone", "")
    email = v.get("email", "")
    website = v.get("website", "")
    
    vcard_lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"FN:{name}",
        f"N:{name};;;;",
    ]
    if title:
        vcard_lines.append(f"TITLE:{title}")
    if org:
        vcard_lines.append(f"ORG:{org}")
    if phone:
        vcard_lines.append(f"TEL;TYPE=CELL:{phone}")
    if email:
        vcard_lines.append(f"EMAIL:{email}")
    if website:
        vcard_lines.append(f"URL:{website}")
    vcard_lines.append("END:VCARD")
    
    vcard_content = "\r\n".join(vcard_lines)
    response = Response(vcard_content, mimetype="text/vcard; charset=utf-8")
    response.headers["Content-Disposition"] = f'attachment; filename="{name}.vcf"'
    return response

@app.route("/p/menu/<int:qr_id>")
def public_menu(qr_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM menu_pages WHERE qr_id = ?", (qr_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return "Menü Bulunamadı", 404
        
    menu_data = dict(row)
    pdf_url = menu_data.get("pdf_url")
    if pdf_url in ["None", "null", "undefined", ""]:
        pdf_url = None
        menu_data["pdf_url"] = None
        
    if menu_data.get("categories"):
        try:
            menu_data["categories"] = json.loads(menu_data["categories"])
        except Exception:
            menu_data["categories"] = []
    else:
        menu_data["categories"] = []
        
    # If PDF exists and no categories, redirect directly to PDF file for instant viewing
    if pdf_url and (pdf_url.startswith("/") or pdf_url.startswith("http")) and not menu_data["categories"]:
        return redirect(pdf_url)
        
    return render_template("menu_template.html", menu=menu_data)

# --- REST API Endpoints ---

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.json or {}
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    
    if not name or not email or not password:
        return jsonify({"error": "Lütfen tüm alanları doldurun."}), 400
        
    res, err = register_user(name, email, password)
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify(res)

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "E-posta ve şifre gereklidir."}), 400
        
    res, err = login_user(email, password)
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify(res)

@app.route("/api/auth/me", methods=["GET"])
def api_me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
    return jsonify({"user": user})

@app.route("/api/qr/preview", methods=["POST"])
def api_qr_preview():
    data = request.json or {}
    text = data.get("text", "https://dijitalgru.com")
    settings = data.get("settings", {})
    
    b64_img = generate_qr_image(text, settings, format="base64")
    return jsonify({"image": b64_img})

@app.route("/static/uploads/pdfs/<filename>")
def serve_legacy_static_pdf(filename):
    # 1. Check local static folder
    filepath = os.path.join(app.static_folder, "uploads", "pdfs", filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype="application/pdf")
        
    # 2. Fallback to PostgreSQL database pdf_files
    file_code = filename.replace("menu_", "").replace(".pdf", "")
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM pdf_files WHERE file_code = ? OR filename = ?", (file_code, filename))
        row = cursor.fetchone()
    except Exception as ex:
        conn.rollback()
        conn.close()
        return "PDF Bulunamadı", 404
    conn.close()
    
    if row:
        pdf_data = dict(row)
        pdf_bytes = base64.b64decode(pdf_data["data_b64"])
        response = Response(pdf_bytes, mimetype=pdf_data.get("content_type", "application/pdf"))
        response.headers["Content-Disposition"] = f'inline; filename="{pdf_data["filename"]}"'
        return response
        
    return "PDF Dosyası Bulunamadı", 404

@app.route("/p/pdf/<file_code>")
@app.route("/p/pdf/<file_code>.pdf")
def serve_pdf(file_code):
    if file_code.endswith(".pdf"):
        file_code = file_code[:-4]
        
    # 1. Check local disk static uploads first (Sub-10ms response!)
    local_path = os.path.join(app.static_folder, "uploads", "pdfs", f"{file_code}.pdf")
    if os.path.exists(local_path):
        return send_file(local_path, mimetype="application/pdf")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT filename, content_type, data_b64 FROM pdf_files WHERE file_code = ?", (file_code,))
        row = cursor.fetchone()
        cursor.close()
    except Exception as ex:
        conn.rollback()
        conn.close()
        return "PDF Bulunamadı", 404
    conn.close()
    
    if not row:
        return "PDF Dosyası Bulunamadı", 404
        
    pdf_data = dict(row)
    filename = pdf_data.get("filename", f"{file_code}.pdf")
    content_type = pdf_data.get("content_type", "application/pdf")
    
    try:
        pdf_bytes = base64.b64decode(pdf_data["data_b64"])
        # Save to local disk cache for instant future hits
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(pdf_bytes)
        return send_file(local_path, mimetype=content_type)
    except Exception as ex:
        print(f"PDF decode error for {file_code}:", ex)
        return "PDF Dosyası Okunamadı", 500

@app.route("/api/upload/pdf", methods=["POST"])
def api_upload_pdf():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    if "pdf_file" not in request.files:
        return jsonify({"error": "Lütfen bir PDF dosyası seçin."}), 400
        
    file = request.files["pdf_file"]
    if file.filename == "":
        return jsonify({"error": "Dosya seçilmedi."}), 400
        
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Sadece PDF formatındaki dosyalar yüklenebilir."}), 400
        
    pdf_bytes = file.read()
    pdf_url, file_code = upload_file_to_cloud(pdf_bytes, file.filename, content_type="application/pdf")
    
    return jsonify({"status": "success", "pdf_url": pdf_url, "filename": file.filename})

@app.route("/api/qr/create", methods=["POST"])
def api_qr_create():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    data = request.json or {}
    title = data.get("title", "Yeni QR Kod")
    qr_type = data.get("type", "url") # url, vcard, menu, wifi, whatsapp
    target_url = data.get("target_url", "")
    settings = data.get("settings", {})
    vcard_payload = data.get("vcard_payload")
    menu_payload = data.get("menu_payload")
    
    # Generate unique short code
    short_code = uuid.uuid4().hex[:7]
    now = int(time.time())
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check user dynamic limits
    cursor.execute("SELECT COUNT(*) as count FROM qr_codes WHERE user_id = ? AND is_dynamic = 1", (user["id"],))
    count = cursor.fetchone()["count"]
    
    if count >= user["dynamic_qr_limit"]:
        conn.close()
        return jsonify({"error": f"Paketinizin dinamik QR oluşturma limitine ({user['dynamic_qr_limit']}) ulaştınız. Lütfen paketinizi yükseltin!"}), 403
        
    cursor.execute("""
    INSERT INTO qr_codes (user_id, short_code, title, type, target_url, is_dynamic, custom_settings, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'active', ?, ?)
    """, (user["id"], short_code, title, qr_type, target_url, json.dumps(settings), now, now))
    
    qr_id = cursor.lastrowid
    
    # Handle micropage payloads
    if qr_type == "vcard" and vcard_payload:
        cursor.execute("""
        INSERT INTO vcard_pages (qr_id, full_name, title, company, phone, email, website, address, bio, avatar_url, social_links)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            qr_id,
            vcard_payload.get("full_name"),
            vcard_payload.get("title"),
            vcard_payload.get("company"),
            vcard_payload.get("phone"),
            vcard_payload.get("email"),
            vcard_payload.get("website"),
            vcard_payload.get("address"),
            vcard_payload.get("bio"),
            vcard_payload.get("avatar_url"),
            json.dumps(vcard_payload.get("social_links", {}))
        ))
        direct_vcard = vcard_payload.get("direct_redirect", False)
        if direct_vcard:
            cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (f"/p/vcard/{qr_id}.vcf", qr_id))
        else:
            cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (f"micropage://vcard/{qr_id}", qr_id))
        
    elif qr_type == "menu" and menu_payload:
        pdf_url = menu_payload.get("pdf_url")
        if pdf_url in ["None", "null", "undefined", ""]:
            pdf_url = None

        direct_redirect = menu_payload.get("direct_redirect", True)

        cursor.execute("""
        INSERT INTO menu_pages (qr_id, title, description, cover_url, pdf_url, categories)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            qr_id,
            menu_payload.get("title"),
            menu_payload.get("description"),
            menu_payload.get("cover_url"),
            pdf_url,
            json.dumps(menu_payload.get("categories", []))
        ))
        
        # If PDF is uploaded AND direct_redirect is True, redirect QR scans DIRECTLY to the PDF file!
        if pdf_url and (pdf_url.startswith("/") or pdf_url.startswith("http")) and direct_redirect:
            cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (pdf_url, qr_id))
        else:
            cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (f"micropage://menu/{qr_id}", qr_id))
        
    conn.commit()
    conn.close()
    
    app_url = request.host_url.rstrip("/")
    redirect_url = f"{app_url}/r/{short_code}"
    
    b64_qr = generate_qr_image(redirect_url, settings, format="base64")
    
    return jsonify({
        "status": "success",
        "qr_id": qr_id,
        "short_code": short_code,
        "short_url": redirect_url,
        "qr_image": b64_qr
    })

@app.route("/api/qr/<int:qr_id>/download", methods=["GET"])
def api_qr_download(qr_id):
    fmt = request.args.get("format", "png").lower()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM qr_codes WHERE id = ?", (qr_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return "QR kod bulunamadı", 404
        
    qr = dict(row)
    app_url = request.host_url.rstrip("/")
    redirect_url = f"{app_url}/r/{qr['short_code']}"
    
    try:
        settings = json.loads(qr["custom_settings"])
    except Exception:
        settings = {}
        
    img_data = generate_qr_image(redirect_url, settings, format=fmt)
    
    mimetype = "image/png"
    if fmt in ["jpg", "jpeg"]:
        mimetype = "image/jpeg"
    elif fmt == "svg":
        mimetype = "image/svg+xml"
        
    buffer = io.BytesIO(img_data)
    buffer.seek(0)
    
    safe_title = "".join(c for c in qr['title'] if c.isalnum() or c in (' ', '_', '-')).strip() or "qr_code"
    filename = f"{safe_title}.{fmt}"
    
    return send_file(buffer, mimetype=mimetype, as_attachment=True, download_name=filename)

@app.route("/api/qr/<int:qr_id>/update", methods=["POST"])
def api_qr_update(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    data = request.json or {}
    target_url = data.get("target_url")
    title = data.get("title")
    status = data.get("status")
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM qr_codes WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "QR kod bulunamadı."}), 404
        
    now = int(time.time())
    if target_url:
        cursor.execute("UPDATE qr_codes SET target_url = ?, updated_at = ? WHERE id = ?", (target_url, now, qr_id))
    if title:
        cursor.execute("UPDATE qr_codes SET title = ?, updated_at = ? WHERE id = ?", (title, now, qr_id))
    if status:
        cursor.execute("UPDATE qr_codes SET status = ?, updated_at = ? WHERE id = ?", (status, now, qr_id))
        
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "QR Kod güncellendi!"})

@app.route("/api/qr/<int:qr_id>", methods=["DELETE"])
@app.route("/api/qr/<int:qr_id>/delete", methods=["DELETE", "POST"])
def api_qr_delete(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM qr_codes WHERE id = ? AND user_id = ?", (qr_id, user["id"]))
    cursor.execute("DELETE FROM scan_logs WHERE qr_id = ?", (qr_id,))
    cursor.execute("DELETE FROM vcard_pages WHERE qr_id = ?", (qr_id,))
    cursor.execute("DELETE FROM menu_pages WHERE qr_id = ?", (qr_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "QR kod başarıyla silindi."})
    
@app.route("/api/qr/list", methods=["GET"])
def api_qr_list():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
        SELECT 
            q.id, q.short_code, q.title, q.type, q.target_url, q.is_dynamic, q.custom_settings, q.status, q.scans_count, 
            COALESCE(q.folder_name, 'Genel') as folder_name, q.created_at, q.updated_at,
            COUNT(DISTINCT sl.ip_address) as unique_scans
        FROM qr_codes q
        LEFT JOIN scan_logs sl ON q.id = sl.qr_id
        WHERE q.user_id = ?
        GROUP BY q.id, q.short_code, q.title, q.type, q.target_url, q.is_dynamic, q.custom_settings, q.status, q.scans_count, q.folder_name, q.created_at, q.updated_at
        ORDER BY q.created_at DESC
        """, (user["id"],))
        rows = cursor.fetchall()
    except Exception as ex:
        conn.rollback()
        conn.close()
        print("Error in api_qr_list:", ex)
        return jsonify({"error": "QR listesi alınırken sunucu hatası oluştu."}), 500
    
    qr_codes = []
    app_url = request.host_url.rstrip("/")
    for r in rows:
        item = dict(r)
        short_code = item.get("short_code", "")
        item["short_url"] = f"{app_url}/r/{short_code}"
        item["scan_count"] = item.get("scans_count", 0)
        item["unique_scans"] = item.get("unique_scans", 0)
        item["folder_name"] = item.get("folder_name", "Genel")
        
        try:
            settings = json.loads(item["custom_settings"]) if item.get("custom_settings") else {}
        except Exception:
            settings = {}
            
        item["settings"] = settings
        item["qr_image"] = generate_qr_image(item["short_url"], settings, format="base64")
        qr_codes.append(item)
        
    # Stats
    try:
        cursor.execute("SELECT COUNT(*) as total_qr, COALESCE(SUM(scans_count), 0) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
        stats_row = cursor.fetchone()
        total_qr = stats_row["total_qr"] if stats_row else 0
        total_scans = stats_row["total_scans"] if stats_row else 0

        cursor.execute("SELECT COUNT(DISTINCT ip_address) as unique_visitors FROM scan_logs WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user["id"],))
        uv_row = cursor.fetchone()
        unique_visitors = uv_row["unique_visitors"] if uv_row else 0
    except Exception as ex:
        conn.rollback()
        print("Error fetching stats:", ex)
        total_qr = len(qr_codes)
        total_scans = 0
        unique_visitors = 0

    avg_scans = round(total_scans / total_qr, 1) if total_qr > 0 else 0.0
    dynamic_qr_count = len([q for q in qr_codes if q.get("is_dynamic")])

    conn.close()

    return jsonify({
        "qr_codes": qr_codes,
        "stats": {
            "total_qr": total_qr,
            "total_scans": total_scans,
            "unique_visitors": unique_visitors,
            "avg_scans_per_qr": avg_scans,
            "dynamic_qr_count": dynamic_qr_count
        },
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "plan": user["plan"],
            "dynamic_qr_limit": user["dynamic_qr_limit"]
        }
    })

@app.route("/api/qr/export/<int:qr_id>", methods=["GET"])
def api_export_qr(qr_id):
    export_format = request.args.get("format", "png").lower()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM qr_codes WHERE id = ?", (qr_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return "QR Kodu Bulunamadı", 404
        
    qr = dict(row)
    short_url = f"{request.host_url.rstrip('/')}/r/{qr['short_code']}"
    settings = {}
    if qr.get("custom_settings"):
        try:
            settings = json.loads(qr["custom_settings"])
        except Exception:
            pass
            
    title = qr.get("title", "qr_code").replace(" ", "_")
    
    if export_format == "svg":
        svg_bytes = generate_qr_image(short_url, settings, format="svg")
        response = Response(svg_bytes, mimetype="image/svg+xml")
        response.headers["Content-Disposition"] = f'attachment; filename="{title}.svg"'
        return response
        
    elif export_format == "eps":
        png_bytes = generate_qr_image(short_url, settings, format="png")
        img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        eps_buffer = io.BytesIO()
        img.save(eps_buffer, format="EPS")
        eps_buffer.seek(0)
        
        response = Response(eps_buffer.getvalue(), mimetype="application/postscript")
        response.headers["Content-Disposition"] = f'attachment; filename="{title}.eps"'
        return response
        
    elif export_format == "pdf":
        png_bytes = generate_qr_image(short_url, settings, format="png")
        img = Image.open(io.BytesIO(png_bytes))
        pdf_buffer = io.BytesIO()
        img.save(pdf_buffer, format="PDF", resolution=300.0)
        pdf_buffer.seek(0)
        
        response = Response(pdf_buffer.getvalue(), mimetype="application/pdf")
        response.headers["Content-Disposition"] = f'attachment; filename="{title}.pdf"'
        return response
        
    else: # PNG
        png_bytes = generate_qr_image(short_url, settings, format="png")
        response = Response(png_bytes, mimetype="image/png")
        response.headers["Content-Disposition"] = f'attachment; filename="{title}.png"'
        return response

@app.route("/api/qr/<int:qr_id>/update_folder", methods=["POST"])
def api_update_qr_folder(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim."}), 401
    folder_name = (request.json or {}).get("folder_name", "Genel")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE qr_codes SET folder_name = ? WHERE id = ? AND user_id = ?", (folder_name, qr_id, user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "folder_name": folder_name})

@app.route("/api/qr/<int:qr_id>/update_status", methods=["POST"])
def api_update_qr_status(qr_id):
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim."}), 401
    new_status = (request.json or {}).get("status", "active")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE qr_codes SET status = ? WHERE id = ? AND user_id = ?", (new_status, qr_id, user["id"]))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "status": new_status})
        
    # Stats
    cursor.execute("SELECT COUNT(*) as total_qr, SUM(scans_count) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
    tot_row = cursor.fetchone()
    total_qr = (tot_row["total_qr"] if (tot_row and "total_qr" in tot_row) else 0) if tot_row else 0
    total_scans = (tot_row["total_scans"] if (tot_row and "total_scans" in tot_row) else 0) if tot_row else 0
    
    # Unique visitors (IP based) & avg scans
    cursor.execute("""
    SELECT COUNT(DISTINCT sl.ip_address) as unique_visitors 
    FROM scan_logs sl 
    JOIN qr_codes q ON sl.qr_id = q.id 
    WHERE q.user_id = ?
    """, (user["id"],))
    uv_row = cursor.fetchone()
    unique_visitors = (uv_row["unique_visitors"] if (uv_row and "unique_visitors" in uv_row) else 0) or 0
    avg_scans = round(total_scans / total_qr, 1) if total_qr > 0 else 0.0
    
    conn.close()
    
    return jsonify({
        "status": "success",
        "qr_codes": qr_codes,
        "stats": {
            "total_qr": total_qr or len(qr_codes),
            "total_scans": total_scans or 0,
            "unique_visitors": unique_visitors,
            "avg_scans_per_qr": avg_scans,
            "dynamic_qr_count": len(qr_codes)
        },
        "user": user
    })

@app.route("/api/analytics/dashboard", methods=["GET"])
def api_analytics_dashboard():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    
    # Total QRs & Total Scans
    cursor.execute("SELECT COUNT(*) as total_qr, SUM(scans_count) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
    tot_row = cursor.fetchone()
    total_qr = tot_row["total_qr"] or 0
    total_scans = tot_row["total_scans"] or 0
    
    cursor.execute("""
    SELECT COUNT(DISTINCT sl.ip_address) as unique_visitors 
    FROM scan_logs sl 
    JOIN qr_codes q ON sl.qr_id = q.id 
    WHERE q.user_id = ?
    """, (user["id"],))
    uv_row = cursor.fetchone()
    unique_visitors = (uv_row["unique_visitors"] if (uv_row and "unique_visitors" in uv_row) else 0) or 0
    avg_scans = round(total_scans / total_qr, 1) if total_qr > 0 else 0.0
    
    # Device breakdown
    cursor.execute("""
    SELECT sl.device_type, COUNT(*) as count 
    FROM scan_logs sl
    JOIN qr_codes q ON sl.qr_id = q.id
    WHERE q.user_id = ?
    GROUP BY sl.device_type
    """, (user["id"],))
    devices = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return jsonify({
        "total_qr": total_qr,
        "total_scans": total_scans,
        "unique_visitors": unique_visitors,
        "avg_scans_per_qr": avg_scans,
        "dynamic_limit": user["dynamic_qr_limit"],
        "plan": user["plan"],
        "devices": devices
    })

@app.route("/api/subscriptions/plans", methods=["GET"])
def api_get_plans():
    return jsonify({"plans": PLANS})

@app.route("/api/iyzico/checkout-form", methods=["POST"])
@app.route("/api/subscriptions/purchase", methods=["POST"])
def api_iyzico_checkout():
    """
    Initializes iyzico payment checkout form.
    NEVER directly activates user plan without iyzico payment verification.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    data = request.json or {}
    plan_key = data.get("plan_key", "starter")
    cycle = data.get("cycle", "monthly")
    
    # Secure callback URL pointing to /api/iyzico/callback
    callback_url = f"{request.host_url.rstrip('/')}/api/iyzico/callback"
    
    from payments import create_checkout_form
    res_json, err = create_checkout_form(user, plan_key, cycle, callback_url)
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify(res_json)

@app.route("/api/iyzico/callback", methods=["POST", "GET"])
def api_iyzico_callback():
    """
    Secure Webhook Callback from iyzico.
    Retrieves token, verifies payment with iyzico server, and ONLY updates DB if paymentStatus == 'SUCCESS'.
    """
    token = request.form.get("token") or request.args.get("token")
    if not token and request.json:
        token = request.json.get("token")
        
    from payments import verify_and_process_iyzico_callback
    res, err = verify_and_process_iyzico_callback(token)
    
    if err or not res or res.get("status") != "success":
        error_msg = err or (res.get("error") if res else "Ödeme doğrulanamadı.")
        print(f"[/api/iyzico/callback] Payment verification failed:", error_msg)
        return f"""
        <html>
            <head><title>Ödeme Başarısız</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: white;">
                <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
                    <h2 style="color: #ef4444;">⚠️ Ödeme Tamamlanamadı</h2>
                    <p>{error_msg}</p>
                    <a href="/panel" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border-radius: 8px; text-decoration: none;">Panele Dön</a>
                </div>
                <script>
                    setTimeout(function() {{
                        window.location.href = "/panel?payment=failed";
                    }}, 4000);
                </script>
            </body>
        </html>
        """, 400
        
    plan = res.get("plan", "starter")
    return f"""
    <html>
        <head><title>Ödeme Başarılı!</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: white;">
            <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
                <h2 style="color: #10b981;">🎉 Ödemeniz Başarıyla Alındı!</h2>
                <p>Paketiniz <strong>{res.get('plan', '').upper()}</strong> başarıyla aktif edildi.</p>
                <p style="font-size: 13px; color: #94a3b8;">Fatura No: {res.get('invoice_no')}</p>
                <a href="/panel?payment=success" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #10b981; color: white; border-radius: 8px; text-decoration: none;">Panele Git</a>
            </div>
            <script>
                setTimeout(function() {{
                    window.location.href = "/panel?payment=success&plan={plan}";
                }}, 2500);
            </script>
        </body>
    </html>
    """, 200

# --- Admin System Helpers & Audit Logger ---

def log_admin_action(admin_id, target_user_id, action_type, details=""):
    try:
        conn = get_db()
        cursor = conn.cursor()
        now = int(time.time())
        cursor.execute("""
        INSERT INTO admin_actions (admin_id, target_user_id, action_type, details, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (admin_id, target_user_id, action_type, details, now))
        conn.commit()
        conn.close()
    except Exception as e:
        print("⚠️ log_admin_action error:", e)

def require_admin():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None, (jsonify({"error": "Yetkisiz erişim. Lütfen giriş yapın."}), 401)
        
    token = auth_header.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload:
        return None, (jsonify({"error": "Geçersiz veya süresi dolmuş oturum."}), 401)
        
    user = get_user_by_id(payload["user_id"])
    if not user:
        return None, (jsonify({"error": "Kullanıcı bulunamadı."}), 401)
        
    if not user.get("is_admin"):
        return None, (jsonify({"error": "Erişim engellendi. Yalnızca yöneticiler bu alana erişebilir."}), 403)
        
    if user.get("account_status") == "suspended":
        return None, (jsonify({"error": "Hesabınız askıya alınmıştır."}), 403)
        
    return user, None

# --- Admin Page Route ---

@app.route("/admin")
def admin_page():
    return render_template("admin.html")

# --- Admin API Endpoints ---

@app.route("/api/admin/stats", methods=["GET"])
def api_admin_stats():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM users")
    total_users = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as active_paid FROM users WHERE plan != 'free'")
    active_paid = cursor.fetchone()["active_paid"]
    
    now = int(time.time())
    month_start = now - (86400 * 30)
    cursor.execute("SELECT COUNT(*) as new_month FROM users WHERE created_at >= ?", (month_start,))
    new_users_month = cursor.fetchone()["new_month"]
    
    cursor.execute("SELECT COUNT(*) as total_qrs FROM qr_codes")
    total_qrs = cursor.fetchone()["total_qrs"]
    
    cursor.execute("SELECT COUNT(*) as total_scans FROM scan_logs")
    total_scans = cursor.fetchone()["total_scans"]
    
    conn.close()
    
    return jsonify({
        "total_users": total_users,
        "active_paid_users": active_paid,
        "new_users_this_month": new_users_month,
        "total_qr_codes": total_qrs,
        "total_scans": total_scans
    })

@app.route("/api/admin/users", methods=["GET"])
def api_admin_users():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    q = (request.args.get("q") or "").strip().lower()
    plan_filter = (request.args.get("plan") or "").strip()
    status_filter = (request.args.get("status") or "").strip()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT 
        u.id, u.name, u.email, u.plan, u.subscription_end, u.dynamic_qr_limit, 
        COALESCE(u.is_admin, FALSE) as is_admin, COALESCE(u.account_status, 'active') as account_status, u.created_at,
        COUNT(q.id) as total_qr_count
    FROM users u
    LEFT JOIN qr_codes q ON u.id = q.user_id
    GROUP BY u.id, u.name, u.email, u.plan, u.subscription_end, u.dynamic_qr_limit, u.is_admin, u.account_status, u.created_at
    ORDER BY u.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    users = []
    for r in rows:
        d = dict(r)
        d["is_admin"] = bool(d["is_admin"])
        
        # Apply filters
        if q and (q not in d["name"].lower() and q not in d["email"].lower()):
            continue
        if plan_filter and d["plan"] != plan_filter:
            continue
        if status_filter and d["account_status"] != status_filter:
            continue
            
        users.append(d)
        
    return jsonify({"users": users})

@app.route("/api/admin/users/<int:user_id>", methods=["GET"])
def api_admin_user_detail(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, email, plan, subscription_end, dynamic_qr_limit, COALESCE(is_admin, FALSE) as is_admin, COALESCE(account_status, 'active') as account_status, created_at FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        return jsonify({"error": "Kullanıcı bulunamadı."}), 404
        
    user = dict(user_row)
    user["is_admin"] = bool(user["is_admin"])
    
    # User's QRs
    cursor.execute("SELECT id, title, type, short_code, target_url, scans_count, created_at FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    qrs = cursor.fetchall()
    
    # User's Subscriptions
    cursor.execute("SELECT id, plan_name, amount, status, iyzico_sub_id, invoice_no, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    subs = cursor.fetchall()
    
    conn.close()
    
    return jsonify({
        "user": user,
        "qr_codes": qrs,
        "subscriptions": subs
    })

@app.route("/api/admin/users/<int:user_id>/update-plan", methods=["POST"])
def api_admin_update_plan(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    data = request.json or {}
    new_plan = data.get("plan")
    days = int(data.get("days", 30))
    
    if new_plan not in ["free", "starter", "advanced", "business"]:
        return jsonify({"error": "Geçersiz plan seçimi."}), 400
        
    limits = {"free": 3, "starter": 20, "advanced": 100, "business": 10000}
    qr_limit = limits.get(new_plan, 3)
    
    now = int(time.time())
    sub_end = now + (86400 * days) if new_plan != "free" else 0
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT email, plan FROM users WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        return jsonify({"error": "Kullanıcı bulunamadı."}), 404
        
    old_plan = target_user["plan"]
    cursor.execute("UPDATE users SET plan = ?, subscription_end = ?, dynamic_qr_limit = ? WHERE id = ?", (new_plan, sub_end, qr_limit, user_id))
    
    # Record manual admin plan assignment in subscriptions table with source = 'manual_admin' and amount = 0.00
    cursor.execute("""
    INSERT INTO subscriptions (user_id, plan_name, amount, status, iyzico_sub_id, invoice_no, source, refund_status, refund_date, created_at)
    VALUES (?, ?, 0.00, 'active', 'MANUAL-ADMIN', 'MANUAL-ADMIN', 'manual_admin', 'none', 0, ?)
    """, (user_id, f"MANUAL {new_plan.upper()}", now))
    
    conn.commit()
    conn.close()
    
    log_admin_action(
        admin_id=admin["id"],
        target_user_id=user_id,
        action_type="UPDATE_PLAN",
        details=f"Plan {old_plan} -> {new_plan} (Bitiş: {days} gün sonra) olarak manuel güncellendi."
    )
    
    return jsonify({"status": "success", "message": f"Kullanıcı planı {new_plan.upper()} olarak güncellendi."})

# --- Admin Accounting & Revenue Endpoints ---

@app.route("/api/admin/accounting/summary", methods=["GET"])
def api_admin_accounting_summary():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Total Revenue (ONLY source = 'iyzico' and refund_status != 'refunded')
    cursor.execute("""
    SELECT COALESCE(SUM(amount), 0.0) as total 
    FROM subscriptions 
    WHERE source = 'iyzico' AND (refund_status IS NULL OR refund_status != 'refunded')
    """)
    total_revenue = float(cursor.fetchone()["total"])
    
    # 2. Monthly Revenue
    now = int(time.time())
    month_start = now - (86400 * 30)
    cursor.execute("""
    SELECT COALESCE(SUM(amount), 0.0) as month_total 
    FROM subscriptions 
    WHERE source = 'iyzico' AND (refund_status IS NULL OR refund_status != 'refunded') AND created_at >= ?
    """, (month_start,))
    this_month_revenue = float(cursor.fetchone()["month_total"])
    
    # 3. Yearly Revenue
    year_start = now - (86400 * 365)
    cursor.execute("""
    SELECT COALESCE(SUM(amount), 0.0) as year_total 
    FROM subscriptions 
    WHERE source = 'iyzico' AND (refund_status IS NULL OR refund_status != 'refunded') AND created_at >= ?
    """, (year_start,))
    this_year_revenue = float(cursor.fetchone()["year_total"])
    
    # 4. Active Paid Users Breakdown & MRR
    cursor.execute("SELECT plan, COUNT(*) as cnt FROM users WHERE plan != 'free' AND (account_status IS NULL OR account_status = 'active') GROUP BY plan")
    plan_rows = cursor.fetchall()
    
    breakdown = {"starter": 0, "advanced": 0, "business": 0}
    mrr = 0.0
    plan_monthly_prices = {"starter": 149.0, "advanced": 299.0, "business": 599.0}
    
    for r in plan_rows:
        p = r["plan"]
        cnt = r["cnt"]
        if p in breakdown:
            breakdown[p] = cnt
            mrr += cnt * plan_monthly_prices.get(p, 0.0)
            
    conn.close()
    
    return jsonify({
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "this_year_revenue": this_year_revenue,
        "mrr": mrr,
        "active_paid_subscriptions": breakdown
    })

@app.route("/api/admin/accounting/transactions", methods=["GET"])
def api_admin_accounting_transactions():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    plan_filter = (request.args.get("plan") or "").strip()
    source_filter = (request.args.get("source") or "").strip()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT 
        s.id, s.user_id, s.plan_name, s.amount, s.status, s.iyzico_sub_id, s.invoice_no,
        COALESCE(s.source, 'iyzico') as source, COALESCE(s.refund_status, 'none') as refund_status, COALESCE(s.refund_date, 0) as refund_date, s.created_at,
        u.name as user_name, u.email as user_email
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    txs = []
    for r in rows:
        d = dict(r)
        
        if plan_filter and plan_filter not in d["plan_name"].lower():
            continue
        if source_filter and d["source"] != source_filter:
            continue
            
        amount = float(d["amount"])
        # KDV calculation: 20% VAT in Turkey (Gross amount = Matrah * 1.20)
        matrah = round(amount / 1.20, 2)
        kdv = round(amount - matrah, 2)
        
        d["matrah"] = matrah
        d["kdv"] = kdv
        txs.append(d)
        
    return jsonify({"transactions": txs})

@app.route("/api/admin/accounting/export", methods=["GET"])
def api_admin_accounting_export():
    admin, err_resp = require_admin()
    if err_resp:
        token = request.args.get("token")
        if token:
            payload = decode_token(token)
            if payload:
                user = get_user_by_id(payload["user_id"])
                if user and user.get("is_admin"):
                    admin = user
                    err_resp = None
        if err_resp:
            return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        s.id, s.plan_name, s.amount, s.invoice_no, COALESCE(s.source, 'iyzico') as source, 
        COALESCE(s.refund_status, 'none') as refund_status, s.created_at,
        u.name as user_name, u.email as user_email
    FROM subscriptions s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    # UTF-8 BOM for Excel compatibility in Turkish
    csv_content = "\ufeffİşlem ID,Tarih,Müşteri Adı,E-posta,Plan,Kaynak,Toplam Tutar (TL),Matrah (KDV Haric),KDV %20 (TL),Fatura No,Durum,İade Durumu\n"
    
    for r in rows:
        d = dict(r)
        amount = float(d["amount"])
        matrah = round(amount / 1.20, 2)
        kdv = round(amount - matrah, 2)
        
        dt_str = time.strftime('%d.%m.%Y %H:%M', time.localtime(d['created_at'])) if d['created_at'] else '-'
        source_label = 'İyzico (Gerçek Ödeme)' if d['source'] == 'iyzico' else 'Admin Manuel'
        refund_label = 'İADE EDİLDİ' if d['refund_status'] == 'refunded' else 'Normal'
        
        line = f'"{d["id"]}","{dt_str}","{d["user_name"] or "-"}","{d["user_email"] or "-"}","{d["plan_name"]}","{source_label}","{amount:.2f}","{matrah:.2f}","{kdv:.2f}","{d["invoice_no"] or "-"}","Aktif","{refund_label}"\n'
        csv_content += line
        
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="muhasebe_gelir_raporu.csv"'}
    )

@app.route("/api/admin/accounting/refund/<int:subscription_id>", methods=["POST"])
def api_admin_accounting_refund(subscription_id):
    """
    Note: This endpoint updates internal subscription status to 'refunded' so it is automatically deducted from revenue summary.
    Actual payment refund must be processed separately via the official iyzico merchant dashboard.
    """
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    now = int(time.time())
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id, amount, plan_name FROM subscriptions WHERE id = ?", (subscription_id,))
    sub = cursor.fetchone()
    if not sub:
        conn.close()
        return jsonify({"error": "Abonelik kaydı bulunamadı."}), 404
        
    cursor.execute("UPDATE subscriptions SET refund_status = 'refunded', refund_date = ? WHERE id = ?", (now, subscription_id))
    conn.commit()
    conn.close()
    
    log_admin_action(
        admin_id=admin["id"],
        target_user_id=sub["user_id"],
        action_type="REFUND_RECORD",
        details=f"Abonelik #{subscription_id} ({sub['plan_name']}, {sub['amount']} TL) sistemde iade edildi olarak işaretlendi."
    )
    
    return jsonify({"status": "success", "message": "Abonelik iade edildi olarak işaretlendi ve muhasebe gelirinden düşüldü."})

@app.route("/api/admin/users/<int:user_id>/suspend", methods=["POST"])
def api_admin_suspend_user(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    if admin["id"] == user_id:
        return jsonify({"error": "Kendi admin hesabınızı askıya alamazsınız."}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET account_status = 'suspended' WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    log_admin_action(admin["id"], user_id, "SUSPEND_USER", "Hesap askıya alındı.")
    return jsonify({"status": "success", "message": "Kullanıcı hesabı askıya alındı."})

@app.route("/api/admin/users/<int:user_id>/activate", methods=["POST"])
def api_admin_activate_user(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET account_status = 'active' WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    log_admin_action(admin["id"], user_id, "ACTIVATE_USER", "Hesap tekrar aktif edildi.")
    return jsonify({"status": "success", "message": "Kullanıcı hesabı tekrar aktif edildi."})

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def api_admin_delete_user(user_id):
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    if admin["id"] == user_id:
        return jsonify({"error": "Kendi admin hesabınızı silemezsiniz."}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
    target_user = cursor.fetchone()
    if not target_user:
        conn.close()
        return jsonify({"error": "Kullanıcı bulunamadı."}), 404
        
    target_email = target_user["email"]
    
    # Delete user and cascading data
    cursor.execute("DELETE FROM scan_logs WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user_id,))
    cursor.execute("DELETE FROM vcard_pages WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user_id,))
    cursor.execute("DELETE FROM menu_pages WHERE qr_id IN (SELECT id FROM qr_codes WHERE user_id = ?)", (user_id,))
    cursor.execute("DELETE FROM qr_codes WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM subscriptions WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    log_admin_action(admin["id"], None, "DELETE_USER", f"Kullanıcı ({target_email}, ID: {user_id}) ve tüm verileri kalıcı olarak silindi.")
    return jsonify({"status": "success", "message": "Kullanıcı ve tüm verileri kalıcı olarak silindi."})

@app.route("/api/admin/audit-logs", methods=["GET"])
def api_admin_audit_logs():
    admin, err_resp = require_admin()
    if err_resp:
        return err_resp
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT 
        a.id, a.admin_id, a.target_user_id, a.action_type, a.details, a.created_at,
        u_admin.name as admin_name, u_admin.email as admin_email,
        u_target.name as target_name, u_target.email as target_email
    FROM admin_actions a
    LEFT JOIN users u_admin ON a.admin_id = u_admin.id
    LEFT JOIN users u_target ON a.target_user_id = u_target.id
    ORDER BY a.created_at DESC
    LIMIT 100
    """)
    logs = cursor.fetchall()
    conn.close()
    
    return jsonify({"audit_logs": logs})

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Sunucu hatası oluştu. Lütfen tekrar deneyin."}), 500

@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "İstenen kaynak bulunamadı."}), 404
    elif request.path.startswith("/static/") or request.path.startswith("/p/pdf/") or request.path.startswith("/p/") or request.path.startswith("/r/"):
        return "<h3>⚠️ Sayfa veya İçerik Bulunamadı</h3><p>İstediğiniz sayfa veya QR kod mevcut değil.</p>", 404
    return render_template("index.html"), 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    debug_mode = os.environ.get("FLASK_ENV") == "development" or os.environ.get("FLASK_DEBUG") == "1"
    print(f"🚀 Dijitalgru QR SaaS Sunucusu Başlatılıyor: http://localhost:{port} (debug={debug_mode})")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
