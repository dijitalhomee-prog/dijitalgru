import os
import time

def scan_dir_recursive(path, max_depth=5, current_depth=0):
    if current_depth > max_depth:
        return []
        
    recent_files = []
    now = time.time()
    
    try:
        entries = os.scandir(path)
    except PermissionError:
        return []
    except Exception:
        return []
        
    for entry in entries:
        try:
            if entry.is_file():
                if entry.name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    # Check if modified in the last 15 minutes
                    mtime = entry.stat().st_mtime
                    if now - mtime < 900:  # 15 minutes
                        recent_files.append((entry.path, mtime))
            elif entry.is_dir():
                # Don't recurse into giant or system folders to save time
                if entry.name in ('.git', 'node_modules', 'Library', 'Applications', 'System', 'Pictures', 'Music', 'Movies'):
                    continue
                recent_files.extend(scan_dir_recursive(entry.path, max_depth, current_depth + 1))
        except Exception:
            pass
            
    return recent_files

if __name__ == "__main__":
    search_paths = ["/Users/egemengunes", "/var/folders", "/tmp"]
    recent = []
    for path in search_paths:
        print(f"Scanning {path} recursively...")
        recent.extend(scan_dir_recursive(path, max_depth=6))
    recent.sort(key=lambda x: x[1], reverse=True)
    
    print("\nRecent files found:")
    for path, mtime in recent[:30]:
        local_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
        print(f"{local_time} - {path} (size: {os.path.getsize(path)})")
