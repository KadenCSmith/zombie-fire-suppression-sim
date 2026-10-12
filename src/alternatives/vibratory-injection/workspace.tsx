import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { FinderPortal, ToolboxPortal, useCinematicUI } from '../../ui/CinematicUI'
import { advancePresentationTime } from '../../story/firePresentation'
import { VibrationScene } from './vibration-scene'
import { vibrationPose, vibrationStage, VIBRATION_TIMELINE } from './vibration'
import { MethodScience } from './science'
import './workspace.css'

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
export default function VibratoryWorkspace({ onDetails }: { onCompare: () => void; onDetails: () => void }) {
  const { open, panel } = useCinematicUI()
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  const [vibration, setVibration] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [cameraDistance, setCameraDistance] = useState(15.75), [resetToken, setResetToken] = useState(0)
  useEffect(() => { if (panel) setPlaying(false) }, [panel])
  useEffect(() => {
    if (!playing) return
    let request = 0, last = performance.now(), elapsed = 0
    const tick = (now: number) => {
      elapsed += Math.min(.1, (now - last) / 1000); last = now
      if (elapsed >= 1 / 30) { const step = elapsed; elapsed = 0; setTime(t => advancePresentationTime(t, step, 1)) }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [playing])
  useEffect(() => { if (time >= VIBRATION_TIMELINE.end) setPlaying(false) }, [time])
  const pose = vibrationPose(time, vibration)
  return <div className="vib-workspace" data-render-variant="vibratory-injection" data-vibratory-version="3" data-treatment="vibration-only" data-prediction="unavailable">
    <VibrationScene time={time} vibration={vibration} cameraDistance={cameraDistance} resetToken={resetToken}/>
    <header className="vib-heading"><span>4.2.4 / EARTHQUAKE EXTINGUISHER</span><h1>Drill. Shake. Settle.</h1><p>Soil compression & rearrangement.</p></header>
    <div className="vib-status"><i className={pose.amount > 0 ? 'active' : ''}/><span>{!vibration ? 'Original context · vibration off' : pose.amount > 0 ? 'Vibration active' : time >= 74 ? 'Illustrated fire-out' : 'Fire & drilling sequence'}</span><button aria-label="Open earthquake simulation settings" onClick={() => open('toolbox')}><SlidersHorizontal size={17}/></button></div>
    <div className="vib-shortcuts"><button onClick={() => { setVibration(true); setTime(38); setPlaying(true) }}>See vibration ↗</button><label><input type="checkbox" checked={vibration} onChange={e => setVibration(e.target.checked)}/>Show vibration</label></div>
    <aside className="vib-site-key"><span>{vibration ? 'ILLUSTRATIVE MECHANISM' : 'VIBRATION OFF'}</span>{vibration ? <p>Fractures spread<br/>Soil compresses & settles<br/>Embers fade</p> : <p>Original fire & drilling context<br/>No illustrated compression or fire-out</p>}<small>Vibration only · no water.<br/>Suppression is not predicted.</small></aside>
    <footer className="vib-transport"><div className="vib-transport-head"><span>{vibrationStage(time,vibration)}</span><small>{!vibration || time < 27 ? 'Original fire & drilling animation' : 'Illustrative vibration sequence'}</small></div>
      <div className="vib-play-row"><button aria-label={playing ? 'Pause earthquake animation' : 'Play earthquake animation'} onClick={() => { if (time >= 90) setTime(0); setPlaying(p => !p) }}>{playing ? <Pause size={20}/> : <Play size={20}/>}</button><button aria-label="Restart earthquake animation" onClick={() => { setTime(0); setPlaying(false); setResetToken(n => n + 1) }}><RotateCcw size={17}/></button><input aria-label="Earthquake animation time" type="range" min={0} max={90} step={.1} value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)) }}/><span>{number(time)} <small>/ 90 s</small></span></div>
      <div className="vib-bottom-note"><span>Concept illustration · suppression unverified</span><button onClick={() => open('toolbox')}>Model & limits ↗</button></div>
    </footer>
    <ToolboxPortal><section className="vib-tools"><h3>Earthquake Extinguisher · vibration only</h3><p>One continuous original scene follows the fire into the peat and drills the bore. Vibration builds smoothly during drilling, with shaking ground, auger motion and dust. Authored fractures spread, the ground settles and ember colors fade during the proposed compression/rearrangement mechanism. The original world holds at the inserted drill before its unrelated later treatment stages.</p>
      <label className="vib-check"><input type="checkbox" checked={vibration} onChange={e => setVibration(e.target.checked)}/>Show illustrative vibration</label>
      <label>Camera distance<input aria-label="Earthquake camera distance" type="range" min={5} max={19} step={.05} value={cameraDistance} onChange={e => setCameraDistance(Number(e.target.value))}/></label><button onClick={() => setResetToken(n => n + 1)}>Reset camera</button>
      <p>The visible shaking and dust are authored. Forces, mechanical work, cyclic peat response, permeability changes and fire suppression are unavailable for prediction. The illustrated fire-out is requested choreography, not a calculated result.</p>
      <button disabled title="A supported vibration mechanics model is required">Vibration comparison unavailable</button><button onClick={onDetails}>Method details & evidence ↗</button>
    </section></ToolboxPortal>
    <FinderPortal><section className="vib-tools"><MethodScience/></section></FinderPortal>
  </div>
}
