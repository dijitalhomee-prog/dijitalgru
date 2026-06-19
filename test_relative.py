import os

path = "../../../../.gemini"
print(f"Relative path exists: {os.path.exists(path)}")
if os.path.exists(path):
    print("Contents:", os.listdir(path))
