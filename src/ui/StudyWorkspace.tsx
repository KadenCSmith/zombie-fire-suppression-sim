import { ModelSelector, type PhysicsWorkspace } from './ModelSelector'
import { ParameterSlider } from './ParameterSlider'
import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
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
import { SOIL_PARTICLE_DEFAULTS } from './soilParticleModel'
import { StudyVersions } from './StudyVersions'
import { DEFAULT_STUDY_CAGE, STUDY_DURATION, STUDY_PHASES, STUDY_RELEASE_TIME, ORIGINAL_STUDY_PHASES, FRACTURE_STUDY_PHASES, STUDY_VERSIONS, type StudyVersion } from './studyModel'

type StudyView = 'cutaway' | 'thermal' | 'top' | 'root'
type PlaybackSpeed = 0.5 | 1 | 2

const DURATION = STUDY_DURATION
const VIEWS = [
  { id: 'cutaway', number: '01', title: 'Soil cutaway', subtitle: 'Beneath the surface', icon: Layers3 },
  { id: 'thermal', number: '02', title: 'Thermal illustration', subtitle: 'Qualitative colors only', icon: Thermometer },
  { id: 'top', number: '03', title: 'Surface view', subtitle: 'See the whole site', icon: Scan },
  { id: 'root', number: '04', title: 'Roots & peat', subtitle: 'A closer look underground', icon: Leaf },
] as const


