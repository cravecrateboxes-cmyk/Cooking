"""Google Play feature graphic (1024 x 500): a corner of the restaurant as a little diorama seen from the
game's own angle. The chef cheers behind the counter, guests wait at it, coins fly. Toon shaded with ink
outlines like the icon (art/icon.py) and built from the exported game models.

Run: python3 art/feature.py   (bpy 5.3, background), then python3 art/feature_compose.py.
Writes store/_feature_subject.png (transparent), which feature_compose.py puts on the background with the title.
"""
import math
import os

import bpy  # noqa: I001  (bpy first: the bpy module only provides bmesh once it is loaded)
import bmesh
from mathutils import Euler, Vector

from icon import ASSETS, ROOT, lin, outline, toonify

OUT = os.path.join(ROOT, "store")
CHEF = "#ff4b55"  # the player's default colour (src/game/world.ts)
TILE = ("#2fbfa8", "#27a998", "#1f8d80")  # kitchen tiles and slab edge (src/game/environment.ts)
PLANK = ("#f0a05a", "#e48e4c")
POSE_FRAME = float(os.environ.get("FRAME", "7"))  # one moment of every clip, at 24 fps


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, name))
    return [o for o in bpy.data.objects if o not in before]


def flat(name, hex_):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = lin(hex_)
    return m


def place(src, loc, rot_z=0.0, scale=1.0, tilt=(0.0, 0.0)):
    """A copy of a model with its own mesh, standing at loc (Blender metres, Z up)."""
    ob = src.copy()
    ob.data = src.data.copy()
    ob.parent = None
    ob.location = Vector(loc)
    ob.rotation_mode = "XYZ"
    ob.rotation_euler = Euler((math.radians(tilt[0]), math.radians(tilt[1]), math.radians(rot_z)))
    ob.scale = (scale, scale, scale)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def floor(x0, y0, x1, y1, cell, a, b, edge, z=0.0):
    """A floor slab with checker tiles on top and a darker edge, like the game's building floor."""
    me = bpy.data.meshes.new("floor")
    bm = bmesh.new()
    nx, ny = round((x1 - x0) / cell), round((y1 - y0) / cell)
    for i in range(nx):
        for j in range(ny):
            vs = [bm.verts.new((x0 + (i + di) * cell, y0 + (j + dj) * cell, z)) for di, dj in ((0, 0), (1, 0), (1, 1), (0, 1))]
            bm.faces.new(vs).material_index = (i + j) % 2
    bm.to_mesh(me)
    bm.free()
    me.materials.append(flat("tile_a", a))
    me.materials.append(flat("tile_b", b))
    ob = bpy.data.objects.new("floor", me)
    bpy.context.scene.collection.objects.link(ob)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, z - 0.1))
    slab = bpy.context.active_object
    slab.scale = (x1 - x0, y1 - y0, 0.19)
    slab.data.materials.append(flat("slab", edge))
    bpy.ops.object.transform_apply(scale=True)
    return [ob, slab]


