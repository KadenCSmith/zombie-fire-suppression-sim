import { describe, expect, it } from 'vitest'
import { CatmullRomCurve3, Vector3 } from 'three'
import { DELIVERY_ROUTE, FILL_ROUTE, HOSE_REEL_LOCAL, MEDIA_MOUNT, MEDIA_SCALE, PUMP_BAY_LOCAL, PUMP_INLET_LOCAL, PUMP_OUTLET_LOCAL, SUPPLY_OUTLET_LOCAL, TANK_PUMP_ROUTE_LOCAL, TREATMENT_PARKED, TRUCK_PARKED, TRUCK_WHEEL_RADIUS, loadingBoomPose, loadingBucketPose, preparationVisuals, wheelRollAngle } from '../../../src/alternatives/sublimation-injection/visuals'

describe('new integrated water truck artwork', () => {
  it('keeps the tire contact point stationary during forward and reverse seeking', () => {
    const samples = [38, 39, 41, 44, 47, 48, 44, 39, 38]
    for (let i = 1; i < samples.length; i++) {
      const before = preparationVisuals(samples[i - 1]).truckTravel
      const after = preparationVisuals(samples[i]).truckTravel
      const translation = after - before
      const rotation = wheelRollAngle(after) - wheelRollAngle(before)
      // At the bottom of a +Z rotating wheel, tangential motion is +X.
      expect(translation + TRUCK_WHEEL_RADIUS * rotation).toBeCloseTo(0, 12)
    }
    expect(wheelRollAngle(preparationVisuals(48).truckTravel)).toBeCloseTo(0, 12)
  })

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
    expect(TANK_PUMP_ROUTE_LOCAL[0]).toEqual(SUPPLY_OUTLET_LOCAL)
    expect(TANK_PUMP_ROUTE_LOCAL.at(-1)).toEqual(PUMP_INLET_LOCAL)
    expect(FILL_ROUTE[0]).toEqual(TRUCK_PARKED.map((v, i) => v + PUMP_OUTLET_LOCAL[i]))
    expect(FILL_ROUTE.at(-1)).toEqual(TREATMENT_PARKED.map((v, i) => v + MEDIA_MOUNT[i] + MEDIA_SCALE * [.52, .22, .48][i]))
    expect(DELIVERY_ROUTE.at(-1)).toEqual([.4, -1.3, .08])
    expect(preparationVisuals(48).hose).toBe(0)
    expect(preparationVisuals(56).hose).toBe(1)
  })

  it('separates pump hardware from the reel and routes hoses around their solids', () => {
    // Complete pump X bounds include head sphere, motor, fins and base.
    expect(PUMP_BAY_LOCAL[0] + .22 + .05).toBeLessThan(HOSE_REEL_LOCAL[0] - .235)
    expect(PUMP_BAY_LOCAL[0] - .255).toBeGreaterThan(-2.55)
    expect(PUMP_BAY_LOCAL[0] + .22).toBeLessThan(-.85)
    const routes = [TANK_PUMP_ROUTE_LOCAL, FILL_ROUTE.map(p => p.map((v, i) => v - TRUCK_PARKED[i]) as [number, number, number])]
    for (const route of routes) {
      const curve = new CatmullRomCurve3(route.map(p => new Vector3(...p)), false, 'centripetal')
      for (const p of curve.getPoints(1000)) {
        // Conservative expanded motor cylinder and both flange cylinders.
        const motorAxial = Math.abs(p.x - (PUMP_BAY_LOCAL[0] + .08))
        const motorRadial = Math.hypot(p.y - (PUMP_BAY_LOCAL[1] + .13), p.z - PUMP_BAY_LOCAL[2])
        expect(motorAxial > .135 + .036 || motorRadial > .11 + .036).toBe(true)
        for (const flangeZ of [-.12, .12]) {
          const radial = Math.hypot(p.x - HOSE_REEL_LOCAL[0], p.y - HOSE_REEL_LOCAL[1])
          const axial = Math.abs(p.z - (HOSE_REEL_LOCAL[2] + flangeZ))
          expect(radial > .235 + .036 || axial > .0175 + .036).toBe(true)
        }
      }
    }
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
