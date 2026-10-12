import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { variant, type VariantId } from '../alternatives/registry'
import { AlternativeScene } from './AlternativeScene'
import { FinderPortal, ToolboxPortal, useCinematicUI } from './CinematicUI'
import './alternatives.css'

/** Latest authored method preview. Physical computations remain in Compare Alternatives. */
export default function AlternativeRenderWorkspace({ id, onCompare, onDetails }: { id: VariantId; onCompare: () => void; onDetails: () => void }) {
  const v = variant(id), { panel, open } = useCinematicUI()
  const hero = useRef<HTMLDivElement>(null), entered = useRef(false)
  const [progress, setProgress] = useState(0), [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  const [resetToken, setResetToken] = useState(0), [cameraDistance, setCameraDistance] = useState(15.75)
  useEffect(() => {
    let request = 0
    const scroll = () => {
      if (request) return
      request = requestAnimationFrame(() => {
        request = 0
        const el = hero.current
        if (!el) return
        const p = Math.max(0, Math.min(1, -el.getBoundingClientRect().top / Math.max(1, el.offsetHeight - innerHeight)))
        setProgress(p)
        if (p >= .995 && !entered.current) { entered.current = true; if (id !== 'nanoparticles') setPlaying(true) }
      })
    }
    scroll(); window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll)
    return () => { cancelAnimationFrame(request); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll) }
  }, [id])
  useEffect(() => { if (panel) setPlaying(false) }, [panel])
  useEffect(() => {
    if (!playing) return
    let request = 0, last = performance.now(), elapsed = 0
    const tick = (now: number) => {
      elapsed += Math.min(.2, (now - last) / 1000); last = now
      if (elapsed >= 1 / 30) { const step = elapsed; elapsed = 0; setTime(t => Math.min(90, t + step)) }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [playing])
  useEffect(() => { if (time >= 90) setPlaying(false) }, [time])
  const stage = Math.min(v.stages.length - 1, Math.floor(time / 90 * v.stages.length))
  return <div className="fire-sequence-shell cinematic-sequence method-render" data-render-variant={id}>
    <div ref={hero} className="cinematic-hero-scroll" style={{ '--scroll-progress': progress } as CSSProperties}>
      <main className="cinematic-hero-sticky" aria-label={`${v.number} ${v.label} latest render`}>
        <div className="cinematic-render"><AlternativeScene id={id} time={time} resetToken={resetToken} cameraDistance={cameraDistance}/></div>
        <div className="method-render-caption"><span>{v.number} · LATEST RENDER · ILLUSTRATIVE</span><h1>{v.label}</h1><p>{v.id === 'nanoparticles' ? 'TBD / mechanism unspecified. Context only; execution unavailable.' : v.subtitle}</p></div>
        <div className="cinematic-scroll-hint" style={{opacity:1-progress}}><span>SCROLL TO ENTER THE SIMULATION</span><span>↓</span></div>
        <div className="cinematic-scene-meta" style={{opacity:progress}}><span>{v.stages[stage]}</span><span>Presentation time · no predicted pressure, penetration or suppression</span></div>
        <div className="cinematic-transport" style={{transform:`translateY(${(1-progress)*105}%)`,opacity:progress}} inert={progress<.1} aria-label="Method render playback">
          <button disabled={id==='nanoparticles'} aria-label={playing?'Pause method render':'Play method render'} onClick={()=>{if(time>=90)setTime(0);setPlaying(p=>!p)}}>{playing?<Pause size={20}/>:<Play size={20}/>}</button>
          <button aria-label="Restart method render" onClick={()=>{setTime(0);setPlaying(false)}}><RotateCcw size={19}/></button>
          <div className="cinematic-timeline"><div><span>{v.stages[stage]}</span><strong>{time.toFixed(1)} <small>/ 90 s presentation</small></strong></div><input aria-label="Method render time" type="range" min={0} max={90} step={.1} value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value))}}/></div>
          <button aria-label="Open method render controls" onClick={()=>open('toolbox')}>↗</button>
        </div>
      </main>
    </div>
    <ToolboxPortal><div className="method-render-tools"><h3>{v.number} {v.label}</h3><p>{v.limitation}</p><p>The ring, drill vibration and blue contact markers are authored cues. They do not change the peat, temperature, oxygen, permeability or any solver state.</p><button onClick={onCompare}>Compare supported components ↗</button><button onClick={onDetails}>Method details & equations ↗</button><button onClick={()=>setResetToken(n=>n+1)}>Reset camera</button><label>Camera distance <input aria-label="Method camera distance" type="range" min={5} max={19} step={.05} value={cameraDistance} onChange={e=>setCameraDistance(Number(e.target.value))}/></label></div></ToolboxPortal>
    <FinderPortal><section className="method-render-tools"><h3>{v.number} {v.label}</h3><p>{v.limitation}</p><p>Illustrative: method stages. Modeled components: {v.status.modeled}. Experimentally validated: no.</p><button onClick={onDetails}>Read mathematics & evidence ↗</button></section></FinderPortal>
  </div>
}
