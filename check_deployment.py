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

def run_query(query):
    data = json.dumps({"query": query}).encode('utf-8')
    req = urllib.request.Request(URL, data=data, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print("❌ HATA: Railway API'sine bağlanırken bir sorun oluştu.")
        print("Detay:", e)
        if hasattr(e, 'read'):
            try:
                print("Sunucu Yanıtı:", e.read().decode())
            except:
                pass
        return {}

# Query to list all projects, environments, services, and custom domains
query = """
query {
  projects {
    edges {
      node {
        id
        name
        description
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
        services {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  }
}
"""

print("🔍 Railway üzerindeki projeleriniz taranıyor...")
res = run_query(query)

if not res or 'data' not in res or not res['data'].get('projects'):
    print("❌ Railway üzerinde herhangi bir proje bulunamadı veya yetkilendirme hatası.")
    sys.exit(1)

projects = res['data']['projects']['edges']
found_project = None

for p_edge in projects:
    p = p_edge['node']
    p_name = p['name'].lower()
    p_id = p['id']
    
    # Check if project name contains "dijital" or "gru"
    is_match = "dijital" in p_name or "gru" in p_name
    
    if is_match:
        found_project = p
        break

if found_project:
    print(f"\n🎉 EŞLEŞEN PROJE BULUNDU!")
    print(f"📌 Proje Adı: {found_project['name']}")
    print(f"🆔 Proje ID: {found_project['id']}")
    
    env_edges = found_project.get('environments', {}).get('edges', [])
    env_id = env_edges[0]['node']['id'] if env_edges else None
    print(f"🌐 Ortam (Environment) ID: {env_id}")
    
    services = found_project.get('services', {}).get('edges', [])
    print("\n🛠️ Servisler:")
    for s_edge in services:
        s = s_edge['node']
        print(f" - Servis Adı: {s['name']} (ID: {s['id']})")
else:
    print("\n⚠️ Dijital Gru ile ilgili bir Railway projesi bulunamadı.")
    print("Mevcut projeleriniz:")
    for p_edge in projects:
        p = p_edge['node']
        print(f" - {p['name']} (ID: {p['id']})")
