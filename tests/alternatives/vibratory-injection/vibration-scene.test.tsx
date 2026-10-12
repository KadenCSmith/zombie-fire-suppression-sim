import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { describe, expect, it } from 'vitest'
import { FireSequenceScene } from '../../../src/ui/FireSequenceScene'
import { FireWaterTruck } from '../../../src/ui/FireWaterTruck'
import { SequenceExcavator } from '../../../src/ui/FireSequenceEquipment'
import { fireSequencePose } from '../../../src/story/fireSequence'
import { composeVibrationScene } from '../../../src/alternatives/vibratory-injection/vibration-scene'
import { vibrationPose } from '../../../src/alternatives/vibratory-injection/vibration'
import { COMPACTION_GROUPS } from '../../../src/alternatives/vibratory-injection/compaction-pass'

type Element=ReactElement<Record<string,unknown>>
function elements(node:ReactNode):Element[]{
  const out:Element[]=[]
  Children.forEach(node,child=>{if(isValidElement(child)){const element=child as Element;out.push(element);out.push(...elements(element.props.children as ReactNode))}})
  return out
}
const options={vibration:true,cameraDistance:15.75,resetToken:0}
describe('continuous original vibration scene',()=>{
  it('retains one original Canvas/world and a hidden same-geometry fire-off reference through both boundaries',()=>{
    for(const time of [0,18,23.9,24,25,26,27,31,33,38,74,90,25]){
      const scene=composeVibrationScene({...options,time}),all=elements(scene)
      const contextTime=Math.min(time,33)
      const original=FireSequenceScene({time:contextTime,mode:'rapid',view:'natural',layers:{fire:true,gas:false,water:false,anatomy:true},resetToken:0,realistic:true,straightBore:true,cinematic:true,connectedSupply:true,cameraDistance:15.75})
      const {children:_actual,...actualProps}=scene.props,{children:_expected,...expectedProps}=original.props
      expect(all.filter(e=>e.type===Canvas)).toHaveLength(1)
      expect(actualProps).toEqual(expectedProps)
      const ground=all.filter(e=>typeof e.props.fire==='boolean'&&typeof e.props.water==='boolean')
      const originalGround=elements(original).find(e=>typeof e.props.fire==='boolean')!
      expect(ground).toHaveLength(2)
      expect(ground[0].type).toBe(originalGround.type)
      expect(ground[0].props).toEqual(originalGround.props)
      expect(ground[1].type).toBe(originalGround.type)
      expect(ground[1].props).toEqual({...originalGround.props,fire:false})
      expect(all.find(e=>e.props.name===COMPACTION_GROUPS.settled)?.props.visible).toBe(false)
      expect(all.filter(e=>e.type===SequenceExcavator)).toHaveLength(1)
      expect(all.filter(e=>e.type===FireWaterTruck)).toHaveLength(0)
      expect(ground[0].props.fire).toBe(true)
      expect(ground[0].props.water).toBe(false)
      expect(fireSequencePose(contextTime,'rapid')).toMatchObject({sourceVisible:false,capVisible:false,gas:0,water:0})
    }
  })
  it('keeps camera and lighting outside the shaking world with stable component identity/keys',()=>{
    const before=composeVibrationScene({...options,time:25}),after=composeVibrationScene({...options,time:45})
    const top=(scene:typeof before)=>Children.toArray(scene.props.children).filter(isValidElement) as Element[]
    const a=top(before),b=top(after)
    expect(a.map(e=>[e.type,e.key])).toEqual(b.map(e=>[e.type,e.key]))
    const camera=a.find(e=>'resetToken' in e.props)!,cameraAfter=b.find(e=>'resetToken' in e.props)!
    expect(camera.props).toMatchObject({resetToken:0,distance:15.75})
    expect(cameraAfter.type).toBe(camera.type)
    expect(cameraAfter.props).toEqual(camera.props)
    expect(a.filter(e=>e.type==='ambientLight'||e.type==='hemisphereLight'||e.type==='directionalLight')).toHaveLength(3)
    expect(b.filter(e=>e.type==='ambientLight'||e.type==='hemisphereLight'||e.type==='directionalLight').map(e=>e.props)).toEqual(a.filter(e=>e.type==='ambientLight'||e.type==='hemisphereLight'||e.type==='directionalLight').map(e=>e.props))
  })
  it('starts/stops continuously and disabling vibration leaves the original context unchanged',()=>{
    for(const time of [0,26.9,27,33,68,74,90]){
      const on=vibrationPose(time),off=vibrationPose(time,false)
      expect(off.amount).toBe(0);expect(Math.hypot(...off.groundPosition)).toBe(0)
      expect(off.contextTime).toBe(on.contextTime)
    }
    for(const boundary of [27,33,68,74]){
      const a=vibrationPose(boundary-1e-6),b=vibrationPose(boundary+1e-6)
      expect(Math.abs(a.amount-b.amount)).toBeLessThan(1e-6)
      expect(Math.hypot(...a.groundPosition.map((v,i)=>v-b.groundPosition[i]))).toBeLessThan(1e-5)
    }
    const at=vibrationPose(38);vibrationPose(90);vibrationPose(0)
    expect(vibrationPose(38)).toEqual(at)
  })
})
