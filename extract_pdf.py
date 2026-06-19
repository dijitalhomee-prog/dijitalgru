import os
import re
import zlib
import sys

def decode_pdf_hex(hex_str):
    # Strip whitespace
    hex_str = re.sub(r'\s+', '', hex_str)
    # Hex strings must have even length
    if len(hex_str) % 2 != 0:
        hex_str += '0'
    try:
        b = bytes.fromhex(hex_str)
        # Try UTF-16BE first (common in Illustrator PDFs)
        try:
            return b.decode('utf-16-be')
        except UnicodeDecodeError:
            pass
        # Try UTF-8 or latin-1
        try:
            return b.decode('utf-8')
        except UnicodeDecodeError:
            return b.decode('latin-1', errors='ignore')
    except Exception:
        return ""

def extract_pdf_rich(pdf_path):
    print(f"Reading PDF: {pdf_path}")
    with open(pdf_path, 'rb') as f:
        content = f.read()

    stream_matches = list(re.finditer(b'stream[\r\n]+', content))
    text_chunks = []
    
    for match in stream_matches:
        start = match.end()
        end = content.find(b'endstream', start)
        if end == -1:
            continue
        
        stream_data = content[start:end]
        if stream_data.endswith(b'\r\n'):
            stream_data = stream_data[:-2]
        elif stream_data.endswith(b'\n') or stream_data.endswith(b'\r'):
            stream_data = stream_data[:-1]

        try:
            decompressed = zlib.decompress(stream_data)
            try:
                dec_str = decompressed.decode('utf-8')
            except UnicodeDecodeError:
                dec_str = decompressed.decode('latin-1', errors='ignore')
            
            # Find hex patterns <0045006b...>
            hex_matches = re.findall(r'<([0-9a-fA-F\s]+)>', dec_str)
            for hm in hex_matches:
                decoded = decode_pdf_hex(hm)
                if decoded and len(decoded.strip()) > 0:
                    # Filter out obvious binary non-text
                    if all(ord(c) < 128 or ord(c) in [192, 193, 194, 195, 224, 225, 226, 227, 252, 246, 231, 351, 287, 305, 220, 214, 199, 350, 286, 304, 352, 353, 286, 287, 304, 305] for c in decoded):
                        text_chunks.append(decoded.strip())
            
            # Find normal parenthesis patterns
            paren_matches = re.findall(r'\(([^)]+)\)', dec_str)
            for pm in paren_matches:
                clean = pm.replace('\\(', '(').replace('\\)', ')')
                if len(clean) > 1:
                    # If it's pure ascii or turkish characters
                    if all(ord(c) < 128 or ord(c) in [192, 193, 194, 195, 224, 225, 226, 227, 252, 246, 231, 351, 287, 305, 220, 214, 199, 350, 286, 304, 352, 353, 286, 287, 304, 305] for c in clean):
                        text_chunks.append(clean.strip())
        except zlib.error:
            continue
            
    return text_chunks

if __name__ == "__main__":
    pdf_file = sys.argv[1] if len(sys.argv) > 1 else "/Users/egemengunes/Desktop/Antigravity/Projeler/DijitalGru/Tüm Markalar/Ekmek_Arası_KurumsalKimlik.pdf"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "/Users/egemengunes/Desktop/Antigravity/Projeler/DijitalGru/ekmek_arasi_text.txt"
    
    if not os.path.exists(pdf_file):
        print(f"Error: {pdf_file} does not exist.")
        sys.exit(1)
        
    chunks = extract_pdf_rich(pdf_file)
    # Remove duplicates and preserve order
    seen = set()
    unique_chunks = []
    for c in chunks:
        # Ignore very short or pure numeric chunks
        if len(c) > 2 and not c.isdigit() and c not in seen:
            seen.add(c)
            unique_chunks.append(c)
            
    if unique_chunks:
        with open(out_path, "w", encoding="utf-8") as f:
            for chunk in unique_chunks:
                f.write(chunk + "\n")
        print(f"Success! Extracted {len(unique_chunks)} unique rich text chunks to {out_path}")
    else:
        print("Failed to extract any text.")
