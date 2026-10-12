import { describe, expect, it } from 'vitest'
import { createRun, freshPanel } from '../src/alternatives/model'
import { currentRecord } from '../src/alternatives/records'

describe('accepted record ownership at export', () => {
  it('rejects a nonfinite concept window before creating an unbounded lifecycle', () => {
    const config = freshPanel('one', 'pressure-only')
    config.thermal.endS = NaN
    expect(() => createRun(config)).toThrow()
  })
  it('excludes previous results during a settings change', () => {
    const config = freshPanel('one', 'liquid-waves')
    const old = { configurationKey: JSON.stringify(config) + ':0', history: [{ timeS: 2 }] }
    const changed = { ...config, thermal: { ...config.thermal, waterKg: config.thermal.waterKg + 1 } }
    expect(currentRecord(changed, old)).toBeNull()
  })
  it('retains accepted history and failure diagnostics for the current configuration', () => {
    const config = freshPanel('one', 'liquid-waves')
    const accepted = { configurationKey: JSON.stringify(config) + ':4', history: [{ timeS: 2 }], error: 'Worker failed' }
    expect(currentRecord(config, accepted)).toBe(accepted)
  })
  it('exports no stale record while reset has cleared the current result', () => {
    expect(currentRecord(freshPanel('one', 'liquid-waves'), undefined)).toBeNull()
  })
})
