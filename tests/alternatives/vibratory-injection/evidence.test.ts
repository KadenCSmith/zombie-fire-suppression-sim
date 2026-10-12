import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createRun, freshPanel } from '../../../src/alternatives/model'

it('retains historical liquid evidence without treating it as current vibration evidence', () => {
  const historical=JSON.parse(readFileSync(new URL('../../../docs/alternatives/vibratory-injection/contact-evidence.json',import.meta.url),'utf8'))
  expect(historical.experimentallyValidated).toBe(false)
  expect(historical.checkpoints.at(-1).metrics.waterUsedKg).toBeCloseTo(.5,12)
  expect(() => createRun(freshPanel('current','vibratory-injection'))).toThrow('Vibration-only prediction is unavailable')
})
