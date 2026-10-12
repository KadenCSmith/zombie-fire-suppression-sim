import { methodModule as sublimation } from './sublimation-injection'
import { methodModule as pressure } from './pressure-pulse'
import { methodModule as vibration } from './vibratory-injection'
export const METHOD_MODULES = [sublimation, pressure, vibration] as const
export function findMethodModule(id: string) { return METHOD_MODULES.find(m => m.variants.some(v => v.id === id)) }
