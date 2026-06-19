import struct

path = "/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo.png"
with open(path, "rb") as f:
    sig = f.read(8)
    is_png = (sig == b'\x89PNG\r\n\x1a\n')
    print("PNG Signature: " + str(is_png))
    
    # Read IHDR chunk
    length_bytes = f.read(4)
    chunk_type = f.read(4)
    if chunk_type == b"IHDR":
        length = struct.unpack(">I", length_bytes)[0]
        data = f.read(length)
        crc = f.read(4)
        
        width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack(">IIBBBBB", data)
        print(f"Width: {width}")
        print(f"Height: {height}")
        print(f"Bit Depth: {bit_depth}")
        print(f"Color Type: {color_type}")
        print(f"Compression: {compression}")
        print(f"Filter Method: {filter_method}")
        print(f"Interlace: {interlace}")
