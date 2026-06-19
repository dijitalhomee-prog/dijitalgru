import os

path = "/Users/egemengunes/.gemini"
print(f"Exists .gemini: {os.path.exists(path)}")
if os.path.exists(path):
    print(f"Listdir: {os.listdir(path)}")
    sub = os.path.join(path, "antigravity")
    print(f"Exists antigravity: {os.path.exists(sub)}")
    if os.path.exists(sub):
        print(f"Antigravity contents: {os.listdir(sub)}")
