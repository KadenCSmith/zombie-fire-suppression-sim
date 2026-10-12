import { Line } from '@react-three/drei/core/Line.js'
import type { StoryPoint } from '../../story/fireSequence'
import { eased, pointAlongStoryPath } from '../../story/fireSequence'
import { vibrationPose } from './vibration'

/** Requested fracture/rearrangement narrative; no failure criterion or material
 * composition is calculated. These paths are authored display geometry. */
const cracks: StoryPoint[][] = [
  [[.4,-1.3,.08],[.77,-1.13,.08],[1.18,-1.28,.08],[1.48,-.96,.08],[2.05,-1.07,.08]],
  [[.4,-1.3,.08],[.03,-1.46,.08],[-.42,-1.35,.08],[-.84,-1.62,.08],[-1.49,-1.49,.08]],
  [[.4,-1.3,.08],[.63,-1.65,.08],[.38,-1.89,.08],[.75,-2.18,.08],[.91,-2.65,.08]],
  [[.4,-1.3,.08],[.17,-.91,.08],[.39,-.62,.08],[.12,-.31,.08],[.23,-.02,.08]],
  [[1.18,-1.28,.08],[1.49,-1.62,.08],[1.83,-1.56,.08],[2.24,-1.89,.08]],
  [[-.42,-1.35,.08],[-.64,-.99,.08],[-1.05,-.81,.08],[-1.15,-.39,.08]],
  [[.23,.015,.02],[-.13,.015,-.25],[-.40,.015,-.19],[-.73,.015,-.61],[-1.19,.015,-.76]],
  [[.55,.015,-.06],[.89,.015,-.38],[1.23,.015,-.24],[1.65,.015,-.54],[2.10,.015,-.73]],
]
export function fracturePathAt(path: StoryPoint[], progress: number) {
  const lengths = path.slice(1).map((p, i) => Math.hypot(...p.map((v, k) => v - path[i][k])))
  const target = Math.max(0, Math.min(1, progress)) * lengths.reduce((a, b) => a + b, 0)
  const shown = [path[0]]
  let distance = 0
  for (let i = 0; i < lengths.length; i++) {
    if (distance + lengths[i] >= target) break
    shown.push(path[i + 1]); distance += lengths[i]
  }
  return [...shown, pointAlongStoryPath(path, Math.max(0, Math.min(1, progress)))]
}
export function CompactionEffects({ time, enabled = true }: { time: number; enabled?: boolean }) {
  const pose = vibrationPose(time, enabled)
  return <group position={pose.surfacePosition} scale={pose.groundScale} rotation={[0, 0, pose.groundTilt]} userData={{ role: 'illustrative fractures, compression and soil rearrangement; not predicted damage' }}>
    {cracks.map((path, i) => {
      const progress = enabled ? eased(pose.time, 33 + i * .6, 42 + i * .6) : 0
      if (progress === 0) return null
      const shown = fracturePathAt(path, progress)
      return <Line key={i} points={shown} color="#100d08" lineWidth={.7 + 2.7 * pose.fracture * (1 - pose.compression * .75)} transparent opacity={.85}/>
    })}
  </group>
}
