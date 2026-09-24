import subprocess

try:
    cmd = """osascript -e 'tell application "Terminal" to activate' -e 'delay 1' -e 'tell application "Terminal" to do script "echo hello"'"""
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)
    print("Return code:", res.returncode)
except Exception as e:
    print("Exception:", e)
