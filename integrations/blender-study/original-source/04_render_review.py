import time
# Repair top framing for a square render and keep the complete 8 m footprint.
top.data.ortho_scale=10.4
bpy.data.objects['Top title'].location.y=4.67
bpy.data.objects['Top subtitle'].location.y=4.36
bpy.data.objects['Top footer'].location.y=-4.75
ATTEMPT=int(os.environ.get('PEAT_REVIEW_ATTEMPT','3'))
RDIR=OUT/'review'/('attempt_%02d'%ATTEMPT);RDIR.mkdir(exist_ok=True)
jobs=[('01_section_before_release',66,'SECTION',section,1600,1200),('02_section_expansion',96,'SECTION',section,1600,1200),('03_section_partial_suppression',240,'SECTION',section,1600,1200),('04_top_expansion',126,'TOP',top,1400,1400)]
renderlog=ROOT/'work/render_status.json'
renderstate={'attempt':ATTEMPT,'completed':[],'state':'queued'}
def write_status():renderlog.write_text(json.dumps(renderstate,indent=2))
def queue_next():
    if bpy.app.is_job_running('RENDER'):return 1.0
    if not jobs:
        renderstate['state']='complete';write_status()
        scene.camera=section;scene.frame_set(100);bpy.context.window.view_layer=scene.view_layers['SECTION']
        scene.view_layers['SECTION'].use=True;scene.view_layers['TOP'].use=False
        scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.cycles.samples=64
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Dry_Ice_Peat_Study.blend'))
        return None
    name,frame,layer,cam,w,h=jobs.pop(0)
    scene.camera=cam;scene.frame_set(frame)
    for vl in scene.view_layers:vl.use=vl.name==layer
    bpy.context.window.view_layer=scene.view_layers[layer]
    scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100;scene.cycles.samples=64
    scene.render.filepath=str(RDIR/(name+'.png'))
    renderstate['state']='rendering';renderstate['current']=name;write_status()
    bpy.ops.render.render('INVOKE_DEFAULT',write_still=True)
    return None
def finished_render(s):
    renderstate['completed'].append(renderstate['current']);renderstate['state']='between renders';write_status()
    bpy.app.timers.register(queue_next,first_interval=1.2)
def canceled_render(s):renderstate['state']='canceled';write_status()
for handler in list(bpy.app.handlers.render_complete):
    if handler.__name__=='finished_render':bpy.app.handlers.render_complete.remove(handler)
for handler in list(bpy.app.handlers.render_cancel):
    if handler.__name__=='canceled_render':bpy.app.handlers.render_cancel.remove(handler)
bpy.app.handlers.render_complete.append(finished_render);bpy.app.handlers.render_cancel.append(canceled_render)
write_status();bpy.app.timers.register(queue_next,first_interval=.5)
