ASSET=OUT/'assets'
def image_node(nodes,filename,noncolor=False):
    nd=nodes.new('ShaderNodeTexImage');nd.image=bpy.data.images.load(str(ASSET/filename),check_existing=True)
    if noncolor:nd.image.colorspace_settings.name='Non-Color'
    nd.image.pack();return nd
# CC0 Poly Haven bark: box mapping keeps all native branches editable.
n=bark.node_tree.nodes;l=bark.node_tree.links;p=n.get('Principled BSDF')
tc=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeVectorMath');mp.operation='MULTIPLY';mp.inputs[1].default_value=(1.6,1.6,.8);l.new(tc.outputs['Object'],mp.inputs[0])
for role,filename in [('color','bark_brown_01_diff_2k.jpg'),('bump','bark_brown_01_bump_2k.jpg'),('rough','bark_brown_01_rough_2k.jpg')]:
    nd=image_node(n,filename,role!='color');nd.projection='BOX';nd.projection_blend=.22;l.new(mp.outputs[0],nd.inputs['Vector'])
    if role=='color':
        tone=n.new('ShaderNodeMixRGB');tone.blend_type='MULTIPLY';tone.inputs[0].default_value=1;tone.inputs[2].default_value=(.63,.58,.49,1);l.new(nd.outputs['Color'],tone.inputs[1]);l.new(tone.outputs[0],p.inputs['Base Color'])
    elif role=='bump':
        bn=n.new('ShaderNodeBump');bn.inputs['Strength'].default_value=.70;bn.inputs['Distance'].default_value=.012;l.new(nd.outputs[0],bn.inputs['Height']);l.new(bn.outputs[0],p.inputs['Normal'])
    else:l.new(nd.outputs[0],p.inputs['Roughness'])
# Blend photographic litter with the existing organic soil, on the top only.
forest=soil_mats[0].copy();forest.name='Surface litter • Poly Haven forest ground + procedural soil'
n=forest.node_tree.nodes;l=forest.node_tree.links;p=n.get('Principled BSDF');base=p.inputs['Base Color'].links[0].from_socket
tc=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeVectorMath');mp.operation='SCALE';mp.inputs['Scale'].default_value=.43;l.new(tc.outputs['Object'],mp.inputs[0])
diff=image_node(n,'forrest_ground_03_diff_2k.jpg');l.new(mp.outputs[0],diff.inputs['Vector'])
tone=n.new('ShaderNodeMixRGB');tone.blend_type='MULTIPLY';tone.inputs[0].default_value=1;tone.inputs[2].default_value=(.43,.39,.32,1);l.new(diff.outputs[0],tone.inputs[1])
blend=n.new('ShaderNodeMixRGB');blend.inputs[0].default_value=.60;l.new(base,blend.inputs[1]);l.new(tone.outputs[0],blend.inputs[2]);l.new(blend.outputs[0],p.inputs['Base Color'])
bn=image_node(n,'forrest_ground_03_bump_2k.jpg',True);l.new(mp.outputs[0],bn.inputs['Vector']);b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.56;b.inputs['Distance'].default_value=.015;l.new(bn.outputs[0],b.inputs['Height']);l.new(p.inputs['Normal'].links[0].from_socket,b.inputs['Normal']);l.new(b.outputs[0],p.inputs['Normal'])
for ob in list(cols['SOIL'].objects)+list(cols['SOIL_FRONT • top view only'].objects):
    if ob.name.startswith('01 •'):
        idx=len(ob.data.materials);ob.data.materials.append(forest)
        for face in ob.data.polygons:
            if face.normal.z>.5:face.material_index=idx
credits=bpy.data.texts.get('ASSET CREDITS') or bpy.data.texts.new('ASSET CREDITS');credits.clear();credits.write((ASSET/'sources.json').read_text())
bpy.ops.file.pack_all()
scene.frame_set(100);save();view_cam()
print('Open texture assets applied and packed into the blend file')
