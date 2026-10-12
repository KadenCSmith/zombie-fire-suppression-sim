import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createQuenchPass, renderQuenchFrame } from '../../../src/alternatives/sublimation-injection/quench'
import { preparationVisuals } from '../../../src/alternatives/sublimation-injection/visuals'

function renderer(throwOnRender = false) {
  const previous = new THREE.WebGLRenderTarget(2, 2)
  let current: THREE.WebGLRenderTarget | null = previous
  return {
    previous,
    current: () => current,
    gl: {
      getRenderTarget: () => current,
      getDrawingBufferSize: (size: THREE.Vector2) => size.set(640, 360),
      setRenderTarget: vi.fn((target: THREE.WebGLRenderTarget | null) => { current = target }),
      render: vi.fn((_scene: THREE.Scene, _camera: THREE.Camera) => {
        if (throwOnRender) throw new Error('render failed')
      }),
    },
  }
}

describe('owned illustrative quenching renderer', () => {
  it('starts after water reaches the access and completes before the public fire layer turns off', () => {
    expect(preparationVisuals(60).quench).toBe(0)
    expect(preparationVisuals(75).quench).toBeGreaterThan(0)
    expect(preparationVisuals(85).quench).toBe(1)
    expect(preparationVisuals(60).steam).toBe(0)
    expect(preparationVisuals(72).steam).toBeGreaterThan(0)
    expect(preparationVisuals(90).steam).toBeCloseTo(0)
  })

  it('uses the direct color pipeline when the authored mask is zero or invalid', () => {
    const pass = createQuenchPass(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera()
    for (const progress of [0, -1, NaN, Infinity]) {
      const r = renderer()
      renderQuenchFrame(r.gl, scene, camera, pass, progress)
      expect(r.gl.render).toHaveBeenCalledExactlyOnceWith(scene, camera)
      expect(r.gl.setRenderTarget).not.toHaveBeenCalled()
      r.previous.dispose()
    }
    pass.dispose()
  })

  it('owns resized color/depth targets, camera transforms and output without changing original objects', () => {
    const a = createQuenchPass(), b = createQuenchPass(), r = renderer()
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 16 / 9, .05, 60)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
    scene.add(mesh); camera.position.set(7.2, 4, 12.3)
    const material = mesh.material, children = scene.children.slice()
    renderQuenchFrame(r.gl, scene, camera, a, .5)
    expect(a.target.width).toBe(640); expect(a.target.height).toBe(360)
    expect(a.target.depthTexture!.image.width).toBe(640)
    expect(a.uniforms.uCameraWorld.value.equals(camera.matrixWorld)).toBe(true)
    expect(a.uniforms.uInverseProjection.value.equals(camera.projectionMatrixInverse)).toBe(true)
    expect(a.uniforms.uProgress.value).toBe(.5)
    expect(b.uniforms.uProgress.value).toBe(0)
    expect(a.target).not.toBe(b.target)
    expect(a.target.depthTexture).not.toBe(b.target.depthTexture)
    expect(a.material).not.toBe(b.material)
    expect(scene.children).toEqual(children); expect(mesh.material).toBe(material)
    expect(r.current()).toBe(r.previous)
    expect(r.gl.render).toHaveBeenCalledTimes(2)
    a.dispose(); b.dispose(); r.previous.dispose()
    mesh.geometry.dispose(); mesh.material.dispose()
  })

  it('restores the prior target on render failure and disposes owned resources on cleanup', () => {
    const pass = createQuenchPass(), r = renderer(true)
    const targetDisposed = vi.fn(), materialDisposed = vi.fn(), geometryDisposed = vi.fn()
    pass.target.addEventListener('dispose', targetDisposed)
    pass.material.addEventListener('dispose', materialDisposed)
    pass.geometry.addEventListener('dispose', geometryDisposed)
    expect(() => renderQuenchFrame(r.gl, new THREE.Scene(), new THREE.PerspectiveCamera(), pass, .8)).toThrow('render failed')
    expect(r.current()).toBe(r.previous)
    // setSize legitimately disposes the target's old allocation before resize.
    targetDisposed.mockClear()
    pass.dispose()
    expect(targetDisposed).toHaveBeenCalledOnce()
    expect(materialDisposed).toHaveBeenCalledOnce()
    expect(geometryDisposed).toHaveBeenCalledOnce()
    expect(pass.output.children).toHaveLength(0)
    r.previous.dispose()
  })
})
