import { describe, expect, it } from 'vitest'
import { SOLID_COUNT, WORLD_STAGING, bucketPoint, loadingBucketPose, solidLoadingPose } from '../../../src/alternatives/sublimation-injection/visuals'
import { WaterContact } from '../../../src/alternatives/sublimation-injection/loading'

describe('open bucket loading illustration', () => {
  it('finishes loading and retracts before closing the lid, then increases the illustrated flow', () => {
    expect(WORLD_STAGING.lidStart).toBeGreaterThan(WORLD_STAGING.iceEnd)
    expect(loadingBucketPose(WORLD_STAGING.lidStart).position[0]).toBe(1.1)
    expect(WORLD_STAGING.lidClosed).toBeLessThan(WORLD_STAGING.boostStart)
    for (let i = 0; i < SOLID_COUNT; i++) expect(solidLoadingPose(90, i).impactS).toBeLessThan(WORLD_STAGING.lidStart)
  })
  it('clears the tank rim before traversing and returns beside it before lowering', () => {
    for (let time = 55; time <= 71; time += .025) {
      for (const x of [-.275, .275]) for (const y of [-.25, .24]) for (const z of [-.25, .25]) {
        const point = bucketPoint(time, [x, y, z])
        if (point[1] <= .68 && point[1] >= -.58) expect(Math.hypot(point[0], point[2])).toBeGreaterThan(.72)
      }
    }
    expect(loadingBucketPose(0)).toEqual(loadingBucketPose(90))
  })

  it('carries solids inside the bucket until the downward-facing opening releases them', () => {
    for (let i = 0; i < SOLID_COUNT; i++) {
      const solid = solidLoadingPose(90, i)
      expect(loadingBucketPose(solid.releaseS).tilt).toBeGreaterThan(Math.PI / 2)
      for (let time = WORLD_STAGING.liftStart; time < solid.releaseS; time += .025) {
        const bucket = loadingBucketPose(time), p = solidLoadingPose(time, i).position
        const dx = p[0] - bucket.position[0], dy = p[1] - bucket.position[1]
        const x = dx * Math.cos(bucket.tilt) + dy * Math.sin(bucket.tilt)
        const y = -dx * Math.sin(bucket.tilt) + dy * Math.cos(bucket.tilt)
        expect(Math.abs(x)).toBeLessThan(.26); expect(Math.abs(p[2])).toBeLessThan(.235)
        expect(y).toBeGreaterThan(-.21); expect(y).toBeLessThanOrEqual(.240001)
      }
    }
  })

  it('falls continuously through the opening, accelerates in air and settles within the water', () => {
    for (let i = 0; i < SOLID_COUNT; i++) {
      const solid = solidLoadingPose(90, i), position = (time: number) => solidLoadingPose(time, i).position
      for (const boundary of [solid.releaseS, solid.impactS]) {
        expect(Math.hypot(...position(boundary - .000001).map((v, j) => v - position(boundary + .000001)[j]))).toBeLessThan(.0001)
      }
      const drop = (t: number) => position(t)[1] - position(t + .001)[1]
      expect(drop(solid.releaseS + .4)).toBeGreaterThan(drop(solid.releaseS + .1))
      for (let time = solid.releaseS; time <= solid.impactS; time += .005) {
        const p = position(time)
        if (p[1] < .8) expect(Math.hypot(p[0], p[2]) + .14).toBeLessThan(.685)
      }
      expect(solid.impactS).toBeLessThan(WORLD_STAGING.iceEnd)
      expect(solid.position[1]).toBeGreaterThan(-.45); expect(solid.position[1]).toBeLessThan(-.35)
      expect(Math.hypot(solid.position[0], solid.position[2]) + .14).toBeLessThan(.685)
    }
  })

  it('does not show ripples or bubbles before contact and supports arbitrary seeking', () => {
    const firstImpact = solidLoadingPose(90, 0).impactS
    const contact = WaterContact({ time: firstImpact - .01 }).props.children.flat()
    expect(contact.filter(Boolean).every((child: { props: { visible?: boolean } }) => child.props.visible === false)).toBe(true)
    const target = solidLoadingPose(63.4, 4)
    for (const time of [90, 0, NaN, Infinity, 63.4]) {
      const pose = solidLoadingPose(time, 4)
      expect([...pose.position, ...pose.rotation, pose.scale].every(Number.isFinite)).toBe(true)
    }
    expect(solidLoadingPose(63.4, 4)).toEqual(target)
  })
})
