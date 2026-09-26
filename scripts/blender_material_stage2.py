"""Build Stage 2 from the approved Stage 1 scene, never from a blank file.

blender -b Stage1.blend --python-exit-code 1 --python this.py -- \
  --assets /path/to/polyhaven/maps --output /path/to/stage2

All texture assets are packed. Thermal colors are a static qualitative display,
not temperatures or a heat-transfer calculation. Geometry and animation persist.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


def mesh_fingerprint(scene):
    result = {}
    for obj in scene.objects:
        if obj.type != 'MESH': continue
        digest = hashlib.sha256()
        for v in obj.data.vertices: digest.update(np.asarray(v.co, dtype='<f4').tobytes())
        for poly in obj.data.polygons: digest.update(np.asarray(poly.vertices, dtype='<i4').tobytes())
        digest.update(np.asarray(obj.matrix_world, dtype='<f4').tobytes())
        result[obj.name] = digest.hexdigest()
    return result


def branch_uv(obj):
    mesh = obj.data
    sides = len(mesh.polygons[-1].vertices)
    if sides < 8 or len(mesh.vertices) % sides:
        raise ValueError(f'Unexpected branch topology: {obj.name}')
    rings = len(mesh.vertices) // sides
    vertices = [obj.matrix_world @ v.co for v in mesh.vertices]
    centers = [sum(vertices[i*sides:(i+1)*sides], Vector()) / sides for i in range(rings)]
    circumference = [sum((vertices[i*sides+k] - vertices[i*sides+(k+1)%sides]).length
                         for k in range(sides)) for i in range(rings)]
    distances = [0]
    for a, b in zip(centers, centers[1:]): distances.append(distances[-1] + (b-a).length)
    uv = mesh.uv_layers.get('Bark_1m') or mesh.uv_layers.new(name='Bark_1m')
    seam = sides * 3 // 4  # rear of the authored branch frame
    for poly in mesh.polygons:
        if len(poly.vertices) == 4:
            indices = [(v % sides - seam) % sides for v in poly.vertices]
            wrap = max(indices)-min(indices) > sides/2
            for loop, index, vertex in zip(poly.loop_indices, indices, poly.vertices):
                if wrap and index == 0: index = sides
                ring = vertex // sides
                uv.data[loop].uv = (index/sides * circumference[ring], distances[ring])
        else:
            # Separate planar cap islands, in meters. Repetition is intentional.
            ring = poly.vertices[0] // sides
            center = centers[ring]
            normal = obj.matrix_world.to_3x3() @ poly.normal
            axis_u = (vertices[poly.vertices[0]] - center).normalized()
            axis_v = normal.cross(axis_u).normalized()
            for loop, vertex in zip(poly.loop_indices, poly.vertices):
                delta = vertices[vertex]-center
                uv.data[loop].uv = (10 + delta.dot(axis_u), 10 + delta.dot(axis_v))
    for edge in mesh.edges:
        a, b = edge.vertices
        edge.use_seam = a % sides == seam and b % sides == seam
    mesh.uv_layers.active = uv
    obj['UV mapping'] = 'Bark_1m: ring perimeter and axial arc length in meters; rear seam; planar end caps'


def soil_uv(obj):
    uv = obj.data.uv_layers.get('Soil_2m') or obj.data.uv_layers.new(name='Soil_2m')
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda k: abs(face.normal[k]))
        axes = [(1, 2), (0, 2), (0, 1)][axis]
        for loop, vertex in zip(face.loop_indices, face.vertices):
            co = obj.matrix_world @ obj.data.vertices[vertex].co
            uv.data[loop].uv = (co[axes[0]]/2, co[axes[1]]/2)
    obj.data.uv_layers.active = uv
    obj['UV mapping'] = 'Soil_2m: dominant-face planar mapping, one tile per 2 meters'


def leaf_uv(obj):
    assert len(obj.data.vertices) % 21 == 0
    uv = obj.data.uv_layers.get('Leaf') or obj.data.uv_layers.new(name='Leaf')
    projected = {}
    for start in range(0, len(obj.data.vertices), 21):
        points = [obj.data.vertices[start+i].co for i in range(21)]
        distances = [0.0]
        for row in range(1, 7):
            distances.append(distances[-1]+(points[row*3+1]-points[(row-1)*3+1]).length)
        length = distances[-1]
        # Follow the pointed outline instead of expanding each narrow tip into
        # a rectangular row. Surface arc lengths preserve the raised midrib at
        # each tip; a simple planar projection collapses those small tip faces.
        for row in range(7):
            left, center, right = points[row*3:row*3+3]
            v = distances[row]/length
            projected[start+row*3] = (.5-(left-center).length/length, v)
            projected[start+row*3+1] = (.5, v)
            projected[start+row*3+2] = (.5+(right-center).length/length, v)
    for face in obj.data.polygons:
        for loop, vertex in zip(face.loop_indices, face.vertices):
            uv.data[loop].uv = projected[vertex]
    obj.data.uv_layers.active = uv
    obj['UV mapping'] = 'Leaf: individual leaf islands intentionally overlap to reuse the same procedural surface'


def uv_metrics(obj, name):
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers[name]
    ratios, density = [], []
    collapsed_uv = degenerate_geometry = 0
    for tri in mesh.loop_triangles:
        a, b, c = [obj.matrix_world @ mesh.vertices[v].co for v in tri.vertices]
        e1, e2 = b-a, c-a
        normal = e1.cross(e2)
        if normal.length < 1e-12:
            degenerate_geometry += 1
            continue
        x = e1.normalized(); y = normal.normalized().cross(x)
        plane = np.array([[e1.length, e2.dot(x)], [0, e2.dot(y)]])
        q = [np.array(uv.data[l].uv) for l in tri.loops]
        mapping = np.column_stack((q[1]-q[0], q[2]-q[0])) @ np.linalg.inv(plane)
        singular = np.linalg.svd(mapping, compute_uv=False)
        if singular[-1] < 1e-10:
            collapsed_uv += 1
            continue
        ratios.append(float(singular[0]/singular[-1]))
        density.append(float(math.sqrt(singular[0]*singular[-1])))
    return {'object': obj.name, 'uv_map': name, 'triangles': len(mesh.loop_triangles),
            'degenerate_geometry_triangles': degenerate_geometry,
            'collapsed_uv_triangles_on_valid_geometry': collapsed_uv,
            'stretch_ratio_median': float(np.median(ratios)),
            'stretch_ratio_p95': float(np.percentile(ratios, 95)),
            'stretch_ratio_max': max(ratios),
            'median_uv_units_per_meter': float(np.median(density)),
            'finite_coordinates': all(math.isfinite(c) for item in uv.data for c in item.uv)}


def image_node(nodes, assets, filename, color=False):
    node = nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(str(assets/filename), check_existing=True)
    node.image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    node.image.pack()
    node.image.filepath = '//packed_assets/' + filename
    node.extension = 'REPEAT'
    return node


def texture_material(material, assets, stem, uv_name, gain, bump_distance):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    coord = nodes.new('ShaderNodeUVMap'); coord.uv_map = uv_name
    for suffix in ['diff', 'bump', 'rough']:
        tex = image_node(nodes, assets, f'{stem}_{suffix}_2k.jpg', suffix == 'diff')
        links.new(coord.outputs['UV'], tex.inputs['Vector'])
        if suffix == 'diff':
            tone = nodes.new('ShaderNodeMixRGB'); tone.blend_type = 'MULTIPLY'
            tone.inputs[0].default_value = 1
            tone.inputs[2].default_value = (*gain, 1)
            links.new(tex.outputs['Color'], tone.inputs[1])
            links.new(tone.outputs[0], bsdf.inputs['Base Color'])
        elif suffix == 'bump':
            bump = nodes.new('ShaderNodeBump')
            bump.inputs['Strength'].default_value = .45
            bump.inputs['Distance'].default_value = bump_distance
            links.new(tex.outputs[0], bump.inputs['Height'])
            links.new(bump.outputs[0], bsdf.inputs['Normal'])
        else: links.new(tex.outputs[0], bsdf.inputs['Roughness'])


def emission_material(name, color):
    material = bpy.data.materials.new(name); material.use_nodes = True
    nodes = material.node_tree.nodes; nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial'); shader = nodes.new('ShaderNodeEmission')
    shader.inputs[0].default_value = (*color, 1)
    material.node_tree.links.new(shader.outputs[0], out.inputs['Surface'])
    return material


def text(scene, camera, name, body, x, y, size=.14, color=(.8, .85, .9)):
    data = bpy.data.curves.new(name, 'FONT'); data.body = body; data.size = size
    data.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
    obj.parent = camera; obj.location = (x, y, -10)
    data.materials.append(emission_material(name, color))
    obj.visible_shadow = False
    return obj


def camera(scene, name, position, target, scale):
    data = bpy.data.cameras.new(name); data.type = 'ORTHO'; data.ortho_scale = scale
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = obj
    return obj


def configure(scene, width=1600, height=1200):
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 24
    scene.cycles.use_denoising = True; scene.cycles.max_bounces = 5
    scene.render.resolution_x = width; scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.fps = 30; scene.frame_start = 1; scene.frame_end = 300
    scene.frame_set(66)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = .4


def math_node(nodes, operation, value=None):
    node = nodes.new('ShaderNodeMath'); node.operation = operation
    if value is not None: node.inputs[1].default_value = value
    return node


def thermal_material(name, baseline):
    material = bpy.data.materials.new(name); material.use_nodes = True
    material['Scientific status'] = 'QUALITATIVE STATIC DISPLAY ONLY; dimensionless colors, no temperature data'
    nodes, links = material.node_tree.nodes, material.node_tree.links
    position = nodes.new('ShaderNodeNewGeometry').outputs['Position']
    def influence(center, radius, amplitude):
        subtract = nodes.new('ShaderNodeVectorMath'); subtract.operation = 'SUBTRACT'
        subtract.inputs[1].default_value = center; links.new(position, subtract.inputs[0])
        scale = nodes.new('ShaderNodeVectorMath'); scale.operation = 'MULTIPLY'
        scale.inputs[1].default_value = [1/r for r in radius]; links.new(subtract.outputs[0], scale.inputs[0])
        norm = nodes.new('ShaderNodeVectorMath'); norm.operation = 'DOT_PRODUCT'
        links.new(scale.outputs[0], norm.inputs[0]); links.new(scale.outputs[0], norm.inputs[1])
        falloff = math_node(nodes, 'MULTIPLY', -1.1); links.new(norm.outputs['Value'], falloff.inputs[0])
        exponential = math_node(nodes, 'EXPONENT'); links.new(falloff.outputs[0], exponential.inputs[0])
        result = math_node(nodes, 'MULTIPLY', amplitude); links.new(exponential.outputs[0], result.inputs[0])
        return result.outputs[0]
    hot = influence((1.4, .72, -.68), (1.7, 1.4, .65), .98)
    cold = influence((-1.4, 0, -2.19), (.68, .68, .75), -.33)
    total = math_node(nodes, 'ADD'); links.new(hot, total.inputs[0]); links.new(cold, total.inputs[1])
    shifted = math_node(nodes, 'ADD', baseline); links.new(total.outputs[0], shifted.inputs[0])
    ramp = nodes.new('ShaderNodeValToRGB')
    colors = [(0, (.016, .045, .38, 1)), (.16, (.015, .45, .78, 1)),
              (.30, (.10, .37, .32, 1)), (.49, (.82, .67, .15, 1)),
              (.70, (.96, .19, .018, 1)), (1, (.58, .008, .012, 1))]
    for element in list(ramp.color_ramp.elements)[2:]: ramp.color_ramp.elements.remove(element)
    for i, (at, color) in enumerate(colors):
        element = ramp.color_ramp.elements[i] if i < 2 else ramp.color_ramp.elements.new(at)
        element.position = at; element.color = color
    links.new(shifted.outputs[0], ramp.inputs[0])
    bsdf = nodes.get('Principled BSDF')
    links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    links.new(ramp.outputs[0], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = .35
    bsdf.inputs['Roughness'].default_value = .8
    return material


def copy_with_material(obj, collection, material):
    duplicate = obj.copy(); duplicate.name = 'Review • ' + obj.name
    collection.objects.link(duplicate)
    for slot in duplicate.material_slots: slot.link = 'OBJECT'; slot.material = material
    return duplicate


def checker_material(uv_name, scale):
    mat = bpy.data.materials.new('UV checker • ' + uv_name); mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    coord = n.new('ShaderNodeUVMap'); coord.uv_map = uv_name
    checker = n.new('ShaderNodeTexChecker'); checker.inputs['Scale'].default_value = scale
    checker.inputs['Color1'].default_value = (.025, .10, .09, 1)
    checker.inputs['Color2'].default_value = (.75, .84, .65, 1)
    l.new(coord.outputs['UV'], checker.inputs['Vector'])
    l.new(checker.outputs['Color'], n.get('Principled BSDF').inputs['Base Color'])
    return mat


def configure_review_workspace(scene):
    """Open the editable candidate on its camera, without inherited console input."""
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'CONSOLE':
                area.type = 'VIEW_3D'
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.shading.type = 'MATERIAL'
                space.overlay.show_overlays = False
                space.camera = scene.camera
                space.region_3d.view_perspective = 'CAMERA'
                space.region_3d.view_camera_zoom = 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--no-render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    assets, output = Path(args.assets).resolve(), Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    candidate = output/'Materials_Thermal_Stage_2.blend'
    assert not candidate.exists(), 'Choose a new output directory; existing candidates are preserved.'
    source = Path(bpy.data.filepath); source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    main_scene = bpy.context.scene; main_scene.frame_set(66); bpy.context.view_layer.update()
    original = mesh_fingerprint(main_scene)
    soils = [o for o in main_scene.objects if o.type == 'MESH' and o.name[:2] in ('01','02','03','04')]
    bark = bpy.data.materials['Living root and tree • fissured brown bark']
    branches = [o for o in main_scene.objects if o.type == 'MESH' and bark in list(o.data.materials)]
    for obj in branches: branch_uv(obj)
    for obj in soils: soil_uv(obj)
    foliage = bpy.data.objects['Living crown • varied curved leaves']; leaf_uv(foliage)
    texture_material(bark, assets, 'bark_brown_01', 'Bark_1m', (.48, .42, .34), .006)
    char = bpy.data.materials['Root • discontinuous char over surviving bark']
    n, l = char.node_tree.nodes, char.node_tree.links
    position = n.new('ShaderNodeNewGeometry')
    cracks = n.new('ShaderNodeTexVoronoi'); cracks.feature = 'DISTANCE_TO_EDGE'
    cracks.inputs['Scale'].default_value = 120
    l.new(position.outputs['Position'], cracks.inputs['Vector'])
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .65
    bump.inputs['Distance'].default_value = .002
    l.new(cracks.outputs['Distance'], bump.inputs['Height'])
    bsdf = n.get('Principled BSDF'); l.new(bump.outputs[0], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = .95
    humus = bpy.data.materials['O • fibrous humus']
    litter = humus.copy(); litter.name = 'Surface litter • packed Poly Haven forest floor'
    texture_material(litter, assets, 'forrest_ground_03', 'Soil_2m', (.65, .61, .53), .008)
    for obj in soils:
        obj['Layer'] = ['O • humus','A • loam','B • subsoil','C • parent material'][int(obj.name[:2])-1]
        obj['Thermal role'] = 'Distinct material stratum; thermal coefficients require separate measured inputs'
        if obj.name.startswith('01'):
            slot = len(obj.data.materials); obj.data.materials.append(litter)
            for face in obj.data.polygons:
                if face.normal.z > .5: face.material_index = slot
        for mat in obj.data.materials:
            if mat == litter: continue
            for node in mat.node_tree.nodes:
                if node.type == 'BUMP':
                    node.inputs['Distance'].default_value = min(node.inputs['Distance'].default_value, .012)
                    node.inputs['Strength'].default_value = min(node.inputs['Strength'].default_value, .5)
    # A leaf-space midrib follows each curved leaf, independent of canopy bounds.
    for mat in foliage.data.materials:
        n, l = mat.node_tree.nodes, mat.node_tree.links
        uv = n.new('ShaderNodeUVMap'); uv.uv_map = 'Leaf'
        separate = n.new('ShaderNodeSeparateXYZ'); l.new(uv.outputs[0], separate.inputs[0])
        center = math_node(n, 'SUBTRACT', .5); l.new(separate.outputs['X'], center.inputs[0])
        absolute = math_node(n, 'ABSOLUTE'); l.new(center.outputs[0], absolute.inputs[0])
        line = math_node(n, 'LESS_THAN', .018); l.new(absolute.outputs[0], line.inputs[0])
        bump = n.new('ShaderNodeBump'); bump.inputs['Distance'].default_value = .0003
        bump.inputs['Strength'].default_value = .2; l.new(line.outputs[0], bump.inputs['Height'])
        bsdf = n.get('Principled BSDF')
        if bsdf.inputs['Normal'].is_linked: l.new(bsdf.inputs['Normal'].links[0].from_socket, bump.inputs['Normal'])
        l.new(bump.outputs[0], bsdf.inputs['Normal']); bsdf.inputs['Roughness'].default_value = .58

    root = next(o for o in main_scene.objects if o.name.startswith('Root •'))
    trunk = next(o for o in main_scene.objects if o.name.startswith('Small tree •'))
    ice = next(o for o in main_scene.objects if o.name.startswith('DRY ICE'))
    peat = next(o for o in main_scene.objects if o.name.startswith('Peat lens'))
    report = {'stage': 2, 'approval': 'pending', 'stage_1_approval': 'Approved by user, with thermal layers requested',
              'source_sha256': source_sha, 'source_file': source.name,
              'geometry_unchanged': original == mesh_fingerprint(main_scene),
              'uv': [uv_metrics(o, 'Bark_1m') for o in [root, trunk]] +
                    [uv_metrics(o, 'Soil_2m') for o in soils] + [uv_metrics(foliage, 'Leaf')],
              'branch_objects_unwrapped': len(branches), 'soil_objects_mapped': len(soils),
              'thermal_basis': 'Dimensionless static illustrative field, independently selectable; no solver temperature data',
              'asset_scales_m': {'bark_brown_01': 1, 'forrest_ground_03': 2}}
    assert report['geometry_unchanged']
    assert all(r['finite_coordinates'] and not r['collapsed_uv_triangles_on_valid_geometry'] for r in report['uv'])
    configure(main_scene)
    main_scene.name = '01 MATERIALS • Stage 2'
    review_layer = main_scene.view_layers.new('MATERIAL_REVIEW')
    for layer in main_scene.view_layers: layer.use = layer == review_layer
    for child in review_layer.layer_collection.children:
        if child.name in {'SOIL_FRONT • top view only','CO2','FIRE','SHOCKWAVE','ANNOTATIONS','SECTION_LABELS','TOP_LABELS'}:
            child.exclude = True
    bpy.context.window.view_layer = review_layer
    cam = camera(main_scene, 'CAM_STAGE2_MATERIALS', (5,-16,7), (0,1,-.2), 11.8)
    text(main_scene, cam, 'Stage 2 title', 'MATERIALS AND SOIL STRATA', -5.25, 3.95, .24)
    text(main_scene, cam, 'Stage 2 subtitle', 'Stage 2 / material and UV review', -5.25, 3.62, .14)
    text(main_scene, cam, 'Stage 2 footer', 'O humus   /   A organic loam   /   B iron-rich subsoil   /   C sandy parent material', -5.25, -3.95, .14)
    for i, z in enumerate([-.12,-.5,-1.29,-2.47]):
        data = bpy.data.curves.new('Stratum label', 'FONT'); data.body = 'OABC'[i]; data.size = .16
        ob = bpy.data.objects.new('Layer label ' + data.body, data); main_scene.collection.objects.link(ob)
        ob.location = (-3.68,-.18,z); ob.rotation_euler = cam.rotation_euler
        data.materials.append(emission_material('Layer letter', (.72,.73,.69)))
    main_scene['Review stage'] = 'Stage 1 approved; Stage 2 material/UV approval pending'

    thermal = bpy.data.scenes.new('02 THERMAL • illustrative')
    configure(thermal); thermal.world = main_scene.world
    thermal.unit_settings.system = 'METRIC'
    thermal.frame_start = thermal.frame_end = 66
    thermal['Scientific status'] = 'Illustrative dimensionless thermal zones, fixed at frame 66; not calculated temperature or suppression'
    tc = bpy.data.collections.new('THERMAL GEOMETRY'); thermal.collection.children.link(tc)
    for col in ['LIGHTING', 'SURFACE_DETAIL', 'TREE • partially burned root connection']:
        thermal.collection.children.link(bpy.data.collections[col])
    cutter = next(o for o in main_scene.objects if 'editable cutter' in o.name); thermal.collection.objects.link(cutter)
    baselines = [.32,.30,.26,.23]
    for obj in soils:
        if 'removable front' in obj.name: continue
        idx = int(obj.name[:2])-1
        copy_with_material(obj, tc, thermal_material('Thermal stratum ' + 'OABC'[idx], baselines[idx]))
    copy_with_material(peat, tc, thermal_material('Thermal peat', .30))
    copy_with_material(ice, tc, thermal_material('Thermal cold source', .15))
    thermal_cam = camera(thermal, 'CAM_STAGE2_THERMAL', (5,-16,7), (0,1,-.2), 11.8)
    text(thermal, thermal_cam, 'Thermal title', 'THERMAL LAYERS', -5.25, 3.95, .24)
    text(thermal, thermal_cam, 'Thermal subtitle', 'ILLUSTRATIVE ZONES / no temperature data', -5.25, 3.60, .15)
    for x, label, color in [(-5.2,'COLD SOURCE',(.12,.4,1)),(-2.3,'BACKGROUND',(.25,.68,.5)),
                             (.7,'WARMER ZONE',(1,.66,.15)),(3.3,'HOT PEAT',(1,.22,.07))]:
        text(thermal, thermal_cam, label, label, x, -3.85, .14, color)

    uv_scene = bpy.data.scenes.new('03 UV CHECK • Stage 2')
    configure(uv_scene); uv_scene.world = main_scene.world
    uv_scene.collection.children.link(bpy.data.collections['LIGHTING'])
    uv_col = bpy.data.collections.new('UV CHECK GEOMETRY'); uv_scene.collection.children.link(uv_col)
    checker = checker_material('Bark_1m', 10)
    copy_with_material(root, uv_col, checker); copy_with_material(trunk, uv_col, checker)
    uv_scene.collection.objects.link(peat)
    for obj in soils:
        if 'removable front' not in obj.name: uv_scene.collection.objects.link(obj)
    uv_scene.collection.objects.link(cutter)
    uv_cam = camera(uv_scene, 'CAM_STAGE2_UV', (1.4,-9,1.8), (1.4,0,-.12), 3.7)
    text(uv_scene, uv_cam, 'UV title', 'ROOT AND TRUNK UV CHECK', -1.6, 1.22, .082)
    text(uv_scene, uv_cam, 'UV subtitle', 'Nominal 10 cm checks / taper and curvature cause distortion', -1.6, 1.08, .044)
    uv_scene['UV review'] = '10 cm nominal checks; taper/curvature distortion measured in material_checks.json'

    credits = json.loads((assets/'sources.json').read_text())
    packed = [i for i in bpy.data.images if i.source == 'FILE']
    assert len(packed) == 6 and all(i.packed_file for i in packed)
    report['packed_images'] = [{'name': i.name, 'bytes': i.packed_file.size,
                                'sha256': hashlib.sha256(bytes(i.packed_file.data)).hexdigest(),
                                'color_space': i.colorspace_settings.name} for i in packed]
    credit = bpy.data.texts.new('ASSET CREDITS'); credit.write(json.dumps(credits, indent=2))
    start = bpy.data.texts.new('START HERE • Stage 2')
    start.write('STAGE 2 MATERIAL AND UV REVIEW\n\nUse the Scene dropdown:\n01 MATERIALS: soil strata and packed bark/forest-floor textures.\n02 THERMAL: separate static, illustrative warm/cold zones. No temperature data; not a simulation result.\n03 UV CHECK: root/trunk checker inspection.\n\nStage 1 approved. Stage 2 pending user approval. Original geometry and animation keys are preserved. Original SECTION and TOP view layers remain available. The remaining final four-frame review is reserved for Stage 6.\n')
    bpy.ops.file.pack_all()
    bpy.context.window.scene = main_scene; bpy.context.window.view_layer = review_layer
    configure_review_workspace(main_scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(candidate), compress=True)
    report['candidate_sha256'] = hashlib.sha256(candidate.read_bytes()).hexdigest()
    (output/'material_checks.json').write_text(json.dumps(report, indent=2)+'\n')
    (output/'asset_sources.json').write_text(json.dumps(credits, indent=2)+'\n')
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
    print('STAGE2_CHECKS ' + json.dumps(report), flush=True)
    if args.no_render: return
    def render(s, name):
        bpy.context.window.scene = s
        s.render.filepath = str(output/(name+'.png'))
        bpy.ops.render.render(write_still=True, scene=s.name)
    render(main_scene, '01_material_section')
    render(thermal, '02_thermal_layers')
    render(uv_scene, '03_uv_checker')
    # The final two material closeups are temporary review framing only.
    for ob in list(main_scene.objects):
        if ob.type == 'FONT': ob.hide_render = True
    cam.location = (1.4,-9,1.8)
    cam.rotation_euler = (Vector((1.4,0,-.12))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale = 3.1
    render(main_scene, '04_bark_char_closeup')
    cam.location = (-1.4,-5,-.95)
    cam.rotation_euler = (Vector((-1.4,0,-2.10))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale = 1.45
    render(main_scene, '05_frost_soil_closeup')
    print('STAGE2_RENDER_COMPLETE', flush=True)


if __name__ == '__main__': main()
