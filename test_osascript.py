import subprocess

try:
    cmd = """osascript -e 'tell application "Terminal" to do script "cp /Users/egemengunes/.gemini/antigravity/brain/9de16cff-3547-4dbc-bd1e-2c3fae9a9d31/blog_digital_agency_1781067682292.png /Users/egemengunes/Desktop/Antigravity/Projeler/DijitalGru/blog-dijital-ajans.png"'"""
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
    print("Return code:", res.returncode)
except Exception as e:
    print("Exception:", e)


