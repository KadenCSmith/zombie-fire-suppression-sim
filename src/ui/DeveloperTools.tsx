import ResearchProfiles from './ResearchProfiles'
import { stageResearchProfile, RESEARCH_PROFILES, type ResearchTarget } from '../sim/researchProfiles'
import { useMemo, useState } from 'react'
import type { Scenario } from '../sim/types'
import { validateScenario } from '../sim/scenario'
import { MATERIAL_KEYS, DEFAULT_MATERIALS, dryBasisMoisture, peatPorosity, resolveMaterials } from '../sim/materials'
import { applyPropertyEdits, editableProperties, MATERIAL_SOURCES, parameterAudit } from '../sim/materialEvidence'
import './developer.css'

const GROUPS = ['Research profiles', 'Peat', 'Ground', 'Water and dry ice', 'Gas transport', 'Source', 'Reaction', 'Boundary', 'Layers and roots', 'Vertical mechanics', '3D mechanics', 'Short event', 'Solver limits', 'Sources']
function exportAudit(scenario: Scenario) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(parameterAudit(scenario), null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = 'material-evidence-and-scenario.json'; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function showNumber(value: number) { return Number.isFinite(value) ? Number(value.toPrecision(7)).toString() : '—' }
export default function DeveloperTools({ scenario, onApply }: { scenario: Scenario; onApply: (scenario: Scenario) => void }) {
  const [group, setGroup] = useState('Research profiles')
  const [query, setQuery] = useState('')
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [profile, setProfile] = useState<{ id: string; target: ResearchTarget } | null>(null)
  const [message, setMessage] = useState('')
  const properties = useMemo(() => editableProperties(scenario), [scenario])
  const candidate = useMemo(() => {
    try {
      const base = profile ? stageResearchProfile(scenario, profile.id, profile.target) : scenario
      const next = applyPropertyEdits(base, changes)
      const validation = validateScenario(next)
      return { scenario: next, errors: validation.errors }
    } catch (e) { return { scenario, errors: [e instanceof Error ? e.message : 'Invalid value.'] } }
  }, [scenario, changes, profile])
  const dirty = Object.keys(changes).length + (profile ? 1 : 0)
  const shown = editableProperties(candidate.scenario).filter(p => (query ? `${p.name} ${p.path} ${p.evidence}`.toLowerCase().includes(query.toLowerCase()) : p.group === group))
  const materials = resolveMaterials(candidate.scenario)
  const apply = () => {
    if (candidate.errors.length) return
    onApply(candidate.scenario); setChanges({}); setProfile(null); setMessage('Applied. Physical run and event results restarted with these values.')
  }
  const restore = () => {
    setProfile(null)
    setChanges(Object.fromEntries(MATERIAL_KEYS.map(key => [`materialProperties.${key}`, String(DEFAULT_MATERIALS[key])])) )
    setMessage('Reference material defaults staged. Review, then Apply to restart. Site and device settings are unchanged.')
  }
  return <main className="dev-tools" aria-label="Developer tools">
    <aside className="dev-nav">
      <span className="eyebrow">DEVELOPER TOOLS</span><h2>Materials &amp;<br />physical limits</h2>
      <p>Inspect the evidence.<br />Change the calculation.</p>
      <label className="dev-search">Find a property<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Density, oxygen, modulus…" /></label>
      <nav aria-label="Material groups">{GROUPS.map(name => <button key={name} type="button" className={!query && group === name ? 'active' : ''} aria-current={!query && group === name ? 'page' : undefined} onClick={() => { setGroup(name); setQuery('') }}>{name}<span>{name === 'Research profiles' ? RESEARCH_PROFILES.length : name === 'Sources' ? MATERIAL_SOURCES.length : properties.filter(p => p.group === name).length}</span></button>)}</nav>
      <button className="secondary-btn" type="button" onClick={() => exportAudit(scenario)}>Export applied values + sources</button>
    </aside>
    <section className="dev-main">
      <header className="dev-heading"><div><span className="eyebrow">EVIDENCE REVIEW · SI UNITS</span><h1>{query ? 'Property search' : group}</h1></div><span className="dev-status">{scenario.researchSelection ? 'Research comparison · editable' : 'Exploratory model'}</span></header>
      <div className="dev-explainer"><strong>Citations describe the evidence, including its limits.</strong><p>New material defaults include published peat and water heat capacities and CO₂ sublimation data. Ground, reaction and mechanics settings still need specimen measurements. Input ranges protect this model’s supported calculation; they are not experimental confidence intervals.</p></div>
      {!scenario.materialProperties && <p className="dev-notice">Legacy scenario: original material coefficients and peat porosity law are active. Editing a material constant adds the new material model and changes peat volume mixing; the applied export records that change.</p>}
      {(group === 'Peat' && !query) && <div className="dev-moisture"><h3>Moisture on the paper’s basis</h3><p>Water mass / dry peat mass = saturation × porosity × water density / dry bulk density.</p>{candidate.scenario.peatRegions.map(p => {
        const phi = peatPorosity(p.bulkDensityKgM3, p.organicFraction, materials, !candidate.scenario.materialProperties)
        const mc = dryBasisMoisture(p.moistureSaturation, phi, p.bulkDensityKgM3, materials.waterDensityKgM3)
        return <div key={p.id}><strong>{p.id}</strong><span>{showNumber(100 * p.moistureSaturation)}% pore saturation</span><span>{showNumber(mc)} kg/kg dry peat</span><span>{showNumber(100 * phi)}% porosity</span></div>
      })}</div>}
      {(group === 'Research profiles' && !query) ? <ResearchProfiles scenario={scenario} onStage={(id, target) => { setChanges({}); setProfile({ id, target }); setMessage('Research profile staged. Apply saves the comparison and restarts the run.'); }} /> : (group === 'Sources' && !query) ? <div className="dev-sources"><p>The working document’s relevant studies are included below. See the repository material audit for additional supplied references, access limitations and why each was considered.</p>{MATERIAL_SOURCES.map(source => <article key={source.id} id={`source-${source.id}`}><span className="eyebrow">{source.id} · ASCE REFERENCE</span><p className="dev-citation">{source.citation} <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer">doi:{source.doi}</a></p><p>{source.finding}</p><p><strong>Why it matters.</strong> {source.why}</p></article>)}</div> : <div className="dev-property-grid">{shown.map(p => {
        const value = changes[p.path] ?? showNumber(p.value)
        const numeric = Number(value)
        const invalid = !value.trim() || !Number.isFinite(numeric) || numeric < p.range[0] || numeric > p.range[1]
        return <article className={`dev-property ${Object.hasOwn(changes, p.path) ? 'changed' : ''}`} key={p.path}>
          <label htmlFor={`dev-${p.path}`}>{p.name}<span>{p.units}</span></label>
          <input id={`dev-${p.path}`} type="text" inputMode="decimal" value={value} aria-invalid={invalid} aria-describedby={`note-${p.path}`} onChange={e => { setChanges(old => ({ ...old, [p.path]: e.target.value })); setMessage('') }} />
          <small>Supported input: {p.range.map(showNumber).join(' to ')} {p.units}</small>
          <p id={`note-${p.path}`}>{p.evidence}</p>
          <div className="dev-reference-row">{p.sourceIds.length ? p.sourceIds.map(id => <button key={id} type="button" title={`Read source ${id}`} onClick={() => { setGroup('Sources'); setQuery(''); window.setTimeout(() => document.getElementById(`source-${id}`)?.scrollIntoView({ block: 'center' }), 0) }}>{id} ↗</button>) : <span>No matched measurement</span>}</div>
        </article>
      })}{!shown.length && <p>No matching properties.</p>}</div>}
    </section>
    <footer className="dev-actions">
      <div aria-live="polite">{candidate.errors.length ? <div className="dev-errors" role="alert"><strong>Resolve before applying</strong><ul>{candidate.errors.slice(0, 6).map(e => <li key={e}>{e}</li>)}</ul></div> : <><strong>{dirty ? profile ? `Staged profile: ${RESEARCH_PROFILES.find(p => p.id === profile.id)?.name}` : `${dirty} staged change${dirty === 1 ? '' : 's'}` : 'Applied settings'}</strong><p>{message || 'Apply saves all edits together and restarts the physical run. Exports use applied values. Unapplied drafts are discarded when leaving Developer tools.'}</p></>}</div>
      <button type="button" className="secondary-btn" onClick={restore}>Stage material defaults</button><button type="button" className="secondary-btn" disabled={!dirty} onClick={() => { setChanges({}); setProfile(null); setMessage('Draft discarded.') }}>Discard</button><button type="button" className="primary-btn" disabled={!dirty || candidate.errors.length > 0} onClick={apply}>Apply &amp; restart</button>
    </footer>
  </main>
}