const VIEW_NOTES: Record<StudyView, { title: string; description: string; observation: string }> = {
  cutaway: {
    title: 'A window underground',
    description: 'Four soil strata frame a borehole, buried peat and the roots of a living tree.',
    observation: 'Follow the source from the surface to the base of the borehole, wait five seconds, then watch the release move soil and rock fragments.',
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

export interface StudySession { view: StudyView; time: number; speed: PlaybackSpeed; labels: boolean; loop: boolean; cage: typeof DEFAULT_STUDY_CAGE; launchSpeed: number; soilOptions: typeof SOIL_PARTICLE_DEFAULTS }

export default function StudyWorkspace({ version = 'rupture', onVersionChange, onWorkspace, session }: { onOpenSimulation?: () => void; version?: StudyVersion; onVersionChange: (version: StudyVersion) => void; onWorkspace: (value: PhysicsWorkspace) => void; session: MutableRefObject<StudySession | undefined> }) {
  const saved = session.current
  const PHASES = version === 'original' ? ORIGINAL_STUDY_PHASES : (version === 'fracture' || version === 'rupture') ? FRACTURE_STUDY_PHASES : STUDY_PHASES
  const [launchSpeed, setLaunchSpeed] = useState(saved?.launchSpeed ?? 2.8)
  const [soilOptions, setSoilOptions] = useState(saved?.soilOptions ?? { ...SOIL_PARTICLE_DEFAULTS })
  const [view, setView] = useState<StudyView>(saved?.view ?? 'cutaway')
  const [time, setTime] = useState(saved?.time ?? 0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(saved?.speed ?? 1)
  const [loop, setLoop] = useState(saved?.loop ?? false)
  const [labels, setLabels] = useState(saved?.labels ?? true)
  const [resetToken, setResetToken] = useState(0)
  const timeRef = useRef(saved?.time ?? 0)
  const [cage, setCage] = useState(saved?.cage ?? { ...DEFAULT_STUDY_CAGE })

  useEffect(() => { session.current = { view,time,speed,labels,loop,cage,launchSpeed,soilOptions } }, [view,time,speed,labels,loop,cage,launchSpeed,soilOptions,session])

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

  const selectVersion = (next: StudyVersion) => { setPlaying(false); seek(0); onVersionChange(next) }

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
        <span className="study-concept-badge"><span aria-hidden="true" />{STUDY_VERSIONS.find(item => item.id === version)?.title}</span>
        <ModelSelector value="study" onChange={onWorkspace} />
        <StudyVersions version={version} onSelect={selectVersion} />
      </div>
    </header>

    <section className="study-heading" aria-labelledby="study-title">
      <div className="study-heading-copy"><p className="study-eyebrow">Rendering view / demonstration</p><h1 id="study-title">Terrain & subsurface operations.</h1></div>
      <p className="study-heading-note">Fast demonstration · prescribed load and staged fire. Physical field calculations are in the model selector.</p>
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
        <div className="study-canvas-wrap"><StudyScene view={view} time={time} labels={labels} cage={cage} resetToken={resetToken} version={version} launchSpeed={launchSpeed} soilOptions={soilOptions} /></div>
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

        {version !== 'original' && version !== 'fracture' && version !== 'rupture' && <section className="study-cage-controls" aria-label="Cage illustration settings">
          <h3>Inverted cage</h3>
          <label className="study-cage-toggle"><input type="checkbox" checked={cage.enabled} onChange={event => setCage(old => ({ ...old, enabled: event.target.checked }))} />Cover the crater opening</label>
          <div><label htmlFor="study-cage-height">Height</label><input id="study-cage-height" type="number" min="1" max="100" step="1" value={Math.round(cage.heightM * 100)} onChange={event => { const value = Number(event.target.value); if (value >= 1 && value <= 100) setCage(old => ({ ...old, heightM: value / 100 })) }} /><span>cm</span></div>
          <div><label htmlFor="study-cage-width">Width</label><input id="study-cage-width" type="number" min="10" max="200" step="5" value={Math.round(cage.widthM * 100)} onChange={event => { const value = Number(event.target.value); if (value >= 10 && value <= 200) setCage(old => ({ ...old, widthM: value / 100 })) }} /><span>cm</span></div>
          <p>{version === 'dynamics' ? 'Open underneath. Simplified particle contacts with rigid bars; cage strength and deformation are not modeled.' : 'Open underneath. Placed after landing. Containment and bar collisions are not calculated.'}</p>
        </section>}

        {(version === 'fracture' || version === 'rupture') && <section className="study-cage-controls" aria-label="Bonded particle scenario">
          <h3>{version === 'rupture' ? 'Ground opening & broad peat fire' : 'Cap & bonded soil'}</h3>
          <p>{version === 'rupture' ? 'Irregular soil pieces separate and lift under a broader assumed load. A wide buried peat bed has an unburnt margin and a narrow staged fire path to the surface. The oak has uneven lateral and deep branching roots. Fire growth is illustrative; CO₂ does not ignite or feed the fire.' : <>A 70 cm concave cap falls onto the source. Its rim stays seated; the center flexes under an assumed load. The peat lens is centered 1.65 m deep with an unburnt surround. A young bur oak has spreading lateral roots and descending roots to 2.7 m; their dimensions are illustrative.</>}</p>
          <ParameterSlider label="Assumed pressure load" value={soilOptions.pressurePa / 1000} min={0} max={30} step={1} unit="kPa" defaultValue={18} note="Prescribed footprint; edits restart playback" onChange={value => { setPlaying(false); seek(0); setSoilOptions(old => ({ ...old, pressurePa: value * 1000 })) }} />
          <p>Mineral bulk density: 1050 kg/m³ at the surface, increasing by 220 kg/m³ per meter. Peat: 300 kg/m³. These scenario assumptions do not establish a universal depth profile.</p>
          <p>{version === 'rupture' ? 'A weaker, more broadly loaded 2D soil scenario. Irregular display pieces expose gaps using the calculated motion and damage; their crack shapes are illustrative.' : 'Calculated spring-bond separation and surface uplift in a 2D section.'} The load spreads laterally and upward by prescription; gas flow and fracture direction are not predicted.</p>
        </section>}
        {version === 'dynamics' && <section className="study-cage-controls" aria-label="Debris dynamics assumptions">
          <h3>Calculated debris motion</h3>
          <p>Gravity · air resistance · bounce · friction · cage contacts</p>
          <div><label htmlFor="debris-launch-speed">Assumed release speed</label><input id="debris-launch-speed" type="number" min="0" max="5" step="0.2" value={launchSpeed} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0 && value <= 5) { setPlaying(false); seek(0); setLaunchSpeed(value) } }} /><span>m/s</span></div>
          <p>Gravity 9.80665 m/s². Assumed debris density 1800 kg/m³, drag coefficient 0.8, rebound 0.22 and friction 0.6. Exposed debris settles onto simplified ground planes. Gas pressure does not set the release speed.</p>
        </section>}
        <div className="study-observation"><span className="study-observation-icon"><Focus size={16} /></span><p>{version === 'rupture' ? 'Watch the ground open across the section. The staged peat fire spreads below ground and reaches a small surface outlet.' : version === 'original' ? 'Original cooling and transport study, preserved for comparison. The source remains visible.' : notes.observation}</p></div>
        <p className="study-disclaimer">{(version === 'fracture' || version === 'rupture') ? 'Assumed restrained cap and lateral/upward pressure footprint. Particle bonds break under tension. No validated fracture, shell strength or gas containment prediction.' : version === 'dynamics' ? 'Calculated particle translation with assumed release. The source is held, then falls under gravity before landing at 4 s. Gas and thermal colors remain illustrative; no pressure, fracture or containment prediction.' : version === 'original' ? 'Earlier authored cooling and transport. No calculated temperature or treatment outcome.' : 'Earlier staged conversion and fragment motion. Gas tracers are illustrative; no pressure or fracture prediction.'}</p>
      </aside>
    </main>

    <section className="study-playback" aria-label="Illustrative sequence playback">
      <div className="study-playback-topline">
        <div className="study-current-phase" aria-live="polite" aria-atomic="true"><span className="study-phase-index">0{phaseIndex + 1}</span><div><strong>{phase.title}</strong><p>{phase.description}</p></div></div>
        <span className="study-playback-badge">{version === 'original' ? 'Original 0.5 sequence' : <>Release at {STUDY_RELEASE_TIME} s · 5 s after landing</>}</span>
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
          <div className="study-phase-markers" aria-hidden="true">{PHASES.slice(1).map(item => <span key={item.start} style={{ left: `${item.start / DURATION * 100}%` }} />)}</div>
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
