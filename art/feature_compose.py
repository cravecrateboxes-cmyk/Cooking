"""Compose the Google Play feature graphic (1024 x 500) from the Blender render (art/feature.py): a warm
glow on the game's plum, the diorama on the right and the title screen's logo on the left.

Run after art/feature.py: python3 art/feature_compose.py. Writes store/feature-graphic.png and deletes the render.
The logo matches the title screen (src/menu.css): white "Order", gold "Up!", ink outline, red tagline.
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STORE = os.path.join(ROOT, "store")
FONTS = os.path.join(ROOT, "node_modules", "@fontsource")
LILITA = os.path.join(FONTS, "lilita-one", "files", "lilita-one-latin-400-normal.woff2")
NUNITO = os.path.join(FONTS, "nunito", "files", "nunito-latin-900-normal.woff2")
W, H, S = 1024, 500, 2  # drawn at twice the size, then scaled down for clean edges
INK = (42, 27, 74)
PLUM = (58, 37, 96)
PLUM_L = (90, 59, 140)
SUN = (255, 210, 63)
CTA = (255, 75, 85)
GLOW = (255, 196, 120)


def background():
    bg = Image.new("RGB", (W * S, H * S), PLUM)
    light = Image.new("L", bg.size, 0)
    ImageDraw.Draw(light).ellipse([W * S * 0.18, -H * S * 0.35, W * S * 1.25, H * S * 1.1], fill=255)
    bg.paste(Image.new("RGB", bg.size, PLUM_L), (0, 0), light.filter(ImageFilter.GaussianBlur(W * S * 0.12)))
    warm = Image.new("L", bg.size, 0)
    ImageDraw.Draw(warm).ellipse([W * S * 0.42, H * S * 0.02, W * S * 1.02, H * S * 0.9], fill=150)
    bg.paste(Image.new("RGB", bg.size, GLOW), (0, 0), warm.filter(ImageFilter.GaussianBlur(W * S * 0.1)))
    return bg.convert("RGBA")


def word(text, size, fill, angle):
    """A word in Lilita One with a thick ink outline and the logo's drop shadow, rotated like the menu."""
    font = ImageFont.truetype(LILITA, size)
    stroke = round(size * 0.15)
    l, t, r, b = font.getbbox(text, stroke_width=stroke)
    pad = stroke * 2
    img = Image.new("RGBA", (r - l + pad * 2, b - t + pad * 2 + round(size * 0.08)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    at = (pad - l, pad - t)
    shadow = (at[0], at[1] + round(size * 0.07))
    d.text(shadow, text, font=font, fill=INK + (140,), stroke_width=stroke, stroke_fill=INK + (140,))
    d.text(at, text, font=font, fill=fill, stroke_width=stroke, stroke_fill=INK)
    return img.rotate(angle, resample=Image.BICUBIC, expand=True)


def tag(text, size, angle):
    font = ImageFont.truetype(NUNITO, size)
    l, t, r, b = font.getbbox(text)
    px, py, border = round(size * 0.8), round(size * 0.34), round(size * 0.2)
    w, h = r - l + px * 2, b - t + py * 2
    img = Image.new("RGBA", (w + border * 2, h + border * 2 + round(size * 0.28)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rad = round(size * 0.8)
    d.rounded_rectangle([0, round(size * 0.28), w + border * 2 - 1, h + border * 2 - 1 + round(size * 0.28)], rad, fill=INK + (110,))
    d.rounded_rectangle([0, 0, w + border * 2 - 1, h + border * 2 - 1], rad, fill=INK)
    d.rounded_rectangle([border, border, w + border - 1, h + border - 1], rad - border, fill=CTA)
    d.text((border + px - l, border + py - t), text, font=font, fill=(255, 255, 255))
    return img.rotate(angle, resample=Image.BICUBIC, expand=True)


def main():
    img = background()
    subject = Image.open(os.path.join(STORE, "_feature_subject.png")).convert("RGBA")
    img.alpha_composite(subject.resize(img.size, Image.LANCZOS))
    a = word("Order", 118 * S, (255, 255, 255), 6)
    b = word("Up!", 156 * S, SUN, 2)
    t = tag("Cook it. Serve it. Grow it.", 26 * S, 3)
    x0, y0 = 46 * S, 26 * S
    img.alpha_composite(a, (x0, y0))
    img.alpha_composite(b, (x0 + 70 * S, y0 + 96 * S))
    img.alpha_composite(t, (x0 + 10 * S, y0 + 300 * S))
    out = img.convert("RGB").resize((W, H), Image.LANCZOS)
    out.save(os.path.join(STORE, "feature-graphic.png"), optimize=True)
    if os.environ.get("KEEP") != "1":
        os.remove(os.path.join(STORE, "_feature_subject.png"))


if __name__ == "__main__":
    main()
