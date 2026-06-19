import os
import time

downloads_dir = "/Users/egemengunes/Downloads"
print(f"Downloads exists: {os.path.exists(downloads_dir)}")
if os.path.exists(downloads_dir):
    try:
        files = os.listdir(downloads_dir)
        print(f"Total files in Downloads: {len(files)}")
        # Check files modified in the last 2 hours
        now = time.time()
        for f in files:
            full_path = os.path.join(downloads_dir, f)
            if os.path.isfile(full_path):
                mtime = os.path.getmtime(full_path)
                if now - mtime < 7200:  # 2 hours
                    print(f"Recent Download: {f} (size: {os.path.getsize(full_path)})")
    except Exception as e:
        print(f"Error reading Downloads: {e}")
