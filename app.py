from flask import Flask, render_template, request, jsonify, redirect, send_file, make_response
import time
import json
import uuid
import os
import io

from db import init_db, get_db
from auth import register_user, login_user, decode_token, get_user_by_id
from qr_engine import generate_qr_image
from payments import process_subscription_purchase, PLANS

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = os.environ.get("JWT_SECRET", "dijitalgru_qr_secret_key_2026")

# Ensure DB initialized on startup
init_db()

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

# Initialize Database on Startup
try:
    init_db()
except Exception as e:
    print(f"⚠️ DB initialization note: {e}")

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

@app.route("/r/<short_code>")
def redirect_qr(short_code):
    """
    Dynamic QR short URL redirect engine with analytics logging.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM qr_codes WHERE short_code = ?", (short_code,))
    qr_row = cursor.fetchone()
    
    if not qr_row:
        conn.close()
        return "QR Kod Bulunamadı", 404
        
    qr = dict(qr_row)
    
    if qr["status"] == "paused":
        conn.close()
        return render_template("index.html", error="Bu QR kod pasife alınmıştır.")
        
    # Log scan analytics
    user_agent = request.headers.get("User-Agent", "Unknown")
    ip_addr = request.remote_addr or "127.0.0.1"
    now = int(time.time())
    
    device_type = "Mobile" if ("Mobile" in user_agent or "Android" in user_agent or "iPhone" in user_agent) else "Desktop"
    browser = "Chrome" if "Chrome" in user_agent else ("Safari" if "Safari" in user_agent else "Other")
    
    cursor.execute("""
    INSERT INTO scan_logs (qr_id, scanned_at, ip_address, user_agent, device_type, browser, country, city)
    VALUES (?, ?, ?, ?, ?, ?, 'Türkiye', 'İstanbul')
    """, (qr["id"], now, ip_addr, user_agent, device_type, browser))
    
    cursor.execute("UPDATE qr_codes SET scans_count = scans_count + 1 WHERE id = ?", (qr["id"],))
    conn.commit()
    conn.close()
    
    # Handle dynamic redirect or micro-page
    target = qr["target_url"]
    if target.startswith("micropage://vcard"):
        return redirect(f"/p/vcard/{qr['id']}")
    elif target.startswith("micropage://menu"):
        return redirect(f"/p/menu/{qr['id']}")
    elif not (target.startswith("http://") or target.startswith("https://")):
        target = "https://" + target
        
    return redirect(target)

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
    if menu_data.get("categories"):
        try:
            menu_data["categories"] = json.loads(menu_data["categories"])
        except Exception:
            menu_data["categories"] = []
    else:
        menu_data["categories"] = []
        
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
        
    upload_dir = os.path.join(app.static_folder, "uploads", "pdfs")
    os.makedirs(upload_dir, exist_ok=True)
    
    filename = f"menu_{uuid.uuid4().hex[:10]}.pdf"
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)
    
    pdf_url = f"/static/uploads/pdfs/{filename}"
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
        cursor.execute("UPDATE qr_codes SET target_url = ? WHERE id = ?", (f"micropage://vcard/{qr_id}", qr_id))
        
    elif qr_type == "menu" and menu_payload:
        cursor.execute("""
        INSERT INTO menu_pages (qr_id, title, description, cover_url, pdf_url, categories)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            qr_id,
            menu_payload.get("title"),
            menu_payload.get("description"),
            menu_payload.get("cover_url"),
            menu_payload.get("pdf_url"),
            json.dumps(menu_payload.get("categories", []))
        ))
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
def api_qr_list():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Yetkisiz erişim"}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM qr_codes WHERE user_id = ? ORDER BY created_at DESC", (user["id"],))
    rows = cursor.fetchall()
    conn.close()
    
    app_url = request.host_url.rstrip("/")
    qrs = []
    for r in rows:
        d = dict(r)
        d["short_url"] = f"{app_url}/r/{d['short_code']}"
        try:
            d["custom_settings"] = json.loads(d["custom_settings"])
        except Exception:
            d["custom_settings"] = {}
        d["qr_image"] = generate_qr_image(d["short_url"], d["custom_settings"], format="base64")
        qrs.append(d)
        
    return jsonify({"qr_codes": qrs})

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
    
@app.route("/api/qr/list", methods=["GET"])
def api_qr_list():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT id, short_code, title, type, target_url, is_dynamic, custom_settings, status, scans_count, created_at, updated_at
    FROM qr_codes 
    WHERE user_id = ? 
    ORDER BY created_at DESC
    """, (user["id"],))
    rows = cursor.fetchall()
    
    qr_codes = []
    app_url = request.host_url.rstrip("/")
    for r in rows:
        item = dict(r)
        short_code = item.get("short_code", "")
        item["short_url"] = f"{app_url}/r/{short_code}"
        item["scan_count"] = item.get("scans_count", 0)
        
        try:
            settings = json.loads(item["custom_settings"]) if item.get("custom_settings") else {}
        except Exception:
            settings = {}
            
        item["settings"] = settings
        item["qr_image"] = generate_qr_image(item["short_url"], settings, format="base64")
        qr_codes.append(item)
        
    # Stats
    cursor.execute("SELECT COUNT(*) as total_qr, SUM(scans_count) as total_scans FROM qr_codes WHERE user_id = ?", (user["id"],))
    tot_row = cursor.fetchone()
    total_qr = (tot_row["total_qr"] if (tot_row and "total_qr" in tot_row) else 0) if tot_row else 0
    total_scans = (tot_row["total_scans"] if (tot_row and "total_scans" in tot_row) else 0) if tot_row else 0
    
    conn.close()
    
    return jsonify({
        "status": "success",
        "qr_codes": qr_codes,
        "stats": {
            "total_qr": total_qr or len(qr_codes),
            "total_scans": total_scans or 0,
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
        "dynamic_limit": user["dynamic_qr_limit"],
        "plan": user["plan"],
        "devices": devices
    })

@app.route("/api/subscriptions/plans", methods=["GET"])
def api_get_plans():
    return jsonify({"plans": PLANS})

@app.route("/api/iyzico/checkout-form", methods=["POST"])
def api_iyzico_checkout():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    data = request.json or {}
    plan_key = data.get("plan_key", "starter")
    cycle = data.get("cycle", "monthly")
    callback_url = f"{request.host_url.rstrip('/')}/api/iyzico/callback"
    
    from payments import create_checkout_form
    res_json, err = create_checkout_form(user, plan_key, cycle, callback_url)
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify(res_json)

@app.route("/api/subscriptions/purchase", methods=["POST"])
def api_purchase_plan():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Lütfen önce giriş yapın."}), 401
        
    data = request.json or {}
    plan_key = data.get("plan_key")
    cycle = data.get("cycle", "monthly")
    card_holder = data.get("card_holder", "Dijitalgru Müşteri")
    card_number = data.get("card_number", "4111111111111111")
    
    res, err = process_subscription_purchase(user["id"], plan_key, cycle, card_holder, card_number)
    if err:
        return jsonify({"error": err}), 400
        
    return jsonify(res)

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Sunucu hatası oluştu. Lütfen tekrar deneyin."}), 500

@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "İstenen kaynak bulunamadı."}), 404
    return render_template("index.html"), 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(f"🚀 Dijitalgru QR SaaS Sunucusu Başlatılıyor: http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
