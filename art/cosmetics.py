"""Wearables: hats, clothes and shoes. Modelled in character space (feet at the origin, facing -Y) so the
game can parent each one to a bone with that bone's inverse bind matrix. No faces, ever.

Run: python3 art/cosmetics.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import ASSETS, box, cyl, export, join, mat, reset, sphere, torus, tri_count  # noqa: E402

HEAD_Z = 0.935
HEAD_R = 0.215
TOP = HEAD_Z + HEAD_R


def M():
    return {
        "cream": mat("cream", "#fff1dc", 0.6),
        "red": mat("red", "#ff3b4e", 0.45),
        "red_d": mat("red_d", "#c92539", 0.5),
        "gold": mat("gold", "#ffc531", 0.3, 0.2),
        "gold_d": mat("gold_d", "#e09a12", 0.35, 0.2),
        "ruby": mat("ruby", "#ff2d6f", 0.2),
        "sapph": mat("sapph", "#3f8cff", 0.2),
        "brown": mat("brown", "#a8612f", 0.6),
        "brown_d": mat("brown_d", "#7a4220", 0.6),
        "band": mat("band", "#2b2245", 0.5),
        "teal": mat("teal", "#1fd1b5", 0.4),
        "sole": mat("sole", "#fff4e6", 0.6),
        "orange": mat("orange", "#ff8a2b", 0.5),
        "stripe_a": mat("stripe_a", "#3fa9f5", 0.55),
        "stripe_b": mat("stripe_b", "#ffd23f", 0.55),
        "purple": mat("purple", "#8a5cf5", 0.5),
        "pink": mat("pink", "#ff79b4", 0.5),
    }


def head_r_at(z):
    return math.sqrt(max(0.0, HEAD_R ** 2 - (z - HEAD_Z) ** 2))


def toque(m):
    z0 = TOP - 0.075
    parts = [cyl("band", head_r_at(z0) + 0.012, 0.085, (0, 0, z0), m["cream"], 32, r_top=head_r_at(z0) + 0.02)]
    # three puffs make the classic pleated chef hat top
    parts.append(sphere("puff", 0.19, (0, 0, TOP + 0.12), m["cream"], (1, 1, 0.8), 24, 14))
    for a in (0, 2.1, 4.2):
        parts.append(sphere("p", 0.12, (math.cos(a) * 0.09, math.sin(a) * 0.09, TOP + 0.17), m["cream"], (1, 1, 0.9), 18, 10))
    parts.append(torus("rim", head_r_at(z0) + 0.02, 0.018, (0, 0, z0 + 0.008), m["red"], 32, 8))
    return join("cos_hat_toque", parts)


def cap(m):
    z0 = HEAD_Z + 0.07
    parts = [sphere("crown", HEAD_R + 0.018, (0, 0, HEAD_Z + 0.01), m["red"], (1, 1, 1), 28, 16, cut_below=z0 - HEAD_Z - 0.01)]
    parts.append(box("brim", (0.24, 0.2, 0.025), (0, -0.25, z0 + 0.01), m["red_d"], 0.012, 2, rot=(-0.18, 0, 0)))
    parts.append(sphere("button", 0.025, (0, 0, TOP + 0.02), m["stripe_b"], (1, 1, 0.6), 12, 8))
    return join("cos_hat_cap", parts)


def crown(m):
    z0 = TOP - 0.08
    r = head_r_at(z0) + 0.015
    parts = [cyl("ring", r, 0.07, (0, 0, z0), m["gold"], 36, r_top=r + 0.02)]
    for i in range(5):
        a = i / 5 * math.tau + math.pi / 2
        x, y = math.cos(a) * (r + 0.01), math.sin(a) * (r + 0.01)
        parts.append(cyl("spike", 0.045, 0.11, (x, y, z0 + 0.06), m["gold"], 4, r_top=0.002, rot=(0, 0, a)))
        parts.append(sphere("ball", 0.022, (x * 1.0, y * 1.0, z0 + 0.175), m["gold_d"], (1, 1, 1), 10, 6))
        parts.append(sphere("gem", 0.022, (math.cos(a) * (r + 0.02), math.sin(a) * (r + 0.02), z0 + 0.035),
                            m["ruby"] if i % 2 else m["sapph"], (1, 0.5, 1), 10, 6))
    return join("cos_hat_crown", parts)


def cowboy(m):
    z0 = HEAD_Z + 0.08
    parts = [cyl("brim", 0.36, 0.025, (0, 0, z0), m["brown"], 40, round_=0.01)]
    parts.append(cyl("crown", head_r_at(z0) + 0.005, 0.2, (0, 0, z0 + 0.02), m["brown"], 32, r_top=0.15, round_=0.03))
    parts.append(cyl("band", head_r_at(z0) + 0.012, 0.04, (0, 0, z0 + 0.03), m["band"], 32))
    # pinch dent on top
    parts.append(box("dent", (0.05, 0.16, 0.02), (0, 0, z0 + 0.215), m["brown_d"], 0.01, 2))
    return join("cos_hat_cowboy", parts)


def apron(m):
    parts = []
    # bib and skirt hug the front of the torso (the torso is squashed in Y, front at about -0.15)
    for i in range(5):
        mat_ = m["stripe_a"] if i % 2 == 0 else m["stripe_b"]
        parts.append(box("stripe", (0.06, 0.03, 0.36), (-0.12 + i * 0.06, -0.152, 0.47), mat_, 0.01, 2))
    parts.append(box("pocket", (0.18, 0.035, 0.07), (0, -0.168, 0.4), m["cream"], 0.012, 2))
    parts.append(torus("tie", 0.165, 0.012, (0, 0.0, 0.47), m["stripe_a"], 32, 6, scale_z=1.0))
    parts[-1].scale = (1.0, 0.92, 1.0)
    parts.append(box("strap", (0.03, 0.2, 0.02), (0, -0.07, 0.7), m["stripe_a"], 0.008, 2, rot=(0.6, 0, 0)))
    return join("cos_fit_apron", parts)


def bowtie(m):
    parts = [sphere("knot", 0.03, (0, -0.16, 0.7), m["red"], (1, 0.7, 1), 12, 8)]
    for s in (-1, 1):
        parts.append(cyl("wing", 0.055, 0.075, (s * 0.06, -0.155, 0.7), m["red"], 4, r_top=0.022,
                         rot=(0, s * math.pi / 2, 0)))
    return join("cos_fit_bowtie", parts)


def scarf(m):
    parts = [torus("wrap", 0.15, 0.045, (0, 0, 0.71), m["purple"], 32, 12)]
    parts[-1].scale = (1.0, 0.9, 1.0)
    parts.append(torus("wrap2", 0.145, 0.03, (0, 0, 0.665), m["pink"], 32, 10))
    parts.append(box("tail", (0.07, 0.035, 0.2), (0.07, -0.16, 0.58), m["purple"], 0.015, 2, rot=(0.15, 0.2, -0.1)))
    parts.append(box("fringe", (0.07, 0.036, 0.03), (0.082, -0.172, 0.475), m["pink"], 0.01, 2, rot=(0.15, 0.2, -0.1)))
    return join("cos_fit_scarf", parts)


def sneaker(m, side):
    x = 0.09 * side
    parts = [box("sole", (0.17, 0.25, 0.04), (x, -0.045, 0.02), m["sole"], 0.018, 3)]
    parts.append(box("upper", (0.165, 0.22, 0.09), (x, -0.035, 0.08), m["teal"], 0.04, 3))
    parts.append(box("toe", (0.15, 0.06, 0.05), (x, -0.15, 0.05), m["sole"], 0.022, 2))
    parts.append(box("lace", (0.06, 0.07, 0.015), (x, -0.08, 0.128), m["sole"], 0.006, 2, rot=(0.5, 0, 0)))
    return join(f"cos_shoe_sneaker_{'l' if side > 0 else 'r'}", parts)


def boot(m, side):
    x = 0.09 * side
    parts = [box("sole", (0.18, 0.26, 0.05), (x, -0.05, 0.025), m["brown_d"], 0.018, 3)]
    parts.append(box("upper", (0.175, 0.23, 0.17), (x, -0.035, 0.12), m["orange"], 0.045, 3))
    parts.append(box("cuff", (0.185, 0.19, 0.04), (x, -0.01, 0.2), m["brown"], 0.015, 2))
    return join(f"cos_shoe_boot_{'l' if side > 0 else 'r'}", parts)


def main():
    reset()
    m = M()
    items = [toque(m), cap(m), crown(m), cowboy(m), apron(m), bowtie(m), scarf(m)]
    for side in (1, -1):
        items += [sneaker(m, side), boot(m, side)]
    for ob in items:
        print(f"{ob.name}: {tri_count(ob)} tris")
    export(os.path.join(ASSETS, "cosmetics.glb"), items)
    print("OK cosmetics.glb")


main()
