import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const COMPACTION_GROUPS = { burning: 'vibration-burning-ground', settled: 'vibration-settled-ground', fireOnly: 'vibration-fire-only' } as const

/** Owned output illustration. Blend the original public fire-on/off appearances
 * at identical geometry/camera, rather than guessing which colors are embers.
 * Original materials, fields and shaders are never touched. This is not a
 * temperature, oxygen, mechanical work or physical extinction calculation. */
export function createCompactionPass() {
  const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: depth })
  const reference = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true })
  const uniforms = {
    image: { value: target.texture }, settledImage: { value: reference.texture }, depth: { value: depth }, progress: { value: 0 },
    inverseProjection: { value: new THREE.Matrix4() }, cameraWorld: { value: new THREE.Matrix4() },
  }
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 uvImage; void main(){uvImage=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 uvImage;
      uniform sampler2D image,settledImage,depth; uniform float progress;
      uniform mat4 inverseProjection,cameraWorld;
      void main(){
        vec4 color=texture2D(image,uvImage);
        float d=texture2D(depth,uvImage).r;
        vec4 view=inverseProjection*vec4(uvImage*2.-1.,d*2.-1.,1.);
        vec3 world=(cameraWorld*vec4(view.xyz/view.w,1.)).xyz;
        float front=1.-smoothstep(progress*5.-.3,progress*5.+.1,length(world.xy-vec2(.4,-1.3)));
        float fade=mix(front*progress,1.,smoothstep(.9,1.,progress));
        gl_FragColor=mix(color,texture2D(settledImage,uvImage),fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const geometry = new THREE.PlaneGeometry(2, 2), output = new THREE.Scene(), camera = new THREE.Camera()
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false; output.add(quad)
  const size = new THREE.Vector2(), viewport = new THREE.Vector4(), scissor = new THREE.Vector4()
  let disposed = false
  return {
    target, reference, material, geometry, depth,
    render(gl: THREE.WebGLRenderer, scene: THREE.Scene, viewCamera: THREE.Camera, progress: number) {
      if (disposed) throw new Error('Compaction output pass is disposed.')
      if (progress <= 0) { gl.render(scene, viewCamera); return }
      const burning = scene.getObjectByName(COMPACTION_GROUPS.burning), settled = scene.getObjectByName(COMPACTION_GROUPS.settled), fireOnly = scene.getObjectByName(COMPACTION_GROUPS.fireOnly)
      if (!burning || !settled || !fireOnly) throw new Error('Compaction appearance groups are missing.')
      const visibility = [burning.visible, settled.visible, fireOnly.visible]
      const appearance = (showSettled: boolean) => { burning.visible = !showSettled; settled.visible = showSettled; fireOnly.visible = !showSettled }
      gl.getDrawingBufferSize(size)
      if (target.width !== size.x || target.height !== size.y) target.setSize(Math.max(1, size.x), Math.max(1, size.y))
      if (reference.width !== size.x || reference.height !== size.y) reference.setSize(Math.max(1, size.x), Math.max(1, size.y))
      uniforms.progress.value = progress
      const previous = gl.getRenderTarget(), autoClear = gl.autoClear, scissorTest = gl.getScissorTest()
      gl.getViewport(viewport); gl.getScissor(scissor)
      try {
        // The endpoint is the same original public fire-off appearance approached
        // by the blend, with no React fire-prop switch or final color-mask jump.
        if (progress >= 1) { appearance(true); gl.render(scene, viewCamera); return }
        appearance(false)
        gl.autoClear = true; gl.setScissorTest(false); gl.setRenderTarget(target); gl.render(scene, viewCamera)
        uniforms.inverseProjection.value.copy(viewCamera.projectionMatrixInverse)
        uniforms.cameraWorld.value.copy(viewCamera.matrixWorld)
        appearance(true); gl.setRenderTarget(reference); gl.render(scene, viewCamera)
        gl.setRenderTarget(previous); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest)
        gl.render(output, camera)
      } finally {
        burning.visible = visibility[0]; settled.visible = visibility[1]; fireOnly.visible = visibility[2]
        gl.setRenderTarget(previous); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest); gl.autoClear = autoClear
      }
    },
    dispose() { if (disposed) return; disposed = true; output.clear(); geometry.dispose(); material.dispose(); depth.dispose(); target.dispose(); reference.dispose() },
  }
}

export function CompactionPass({ progress }: { progress: number }) {
  const pass = useRef<ReturnType<typeof createCompactionPass> | null>(null), current = useRef(progress)
  useLayoutEffect(() => { current.current = progress }, [progress])
  // Allocate inside the effect so StrictMode cleanup/setup gets fresh resources.
  useEffect(() => { const owned = createCompactionPass(); pass.current = owned; return () => { pass.current = null; owned.dispose() } }, [])
  useFrame(({ gl, scene, camera }) => { if (pass.current) pass.current.render(gl, scene, camera, current.current); else gl.render(scene, camera) }, 1)
  return null
}
