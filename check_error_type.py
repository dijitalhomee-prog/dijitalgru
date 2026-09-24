import os

paths = [
    "/Users/egemengunes/.gemini",
    "/Users/egemengunes/.gemini/antigravity",
    "/Users/egemengunes/.gemini/antigravity/brain",
    "/Users/egemengunes/.gemini/antigravity/brain/3b4c583a-8438-4b25-98d7-deb8c78e3719"
]

for p in paths:
    try:
        os.listdir(p)
        print(f"{p}: Success!")
    except Exception as e:
        print(f"{p}: Raised {type(e).__name__} - {e}")
