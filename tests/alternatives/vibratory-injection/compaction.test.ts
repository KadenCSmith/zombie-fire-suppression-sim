import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createCompactionPass } from '../../../src/alternatives/vibratory-injection/compaction-pass'
import { fracturePathAt } from '../../../src/alternatives/vibratory-injection/compaction-effects'
import { vibrationPose } from '../../../src/alternatives/vibratory-injection/vibration'

describe('authored compaction output lifecycle',()=>{
  it('owns fresh HDR/depth resources and disposes each once without changing original materials',()=>{
    const a=createCompactionPass(),b=createCompactionPass(),counts=[0,0,0,0]
    expect(a.target.texture.type).toBe(THREE.HalfFloatType)
    expect(a.target).not.toBe(b.target);expect(a.depth).not.toBe(b.depth)
    const resources=[a.target,a.depth,a.material,a.geometry]
    resources.forEach((resource,i)=>resource.addEventListener('dispose',()=>counts[i]++))
    a.dispose();a.dispose()
    expect(counts).toEqual([1,1,1,1])
    expect(b.target.texture).not.toBe(a.target.texture)
    b.dispose()
  })
  it('passes through the unchanged introduction and restores renderer state after output or failure',()=>{
    const owned=createCompactionPass(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera()
    const original=new THREE.WebGLRenderTarget(4,4)
    let target:THREE.WebGLRenderTarget|null=original,scissorTest=true,fail=false
    const viewport=new THREE.Vector4(5,6,80,90),scissor=new THREE.Vector4(3,4,70,60),renders:THREE.Scene[]=[]
    const mock={
      autoClear:false,
      getDrawingBufferSize:(out:THREE.Vector2)=>out.set(160,120),
      getRenderTarget:()=>target,setRenderTarget:(value:THREE.WebGLRenderTarget|null)=>{target=value},
      getViewport:(out:THREE.Vector4)=>out.copy(viewport),setViewport:(value:THREE.Vector4)=>viewport.copy(value),
      getScissor:(out:THREE.Vector4)=>out.copy(scissor),setScissor:(value:THREE.Vector4)=>scissor.copy(value),
      getScissorTest:()=>scissorTest,setScissorTest:(value:boolean)=>{scissorTest=value},
      render:(value:THREE.Scene)=>{renders.push(value);if(fail&&value!==scene)throw new Error('output failed')},
    }
    const renderer=mock as unknown as THREE.WebGLRenderer
    owned.render(renderer,scene,camera,0)
    expect(renders).toEqual([scene]);expect(target).toBe(original)
    owned.render(renderer,scene,camera,.5)
    expect(renders).toHaveLength(3)
    expect(target).toBe(original);expect(mock.autoClear).toBe(false);expect(scissorTest).toBe(true)
    expect(viewport.toArray()).toEqual([5,6,80,90]);expect(scissor.toArray()).toEqual([3,4,70,60])
    expect(owned.target.width).toBe(160);expect(owned.target.height).toBe(120)
    fail=true
    expect(()=>owned.render(renderer,scene,camera,.8)).toThrow('output failed')
    expect(target).toBe(original);expect(mock.autoClear).toBe(false);expect(scissorTest).toBe(true)
    expect(viewport.toArray()).toEqual([5,6,80,90]);expect(scissor.toArray()).toEqual([3,4,70,60])
    owned.dispose();original.dispose()
    expect(()=>owned.render(renderer,scene,camera,.5)).toThrow('disposed')
  })
  it('advances fractures by distance without skipping or disconnecting an unequal-length path',()=>{
    const path:[number,number,number][]=[[0,0,0],[1,0,0],[1,9,0]],before=structuredClone(path)
    expect(fracturePathAt(path,.05)).toEqual([[0,0,0],[.5,0,0]])
    expect(fracturePathAt(path,.2)).toEqual([[0,0,0],[1,0,0],[1,1,0]])
    expect(fracturePathAt(path,1)).toEqual(path)
    expect(path).toEqual(before)
  })
  it('keeps all compression/extinction authored, deterministic and absent with vibration disabled',()=>{
    for(const time of [0,27,33,44,50,62,68,74,90]){
      const on=vibrationPose(time),off=vibrationPose(time,false)
      expect(off.fracture).toBe(0);expect(off.compression).toBe(0);expect(off.emberFade).toBe(0)
      expect(off.groundScale).toEqual([1,1,1])
      expect(on.emberFade).toBeGreaterThanOrEqual(0);expect(on.emberFade).toBeLessThanOrEqual(1)
    }
    const final=vibrationPose(90)
    expect(final.compression).toBe(1);expect(final.emberFade).toBe(1)
    expect(-3.2*final.groundScale[1]+final.surfacePosition[1]).toBeCloseTo(-3.2,12)
    const middle=vibrationPose(58);vibrationPose(90);vibrationPose(0)
    expect(vibrationPose(58)).toEqual(middle)
  })
})
