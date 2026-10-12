/** D owns the concrete schema after its initial audit. JSON-safe placeholders
 * carry no invented particle size, residence time, pressure or soil property. */
export type ParticleJson = null | boolean | number | string | ParticleJson[] | { [key: string]: ParticleJson }
export type ParticleInjectionSettings = Record<string, ParticleJson>
export type ParticleInjectionState = Record<string, ParticleJson>
