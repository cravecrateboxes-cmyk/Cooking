"""Dishes, money and gems. Each root object becomes one clonable item in food.glb.

Run: python3 art/food.py
Items sit on z=0 and are centred on X/Y. Held items are about 0.3 m across.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import (ASSETS, box, cyl, export, join, lathe, mat, reset, seeded, sphere,  # noqa: E402
                 torus, tri_count)
import bpy  # noqa: E402
import bmesh  # noqa: E402


def M():
    return {
        "bun": mat("bun", "#f2a541", 0.55),
        "bun_top": mat("bun_top", "#e9902b", 0.45),
        "seed": mat("seed", "#fff4d6", 0.5),
        "patty": mat("patty", "#6b3420", 0.7),
        "cheese": mat("cheese", "#ffc928", 0.4),
        "lettuce": mat("lettuce", "#5fcf3c", 0.5),
        "tomato": mat("tomato", "#ff4a3d", 0.35),
        "carton": mat("carton", "#ff3b4e", 0.4),
        "carton_band": mat("carton_band", "#ffd23f", 0.4),
        "fry": mat("fry", "#ffcf4d", 0.55),
        "cup": mat("cup", "#2fa7ff", 0.35),
        "cup_band": mat("cup_band", "#ffffff", 0.35),
        "lid": mat("lid", "#f4f7ff", 0.3),
        "straw": mat("straw", "#ff4f8b", 0.35),
        "crust": mat("crust", "#f0a548", 0.6),
        "sauce": mat("sauce", "#e83b2e", 0.4),
        "mozz": mat("mozz", "#ffe08a", 0.45),
        "pepperoni": mat("pepperoni", "#c42a2a", 0.4),
        "basil": mat("basil", "#2fae4a", 0.45),
        "board": mat("board", "#b9773f", 0.65),
        "cone": mat("cone", "#e7a35a", 0.6),
        "cone_dark": mat("cone_dark", "#c97f37", 0.6),
        "scoop_pink": mat("scoop_pink", "#ff8fc0", 0.4),
        "scoop_mint": mat("scoop_mint", "#7ff0c8", 0.4),
        "cherry": mat("cherry", "#e0192f", 0.2),
        "glass": mat("glass_sundae", "#c8f1ff", 0.12),
        "choc": mat("choc", "#6a3418", 0.35),
        "sprinkle_a": mat("sprinkle_a", "#ffe14d", 0.4),
        "sprinkle_b": mat("sprinkle_b", "#47c7ff", 0.4),
        "sprinkle_c": mat("sprinkle_c", "#9b6bff", 0.4),
        "plate": mat("plate", "#eef3ff", 0.3),
        "plate_rim": mat("plate_rim", "#8fb7ff", 0.3),
        "crumb": mat("crumb", "#c98a49", 0.7),
        "cash": mat("cash", "#3ccf6a", 0.5),
        "cash_dark": mat("cash_dark", "#219a4b", 0.5),
        "band": mat("cash_band", "#fff1b8", 0.5),
        "gem": mat("gem", "#b05bff", 0.12, 0.0),
        "gem_light": mat("gem_light", "#e2b6ff", 0.1),
        "coin": mat("coin", "#ffc21f", 0.3, 0.6),
        "coin_dark": mat("coin_dark", "#e59b00", 0.35, 0.6),
        "sausage": mat("sausage", "#d4513a", 0.35),
        "mustard": mat("mustard", "#ffd400", 0.4),
        "raw": mat("raw_patty", "#e0707b", 0.6),
        "dough": mat("dough", "#ffe6b3", 0.6),
    }


def wavy_disc(name, r, h, waves, amp, loc, material, segs=64):
    """Thin disc whose rim ripples up and down (lettuce)."""
    bm = bmesh.new()
    top, bot = [], []
    for i in range(segs):
        a = math.tau * i / segs
        rr = r * (1 + 0.04 * math.sin(a * waves * 0.5 + 1.3))
        dz = amp * math.sin(a * waves)
        top.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), h + dz)))
        bot.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), dz)))
    ct = bm.verts.new((0, 0, h))
    cb = bm.verts.new((0, 0, 0))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((top[i], top[j], ct))
        bm.faces.new((bot[j], bot[i], cb))
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    ob.location = loc
    for p in me.polygons:
        p.use_smooth = True
    return ob


def drip_slab(name, w, h, droop, loc, material):
    """Cheese slice: square slab whose corners droop over the patty."""
    bm = bmesh.new()
    n = 10
    grid = []
    for iy in range(n + 1):
        row = []
        for ix in range(n + 1):
            x = (ix / n - 0.5) * w
            y = (iy / n - 0.5) * w
            d = max(abs(x), abs(y)) / (w / 2)
            corner = (abs(x) / (w / 2)) * (abs(y) / (w / 2))
            z = -droop * max(0.0, d - 0.62) ** 1.5 * 3.2 - droop * corner ** 2 * 0.8
            row.append((x, y, z))
        grid.append(row)
    top = [[bm.verts.new((x, y, z + h)) for (x, y, z) in row] for row in grid]
    bot = [[bm.verts.new((x, y, z)) for (x, y, z) in row] for row in grid]
    for iy in range(n):
        for ix in range(n):
            bm.faces.new((top[iy][ix], top[iy][ix + 1], top[iy + 1][ix + 1], top[iy + 1][ix]))
            bm.faces.new((bot[iy][ix], bot[iy + 1][ix], bot[iy + 1][ix + 1], bot[iy][ix + 1]))
    edge = [(0, i) for i in range(n)] + [(i, n) for i in range(n)] + \
           [(n, n - i) for i in range(n)] + [(n - i, 0) for i in range(n)]
    for k in range(len(edge)):
        a = edge[k]
        b = edge[(k + 1) % len(edge)]
        bm.faces.new((bot[a[0]][a[1]], bot[b[0]][b[1]], top[b[0]][b[1]], top[a[0]][a[1]]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(material)
    ob.location = loc
    ob.rotation_euler = (0, 0, math.radians(17))
    for p in me.polygons:
        p.use_smooth = True
    return ob


def burger(m):
    parts = []
    parts.append(lathe("b", [(0.0, 0.0), (0.118, 0.0), (0.13, 0.012), (0.132, 0.03), (0.124, 0.045),
                             (0.0, 0.046)], (0, 0, 0), m["bun"]))
    parts.append(lathe("p", [(0.0, 0.0), (0.128, 0.0), (0.14, 0.012), (0.142, 0.03), (0.134, 0.044),
                             (0.0, 0.045)], (0, 0, 0.044), m["patty"]))
    parts.append(drip_slab("c", 0.245, 0.012, 0.018, (0, 0, 0.088), m["cheese"]))
    parts.append(wavy_disc("l", 0.15, 0.012, 9, 0.008, (0, 0, 0.1), m["lettuce"]))
    for i, a in enumerate((0.3, 2.4, 4.5)):
        parts.append(cyl("t", 0.058, 0.014, (0.06 * math.cos(a), 0.06 * math.sin(a), 0.112), m["tomato"], 24))
    top = lathe("bt", [(0.0, 0.0), (0.132, 0.0), (0.138, 0.016), (0.133, 0.045), (0.112, 0.08),
                       (0.075, 0.104), (0.03, 0.114), (0.0, 0.115)], (0, 0, 0.125), m["bun_top"], 40)
    parts.append(top)
    rng = seeded(4)
    for i in range(16):
        a = rng.uniform(0, math.tau)
        rr = math.sqrt(rng.uniform(0.04, 0.85)) * 0.105
        z = 0.125 + 0.115 * (1 - (rr / 0.135) ** 2) ** 0.9 - 0.004
        s = sphere("s", 0.009, (rr * math.cos(a), rr * math.sin(a), z), m["seed"], (1, 1.9, 0.55), 6, 4)
        s.rotation_euler = (0, -0.4 * rr / 0.1 * math.cos(a), a + math.pi / 2)
        parts.append(s)
    return join("food_burger", parts)


def fries(m):
    parts = []
    # carton: flared tapered box, front taller than the back
    parts.append(cyl("cb", 0.085, 0.17, (0, 0, 0), m["carton"], 4, r_top=0.115, round_=0.012,
                     rot=(0, 0, math.pi / 4)))
    parts.append(cyl("bd", 0.094, 0.045, (0, 0, 0.06), m["carton_band"], 4, r_top=0.101,
                     rot=(0, 0, math.pi / 4)))
    rng = seeded(7)
    for i in range(22):
        x = rng.uniform(-0.06, 0.06)
        y = rng.uniform(-0.045, 0.045)
        h = rng.uniform(0.15, 0.2)
        f = box("f", (0.025, 0.025, h), (x, y, 0.1 + h / 2), m["fry"], 0.005, 1,
                rot=(rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), rng.uniform(0, 1.5)))
        parts.append(f)
    return join("food_fries", parts)


def soda(m):
    parts = []
    parts.append(cyl("cup", 0.075, 0.21, (0, 0, 0), m["cup"], 32, r_top=0.095))
    for z, r0, r1 in ((0.06, 0.0807, 0.0835), (0.1, 0.0845, 0.0873)):
        parts.append(cyl("bnd", r0 + 0.001, 0.02, (0, 0, z), m["cup_band"], 32, r_top=r1 + 0.001))
    parts.append(lathe("lid", [(0.0, 0.0), (0.1, 0.0), (0.103, 0.01), (0.09, 0.022), (0.06, 0.03),
                               (0.0, 0.032)], (0, 0, 0.205), m["lid"]))
    straw = cyl("straw", 0.012, 0.16, (0.02, 0, 0.21), m["straw"], 12, rot=(0, 0.25, 0))
    parts.append(straw)
    return join("food_soda", parts)


def pizza(m):
    parts = []
    parts.append(cyl("board", 0.17, 0.016, (0, 0, 0), m["board"], 40, round_=0.005))
    parts.append(torus("crust", 0.135, 0.022, (0, 0, 0.034), m["crust"], 48, 12, scale_z=0.8))
    parts.append(cyl("base", 0.14, 0.018, (0, 0, 0.016), m["crust"], 48))
    parts.append(cyl("sauce", 0.128, 0.006, (0, 0, 0.033), m["sauce"], 48))
    parts.append(lathe("mozz", [(0.0, 0.0), (0.122, 0.0), (0.12, 0.004), (0.1, 0.008), (0.0, 0.01)],
                       (0, 0, 0.037), m["mozz"], 48))
    rng = seeded(11)
    spots = [(0.0, 0.0)] + [(0.07, a) for a in (0.2, 1.4, 2.5, 3.6, 4.7, 5.8)] + \
            [(0.105, a) for a in (0.8, 2.0, 3.1, 4.2, 5.3)]
    for (rr, a) in spots:
        parts.append(cyl("pep", 0.024, 0.008, (rr * math.cos(a), rr * math.sin(a), 0.044), m["pepperoni"], 14))
    for i in range(5):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(0.03, 0.1)
        leaf = sphere("basil", 0.016, (rr * math.cos(a), rr * math.sin(a), 0.05), m["basil"], (1.6, 0.8, 0.25), 8, 5)
        leaf.rotation_euler = (0, 0, rng.uniform(0, math.pi))
        parts.append(leaf)
    return join("food_pizza", parts)


def sundae(m):
    parts = []
    parts.append(lathe("glass", [(0.0, 0.0), (0.06, 0.0), (0.062, 0.01), (0.02, 0.025), (0.016, 0.06),
                                 (0.03, 0.075), (0.085, 0.1), (0.11, 0.135), (0.105, 0.14), (0.0, 0.14)],
                       (0, 0, 0), m["glass"], 36))
    parts.append(sphere("s1", 0.068, (-0.035, 0.01, 0.15), m["scoop_pink"], (1, 1, 0.9), 24, 14))
    parts.append(sphere("s2", 0.066, (0.04, -0.005, 0.15), m["scoop_mint"], (1, 1, 0.9), 24, 14))
    parts.append(sphere("s3", 0.06, (0.0, 0.0, 0.215), m["choc"], (1, 1, 0.85), 24, 14))
    parts.append(lathe("drip", [(0.0, 0.0), (0.06, 0.0), (0.064, 0.012), (0.045, 0.025), (0.0, 0.03)],
                       (0, 0, 0.235), m["cup_band"]))
    parts.append(sphere("cherry", 0.026, (0.006, 0.0, 0.282), m["cherry"], (1, 1, 1), 16, 10))
    parts.append(cyl("stem", 0.0035, 0.05, (0.01, 0, 0.3), m["basil"], 6, rot=(0, 0.4, 0)))
    rng = seeded(3)
    for i in range(14):
        a = rng.uniform(0, math.tau)
        z = rng.uniform(0.19, 0.25)
        rr = 0.055 if z < 0.22 else 0.035
        sp = box("sp", (0.016, 0.005, 0.005), (rr * math.cos(a), rr * math.sin(a), z),
                 m[("sprinkle_a", "sprinkle_b", "sprinkle_c")[i % 3]], 0.0015, 1,
                 rot=(rng.uniform(0, 3), rng.uniform(0, 3), rng.uniform(0, 3)))
        parts.append(sp)
    return join("food_sundae", parts)


def hotdog(m):
    parts = []
    bun = sphere("bun", 0.06, (0, 0, 0.045), m["bun"], (2.3, 1.05, 0.72), 32, 16)
    parts.append(bun)
    parts.append(sphere("saus", 0.034, (0, 0, 0.082), m["sausage"], (4.4, 1.0, 1.0), 32, 14))
    # mustard zigzag
    pts = 9
    for i in range(pts - 1):
        x0 = -0.12 + 0.24 * i / (pts - 1)
        x1 = -0.12 + 0.24 * (i + 1) / (pts - 1)
        y0 = 0.018 * (1 if i % 2 == 0 else -1)
        y1 = -y0
        ln = math.hypot(x1 - x0, y1 - y0)
        ang = math.atan2(y1 - y0, x1 - x0)
        parts.append(cyl("mu", 0.0085, ln + 0.006, (x0, y0, 0.112), m["mustard"], 8,
                         rot=(0, math.pi / 2, ang)))
        parts.append(sphere("mj", 0.0085, (x1, y1, 0.112), m["mustard"], (1, 1, 1), 8, 6))
    return join("food_hotdog", parts)


def dirty_plate(m):
    parts = [lathe("plate", [(0.0, 0.0), (0.09, 0.0), (0.13, 0.016), (0.15, 0.024), (0.146, 0.028),
                             (0.12, 0.022), (0.0, 0.016)], (0, 0, 0), m["plate"], 40)]
    parts.append(torus("rim", 0.138, 0.005, (0, 0, 0.026), m["plate_rim"], 40, 6))
    rng = seeded(5)
    for i in range(6):
        a = rng.uniform(0, math.tau)
        rr = rng.uniform(0.0, 0.07)
        parts.append(sphere("cr", rng.uniform(0.012, 0.022), (rr * math.cos(a), rr * math.sin(a), 0.02),
                            m["crumb"], (1.3, 1, 0.6), 10, 6))
    parts.append(sphere("sm", 0.04, (0.03, -0.02, 0.016), m["sauce"], (1.4, 0.8, 0.12), 14, 8))
    return join("item_dirty_plate", parts)


def cash(m):
    parts = [box("bill", (0.2, 0.1, 0.05), (0, 0, 0.025), m["cash"], 0.006, 2)]
    parts.append(box("edge", (0.202, 0.102, 0.008), (0, 0, 0.014), m["cash_dark"], 0.002, 1))
    parts.append(box("edge2", (0.202, 0.102, 0.008), (0, 0, 0.036), m["cash_dark"], 0.002, 1))
    parts.append(box("bnd", (0.04, 0.104, 0.052), (0, 0, 0.026), m["band"], 0.004, 2))
    return join("item_cash", parts)


def gem(m):
    # brilliant cut: crown + pavilion, faceted (flat shaded)
    bm = bmesh.new()
    n = 8
    r_table, r_girdle = 0.055, 0.1
    h_crown, h_pav = 0.045, 0.1
    table = [bm.verts.new((r_table * math.cos(math.tau * i / n + math.pi / n),
                           r_table * math.sin(math.tau * i / n + math.pi / n), h_pav + h_crown)) for i in range(n)]
    gird = [bm.verts.new((r_girdle * math.cos(math.tau * i / n), r_girdle * math.sin(math.tau * i / n), h_pav))
            for i in range(n)]
    tip = bm.verts.new((0, 0, 0))
    bm.faces.new(table)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((gird[i], gird[j], table[i]))
        bm.faces.new((table[i], gird[j], table[j]))
        bm.faces.new((gird[j], gird[i], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("item_gem")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("item_gem", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(m["gem"])
    return ob


def coin(m):
    parts = [cyl("c", 0.07, 0.022, (0, 0, 0), m["coin"], 32, round_=0.006)]
    parts.append(cyl("in", 0.05, 0.026, (0, 0, -0.002), m["coin_dark"], 32))
    parts.append(box("mark", (0.016, 0.06, 0.03), (0, 0, 0.012), m["coin"], 0.006, 2))
    return join("item_coin", parts)


def raw_patty(m):
    return join("item_raw_patty", [lathe("rp", [(0.0, 0.0), (0.128, 0.0), (0.14, 0.012), (0.142, 0.026),
                                                 (0.13, 0.036), (0.0, 0.037)], (0, 0, 0), m["raw"])])


def dough(m):
    return join("item_dough", [lathe("d", [(0.0, 0.0), (0.13, 0.0), (0.142, 0.01), (0.136, 0.02), (0.0, 0.024)],
                                     (0, 0, 0), m["dough"], 40)])


def main():
    reset()
    m = M()
    items = [burger(m), fries(m), soda(m), pizza(m), sundae(m), hotdog(m), dirty_plate(m), cash(m), gem(m),
             coin(m), raw_patty(m), dough(m)]
    for i, ob in enumerate(items):
        print(f"{ob.name}: {tri_count(ob)} tris")
    export(os.path.join(ASSETS, "food.glb"), items)
    print("OK food.glb")


main()
