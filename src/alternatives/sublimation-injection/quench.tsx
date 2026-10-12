import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Owned, presentation-only output pass. It never traverses/replaces original
 * materials or writes simulation fields. All original scene objects render
 * unchanged into this alternative's temporary target. */
export function createQuenchPass() {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: true, samples: 2,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  })
  const uniforms = {
    tScene: { value: target.texture }, tDepth: { value: target.depthTexture },
    uInverseProjection: { value: new THREE.Matrix4() },
    uCameraWorld: { value: new THREE.Matrix4() }, uProgress: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: true,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tScene,tDepth;
      uniform mat4 uInverseProjection,uCameraWorld;
      uniform float uProgress;
      void main() {
        vec4 source=texture2D(tScene,vUv);
        float depth=texture2D(tDepth,vUv).r;
        vec4 view=uInverseProjection*vec4(vUv*2.0-1.0,depth*2.0-1.0,1.0);
        vec3 world=(uCameraWorld*vec4(view.xyz/view.w,1.0)).xyz;
        // Authored visual front, not calculated wetting or a temperature field.
        float radius=uProgress*5.2;
        float front=1.0-smoothstep(radius-.22,radius+.22,length(world.xy-vec2(.4,-1.3)));
        float belowGround=1.0-smoothstep(-.12,.02,world.y);
        float orange=smoothstep(.14,.6,source.r)
          *smoothstep(1.35,2.5,source.r/(source.g+.02))
          *(1.0-smoothstep(.6,1.1,source.b/(source.r+.02)));
        float fade=front*belowGround*orange*smoothstep(0.0,.06,uProgress);
        vec3 cooled=min(source.rgb,vec3(.025,.021,.017));
        gl_FragColor=vec4(mix(source.rgb,cooled,fade),source.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const geometry = new THREE.PlaneGeometry(2, 2)
  const output = new THREE.Scene()
  const quad = new THREE.Mesh(geometry, material)
  quad.frustumCulled = false
  output.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  return {
    target, uniforms, material, geometry, output, camera,
    size: new THREE.Vector2(),
    dispose() { target.dispose(); material.dispose(); geometry.dispose(); output.clear() },
  }
}

export type QuenchPass = ReturnType<typeof createQuenchPass>
type Renderer = Pick<THREE.WebGLRenderer, 'getRenderTarget' | 'setRenderTarget' | 'getDrawingBufferSize' | 'render'>

/** Only the render target is changed, restored even if a render fails. A zero
 * mask uses the normal direct render, retaining the original color pipeline. */
export function renderQuenchFrame(gl: Renderer, scene: THREE.Scene, camera: THREE.Camera, pass: QuenchPass, value: number) {
  const progress = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  if (progress === 0) { gl.render(scene, camera); return }
  gl.getDrawingBufferSize(pass.size)
  const width = Math.max(1, Math.round(pass.size.x)), height = Math.max(1, Math.round(pass.size.y))
  if (pass.target.width !== width || pass.target.height !== height) {
    pass.target.setSize(width, height)
    if (pass.target.depthTexture) {
      pass.target.depthTexture.image.width = width
      pass.target.depthTexture.image.height = height
      pass.target.depthTexture.needsUpdate = true
    }
  }
  camera.updateMatrixWorld()
  pass.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse)
  pass.uniforms.uCameraWorld.value.copy(camera.matrixWorld)
  pass.uniforms.uProgress.value = progress
  const previous = gl.getRenderTarget()
  try {
    gl.setRenderTarget(pass.target)
    gl.render(scene, camera)
    gl.setRenderTarget(previous)
    gl.render(pass.output, pass.camera)
  } finally {
    gl.setRenderTarget(previous)
  }
}

/** Positive R3F render priority is an ordinary owned compositor subscription.
 * R3F removes it on unmount; no renderer methods or original state are patched. */
export function IllustrativeQuench({ progress }: { progress: number }) {
  const pass = useMemo(createQuenchPass, [])
  useEffect(() => () => pass.dispose(), [pass])
  useFrame(({ gl, scene, camera }) => renderQuenchFrame(gl, scene, camera, pass, progress), 1)
  return null
}
