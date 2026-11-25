"""Blobby stickman: model, rig and animate in Blender, export a skinned GLB.

Run: python3 art/character.py   (needs the bpy 5.3 wheel)
Blender axes: Z up, the character faces -Y. 1 unit = 1 m. Animations are 30 fps loops.
"""
import math
import os
import sys

import bpy  # noqa: I001  (bpy must load before bmesh)
import bmesh
from mathutils import Matrix, Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "assets", "character.glb")
FPS = 30


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def capsule(name, a, b, r_a, r_b, squash_y=1.0, segs=32, rings=16):
    """Tapered capsule from point a (radius r_a) to point b (radius r_b)."""
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        z = v.co.z
        if z >= 0:
            v.co.x *= r_b
            v.co.y *= r_b * squash_y
            v.co.z = z * r_b + length
        else:
            v.co.x *= r_a
            v.co.y *= r_a * squash_y
            v.co.z = z * r_a
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    d = (b - a).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    ob.matrix_world = Matrix.Translation(a) @ rot
    return ob


def sphere(name, c, r, sx=1.0, sy=1.0, sz=1.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=r)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location = c
    return ob


def apply_all(ob):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)


def build_body():
    parts = [
        # head: big and round, sits low on the shoulders like a toy figure
        sphere("head", (0, 0, 0.935), 0.215, 1.0, 0.97, 1.03),
        # torso: chunky bean, wider at the shoulders, flattened front to back
        capsule("torso", (0, 0, 0.42), (0, 0, 0.655), 0.158, 0.178, squash_y=0.84),
    ]
    for s in (1, -1):
        parts.append(capsule("leg", (0.085 * s, 0, 0.37), (0.09 * s, -0.005, 0.078), 0.080, 0.078))
        parts.append(capsule("arm", (0.215 * s, 0, 0.665), (0.243 * s, -0.01, 0.405), 0.066, 0.068))
    for p in parts[1:]:
        p.select_set(True)
    body = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = body
    with bpy.context.temp_override(active_object=body, selected_editable_objects=parts, selected_objects=parts):
        bpy.ops.object.join()
    body.name = "Body"
    body.data.name = "Body"
    bpy.context.view_layer.objects.active = body
    with bpy.context.temp_override(object=body, active_object=body, selected_objects=[body]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    rm = body.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = 0.0085
    rm.use_smooth_shade = True
    sm = body.modifiers.new("smooth", "LAPLACIANSMOOTH")
    sm.iterations = 6
    sm.lambda_factor = 0.6
    sm.use_volume_preserve = True
    apply_all(body)
    dec = body.modifiers.new("decimate", "DECIMATE")
    target = 1500
    dec.ratio = min(1.0, target / max(1, len(body.data.polygons)))
    apply_all(body)
    for poly in body.data.polygons:
        poly.use_smooth = True
    mat = bpy.data.materials.new("Skin")
    mat.diffuse_color = (1, 1, 1, 1)
    body.data.materials.append(mat)
    return body


BONES = {
    # name: (head, tail, parent)
    "hips": ((0, 0, 0.37), (0, 0, 0.52), None),
    "spine": ((0, 0, 0.52), (0, 0, 0.74), "hips"),
    "head": ((0, 0, 0.74), (0, 0, 1.15), "spine"),
    "upperarm.L": ((0.215, 0, 0.67), (0.229, 0, 0.545), "spine"),
    "forearm.L": ((0.229, 0, 0.545), (0.243, -0.01, 0.34), "upperarm.L"),
    "upperarm.R": ((-0.215, 0, 0.67), (-0.229, 0, 0.545), "spine"),
    "forearm.R": ((-0.229, 0, 0.545), (-0.243, -0.01, 0.34), "upperarm.R"),
    "thigh.L": ((0.085, 0, 0.37), (0.087, 0, 0.22), "hips"),
    "shin.L": ((0.087, 0, 0.22), (0.09, -0.005, 0.0), "thigh.L"),
    "thigh.R": ((-0.085, 0, 0.37), (-0.087, 0, 0.22), "hips"),
    "shin.R": ((-0.087, 0, 0.22), (-0.09, -0.005, 0.0), "thigh.R"),
}


def build_rig(body):
    arm_data = bpy.data.armatures.new("Rig")
    rig = bpy.data.objects.new("Rig", arm_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(object=rig, active_object=rig):
        bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    for name, (h, t, parent) in BONES.items():
        b = eb.new(name)
        b.head = h
        b.tail = t
        # local Z points forward (-Y) so +X rotation always swings a bone forward
        b.align_roll(Vector((0, -1, 0)))
        if parent:
            b.parent = eb[parent]
            b.use_connect = (Vector(eb[parent].tail) - Vector(h)).length < 1e-4
    with bpy.context.temp_override(object=rig, active_object=rig):
        bpy.ops.object.mode_set(mode="OBJECT")

    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[body, rig],
                                   selected_editable_objects=[body, rig]):
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    groups = [g.name for g in body.vertex_groups]
    empty = [g for g in BONES if g not in groups]
    if empty:
        sys.exit(f"auto weights failed for {empty}")
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    return rig


# ---------------------------------------------------------------- animation

def D(x):
    return math.radians(x)


class Pose:
    def __init__(self):
        self.rot = {n: [0.0, 0.0, 0.0] for n in BONES}
        self.hips_up = 0.0  # metres
        self.hips_fwd = 0.0


def key_pose(rig, frame, pose):
    for name, r in pose.rot.items():
        pb = rig.pose.bones[name]
        pb.rotation_euler = r
        pb.keyframe_insert("rotation_euler", frame=frame)
    hp = rig.pose.bones["hips"]
    # hips bone points up: local Y is world up, local Z is forward
    hp.location = (0.0, pose.hips_up, pose.hips_fwd)
    hp.keyframe_insert("location", frame=frame)


def make_action(rig, name, frames, fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    for f in range(frames + 1):
        p = Pose()
        fn(p, f / frames)
        key_pose(rig, f, p)
    for fc in act_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return act


def act_fcurves(act):
    if hasattr(act, "fcurves") and len(getattr(act, "fcurves")) > 0:
        return act.fcurves
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


TAU = math.tau


def gait(p, t, swing, knee, arm, elbow, bob, lean, sway, arms=True):
    s = math.sin(TAU * t)
    c = math.cos(TAU * t)
    # legs: L forward when s > 0
    fwd = D(swing) * 0.18  # legs reach further forward than back
    p.rot["thigh.L"][0] = D(swing) * s + fwd
    p.rot["thigh.R"][0] = -D(swing) * s + fwd
    # knee folds while the leg recovers forward, peaking just after it passes under the body
    kl = max(0.0, math.cos(TAU * t - 0.7))
    kr = max(0.0, -math.cos(TAU * t - 0.7))
    p.rot["shin.L"][0] = -D(knee) * kl ** 1.3 - D(7)
    p.rot["shin.R"][0] = -D(knee) * kr ** 1.3 - D(7)
    if arms:
        p.rot["upperarm.L"][0] = -D(arm) * s
        p.rot["upperarm.R"][0] = D(arm) * s
        p.rot["forearm.L"][0] = D(elbow) * (0.6 + 0.4 * max(0.0, -s))
        p.rot["forearm.R"][0] = D(elbow) * (0.6 + 0.4 * max(0.0, s))
        p.rot["upperarm.L"][2] = D(6)
        p.rot["upperarm.R"][2] = -D(6)
    # two bounces per stride, lowest at contact
    # lowest at foot contact (legs spread), highest mid-stride
    p.hips_up = bob * (abs(c) - 0.5) - bob * 0.15
    p.rot["spine"][0] = D(lean)
    p.rot["hips"][1] = D(sway) * s
    p.rot["spine"][1] = -D(sway) * s * 1.6
    p.rot["spine"][2] = D(sway) * 0.3 * c
    p.rot["head"][0] = -D(lean) * 0.6
    p.rot["head"][1] = D(sway) * s * 0.5


def carry_arms(p, t, wobble):
    s = math.sin(TAU * t * 2)
    for side, sg in (("L", 1), ("R", -1)):
        p.rot[f"upperarm.{side}"][0] = D(72 + wobble * s)
        p.rot[f"upperarm.{side}"][2] = D(-10) * sg
        p.rot[f"forearm.{side}"][0] = D(14)


def a_idle(p, t):
    s = math.sin(TAU * t)
    p.hips_up = -0.006 + 0.006 * s
    p.rot["spine"][0] = D(1.5) * s
    p.rot["head"][0] = -D(2) * s
    p.rot["head"][2] = D(2.5) * math.sin(TAU * t + 1.0)
    for side, sg in (("L", 1), ("R", -1)):
        p.rot[f"upperarm.{side}"][2] = D(5 + 2.5 * s) * sg
        p.rot[f"upperarm.{side}"][0] = D(3) * math.sin(TAU * t + 0.6)
        p.rot[f"forearm.{side}"][0] = D(8 + 2 * s)
        p.rot[f"thigh.{side}"][0] = D(1)
        p.rot[f"shin.{side}"][0] = -D(2) - D(1.5) * (1 + s) * 0.5


def a_walk(p, t):
    gait(p, t, swing=32, knee=48, arm=30, elbow=16, bob=0.022, lean=4, sway=5)


def a_run(p, t):
    gait(p, t, swing=50, knee=85, arm=58, elbow=62, bob=0.045, lean=11, sway=7)


def a_carry_idle(p, t):
    a_idle(p, t)
    carry_arms(p, t, 1.2)


def a_carry_run(p, t):
    gait(p, t, swing=46, knee=80, arm=0, elbow=0, bob=0.04, lean=6, sway=5, arms=False)
    carry_arms(p, t, 3.5)


def a_carry_walk(p, t):
    gait(p, t, swing=32, knee=48, arm=0, elbow=0, bob=0.022, lean=3, sway=4, arms=False)
    carry_arms(p, t, 2.0)


def a_cheer(p, t):
    # two hops with arms pumping overhead
    h = abs(math.sin(TAU * t))
    p.hips_up = 0.13 * h ** 0.8 - 0.02
    for side, sg in (("L", 1), ("R", -1)):
        p.rot[f"upperarm.{side}"][0] = D(168)
        p.rot[f"upperarm.{side}"][2] = D(28 + 16 * h) * sg
        p.rot[f"forearm.{side}"][0] = D(18 * (1 - h))
        p.rot[f"thigh.{side}"][0] = D(14) * (1 - h)
        p.rot[f"shin.{side}"][0] = -D(24) * (1 - h)
    p.rot["spine"][0] = -D(6) * h
    p.rot["head"][0] = -D(10) * h


def sit_base(p):
    p.hips_up = -0.16
    p.hips_fwd = 0.0
    for side, sg in (("L", 1), ("R", -1)):
        p.rot[f"thigh.{side}"][0] = D(88)
        p.rot[f"thigh.{side}"][2] = D(4) * sg
        p.rot[f"shin.{side}"][0] = -D(86)


def a_sit(p, t):
    sit_base(p)
    s = math.sin(TAU * t)
    p.rot["spine"][0] = D(2) * s
    p.rot["head"][2] = D(4) * math.sin(TAU * t + 0.8)
    for side, sg in (("L", 1), ("R", -1)):
        p.rot[f"upperarm.{side}"][0] = D(30)
        p.rot[f"upperarm.{side}"][2] = D(8) * sg
        p.rot[f"forearm.{side}"][0] = D(40 + 3 * s)


def a_sit_eat(p, t):
    sit_base(p)
    # right hand to mouth, then left
    for side, sg, ph in (("R", -1, 0.0), ("L", 1, 0.5)):
        k = max(0.0, math.sin(TAU * (t - ph)))
        k = k * k * (3 - 2 * k)
        p.rot[f"upperarm.{side}"][0] = D(30 + 55 * k)
        p.rot[f"upperarm.{side}"][2] = D(8 - 14 * k) * sg
        p.rot[f"forearm.{side}"][0] = D(45 + 85 * k)
    p.rot["head"][0] = D(5) * abs(math.sin(TAU * t * 2))


def a_wave(p, t):
    a_idle(p, t)
    s = math.sin(TAU * t * 2)
    p.rot["upperarm.R"][0] = D(150)
    p.rot["upperarm.R"][2] = -D(30)
    p.rot["forearm.R"][0] = D(20)
    p.rot["forearm.R"][2] = -D(25) * s
    p.rot["upperarm.R"][1] = D(15) * s
    p.rot["spine"][1] = D(4) * s


def a_angry(p, t):
    # stomping, arms crossed-ish shaking fists
    s = math.sin(TAU * t * 2)
    p.hips_up = -0.01 + 0.012 * abs(s)
    for side, sg in (("L", 1), ("R", -1)):
        p.rot[f"upperarm.{side}"][0] = D(40)
        p.rot[f"upperarm.{side}"][2] = D(25 + 12 * s * sg) * sg
        p.rot[f"forearm.{side}"][0] = D(95)
    p.rot["thigh.L"][0] = D(18) * max(0.0, s)
    p.rot["shin.L"][0] = -D(30) * max(0.0, s)
    p.rot["head"][0] = D(8)
    p.rot["head"][1] = D(10) * math.sin(TAU * t * 2)


ACTIONS = [
    ("idle", 60, a_idle),
    ("walk", 26, a_walk),
    ("run", 18, a_run),
    ("carry_idle", 60, a_carry_idle),
    ("carry_walk", 26, a_carry_walk),
    ("carry_run", 18, a_carry_run),
    ("cheer", 30, a_cheer),
    ("sit", 72, a_sit),
    ("sit_eat", 40, a_sit_eat),
    ("wave", 30, a_wave),
    ("angry", 24, a_angry),
]


def main():
    reset()
    body = build_body()
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    rig = build_rig(body)
    acts = [make_action(rig, n, f, fn) for n, f, fn in ACTIONS]
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = 72
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        export_animation_mode="ACTIONS",
        export_anim_single_armature=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_def_bones=True,
        export_skins=True,
        export_morph=False,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_materials="EXPORT",
    )
    print(f"OK tris={tris} actions={[a.name for a in acts]} -> {OUT}")


main()
