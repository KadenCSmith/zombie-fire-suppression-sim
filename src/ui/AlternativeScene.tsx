import { Canvas } from '@react-three/fiber'
import { AlternativeMethodCues } from './AlternativeMethodModules'
import { FireSequenceScene } from './FireSequenceScene'
import { methodPresentation } from '../alternatives/presentation'
import type { VariantId } from '../alternatives/registry'

/** Compose the original read-only fire/drilling animation with a separate
 * method diagram. No copied fire/equipment animation or original mutation. */
export function AlternativeScene({id,time,resetToken,cameraDistance}:{id:VariantId;time:number;resetToken:number;cameraDistance:number}) {
  const contextTime = Math.max(0, Math.min(36, methodPresentation(id,time).contextTime))
  return <div className="alternative-scene-composition" data-original-animation="fire-spread-and-drilling" data-original-context-time={contextTime}>
    <FireSequenceScene time={contextTime} mode="rapid" view="natural" layers={{fire:true,gas:false,water:false,anatomy:true}} resetToken={resetToken} realistic straightBore cinematic connectedSupply cameraDistance={cameraDistance}/>
    {id !== 'nanoparticles' && <aside className="alternative-method-diagram" aria-label="Separate illustrative method diagram">
      <span>METHOD DIAGRAM · ILLUSTRATIVE</span>
      <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[0,1,5],fov:38,near:.05,far:60}}>
        <ambientLight intensity={1.3}/><directionalLight position={[-3,6,5]} intensity={2}/>
        <AlternativeMethodCues id={id} time={time}/>
      </Canvas>
      <small>Original fire & drilling above · no calculated field response</small>
    </aside>}
  </div>
}
