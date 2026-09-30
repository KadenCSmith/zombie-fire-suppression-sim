import { useEffect, useRef, useState } from 'react'
import MoreHorizontal from 'lucide-react/dist/esm/icons/ellipsis.mjs'
import type { PhysicsWorkspace } from './ModelSelector'
import { availableVersions, SIMULATION_CATALOG } from './simulationCatalog'
import './app-chrome.css'

export type LayoutMode = 'refined' | 'instrument' | 'technical'
export const LAYOUTS: readonly { id: LayoutMode; label: string }[] = [
  { id: 'refined', label: 'Refined' },
  { id: 'instrument', label: 'Instrument' },
  { id: 'technical', label: 'Technical' },
]

export function workspaceMode(workspace: PhysicsWorkspace): 'animation' | 'physics' {
  return workspace === 'sequence' || workspace === 'study' || workspace === 'comparison' ? 'animation' : 'physics'
}

export function readLayout(value: string | null): LayoutMode {
  return LAYOUTS.some(layout => layout.id === value) ? value as LayoutMode : 'refined'
}

export function AppChrome({ workspace, layout, onLayout, onWorkspace, selectedVersions, onSelectedVersions }: {
  workspace: PhysicsWorkspace
  layout: LayoutMode
  onLayout: (layout: LayoutMode) => void
  onWorkspace: (workspace: PhysicsWorkspace) => void
  selectedVersions: string[]
  onSelectedVersions: (versions: string[]) => void
}) {
  const mode = workspaceMode(workspace)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'simulations' | 'interface'>('simulations')
  const menuRef = useRef<HTMLDivElement>(null)
  const ready = availableVersions()
  useEffect(() => {
    document.body.classList.add('has-app-chrome')
    document.body.dataset.layout = layout
    return () => { document.body.classList.remove('has-app-chrome'); delete document.body.dataset.layout }
  }, [layout])
  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])
  const toggleVersion = (id: string) => onSelectedVersions(selectedVersions.includes(id)
    ? selectedVersions.filter(value => value !== id)
    : [...selectedVersions, id])
  return <header className="app-chrome" data-mode={mode}>
    <div className="app-chrome-mode"><span>{mode === 'animation' ? 'ANIMATION MODE' : 'PHYSICS SIMULATION MODE'}</span><strong>{mode === 'animation' ? 'Authored presentation' : 'Research calculation'}</strong><small>{mode === 'animation' ? 'Solver clocks remain separate or unavailable' : 'Validation status is reported separately'}</small></div>
    <div className="app-chrome-actions" ref={menuRef}>
      <button className="app-chrome-gallery" type="button" onClick={() => onWorkspace('comparison')}>Watch together <span>{selectedVersions.length}</span></button>
      <button className="app-chrome-more" type="button" aria-label="More options" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}><MoreHorizontal size={24} /></button>
      {open && <div className="app-options" role="dialog" aria-label="App options">
        <div className="app-options-tabs" role="tablist" aria-label="Options tabs">
          <button role="tab" aria-selected={tab === 'simulations'} onClick={() => setTab('simulations')}>Simulations</button>
          <button role="tab" aria-selected={tab === 'interface'} onClick={() => setTab('interface')}>Interface</button>
        </div>
        {tab === 'simulations' ? <div className="app-options-panel" role="tabpanel">
          <h2>Watch models together</h2><p>Choose the archived animations to play in one synchronized gallery.</p>
          <div className="app-options-select-all"><button type="button" onClick={() => onSelectedVersions(ready.map(version => version.id))}>Select all playable</button><button type="button" onClick={() => onSelectedVersions([])}>Clear</button></div>
          <div className="app-options-versions">{SIMULATION_CATALOG.map(version => <label key={version.id} className={!version.available ? 'is-unavailable' : ''} title={version.limitation}>
            <input type="checkbox" checked={selectedVersions.includes(version.id)} disabled={!version.available} onChange={() => toggleVersion(version.id)} />
            <span><strong>v{version.id} · {version.title}</strong><small>{version.available ? version.replay === 'film' ? 'Bundled Blender film' : 'Interactive animation' : 'No preserved Blender render'}</small></span>
          </label>)}</div>
          <button className="app-options-open" type="button" onClick={() => { onWorkspace('comparison'); setOpen(false) }}>Open multi-view gallery</button>
        </div> : <div className="app-options-panel" role="tabpanel">
          <h2>Choose your interface</h2><p>All three views use the same models and keep your current place.</p>
          <div className="app-options-layouts">{LAYOUTS.map(item => <button key={item.id} type="button" aria-pressed={layout === item.id} onClick={() => onLayout(item.id)}>
            <span className={`app-layout-preview app-layout-preview-${item.id}`} aria-hidden="true"><i /><i /><i /></span>
            <strong>{item.label}</strong><small>{item.id === 'refined' ? 'Cinematic dark canvas' : item.id === 'instrument' ? 'Bright editorial controls' : 'Dense scientific console'}</small>
          </button>)}</div>
        </div>}
      </div>}
    </div>
  </header>
}
