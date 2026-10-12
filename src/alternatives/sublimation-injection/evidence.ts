/** Evidence text and procurement examples; never imported by the solver core. */
export const REFERENCES = {
  carbonDioxide: { label: 'NIST CO₂ phase-change data · Giauque & Egan (1937)', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C124389&Mask=4' },
  water: { label: 'NIST water reference data', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2' },
  waterPhase: { label: 'NIST water phase-change reference', url: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4' },
  suppressionStudy: { label: 'Santoso et al. (2021) · laboratory peat suppression', url: 'https://doi.org/10.1071/WF20117' },
  logger: { label: 'Onset UX120-014M manufacturer listing', url: 'https://www.onsetcomp.com/products/data-loggers/ux120-014m' },
  retailWater: { label: 'Walmart distilled-water listing', url: 'https://www.walmart.com/ip/Great-Value-Distilled-Water-1-Gallon/17501951806' },
} as const

export const COST_EVIDENCE = {
  checkedDate: '2026-10-11', currency: 'USD',
  loggerOnlyUSD: 380,
  /** Authored planning sensitivity, not supplier confidence bounds. */
  planningFraction: .25,
  waterJugUSD: 1.44,
  usGallonL: 3.785411784,
  assumedWaterKgL: 1,
} as const

/** Allocated material cost, not purchase cost or an equipment/system estimate. */
export function allocatedWaterCostUSD(massKg: number) {
  if (!Number.isFinite(massKg) || massKg < 0) throw new Error('Water allocation must be a finite nonnegative mass in kg.')
  return massKg * COST_EVIDENCE.waterJugUSD / (COST_EVIDENCE.usGallonL * COST_EVIDENCE.assumedWaterKgL)
}
