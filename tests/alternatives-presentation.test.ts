import { describe, expect, it } from 'vitest'
import { methodPresentation } from '../src/alternatives/presentation'

describe('method render scope', () => {
  it('gives pressure-only and undefined methods no liquid cues', () => {
    for (const time of [0, 28, 50, 70, 90]) {
      for (const id of ['pressure-only', 'nanoparticles', 'baseline'] as const) {
        const p = methodPresentation(id, time)
        expect(p.injection).toBe(false); expect(p.contacts).toBe(0)
      }
    }
    expect(methodPresentation('nanoparticles', 90).access).toBe(false)
  })
  it('distinguishes multi-depth, wave-first and simultaneous injection timing', () => {
    expect(methodPresentation('pressure-pulse', 50).pulse).toBe(true)
    expect(methodPresentation('pressure-pulse', 70).contacts).toBe(3)
    expect(methodPresentation('liquid-waves', 50).waves).toBe(true)
    expect(methodPresentation('liquid-waves', 50).injection).toBe(false)
    expect(methodPresentation('liquid-waves', 70).contacts).toBe(1)
    expect(methodPresentation('vibratory-injection', 28).injection).toBe(true)
    expect(methodPresentation('vibratory-injection', 28).vibration).not.toBe(0)
  })
  it('holds the shared environment before legacy source, cap and quenching stages', () => {
    for (const id of ['pressure-pulse','liquid-waves','pressure-only','vibratory-injection'] as const) {
      expect(methodPresentation(id, 90).contextTime).toBe(36)
    }
  })
})
