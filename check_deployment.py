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
        print("❌ HATA:", e)
        return {}

# 1. Query workspaces to find team/org spaces
workspace_query = """
query {
  me {
    workspaces {
      id
      name
    }
  }
}
"""

print("🔍 Railway Workspaceleri sorgulanıyor...")
w_res = run_query(workspace_query)

workspaces = []
if w_res and 'data' in w_res and w_res['data'].get('me'):
    workspaces = w_res['data']['me']['workspaces']

print(f"Found {len(workspaces)} workspaces.")

# 2. Query projects for each workspace
for ws in workspaces:
    print(f"\n📂 Workspace: {ws['name']} (ID: {ws['id']})")
    
    project_query = f"""
    query {{
      projects(workspaceId: "{ws['id']}") {{
        edges {{
          node {{
            id
            name
            description
            services {{
              edges {{
                node {{
                  id
                  name
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    """
    
    p_res = run_query(project_query)
    if p_res and 'data' in p_res and p_res['data'].get('projects'):
        edges = p_res['data']['projects']['edges']
        if not edges:
            print("  (Bu workspace altında proje bulunmuyor)")
        for edge in edges:
            p = edge['node']
            print(f"  📌 Proje: {p['name']} (ID: {p['id']})")
            services = p.get('services', {}).get('edges', [])
            for s_edge in services:
                s = s_edge['node']
                print(f"     - Servis: {s['name']} (ID: {s['id']})")
    else:
        print("  ❌ Projeler listelenirken hata oluştu.")
