import os
from PIL import Image

def crop_and_resize_story():
    src_path = "/Users/egemengunes/.gemini/antigravity/brain/4fab57c6-97a5-40e1-a2da-6d91614e602c/dijitalgru_story_1080_1920_1779640595121.png"
    dst_path = "/Users/egemengunes/Desktop/Antigravity/Projeler/DijitalGru/dijitalgru_story_1080_1920.png"
    
    print(f"Opening source image: {src_path}")
    if not os.path.exists(src_path):
        print("Source image does not exist!")
        return
        
    try:
        img = Image.open(src_path)
        width, height = img.size
        print(f"Original size: {width}x{height}")
        
        # Calculate 9:16 cropping box
        # We want a vertical rectangle in the center
        # Aspect ratio 9:16 = 0.5625
        target_width = int(height * (9 / 16))
        left = (width - target_width) // 2
        right = left + target_width
        top = 0
        bottom = height
        
        print(f"Cropping box: left={left}, top={top}, right={right}, bottom={bottom}")
        cropped_img = img.crop((left, top, right, bottom))
        
        # Resize to exactly 1080x1920 px
        final_img = cropped_img.resize((1080, 1920), Image.Resampling.LANCZOS)
        print(f"Resized to: {final_img.size}")
        
        # Save to workspace
        final_img.save(dst_path, "PNG")
        print(f"Successfully saved to: {dst_path}")
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    crop_and_resize_story()
