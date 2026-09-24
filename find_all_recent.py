import os
import time

def scan_dir_recursive(path, max_depth=5, current_depth=0):
    if current_depth > max_depth:
        return []
    recent_files = []
    now = time.time()
    try:
        entries = os.scandir(path)
    except:
        return []
    for entry in entries:
        try:
            if entry.is_file():
                mtime = entry.stat().st_mtime
                if now - mtime < 900:  # 15 mins
                    recent_files.append((entry.path, mtime, entry.stat().st_size))
            elif entry.is_dir():
                if entry.name in ('.git', 'node_modules', 'Library', 'Applications', 'System'):
                    continue
                recent_files.extend(scan_dir_recursive(entry.path, max_depth, current_depth + 1))
        except:
            pass
    return recent_files

if __name__ == "__main__":
    mac_temp = os.environ.get("TMPDIR", "/tmp")
    print(f"Scanning {mac_temp}...")
    recent = scan_dir_recursive(mac_temp)
    recent.sort(key=lambda x: x[1], reverse=True)
    for path, mtime, size in recent[:30]:
        t = time.strftime('%H:%M:%S', time.localtime(mtime))
        print(f"{t} - {path} ({size} bytes)")
