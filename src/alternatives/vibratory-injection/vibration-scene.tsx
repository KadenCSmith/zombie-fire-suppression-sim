import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import { FireSequenceScene } from '../../ui/FireSequenceScene'
import { SequenceExcavator } from '../../ui/FireSequenceEquipment'
import { VibrationEffects } from './vibration-effects'
import { vibrationPose } from './vibration'
import { CompactionEffects } from './compaction-effects'
import { COMPACTION_GROUPS, CompactionPass } from './compaction-pass'

export interface VibrationSceneProps { time: number; vibration: boolean; cameraDistance: number; resetToken: number }
/** External composition of the preservation-locked, hook-free Canvas factory.
 * Keep its ground, materials, fire, drill and camera. One hidden same-geometry
 * fire-off reference supports the authored fade; no second Canvas/world,
 * shader patch, numerical field or treatment source is introduced. */
export function composeVibrationScene({ time, vibration, cameraDistance, resetToken }: VibrationSceneProps) {
  const pose = vibrationPose(time, vibration)
  const original = FireSequenceScene({ time: pose.contextTime, mode: 'rapid', view: 'natural', layers: { fire: true, gas: false, water: false, anatomy: true }, resetToken, realistic: true, straightBore: true, cinematic: true, connectedSupply: true, cameraDistance })
  const children = Children.map(original.props.children as ReactNode, child => {
    if (!isValidElement(child)) return child
    const props = child.props as Record<string, unknown>
    if (typeof props.fire === 'boolean' && typeof props.water === 'boolean') return <group key="vibration-ground" position={pose.surfacePosition} scale={pose.groundScale} rotation={[0, 0, pose.groundTilt]}>
      <group name={COMPACTION_GROUPS.burning}>{child}</group>
      <group name={COMPACTION_GROUPS.settled} visible={false}>{cloneElement(child as ReactElement<{fire:boolean}>, {fire:false})}</group>
    </group>
    if (child.type !== Fragment) return child
    const context = child as ReactElement<{ children: ReactNode }>
    const fireOnly: ReactNode[] = []
    const world = Children.map(context.props.children, item => {
      if (!isValidElement(item)) return item
      if (item.type === SequenceExcavator) return <group key="vibration-tool" position={pose.toolPosition}>{item}</group>
      if (typeof (item.props as Record<string,unknown>).visible === 'boolean') { fireOnly.push(item); return null }
      // Let inherited drilling cuttings finish instead of freezing airborne grains.
      if ('layers' in (item.props as object)) return cloneElement(item as ReactElement<{time:number}>, {time:Math.min(pose.time,34)})
      return item
    })
    return <group key="vibration-context" position={pose.surfacePosition} rotation={[0, 0, pose.groundTilt]}>{cloneElement(context, undefined, world, <group key="fire-only" name={COMPACTION_GROUPS.fireOnly}>{Children.toArray(fireOnly)}</group>)}</group>
  })
  return cloneElement(original, undefined, children, <VibrationEffects key="vibration-effects" time={pose.time} enabled={vibration}/>, <CompactionEffects key="compaction-effects" time={pose.time} enabled={vibration}/>, <CompactionPass key="compaction-pass" progress={pose.emberFade}/>)
}
export function VibrationScene(props: VibrationSceneProps) {
  return <div className="vib-scene" data-original-context-time={vibrationPose(props.time).contextTime} data-scene-continuity="single-original-canvas" data-treatment="vibration-only">{composeVibrationScene(props)}</div>
}
