"""Compose the app icons from the Blender render (art/icon.py): warm radial background, subject centred.

Run after art/icon.py: python3 art/icon_compose.py. Writes public/icons/icon-{180,192,512}.png and icon-maskable-512.png.
"""
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "icons")
INNER = (96, 222, 200)
OUTER = (22, 140, 150)


def background(n):
    bg = Image.new("RGB", (n, n), OUTER)
    glow = Image.new("L", (n, n), 0)
    ImageDraw.Draw(glow).ellipse([n * 0.12, n * 0.1, n * 0.88, n * 0.86], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(n * 0.16))
    bg.paste(Image.new("RGB", (n, n), INNER), (0, 0), glow)
    return bg


def compose(n, fill):
    sub = Image.open(os.path.join(OUT, "_subject.png")).convert("RGBA")
    sub = sub.crop(sub.getbbox())
    s = fill * n / max(sub.size)
    sub = sub.resize((round(sub.width * s), round(sub.height * s)), Image.LANCZOS)
    bg = background(n).convert("RGBA")
    shadow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sh = Image.new("L", (n, n), 0)
    x, y = (n - sub.width) // 2, (n - sub.height) // 2 + round(n * 0.01)
    ImageDraw.Draw(sh).ellipse([x + sub.width * 0.12, y + sub.height * 0.9, x + sub.width * 0.88, y + sub.height * 1.02], fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(n * 0.02))
    shadow.paste((60, 20, 40, 255), (0, 0), sh)
    bg = Image.alpha_composite(bg, shadow)
    bg.alpha_composite(sub, (x, y))
    return bg.convert("RGB")


if __name__ == "__main__":
    big = compose(1024, 0.8)
    for n in (180, 192, 512):
        big.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f"icon-{n}.png"), optimize=True)
    compose(1024, 0.62).resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
    os.remove(os.path.join(OUT, "_subject.png"))
