import subprocess
import time
import os

try:
    # Run the cat command in Terminal.app and redirect to a file in the workspace
    cmd = """osascript -e 'tell application "Terminal"
        do script "cp \\"/Users/egemengunes/.gemini/antigravity/conversations/9de16cff-3547-4dbc-bd1e-2c3fae9a9d31.pb\\" \\"/Users/egemengunes/Desktop/Antigravity/Projeler/DijitalGru/conv.pb\\"; exit"
    end tell'"""
    
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
    
    # Wait for the file to be written
    time.sleep(2)
    print("File exists:", os.path.exists("/Users/egemengunes/Desktop/Antigravity/Projeler/DijitalGru/conv.pb"))
except Exception as e:
    print("Error:", e)
