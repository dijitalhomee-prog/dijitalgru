import shutil
import os

src = "/Users/egemengunes/.gemini/antigravity/brain/3b4c583a-8438-4b25-98d7-deb8c78e3719/.tempmediaStorage/media_3b4c583a-8438-4b25-98d7-deb8c78e3719_1780922177128.png"
dest = "/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo_raw.png"

print(f"Source exists: {os.path.exists(src)}")
if os.path.exists(src):
    shutil.copy2(src, dest)
    print("Successfully copied logo_raw.png!")
