path = "/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo.png"
with open(path, "rb") as f:
    header = f.read(16)
    print("Header bytes (hex):", header.hex())
    print("Header bytes (raw):", header)
