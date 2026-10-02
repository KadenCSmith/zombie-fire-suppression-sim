import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Search, X } from 'lucide-react'

type Panel = 'finder' | 'toolbox' | null
type Slot = 'tools' | 'extras' | 'guides' | 'docs'
type UI = { panel: Panel; open: (panel: Panel) => void; query: string; finderTab: 'guides' | 'docs'; setFinderTab: (tab: 'guides' | 'docs') => void; slots: Record<Slot, HTMLElement | null> }
const Context = createContext<UI | null>(null)
export function useCinematicUI() { const value = useContext(Context); if (!value) throw new Error('Cinematic UI provider is missing'); return value }
export function ToolboxPortal({ children, extra = false }: { children: ReactNode; extra?: boolean }) {
  const { slots } = useCinematicUI(); const node = slots[extra ? 'extras' : 'tools']; return node ? createPortal(children, node) : null
}
export function FinderPortal({ children, documentation = false }: { children: ReactNode; documentation?: boolean }) {
  const { slots } = useCinematicUI(); const node = slots[documentation ? 'docs' : 'guides']; return node ? createPortal(children, node) : null
}
type Variable = { element: HTMLInputElement | HTMLSelectElement; label: string; value: string; note: string }
function CurrentValues({ source }: { source: HTMLElement | null }) {
  const { open, query } = useCinematicUI()
  const [items, setItems] = useState<Variable[]>([])
  useEffect(() => {
    if (!source) return
    const read = () => setItems(Array.from(source.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([type=file]):not([type=range]), select')).map(element => {
      const parent = element.closest('.number-control,.ops-slider,.parameter-slider,.coupled-parameter,.ops-parameter,label,.select-row,.control-top') ?? element.parentElement
      const linked = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null
      const label = element.getAttribute('aria-label') || linked?.textContent || parent?.querySelector('label')?.textContent || parent?.textContent?.split('\n')[0] || 'Setting'
      const value = element instanceof HTMLSelectElement ? element.selectedOptions[0]?.textContent ?? element.value : element.type === 'checkbox' ? element.checked ? 'On' : 'Off' : element.value
      return { element, label: label.trim().replace(/\s+/g, ' ').slice(0, 90), value, note: parent?.querySelector('small,.control-note')?.textContent ?? element.title ?? '' }
    }).filter(item => item.label && item.element.type !== 'hidden'))
    read(); const timer = window.setInterval(read, 1200); source.addEventListener('change', read); source.addEventListener('input', read)
    return () => { clearInterval(timer); source.removeEventListener('change', read); source.removeEventListener('input', read) }
  }, [source])
  const filtered = items.filter(item => `${item.label} ${item.note}`.toLowerCase().includes(query.toLowerCase()))
  if (!filtered.length) return null
  return <section className="finder-values"><div className="drawer-section-label">CURRENT VALUES <span>{filtered.length}</span></div><p>Select a value to open its control in Toolbox.</p>{filtered.map((item, index) => <button key={`${item.label}-${index}`} onClick={() => {
    open('toolbox'); let parent = item.element.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement }
    window.setTimeout(() => { item.element.scrollIntoView({ block: 'center', behavior: 'smooth' }); item.element.focus() }, 350)
  }}><span>{item.label}{item.note && <small>{item.note}</small>}</span><strong>{item.value}</strong><ArrowUpRight size={14} /></button>)}</section>
}
export function CinematicUIProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null), [query, setQuery] = useState(''), [finderTab, setFinderTab] = useState<'guides' | 'docs'>('guides')
  const [slots, setSlots] = useState<Record<Slot, HTMLElement | null>>({ tools: null, extras: null, guides: null, docs: null })
  const toolsRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, tools: node })), [])
  const extrasRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, extras: node })), [])
  const guidesRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, guides: node })), [])
  const docsRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, docs: node })), [])
  const drawer = useRef<HTMLElement>(null), returnFocus = useRef<HTMLElement | null>(null), activePanel = useRef<Panel>(null)
  const open = useCallback((next: Panel) => {
    if (next && !activePanel.current) returnFocus.current = document.activeElement as HTMLElement
    activePanel.current = next; setPanel(next)
    if (!next) window.setTimeout(() => returnFocus.current?.focus({ preventScroll: true }), 20)
  }, [])
  useEffect(() => { document.body.classList.add('cinematic-ui'); return () => document.body.classList.remove('cinematic-ui') }, [])
  useEffect(() => {
    if (!panel) return
    const stopBackgroundScroll = (event: Event) => { if (!drawer.current?.contains(event.target as Node)) event.preventDefault() }
    document.addEventListener('wheel', stopBackgroundScroll, { passive: false }); document.addEventListener('touchmove', stopBackgroundScroll, { passive: false })
    const frame = requestAnimationFrame(() => drawer.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }))
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { open(null); return }
      if (event.key !== 'Tab') return
      const elements = Array.from(drawer.current?.querySelectorAll<HTMLElement>('button,input,select,summary,a[href],[tabindex="0"]') ?? []).filter(el => !el.closest('[hidden]') && el.getClientRects().length && !(el as HTMLButtonElement).disabled)
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('wheel', stopBackgroundScroll); document.removeEventListener('touchmove', stopBackgroundScroll); document.removeEventListener('keydown', key) }
  }, [panel, open])
  return <Context.Provider value={{ panel, open, query, finderTab, setFinderTab, slots }}>{children}
    {panel && <button className="cinematic-backdrop" aria-label="Close side panel" tabIndex={-1} onClick={() => open(null)} />}
    <aside ref={drawer} className={`cinematic-drawer ${panel ? 'is-open' : ''}`} role="dialog" aria-modal={panel ? true : undefined} aria-label={panel === 'finder' ? 'Finder' : 'Toolbox'} aria-hidden={!panel} inert={!panel} data-panel={panel ?? 'closed'}>
      <header className="drawer-heading"><div><span>FIRE SIMULATION</span><h2>{panel === 'finder' ? 'finder' : 'toolbox'}</h2></div><button aria-label="Close side panel" onClick={() => open(null)}><X size={25} strokeWidth={1} /></button></header>
      <div className="drawer-content" hidden={panel !== 'finder'}>
        <label className="finder-search"><Search size={18} strokeWidth={1} /><input aria-label="Search Finder" placeholder="Search the simulation" value={query} onChange={event => { setQuery(event.target.value); setFinderTab('guides') }} /><span>↵</span></label>
        <div className="finder-tabs"><button aria-pressed={finderTab === 'guides'} onClick={() => setFinderTab('guides')}>guides & values</button><button aria-pressed={finderTab === 'docs'} onClick={() => setFinderTab('docs')}>physics documentation</button></div>
        <div hidden={finderTab !== 'guides'}><div ref={guidesRef} /><CurrentValues source={slots.tools} /></div>
        <div hidden={finderTab !== 'docs'} ref={docsRef} />
      </div>
      <div className="drawer-content" hidden={panel !== 'toolbox'}><div className="drawer-section-label">SIMULATION CONTROLS</div><p className="drawer-intro">Edit the current model. Physical parameter changes follow that model’s existing reset and calculation rules.</p><div ref={toolsRef} /><div className="drawer-section-label drawer-extras-heading">MORE TOOLS</div><div ref={extrasRef} /></div>
    </aside>
  </Context.Provider>
}
