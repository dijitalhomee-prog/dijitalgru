import qrcode
import qrcode.image.svg
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import json

def hex_to_rgb(hex_str, default=(0, 0, 0)):
    if not hex_str or not hex_str.startswith("#"):
        return default
    hex_str = hex_str.lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join([c*2 for c in hex_str])
    try:
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    except Exception:
        return default

def generate_qr_image(data, settings=None, format="png"):
    """
    Generates customized QR code image in PNG, JPEG, SVG or Base64 format.
    """
    if settings is None:
        settings = {}

    fill_hex = settings.get("fill_color", "#4F46E5")
    back_hex = settings.get("back_color", "#FFFFFF")
    box_size = int(settings.get("box_size", 10))
    border = int(settings.get("border", 2))
    frame_style = settings.get("frame_style", "none")
    frame_text = settings.get("frame_text", "Beni Tara!")
    frame_color_hex = settings.get("frame_color", "#4F46E5")

    fill_rgb = hex_to_rgb(fill_hex, (79, 70, 229))
    back_rgb = hex_to_rgb(back_hex, (255, 255, 255))
    frame_rgb = hex_to_rgb(frame_color_hex, (79, 70, 229))

    # SVG Export
    if format.lower() == "svg":
        factory = qrcode.image.svg.SvgPathImage
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=box_size,
            border=border,
            image_factory=factory
        )
        qr.add_data(data)
        qr.make(fit=True)
        svg_img = qr.make_image(fill_color=fill_hex)
        buffer = io.BytesIO()
        svg_img.save(buffer)
        return buffer.getvalue()

    # PNG / JPEG / Base64 Raster Render
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=box_size,
        border=border
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color=fill_rgb, back_color=back_rgb).convert("RGB")

    # Frame Overlay
    if frame_style != "none":
        w, h = img.size
        frame_padding = 40
        bottom_banner_h = 60
        
        new_w = w + (frame_padding * 2)
        new_h = h + (frame_padding * 2) + bottom_banner_h

        framed_img = Image.new("RGB", (new_w, new_h), back_rgb)
        draw = ImageDraw.Draw(framed_img)

        # Outer border
        draw.rectangle([5, 5, new_w - 5, new_h - 5], outline=frame_rgb, width=4)
        
        # Paste QR code in center
        framed_img.paste(img, (frame_padding, frame_padding))

        # Bottom banner with text
        draw.rectangle([15, new_h - bottom_banner_h, new_w - 15, new_h - 15], fill=frame_rgb)
        
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        text_bbox = draw.textbbox((0, 0), frame_text, font=font)
        text_w = text_bbox[2] - text_bbox[0]
        text_x = (new_w - text_w) // 2
        text_y = new_h - bottom_banner_h + (bottom_banner_h - 30) // 2
        draw.text((text_x, text_y), frame_text, fill=(255, 255, 255), font=font)

        img = framed_img

    buffer = io.BytesIO()
    
    img_fmt = "JPEG" if format.lower() in ["jpg", "jpeg"] else "PNG"
    img.save(buffer, format=img_fmt)
    buffer.seek(0)

    if format == "base64":
        b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"
    
    return buffer.getvalue()
