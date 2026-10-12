import { useEffect, useLayoutEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { Line } from '@react-three/drei/core/Line.js'
import * as THREE from 'three'
import { FireSequenceScene } from '../../ui/FireSequenceScene'
import { createFireGroundGeometry } from '../../ui/FireGroundGeometry'
import { SequenceExcavator, SequenceGrass } from '../../ui/FireSequenceEquipment'
import { FireWaterTruck } from '../../ui/FireWaterTruck'
import { OakTree } from '../../ui/OakTree'
import { createSoilTexture } from '../../ui/FractureStudy'
import type { FieldState } from './field'
import { TreatmentEffects } from './effects'
import { treatmentVisual } from './visuals'

export type FieldView='natural'|'temperature'|'oxygen'|'water'
function FieldGround({state,view,time,enabled,vibration}:{state:FieldState;view:FieldView;time:number;enabled:boolean;vibration:boolean}) {
  const pose=treatmentVisual(time,enabled,vibration)
  const invalidate=useThree(s=>s.invalidate), geometry=useMemo(createFireGroundGeometry,[])
  const texture=useMemo(()=>{
    const {nx,ny,nz}=state.grid,data=new Float32Array(nx*nz*4)
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const i=(z*ny+Math.floor(ny/2))*nx+x,o=(z*nx+x)*4
      data[o]=state.frame.temperatureK[i];data[o+1]=state.frame.oxygen[i]
      data[o+2]=Math.max(0,state.frame.liquidKg[i]-state.initialLiquidKg[i]);data[o+3]=state.frame.materialPeatFraction?.[i]??0
    }
    const tex=new THREE.DataTexture(data,nx,nz,THREE.RGBAFormat,THREE.FloatType)
    tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.needsUpdate=true
    return tex
  },[state])
  const uniforms=useMemo(()=>({uVibField:{value:texture},uVibView:{value:0},uVibDepth:{value:0},uVibClock:{value:0},uVibShake:{value:0},uVibWet:{value:0}}),[])
  const material=useMemo(()=>{
    const m=new THREE.MeshStandardMaterial({roughness:.96,side:THREE.DoubleSide})
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms)
      shader.vertexShader='attribute vec3 displayCenter; attribute float displaySeed; varying vec3 vVibPosition; uniform float uVibClock,uVibShake;\n'+shader.vertexShader
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vVibPosition=position;
        float localShake=uVibShake*exp(-length(vec2(displayCenter.x-.4,displayCenter.y*.6))*.9);
        transformed.x+=sin(uVibClock*31.+displaySeed*19.)*.035*localShake;
        transformed.y+=sin(uVibClock*37.+displaySeed*29.)*.024*localShake;
        transformed.z+=cos(uVibClock*23.+displaySeed*13.)*.022*localShake;`)
      shader.fragmentShader='varying vec3 vVibPosition; uniform sampler2D uVibField; uniform float uVibView,uVibDepth,uVibWet;\n'+shader.fragmentShader
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(vVibPosition.y>-uVibDepth && uVibDepth>.01 && length(vec2(vVibPosition.x-.4,vVibPosition.z))<.24)discard;`)
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec4 f=texture2D(uVibField,vec2(clamp((vVibPosition.x+4.)/8.,0.,.9999),clamp(-vVibPosition.y/3.2,0.,.9999)));
        float hot=clamp((f.r-360.)/200.,0.,1.);
        float grain=fract(sin(dot(vVibPosition,vec3(61.2,148.3,77.7)))*41239.7);
        vec3 peat=mix(vec3(.30,.25,.18),vec3(.16,.10,.055),f.a);
        diffuseColor.rgb=peat*(.75+.35*grain)*(1.-.48*hot);
        float wet=clamp(f.b/.15,0.,1.);
        if(uVibView>.5&&uVibView<1.5)diffuseColor.rgb=mix(mix(vec3(.06,.20,.27),vec3(.89,.37,.08),clamp((f.r-283.)/260.,0.,1.)),vec3(1.,.87,.44),clamp((f.r-500.)/200.,0.,1.));
        if(uVibView>1.5&&uVibView<2.5)diffuseColor.rgb=mix(vec3(.05,.10,.15),vec3(.39,.76,.68),clamp(f.g/.21,0.,1.));
        if(uVibView>2.5)diffuseColor.rgb=mix(vec3(.10,.13,.13),vec3(.12,.57,.76),wet);
        if(uVibView<.5)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.09,.15,.15),max(wet*.65,uVibWet*.65));`)
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        if(uVibView<.5)totalEmissiveRadiance+=vec3(1.7,.26,.025)*hot*hot*step(.52,grain)*(1.-uVibWet);`)
    }
    m.customProgramCacheKey=()=> 'vibratory-owned-field-v2'
    return m
  },[uniforms])
  useLayoutEffect(()=>{uniforms.uVibField.value=texture;uniforms.uVibView.value=['natural','temperature','oxygen','water'].indexOf(view);uniforms.uVibDepth.value=view==='natural'?state.sourceDepthM:0;uniforms.uVibClock.value=time;uniforms.uVibShake.value=view==='natural'?pose.shake:0;uniforms.uVibWet.value=pose.wet;invalidate()},[state,texture,view,time,pose.shake,pose.wet,uniforms,invalidate])
  useEffect(()=>()=>texture.dispose(),[texture])
  useEffect(()=>()=>{geometry.dispose();material.dispose()},[geometry,material])
  return <mesh geometry={geometry} material={material} receiveShadow/>
}
function Vegetation({natural}:{natural:boolean}){
  const soil=useMemo(createSoilTexture,[])
  useEffect(()=>()=>soil.dispose(),[soil])
  return <><OakTree soilTexture={soil} natural/><SequenceGrass time={natural?31:0} mode="gradual" realistic straightBore/></>
}
function Equipment({state,time,vibration}:{state:FieldState;time:number;vibration:boolean}) {
  const inFeed=state.timeS<14, rotorTime=31+((time*6.5)%(Math.PI*2))/6.5
  const equipmentTime=inFeed?24+state.timeS/2:rotorTime
  const running=state.remainingKg>1e-9&&state.deliveredKg>0
  const displacement=vibration&&running?Math.sin(time*31)*.025:0
  const outlet:[number,number,number]=[.4,-state.sourceDepthM,.11]
  const route: [number,number,number][]=[[1.08,.63,-.54],[.92,.18,-.43],[.64,.12,-.33],[.4,.18,-.13],[.4,.1,.08],outlet]
  return <>
    <group position={[displacement,0,0]}><SequenceExcavator time={equipmentTime} connectedSupply/></group>
    <FireWaterTruck time={72}/>
    <Line points={route} color="#283b3d" lineWidth={8}/><Line points={route} color="#678786" lineWidth={2}/>
    {running&&Array.from({length:15},(_,i)=>{
      const f=(time*.8+i/15)%1
      return <mesh key={i} position={[.4,-state.sourceDepthM*f,.14]}><sphereGeometry args={[.018,7,5]}/><meshBasicMaterial color="#78dce7"/></mesh>
    })}
    <mesh position={outlet} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.055,.012,8,24]}/><meshBasicMaterial color={running?'#a6f1ed':'#678786'}/></mesh>
  </>
}
function Camera({distance,resetToken}:{distance:number;resetToken:number}){
  const {camera,invalidate}=useThree()
  useEffect(()=>{const target=new THREE.Vector3(0,-.05,-1.1);camera.position.set(7.2,4,12.3).sub(target).setLength(distance).add(target);camera.lookAt(target);invalidate()},[camera,distance,resetToken,invalidate])
  return <OrbitControls makeDefault target={[0,-.05,-1.1]} enableDamping={false} enableZoom={false} minDistance={5} maxDistance={19}/>
}
export function VibratoryFieldScene({time,state,view,resetToken,cameraDistance,vibration,enabled}:{time:number;state?:FieldState;view:FieldView;resetToken:number;cameraDistance:number;vibration:boolean;enabled:boolean}) {
  const opacity=view==='natural'?Math.max(0,Math.min(1,(time-24)/2)):1
  return <div className="vib-scene" data-original-intro={view==='natural'&&time<26} data-field-time={state?.timeS??0} data-authored-equipment={view==='natural'}>
    {view==='natural'&&opacity<1&&<div className="vib-scene-layer" style={{opacity:1-opacity}}><FireSequenceScene time={Math.min(time,24)} mode="rapid" view="natural" layers={{fire:true,gas:false,water:false,anatomy:true}} resetToken={resetToken} cameraDistance={cameraDistance} realistic straightBore cinematic connectedSupply/></div>}
    {state&&(view!=='natural'||time>=24)&&<div className="vib-scene-layer" style={{opacity}}><Canvas shadows frameloop="demand" dpr={[1,1.5]} camera={{position:[7.2,4,12.3],fov:38,near:.05,far:60}}>
      <color attach="background" args={['#000000']}/><ambientLight intensity={.65}/><hemisphereLight args={['#e1eadb','#28322c',1.1]}/>
      <directionalLight castShadow position={[-4,9,5]} intensity={2.5} shadow-mapSize={[1024,1024]}/>
      <FieldGround state={state} view={view} time={time} enabled={enabled} vibration={vibration}/><Vegetation natural={view==='natural'}/>{view==='natural'&&<Equipment state={state} time={time} vibration={vibration}/>}
      {view==='natural'&&<TreatmentEffects time={time} depth={state.sourceDepthM} enabled={enabled} vibration={vibration}/>}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.24,-1]} receiveShadow><planeGeometry args={[200,200]}/><shadowMaterial opacity={.27}/></mesh>
      <Camera distance={cameraDistance} resetToken={resetToken}/>
    </Canvas></div>}
  </div>
}
