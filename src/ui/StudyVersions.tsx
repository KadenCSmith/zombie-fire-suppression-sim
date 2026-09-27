import { useEffect, useRef, useState } from 'react'
import Ellipsis from 'lucide-react/dist/esm/icons/ellipsis.mjs'
import { STUDY_VERSIONS, type StudyVersion } from './studyModel'
import './versions.css'

export function StudyVersions({ version, onSelect }: { version: StudyVersion; onSelect: (version: StudyVersion) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div ref={root} className="version-picker">
    <button ref={trigger} type="button" className="version-trigger" aria-label="Simulation versions" aria-expanded={open} aria-controls="simulation-versions" onClick={() => setOpen(value => !value)} title="Watch other versions"><Ellipsis size={23} /></button>
    {open && <div id="simulation-versions" className="version-panel" aria-label="Watch a simulation version">
      <strong>Watch a version</strong><p>Replay earlier scenes or return to the latest.</p>
      {STUDY_VERSIONS.map(item => <button key={item.id} type="button" aria-pressed={version === item.id} onClick={() => { onSelect(item.id); setOpen(false); trigger.current?.focus() }}>
        <span>{item.title}<small>{item.subtitle}</small></span><span aria-hidden="true">{version === item.id ? '✓' : '↗'}</span>
      </button>)}
      <small>Earlier scene behavior, replayed in this app. Scientific runs stay separate.</small>
    </div>}
  </div>
}
