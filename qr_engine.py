import qrcode
import qrcode.constants
from PIL import Image, ImageDraw, ImageFont
import io
import base64
import os
import re
from xml.sax.saxutils import escape as _xml_escape


def hex_to_rgb(hex_str, default=(0, 0, 0)):
    if not hex_str or not str(hex_str).startswith("#"):
        return default
    hex_str = str(hex_str).lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join([c * 2 for c in hex_str])
    try:
        if len(hex_str) != 6:
            return default
        return tuple(int(hex_str[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return default


def _rgb_hex(rgb):
    return "#%02x%02x%02x" % tuple(rgb)


_EC_LEVELS = [
    qrcode.constants.ERROR_CORRECT_H,
    qrcode.constants.ERROR_CORRECT_Q,
    qrcode.constants.ERROR_CORRECT_M,
    qrcode.constants.ERROR_CORRECT_L,
]


def _build_qr(data, box_size, border, force_high=False):
    """Veri sığmazsa hata düzeltme seviyesini düşürerek (logo yoksa) QR üretir."""
    last = None
    levels = _EC_LEVELS[:1] if force_high else _EC_LEVELS
    for ec in levels:
        try:
            qr = qrcode.QRCode(version=1, error_correction=ec, box_size=box_size, border=border)
            qr.add_data(data)
            qr.make(fit=True)
            return qr, ec == qrcode.constants.ERROR_CORRECT_H
        except Exception as ex:  # DataOverflowError
            last = ex
    raise last


def _parse_settings(settings):
    if not isinstance(settings, dict):
        settings = {}
    try:
        box_size = int(settings.get("box_size") or 10)
    except Exception:
        box_size = 10
    try:
        border = int(settings.get("border") or 2)
    except Exception:
        border = 2
    box_size = min(max(box_size, 2), 40)
    border = min(max(border, 0), 10)
    s = {
        "box_size": box_size,
        "border": border,
        "fill_rgb": hex_to_rgb(str(settings.get("fill_color") or "#4F46E5"), (79, 70, 229)),
        "back_rgb": hex_to_rgb(str(settings.get("back_color") or "#FFFFFF"), (255, 255, 255)),
        "frame_style": str(settings.get("frame_style") or "none"),
        "frame_text": str(settings.get("frame_text") or "Beni Tara!"),
        "frame_rgb": hex_to_rgb(str(settings.get("frame_color") or "#4F46E5"), (79, 70, 229)),
        "frame_text_rgb": hex_to_rgb(str(settings.get("frame_text_color") or "#FFFFFF"), (255, 255, 255)),
        "logo_bytes": settings.get("_logo_bytes"),
    }
    return s


def _load_logo(logo_bytes):
    if not logo_bytes:
        return None
    try:
        logo = Image.open(io.BytesIO(logo_bytes))
        logo.load()
        return logo.convert("RGBA")
    except Exception:
        return None


# Çerçeve ölçüleri (PNG, SVG ve EPS'te aynı)
FRAME_PADDING = 40
FRAME_BANNER_H = 60


def _frame_geometry(w, h):
    return w + FRAME_PADDING * 2, h + FRAME_PADDING * 2 + FRAME_BANNER_H


def _get_font(size):
    font_candidates = [
        os.path.join(os.path.dirname(__file__), "static", "fonts", "CustomFont.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for fpath in font_candidates:
        if os.path.exists(fpath):
            try:
                return ImageFont.truetype(fpath, size=size)
            except Exception:
                pass
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def _runs(matrix):
    """Matristen yatay koyu modül koşuları: [(row, col, length)]"""
    out = []
    for r, row in enumerate(matrix):
        c, n = 0, len(row)
        while c < n:
            if row[c]:
                start = c
                while c < n and row[c]:
                    c += 1
                out.append((r, start, c - start))
            else:
                c += 1
    return out


def _logo_png_b64(logo, max_px=240):
    lg = logo.copy()
    lg.thumbnail((max_px, max_px))
    buf = io.BytesIO()
    lg.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii"), lg


def _logo_box(qr_px, ratio=0.22):
    side = int(qr_px * ratio)
    return max(side, 8)


def _render_svg(data, s):
    logo = _load_logo(s["logo_bytes"])
    qr, _ = _build_qr(data, s["box_size"], s["border"], force_high=bool(logo))
    matrix = qr.get_matrix()  # kenarlık dahil
    box = s["box_size"]
    n = len(matrix)
    w = h = n * box
    fill = _rgb_hex(s["fill_rgb"])
    back = _rgb_hex(s["back_rgb"])

    framed = s["frame_style"] != "none"
    if framed:
        W, H = _frame_geometry(w, h)
        ox = oy = FRAME_PADDING
    else:
        W, H, ox, oy = w, h, 0, 0

    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
             'width="%d" height="%d" viewBox="0 0 %d %d" shape-rendering="crispEdges">' % (W, H, W, H),
             '<rect width="%d" height="%d" fill="%s"/>' % (W, H, back)]

    if framed:
        frame = _rgb_hex(s["frame_rgb"])
        ftxt = _rgb_hex(s["frame_text_rgb"])
        parts.append('<rect x="5" y="5" width="%d" height="%d" fill="none" stroke="%s" stroke-width="4"/>'
                     % (W - 10, H - 10, frame))
        parts.append('<rect x="15" y="%d" width="%d" height="%d" fill="%s"/>'
                     % (H - FRAME_BANNER_H, W - 30, FRAME_BANNER_H - 15, frame))

    d = "".join("M%d %dh%dv%dh-%dz" % (ox + c * box, oy + r * box, ln * box, box, ln * box)
                for r, c, ln in _runs(matrix))
    parts.append('<path d="%s" fill="%s"/>' % (d, fill))

    if logo:
        side = _logo_box(w)
        pad = max(4, side // 8)
        cx, cy = ox + w // 2, oy + h // 2
        b64, _lg = _logo_png_b64(logo)
        parts.append('<rect x="%d" y="%d" width="%d" height="%d" rx="%d" fill="%s"/>'
                     % (cx - side // 2 - pad, cy - side // 2 - pad, side + pad * 2, side + pad * 2, pad, back))
        parts.append('<image x="%d" y="%d" width="%d" height="%d" preserveAspectRatio="xMidYMid meet" '
                     'href="data:image/png;base64,%s" xlink:href="data:image/png;base64,%s"/>'
                     % (cx - side // 2, cy - side // 2, side, side, b64, b64))

    if framed:
        text = s["frame_text"] or "Beni Tara!"
        font_size = max(16, int(FRAME_BANNER_H * 0.35))
        banner_center = H - FRAME_BANNER_H + (FRAME_BANNER_H - 15) / 2.0
        parts.append('<text x="%s" y="%s" text-anchor="middle" fill="%s" font-size="%d" font-weight="700" '
                     'font-family="DejaVu Sans, Arial, Helvetica, sans-serif">%s</text>'
                     % (W / 2.0, banner_center + font_size * 0.35, ftxt, font_size, _xml_escape(text)))
    parts.append("</svg>")
    return "\n".join(parts).encode("utf-8")


_TR_ASCII = str.maketrans("çğıöşüÇĞİÖŞÜâîûÂÎÛ", "cgiosuCGIOSUaiuAIU")


def _ps_text(s):
    s = str(s or "").translate(_TR_ASCII)
    s = s.encode("latin-1", "replace").decode("latin-1")
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _render_eps(data, s):
    """Gerçek vektör EPS (%!PS-Adobe). Koyu modüller rectfill; çerçeve ve yazı PostScript."""
    logo = _load_logo(s["logo_bytes"])
    qr, _ = _build_qr(data, s["box_size"], s["border"], force_high=bool(logo))
    matrix = qr.get_matrix()
    box = s["box_size"]
    n = len(matrix)
    w = h = n * box
    framed = s["frame_style"] != "none"
    if framed:
        W, H = _frame_geometry(w, h)
        ox = oy = FRAME_PADDING
    else:
        W, H, ox, oy = w, h, 0, 0

    def col(rgb):
        return "%.4f %.4f %.4f setrgbcolor" % tuple(c / 255.0 for c in rgb)

    def rect(x, top, rw, rh):
        # üst-sol koordinattan PS (alt-sol) koordinata
        return "%d %d %d %d rectfill" % (x, H - top - rh, rw, rh)

    L = ["%!PS-Adobe-3.0 EPSF-3.0",
         "%%Creator: Dijitalgru QR Studio",
         "%%Title: QR Code",
         "%%BoundingBox: 0 0 {0} {1}".format(W, H),
         "%%HiResBoundingBox: 0 0 {0} {1}".format(W, H),
         "%%LanguageLevel: 2",
         "%%Pages: 1",
         "%%EndComments",
         "%%Page: 1 1",
         "gsave",
         col(s["back_rgb"]),
         "0 0 {0} {1} rectfill".format(W, H)]
    if framed:
        L.append(col(s["frame_rgb"]))
        L.append("4 setlinewidth")
        L.append("%d %d %d %d rectstroke" % (5, 5, W - 10, H - 10))
        L.append(rect(15, H - FRAME_BANNER_H, W - 30, FRAME_BANNER_H - 15))
    L.append(col(s["fill_rgb"]))
    for r, c, ln in _runs(matrix):
        L.append(rect(ox + c * box, oy + r * box, ln * box, box))

    if logo:
        side = _logo_box(w)
        pad = max(4, side // 8)
        cx, cy = ox + w // 2, oy + h // 2
        L.append(col(s["back_rgb"]))
        L.append(rect(cx - side // 2 - pad, cy - side // 2 - pad, side + pad * 2, side + pad * 2))
        lg = logo.copy()
        lg.thumbnail((200, 200))
        flat = Image.new("RGB", lg.size, s["back_rgb"])
        flat.paste(lg, mask=lg.split()[-1])
        lw, lh = flat.size
        dw = side if lw >= lh else int(side * lw / float(lh))
        dh = side if lh >= lw else int(side * lh / float(lw))
        hexdata = flat.tobytes().hex()
        L.append("gsave %d %d translate %d %d scale" % (cx - dw // 2, H - (cy + dh // 2), dw, dh))
        L.append("%d %d 8 [%d 0 0 -%d 0 %d]" % (lw, lh, lw, lh, lh))
        L.append("currentfile /ASCIIHexDecode filter false 3 colorimage")
        step = 96
        for i in range(0, len(hexdata), step):
            L.append(hexdata[i:i + step])
        L.append(">")
        L.append("grestore")

    if framed:
        text = _ps_text(s["frame_text"] or "Beni Tara!")
        font_size = max(16, int(FRAME_BANNER_H * 0.35))
        banner_center_top = H - FRAME_BANNER_H + (FRAME_BANNER_H - 15) / 2.0
        ps_y = H - banner_center_top - font_size * 0.35
        L.append(col(s["frame_text_rgb"]))
        L.append("/Helvetica-Bold findfont %d scalefont setfont" % font_size)
        L.append("(%s) dup stringwidth pop 2 div %s exch sub %.2f moveto show" % (text, W / 2.0, ps_y))
    L.append("grestore")
    L.append("showpage")
    L.append("%%EOF")
    return ("\n".join(L) + "\n").encode("latin-1", "replace")


def _render_raster(data, s):
    logo = _load_logo(s["logo_bytes"])
    qr, _ = _build_qr(data, s["box_size"], s["border"], force_high=bool(logo))
    fill_rgb, back_rgb = s["fill_rgb"], s["back_rgb"]
    img = qr.make_image(fill_color=fill_rgb, back_color=back_rgb).convert("RGB")

    if logo:
        qw, _qh = img.size
        side = _logo_box(qw)
        pad = max(4, side // 8)
        lg = logo.copy()
        lg.thumbnail((side, side), Image.LANCZOS)
        plate = Image.new("RGB", (side + pad * 2, side + pad * 2), back_rgb)
        pw, ph = plate.size
        img.paste(plate, ((qw - pw) // 2, (img.size[1] - ph) // 2))
        img.paste(lg, ((qw - lg.size[0]) // 2, (img.size[1] - lg.size[1]) // 2), lg)

    if s["frame_style"] != "none":
        try:
            w, h = img.size
            new_w, new_h = _frame_geometry(w, h)
            framed_img = Image.new("RGB", (new_w, new_h), back_rgb)
            draw = ImageDraw.Draw(framed_img)
            draw.rectangle([5, 5, new_w - 5, new_h - 5], outline=s["frame_rgb"], width=4)
            framed_img.paste(img, (FRAME_PADDING, FRAME_PADDING))
            draw.rectangle([15, new_h - FRAME_BANNER_H, new_w - 15, new_h - 15], fill=s["frame_rgb"])

            font = _get_font(max(16, int(FRAME_BANNER_H * 0.35)))
            frame_text_str = str(s["frame_text"] or "Beni Tara!")
            try:
                text_bbox = draw.textbbox((0, 0), frame_text_str, font=font)
                text_w = text_bbox[2] - text_bbox[0]
                text_h = text_bbox[3] - text_bbox[1]
            except Exception:
                text_w, text_h = 100, 20
            text_x = max(0, (new_w - text_w) // 2)
            text_y = max(0, (new_h - FRAME_BANNER_H) + (FRAME_BANNER_H - 15 - text_h) // 2)
            try:
                draw.text((text_x, text_y), frame_text_str, fill=s["frame_text_rgb"], font=font)
            except Exception:
                pass
            img = framed_img
        except Exception:
            pass
    return img


def generate_qr_image(data, settings=None, format="png"):
    """
    PNG / JPEG / PDF / SVG / EPS / Base64 üretir. Hepsi aynı tasarım ayarlarını uygular
    (renkler, çerçeve, çerçeve yazısı/renkleri, logo). SVG ve EPS gerçek vektördür.
    """
    s = _parse_settings(settings)
    fmt = (format or "png").lower()

    if fmt == "svg":
        return _render_svg(data, s)
    if fmt == "eps":
        return _render_eps(data, s)

    img = _render_raster(data, s)
    buffer = io.BytesIO()
    if fmt in ("jpg", "jpeg"):
        img.save(buffer, format="JPEG", quality=95)
    elif fmt == "pdf":
        img.save(buffer, format="PDF", resolution=300.0)
    else:
        img.save(buffer, format="PNG")
    buffer.seek(0)

    if fmt == "base64":
        b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return "data:image/png;base64,%s" % b64_str
    return buffer.getvalue()
