import { describe, expect, it, vi } from 'vitest'
import { AlternativeScene } from '../src/ui/AlternativeScene'
import { FireSequenceScene } from '../src/ui/FireSequenceScene'

vi.mock('../src/ui/FireSequenceScene', async () => {
  const { createElement } = await import('react')
  return { FireSequenceScene: vi.fn(() => createElement('canvas', { 'data-protected-prop': 'retained' }, createElement('group', { name: 'original-world' }))) }
})
vi.mock('../src/ui/AlternativeMethodModules', () => ({ AlternativeMethodCues: () => null }))

function compose(id: Parameters<typeof AlternativeScene>[0]['id'], time: number) {
  const view = AlternativeScene({ id, time, resetToken: 2, cameraDistance: 9 })
  const factory = vi.mocked(FireSequenceScene)
  return { view, props: factory.mock.calls.at(-1)![0], original: factory.mock.results.at(-1)!.value }
}

describe('read-only alternative host layer boundaries', () => {
  it('reuses original dry-ice release for pressure-only while excluding every water cue', () => {
    for (const time of [0, 38, 44, 51.5, 55, 57, 90]) {
      const { view, props } = compose('pressure-only', time)
      expect(props.time).toBe(Math.min(time, 57))
      expect(props.layers).toEqual({ fire: true, gas: true, water: false, anatomy: true })
      expect(view.props['data-original-replay']).toBe('authored-gas-release-no-water')
      expect(props.mode).toBe('rapid')
    }
  })
  it('retains the existing liquid and surface-method treatment boundaries', () => {
    const liquid = compose('liquid-waves', 90).props
    expect(liquid.time).toBe(90)
    expect(liquid.layers).toEqual({ fire: false, gas: true, water: true, anatomy: true })
    const surface = compose('sublimation-injection', 75).props
    expect(surface.time).toBe(38)
    expect(surface.layers).toEqual({ fire: true, gas: false, water: false, anatomy: true })
  })
  it('retains the original Canvas props/world and supplied camera controls', () => {
    const { view, props, original } = compose('pressure-only', 55)
    const canvas = view.props.children
    expect(canvas.type).toBe(original.type)
    expect(canvas.props['data-protected-prop']).toBe('retained')
    expect(canvas.props.children[0]).toBe(original.props.children)
    expect(props.cameraDistance).toBe(9)
    expect(props.resetToken).toBe(2)
    expect(props.connectedSupply).toBe(true)
  })
})
