import os
import glob

base_dir = "/Users/egemengunes/.gemini/antigravity"
print(f"Base dir exists: {os.path.exists(base_dir)}")
if os.path.exists(base_dir):
    files = glob.glob(os.path.join(base_dir, "**/*blog_digital_agency*"), recursive=True)
    print("Found files:", files)
    for f in files:
        print(f"File: {f}, size: {os.path.getsize(f)}")


