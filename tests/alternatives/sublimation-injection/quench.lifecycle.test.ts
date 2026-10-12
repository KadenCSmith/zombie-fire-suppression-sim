import type { EffectCallback } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { QuenchPass } from '../../../src/alternatives/sublimation-injection/quench'

type FrameState = {
  gl: ReturnType<typeof renderer>
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
}

// Replay the component's actual passive effect without needing a DOM or GPU.
const hooks = vi.hoisted(() => ({
  setup: null as EffectCallback | null,
  frame: null as ((state: FrameState) => void) | null,
  ref: null as { current: QuenchPass | null } | null,
}))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (setup: EffectCallback) => { hooks.setup = setup },
  useRef: (current: QuenchPass | null) => hooks.ref ??= { current },
  useMemo: (factory: () => unknown) => factory(),
}))
vi.mock('@react-three/fiber', () => ({
  useFrame: (frame: (state: FrameState) => void) => { hooks.frame = frame },
}))

import { IllustrativeQuench } from '../../../src/alternatives/sublimation-injection/quench'

function renderer() {
  let target: THREE.WebGLRenderTarget | null = null
  return {
    getRenderTarget: () => target,
    getDrawingBufferSize: (size: THREE.Vector2) => size.set(640, 360),
    setRenderTarget: vi.fn((next: THREE.WebGLRenderTarget | null) => { target = next }),
    render: vi.fn((_scene: THREE.Scene, _camera: THREE.Camera) => {}),
  }
}

function mount() {
  hooks.setup = null; hooks.frame = null; hooks.ref = null
  IllustrativeQuench({ progress: .5 })
  return {
    setup: hooks.setup!, frame: hooks.frame!,
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
  }
}

describe('quenching component effect lifecycle', () => {
  it('keeps a fresh display quad after StrictMode setup → cleanup → setup', () => {
    const m = mount(), firstGl = renderer(), secondGl = renderer()
    const cleanupFirst = m.setup()
    m.frame({ ...m, gl: firstGl })
    const firstOutput = firstGl.render.mock.calls[1][0]
    expect(firstOutput.children).toHaveLength(1)
    const firstQuad = firstOutput.children[0] as THREE.Mesh
    const firstDisposed = vi.fn()
    firstQuad.geometry.addEventListener('dispose', firstDisposed)
    if (typeof cleanupFirst !== 'function') throw new Error('Missing effect cleanup')
    cleanupFirst()
    expect(firstDisposed).toHaveBeenCalledOnce()
    expect(firstOutput.children).toHaveLength(0)

    const cleanupSecond = m.setup()
    m.frame({ ...m, gl: secondGl })
    const secondOutput = secondGl.render.mock.calls[1][0]
    expect(secondOutput.children).toHaveLength(1)
    expect(secondOutput).not.toBe(firstOutput)
    const secondQuad = secondOutput.children[0] as THREE.Mesh
    expect(secondQuad.geometry).not.toBe(firstQuad.geometry)
    expect(secondQuad.material).not.toBe(firstQuad.material)
    const secondDisposed = vi.fn()
    secondQuad.geometry.addEventListener('dispose', secondDisposed)
    if (typeof cleanupSecond !== 'function') throw new Error('Missing replay cleanup')
    cleanupSecond()
    expect(secondDisposed).toHaveBeenCalledOnce()
    expect(secondOutput.children).toHaveLength(0)
    expect(firstDisposed).toHaveBeenCalledOnce()
    expect(hooks.ref?.current).toBeNull()
  })

  it('renders directly before effect setup and after cleanup at nonzero progress', () => {
    const m = mount(), before = renderer(), after = renderer()
    m.frame({ ...m, gl: before })
    expect(before.render).toHaveBeenCalledExactlyOnceWith(m.scene, m.camera)
    expect(before.setRenderTarget).not.toHaveBeenCalled()
    const cleanup = m.setup()
    if (typeof cleanup !== 'function') throw new Error('Missing effect cleanup')
    cleanup()
    m.frame({ ...m, gl: after })
    expect(after.render).toHaveBeenCalledExactlyOnceWith(m.scene, m.camera)
    expect(after.setRenderTarget).not.toHaveBeenCalled()
  })
})
