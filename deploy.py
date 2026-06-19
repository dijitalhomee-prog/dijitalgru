import os
import json
import urllib.request
import sys

# Load RAILWAY_TOKEN from master.env
RAILWAY_TOKEN = None
env_path = "/Users/egemengunes/Desktop/Antigravity/_knowledge/credentials/master.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith("RAILWAY_TOKEN="):
                RAILWAY_TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not RAILWAY_TOKEN:
    RAILWAY_TOKEN = os.environ.get("RAILWAY_TOKEN")

if not RAILWAY_TOKEN:
    print("❌ HATA: master.env veya environment variables içinde RAILWAY_TOKEN bulunamadı.")
    sys.exit(1)

print(f"🔑 Kullanılan Token (Maskeli): {RAILWAY_TOKEN[:4]}...{RAILWAY_TOKEN[-4:] if len(RAILWAY_TOKEN) > 4 else ''}")

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {RAILWAY_TOKEN}",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
URL = "https://backboard.railway.com/graphql/v2"
REPO = "dijitalhomee-prog/dijitalgru"  # Varsayılan GitHub reposu

def run_query(query):
    data = json.dumps({"query": query}).encode('utf-8')
    req = urllib.request.Request(URL, data=data, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print("❌ HATA:", e)
        if hasattr(e, 'read'):
            try:
                print("Sunucu Yanıtı:", e.read().decode())
            except:
                pass
        return {}

# 1. Workspace Bulma
print("\n🔍 1. Railway Workspaceleri sorgulanıyor...")
ws_res = run_query("query { me { workspaces { id name } } }")
workspaces = ws_res.get('data', {}).get('me', {}).get('workspaces', [])

target_workspace_id = None
for ws in workspaces:
    if "dijitalhomee-prog" in ws['name'].lower() or ws['name'].lower() == "hobby" or not target_workspace_id:
        target_workspace_id = ws['id']
        target_workspace_name = ws['name']
        if "dijitalhomee-prog" in ws['name'].lower():
            break

if not target_workspace_id:
    print("❌ HATA: Railway üzerinde uygun bir Workspace bulunamadı.")
    sys.exit(1)

print(f"✅ Seçilen Workspace: {target_workspace_name} (ID: {target_workspace_id})")

# 2. Proje Kontrolü / Oluşturma
print("\n🔍 2. Proje kontrolü yapılıyor...")
p_res = run_query(f'query {{ projects(workspaceId: "{target_workspace_id}") {{ edges {{ node {{ id name environments {{ edges {{ node {{ id }} }} }} }} }} }} }}')
projects = p_res.get('data', {}).get('projects', {}).get('edges', [])

project_id = None
env_id = None

for edge in projects:
    p = edge['node']
    if "dijital" in p['name'].lower() or "gru" in p['name'].lower():
        project_id = p['id']
        project_name = p['name']
        env_edges = p.get('environments', {}).get('edges', [])
        if env_edges:
            env_id = env_edges[0]['node']['id']
        print(f"🔄 Mevcut Proje Bulundu: '{project_name}' (ID: {project_id})")
        break

if not project_id:
    print("🆕 Proje bulunamadı, yeni bir Railway projesi oluşturuluyor...")
    create_mutation = f'mutation {{ projectCreate(input: {{ name: "Dijital Gru", description: "Dijital Gru Web Sitesi", workspaceId: "{target_workspace_id}" }}) {{ id environments {{ edges {{ node {{ id }} }} }} }} }}'
    c_res = run_query(create_mutation)
    if 'errors' in c_res or not c_res.get('data'):
        print("❌ Proje oluşturulurken hata:", c_res)
        sys.exit(1)
    project_id = c_res['data']['projectCreate']['id']
    env_id = c_res['data']['projectCreate']['environments']['edges'][0]['node']['id']
    print(f"✅ Yeni Proje Başarıyla Oluşturuldu. ID: {project_id}")

# 3. Servis Oluşturma (GitHub bağlantısı)
print("\n🔍 3. Servis kontrolü ve oluşturma...")
s_res = run_query(f'query {{ project(id: "{project_id}") {{ services {{ edges {{ node {{ id name }} }} }} }} }}')
services = s_res.get('data', {}).get('project', {}).get('services', {}).get('edges', [])

service_id = None
for edge in services:
    s = edge['node']
    if s['name'].lower() == "web" or "dijital" in s['name'].lower():
        service_id = s['id']
        print(f"🔄 Mevcut Servis Bulundu: '{s['name']}' (ID: {service_id})")
        break

if not service_id:
    print(f"🆕 Servis oluşturuluyor (GitHub deposuna bağlanıyor: {REPO})...")
    q_service = f'mutation {{ serviceCreate(input: {{ projectId: "{project_id}", name: "web", source: {{ repo: "{REPO}" }}, branch: "main" }}) {{ id }} }}'
    res_s = run_query(q_service)
    if 'errors' in res_s or not res_s.get('data'):
        print("\n⚠️ Servis oluşturulamadı. Muhtemelen GitHub reponuz henüz oluşturulmadı veya adı farklı.")
        print("Lütfen önce GitHub'da 'dijitalgru' adında bir depo (repository) açıp dosyaları push ettiğinizden emin olun.")
        print("Hata Detayı:", res_s)
        sys.exit(1)
    service_id = res_s['data']['serviceCreate']['id']
    print(f"✅ Servis Oluşturuldu. ID: {service_id}")

# 4. Alan Adı Yönlendirme (Custom Domain)
print("\n🔍 4. Özel Alan Adı (Custom Domain) Tanımlanıyor...")
q_domain1 = f'mutation {{ customDomainCreate(input: {{ projectId: "{project_id}", environmentId: "{env_id}", serviceId: "{service_id}", domain: "dijitalgru.com" }}) {{ id domain }} }}'
res_d1 = run_query(q_domain1)
if 'errors' in res_d1:
    print("   - dijitalgru.com ekleme uyarısı:", res_d1['errors'][0].get('message'))
else:
    print("   ✅ dijitalgru.com başarıyla eklendi.")

q_domain2 = f'mutation {{ customDomainCreate(input: {{ projectId: "{project_id}", environmentId: "{env_id}", serviceId: "{service_id}", domain: "www.dijitalgru.com" }}) {{ id domain }} }}'
res_d2 = run_query(q_domain2)
if 'errors' in res_d2:
    print("   - www.dijitalgru.com ekleme uyarısı:", res_d2['errors'][0].get('message'))
else:
    print("   ✅ www.dijitalgru.com başarıyla eklendi.")

print("\n🚀 --- KURULUM TAMAMLANDI ---")
print(f"Proje ID: {project_id}")
print(f"Servis ID: {service_id}")
print(f"Ortam (Env) ID: {env_id}")
print("\n👉 Sonraki Adım: Eğer yapmadıysanız alan adınızın DNS (CNAME ve A) kayıtlarını Railway yönlendirmelerine göre güncelleyin.")
