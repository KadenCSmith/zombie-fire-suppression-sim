import { describe, expect, it } from 'vitest'
import { STUDY_FRAGMENTS, STUDY_LANDING_TIME, STUDY_RELEASE_TIME, studyAnimation, studyFragmentPose, studyObjectRole, studyTime } from '../src/ui/studyModel'

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
    expect(studyAnimation(0)).toMatchObject({ sourceOffsetY: 3.5, cold: 0, transport: 0, warmth: 1, sourceVisible: true, expansionRadius: 0 })
    expect(studyAnimation(4).transport).toBe(0)
    expect(studyAnimation(8).cold).toBe(1)
    expect(studyAnimation(14).transport).toBe(1)
    expect(studyAnimation(20).warmth).toBeCloseTo(0.62)
  })

  it('converts instantly exactly five playback seconds after landing, including reverse seeks', () => {
    expect(STUDY_RELEASE_TIME - STUDY_LANDING_TIME).toBe(5)
    expect(studyAnimation(STUDY_LANDING_TIME).sourceOffsetY).toBe(0)
    expect(studyAnimation(STUDY_RELEASE_TIME - 0.001).sourceVisible).toBe(true)
    expect(studyAnimation(STUDY_RELEASE_TIME).sourceVisible).toBe(false)
    expect(studyAnimation(STUDY_RELEASE_TIME).expansionRadius).toBe(0.25)
    expect(studyAnimation(STUDY_RELEASE_TIME + 0.5).expansionRadius).toBeGreaterThan(1.5)
    studyAnimation(20)
    expect(studyAnimation(8).sourceVisible).toBe(true)
    expect(studyAnimation(8).expansionRadius).toBe(0)
  })

  it('holds fragments until release and deterministically settles them after the burst', () => {
    for (let i = 0; i < STUDY_FRAGMENTS.length; i++) {
      const initial = studyFragmentPose(i, 0)
      expect(studyFragmentPose(i, 8.999)).toEqual(initial)
      const moved = studyFragmentPose(i, 9.5)
      expect(moved.position).not.toEqual(initial.position)
      expect([...moved.position, ...moved.rotation].every(Number.isFinite)).toBe(true)
      studyFragmentPose(i, 20)
      expect(studyFragmentPose(i, 9.5)).toEqual(moved)
      expect(studyFragmentPose(i, 0)).toEqual(initial)
      const settled = studyFragmentPose(i, 14), end = studyFragmentPose(i, 20)
      settled.position.forEach((value, axis) => expect(value).toBeCloseTo(end.position[axis], 6))
    }
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
