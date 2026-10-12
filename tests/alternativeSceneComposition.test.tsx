import { describe, expect, it } from 'vitest'
import { Canvas } from '@react-three/fiber'
import { AlternativeScene } from '../src/ui/AlternativeScene'
import { FireSequenceScene } from '../src/ui/FireSequenceScene'
import { AlternativeMethodCues } from '../src/ui/AlternativeMethodModules'

describe('external original-scene composition', () => {
  it('retains the original Canvas props and authored children, adding world objects in the same scene', () => {
    const composed = AlternativeScene({id:'pressure-only',time:65,resetToken:7,cameraDistance:12})
    const scene = composed.props.children
    const baseline = FireSequenceScene({time:38,mode:'rapid',view:'natural',layers:{fire:true,gas:false,water:false,anatomy:true},resetToken:7,realistic:true,straightBore:true,cinematic:true,connectedSupply:true,cameraDistance:12})
    expect(scene.type).toBe(Canvas)
    const {children:actualChildren,...actualProps} = scene.props
    const {children:originalChildren,...originalProps} = baseline.props
    expect(actualProps).toEqual(originalProps)
    expect(actualChildren[0]).toEqual(originalChildren)
    expect(actualChildren[1].type).toBe('group')
    expect(actualChildren[1].props.position).toBeUndefined()
    expect(actualChildren[1].props.children.type).toBe(AlternativeMethodCues)
    expect(actualChildren[1].props.children.props).toEqual({id:'pressure-only',time:65})
  })

  it('reuses the original introduction only, without entering its treatment sequence', () => {
    for (const [time,context] of [[-1,0],[12,12],[38,38],[90,38]]) {
      const composed = AlternativeScene({id:'pressure-only',time,resetToken:0,cameraDistance:14})
      expect(composed.props['data-original-context-time']).toBe(context)
      const originalChildren = composed.props.children.props.children[0]
      const timed = originalChildren.filter((child: {props?:{time?:number}}) => typeof child?.props?.time === 'number')
      expect(timed.length).toBeGreaterThan(0)
      expect(timed.every((child:{props:{time:number}}) => child.props.time===context)).toBe(true)
    }
  })

  it('does not append an invented mechanism to the unspecified alternative', () => {
    const composed = AlternativeScene({id:'nanoparticles',time:20,resetToken:0,cameraDistance:14})
    expect(composed.props.children.props.children.some((child:{key?:string})=>child?.key==='alternative-world-cues')).toBe(false)
  })

  it('uses the complete authored original base only for the expressly requested liquid-waves variant', () => {
    const composed = AlternativeScene({id:'liquid-waves',time:75,resetToken:3,cameraDistance:15.75})
    const baseline = FireSequenceScene({time:75,mode:'rapid',view:'natural',layers:{fire:true,gas:true,water:true,anatomy:true},resetToken:3,realistic:true,straightBore:true,cinematic:true,connectedSupply:true,cameraDistance:15.75})
    expect(composed.props['data-original-replay']).toBe('full-authored-base')
    expect(composed.props['data-original-context-time']).toBe(75)
    expect(composed.props.children.props.children[0]).toEqual(baseline.props.children)
    expect(AlternativeScene({id:'pressure-only',time:75,resetToken:0,cameraDistance:15.75}).props['data-original-context-time']).toBe(38)
  })
})
