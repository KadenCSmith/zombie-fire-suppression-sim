import type { Snapshot } from '../sim/types'

export interface PlumeSource {
  xM: number; yM: number; depthM: number
  smokeKgS: number; steamKgS: number; condensedSteamKgS: number
  vxMS: number; vyMS: number; riseMS: number
}

function saturationPressurePa(temperatureK: number) {
  const c = Math.max(-40, Math.min(100, temperatureK - 273.15))
  return 610.94 * Math.exp(17.625 * c / (c + 243.04))
}

/** Sources derive from accepted inventory changes; visual smoke yield is assumed. */
export function derivePlumeSources(previous: Snapshot, current: Snapshot, ambientTemperatureK: number): PlumeSource[] {
  const dt = current.timeSeconds - previous.timeSeconds
  if (dt <= 0 || current.nx !== previous.nx || current.ny !== previous.ny || current.nz !== previous.nz) return []
  const { nx, ny, nz } = current
  const volume = current.widthM * current.lengthM * current.depthM / (nx * ny * nz)
  const out: PlumeSource[] = []
  for (let q = 0; q < nx * ny * nz; q++) {
    const fuelLoss = Math.max(0, previous.fields.fuel[q] - current.fields.fuel[q])
    const waterBefore = previous.fields.moisture[q] * previous.fields.porosity[q] * volume * 1000
    const waterAfter = current.fields.moisture[q] * current.fields.porosity[q] * volume * 1000
    const evaporated = Math.max(0, waterBefore - waterAfter)
    const smokeKgS = 0.02 * fuelLoss * current.fields.peatMask[q] / dt
    const steamKgS = evaporated / dt
    if (smokeKgS <= 0 && steamKgS <= 0) continue
    const hotK = current.fields.temperatureK[q]
    const condensationFraction = Math.max(0, Math.min(1, 1 - saturationPressurePa(ambientTemperatureK) / Math.max(1, saturationPressurePa(hotK))))
    const buoyancy = Math.sqrt(Math.max(0, 9.80665 * 0.5 * (hotK - ambientTemperatureK) / ambientTemperatureK))
    const i = q % nx; const j = Math.floor(q / nx) % ny; const k = Math.floor(q / (nx * ny))
    out.push({ xM: (i + 0.5) * current.widthM / nx, yM: (j + 0.5) * current.lengthM / ny,
      depthM: (k + 0.5) * current.depthM / nz, smokeKgS, steamKgS,
      condensedSteamKgS: steamKgS * condensationFraction,
      vxMS: current.fields.fluxXMps[q], vyMS: current.fields.fluxYMps[q], riseMS: buoyancy })
  }
  return out.sort((a, b) => (b.smokeKgS + b.condensedSteamKgS) - (a.smokeKgS + a.condensedSteamKgS)).slice(0, 24)
}
