import { methodModule as sublimation } from './sublimation-injection'
import { methodModule as liquidWaves } from './pressure-pulse-liquid-waves'
import { methodModule as pressureOnly } from './pressure-pulse-pressure-only'
import { methodModule as vibration } from './vibratory-injection'
export const METHOD_MODULES = [sublimation, liquidWaves, pressureOnly, vibration] as const
export function findMethodModule(id: string) { return METHOD_MODULES.find(m => m.variants.some(v => v.id === id)) }
