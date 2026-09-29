import { useEffect, useMemo, useRef, useState } from 'react'
import Pause from 'lucide-react/dist/esm/icons/pause.mjs'
import Play from 'lucide-react/dist/esm/icons/play.mjs'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.mjs'
import { storyToPlayback, type FireSourceMode } from '../story/fireSequence'
import { FireSequenceScene, type FireSequenceLayers } from './FireSequenceScene'
import { ModelSelector, type PhysicsWorkspace } from './ModelSelector'
import { StudyScene } from './StudyScene'
import { DEFAULT_STUDY_CAGE } from './studyModel'
import { SOIL_PARTICLE_DEFAULTS } from './soilParticleModel'
import { alignedTime, availableVersions, SIMULATION_CATALOG, type SimulationVersion } from './simulationCatalog'
import './simulation-comparison.css'

const FIRE_LAYERS: FireSequenceLayers = { fire: true, gas: true, water: true, anatomy: true }
const DEFAULT_SELECTION = ['0.8.0', '0.9.0']

function ArchivedFilm({ version, mode, timeS }: { version: SimulationVersion; mode: FireSourceMode; timeS: number }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || video.readyState < 1) return
    const target = storyToPlayback(timeS)
    if (Math.abs(video.currentTime - target) > 0.035) video.currentTime = target
  }, [timeS, mode])
  const seek = () => { if (ref.current) ref.current.currentTime = storyToPlayback(timeS) }
  return <video ref={ref} className="comparison-film" muted playsInline preload="metadata" onLoadedMetadata={seek}
    src={`${import.meta.env.BASE_URL}${version.assetBase}/peat-fire-${mode}.mp4`} aria-label={`Version ${version.id} ${mode} film`} />
}

function Replay({ version, timeS, mode }: { version: SimulationVersion; timeS: number; mode: FireSourceMode }) {
  if (version.replay === 'study-scene') return <StudyScene view="cutaway" time={timeS} labels={false} cage={DEFAULT_STUDY_CAGE} resetToken={0} version={version.id === '0.8.0' ? 'fracture' : 'rupture'} soilOptions={SOIL_PARTICLE_DEFAULTS} />
  if (version.replay === 'film') return <ArchivedFilm version={version} mode={mode} timeS={timeS} />
  if (version.replay === 'fire-scene') return <FireSequenceScene time={timeS} mode={mode} view="natural" layers={FIRE_LAYERS} resetToken={0} />
  return null
}

