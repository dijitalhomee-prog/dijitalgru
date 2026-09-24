import os
import glob
from PIL import Image

def find_latest_uploaded_image():
    # Search in .gemini directory
    search_dir = "/Users/egemengunes/.gemini/antigravity"
    files = glob.glob(os.path.join(search_dir, "**", "*.png"), recursive=True) + \
            glob.glob(os.path.join(search_dir, "**", "*.jpg"), recursive=True) + \
            glob.glob(os.path.join(search_dir, "**", "*.webp"), recursive=True)
    
    if not files:
        print("No files found in temp storage.")
        return None
        
    # Sort by modification time
    files.sort(key=os.path.getmtime, reverse=True)
    
    # Return the most recent file
    latest_file = files[0]
    print(f"Latest file found: {latest_file}")
    return latest_file

def process_logo(image_path):
    if not image_path:
        return
        
    img = Image.open(image_path).convert("RGBA")
    datas = img.getdata()
    
    # Target brand colors
    brand_red = (160, 56, 32)  # #a03820
    brand_dark = (26, 26, 26)  # #1a1a1a
    brand_white = (255, 255, 255)
    
    # We will generate three versions of the logo
    new_data_red = []
    new_data_dark = []
    new_data_white = []
    
    for item in datas:
        # Check if the pixel is close to black
        # item is (r, g, b, a)
        r, g, b, a = item
        # Since the background is solid black, we can check if r, g, b are all small
        # We can also use a threshold to handle soft edges (anti-aliasing)
        brightness = (r + g + b) / 3.0
        
        if brightness < 30:
            # Black background -> transparent
            new_data_red.append((0, 0, 0, 0))
            new_data_dark.append((0, 0, 0, 0))
            new_data_white.append((0, 0, 0, 0))
        else:
            # White text -> recolor based on brightness for smooth anti-aliasing edges
            # Alpha is determined by the brightness of the text pixel
            alpha = int(min(255, brightness * 1.5))
            
            new_data_red.append((brand_red[0], brand_red[1], brand_red[2], alpha))
            new_data_dark.append((brand_dark[0], brand_dark[1], brand_dark[2], alpha))
            new_data_white.append((brand_white[0], brand_white[1], brand_white[2], alpha))
            
    # Save Red version
    img_red = Image.new("RGBA", img.size)
    img_red.putdata(new_data_red)
    # Crop transparent borders to fit nicely
    bbox_red = img_red.getbbox()
    if bbox_red:
        img_red = img_red.crop(bbox_red)
    img_red.save("/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo_red.png", "PNG")
    print("Saved logo_red.png")
    
    # Save Dark version
    img_dark = Image.new("RGBA", img.size)
    img_dark.putdata(new_data_dark)
    bbox_dark = img_dark.getbbox()
    if bbox_dark:
        img_dark = img_dark.crop(bbox_dark)
    img_dark.save("/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo_dark.png", "PNG")
    print("Saved logo_dark.png")
    
    # Save White version
    img_white = Image.new("RGBA", img.size)
    img_white.putdata(new_data_white)
    bbox_white = img_white.getbbox()
    if bbox_white:
        img_white = img_white.crop(bbox_white)
    img_white.save("/Users/egemengunes/Desktop/Antigravity/Projeler/Sinopia Mantı/images/logo_white.png", "PNG")
    print("Saved logo_white.png")

if __name__ == "__main__":
    latest_img = find_latest_uploaded_image()
    process_logo(latest_img)
