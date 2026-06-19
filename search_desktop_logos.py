import os

def scan_dir_recursive(path):
    recent_files = []
    try:
        entries = os.scandir(path)
    except:
        return []
    for entry in entries:
        try:
            if entry.is_file():
                if "logo" in entry.name.lower():
                    recent_files.append((entry.path, entry.stat().st_size))
            elif entry.is_dir():
                if entry.name in ('.git', 'node_modules'):
                    continue
                recent_files.extend(scan_dir_recursive(entry.path))
        except:
            pass
    return recent_files

if __name__ == "__main__":
    desktop = "/Users/egemengunes/Desktop"
    print(f"Scanning {desktop} recursively...")
    logos = scan_dir_recursive(desktop)
    for path, size in logos:
        print(f"Logo found: {path} ({size} bytes)")
