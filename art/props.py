"""Kitchen stations, furniture and outdoor props for the restaurant and the food truck.

Run: python3 art/props.py   -> src/assets/props.glb
Each root object is one clonable prop. Props face -Y in Blender (+Z in three.js); the origin is the
centre of the footprint on the floor. Worktops sit at 0.7 m (the chef is 1.15 m tall).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (ASSETS, box, cyl, export, join, lathe, mat, reset, seeded, sphere,  # noqa: E402
                 torus, tri_count)

TOP = 0.7


def P():
    return {
        "red": mat("p_red", "#ff4b55", 0.45),
        "red_d": mat("p_red_d", "#c8303f", 0.5),
        "yellow": mat("p_yellow", "#ffd23f", 0.45),
        "yellow_d": mat("p_yellow_d", "#f0a81c", 0.5),
        "orange": mat("p_orange", "#ff8a2b", 0.45),
        "blue": mat("p_blue", "#3fa9f5", 0.4),
        "blue_d": mat("p_blue_d", "#2471c8", 0.45),
        "teal": mat("p_teal", "#22c3b0", 0.45),
        "teal_d": mat("p_teal_d", "#13907f", 0.5),
        "pink": mat("p_pink", "#ff79b4", 0.4),
        "pink_d": mat("p_pink_d", "#d84f8f", 0.45),
        "purple": mat("p_purple", "#8a5cf5", 0.45),
        "purple_d": mat("p_purple_d", "#5d38c2", 0.5),
        "green": mat("p_green", "#5ccf54", 0.5),
        "green_d": mat("p_green_d", "#2f9c45", 0.55),
        "leaf": mat("p_leaf", "#43c463", 0.55),
        "leaf_d": mat("p_leaf_d", "#24934a", 0.6),
        "wood": mat("p_wood", "#d08a4c", 0.6),
        "wood_d": mat("p_wood_d", "#9c5c2c", 0.65),
        "steel": mat("p_steel", "#9fb6e0", 0.3, 0.2),
        "steel_d": mat("p_steel_d", "#6e83b8", 0.35, 0.2),
        "char": mat("p_char", "#3b3256", 0.6),
        "char_l": mat("p_char_l", "#584a80", 0.55),
        "glow": mat("p_glow", "#ffae2b", 0.4, 0.0, 2.0),
        "oil": mat("p_oil", "#ffc83a", 0.15),
        "cream": mat("p_cream", "#fff0c4", 0.4),
        "screen": mat("p_screen", "#46e0ff", 0.2, 0.0, 1.0),
        "black": mat("p_ink", "#2a2340", 0.6),
        "water": mat("p_water", "#58d6ff", 0.15),
        "bubble": mat("p_bubble", "#d9f6ff", 0.2),
        "terra": mat("p_terra", "#e0703c", 0.6),
        "soil": mat("p_soil", "#6b3d2a", 0.8),
        "tire": mat("p_tire", "#2f2a45", 0.7),
        "glass": mat("p_glass", "#9fe7ff", 0.1),
        "sand": mat("p_sand", "#ffd98a", 0.8),
        "mint": mat("p_mint", "#8ff0cf", 0.4),
        "lilac": mat("p_lilac", "#c7a6ff", 0.45),
    }


def cabinet(p, w, d, body, trim, top=TOP, top_mat=None, kick=True):
    """Kitchen base unit with a rounded worktop, front panel lines and a recessed kick plate."""
    parts = [box("body", (w, d, top - 0.06), (0, 0, (top - 0.06) / 2 + 0.0), body, 0.03)]
    parts.append(box("worktop", (w + 0.06, d + 0.06, 0.08), (0, 0, top - 0.04), top_mat or trim, 0.025))
    if kick:
        parts.append(box("kick", (w - 0.04, d - 0.04, 0.08), (0, 0, 0.04), trim, 0.01))
    # door split and handles on the front (-Y)
    parts.append(box("split", (0.02, 0.01, top - 0.24), (0, -d / 2 - 0.004, (top - 0.06) / 2 + 0.04), trim, 0))
    for sx in (-1, 1):
        parts.append(box("handle", (0.02, 0.03, 0.16), (sx * 0.07, -d / 2 - 0.02, top - 0.22), p["steel"], 0.008))
    return parts


def grill(p):
    w, d = 1.5, 0.95
    parts = cabinet(p, w, d, p["red"], p["yellow"])
    parts.append(box("plate", (w - 0.24, d - 0.22, 0.05), (0, 0.03, TOP + 0.02), p["char"], 0.015))
    for i in range(7):
        x = -0.55 + i * 0.183
        parts.append(box("bar", (0.03, d - 0.3, 0.03), (x, 0.03, TOP + 0.06), p["char_l"], 0.008))
    # back splash with heat vents
    parts.append(box("splash", (w, 0.12, 0.5), (0, d / 2 - 0.02, TOP + 0.22), p["red_d"], 0.03))
    for i in range(4):
        parts.append(box("vent", (0.22, 0.02, 0.04), (-0.45 + i * 0.3, d / 2 - 0.085, TOP + 0.35), p["char"], 0.01))
    parts.append(box("knobs", (w - 0.2, 0.06, 0.08), (0, -d / 2 - 0.02, TOP - 0.1), p["yellow_d"], 0.02))
    for i in range(4):
        parts.append(cyl("knob", 0.035, 0.04, (-0.45 + i * 0.3, -d / 2 - 0.05, TOP - 0.1), p["char"], 12,
                         rot=(math.pi / 2, 0, 0)))
    return join("st_grill", parts)


def fryer(p):
    w, d = 1.5, 0.95
    parts = cabinet(p, w, d, p["yellow"], p["orange"])
    for sx in (-1, 1):
        x = sx * 0.33
        parts.append(box("well", (0.56, 0.62, 0.06), (x, 0.0, TOP + 0.005), p["steel_d"], 0.02))
        parts.append(box("oil", (0.48, 0.54, 0.02), (x, 0.0, TOP + 0.03), p["oil"], 0.01))
        parts.append(box("basket", (0.36, 0.4, 0.12), (x, 0.03, TOP + 0.12), p["steel"], 0.02))
        parts.append(box("handle", (0.04, 0.32, 0.04), (x, -0.32, TOP + 0.2), p["black"], 0.015))
    parts.append(box("splash", (w, 0.12, 0.45), (0, d / 2 - 0.02, TOP + 0.2), p["orange"], 0.03))
    parts.append(box("panel", (0.5, 0.02, 0.18), (0, d / 2 - 0.085, TOP + 0.28), p["char"], 0.02))
    for i, c in enumerate((p["green"], p["yellow"], p["red"])):
        parts.append(sphere("led", 0.028, (-0.14 + i * 0.14, d / 2 - 0.1, TOP + 0.28), c, (1, 0.6, 1), 10, 6))
    return join("st_fryer", parts)


def soda(p):
    w, d = 1.5, 0.95
    parts = cabinet(p, w, d, p["blue"], p["yellow"])
    # dispenser tower
    parts.append(box("tower", (1.1, 0.5, 0.75), (0, 0.15, TOP + 0.375), p["blue_d"], 0.06))
    parts.append(box("face", (1.0, 0.04, 0.4), (0, -0.1, TOP + 0.45), p["cream"], 0.03))
    for i, c in enumerate((p["red"], p["orange"], p["purple"])):
        x = -0.32 + i * 0.32
        parts.append(box("label", (0.24, 0.02, 0.24), (x, -0.13, TOP + 0.5), c, 0.04))
        parts.append(cyl("nozzle", 0.04, 0.1, (x, -0.16, TOP + 0.18), p["steel"], 12))
        parts.append(box("lever", (0.06, 0.08, 0.14), (x, -0.22, TOP + 0.3), p["black"], 0.02))
    parts.append(box("drip", (1.0, 0.36, 0.04), (0, -0.2, TOP + 0.02), p["steel_d"], 0.015))
    # cup stack on the side
    for i in range(5):
        parts.append(cyl("cup", 0.07, 0.06, (0.62, -0.25, TOP + i * 0.05), p["red"] if i % 2 else p["cream"], 16,
                         r_top=0.085))
    return join("st_soda", parts)


def sundae(p):
    w, d = 1.5, 0.95
    parts = cabinet(p, w, d, p["pink"], p["lilac"])
    parts.append(box("machine", (0.9, 0.55, 0.7), (0, 0.12, TOP + 0.35), p["pink_d"], 0.12))
    parts.append(box("front", (0.8, 0.04, 0.32), (0, -0.16, TOP + 0.42), p["mint"], 0.06))
    for i in range(2):
        x = -0.18 + i * 0.36
        parts.append(cyl("spout", 0.05, 0.12, (x, -0.22, TOP + 0.2), p["steel"], 14))
    # whipped swirl on top
    for i in range(4):
        parts.append(torus("swirl", 0.22 - i * 0.05, 0.05, (0, 0.12, TOP + 0.74 + i * 0.07), p["cream"], 28, 10))
    parts.append(sphere("cherry", 0.06, (0, 0.12, TOP + 1.04), p["red"], (1, 1, 1), 16, 10))
    return join("st_sundae", parts)


def oven(p):
    """Wood-fired pizza oven on a tiled base."""
    parts = cabinet(p, 1.5, 0.95, p["terra"], p["yellow"])
    parts.append(sphere("dome", 0.72, (0, 0.05, TOP), p["orange"], (1.0, 0.9, 0.82), 32, 16, cut_below=0.0))
    parts.append(torus("arch", 0.3, 0.07, (0, -0.55, TOP + 0.18), p["red_d"], 24, 10))
    parts[-1].rotation_euler = (math.pi / 2, 0, 0)
    parts.append(sphere("mouth", 0.3, (0, -0.5, TOP), p["char"], (1, 0.5, 0.9), 20, 12, cut_below=0.0))
    parts.append(sphere("fire", 0.16, (0, -0.42, TOP + 0.02), p["glow"], (1.4, 0.6, 0.9), 14, 8))
    parts.append(cyl("chimney", 0.11, 0.42, (0.28, 0.25, TOP + 0.45), p["red"], 16))
    parts.append(cyl("cap", 0.15, 0.06, (0.28, 0.25, TOP + 0.86), p["red_d"], 16))
    return join("st_oven", parts)


def hotdog_roller(p):
    parts = cabinet(p, 1.4, 0.85, p["orange"], p["yellow"])
    parts.append(box("tray", (1.1, 0.6, 0.06), (0, 0, TOP + 0.03), p["steel_d"], 0.02))
    for i in range(6):
        parts.append(cyl("roll", 0.03, 1.0, (-0.5, -0.22 + i * 0.09, TOP + 0.09), p["steel"], 10,
                         rot=(0, math.pi / 2, 0)))
    parts.append(box("hood", (1.2, 0.08, 0.36), (0, 0.38, TOP + 0.2), p["red"], 0.03))
    return join("st_hotdog", parts)


def counter_seg(p):
    """1.2 m straight counter section. Customers stand on -Y, the chef on +Y."""
    w, d = 1.2, 0.8
    parts = [box("body", (w, d, TOP - 0.06), (0, 0, (TOP - 0.06) / 2), p["red"], 0.025)]
    parts.append(box("top", (w + 0.02, d + 0.12, 0.08), (0, 0, TOP - 0.04), p["yellow"], 0.03))
    parts.append(box("band", (w + 0.01, 0.02, 0.12), (0, -d / 2 - 0.006, TOP - 0.2), p["yellow"], 0.01))
    for i in range(3):
        parts.append(box("panel", (0.32, 0.02, 0.3), (-0.4 + i * 0.4, -d / 2 - 0.006, 0.26), p["red_d"], 0.03))
    return join("counter_seg", parts)


def counter_end(p):
    parts = [box("body", (0.8, 0.8, TOP - 0.06), (0, 0, (TOP - 0.06) / 2), p["red"], 0.06)]
    parts.append(box("top", (0.84, 0.92, 0.08), (0, 0, TOP - 0.04), p["yellow"], 0.04))
    return join("counter_end", parts)


def register(p):
    parts = [box("base", (0.42, 0.36, 0.16), (0, 0, 0.08), p["teal"], 0.04)]
    parts.append(box("keys", (0.36, 0.2, 0.06), (0, -0.06, 0.18), p["teal_d"], 0.025, rot=(0.35, 0, 0)))
    parts.append(box("drawer", (0.38, 0.02, 0.06), (0, -0.18, 0.07), p["yellow"], 0.01))
    parts.append(cyl("neck", 0.03, 0.18, (0, 0.1, 0.16), p["black"], 10))
    parts.append(box("screen", (0.32, 0.06, 0.2), (0, 0.1, 0.4), p["black"], 0.03, rot=(-0.25, 0, 0)))
    parts.append(box("glass", (0.27, 0.02, 0.15), (0, 0.07, 0.4), p["screen"], 0.02, rot=(-0.25, 0, 0)))
    return join("register", parts)


def table(p):
    """Round diner table: a thick dark-blue edge with the lighter top set in, so it reads as a table, not a disc."""
    parts = [cyl("edge", 0.57, 0.09, (0, 0, 0.6), p["blue_d"], 40, round_=0.03)]
    parts.append(cyl("top", 0.5, 0.03, (0, 0, 0.665), p["blue"], 40, round_=0.012))
    parts.append(torus("lip", 0.535, 0.022, (0, 0, 0.69), p["yellow"], 40, 6))
    parts.append(cyl("leg", 0.07, 0.6, (0, 0, 0.02), p["char_l"], 16))
    parts.append(cyl("foot", 0.3, 0.05, (0, 0, 0), p["char_l"], 28, round_=0.02))
    return join("table", parts)


def chair(p):
    """Stool-chair, back on +Y. The seat is at 0.42 m."""
    parts = [cyl("seat", 0.24, 0.08, (0, 0, 0.38), p["yellow"], 28, round_=0.03)]
    parts.append(box("back", (0.42, 0.08, 0.36), (0, 0.2, 0.62), p["yellow"], 0.04, rot=(-0.12, 0, 0)))
    parts.append(box("backtrim", (0.42, 0.085, 0.07), (0, 0.205, 0.8), p["orange"], 0.03, rot=(-0.12, 0, 0)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl("leg", 0.025, 0.38, (sx * 0.15, sy * 0.15, 0), p["orange"], 10))
    return join("chair", parts)


def sink(p):
    parts = cabinet(p, 1.3, 0.85, p["teal"], p["yellow"])
    parts.append(box("tub", (1.0, 0.6, 0.18), (0, 0, TOP + 0.04), p["steel_d"], 0.05))
    parts.append(box("water", (0.9, 0.5, 0.02), (0, 0, TOP + 0.1), p["water"], 0.01))
    rng = seeded(9)
    for i in range(9):
        r = rng.uniform(0.04, 0.08)
        parts.append(sphere("bubble", r, (rng.uniform(-0.38, 0.38), rng.uniform(-0.2, 0.2), TOP + 0.12),
                            p["bubble"], (1, 1, 0.7), 12, 8))
    parts.append(cyl("tap", 0.03, 0.4, (0, 0.33, TOP), p["steel"], 12))
    parts.append(cyl("spout", 0.025, 0.2, (0, 0.33, TOP + 0.38), p["steel"], 12, rot=(math.pi / 2, 0, 0)))
    for i in range(4):
        parts.append(cyl("plate", 0.13, 0.025, (-0.42, 0.25, TOP + 0.02 + i * 0.03), p["cream"], 20))
    return join("st_sink", parts)


def trash_bin(p):
    """Round kitchen bin with a swing lid; the chef drops unwanted food in it."""
    prof = [(0.0, 0.0), (0.22, 0.0), (0.25, 0.04), (0.29, 0.62), (0.31, 0.66), (0.0, 0.66)]
    parts = [lathe("body", prof, (0, 0, 0), p["teal"], 28)]
    parts.append(cyl("foot", 0.235, 0.05, (0, 0, 0), p["teal_d"], 28, round_=0.015))
    parts.append(cyl("band", 0.282, 0.07, (0, 0, 0.42), p["yellow"], 28, round_=0.02))
    parts.append(cyl("rim", 0.32, 0.06, (0, 0, 0.64), p["teal_d"], 28, round_=0.025))
    parts.append(sphere("lid", 0.3, (0, 0, 0.69), p["orange"], (1, 1, 0.42), 28, 12, cut_below=0.0))
    parts.append(box("flap", (0.26, 0.06, 0.12), (0, -0.2, 0.74), p["red_d"], 0.02, rot=(0.5, 0, 0)))
    parts.append(sphere("knob", 0.05, (0, 0, 0.82), p["yellow"], (1, 1, 0.8), 14, 8))
    return join("trash_bin", parts)


def upgrade_board(p):
    """A-frame menu board that opens the upgrades panel."""
    parts = []
    for sx in (-1, 1):
        parts.append(box("leg", (0.06, 0.06, 1.3), (sx * 0.42, 0.12, 0.62), p["wood_d"], 0.02, rot=(0.17, 0, 0)))
    parts.append(box("board", (0.86, 0.06, 0.82), (0, 0.04, 0.88), p["wood"], 0.03, rot=(0.17, 0, 0)))
    parts.append(box("face", (0.74, 0.02, 0.7), (0, 0.0, 0.88), p["char"], 0.02, rot=(0.17, 0, 0)))
    # big up arrow drawn on the board
    parts.append(box("shaft", (0.12, 0.02, 0.3), (0, -0.014, 0.8), p["yellow"], 0.02, rot=(0.17, 0, 0)))
    tri = cyl("head", 0.2, 0.025, (0, -0.02, 1.0), p["yellow"], 3, rot=(math.pi / 2 + 0.17, 0, math.pi / 2))
    tri.rotation_euler = (math.pi / 2 + 0.17, math.pi / 6 + math.pi / 2, 0)
    parts.append(tri)
    return join("upgrade_board", parts)


def plant(p, name="plant", tall=True):
    parts = [lathe("pot", [(0.0, 0.0), (0.16, 0.0), (0.22, 0.32), (0.25, 0.34), (0.25, 0.38), (0.0, 0.38)],
                   (0, 0, 0), p["terra"], 24)]
    parts.append(cyl("soil", 0.21, 0.02, (0, 0, 0.35), p["soil"], 20))
    rng = seeded(21 if tall else 22)
    n = 7 if tall else 5
    for i in range(n):
        a = math.tau * i / n + rng.uniform(-0.3, 0.3)
        h = rng.uniform(0.55, 0.95) if tall else rng.uniform(0.35, 0.5)
        lf = sphere("leaf", 0.12, (0.12 * math.cos(a), 0.12 * math.sin(a), 0.36 + h * 0.6),
                    p["leaf"] if i % 2 else p["leaf_d"], (0.6, 0.6, h * 2.2), 12, 8)
        lf.rotation_euler = (0.35 * math.sin(a), -0.35 * math.cos(a), 0)
        parts.append(lf)
    return join(name, parts)


def tree(p, name, seed, scale=1.0):
    rng = seeded(seed)
    parts = [cyl("trunk", 0.16 * scale, 1.2 * scale, (0, 0, 0), p["wood_d"], 12, r_top=0.12 * scale)]
    blobs = [(0, 0, 1.75, 0.85), (0.45, 0.2, 1.45, 0.55), (-0.4, -0.25, 1.5, 0.6), (0.1, -0.35, 2.25, 0.55)]
    for i, (x, y, z, r) in enumerate(blobs):
        parts.append(sphere("crown", r * scale, (x * scale, y * scale, z * scale),
                            p["leaf"] if i % 2 == 0 else p["green"], (1, 1, 0.92), 20, 12))
    _ = rng
    return join(name, parts)


def bush(p):
    parts = []
    for i, (x, y, r) in enumerate(((0, 0, 0.42), (0.38, 0.1, 0.32), (-0.36, 0.05, 0.3), (0.05, 0.3, 0.3))):
        parts.append(sphere("b", r, (x, y, r * 0.75), p["leaf"] if i % 2 else p["green"], (1, 1, 0.85), 16, 10))
    for i in range(5):
        a = i * 1.3
        parts.append(sphere("flower", 0.06, (0.35 * math.cos(a), 0.3 * math.sin(a), 0.52), p["pink"], (1, 1, 0.7),
                            8, 6))
    return join("bush", parts)


def lamp_post(p):
    parts = [cyl("base", 0.16, 0.2, (0, 0, 0), p["purple_d"], 16, round_=0.03)]
    parts.append(cyl("pole", 0.06, 2.6, (0, 0, 0.2), p["purple"], 12))
    parts.append(sphere("bulb", 0.22, (0, 0, 2.95), p["cream"], (1, 1, 1.1), 16, 10))
    parts.append(cyl("cap", 0.26, 0.1, (0, 0, 3.12), p["purple_d"], 16, r_top=0.1))
    return join("lamp_post", parts)


def bench(p):
    parts = []
    for i in range(3):
        parts.append(box("slat", (1.5, 0.12, 0.05), (0, -0.14 + i * 0.14, 0.45), p["wood"], 0.02))
    for i in range(2):
        parts.append(box("back", (1.5, 0.05, 0.1), (0, 0.26, 0.62 + i * 0.16), p["wood"], 0.02))
    for sx in (-1, 1):
        parts.append(box("frame", (0.08, 0.5, 0.45), (sx * 0.62, 0.0, 0.225), p["purple_d"], 0.02))
        parts.append(box("frameb", (0.08, 0.06, 0.45), (sx * 0.62, 0.27, 0.6), p["purple_d"], 0.02))
    return join("bench", parts)


def car(p, name, body, accent):
    parts = [box("body", (1.8, 3.4, 0.6), (0, 0, 0.55), body, 0.18)]
    parts.append(box("cab", (1.55, 1.8, 0.55), (0, 0.15, 1.08), body, 0.2))
    parts.append(box("glass", (1.58, 1.6, 0.36), (0, 0.15, 1.12), p["glass"], 0.14))
    parts.append(box("stripe", (1.82, 3.0, 0.1), (0, 0, 0.6), accent, 0.04))
    for sx in (-1, 1):
        for sy in (-1, 1):
            w = cyl("wheel", 0.32, 0.26, (sx * 0.8 - 0.13 * (1 if sx > 0 else 0) + 0.0, sy * 1.1, 0.32), p["tire"], 20,
                    rot=(0, math.pi / 2, 0))
            w.location = (sx * 0.78 - 0.13, sy * 1.1, 0.32) if sx > 0 else (sx * 0.78 + 0.13 - 0.26, sy * 1.1, 0.32)
            parts.append(w)
            parts.append(cyl("hub", 0.14, 0.28, (w.location[0] - 0.01, sy * 1.1, 0.32), p["steel"], 14,
                             rot=(0, math.pi / 2, 0)))
    for sx in (-1, 1):
        parts.append(sphere("light", 0.12, (sx * 0.6, -1.68, 0.62), p["yellow"], (1, 0.5, 0.8), 12, 8))
    return join(name, parts)


def food_truck(p):
    """Walk-in truck body, roofless so the iso camera sees inside. Serving hatch on +X, door gap at the
    cab end of the hatch side, cab at -Y. Origin = centre of the interior floor (floor top at 0)."""
    parts = []
    L, W, H = 9.0, 3.3, 2.5
    T = 0.16
    door = 1.6  # door gap length on the hatch side, next to the cab
    # floor slab edge and skirt
    parts.append(box("floor", (W + 0.3, L + 0.3, 0.14), (0, 0, -0.07), p["purple_d"], 0.04))
    # back (-X) wall: pink outside, red wainscot inside, yellow belt line outside
    parts.append(box("wall_l", (T, L + T, H), (-W / 2, 0, H / 2), p["pink"], 0.05))
    parts.append(box("wains_l", (0.04, L - 0.1, 0.85), (-W / 2 + T / 2 + 0.02, 0, 0.43), p["red"], 0.015))
    parts.append(box("belt_l", (0.06, L + T, 0.26), (-W / 2 - T / 2 - 0.02, 0, 1.05), p["yellow"], 0.02))
    # end wall (+Y)
    parts.append(box("wall_end", (W + T, T, H), (0, L / 2, H / 2), p["pink"], 0.05))
    parts.append(box("wains_e", (W - 0.2, 0.04, 0.85), (0, L / 2 - T / 2 - 0.02, 0.43), p["red"], 0.015))
    parts.append(box("belt_e", (W + T, 0.06, 0.26), (0, L / 2 + T / 2 + 0.02, 1.05), p["yellow"], 0.02))
    # roof rim along the two tall walls
    parts.append(box("rim_l", (0.42, L + 0.4, 0.16), (-W / 2 + 0.05, 0, H + 0.06), p["purple"], 0.05))
    parts.append(box("rim_e", (W + 0.4, 0.42, 0.16), (0.05, L / 2 - 0.05, H + 0.06), p["purple"], 0.05))
    # hatch side: low wall with a wide yellow shelf, from the end wall to the door gap
    y0, y1 = -L / 2 + door, L / 2
    hl = y1 - y0
    hc = (y0 + y1) / 2
    parts.append(box("hatch_low", (T, hl, 0.9), (W / 2, hc, 0.45), p["pink"], 0.04))
    parts.append(box("hatch_belt", (0.06, hl, 0.2), (W / 2 + T / 2 + 0.02, hc, 0.62), p["yellow"], 0.02))
    parts.append(box("shelf", (0.78, hl + 0.1, 0.09), (W / 2 + 0.16, hc, 0.98), p["yellow"], 0.03))
    parts.append(box("shelf_lip", (0.08, hl + 0.1, 0.06), (W / 2 + 0.53, hc, 1.04), p["orange"], 0.02))
    # posts only at the hatch ends so the shelf stays clear for the register and the pass
    for y in (y0, y1):
        parts.append(box("post", (0.16, 0.2, H - 0.9), (W / 2, y, 0.9 + (H - 0.9) / 2), p["pink_d"], 0.05))
    parts.append(box("beam", (0.24, hl + 0.2, 0.2), (W / 2, hc, H - 0.04), p["yellow"], 0.05))
    # door frame at the cab end
    parts.append(box("door_post", (0.16, 0.2, H), (W / 2, -L / 2 + 0.05, H / 2), p["pink_d"], 0.05))
    parts.append(box("step", (0.5, door - 0.2, 0.1), (W / 2 + 0.3, -L / 2 + door / 2, 0.05), p["steel_d"], 0.03))
    # wheels in arches on the back wall side
    for y in (-L / 2 + 1.6, L / 2 - 1.6):
        parts.append(box("arch", (0.12, 1.4, 0.5), (-W / 2 - T / 2 - 0.04, y, 0.4), p["purple_d"], 0.06))
        parts.append(cyl("tire", 0.46, 0.34, (-W / 2 - 0.4, y, 0.1), p["tire"], 20,
                         rot=(0, math.pi / 2, 0)))
        parts.append(cyl("hub", 0.2, 0.05, (-W / 2 - 0.38, y, 0.1), p["steel"], 14, rot=(0, -math.pi / 2, 0)))
    # cab at -Y
    cy = -L / 2 - 1.0
    parts.append(box("cab", (W + T, 2.0, 1.7), (0, cy, 0.85), p["pink_d"], 0.3))
    parts.append(box("cab_top", (W - 0.2, 1.5, 0.75), (0, cy + 0.2, 2.0), p["pink"], 0.28))
    parts.append(box("windshield", (W - 0.6, 0.1, 0.55), (0, cy - 0.58, 2.02), p["glass"], 0.08,
                     rot=(0.35, 0, 0)))
    for x in (-1, 1):
        parts.append(box("side_win", (0.08, 0.8, 0.5), (x * (W / 2 - 0.08), cy + 0.25, 2.0), p["glass"], 0.06))
        parts.append(sphere("headlight", 0.2, (x * (W / 2 - 0.45), cy - 1.0, 0.95), p["cream"], (1, 0.5, 1),
                            14, 8))
        parts.append(cyl("tire", 0.46, 0.34, (W / 2 - 0.22 if x > 0 else -W / 2 - 0.12, cy + 0.2, 0.1),
                         p["tire"], 20, rot=(0, math.pi / 2, 0)))
    parts.append(box("grille", (1.4, 0.08, 0.5), (0, cy - 1.0, 0.7), p["steel"], 0.06))
    parts.append(box("bumper", (W + 0.3, 0.3, 0.22), (0, cy - 1.02, 0.25), p["steel_d"], 0.08))
    return join("food_truck", parts)


def menu_sign(p):
    parts = [box("frame", (1.4, 0.12, 0.9), (0, 0, 0.45), p["yellow"], 0.06)]
    parts.append(box("face", (1.24, 0.04, 0.74), (0, -0.05, 0.45), p["red"], 0.04))
    for i in range(3):
        parts.append(box("line", (0.8 - i * 0.12, 0.02, 0.08), (-0.1, -0.075, 0.66 - i * 0.18), p["cream"], 0.03))
        parts.append(sphere("dot", 0.05, (0.46, -0.08, 0.66 - i * 0.18), p["yellow"], (1, 0.5, 1), 10, 6))
    return join("menu_sign", parts)


def parasol(p):
    """Beach umbrella: a domed canopy in alternating pink and yellow panels with a scalloped rim."""
    parts = [cyl("pole", 0.04, 2.2, (0, 0, 0), p["cream"], 10)]
    canopy = lathe("canopy", [(0.0, 2.36), (0.35, 2.32), (0.8, 2.18), (1.2, 1.98), (1.26, 1.92), (1.2, 1.9),
                              (0.0, 2.02)], (0, 0, 0), p["pink"], 16)
    canopy.data.materials.append(p["yellow"])
    for poly in canopy.data.polygons:
        c = poly.center
        k = int(((math.atan2(c.y, c.x) + math.pi) / math.tau) * 8) % 2
        poly.material_index = k
    parts.append(canopy)
    parts.append(sphere("tip", 0.07, (0, 0, 2.38), p["yellow"], (1, 1, 1), 10, 6))
    return join("parasol", parts)


def picnic_table(p):
    parts = [box("top", (1.6, 0.8, 0.07), (0, 0, 0.66), p["teal"], 0.03)]
    for sy in (-1, 1):
        parts.append(box("seat", (1.6, 0.3, 0.06), (0, sy * 0.62, 0.42), p["teal_d"], 0.025))
        for sx in (-1, 1):
            parts.append(box("leg", (0.07, 0.07, 0.42), (sx * 0.65, sy * 0.62, 0.2), p["wood_d"], 0.015))
    for sx in (-1, 1):
        parts.append(box("tleg", (0.08, 0.08, 0.63), (sx * 0.65, 0, 0.32), p["wood_d"], 0.015))
    return join("picnic_table", parts)


def palm(p):
    parts = []
    segs = 7
    for i in range(segs):
        z = i * 0.42
        x = 0.06 * i * i * 0.18
        parts.append(cyl("trunk", 0.16 - i * 0.008, 0.44, (x, 0, z), p["wood"] if i % 2 else p["wood_d"], 10,
                         r_top=0.15 - i * 0.008))
    top = (0.06 * segs * segs * 0.18, 0, segs * 0.42)
    for i in range(7):
        a = math.tau * i / 7
        lf = sphere("frond", 0.5, (top[0] + 0.55 * math.cos(a), top[1] + 0.55 * math.sin(a), top[2] - 0.05),
                    p["leaf"] if i % 2 else p["green"], (1.5, 0.42, 0.12), 12, 6)
        lf.rotation_euler = (0, 0.32, a)
        parts.append(lf)
    parts.append(sphere("nuts", 0.12, top, p["wood_d"], (1, 1, 1), 10, 6))
    return join("palm", parts)


def tray(p):
    """Output rack next to a station where finished dishes wait."""
    parts = [box("base", (0.62, 0.62, 0.06), (0, 0, 0.03), p["steel_d"], 0.02)]
    for i in range(4):
        parts.append(box("bar", (0.6, 0.03, 0.02), (0, -0.22 + i * 0.147, 0.07), p["steel"], 0.008))
    return join("tray", parts)


def window(p):
    parts = [box("frame", (1.6, 0.12, 1.2), (0, 0, 0.6), p["cream"], 0.04)]
    parts.append(box("glass", (1.4, 0.1, 1.0), (0, -0.015, 0.6), p["glass"], 0.02))
    parts.append(box("mull", (0.06, 0.13, 1.1), (0, 0, 0.6), p["cream"], 0.015))
    parts.append(box("sill", (1.7, 0.22, 0.08), (0, -0.06, 0.02), p["yellow"], 0.03))
    return join("window", parts)


def lounger(p):
    parts = [box("bed", (0.62, 1.5, 0.08), (0, 0.15, 0.3), p["teal"], 0.03)]
    back = box("back", (0.62, 0.7, 0.07), (0, -0.78, 0.55), p["teal_d"], 0.03, rot=(-0.85, 0, 0))
    parts.append(back)
    for i in range(4):
        parts.append(box("slat", (0.64, 0.06, 0.02), (0, -0.4 + i * 0.36, 0.35), p["cream"], 0.01))
    for sx in (-1, 1):
        for y in (-0.45, 0.75):
            parts.append(box("leg", (0.05, 0.05, 0.28), (sx * 0.27, y, 0.13), p["steel_d"], 0.012))
    parts.append(box("towel", (0.5, 1.0, 0.03), (0, 0.25, 0.35), p["pink"], 0.012))
    return join("lounger", parts)


def beach_ball(p):
    """One sphere with six coloured wedges, assigned per face by longitude."""
    cols = [p["red"], p["cream"], p["blue"], p["yellow"], p["cream"], p["green"]]
    ball = sphere("beach_ball", 0.28, (0, 0, 0.28), cols[0], (1, 1, 1), 24, 12)
    for c in cols[1:]:
        if c.name not in [m.name for m in ball.data.materials]:
            ball.data.materials.append(c)
    names = [m.name for m in ball.data.materials]
    for poly in ball.data.polygons:
        c = poly.center
        if abs(c.z) > 0.25:
            poly.material_index = names.index(cols[1].name)
            continue
        k = int(((math.atan2(c.y, c.x) + math.pi) / math.tau) * 6) % 6
        poly.material_index = names.index(cols[k].name)
    return ball


def surfboard(p, name, body, stripe):
    parts = [sphere("board", 1.0, (0, 0, 0.04), body, (0.27, 1.0, 0.035), 24, 10)]
    parts.append(box("stripe", (0.06, 1.7, 0.02), (0, 0, 0.075), stripe, 0.01))
    parts.append(box("fin", (0.03, 0.18, 0.14), (0, 0.75, -0.02), stripe, 0.01))
    return join(name, parts)


def rock(p, name, seed):
    rnd = seeded(seed)
    parts = []
    for i in range(3):
        r = 0.35 + rnd.random() * 0.35
        parts.append(sphere("stone", r, ((rnd.random() - 0.5) * 0.7, (rnd.random() - 0.5) * 0.7, r * 0.35),
                            p["steel_d"] if i % 2 else p["char_l"], (1.2, 1.0, 0.7), 10, 6))
    return join(name, parts)


def lifeguard_tower(p):
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box("leg", (0.12, 0.12, 2.0), (sx * 0.6, sy * 0.6, 1.0), p["cream"], 0.03))
    parts.append(box("deck", (1.7, 1.7, 0.12), (0, 0, 2.05), p["wood"], 0.03))
    parts.append(box("hut", (1.4, 1.2, 1.1), (0, 0.15, 2.65), p["red"], 0.06))
    parts.append(box("roof", (1.7, 1.6, 0.14), (0, 0.15, 3.25), p["yellow"], 0.05, rot=(0.12, 0, 0)))
    parts.append(box("win", (1.0, 0.06, 0.45), (0, -0.46, 2.8), p["glass"], 0.03))
    for i in range(5):
        parts.append(box("rung", (0.7, 0.06, 0.06), (0, -1.15, 0.3 + i * 0.36), p["cream"], 0.02))
    parts.append(box("rail", (0.06, 0.06, 2.0), (-0.38, -1.15, 1.0), p["cream"], 0.02))
    parts.append(box("rail", (0.06, 0.06, 2.0), (0.38, -1.15, 1.0), p["cream"], 0.02))
    parts.append(torus("ring", 0.22, 0.07, (0.72, -0.2, 2.6), p["red"], 20, 10))
    return join("lifeguard_tower", parts)


def bollard(p):
    parts = [cyl("post", 0.09, 0.8, (0, 0, 0), p["wood_d"], 12, round_=0.02)]
    parts.append(cyl("cap", 0.11, 0.06, (0, 0, 0.8), p["wood"], 12, round_=0.02))
    parts.append(torus("rope", 0.11, 0.03, (0, 0, 0.62), p["cream"], 16, 8))
    return join("bollard", parts)



def rope(name, a, b, sag, r, material, n=6):
    """A rope hanging between a and b (Blender coords) with the given sag, as a chain of short cylinders."""
    out = []
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                    a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)))
    for i in range(n):
        p0, p1 = pts[i], pts[i + 1]
        dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
        ln = math.sqrt(dx * dx + dy * dy + dz * dz)
        tilt = math.acos(max(-1.0, min(1.0, dz / ln)))
        yaw = math.atan2(dy, dx) - math.pi / 2
        seg = cyl(name, r, ln + r, p0, material, 8)
        seg.rotation_euler = (tilt, 0, yaw)
        out.append(seg)
    return out, pts


def rug_round(p):
    """Round rug that sits under a dining table and its chairs; teal ties it to the kitchen tiles."""
    parts = [cyl("rug", 1.42, 0.012, (0, 0, 0), p["teal_d"], 56)]
    parts.append(cyl("band", 1.3, 0.016, (0, 0, 0), p["cream"], 56))
    parts.append(cyl("field", 1.22, 0.02, (0, 0, 0), p["teal"], 56))
    for i in range(14):
        a = math.tau * i / 14
        parts.append(cyl("dot", 0.07, 0.024, (1.04 * math.cos(a), 1.04 * math.sin(a), 0), p["yellow"], 12))
    parts.append(cyl("heart", 0.62, 0.024, (0, 0, 0), p["mint"], 40))
    return join("rug_round", parts)


def rug_stripe(p):
    """Striped outdoor mat under a picnic table on the deck."""
    parts = []
    cols = [p["pink"], p["cream"], p["orange"], p["cream"], p["pink"], p["cream"], p["orange"]]
    w = 2.6 / len(cols)
    for i, m in enumerate(cols):
        parts.append(box("stripe", (w, 2.3, 0.014), (-1.3 + w * (i + 0.5), 0, 0.007), m))
    parts.append(box("hem", (2.7, 2.4, 0.01), (0, 0, 0.005), p["pink_d"], 0.004))
    return join("rug_stripe", parts)


def stanchion(p):
    """Brass queue post; ropes run from it toward three.js +Z."""
    parts = [cyl("base", 0.17, 0.05, (0, 0, 0), p["yellow_d"], 20, round_=0.02)]
    parts.append(cyl("post", 0.035, 0.86, (0, 0, 0.04), p["yellow"], 12))
    parts.append(sphere("knob", 0.07, (0, 0, 0.92), p["yellow_d"], (1, 1, 1), 14, 8))
    return join("stanchion", parts)


def queue_rope(p, length=2.0):
    """Red velvet rope from this post to the next one, `length` metres toward three.js +Z (Blender -Y)."""
    segs, _ = rope("rope", (0, 0, 0.84), (0, -length, 0.84), 0.2, 0.03, p["red"], 8)
    for e in (0, -length):
        segs.append(sphere("hook", 0.045, (0, e, 0.84), p["yellow_d"], (1, 1, 1), 10, 6))
    return join("queue_rope", segs)


def pennant_rope(p, length=1.55):
    """Rope with little flags strung from bollard to bollard, toward three.js +Z."""
    parts, pts = rope("rope", (0, 0, 0.66), (0, -length, 0.66), 0.14, 0.022, p["cream"], 6)
    cols = [p["pink"], p["yellow"], p["teal"], p["orange"]]
    for i in range(1, 6):
        x, y, z = pts[i]
        bm_flag = box("flag", (0.012, 0.18, 0.16), (x, y, z - 0.1), cols[i % 4])
        bm_flag.scale = (1, 1, 1)
        parts.append(bm_flag)
        parts.append(cyl("tip", 0.01, 0.1, (x, y, z - 0.28), cols[i % 4], 3, r_top=0.09, rot=(math.pi, 0, 0)))
    return join("pennant_rope", parts)


def jukebox(p):
    """Arched jukebox with glowing tubes; a bit of diner life by the windows."""
    parts = [box("body", (0.9, 0.55, 1.1), (0, 0, 0.55), p["purple"], 0.06)]
    parts.append(cyl("arch", 0.45, 0.55, (0, 0.275, 1.1), p["purple"], 32, rot=(math.pi / 2, 0, 0)))
    parts.append(torus("tube", 0.4, 0.045, (0, -0.29, 1.1), p["glow"], 32, 8))
    for sx in (-1, 1):
        parts.append(box("side", (0.09, 0.08, 1.0), (sx * 0.4, -0.29, 0.6), p["glow"], 0.03))
    parts.append(box("window", (0.6, 0.04, 0.32), (0, -0.28, 0.86), p["screen"], 0.03))
    for i in range(5):
        parts.append(box("key", (0.08, 0.05, 0.05), (-0.2 + i * 0.1, -0.29, 0.62), p["cream"], 0.015))
    parts.append(box("grille", (0.66, 0.04, 0.3), (0, -0.28, 0.3), p["pink_d"], 0.03))
    for i in range(4):
        parts.append(box("slat", (0.6, 0.05, 0.03), (0, -0.3, 0.2 + i * 0.07), p["pink"], 0.01))
    parts.append(box("plinth", (0.96, 0.6, 0.08), (0, 0, 0.04), p["purple_d"], 0.03))
    return join("jukebox", parts)


def gumball(p):
    """Gumball machine: glass globe of coloured balls on a red stand."""
    parts = [cyl("foot", 0.2, 0.06, (0, 0, 0), p["red_d"], 20, round_=0.02)]
    parts.append(cyl("leg", 0.06, 0.62, (0, 0, 0.05), p["red"], 14))
    parts.append(box("box", (0.32, 0.32, 0.26), (0, 0, 0.8), p["red"], 0.05))
    parts.append(cyl("chute", 0.06, 0.05, (0, -0.16, 0.72), p["yellow"], 12, rot=(math.pi / 2, 0, 0)))
    parts.append(cyl("coin", 0.05, 0.04, (0, -0.15, 0.85), p["steel"], 12, rot=(math.pi / 2, 0, 0)))
    rng = seeded(4)
    cols = [p["yellow"], p["teal"], p["pink"], p["orange"], p["green"], p["blue"]]
    for i in range(22):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(0, 0.17)
        parts.append(sphere("ball", 0.045, (rr * math.cos(a), rr * math.sin(a), 0.98 + rng.uniform(0, 0.16)),
                            cols[i % len(cols)], (1, 1, 1), 8, 5))
    parts.append(sphere("globe", 0.23, (0, 0, 1.1), p["glass"], (1, 1, 1), 24, 12, cut_below=-0.16))
    parts.append(cyl("lid", 0.12, 0.08, (0, 0, 1.31), p["red"], 16, round_=0.03))
    return join("gumball", parts)


def crates(p):
    """Two stacked wooden crates of lemons and a melon."""
    parts = []
    for (x, y, z, rz) in ((0, 0, 0, 0), (0.62, 0.05, 0, 0.15), (0.3, 0.02, 0.42, -0.1)):
        c = box("crate", (0.56, 0.44, 0.4), (x, y, z + 0.2), p["wood"], 0.02, rot=(0, 0, rz))
        parts.append(c)
        for k in (-1, 1):
            parts.append(box("slat", (0.58, 0.46, 0.05), (x, y, z + 0.2 + k * 0.1), p["wood_d"], 0.015,
                             rot=(0, 0, rz)))
    rng = seeded(12)
    for i in range(7):
        parts.append(sphere("lemon", 0.07, (0.3 + rng.uniform(-0.18, 0.18), 0.02 + rng.uniform(-0.12, 0.12),
                                             0.84 + rng.uniform(0, 0.04)), p["yellow"], (1.25, 1, 1), 10, 6))
    parts.append(sphere("melon", 0.16, (0.62, 0.05, 0.52), p["green"], (1.1, 1, 0.95), 16, 10))
    return join("crates", parts)


def cooler(p):
    parts = [box("body", (0.7, 0.45, 0.42), (0, 0, 0.23), p["teal"], 0.06)]
    parts.append(box("lid", (0.74, 0.49, 0.1), (0, 0, 0.48), p["cream"], 0.04))
    parts.append(box("band", (0.72, 0.47, 0.06), (0, 0, 0.12), p["teal_d"], 0.02))
    parts.append(box("handle", (0.26, 0.06, 0.05), (0, 0, 0.56), p["yellow"], 0.02))
    for sx in (-1, 1):
        parts.append(box("latch", (0.08, 0.04, 0.1), (sx * 0.2, -0.25, 0.42), p["yellow"], 0.015))
    return join("cooler", parts)


def planter_box(p):
    """Long wooden planter with round flower clumps."""
    parts = [box("box", (1.2, 0.45, 0.4), (0, 0, 0.2), p["wood"], 0.03)]
    parts.append(box("rim", (1.28, 0.52, 0.06), (0, 0, 0.42), p["wood_d"], 0.02))
    parts.append(box("soil", (1.1, 0.36, 0.04), (0, 0, 0.42), p["soil"]))
    rng = seeded(5)
    for i in range(5):
        x = -0.44 + i * 0.22
        parts.append(sphere("leaf", 0.17, (x, rng.uniform(-0.05, 0.05), 0.55), p["leaf"] if i % 2 else p["green"],
                            (1, 1, 0.85), 12, 7))
        parts.append(sphere("bloom", 0.06, (x + 0.03, -0.1, 0.7), p["pink"] if i % 2 else p["yellow"], (1, 1, 1), 8, 5))
    return join("planter_box", parts)


def red_carpet(p):
    """Gem-shop picture for the VIP perk: a red carpet half rolled out between two brass posts."""
    parts = [box("run", (0.7, 1.3, 0.02), (0, -0.25, 0.01), p["red"])]
    for sx in (-1, 1):
        parts.append(box("trim", (0.06, 1.3, 0.024), (sx * 0.32, -0.25, 0.012), p["yellow"]))
    parts.append(cyl("roll", 0.16, 0.76, (-0.38, 0.5, 0.16), p["red_d"], 24, rot=(0, math.pi / 2, 0)))
    for sx in (-1, 1):
        parts.append(cyl("rollend", 0.165, 0.02, (sx * 0.37, 0.5, 0.16), p["yellow"], 24, rot=(0, math.pi / 2, 0)))
        parts.append(cyl("post", 0.035, 0.7, (sx * 0.55, -0.6, 0), p["yellow"], 12))
        parts.append(sphere("knob", 0.06, (sx * 0.55, -0.6, 0.72), p["yellow_d"], (1, 1, 1), 12, 8))
    r, _ = rope("rope", (-0.55, -0.6, 0.66), (0.55, -0.6, 0.66), 0.14, 0.025, p["red"], 6)
    parts.extend(r)
    parts.append(sphere("star", 0.08, (0, -0.65, 0.03), p["yellow"], (1, 1, 0.2), 10, 6))
    return join("red_carpet", parts)


def main():
    reset()
    p = P()
    items = [grill(p), fryer(p), soda(p), sundae(p), oven(p), hotdog_roller(p), counter_seg(p), counter_end(p),
             register(p), table(p), chair(p), sink(p), trash_bin(p), upgrade_board(p), plant(p, "plant"),
             plant(p, "plant_small", False), tree(p, "tree", 1), tree(p, "tree_big", 2, 1.3), bush(p),
             lamp_post(p), bench(p), car(p, "car_a", p["teal"], p["yellow"]), car(p, "car_b", p["orange"], p["cream"]),
             food_truck(p), menu_sign(p), parasol(p), picnic_table(p), palm(p), tray(p), window(p),
             lounger(p), beach_ball(p), surfboard(p, 'surfboard_a', p['teal'], p['yellow']),
             surfboard(p, 'surfboard_b', p['pink'], p['cream']), rock(p, 'rock', 3), lifeguard_tower(p), bollard(p),
             rug_round(p), rug_stripe(p), stanchion(p), queue_rope(p), pennant_rope(p), jukebox(p), gumball(p),
             crates(p), cooler(p), planter_box(p), red_carpet(p)]
    total = 0
    for ob in items:
        t = tri_count(ob)
        total += t
        print(f"{ob.name}: {t}")
    print("total", total)
    export(os.path.join(ASSETS, "props.glb"), items)
    print("OK props.glb")


main()
