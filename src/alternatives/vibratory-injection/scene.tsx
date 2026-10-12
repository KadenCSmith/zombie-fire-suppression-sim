import type { MethodSceneProps } from '../contract'
import { VibrationEffects } from './vibration-effects'

/** Source-free fallback cues for the coordinator's external original-world host.
 * The owned workspace additionally composes motion of the original world/tool. */
export function MethodCues({ time }: MethodSceneProps) {
  return <VibrationEffects time={time}/>
}
