import os
import glob
import shutil

def main():
    search_dir = "/Users/egemengunes/.gemini/antigravity"
    # Find all png, jpg, jpeg files
    extensions = ["*.png", "*.jpg", "*.jpeg", "*.webp"]
    files = []
    for ext in extensions:
        files.extend(glob.glob(os.path.join(search_dir, "**", ext), recursive=True))
        
    if not files:
        print("No temp files found.")
        return
        
    # Sort by modification time
    files.sort(key=os.path.getmtime, reverse=True)
    latest_file = files[0]
    print(f"LATEST_FILE_PATH:{latest_file}")
    
    # Copy to images folder
    dest = "/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo_raw.png"
    shutil.copy2(latest_file, dest)
    print(f"Copied to {dest}")

if __name__ == "__main__":
    main()