export default function SimulationComparisonWorkspace({ onWorkspace }: { onWorkspace: (workspace: PhysicsWorkspace) => void }) {
  const available = useMemo(availableVersions, [])
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION)
  const [referenceId, setReferenceId] = useState(DEFAULT_SELECTION[0])
  const [referenceTime, setReferenceTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [mode, setMode] = useState<FireSourceMode>('gradual')
  const timeRef = useRef(referenceTime)
  useEffect(() => { timeRef.current = referenceTime }, [referenceTime])
  const reference = SIMULATION_CATALOG.find(version => version.id === referenceId && version.available) ?? available[0]
  const selectedVersions = available.filter(version => selected.includes(version.id))

  useEffect(() => {
    if (!selected.includes(referenceId)) setReferenceId(selected[0] ?? available[0].id)
  }, [selected, referenceId, available])
  useEffect(() => {
    if (!playing || !reference.durationS) return
    let request = 0, last = performance.now()
    const tick = (now: number) => {
      const next = Math.min(reference.durationS!, timeRef.current + Math.min(0.2, (now - last) / 1000) * speed)
      last = now; timeRef.current = next; setReferenceTime(next)
      if (next >= reference.durationS!) { setPlaying(false); return }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [playing, speed, reference.id, reference.durationS])

  const toggle = (version: SimulationVersion) => {
    if (!version.available) return
    setSelected(current => current.includes(version.id) ? current.filter(id => id !== version.id) : [...current, version.id])
  }
  const seek = (next: number) => { setPlaying(false); timeRef.current = next; setReferenceTime(next) }
  const referenceDuration = reference.durationS ?? 1

  return <div className="comparison-shell">
    <header className="comparison-header">
      <div><span>VERSION LAB · 0.8 AND ABOVE</span><h1>Run preserved simulations together</h1><p>One presentation clock coordinates selected replays. Recorded event markers align compatible versions; unlike timelines use a labeled duration-normalized fallback.</p></div>
      <ModelSelector value="comparison" onChange={onWorkspace} />
    </header>
    <section className="comparison-controls" aria-label="Shared comparison controls">
      <button type="button" className="comparison-play" onClick={() => { if (referenceTime >= referenceDuration) seek(0); setPlaying(value => !value) }} aria-label={playing ? 'Pause all selected simulations' : 'Play all selected simulations'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
      <button type="button" className="comparison-reset" onClick={() => seek(0)} aria-label="Reset all selected simulations"><RotateCcw size={17} /></button>
      <label className="comparison-timeline"><span>SHARED PRESENTATION CLOCK · reference v{reference.id}</span><strong>{referenceTime.toFixed(1)} / {referenceDuration.toFixed(1)} s</strong><input type="range" aria-label="Shared comparison time" min={0} max={referenceDuration} step={.05} value={referenceTime} onChange={event => seek(Number(event.target.value))} /></label>
      <label><span>REFERENCE</span><select aria-label="Comparison reference version" value={reference.id} onChange={event => { setReferenceId(event.target.value); seek(0) }}>{selectedVersions.map(version => <option key={version.id} value={version.id}>v{version.id}</option>)}</select></label>
      <label><span>PLAYBACK</span><select aria-label="Comparison playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[.5, 1, 2, 3].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
      <div className="comparison-mode"><span>FIRE REPLAY</span>{(['gradual', 'rapid'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{value}</button>)}</div>
    </section>
    <div className="comparison-body">
      <aside className="comparison-catalog" aria-label="Simulation versions">
        <h2>Available history</h2><p>Select any combination with a preserved replay. Missing replay bundles stay listed and cannot be selected.</p>
        {SIMULATION_CATALOG.map(version => <label key={version.id} className={!version.available ? 'is-unavailable' : ''} title={version.limitation}>
          <input type="checkbox" aria-label={`Select version ${version.id}`} checked={selected.includes(version.id)} disabled={!version.available} onChange={() => toggle(version)} />
          <span><strong>v{version.id}</strong><small>{version.title}</small></span><em>{version.available ? 'READY' : 'UNAVAILABLE'}</em>
        </label>)}
      </aside>
      <main className="comparison-stage">
        {!selectedVersions.length && <div className="comparison-empty"><strong>Select at least one preserved simulation.</strong><p>Versions without replay assets remain documented in the catalog.</p></div>}
        <div className="comparison-grid" data-selected-count={selectedVersions.length}>{selectedVersions.map(version => {
          const sync = alignedTime(reference, version, referenceTime)
          return <article className="comparison-card" key={version.id} data-version={version.id}>
            <header><div><span>v{version.id}</span><h2>{version.title}</h2></div><strong>ANIMATION MODE</strong></header>
            <div className="comparison-replay"><Replay version={version} timeS={sync.timeS} mode={mode} /></div>
            <footer><dl><div><dt>Presentation time</dt><dd>{sync.timeS.toFixed(2)} s · {speed}×</dd></div><div><dt>Physical simulation time</dt><dd>Unavailable · animation replay</dd></div><div><dt>Synchronization</dt><dd>{sync.method === 'recorded-events' ? 'Recorded event alignment' : 'Duration-normalized fallback'}</dd></div></dl><p>{version.limitation}</p></footer>
          </article>
        })}</div>
      </main>
    </div>
  </div>
}
