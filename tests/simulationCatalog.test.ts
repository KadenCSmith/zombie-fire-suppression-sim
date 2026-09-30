import { describe, expect, it } from 'vitest'
import { alignedTime, availableVersions, compareSemver, parseSemver, SIMULATION_CATALOG } from '../src/ui/simulationCatalog'
import { readLayout, workspaceMode } from '../src/ui/AppChrome'

describe('version comparison catalog', () => {
  it('compares semantic versions numerically and rejects invalid identifiers', () => {
    expect(parseSemver('v0.8')).toEqual([0, 8, 0])
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(() => parseSemver('0.8-beta')).toThrow(/Invalid semantic version/)
  })

  it('lists every version from 0.8 onward without inventing missing replay assets', () => {
    expect(SIMULATION_CATALOG.map(version => version.id)).toEqual(['0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0', '0.13.0', '0.14.0', '0.15.0', '0.16.0', '0.17.1'])
    expect(availableVersions().map(version => version.id)).toEqual(['0.8.0', '0.9.0', '0.12.0', '0.14.0', '0.15.0', '0.16.0', '0.17.1'])
    expect(SIMULATION_CATALOG.find(version => version.id === '0.12.0')).toMatchObject({ replay: 'film', durationS: 2.5, assetFile: 'accepted-checkpoint-review.mp4' })
    expect(SIMULATION_CATALOG.filter(version => !version.available).every(version => version.replay === 'unavailable')).toBe(true)
  })

  it('uses recorded event markers within a scene family', () => {
    const v08 = SIMULATION_CATALOG[0], v09 = SIMULATION_CATALOG[1]
    expect(alignedTime(v08, v09, 10.5)).toEqual({ timeS: 10.5, method: 'recorded-events' })
  })

  it('labels duration normalization when timeline families differ', () => {
    const v08 = SIMULATION_CATALOG[0], v15 = SIMULATION_CATALOG[7]
    expect(alignedTime(v08, v15, 10)).toEqual({ timeS: 45, method: 'duration-normalized' })
  })
})

describe('persistent interface chrome', () => {
  it('makes animation and physics workspaces explicit', () => {
    expect(workspaceMode('comparison')).toBe('animation')
    expect(workspaceMode('sequence')).toBe('animation')
    expect(workspaceMode('simulation')).toBe('physics')
    expect(workspaceMode('mechanics')).toBe('physics')
  })

  it('accepts only the three supported layouts', () => {
    expect(readLayout('instrument')).toBe('instrument')
    expect(readLayout('technical')).toBe('technical')
    expect(readLayout('unknown')).toBe('refined')
  })
})
