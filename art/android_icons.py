"""Android launcher icons and splash screens from the Blender icon render (art/icon.py).

Run: python3 art/icon.py && python3 art/android_icons.py && python3 art/icon_compose.py
(icon_compose.py deletes the render when it is done, so it goes last).
Writes the adaptive icon (teal glow background + burger foreground inside the 66 dp safe zone), the
legacy square and round icons, and plum splash screens with the burger centred.
"""
import os

from PIL import Image, ImageDraw

from icon_compose import background

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, "..", "android", "app", "src", "main", "res")
SUBJECT = os.path.join(HERE, "..", "public", "icons", "_subject.png")
PLUM = (43, 22, 64)
DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
SPLASH = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}


def subject(size):
    sub = Image.open(SUBJECT).convert("RGBA")
    sub = sub.crop(sub.getbbox())
    s = size / max(sub.size)
    return sub.resize((round(sub.width * s), round(sub.height * s)), Image.LANCZOS)


def centred(canvas, sub, dy=0):
    canvas.alpha_composite(sub, ((canvas.width - sub.width) // 2, (canvas.height - sub.height) // 2 + dy))
    return canvas


def save(img, folder, name):
    os.makedirs(os.path.join(RES, folder), exist_ok=True)
    img.save(os.path.join(RES, folder, name), optimize=True)


for d, k in DENSITY.items():
    fg_px = round(108 * k)
    # adaptive layers: the system masks them; the burger stays inside the 66 dp safe circle
    fg = centred(Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0)), subject(round(fg_px * 0.56)))
    save(fg, f"mipmap-{d}", "ic_launcher_foreground.png")
    save(background(fg_px), f"mipmap-{d}", "ic_launcher_background.png")
    # legacy icons for launchers without adaptive icons
    n = round(48 * k)
    square = centred(background(n).convert("RGBA"), subject(round(n * 0.8)))
    save(square.convert("RGB"), f"mipmap-{d}", "ic_launcher.png")
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, n - 1, n - 1], fill=255)
    rnd = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    rnd.paste(centred(background(n).convert("RGBA"), subject(round(n * 0.66))), (0, 0), mask)
    save(rnd, f"mipmap-{d}", "ic_launcher_round.png")
    # splash: plum like the game's loading screen, burger in the middle
    w, h = SPLASH[d]
    save(centred(Image.new("RGBA", (w, h), PLUM + (255,)), subject(round(min(w, h) * 0.42))).convert("RGB"), f"drawable-port-{d}", "splash.png")
    save(centred(Image.new("RGBA", (h, w), PLUM + (255,)), subject(round(min(w, h) * 0.42))).convert("RGB"), f"drawable-land-{d}", "splash.png")

save(centred(Image.new("RGBA", (480, 320), PLUM + (255,)), subject(150)).convert("RGB"), "drawable", "splash.png")
