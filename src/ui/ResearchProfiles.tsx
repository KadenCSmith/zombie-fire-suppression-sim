import { useState } from 'react'
import type { Scenario } from '../sim/types'
import { RESEARCH_PROFILES, type ResearchTarget } from '../sim/researchProfiles'

export default function ResearchProfiles({ scenario, onStage }: { scenario: Scenario; onStage: (id: string, target: ResearchTarget) => void }) {
  const [family, setFamily] = useState('Moss peat')
  const [target, setTarget] = useState<ResearchTarget>('soil')
  const families = [...new Set(RESEARCH_PROFILES.map(p => p.family))]
  return <div className="research-profiles">
    <div className="research-family" role="tablist" aria-label="Research material family">{families.map(f => <button key={f} type="button" role="tab" aria-selected={family === f} onClick={() => setFamily(f)}>{f}</button>)}</div>
    <div className="research-target"><label>Apply material to <select value={target} aria-label="Research profile target" onChange={e => setTarget(e.target.value as ResearchTarget)}><option value="soil">Base soil matrix</option>{scenario.peatRegions.map((p, i) => <option key={p.id} value={`peat:${i}`}>{p.id}</option>)}</select></label><p>{target === 'soil' ? 'Base soil: layer property modifiers become neutral. Existing peat regions retain their overrides.' : 'Selected region: density, organic content and moisture change locally. Peat heat capacity and conductivity are shared across all peat regions.'} Geometry, ignition, device and unreported properties keep their current values. Review the staged changes before applying.</p></div>
    <div className="research-card-grid">{RESEARCH_PROFILES.filter(p => p.family === family).map(profile => <article key={profile.id} className="research-card">
      <div className="research-soil-swatch" style={{ '--organic': profile.organicFraction } as React.CSSProperties}><span /></div>
      <div className="research-card-body"><span className="eyebrow">{profile.sourceIds.join(' + ')} · RESEARCH REFERENCE</span><h2>{profile.name}</h2>
        <div className="research-metrics"><div><strong>{profile.density}</strong><small>kg/m³ dry bulk</small></div><div><strong>{Number((profile.organicFraction * 100).toFixed(2))}%</strong><small>organic matter*</small></div><div><strong>{profile.dryBasisMoisture}</strong><small>kg water/kg dry</small></div></div>
        <p>{profile.reported}</p><details><summary>Value interpretation and missing data</summary><p>{profile.interpretation}</p><p>{profile.missing}</p></details>
        <button type="button" className="primary-btn" onClick={() => onStage(profile.id, target)}>Stage this profile</button>
      </div>
    </article>)}</div>
    <p className="research-footnote">*Organic matter is estimated or inferred as described for each study. These menus supply material comparisons; they do not reproduce or validate the original experiments. All source citations are in Sources and the exported audit.</p>
  </div>
}
