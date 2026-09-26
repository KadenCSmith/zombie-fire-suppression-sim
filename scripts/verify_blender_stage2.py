"""Reopen both approved and candidate files and verify Stage 2 preservation."""
import hashlib
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))
from blender_material_stage2 import mesh_fingerprint, uv_metrics


def activate_verification_layer(scene):
    """Evaluate every source object in memory, including hidden review effects."""
    layer = scene.view_layers.new('VERIFY_ALL_OBJECTS')
    bpy.context.window.view_layer = layer
    def reveal(collection):
        collection.exclude = False
        collection.hide_viewport = False
        collection.collection.hide_viewport = False
        for child in collection.children:
            reveal(child)
    reveal(layer.layer_collection)
    for obj in scene.objects:
        obj.hide_viewport = False
        obj.hide_set(False, view_layer=layer)
    layer.update()


def action_hashes():
    result = {}
    for action in bpy.data.actions:
        data = []
        for curve in action.fcurves:
            data.append([curve.data_path, curve.array_index,
                         [[*point.co, *point.handle_left, *point.handle_right,
                           point.interpolation, point.handle_left_type, point.handle_right_type]
                          for point in curve.keyframe_points]])
        result[action.name] = hashlib.sha256(json.dumps(data).encode()).hexdigest()
    return result


def sphere_samples(scene):
    ice = next(o for o in scene.objects if o.name.startswith('DRY ICE'))
    samples = []
    for frame in [1,35,43,51,58,59,66,75,96,126,160,240,300]:
        scene.frame_set(frame); bpy.context.view_layer.update()
        samples.append([frame, list(ice.matrix_world.translation), list(ice.dimensions)])
    scene.frame_set(66); bpy.context.view_layer.update()
    return samples


candidate = Path(bpy.data.filepath)
output = candidate.parent
approved = output.parent/'static-model/Static_Model_Stage_1.blend'
candidate_sha = hashlib.sha256(candidate.read_bytes()).hexdigest()
approved_sha = hashlib.sha256(approved.read_bytes()).hexdigest()
opening_scene = bpy.context.scene.name
opening_camera_views = [a for a in bpy.context.screen.areas if a.type == 'VIEW_3D'
                        and a.spaces.active.region_3d.view_perspective == 'CAMERA']
bpy.ops.wm.open_mainfile(filepath=str(approved))
scene = bpy.context.scene
activate_verification_layer(scene)
expected_motion = sphere_samples(scene)
expected_geometry = mesh_fingerprint(scene)
expected_matrices = {o.name: [list(row) for row in o.matrix_world] for o in scene.objects if o.type == 'MESH'}
expected_actions = action_hashes()
bpy.ops.wm.open_mainfile(filepath=str(candidate))
scene = bpy.data.scenes['01 MATERIALS • Stage 2']
bpy.context.window.scene = scene
# Excluded effects can retain identity matrices until evaluated. Reveal all
# source objects in memory in both files; never save these verification changes.
activate_verification_layer(scene)
actual_motion = sphere_samples(scene)
actual_geometry = mesh_fingerprint(scene)
geometry_differences = {n: {'expected_matrix': expected_matrices[n],
                            'actual_matrix': [list(row) for row in scene.objects[n].matrix_world]}
                        for n, h in expected_geometry.items() if actual_geometry.get(n) != h}
print('GEOMETRY_DIFFERENCES ' + json.dumps(geometry_differences), flush=True)
actual_actions = action_hashes()
images = [i for i in bpy.data.images if i.source == 'FILE']
checks = {
    'opens_on_material_scene_with_camera_view': opening_scene == '01 MATERIALS • Stage 2' and bool(opening_camera_views),
    'approved_mesh_geometry_and_transforms_preserved': all(actual_geometry.get(n) == h for n,h in expected_geometry.items()),
    'original_animation_keyframes_and_handles_preserved': all(actual_actions.get(n) == h for n,h in expected_actions.items()),
    'sphere_motion_and_dimensions_match_at_13_frames': actual_motion == expected_motion,
    'six_external_texture_maps_packed_after_reopen': len(images) == 6 and all(i.packed_file and i.packed_file.size > 0 for i in images),
    'diffuse_maps_srgb': all(i.colorspace_settings.name == 'sRGB' for i in images if '_diff_' in i.name),
    'bump_and_roughness_maps_noncolor': all(i.colorspace_settings.name == 'Non-Color' for i in images if '_diff_' not in i.name),
    'three_separate_review_scenes': len(bpy.data.scenes) == 3,
    'thermal_scene_labels_illustrative': 'Illustrative' in bpy.data.scenes['02 THERMAL • illustrative']['Scientific status'],
    'thermal_scene_has_static_frame_range': bpy.data.scenes['02 THERMAL • illustrative'].frame_start == 66 == bpy.data.scenes['02 THERMAL • illustrative'].frame_end,
    'approved_scene_file_unchanged': hashlib.sha256(approved.read_bytes()).hexdigest() == approved_sha,
    'candidate_file_unchanged_by_verification': hashlib.sha256(candidate.read_bytes()).hexdigest() == candidate_sha,
}
root = next(o for o in scene.objects if o.name.startswith('Root •'))
trunk = next(o for o in scene.objects if o.name.startswith('Small tree •'))
foliage = bpy.data.objects['Living crown • varied curved leaves']
uv = [uv_metrics(root, 'Bark_1m'), uv_metrics(trunk, 'Bark_1m'), uv_metrics(foliage, 'Leaf')]
checks['reopened_uv_maps_finite_without_collapsed_valid_faces'] = all(r['finite_coordinates'] and not r['collapsed_uv_triangles_on_valid_geometry'] for r in uv)
assert all(checks.values()), checks
report = {'checks': checks, 'approved_sha256': approved_sha, 'candidate_sha256': candidate_sha,
          'original_meshes_checked': len(expected_geometry), 'original_actions_checked': len(expected_actions),
          'comparison_view_layer': 'temporary VERIFY_ALL_OBJECTS in both files', 'geometry_differences': geometry_differences,
          'sphere_sample_frames': [r[0] for r in actual_motion], 'uv_after_reopen': uv,
          'source_geometry_status': 'Stage 1 approved; no vertex, topology or transform changes in Stage 2',
          'scope': 'Numerical/file verification, not experimental thermal validation or final render approval'}
(output/'reopen_verification.json').write_text(json.dumps(report, indent=2)+'\n')
print('STAGE2_REOPEN_VERIFIED ' + json.dumps(report), flush=True)
