import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { version } from '../../package.json'
import { HISTORICAL_WORKSPACES, type PhysicsWorkspace } from './ModelSelector'
import { availableVersions } from './simulationCatalog'
import { FinderPortal, ToolboxPortal, useCinematicUI } from './CinematicUI'
import './app-chrome.css'
import './cinematic.css'

export type LayoutMode = 'refined' | 'instrument' | 'technical'
export const LAYOUTS: readonly { id: LayoutMode; label: string }[] = [{ id: 'refined', label: 'Cinematic' }, { id: 'instrument', label: 'Instrument' }, { id: 'technical', label: 'Technical' }]
export function workspaceMode(workspace: PhysicsWorkspace): 'animation' | 'physics' { return workspace === 'sequence' || workspace === 'study' || workspace === 'comparison' ? 'animation' : 'physics' }
export function readLayout(value: string | null): LayoutMode { return LAYOUTS.some(item => item.id === value) ? value as LayoutMode : 'refined' }
const Documentation = lazy(() => import('./FormulaReferenceWorkspace'))
const destinations: { id: PhysicsWorkspace; title: string; detail: string }[] = [
  { id: 'sequence', title: 'Latest render', detail: 'Interactive complete fire sequence · straight bore, rapid release & connected water' },
  { id: 'peat-fem', title: 'Peat Fire FEM', detail: 'Active three-dimensional finite-element combustion baseline' },
  { id: 'comparison', title: 'Previous simulations', detail: 'Select archived models and compare synchronized replays' },
]
const guides = [
  { title: 'Active peat FEM baseline', text: 'Peat Fire FEM has its own accepted-state fields, inventories, probes and numerical evidence. Physical formulas describes the implemented scope and limitations. Historical workspaces remain accessible through Previous simulations.' },
  { title: 'Dry ice & the source', text: 'The physics models track a finite dry-ice inventory. Source size and mass are linked through density. Open the source controls in Toolbox; accepted results update only after their model is recalculated.' },
  { title: 'Heater & ignition', text: 'Heater power supplies external energy. In the fire experiment, ignition duration and ignition power describe surface preparation. They do not change the authored drilling sequence. Edit them in Experiment variables and calculate a new history.' },
  { title: 'Water, moisture & peat', text: 'Check the units next to each input: water per dry peat is a dry-mass ratio, while pore saturation is a volume fraction. The natural hose and crack wetting remain illustrative; scientific fields come from accepted snapshots.' },
  { title: 'Soil, cap & mechanics', text: 'FEA controls set assumed stiffness, geometry, load and material laws. Cap contact is reduced; mechanics benchmarks and the tensile lab have their own scope. Change physical inputs in Toolbox, then run that calculation.' },
  { title: 'Render & numerical fields', text: 'Natural cutaway shows the authored sequence. Temperature, oxygen and CO₂ views show accepted numerical history. Drag the scene to orbit; scroll the main render to reveal playback. Camera, labels, layers and replay speed do not change the solver trajectory.' },
  { title: 'Playback & previous models', text: 'Scroll all the way down to start the current sequence. The bottom bar pauses, rewinds, scrubs, restarts and changes speed. Previous simulations opens the comparison page; select archived replays in its Toolbox and use the shared clock.' },
  { title: 'Results, probes & exports', text: 'In the porous solver, use the Results section at the bottom of Toolbox for histories, mass and energy ledgers, CSV, images and recorded states. Section views allow cell probes. Coupled and tensile workspaces retain their own accepted-state exports and data comparisons.' },
  { title: 'Verification & model limits', text: 'Numerical residuals and convergence describe consistency of a calculation. They do not establish field validation or treatment success. Finder’s physics documentation contains the equations, references, implementation choices and unresolved phenomena.' },
]
function Pinwheel() { return <svg className="version-pinwheel" viewBox="0 0 72 136" aria-hidden="true"><path d="M36 38v96"/><g className="pinwheel-rotor">{[0,90,180,270].map(angle => <path key={angle} transform={`rotate(${angle} 36 33)`} d="M39 29C54 29 60 21 55 12C51 5 39 1 37 8C35 14 40 20 36 26"/>)}<circle cx="36" cy="33" r="3.2"/></g></svg> }
function FinderIcon() { return <svg viewBox="0 0 106 106" aria-hidden="true"><path d="M4 5l35 35V4h6v45H3v-6h31L1 10zM53 4h49v24L77 51H53zM77 51V34q0-7 7-7h18"/><circle cx="29" cy="75" r="18"/><path d="M16 88L3 102l5 4 13-15"/><circle cx="79" cy="80" r="24"/>{Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return <circle key={i} cx={79+17*Math.cos(a)} cy={80+17*Math.sin(a)} r="3.5"/>})}</svg> }
function ToolboxIcon() { return <svg viewBox="0 0 185 100" aria-hidden="true"><path d="M26 3L55 20 40 47l31 18q15 9 7 23t-24 5L24 75 8 99-18 82 0 50l12 7 8-14-12-7z" transform="translate(22 -2) scale(.9)"/><path d="M131 8h29l21 37-21 37h-42L97 45l21-37z"/><circle cx="139" cy="45" r="18"/></svg> }
export function AppChrome({ workspace, layout, onLayout, onWorkspace, selectedVersions, onSelectedVersions }: {
  workspace: PhysicsWorkspace; layout: LayoutMode; onLayout: (layout: LayoutMode) => void; onWorkspace: (workspace: PhysicsWorkspace) => void; selectedVersions: string[]; onSelectedVersions: (versions: string[]) => void
}) {
  const { panel, open, query, finderTab, setFinderTab } = useCinematicUI(), [menu, setMenu] = useState(false), [compact, setCompact] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => { document.body.classList.add('has-app-chrome'); document.body.dataset.layout = layout; return () => { document.body.classList.remove('has-app-chrome'); delete document.body.dataset.layout } }, [layout])
  useEffect(() => { const scroll = () => setCompact(window.scrollY > window.innerHeight * .35); scroll(); window.addEventListener('scroll', scroll, { passive: true }); return () => window.removeEventListener('scroll', scroll) }, [workspace])
  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }, [menu])
  const navigate = (next: PhysicsWorkspace) => { onWorkspace(next); setMenu(false); open(null); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const finder = (tab: 'guides' | 'docs' = 'guides') => { setFinderTab(tab); setMenu(false); open('finder') }
  const results = [...destinations, ...HISTORICAL_WORKSPACES].filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <header className={`cinematic-header ${compact || workspace !== 'sequence' ? 'is-compact' : ''}`}>
      <button className="cinematic-brand" onClick={() => navigate('sequence')} aria-label="Fire Simulation home">Fire Simulation<span>Ver.[{version}]</span></button>
      <div className="version-navigation" ref={menuRef}>
        <button className="cinematic-nav-button" aria-label="Simulation Version" aria-expanded={menu} aria-controls="simulation-version-menu" onClick={() => setMenu(value => !value)}><Pinwheel/><span>Simulation Version</span></button>
        <nav className="cinematic-sublinks" aria-label="Simulation modes"><button aria-current={workspace === 'sequence' ? 'page' : undefined} onClick={() => navigate('sequence')}>render</button><button aria-current={workspace === 'peat-fem' ? 'page' : undefined} onClick={() => navigate('peat-fem')}>Peat Fire FEM</button><button aria-current={workspace === 'comparison' ? 'page' : undefined} onClick={() => navigate('comparison')}>previous sims</button></nav>
        {menu && <div id="simulation-version-menu" className="version-menu" role="dialog" aria-label="Select simulation version"><span className="drawer-section-label">SIMULATION VERSION</span>{destinations.map((item, index) => <button key={item.id} aria-current={workspace === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><small>{String(index+1).padStart(2,'0')}</small><span>{item.title}<em>{item.detail}</em></span><b>↗</b></button>)}</div>}
      </div>
      <div className="finder-navigation"><button className="cinematic-nav-button" aria-label="Open Finder" aria-expanded={panel === 'finder'} onClick={() => { setMenu(false); open(panel === 'finder' ? null : 'finder') }}><FinderIcon/><span>finder</span></button><nav className="cinematic-sublinks"><button onClick={() => finder()}>guides & values</button><button onClick={() => finder('docs')}>physics documentation</button><button onClick={() => finder()}>search</button></nav></div>
      <button className="toolbox-navigation" aria-label="Open Toolbox" aria-expanded={panel === 'toolbox'} title="Edit simulation variables" onClick={() => { setMenu(false); open(panel === 'toolbox' ? null : 'toolbox') }}><ToolboxIcon/><span>toolbox</span></button>
    </header>
    <ToolboxPortal extra><section className="toolbox-destinations"><p>Additional workspaces</p>{destinations.filter(item => ['peat-fem','comparison'].includes(item.id)).map(item => <button key={item.id} onClick={() => navigate(item.id)}>{item.title}<span>↗</span></button>)}</section><section className="toolbox-layouts"><p>Interface appearance</p>{LAYOUTS.map(item => <button key={item.id} aria-pressed={layout === item.id} onClick={() => onLayout(item.id)}>{item.label}</button>)}</section><section className="toolbox-selection"><p>Archived simulations · {selectedVersions.length} selected</p><button onClick={() => onSelectedVersions(availableVersions().map(item => item.id))}>Select all playable</button><button onClick={() => onSelectedVersions([])}>Clear selection</button><button onClick={() => navigate('comparison')}>Open comparison ↗</button></section></ToolboxPortal>
    <FinderPortal><section className="finder-destinations"><div className="drawer-section-label">JUMP TO</div>{results.map(item => <button key={item.id} onClick={() => navigate(item.id)}><span>{item.title}<small>{item.detail}</small></span><b>↗</b></button>)}{query && !results.length && <p>Search the controls and guides below for “{query}”.</p>}</section><section className="finder-handbook"><div className="drawer-section-label">GUIDES</div>{guides.filter(item=>`${item.title} ${item.text}`.toLowerCase().includes(query.toLowerCase())).map(item=><details key={item.title}><summary>{item.title}</summary><p>{item.text}</p></details>)}</section></FinderPortal>
    <FinderPortal documentation>{finderTab === 'docs' && workspace !== 'peat-fem' && <Suspense fallback={<p>Opening physics documentation…</p>}><Documentation onWorkspace={navigate}/></Suspense>}</FinderPortal>
  </>
}
