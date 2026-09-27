import { describe, expect, it } from 'vitest'
import { FIRE_SEQUENCE_GEOMETRY as G, acceptedFireFrame, fireSequencePose, illustratedPeatCoverage, illustratedPeatFront, storyToPlayback, playbackToStory } from '../src/story/fireSequence'

describe('story and accepted-state separation', () => {
  const frames = [
    { timeS: 0, phase: 'forced-ignition', dryIceKg: 0 },
    { timeS: 86400, phase: 'unforced-reaction', dryIceKg: 0 },
    { timeS: 86400, phase: 'treatment', dryIceKg: 4 },
    { timeS: 86402, phase: 'treatment', dryIceKg: 3.99 },
    { timeS: 86430, phase: 'treatment', dryIceKg: 3.85 },
  ]
  it('keeps the pre-insertion state before the story intervention', () => {
    expect(acceptedFireFrame(frames, 54.9)).toBe(frames[1])
    expect(acceptedFireFrame(frames, 55)).toBe(frames[2])
  })
  it('selects accepted frames without scalar or mass interpolation', () => {
    expect(acceptedFireFrame(frames, 56)).toBe(frames[2])
    expect(acceptedFireFrame(frames, 57)).toBe(frames[3])
    expect(acceptedFireFrame(frames, 85)).toBe(frames[4])
    expect(acceptedFireFrame(frames, 90)).toBe(frames[4])
  })
  it('retains the final growth result when treatment was not accepted', () => {
    expect(acceptedFireFrame(frames.slice(0, 2), 80)).toBe(frames[1])
    expect(acceptedFireFrame([], 80)).toBeUndefined()
  })
  it('matches the film ignition and later growth clocks', () => {
    const history = [
      { timeS:0,phase:'forced-ignition' },
      { timeS:3600,phase:'forced-ignition' },
      { timeS:7200,phase:'unforced-reaction' },
      { timeS:86400,phase:'unforced-reaction' },
      { timeS:86400,phase:'treatment' },
    ]
    expect(acceptedFireFrame(history,5,7200)).toBe(history[1])
    expect(acceptedFireFrame(history,10,7200)).toBe(history[2])
    expect(acceptedFireFrame(history,24,7200)).toBe(history[3])
    expect(acceptedFireFrame(history,54.9,7200)).toBe(history[3])
    expect(acceptedFireFrame(history,55,7200)).toBe(history[4])
  })
  it('clamps the ignition cutoff to the last accepted early-stop state', () => {
    const partial = [
      { timeS:0,phase:'forced-ignition' },
      { timeS:1800,phase:'forced-ignition' },
      { timeS:3600,phase:'forced-ignition' },
    ]
    expect(acceptedFireFrame(partial,5,7200)).toBe(partial[1])
    for(const time of [10,24,55,90]) expect(acceptedFireFrame(partial,time,7200)).toBe(partial[2])
  })
  it('does not excavate before contact and clears the drill before source entry', () => {
    expect(fireSequencePose(25, 'gradual').drillDepth).toBe(0)
    expect(fireSequencePose(31, 'gradual').drillDepth).toBeCloseTo(1.385)
    const drop = fireSequencePose(39, 'gradual')
    expect(drop.drillVisible).toBe(false)
    expect(drop.sourceVisible).toBe(true)
    expect(drop.drillDepth).toBeCloseTo(1.385)
  })
})

describe('variable playback clock and illustrated treatment trigger', () => {
  it('plays the release interval 1:1 and completes the 90-second story in 36 seconds', () => {
    expect(storyToPlayback(90)).toBeCloseTo(36, 12)
    expect(storyToPlayback(61)-storyToPlayback(55)).toBeCloseTo(6, 12)
    expect(playbackToStory(1)).toBeCloseTo(2.8, 12)
    for(const t of [0,8,12,24,37,47,55,58,61,69,85,90]) expect(playbackToStory(storyToPlayback(t))).toBeCloseTo(t, 10)
  })
  it('locks drilling until 70% illustrated coverage and keeps substantial fire after treatment', () => {
    for(const time of [0,8,12,18,23.999]) {
      expect(illustratedPeatCoverage(time)).toBeLessThan(.7)
      expect(fireSequencePose(time,'rapid').drillVisible).toBe(false)
      expect(fireSequencePose(time,'rapid').sourceVisible).toBe(false)
      expect(fireSequencePose(time,'rapid').capVisible).toBe(false)
    }
    expect(illustratedPeatCoverage(24)).toBe(.7)
    expect(fireSequencePose(24,'rapid').drillVisible).toBe(true)
    expect(illustratedPeatCoverage(90)).toBe(.7)
    const q=illustratedPeatFront(.7)
    expect((Math.acos(q)-q*Math.sqrt(1-q*q))/Math.PI).toBeCloseTo(.7, 8)
  })
  it('seats the inverted plate below ground and inverts it only in the illustrative rapid mode', () => {
    const initial=fireSequencePose(54,'rapid'),inverted=fireSequencePose(61,'rapid')
    expect(initial.capY).toBeCloseTo(-1.05)
    expect(initial.capY-G.capRiseM+initial.bend).toBeCloseTo(-1.105)
    expect(inverted.capY-G.capRiseM+inverted.bend).toBeCloseTo(-.885)
    expect(fireSequencePose(90,'gradual').bend).toBe(0)
  })
})
