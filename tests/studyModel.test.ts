import { describe, expect, it } from 'vitest'
import { studyAnimation, studyObjectRole, studyTime } from '../src/ui/studyModel'

describe('illustrative study replay', () => {
  it('bounds untrusted playback values and keeps the source above its approved resting position', () => {
    for (const time of [-100, 0, 1, 3.999, 4, 14, 20, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const phase = studyAnimation(time)
      expect(studyTime(time)).toBeGreaterThanOrEqual(0)
      expect(studyTime(time)).toBeLessThanOrEqual(20)
      expect(phase.sourceOffsetY).toBeGreaterThanOrEqual(0)
      expect(phase.sourceOffsetY).toBeLessThanOrEqual(3.5)
      expect(phase.warmth).toBeGreaterThan(0)
    }
    expect(studyAnimation(4).sourceOffsetY).toBe(0)
    expect(studyAnimation(20).sourceOffsetY).toBe(0)
  })

  it('replays and scrubs deterministically without extinguishing the hotspot', () => {
    const first = studyAnimation(12.4)
    studyAnimation(20)
    studyAnimation(0)
    expect(studyAnimation(12.4)).toEqual(first)
    expect(studyAnimation(0)).toEqual({ sourceOffsetY: 3.5, cold: 0, transport: 0, warmth: 1 })
    expect(studyAnimation(4).transport).toBe(0)
    expect(studyAnimation(8).cold).toBe(1)
    expect(studyAnimation(14).transport).toBe(1)
    expect(studyAnimation(20).warmth).toBeCloseTo(0.62)
  })

  it('recognizes both Blender names and loader-sanitized names without recoloring the tree', () => {
    expect(studyObjectRole('DRY ICE • Ø 0.500 m | vertical ballistic drop')).toBe('source')
    expect(studyObjectRole('DRY_ICE_•_Ø_0500_m_|_vertical_ballistic_drop')).toBe('source')
    expect(studyObjectRole('Peat_lens_•_exposed_planar_geological_section')).toBe('peat')
    expect(studyObjectRole('01 Organic stratum')).toBe('soil')
    expect(studyObjectRole('04_parent_material')).toBe('soil')
    expect(studyObjectRole('Living_crown_•_varied_curved_leaves')).toBe('natural')
    expect(studyObjectRole('Small_tree_•_trunk')).toBe('natural')
  })
})
