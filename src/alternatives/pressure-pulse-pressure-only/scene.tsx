import { DoubleSide } from 'three'
import type { MethodSceneProps } from '../contract'
import { pressureCueEnvelope, pressureOnlyPresentation } from './model'

/** An abstract transient marker. Soil geometry does not move or collapse and
 * no line/drop/contact marker implies liquid injection. */
export function MethodCues({ id, time }: MethodSceneProps) {
  const p = pressureOnlyPresentation(id, time), envelope = pressureCueEnvelope(time)
  return p.pulse ? <group position={[.4, -1.35, .18]}>
    {[0, 1].map(i => <mesh key={i} scale={1 + i * .75 + envelope * .45}>
      <ringGeometry args={[.27, .29, 48]}/>
      <meshBasicMaterial color="#c3b992" transparent opacity={envelope * (.5 - i * .15)} side={DoubleSide}/>
    </mesh>)}
  </group> : null
}
