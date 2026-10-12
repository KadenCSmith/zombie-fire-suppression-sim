import type { EffectCallback } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

const hooks = vi.hoisted(() => ({ setup: null as EffectCallback | null, ref: { current: null as THREE.SpriteMaterial | null } }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useLayoutEffect: (setup: EffectCallback) => { hooks.setup = setup },
  useRef: () => hooks.ref,
}))
import { Annotation } from '../../../src/alternatives/sublimation-injection/annotation'

const context = {
  font: '', textAlign: '', textBaseline: '', fillStyle: '',
  measureText: () => ({ width: 250 }), beginPath: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillText: vi.fn(),
}
const append = vi.fn(), remove = vi.fn()
function setup(text = 'Illustrative quenching') {
  Annotation({ position: [0, 0, 0], children: text })
  const cleanup = hooks.setup!()
  if (typeof cleanup !== 'function') throw new Error('Missing annotation cleanup')
  return cleanup
}

beforeEach(() => {
  hooks.ref.current = new THREE.SpriteMaterial({ opacity: 0 })
  vi.clearAllMocks()
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({ width: 0, height: 0, getContext: () => context })),
    body: { appendChild: append, removeChild: remove },
  })
})
afterEach(() => { hooks.ref.current?.dispose(); hooks.ref.current = null; vi.unstubAllGlobals() })

describe('owned scene annotation lifecycle', () => {
  it('creates a new bound texture after StrictMode setup → cleanup → setup without DOM parenting', () => {
    const material = hooks.ref.current!, cleanupFirst = setup(), first = material.map!
    const firstDisposed = vi.fn(); first.addEventListener('dispose', firstDisposed)
    expect(first.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(material.opacity).toBe(1)
    cleanupFirst()
    expect(firstDisposed).toHaveBeenCalledOnce(); expect(material.map).toBeNull()
    const cleanupSecond = hooks.setup!()
    const second = material.map!, secondDisposed = vi.fn()
    second.addEventListener('dispose', secondDisposed)
    expect(second).not.toBe(first); expect(material.opacity).toBe(1)
    if (typeof cleanupSecond !== 'function') throw new Error('Missing replay cleanup')
    cleanupSecond()
    expect(secondDisposed).toHaveBeenCalledOnce(); expect(firstDisposed).toHaveBeenCalledOnce()
    expect(material.map).toBeNull(); expect(material.opacity).toBe(0)
    expect(append).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled()
  })

  it('does not clear a newer binding when an earlier setup cleans up', () => {
    const material = hooks.ref.current!, cleanupOld = setup('Dry ice added to water'), old = material.map!
    const cleanupNew = setup('Faster flow · illustrative'), current = material.map!
    cleanupOld()
    expect(material.map).toBe(current); expect(current).not.toBe(old)
    expect(context.fillText).toHaveBeenLastCalledWith('Faster flow · illustrative', 256, 49, 460)
    cleanupNew(); expect(material.map).toBeNull()
  })

  it('stays hidden when no drawing context is available', () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const cleanup = setup()
    expect(hooks.ref.current!.map).toBeNull(); expect(hooks.ref.current!.opacity).toBe(0)
    cleanup()
  })
})
