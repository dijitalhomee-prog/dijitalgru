import os

home = "/Users/egemengunes"
for name in os.listdir(home):
    if "gemini" in name.lower():
        print(f"Found gemini folder: {name}")
        path = os.path.join(home, name)
        print(f"Contents: {os.listdir(path)}")

