import type { AcceptedState, PanelConfig } from '../model'
import type { ParticleInjectionSettings, ParticleInjectionState, Location } from './types'
import { defaultParticleInjectionSettings } from './config'
import './style.css'
export interface ParticleComparisonProps { config: PanelConfig; onChange: (config: PanelConfig) => void; state?: AcceptedState; history: readonly AcceptedState[] }
const n = (v: number | null | undefined, digits=4) => v == null ? 'Unavailable' : v.toFixed(digits)
export function ParticleStateView({ state }: { state?: ParticleInjectionState }) {
  if (!state) return <p>No accepted particle state. Run the bounded model to test delivery.</p>
  const entries = Object.entries(state.locations) as [Location,ParticleInjectionState['locations'][Location]][]
  return <section aria-label="Computed particle state" data-physical-time={state.timeS}>
    <p><strong>{state.timeS.toFixed(2)} s physical time</strong> · {state.solidEnteringGroundKg>0 ? 'Some solids crossed the modeled probe; delivery is conditional.' : 'No solid particles delivered underground in this run.'}</p>
    <svg viewBox="0 0 600 115" role="img" aria-label="Computed solid inventories by location; mass-weighted symbols not to scale">
      {entries.map(([key,value],i) => <g key={key} transform={`translate(${75+i*150},45)`}>
        <rect x={-68} y={-35} width={136} height={95} rx={10} fill="#152c32" stroke="#5b7377"/>
        {value.solidKg>0 && <circle r={24*Math.sqrt(value.solidKg/Math.max(state.initialCO2Kg,1e-30))} fill="#d7faff"/>}
        <text y={38} textAnchor="middle" fill="#e1f1eb" fontSize={12}>{key.toUpperCase()} · {n(value.solidKg*1000,3)} g solid</text>
        <text y={54} textAnchor="middle" fill="#9cb8b3" fontSize={10}>{value.temperatureK===null?'Empty':`${n(value.temperatureK,2)} K carrier`}</text>
      </g>)}
    </svg>
    <p className="d-note">Computed mass-weighted representatives enlarged, not to scale. Location boxes are inventory compartments, not predicted penetration or spatial flow.</p>
    <dl className="d-metrics">
      <div><dt>Solid crossed probe</dt><dd>{n(state.solidEnteringGroundKg*1000,5)} g</dd></div>
      <div><dt>Probe survival / arrived CO₂</dt><dd>{state.probeSurvivalFractionArrivedCO2===null?'No CO₂ arrived':`${n(state.probeSurvivalFractionArrivedCO2*100,3)}%`}</dd></div>
      <div><dt>Upstream / initial CO₂</dt><dd>{state.upstreamFractionInitialCO2===null?'No CO₂':`${n(state.upstreamFractionInitialCO2*100,3)}%`}</dd></div>
      <div><dt>Underground / initial CO₂</dt><dd>{state.undergroundFractionInitialCO2===null?'No CO₂':`${n(state.undergroundFractionInitialCO2*100,3)}%`}</dd></div>
      <div><dt>Peat specimen temperature</dt><dd>{n(state.peatTemperatureK,3)} K</dd></div>
      <div><dt>Retained water / dry peat</dt><dd>{n(state.retainedMoistureDryBasis,3)} kg/kg</dd></div>
      <div><dt>Added CO₂ cold resource</dt><dd>{n(state.additionalColdResourceJ,1)} J</dd></div>
      <div><dt>Heat removed from peat</dt><dd>{n(state.heatFromPeatJ,3)} J</dd></div>
    </dl>
    <details><summary>Inventories, energy and gas release</summary><table><thead><tr><th>Location</th><th>Water kg</th><th>Solid kg</th><th>CO₂ gas kg</th><th>H J</th><th>Mass-weighted diameter µm</th></tr></thead><tbody>{entries.map(([key,c])=><tr key={key}><td>{key}</td><td>{n(c.waterKg,6)}</td><td>{n(c.solidKg,8)}</td><td>{n(c.gasKg,8)}</td><td>{n(c.enthalpyJ,3)}</td><td>{state.meanSolidDiameterM[key]===null?'No solids':n(state.meanSolidDiameterM[key]!*1e6,3)}</td></tr>)}</tbody></table>
      <p>Water residual {state.waterMassResidualKg.toExponential(3)} kg · CO₂ residual {state.co2MassResidualKg.toExponential(3)} kg · energy residual {state.energyResidualJ.toExponential(3)} J.</p>
      <table><thead><tr><th>Gas release location</th><th>Physical interval s</th><th>CO₂ g</th><th>Latent absorption J</th></tr></thead><tbody>{state.releases.map((r,i)=><tr key={i}><td>{r.location}</td><td>{n(r.fromS,4)}–{n(r.toS,4)}</td><td>{n(r.massKg*1000,6)}</td><td>{n(r.latentJ,4)}</td></tr>)}</tbody></table>
      <p>Release intervals retain numerical time bounds. Released gas stays in the carried inventory and its sensible enthalpy travels downstream. Latent absorption is not heat removed from peat when release occurs upstream.</p>
    </details>
    <p className="d-note">Pressure, penetration, spatial gas/O₂ and extinction: unavailable. Local ice shells/blockage are unverified. Cooling is not evidence of extinction or prevention of re-ignition.</p>
  </section>
}
export function ParticleComparison({ config, onChange, state, history }: ParticleComparisonProps) {
  const p = config.particleInjection ?? defaultParticleInjectionSettings()
  function update<K extends keyof ParticleInjectionSettings>(key: K, value: ParticleInjectionSettings[K]) { onChange({ ...structuredClone(config), particleInjection: { ...p,[key]:value } }) }
  const inputs = [
    ['particleDiameterM','Particle diameter (µm)',1e6,10,500], ['effectiveConductivityWmK','Effective conductivity (W/m/K)',1,.0006,.6],
    ['solidDensityKgM3','Assumed solid density (kg/m³)',1,800,1650], ['hoseResidenceS','Assumed hose residence (s)',1,0,20], ['probeResidenceS','Assumed probe residence (s)',1,0,10],
    ['dryPeatMassKg','Dry specimen mass (kg)',1,.01,10], ['initialMoistureDryBasis','Initial water / dry peat (kg/kg)',1,0,1], ['dryPeatCpJkgK','Assumed dry peat heat capacity (J/kg/K)',1,500,3000],
  ] as const
  return <div className="d-comparison">
    <details><summary>Particle inputs, assumptions & counterfactual</summary>
      <p>Every default is an explicit unmeasured analytical study case. Size is not inferred from “Nano.” The model requires273.15–350K water and a nonreacting warm specimen. Underresolved solid withdrawal is rejected, not reported as zero delivery. The onset resolution screen does not certify accuracy across the input domain; changed cases need their own refinement.</p>
      <div className="d-inputs">{([
        ['waterKg','Water quantity (kg)'],['flowKgS','Prescribed water flow (kg/s)'],['dryIceKg','Initial CO2 inventory (kg)'],['inletK','Water inlet temperature (K)'],['initialK','Initial warm peat specimen (K)'],['contactStartS','Withdrawal start after mixing (s)'],['conductanceWK','Assumed specimen contact UA (W/K)'],['endS','Observation window (s)'],
      ] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" step="any" value={config.thermal[key]} onChange={e=>onChange({...structuredClone(config),thermal:{...config.thermal,[key]:Number(e.target.value)}})}/></label>)}</div>
      <label><input aria-label="Particle intervention enabled" type="checkbox" checked={config.thermal.enabled} onChange={e=>onChange({...structuredClone(config),thermal:{...config.thermal,enabled:e.target.checked}})}/> Intervention enabled</label>
      <div className="d-inputs">{inputs.map(([key,label,scale,min,max])=><label key={key}>{label}<input aria-label={label} type="number" step="any" min={min} max={max} value={p[key]*scale} onChange={e=>update(key,Number(e.target.value)/scale)}/></label>)}</div>
      <label>Initial CO₂ phase<select aria-label="Initial CO2 phase" value={p.initialPhase} onChange={e=>update('initialPhase',e.target.value as ParticleInjectionSettings['initialPhase'])}><option value="solid">Solid at saturated195K reference</option><option value="pre-sublimated">Fully pre-sublimated; same water pays latent heat</option></select></label>
      <label>Size provenance<textarea aria-label="Size provenance" value={p.sizeProvenance} onChange={e=>update('sizeProvenance',e.target.value)}/></label>
      <p>{p.heatTransferProvenance}</p><p>{p.residenceProvenance}</p><p>{p.soilProvenance}</p>
      <p>Matched control: same water quantity, flow/start schedule, initial/inlet temperatures, peat/moisture, contact UA, transport times and observation window. Added cold CO₂ is a disclosed extra thermal resource. Zero particles reduces exactly to water-only.</p>
    </details>
    <ParticleStateView state={state?.particleInjection}/>
    {history.length>0 && <p className="d-note">{history.length} accepted physical checkpoints · last{history.at(-1)!.timeS.toFixed(2)} s. Adiabatic nonreacting observation; ambient/combustion reheating is unavailable.</p>}
  </div>
}
