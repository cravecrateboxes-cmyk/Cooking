"""Shared modelling helpers for the Blender build scripts (bpy 5.3, background mode).

Blender axes: Z up, objects face -Y. 1 unit = 1 m.
"""
import math
import os

import bpy  # noqa: I001  (bpy must load before bmesh)
import bmesh
from mathutils import Matrix, Vector

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "assets")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30


_mats = {}


def mat(name, color, rough=0.5, metal=0.0, emit=0.0):
    """Shared flat material. color is '#rrggbb' in sRGB."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    r, g, b = (int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = [srgb_to_lin(c) for c in (r, g, b)]
    m.diffuse_color = (*lin, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*lin, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = (*lin, 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    _mats[name] = m
    return m


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _obj(name, bm, material, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if material is not None:
        me.materials.append(material)
    if parent is not None:
        ob.parent = parent
    return ob


def smooth(ob, angle=40):
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(angle))
    return ob


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def apply_mods(ob):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)


def bevel(ob, width, segs=3, limit=30):
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segs
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(limit)
    m.harden_normals = False
    apply_mods(ob)
    return smooth(ob, 35)


def box(name, size, loc, material, round_=0.0, segs=3, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    ob = _obj(name, bm, material, parent)
    ob.location = loc
    ob.rotation_euler = rot
    if round_ > 0:
        bevel(ob, round_, segs)
    else:
        flat(ob)
    return ob


def cyl(name, r, h, loc, material, segs=32, r_top=None, round_=0.0, parent=None, rot=(0, 0, 0), cap=True):
    """Cylinder standing on loc (base at loc.z)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r,
                          radius2=r if r_top is None else r_top, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h / 2))
    ob = _obj(name, bm, material, parent)
    ob.location = loc
    ob.rotation_euler = rot
    if round_ > 0:
        bevel(ob, round_, 3)
    else:
        smooth(ob, 50)
    return ob


def sphere(name, r, loc, material, scale=(1, 1, 1), segs=24, rings=14, parent=None, cut_below=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    if cut_below is not None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cut_below), plane_no=(0, 0, 1),
                                     clear_inner=True)
        edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    ob = _obj(name, bm, material, parent)
    ob.location = loc
    return smooth(ob, 60)


def torus(name, r_major, r_minor, loc, material, segs=32, ring=12, parent=None, scale_z=1.0):
    bm = bmesh.new()
    for i in range(segs):
        a = math.tau * i / segs
        for j in range(ring):
            b = math.tau * j / ring
            x = (r_major + r_minor * math.cos(b)) * math.cos(a)
            y = (r_major + r_minor * math.cos(b)) * math.sin(a)
            z = r_minor * math.sin(b) * scale_z
            bm.verts.new((x, y, z))
    bm.verts.ensure_lookup_table()
    for i in range(segs):
        for j in range(ring):
            a = i * ring + j
            b = ((i + 1) % segs) * ring + j
            c = ((i + 1) % segs) * ring + (j + 1) % ring
            d = i * ring + (j + 1) % ring
            bm.faces.new((bm.verts[a], bm.verts[b], bm.verts[c], bm.verts[d]))
    ob = _obj(name, bm, material, parent)
    ob.location = loc
    return smooth(ob, 80)


def lathe(name, profile, loc, material, segs=32, parent=None):
    """Revolve a list of (radius, z) points around Z."""
    bm = bmesh.new()
    rows = []
    for (r, z) in profile:
        row = []
        for i in range(segs):
            a = math.tau * i / segs
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rows.append(row)
    for k in range(len(rows) - 1):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((rows[k][i], rows[k][j], rows[k + 1][j], rows[k + 1][i]))
    if profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rows[0])))
    if profile[-1][0] > 1e-4:
        bm.faces.new(rows[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj(name, bm, material, parent)
    ob.location = loc
    return smooth(ob, 50)


def empty(name, loc=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    if parent is not None:
        ob.parent = parent
    return ob


def join(name, objs):
    """Join meshes into one object (keeps materials). Returns the joined object."""
    objs = [o for o in objs if o.type == "MESH"]
    base = objs[0]
    for o in objs:
        o.parent = None
    with bpy.context.temp_override(active_object=base, selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    base.name = name
    base.data.name = name
    with bpy.context.temp_override(object=base, active_object=base, selected_objects=[base],
                                   selected_editable_objects=[base]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return base


def place(ob, loc=(0, 0, 0), rot=(0, 0, 0)):
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def export(path, objects=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = {}
    if objects is not None:
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in objects:
            o.select_set(True)
        kw["use_selection"] = True
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_yup=True, export_apply=True,
        export_texcoords=False, export_materials="EXPORT", export_animations=False, **kw)


def seeded(seed):
    import random
    return random.Random(seed)


def mat4_translate(v):
    return Matrix.Translation(Vector(v))
