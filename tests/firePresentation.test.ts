import { describe, expect, it } from 'vitest'
import { CatmullRomCurve3, Vector3 } from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G, acceptedFireFrame, fireSequencePose } from '../src/story/fireSequence'
import { PRESENTATION_TIMING as T, PRESENTATION_PLAYBACK_DURATION, presentationRate, currentStoryToPlayback, currentPlaybackToStory, advancePresentationTime, currentPeatCoverage, currentEquipmentState, connectedHosePoints } from '../src/story/firePresentation'

describe('current presentation clock and independent accepted history', () => {
  it('slows continuously across excavator arrival and keeps readable drilling', () => {
    expect(presentationRate(10)).toBe(3.2)
    expect(presentationRate(21)).toBeCloseTo(2.2)
    expect(presentationRate(24)).toBeCloseTo(1.2)
    expect(presentationRate(31)).toBeCloseTo(1.2)
    for (const boundary of [18, 24, 36.5, 40, 53, 55, 56.5, 58.5]) {
      expect(Math.abs(presentationRate(boundary + .001) - presentationRate(boundary - .001))).toBeLessThan(.00001)
    }
    expect(PRESENTATION_PLAYBACK_DURATION).toBeGreaterThan(40)
    expect(PRESENTATION_PLAYBACK_DURATION).toBeLessThan(65)
    for (let time = 0; time <= 90; time += .137) expect(currentPlaybackToStory(currentStoryToPlayback(time))).toBeCloseTo(time, 9)
  })
  it.each([.5, 1, 1.5, 2, 3])('replays identically at 24, 30 and 60 fps with %s× speed', speed => {
    const results = [24, 30, 60].map(fps => {
      let time = 0
      for (let i = 0; i < fps * 8; i++) time = advancePresentationTime(time, 1 / fps, speed)
      return time
    })
    for (const time of results) expect(time).toBeCloseTo(currentPlaybackToStory(8 * speed), 8)
    expect(advancePresentationTime(results[0], 0, speed)).toBeCloseTo(results[0], 9)
  })
  it('preserves overshoot in loops and clears equipment when restarted or scrubbed backward', () => {
    expect(advancePresentationTime(90, 1, 1, true)).toBeCloseTo(currentPlaybackToStory(1))
    const end = currentEquipmentState(90), start = currentEquipmentState(0)
    expect(end.waterOn).toBe(true)
    expect(start.truckVisible || start.excavatorVisible || start.waterOn || start.hoseConnected).toBe(false)
    expect(connectedHosePoints(0)).toEqual([])
    expect(currentEquipmentState(66)).toEqual(currentEquipmentState(66))
  })
  it('uses successive stored growth states during drilling without changing solver timestamps', () => {
    const frames = [0, 10, 20, 30, 40].map(timeS => ({ timeS, phase: 'unforced-reaction' }))
    expect(acceptedFireFrame(frames, 24, 10, T.spreadEnd)).toBe(frames[2])
    expect(acceptedFireFrame(frames, 34, 10, T.spreadEnd)).toBe(frames[3])
    expect(acceptedFireFrame(frames, 40, 10, T.spreadEnd)).toBe(frames[4])
    expect(acceptedFireFrame(frames, 24, 10)).toBe(frames[4]) // Archived mapping remains unchanged.
  })
})

describe('ordered excavator, truck, hose and water operations', () => {
  it('parks before penetration and drills while the same peat front continues advancing', () => {
    expect(currentEquipmentState(18).excavatorVisible).toBe(true)
    expect(currentEquipmentState(24).excavatorTravel).toBeCloseTo(0)
    expect(fireSequencePose(24, 'rapid').drillDepth).toBe(0)
    expect(currentEquipmentState(29).drilling).toBe(true)
    expect(currentEquipmentState(33).drilling).toBe(true)
    expect(currentPeatCoverage(29)).toBeGreaterThan(currentPeatCoverage(24))
    expect(currentPeatCoverage(34)).toBeGreaterThan(currentPeatCoverage(29))
    expect(currentPeatCoverage(34)).toBeLessThan(.7)
    expect(currentPeatCoverage(40)).toBe(.7)
  })
  it('fills the existing pre-hose interval with truck arrival, parking and deployment', () => {
    expect(currentEquipmentState(56.9).truckVisible).toBe(false)
    expect(currentEquipmentState(61).truckVisible).toBe(true)
    expect(currentEquipmentState(61).truckParked).toBe(false)
    expect(currentEquipmentState(65).truckParked).toBe(true)
    expect(currentEquipmentState(67).hoseProgress).toBeCloseTo(.5)
    expect(connectedHosePoints(67).at(-1)![1]).toBeGreaterThan(0)
    expect(connectedHosePoints(67).length).toBeLessThan(connectedHosePoints(72).length)
    expect(currentEquipmentState(70).hoseInsertion).toBeGreaterThan(0)
    expect(currentEquipmentState(70).waterOn).toBe(false)
    expect(currentEquipmentState(72).hoseConnected).toBe(true)
    expect(currentEquipmentState(72).waterOn).toBe(true)
    expect(T.hoseAtBore).toBeGreaterThan(T.drillClear)
  })
  it('keeps the inlet attached and the growing tip continuous across both deployment phases', () => {
    for (let time = 65.001; time <= 72; time += .025) {
      const points = connectedHosePoints(time), next = connectedHosePoints(time + .001)
      expect(points[0]).toEqual(currentEquipmentState(time).truckOutlet)
      expect(Math.hypot(...points.at(-1)!.map((v, i) => v - next.at(-1)![i]))).toBeLessThan(.002)
      expect(points.every(p => p.every(Number.isFinite))).toBe(true)
      if (points.some(p => p[1] < 0)) expect(currentEquipmentState(time).drillClear).toBe(true)
    }
  })
  it('keeps the rendered surface route above solid soil and the inserted tube within the bore/service gap', () => {
    for (let time = 65.05; time <= 72.001; time += .05) {
      const points = connectedHosePoints(time)
      const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'centripetal')
      for (const p of curve.getSpacedPoints(300)) {
        const radial = Math.hypot(p.x - G.sourceX, p.z)
        if (p.y < G.hoseRadiusM) expect(radial + G.hoseRadiusM).toBeLessThan(G.boreRadiusM)
        else expect(p.y - G.hoseRadiusM).toBeGreaterThan(0)
        if (p.y < -.98 && p.y > -1.05) {
          expect(Math.abs(Math.atan2(p.x - G.sourceX, p.z) - G.capGapCenterRad) + Math.asin(G.hoseRadiusM / radial)).toBeLessThan(G.capGapHalfAngleRad)
        }
      }
    }
  })
})
