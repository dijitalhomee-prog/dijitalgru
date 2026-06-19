import os
import time

def scan_folder(folder_path):
    now = time.time()
    recent_files = []
    
    # Try walking the folder, ignore errors
    try:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    full_path = os.path.join(root, file)
                    try:
                        mtime = os.path.getmtime(full_path)
                        # Check if modified in the last 20 minutes (1200 seconds)
                        if now - mtime < 1200:
                            recent_files.append((full_path, mtime))
                    except:
                        pass
    except:
        pass
    return recent_files

if __name__ == "__main__":
    folders = [
        "/tmp",
        "/Users/egemengunes/Downloads",
        os.path.expanduser("~")
    ]
    # Also search macOS temp folder /var/folders if we can find it
    mac_temp = os.environ.get("TMPDIR")
    if mac_temp:
        folders.append(mac_temp)
        
    all_recent = []
    for f in folders:
        print(f"Scanning {f}...")
        all_recent.extend(scan_folder(f))
        
    # Sort by modification time
    all_recent.sort(key=lambda x: x[1], reverse=True)
    
    print("\nRecent files found:")
    for path, mtime in all_recent[:15]:
        local_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
        print(f"{local_time} - {path} (size: {os.path.getsize(path)})")
