import os

def walk_dir(path):
    for root, dirs, files in os.walk(path):
        for file in files:
            full_path = os.path.join(root, file)
            # Filter for image files
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                print(f"Image: {full_path} (size: {os.path.getsize(full_path)})")

if __name__ == "__main__":
    walk_dir("/Users/egemengunes/.gemini/antigravity")
