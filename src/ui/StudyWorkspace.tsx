import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.mjs'
import Check from 'lucide-react/dist/esm/icons/check.mjs'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs'
import Flame from 'lucide-react/dist/esm/icons/flame.mjs'
import Focus from 'lucide-react/dist/esm/icons/focus.mjs'
import Layers3 from 'lucide-react/dist/esm/icons/layers-3.mjs'
import Leaf from 'lucide-react/dist/esm/icons/leaf.mjs'
import MoveUpRight from 'lucide-react/dist/esm/icons/move-up-right.mjs'
import Pause from 'lucide-react/dist/esm/icons/pause.mjs'
import Play from 'lucide-react/dist/esm/icons/play.mjs'
import Repeat2 from 'lucide-react/dist/esm/icons/repeat-2.mjs'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.mjs'
import Scan from 'lucide-react/dist/esm/icons/scan.mjs'
import Tags from 'lucide-react/dist/esm/icons/tags.mjs'
import Thermometer from 'lucide-react/dist/esm/icons/thermometer.mjs'
import { StudyScene } from './StudyScene'
import './study.css'

type StudyView = 'cutaway' | 'thermal' | 'top' | 'root'
type PlaybackSpeed = 0.5 | 1 | 2

const DURATION = 20
const VIEWS = [
  { id: 'cutaway', number: '01', title: 'Soil cutaway', subtitle: 'Beneath the surface', icon: Layers3 },
  { id: 'thermal', number: '02', title: 'Thermal layers', subtitle: 'Follow the cooling zone', icon: Thermometer },
  { id: 'top', number: '03', title: 'Surface view', subtitle: 'See the whole site', icon: Scan },
  { id: 'root', number: '04', title: 'Roots & peat', subtitle: 'A closer look underground', icon: Leaf },
] as const

const PHASES = [
  { start: 0, end: 4, title: 'Source placement', short: 'Place', description: 'A dry-ice sphere descends into the borehole.' },
  { start: 4, end: 8, title: 'Cold-source zone', short: 'Cool', description: 'A cool-colored zone appears around the source.' },
  { start: 8, end: 14, title: 'Transport illustration', short: 'Transport', description: 'Moving tracers reveal an assumed route through the soil.' },
  { start: 14, end: 20, title: 'Partial cooling', short: 'Observe', description: 'Part of the peat changes color while a warm region remains.' },
] as const

const VIEW_NOTES: Record<StudyView, { title: string; description: string; observation: string }> = {
  cutaway: {
    title: 'A window underground',
    description: 'Four soil strata frame a borehole, buried peat and the roots of a living tree.',
    observation: 'Follow the source from the surface to the base of the borehole, then watch the transport illustration unfold.',
  },
  thermal: {
    title: 'See the temperature story',
    description: 'A color overlay makes the cold source and warmer peat easy to distinguish across the soil layers.',
    observation: 'The blue zone expands near the source. Some peat remains warm through the end of the sequence.',
  },
  top: {
    title: 'Put the site in context',
    description: 'Look down over the soil surface to see the spacing between the borehole and the tree.',
    observation: 'Use this view to follow the source location and surface footprint, then switch to the cutaway to look below.',
  },
  root: {
    title: 'Where roots meet peat',
    description: 'Move closer to the buried peat, charred material and the tree’s branching roots.',
    observation: 'The warm peat sits below the soil surface. The sequence illustrates a local response, with a warm region still present.',
  },
}

const STRATA = [
  { letter: 'O', name: 'Organic surface', color: '#79674a' },
  { letter: 'A', name: 'Upper soil', color: '#725139' },
  { letter: 'B', name: 'Subsoil', color: '#96764d' },
  { letter: 'C', name: 'Parent material', color: '#aaa184' },
]

function formatTime(value: number) {
  return `00:${value.toFixed(1).padStart(4, '0')}`
}

