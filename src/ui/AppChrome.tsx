import { useEffect } from 'react'
import type { PhysicsWorkspace } from './ModelSelector'
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

export function AppChrome({ workspace, layout, onLayout }: { workspace: PhysicsWorkspace; layout: LayoutMode; onLayout: (layout: LayoutMode) => void }) {
  const mode = workspaceMode(workspace)
  useEffect(() => {
    document.body.classList.add('has-app-chrome')
    document.body.dataset.layout = layout
    return () => { document.body.classList.remove('has-app-chrome'); delete document.body.dataset.layout }
  }, [layout])
  return <header className="app-chrome" data-mode={mode}>
    <div className="app-chrome-mode"><span>{mode === 'animation' ? 'ANIMATION MODE' : 'PHYSICS SIMULATION MODE'}</span><strong>{mode === 'animation' ? 'Authored presentation' : 'Research calculation'}</strong><small>{mode === 'animation' ? 'Solver clocks remain separate or unavailable' : 'Validation status is reported separately'}</small></div>
    <div className="app-chrome-layout" role="group" aria-label="Interface layout">
      <span>INTERFACE</span>{LAYOUTS.map(item => <button key={item.id} type="button" aria-pressed={layout === item.id} onClick={() => onLayout(item.id)}>{item.label}</button>)}
    </div>
  </header>
}
