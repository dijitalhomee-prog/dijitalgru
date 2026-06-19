import re

def clean_extracted_text():
    input_file = "sinopia_extracted.txt"
    output_file = "sinopia_clean.txt"
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    clean_lines = []
    for line in lines:
        line = line.strip()
        # Filter: must contain Turkish/English letters, at least 4 chars long
        # Exclude lines that are mostly symbols/spaces/numbers
        letters = re.findall(r'[a-zA-ZğüşıöçĞÜŞİÖÇ]', line)
        if len(letters) > 10: # More than 10 letters
            # Check if it has coordinate patterns or raw PDF commands like Q*, [C, etc.
            if not re.search(r'^[A-Z0-9\s#$!%&\'()*+,\-./:;<=>?@\[\\\]^_`{|}~]+$', line):
                clean_lines.append(line)
            elif any(c in line for c in ["Sinopia", "Mantı", "Web", "Tasarım", "Yazılım", "Proje", "detay"]):
                clean_lines.append(line)
                
    with open(output_file, 'w', encoding='utf-8') as f:
        for line in clean_lines:
            f.write(line + "\n")

if __name__ == "__main__":
    clean_extracted_text()
