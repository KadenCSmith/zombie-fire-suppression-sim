import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Owned output illustration. Original materials, fields and shaders are never
 * touched. This dims ember-colored pixels below ground; it is not temperature,
 * oxygen removal, mechanical work or a physical extinction calculation. */
export function createCompactionPass() {
  const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: depth })
  const uniforms = {
    image: { value: target.texture }, depth: { value: depth }, progress: { value: 0 },
    inverseProjection: { value: new THREE.Matrix4() }, cameraWorld: { value: new THREE.Matrix4() },
  }
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 uvImage; void main(){uvImage=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 uvImage;
      uniform sampler2D image,depth; uniform float progress;
      uniform mat4 inverseProjection,cameraWorld;
      void main(){
        vec4 color=texture2D(image,uvImage);
        float d=texture2D(depth,uvImage).r;
        vec4 view=inverseProjection*vec4(uvImage*2.-1.,d*2.-1.,1.);
        vec3 world=(cameraWorld*vec4(view.xyz/view.w,1.)).xyz;
        float below=1.-smoothstep(-.10,.0,world.y);
        float ember=smoothstep(.25,.75,color.r)*smoothstep(2.,4.,color.r/(color.g+.015));
        float front=1.-smoothstep(progress*5.-.3,progress*5.+.1,length(world.xy-vec2(.4,-1.3)));
        float fade=below*ember*front*progress;
        gl_FragColor=vec4(mix(color.rgb,min(color.rgb,vec3(.045,.030,.018)),fade),color.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const geometry = new THREE.PlaneGeometry(2, 2), output = new THREE.Scene(), camera = new THREE.Camera()
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false; output.add(quad)
  const size = new THREE.Vector2(), viewport = new THREE.Vector4(), scissor = new THREE.Vector4()
  let disposed = false
  return {
    target, material, geometry, depth,
    render(gl: THREE.WebGLRenderer, scene: THREE.Scene, viewCamera: THREE.Camera, progress: number) {
      if (disposed) throw new Error('Compaction output pass is disposed.')
      if (progress <= 0) { gl.render(scene, viewCamera); return }
      gl.getDrawingBufferSize(size)
      if (target.width !== size.x || target.height !== size.y) target.setSize(Math.max(1, size.x), Math.max(1, size.y))
      uniforms.progress.value = progress
      const previous = gl.getRenderTarget(), autoClear = gl.autoClear, scissorTest = gl.getScissorTest()
      gl.getViewport(viewport); gl.getScissor(scissor)
      try {
        gl.autoClear = true; gl.setScissorTest(false); gl.setRenderTarget(target); gl.render(scene, viewCamera)
        uniforms.inverseProjection.value.copy(viewCamera.projectionMatrixInverse)
        uniforms.cameraWorld.value.copy(viewCamera.matrixWorld)
        gl.setRenderTarget(previous); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest)
        gl.render(output, camera)
      } finally {
        gl.setRenderTarget(previous); gl.setViewport(viewport); gl.setScissor(scissor); gl.setScissorTest(scissorTest); gl.autoClear = autoClear
      }
    },
    dispose() { if (disposed) return; disposed = true; output.clear(); geometry.dispose(); material.dispose(); depth.dispose(); target.dispose() },
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