def person(colour, loc, rot_z, clip, scale, hat, lib):
    """One of the game's bean characters in a clip's pose, with an optional hat from cosmetics.glb."""
    objs = load("character.glb")
    rig = next(o for o in objs if o.type == "ARMATURE")
    body = next(o for o in objs if o.type == "MESH" and o.parent == rig)
    for o in objs:
        if o not in (rig, body):
            bpy.data.objects.remove(o)
    body.data.materials[0] = body.data.materials[0].copy()
    body.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = lin(colour)
    rig.scale = (scale, scale, scale)
    rig.location = Vector(loc)
    rig.rotation_euler = (0, 0, math.radians(rot_z))
    for t in rig.animation_data.nla_tracks:  # the importer stacks every clip on the NLA; play only one
        t.mute = True
    act = bpy.data.actions[clip]
    rig.animation_data.action = act
    if not rig.animation_data.action_slot:
        rig.animation_data.action_slot = act.slots[0]
    out = [body]
    if hat:
        # wearables are modelled in the rest pose: parent to the head bone there, then pose
        w = place(lib[hat], (0, 0, 0))
        rig.data.pose_position = "REST"
        bpy.context.view_layer.update()
        m = rig.matrix_world @ w.matrix_world
        w.parent, w.parent_type, w.parent_bone = rig, "BONE", "head"
        bpy.context.view_layer.update()
        w.matrix_world = m
        rig.data.pose_position = "POSE"
        out.append(w)
    return out


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    lib = {o.name: o for name in ("food.glb", "props.glb", "cosmetics.glb") for o in load(name)}
    for o in lib.values():
        o.parent = None
    sc = bpy.context.scene
    kept = []

    # a corner of Corner Grill: kitchen tiles behind the counter, planks in front for the guests
    kept += floor(-0.6, 0.0, 5.4, 2.4, 0.6, *TILE)
    kept += floor(-0.6, -2.4, 5.4, 0.0, 0.6, PLANK[0], PLANK[1], TILE[2], z=-0.005)
    kept += [place(lib["counter_seg"], (0.6, 0.35, 0)), place(lib["counter_seg"], (1.8, 0.35, 0)),
             place(lib["counter_seg"], (3.0, 0.35, 0)), place(lib["counter_end"], (4.0, 0.35, 0))]
    kept += [place(lib["st_grill"], (0.75, 1.85, 0)), place(lib["st_fryer"], (2.35, 1.85, 0)),
             place(lib["st_soda"], (3.95, 1.85, 0))]
    top = 0.64
    kept += [place(lib["food_burger"], (1.05, 0.3, top), rot_z=-20, scale=1.4),
             place(lib["food_fries"], (1.75, 0.3, top), rot_z=15, scale=1.4),
             place(lib["food_soda"], (2.4, 0.35, top), scale=1.4),
             place(lib["food_hotdog"], (3.15, 0.3, top), rot_z=-30, scale=1.4)]
    for args in ((CHEF, (1.95, 1.05, 0), 18, "cheer", 1.25, "cos_hat_toque"),
                 ("#3fa9f5", (0.95, -0.8, 0), 165, "wave", 1.0, "cos_hat_cap"),
                 ("#ffb020", (2.6, -1.1, 0), 30, "cheer", 1.0, None),
                 ("#8a5cf5", (3.75, -0.85, 0), 200, "idle", 1.0, "cos_hat_cowboy")):
        kept += person(*args, lib)
    for x, y, z, rz, tx in ((1.3, 0.9, 2.3, 30, 70), (2.9, 1.0, 2.6, -40, 60), (3.7, 0.4, 2.05, 10, 80),
                            (0.35, 0.6, 1.9, -20, 75), (2.15, 0.5, 2.95, 60, 50), (4.6, 0.6, 2.5, -10, 65)):
        kept.append(place(lib["item_coin"], (x, y, z), rot_z=rz, scale=1.5, tilt=(tx, 0)))

    for o in lib.values():
        bpy.data.objects.remove(o)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            toonify(m)
    for ob in kept:
        if ob.type == "MESH":
            outline(ob, 0.014)
    sc.frame_set(round(POSE_FRAME))

    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = float(os.environ.get("LENS", "42"))
    cam.data.shift_x = float(os.environ.get("SHIFT", "-0.16"))
    sc.collection.objects.link(cam)
    target = Vector((2.4, 0.1, 0.8))
    pitch = math.radians(float(os.environ.get("PITCH", "34")))
    yaw = math.radians(float(os.environ.get("YAW", "22")))
    d = float(os.environ.get("DIST", "11.5"))
    across = d * math.cos(pitch)
    cam.location = target + Vector((across * math.sin(yaw), -across * math.cos(yaw), d * math.sin(pitch)))
    cam.rotation_euler = (math.pi / 2 - pitch, 0, yaw)
    sc.camera = cam

    sc.render.engine = "CYCLES"
    sc.cycles.samples = int(os.environ.get("SAMPLES", "48"))
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = 2048, 1000
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    os.makedirs(OUT, exist_ok=True)
    sc.render.filepath = os.path.join(OUT, "_feature_subject.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
