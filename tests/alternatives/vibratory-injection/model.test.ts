import { describe, expect, it, vi } from 'vitest'
import { createRun, duplicatePanel, freshPanel } from '../../../src/alternatives/model'
import { compatible } from '../../../src/alternatives/registry'
import { methodModule, capabilities } from '../../../src/alternatives/vibratory-injection'
import { PREDICTION_UNAVAILABLE } from '../../../src/alternatives/vibratory-injection/model'

describe('4.2.4 vibration-only prediction boundary', () => {
  it('has no predictive engine or treatment inventory by default', () => {
    const panel = freshPanel('vibration', 'vibratory-injection')
    expect(methodModule.variants[0].engines).toEqual([])
    expect(panel.engine).toBe('concept')
    expect(panel.medium).toBe('none')
    expect(panel.thermal).toMatchObject({enabled:false,waterKg:0,flowKgS:0,dryIceKg:0,conductanceWK:0})
    expect(capabilities.modeled).toEqual([])
    expect(capabilities.experimentallyValidated).toBe(false)
    expect(compatible(panel.variantId,panel.engine,panel.medium)).toBe(PREDICTION_UNAVAILABLE)
    expect(() => createRun(panel)).toThrow(PREDICTION_UNAVAILABLE)
  })
  it('rejects saved liquid configurations without calling the contact core or mutating inputs', () => {
    const panel = freshPanel('saved-v2', 'vibratory-injection')
    panel.engine='contact';panel.medium='water';panel.thermal.enabled=true;panel.thermal.waterKg=.5;panel.thermal.flowKgS=.025
    const before=structuredClone(panel), supportedRun=vi.fn()
    expect(() => methodModule.createRun(panel,{supportedRun})).toThrow(PREDICTION_UNAVAILABLE)
    expect(supportedRun).not.toHaveBeenCalled()
    expect(panel).toEqual(before)
    expect(() => createRun(duplicatePanel(panel,'duplicate'))).toThrow(PREDICTION_UNAVAILABLE)
  })
  it('cannot bypass the unsupported mechanism through any engine/medium combination', () => {
    for(const engine of ['concept','contact','peat-fem'] as const)for(const medium of ['none','water','co2-water','unspecified'] as const){
      const panel=freshPanel('guard','vibratory-injection');panel.engine=engine;panel.medium=medium
      expect(compatible(panel.variantId,engine,medium)).toBe(PREDICTION_UNAVAILABLE)
      expect(() => createRun(panel)).toThrow(PREDICTION_UNAVAILABLE)
    }
  })
  it('never presents liquid, contact, pulse or wave sources, including after backwards seeking', () => {
    for(const t of [0,24,27,28,33,50,68,74,90,33,0,NaN,Infinity,-1]){
      const p=methodModule.presentation('vibratory-injection',t)
      expect(p.injection).toBe(false);expect(p.contacts).toBe(0)
      expect(p.pulse).toBe(false);expect(p.waves).toBe(false)
      expect(p.contextTime).toBeLessThanOrEqual(33)
      expect(Number.isFinite(p.vibration)).toBe(true)
    }
    expect(methodModule.presentation('vibratory-injection',38).vibration).not.toBe(0)
    expect(methodModule.presentation('vibratory-injection',90).vibration).toBe(0)
  })
})
