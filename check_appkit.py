import sys
try:
    import AppKit
    print("AppKit is available!")
except Exception as e:
    print(f"AppKit is NOT available: {e}")
