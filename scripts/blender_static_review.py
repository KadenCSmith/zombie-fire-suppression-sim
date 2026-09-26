"""Inspect the saved illustration and create geometry-only Stage 1 previews.

Run with Blender 4.2: blender -b SOURCE.blend --python this_file.py -- --output DIR
Optional --candidate FILE saves a separate copy after centering the sphere mesh.
The source file is never saved or changed. No construction/refinement script is run.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def world_mesh(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    faces = [tuple(face.vertices) for face in mesh.polygons]
    evaluated.to_mesh_clear()
    return vertices, faces


def bounds(vertices):
    low = [min(v[i] for v in vertices) for i in range(3)]
    high = [max(v[i] for v in vertices) for i in range(3)]
    return {"minimum_m": low, "maximum_m": high,
            "extent_m": [high[i] - low[i] for i in range(3)]}


def intersections(first, second):
    av, af = world_mesh(first)
    bv, bf = world_mesh(second)
    return len(BVHTree.FromPolygons(av, af).overlap(BVHTree.FromPolygons(bv, bf)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--candidate")
    parser.add_argument("--preview-only", action="store_true")
    parser.add_argument("--no-preview", action="store_true")
    parser.add_argument("--quit", action="store_true")
    parser.add_argument("--view", choices=("01_section", "02_top", "03_root_junction"))
    parser.add_argument("--engine", choices=("workbench", "cycles"), default="workbench")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    source = Path(bpy.data.filepath)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    scene = bpy.context.scene
    scene.frame_set(66)
    bpy.context.view_layer.update()
    ice = next(o for o in scene.objects if o.name.startswith("DRY ICE"))
    cutter = next(o for o in scene.objects if "editable cutter" in o.name)
    peat = next(o for o in scene.objects if o.name.startswith("Peat lens"))
    root = next(o for o in scene.objects if o.name.startswith("Root •"))
    trunk = next(o for o in scene.objects if o.name.startswith("Small tree •"))
    correction = Vector()
    candidate_hash = None
    if args.candidate:
        candidate = Path(args.candidate).resolve()
        assert candidate != source.resolve(), "The original scene must be preserved."
        assert not candidate.exists(), "Do not overwrite an existing review candidate."
        # The original mesh had a submillimeter offset from its keyed object origin.
        # Center its geometry; this preserves diameter and every animation key.
        local_bounds = bounds([v.co for v in ice.data.vertices])
        correction = -Vector([(a + b) / 2 for a, b in zip(local_bounds["minimum_m"], local_bounds["maximum_m"])])
        for vertex in ice.data.vertices: vertex.co += correction
        ice.data.update()
        bpy.context.view_layer.update()
        bpy.ops.wm.save_as_mainfile(filepath=str(candidate), compress=True)
        candidate_hash = hashlib.sha256(candidate.read_bytes()).hexdigest()
    ice_bounds = bounds(world_mesh(ice)[0])
    cutter_bounds = bounds(world_mesh(cutter)[0])
    peat_vertices = world_mesh(peat)[0]
    terrain_vertices = []
    for name in ("SOIL", "SOIL_FRONT • top view only"):
        for obj in bpy.data.collections[name].objects:
            if obj.type == "MESH" and obj.name[:2] in ("01", "02", "03", "04"):
                terrain_vertices.extend(world_mesh(obj)[0])
    root_vertices = world_mesh(root)[0]
    # Stage 07's root has six 24-sided rings, verified here before measuring.
    assert len(root_vertices) == 6 * 24, "Root topology changed; update ring measurement."
    ring_diameters = []
    for i in range(6):
        ring = root_vertices[i * 24:(i + 1) * 24]
        center = sum(ring, Vector()) / len(ring)
        ring_diameters.append(2 * sum((v - center).length for v in ring) / len(ring))
    radial_clearance = (cutter_bounds["extent_m"][0] - ice_bounds["extent_m"][0]) / 2
    floor_gap = ice_bounds["minimum_m"][2] - cutter_bounds["minimum_m"][2]
    root_trunk_pairs = intersections(root, trunk)
    root_peat_pairs = intersections(root, peat)
    checks = {
        "sphere_diameter_0_50_m": all(abs(v - .5) < 1e-5 for v in ice_bounds["extent_m"]),
        "borehole_diameter_0_75_m": all(abs(v - .75) < 1e-5 for v in cutter_bounds["extent_m"][:2]),
        "borehole_floor_minus_2_44_m": abs(cutter_bounds["minimum_m"][2] + 2.44) < 1e-5,
        "sphere_floor_contact": abs(floor_gap) < 1e-5,
        "positive_radial_clearance": radial_clearance > 0,
        "peat_mesh_below_nominal_ground": max(v.z for v in peat_vertices) < 0,
        "root_trunk_surface_intersection": root_trunk_pairs > 0,
        "root_peat_surface_intersection": root_peat_pairs > 0,
        "middle_root_rings_nominal_0_20_m": all(abs(v - .2) < .01 for v in ring_diameters[1:4]),
    }
    report = {
        "stage": "1 Static model approval", "approval": "pending user review",
        "source_file": source.name, "source_sha256": source_hash,
        "candidate_file": Path(args.candidate).name if args.candidate else None,
        "candidate_sha256": candidate_hash,
        "sphere_local_mesh_translation_m": list(correction),
        "blender_version": bpy.app.version_string, "frame": 66,
        "checks": checks, "sphere_bounds": ice_bounds, "cutter_bounds": cutter_bounds,
        "terrain_bounds": bounds(terrain_vertices), "peat_bounds": bounds(peat_vertices),
        "peat_vertices_below_nominal_ground_fraction": sum(v.z < 0 for v in peat_vertices) / len(peat_vertices),
        "radial_clearance_m": radial_clearance, "sphere_floor_gap_m": floor_gap,
        "root_ring_mean_diameters_m": ring_diameters,
        "root_trunk_intersecting_triangle_pairs": root_trunk_pairs,
        "root_peat_intersecting_triangle_pairs": root_peat_pairs,
        "limits": [
            "Nominal ground is z=0; this is not a local cover-depth or volume-fraction calculation.",
            "Intersecting separate root and trunk meshes establish overlap, not a welded deformation-ready mesh.",
            "The cutter extends above ground; its total height is not the subsurface borehole depth.",
            "Preview colors identify geometry only; materials, UVs, motion, lighting and physics are not approved.",
            "These are static geometry previews, not the remaining four-frame final render/review attempt.",
        ],
    }
    if not args.preview_only:
        (output / "measurements.json").write_text(json.dumps(report, indent=2) + "\n")
    assert all(checks.values()), f"Static geometry checks failed: {checks}"
    if args.no_preview:
        print(json.dumps({"checks": checks, "source_unchanged": hashlib.sha256(source.read_bytes()).hexdigest() == source_hash}))
        return

    # Diagnostic presentation in memory only. All original geometry is retained.
    hidden_collections = {"CO2", "FIRE", "SHOCKWAVE", "ANNOTATIONS", "SECTION_LABELS", "TOP_LABELS"}
    for name in hidden_collections:
        for obj in list(bpy.data.collections[name].all_objects):
            obj.hide_render = True
    for obj in list(scene.objects):
        obj.color = (.58, .60, .61, 1)
        if any(c.name == "PEAT" for c in obj.users_collection): obj.color = (.24, .26, .28, 1)
        if any(c.name.startswith("TREE") for c in obj.users_collection): obj.color = (.65, .39, .18, 1)
    ice.color = (.86, .93, 1, 1)
    for obj in list(bpy.data.collections["LIGHTING"].objects):
        if obj.type == "MESH": obj.hide_render = True
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "paint.sl"
    scene.display.shading.color_type = "OBJECT"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "BOTH"
    scene.display.shading.show_specular_highlight = False
    scene.display.shading.background_type = "WORLD"
    scene.world.color = (.13, .13, .13)
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    if args.engine == "cycles":
        # CPU fallback for hosts where Metal Workbench readback stalls. These
        # flat-color geometry previews do not use the scene's final materials.
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 12
        scene.cycles.use_denoising = True
        palette = {}
        for obj in list(scene.objects):
            if obj.type == "LIGHT": obj.hide_render = True
            if obj.type not in {"MESH", "CURVE"}: continue
            key = tuple(obj.color)
            if key not in palette:
                mat = bpy.data.materials.new("Static review flat color")
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                bsdf.inputs["Base Color"].default_value = key
                bsdf.inputs["Roughness"].default_value = .85
                palette[key] = mat
            # Copy shared data before replacing slots so object colors remain local.
            obj.data = obj.data.copy()
            obj.data.materials.clear()
            obj.data.materials.append(palette[key])
        scene.world = bpy.data.worlds.new("Static review ambient")
        scene.world.use_nodes = True
        scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.65, .65, .65, 1)
        scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .65
        lamp_data = bpy.data.lights.new("Static review fill", "AREA")
        lamp_data.energy = 1600
        lamp_data.shape = "DISK"
        lamp_data.size = 8
        lamp = bpy.data.objects.new("Static review fill", lamp_data)
        scene.collection.objects.link(lamp)
        lamp.location = (-4, -6, 9)
        lamp.rotation_euler = (Vector((0, 0, 0)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    camera_data = bpy.data.cameras.new("STATIC_REVIEW_CAMERA")
    camera = bpy.data.objects.new("STATIC_REVIEW_CAMERA", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    scene.camera = camera
    jobs = [
        ("01_section", "SECTION", (5, -16, 7), (0, 1, -.2), 10.8),
        ("02_top", "TOP", (0, 0, 16), (0, 0, 0), 10.8),
        ("03_root_junction", "SECTION", (1.4, -9, 1.8), (1.4, 0, -.12), 3.1),
    ]
    for name, layer, position, target, scale in jobs:
        if args.view and args.view != name:
            continue
        for view_layer in scene.view_layers: view_layer.use = view_layer.name == layer
        bpy.context.window.view_layer = scene.view_layers[layer]
        camera.location = position
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera_data.ortho_scale = scale
        scene.render.filepath = str(output / f"{name}.png")
        bpy.ops.render.render(write_still=True)
    manifest = {
        "stage": 1, "approval": "pending", "engine": args.engine,
        "frame": 66, "appearance": "Temporary flat-color geometry preview; candidate materials preserved",
        "files": {f"{name}.png": hashlib.sha256((output / f"{name}.png").read_bytes()).hexdigest()
                  for name, *_ in jobs if not args.view or args.view == name},
    }
    (output / "preview_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash, "Source file changed during review."
    print(json.dumps({"checks": checks, "output": str(output), "source_unchanged": True}))
    if args.quit:
        bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
