import os

def scan_dir_recursive(path):
    files_found = []
    try:
        entries = os.scandir(path)
    except:
        return []
    for entry in entries:
        try:
            if entry.is_file():
                if "logo" in entry.name.lower():
                    files_found.append((entry.path, entry.stat().st_size))
            elif entry.is_dir():
                if entry.name in ('.git', 'node_modules'):
                    continue
                files_found.extend(scan_dir_recursive(entry.path))
        except:
            pass
    return files_found

if __name__ == "__main__":
    workspace = "/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı"
    print(f"Scanning {workspace} recursively...")
    logos = scan_dir_recursive(workspace)
    for path, size in logos:
        print(f"Logo found: {path} ({size} bytes)")
