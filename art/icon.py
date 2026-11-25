"""App icon: the game's own burger wearing the chef's toque, toon shaded with ink outlines.

Run: python3 art/icon.py   (bpy 5.3, background). Writes public/icons/icon-*.png.
Built from the exported game models so the icon always matches what's in the game.
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ASSETS = os.path.join(ROOT, "src", "assets")
OUT = os.path.join(ROOT, "public", "icons")
INK = (0.025, 0.008, 0.035, 1)


def lin(hex_):
    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(f(int(hex_[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1,)


LIGHT = Vector((-0.45, -0.55, 0.7)).normalized()


def toonify(m):
    """Replace a glTF material with the game's 3-step toon ramp (flat bands, no gloss).

    Cycles has no Shader-to-RGB, so the light term is N.L against a fixed key direction."""
    base = tuple(m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value)
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = LIGHT
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mul = nt.nodes.new("ShaderNodeMix")
    emi = nt.nodes.new("ShaderNodeEmission")
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.6, 0.52, 0.72, 1)
    els[1].position, els[1].color = 0.18, (0.86, 0.81, 0.9, 1)
    e = els.new(0.55)
    e.color = (1.06, 1.04, 1.02, 1)
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1
    mul.inputs[7].default_value = base
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mul.inputs[6])
    nt.links.new(mul.outputs[2], emi.inputs["Color"])
    nt.links.new(emi.outputs[0], out.inputs["Surface"])


def outline(ob, width):
    """Inverted-hull ink outline; its front faces turn invisible so only the rim shows."""
    ink = bpy.data.materials.get("ink")
    if ink is None:
        ink = bpy.data.materials.new("ink")
        nt = ink.node_tree
        nt.nodes.clear()
        o = nt.nodes.new("ShaderNodeOutputMaterial")
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = INK
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(geo.outputs["Backfacing"], mix.inputs[0])
        nt.links.new(em.outputs[0], mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], o.inputs["Surface"])
    ob.data.materials.append(ink)
    mod = ob.modifiers.new("ink", "SOLIDIFY")
    mod.thickness = width
    mod.offset = 1
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(ob.data.materials) - 1


def bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "food.glb"))
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "cosmetics.glb"))
    keep = {"food_burger", "cos_hat_toque"}
    for ob in list(bpy.data.objects):
        if ob.name not in keep:
            bpy.data.objects.remove(ob)
    burger = bpy.data.objects["food_burger"]
    hat = bpy.data.objects["cos_hat_toque"]
    for ob in (burger, hat):
        ob.parent = None
        ob.rotation_mode = "XYZ"
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            toonify(m)

    # the toque sits a little tipped on the top bun
    bpy.context.view_layer.update()
    lo, hi = bbox(burger)
    bc = (lo + hi) / 2
    hat.scale = (0.56, 0.56, 0.56)
    hat.rotation_euler = (math.radians(-8), math.radians(12), 0)
    bpy.context.view_layer.update()
    hlo, hhi = bbox(hat)
    hc = (hlo + hhi) / 2
    hat.location += Vector((bc.x - hc.x + 0.012, bc.y - hc.y, hi.z - hlo.z - 0.05))
    burger.rotation_euler = (0, 0, math.radians(-18))
    outline(burger, 0.0065)
    outline(hat, 0.0065)
    bpy.context.view_layer.update()

    lo = Vector((min(bbox(o)[0][i] for o in (burger, hat)) for i in range(3)))
    hi = Vector((max(bbox(o)[1][i] for o in (burger, hat)) for i in range(3)))
    centre = (lo + hi) / 2

    sc = bpy.context.scene
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))
    sc.collection.objects.link(sun)

    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 85
    sc.collection.objects.link(cam)
    d = 1.75
    pitch = math.radians(16)
    cam.location = centre + Vector((0, -d * math.cos(pitch), d * math.sin(pitch)))
    cam.rotation_euler = (math.pi / 2 - pitch, 0, 0)
    sc.camera = cam

    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 1024
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    os.makedirs(OUT, exist_ok=True)
    sc.render.filepath = os.path.join(OUT, "_subject.png")
    bpy.ops.render.render(write_still=True)


main()
