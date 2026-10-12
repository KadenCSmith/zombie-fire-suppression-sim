import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { VibratoryFieldRun } from '../../../src/alternatives/vibratory-injection/field'

it('verifies the complete default physical window without fabricated extinction',()=>{
  const run=new VibratoryFieldRun(),start=performance.now()
  const checkpoints=[0,10,20,60].map(time=>{
    const s=run.advanceTo(time)
    expect(Math.abs(s.massResidualKg)).toBeLessThan(1e-7)
    expect(Math.abs(s.energyResidualJ)).toBeLessThan(1e-4)
    expect(Math.abs(s.waterSpeciesResidualKg)).toBeLessThan(1e-7)
    return {timeS:s.timeS,deliveredKg:s.deliveredKg,remainingKg:s.remainingKg,maximumK:s.maximumK,
      oxygenKg:s.oxygenKg,reactedFuelKg:s.reactedFuelKg,reactionW:s.reactionW,massResidualKg:s.massResidualKg,
      energyResidualJ:s.energyResidualJ,waterSpeciesResidualKg:s.waterSpeciesResidualKg,inletEnergyJ:s.inletEnergyJ,
      liquidFlowWorkJ:s.liquidFlowWorkJ}
  })
  expect(checkpoints[2].deliveredKg).toBeCloseTo(.5,12)
  expect(checkpoints[3].deliveredKg).toBeCloseTo(.5,12)
  const evidence={method:'4.2.4',scope:'Experimental prescribed-liquid source on inherited reacting peat grid; no infiltration/vibration mechanics or validation.',settings:run.settings,grid:run.snapshot().grid,checkpoints}
  console.log('VIBRATORY_FIELD_EVIDENCE',JSON.stringify({...evidence,runtimeMs:performance.now()-start}))
  if(process.env.V21_C_FIELD_EVIDENCE_PATH)writeFileSync(process.env.V21_C_FIELD_EVIDENCE_PATH,JSON.stringify(evidence,null,2)+'\n')
},30000)