export default function StudyWorkspace({ onOpenSimulation }: { onOpenSimulation?: () => void }) {
  const [view, setView] = useState<StudyView>('cutaway')
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [loop, setLoop] = useState(false)
  const [labels, setLabels] = useState(true)
  const [resetToken, setResetToken] = useState(0)
  const timeRef = useRef(0)

  const seek = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(DURATION, next))
    timeRef.current = bounded
    setTime(bounded)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!playing || document.hidden) return
    let frame = 0
    let previous: number | null = null
    const tick = (now: number) => {
      // A stalled frame must not skip a large part of the illustrative sequence.
      const elapsed = previous === null ? 0 : Math.min(0.1, Math.max(0, (now - previous) / 1000))
      previous = now
      let next = timeRef.current + elapsed * speed
      if (next >= DURATION) {
        if (loop) next %= DURATION
        else {
          seek(DURATION)
          setPlaying(false)
          return
        }
      }
      seek(next)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [playing, speed, loop, seek])

  const togglePlayback = () => {
    if (!playing && timeRef.current >= DURATION) seek(0)
    setPlaying((current) => !current)
  }
  const restart = () => {
    seek(0)
    setPlaying(true)
  }
  const activePhase = PHASES.findIndex((phase) => time < phase.end)
  const phaseIndex = activePhase === -1 ? PHASES.length - 1 : activePhase
  const phase = PHASES[phaseIndex]
  const selectedView = VIEWS.find((item) => item.id === view)!
  const notes = VIEW_NOTES[view]
  const progressStyle = { '--study-progress': `${time / DURATION * 100}%` } as CSSProperties

  return <div className="study-shell">
    <header className="study-header">
      <div className="study-brand">
        <div className="study-brand-mark" aria-hidden="true"><Flame size={23} strokeWidth={1.6} /></div>
        <div><strong>ZOMBIE FIRE</strong><span>Soil &amp; suppression study</span></div>
      </div>
      <div className="study-header-actions">
        <span className="study-concept-badge"><span aria-hidden="true" />Interactive illustration</span>
        {onOpenSimulation && <button className="study-simulation-link" onClick={onOpenSimulation} type="button">Open simulation <ArrowUpRight size={15} /></button>}
      </div>
    </header>

    <section className="study-heading" aria-labelledby="study-title">
      <div className="study-heading-copy"><p className="study-eyebrow">Explore the model</p><h1 id="study-title">One landscape. Four perspectives.</h1></div>
      <p className="study-heading-note">Choose a view, then play the story beneath the surface.</p>
    </section>

    <nav className="study-view-nav" aria-label="Study views">
      {VIEWS.map(({ id, number, title, subtitle, icon: Icon }) => <button
        type="button" key={id} className={`study-view-button${view === id ? ' is-selected' : ''}`}
        aria-pressed={view === id} aria-controls="study-scene-panel" onClick={() => setView(id)}
      >
        <span className="study-view-icon"><Icon size={20} strokeWidth={1.6} /></span>
        <span className="study-view-copy"><strong>{title}</strong><small>{subtitle}</small></span>
        <span className="study-view-number">{number}</span>
      </button>)}
    </nav>

    <main className="study-main">
      <section className="study-viewport" id="study-scene-panel" aria-label={`${selectedView.title} interactive 3D view`}>
        <div className="study-viewport-heading">
          <span className="study-view-label"><span className="study-live-dot" aria-hidden="true" />{selectedView.title}</span>
          <div className="study-viewport-actions">
            <button type="button" className={`study-tool-button${labels ? ' is-active' : ''}`} onClick={() => setLabels((current) => !current)} aria-pressed={labels} title="Toggle model labels"><Tags size={15} /><span>Labels</span></button>
            <button type="button" className="study-tool-button study-tool-icon" onClick={() => setResetToken((current) => current + 1)} aria-label="Reset camera to the selected view" title="Reset camera"><Focus size={17} /></button>
          </div>
        </div>
        <div className="study-canvas-wrap"><StudyScene view={view} time={time} labels={labels} resetToken={resetToken} /></div>
        <div className="study-viewport-footer">
          <span><MoveUpRight size={12} /> Drag to orbit <span className="study-hint-divider">/</span> Scroll to zoom</span>
          <span className="study-frame-state">{playing ? 'Playing' : time >= DURATION ? 'Sequence complete' : 'Paused'}<i aria-hidden="true" /></span>
        </div>
      </section>

      <aside className="study-notes" aria-label="View notes">
        <div className="study-note-intro">
          <p className="study-eyebrow">In this view <span>{selectedView.number} / 04</span></p>
          <h2>{notes.title}</h2>
          <p>{notes.description}</p>
        </div>

        {view === 'thermal' ? <section className="study-legend" aria-label="Illustrative thermal colors">
          <h3>Thermal overlay</h3>
          <div className="study-thermal-gradient" aria-hidden="true" />
          <div className="study-thermal-extents"><span>Cold source</span><span>Warm peat</span></div>
          <p className="study-legend-note">Relative colors · no calculated temperatures</p>
        </section> : <section className="study-legend" aria-label="Soil strata">
          <h3>Soil strata</h3>
          <ul className="study-strata-list">{STRATA.map((stratum) => <li key={stratum.letter}><span className="study-stratum-letter" style={{ '--stratum-color': stratum.color } as CSSProperties}>{stratum.letter}</span><span>{stratum.name}</span><i style={{ background: stratum.color }} aria-hidden="true" /></li>)}</ul>
        </section>}

        <section className="study-dimensions" aria-label="Model dimensions">
          <h3>Model dimensions</h3>
          <dl><div><dt>Soil footprint</dt><dd>8 × 8 <span>m</span></dd></div><div><dt>Borehole width</dt><dd>0.75 <span>m</span></dd></div><div><dt>Borehole depth</dt><dd>2.44 <span>m</span></dd></div><div><dt>Dry-ice diameter</dt><dd>0.50 <span>m</span></dd></div></dl>
        </section>

        <div className="study-observation"><span className="study-observation-icon"><Focus size={16} /></span><p>{notes.observation}</p></div>
        <p className="study-disclaimer">Illustrative motion and colors. This playback does not report calculated temperatures or treatment success.</p>
      </aside>
    </main>

    <section className="study-playback" aria-label="Illustrative sequence playback">
      <div className="study-playback-topline">
        <div className="study-current-phase" aria-live="polite" aria-atomic="true"><span className="study-phase-index">0{phaseIndex + 1}</span><div><strong>{phase.title}</strong><p>{phase.description}</p></div></div>
        <span className="study-playback-badge">20-second illustrative sequence</span>
      </div>
      <div className="study-transport">
        <div className="study-play-buttons">
          <button type="button" className="study-play-button" onClick={togglePlayback} aria-label={playing ? 'Pause illustrative playback' : time >= DURATION ? 'Replay illustrative sequence' : 'Play illustrative sequence'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
          <button type="button" className="study-restart-button" onClick={restart} aria-label="Restart illustrative sequence" title="Restart"><RotateCcw size={17} /></button>
        </div>
        <div className="study-timeline">
          <label className="study-sr-only" htmlFor="study-playhead">Illustrative sequence time</label>
          <input id="study-playhead" className="study-playhead" type="range" min="0" max={DURATION} step="0.01" value={time} style={progressStyle}
            aria-valuetext={`${time.toFixed(1)} of ${DURATION} seconds, ${phase.title}`}
            onPointerDown={() => setPlaying(false)} onChange={(event) => { setPlaying(false); seek(Number(event.target.value)) }} />
          <div className="study-phase-markers" aria-hidden="true"><span style={{ left: '20%' }} /><span style={{ left: '40%' }} /><span style={{ left: '70%' }} /></div>
          <div className="study-timeline-labels"><span>00:00</span><span>00:20</span></div>
        </div>
        <output className="study-time" aria-label="Current playback time">{formatTime(time)}<span> / 00:20</span></output>
        <div className="study-playback-options">
          <label className="study-speed"><span className="study-sr-only">Playback speed</span><select aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value) as PlaybackSpeed)}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
          <button type="button" className={`study-loop-button${loop ? ' is-active' : ''}`} aria-pressed={loop} aria-label="Loop illustrative sequence" title="Loop sequence" onClick={() => setLoop((current) => !current)}><Repeat2 size={17} /></button>
        </div>
      </div>
      <div className="study-chapters" aria-label="Sequence chapters">{PHASES.map((item, index) => <button type="button" key={item.start} className={`study-chapter${phaseIndex === index ? ' is-current' : ''}${time >= item.end ? ' is-complete' : ''}`} aria-current={phaseIndex === index ? 'step' : undefined} onClick={() => { setPlaying(false); seek(item.start) }}><span>{time >= item.end ? <Check size={11} /> : `0${index + 1}`}</span><strong>{item.short}</strong><small>{item.start}–{item.end}s</small>{index < PHASES.length - 1 && <ChevronRight size={13} aria-hidden="true" />}</button>)}</div>
      <p className="study-mobile-notice">Illustrative motion and colors · no calculated temperatures or treatment outcome.</p>
    </section>
  </div>
}
