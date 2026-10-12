import { describe, expect, it } from 'vitest'
import { DELIVERY_ROUTE, FILL_ROUTE, MEDIA_MOUNT, MEDIA_SCALE, SUPPLY_OUTLET_LOCAL, TREATMENT_PARKED, TRUCK_PARKED, loadingBoomPose, loadingBucketPose, preparationVisuals } from '../../../src/alternatives/sublimation-injection/visuals'

describe('new integrated water truck artwork', () => {
  it('parks its complete vehicle and lower rear module on the existing grass', () => {
    expect(TRUCK_PARKED[0] + 2.36).toBeLessThan(4)
    expect(TRUCK_PARKED[0] - 2.65).toBeGreaterThan(-4)
    expect(TRUCK_PARKED[2] + .92).toBeLessThan(0)
    expect(TRUCK_PARKED[2] - .92).toBeGreaterThan(-4)
    expect(TREATMENT_PARKED[0] - TRUCK_PARKED[0]).toBe(-1.75)
    expect(TREATMENT_PARKED[2]).toBe(TRUCK_PARKED[2])
    expect(MEDIA_MOUNT[1] + 1.95 * MEDIA_SCALE).toBeLessThan(2.7)
  })

  it('connects the supply port to the preparation vessel and outgoing line to the bore', () => {
    expect(FILL_ROUTE[0]).toEqual(TRUCK_PARKED.map((v, i) => v + SUPPLY_OUTLET_LOCAL[i]))
    expect(FILL_ROUTE.at(-1)).toEqual(TREATMENT_PARKED.map((v, i) => v + MEDIA_MOUNT[i] + MEDIA_SCALE * [.52, .22, .48][i]))
    expect(DELIVERY_ROUTE.at(-1)).toEqual([.4, -1.3, .08])
    expect(preparationVisuals(48).hose).toBe(0)
    expect(preparationVisuals(56).hose).toBe(1)
  })

  it('keeps both articulated arms rigid and attached through lift, tip and return', () => {
    for (let time = 0; time <= 90; time += .125) {
      const { shoulder, elbow, wrist } = loadingBoomPose(time), bucket = loadingBucketPose(time)
      const length = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]))
      expect(length(shoulder, elbow)).toBeCloseTo(1.55, 12)
      expect(length(elbow, wrist)).toBeCloseTo(1.1, 12)
      expect(wrist[0]).toBe(bucket.position[0]); expect(wrist[1] - bucket.position[1]).toBeCloseTo(.38, 12)
      expect([...shoulder, ...elbow, ...wrist].every(Number.isFinite)).toBe(true)
    }
  })
})
