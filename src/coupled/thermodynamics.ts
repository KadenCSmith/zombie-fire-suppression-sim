/** Caloric reference: condensed water at 273.15 K. All extensive energies are J.
 * Constant heat capacities are declared approximations, not fitted peat data. */
export const R = 8.314462618, T0 = 273.15
export const MOLAR = [0.031998, 0.0440095, 0.0280134, 0.01801528] as const
export const CV = [20.8, 28.8, 20.8, 25.3] as const
export const LF = 333550, LV = 2500900, WATER_R = R / MOLAR[3]
export const VAPOR_U0 = LV - WATER_R * T0
export const CO2_SUB_T = 194.67, CO2_SUB_H = 6030 * 4.184 / MOLAR[1], CO2_SOLID_CP = 850
export const co2SolidU = (t: number) => (CV[1] * (CO2_SUB_T - T0) + R * CO2_SUB_T) / MOLAR[1] - CO2_SUB_H + CO2_SOLID_CP * (t - CO2_SUB_T)
export const gasU = (species: number, t: number) => CV[species] * (t - T0) + (species === 3 ? VAPOR_U0 * MOLAR[3] : 0)
export const gasH = (species: number, t: number) => gasU(species, t) + R * t
/** Murphy & Koop (2005) ice; IAPWS saturation-pressure correlation for liquid, Pa. */
export function saturationPressure(t: number): number {
  if (t < T0) return Math.exp(9.550426 - 5723.265 / t + 3.53068 * Math.log(t) - 0.00728332 * t)
  if(t>=647.096)return 22.064e6
  const theta=1-t/647.096
  return 22.064e6*Math.exp(647.096/t*(-7.85951783*theta+1.84408259*theta**1.5-11.7866497*theta**3+22.6807411*theta**3.5-15.9618719*theta**4+1.80122502*theta**7.5))
}
export interface Phase { temperature: number; liquid: number; ice: number; vapor: number; energy: number; gasVolume: number }
export function phaseAt(t: number, waterKg: number, poreM3: number, dryCapacity: number, gas: ArrayLike<number>, frozen: boolean): Phase {
  const rho = frozen ? 917 : 1000
  // At saturation pv = mv Rv T/(Vp - (mw-mv)/rho), including phase volume.
  const a = saturationPressure(t) / (WATER_R * t)
  const vapor = a >= rho ? waterKg : Math.min(waterKg, Math.max(0, a * (poreM3 - waterKg / rho) / (1 - a / rho)))
  const condensed = waterKg - vapor, liquid = frozen ? 0 : condensed, ice = frozen ? condensed : 0
  let energy = dryCapacity * (t - T0) + liquid * 4186 * (t - T0) + ice * (2100 * (t - T0) - LF) + vapor * (CV[3] / MOLAR[3] * (t - T0) + VAPOR_U0)
  for (let s = 0; s < 3; s++) energy += gas[s] * gasU(s, t)
  return { temperature:t,liquid,ice,vapor,energy,gasVolume:poreM3-liquid/1000-ice/917 }
}
/** Enthalpy inversion includes the isothermal freezing plateau. No latent heat clipping. */
export function equilibrate(energy: number, waterKg: number, poreM3: number, dryCapacity: number, gas: ArrayLike<number>): Phase {
  // Exact all-vapor caloric inversion avoids iterative phase work when unsaturated.
  let capacity=dryCapacity+waterKg*CV[3]/MOLAR[3]
  for(let s=0;s<3;s++)capacity+=gas[s]*CV[s]
  const gasT=T0+(energy-waterKg*VAPOR_U0)/capacity
  if(gasT>=150&&gasT<=1200&&waterKg*WATER_R*gasT/poreM3<=saturationPressure(gasT))return{temperature:gasT,liquid:0,ice:0,vapor:waterKg,energy,gasVolume:poreM3}
  const frozen = phaseAt(T0, waterKg, poreM3, dryCapacity, gas, true), melted = phaseAt(T0, waterKg, poreM3, dryCapacity, gas, false)
  if (energy >= frozen.energy && energy <= melted.energy && waterKg > 0) {
    const fraction = (energy - frozen.energy) / (melted.energy - frozen.energy)
    // Vapor amount depends slightly on ice/liquid volume. Solve the plateau mass/energy exactly.
    const pv = saturationPressure(T0), a = pv / (WATER_R*T0)
    const vapor0 = a*(poreM3-waterKg/917)/(1-a/917)
    const slope = a*(1/917-1/1000)/(1-a/917)
    const liquid = (energy + waterKg*LF - vapor0*(VAPOR_U0+LF))/(LF+slope*(VAPOR_U0+LF))
    const vapor = vapor0+slope*liquid, ice=waterKg-vapor-liquid
    if (fraction >= 0 && liquid>=-1e-10 && ice>=-1e-10) return {temperature:T0,liquid,ice,vapor,energy,gasVolume:poreM3-liquid/1000-ice/917}
  }
  let low=150,high=1200
  const iceBranch=energy<frozen.energy
  if (iceBranch) high=T0; else low=T0
  if (energy<phaseAt(low,waterKg,poreM3,dryCapacity,gas,iceBranch).energy || energy>phaseAt(high,waterKg,poreM3,dryCapacity,gas,iceBranch).energy) throw new Error('Thermal state outside 150–1200 K caloric model.')
  for(let n=0;n<46;n++) {const mid=(low+high)/2; if(phaseAt(mid,waterKg,poreM3,dryCapacity,gas,iceBranch).energy>energy)high=mid;else low=mid}
  return phaseAt((low+high)/2,waterKg,poreM3,dryCapacity,gas,iceBranch)
}
