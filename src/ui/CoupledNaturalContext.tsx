import {useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import {useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {PRESETS,type CoupledFrame,type Fidelity} from '../coupled/model'

/** Fixed authored seed, independent of the solver RNG and state. These inclusions
 * are surface appearance only: no extra material inventory or resolved stones.
 */
function seeded(seed:number){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}}
interface Aggregate {x:number;y:number;depth:number;scale:[number,number,number];rotation:[number,number,number];color:THREE.Color}

function displacement(frame:CoupledFrame|undefined,fidelity:Fidelity,x:number,y:number,depth:number){
 const u=frame?.displacementM;if(!u)return [0,0,0]
 const {nx,ny,nz}=PRESETS[fidelity],gx=Math.max(0,Math.min(nx,x*nx/8)),gy=Math.max(0,Math.min(ny,y*ny/8)),gz=Math.max(0,Math.min(nz,depth*nz/3.2))
 const ix=Math.min(nx-1,Math.floor(gx)),iy=Math.min(ny-1,Math.floor(gy)),iz=Math.min(nz-1,Math.floor(gz)),fx=gx-ix,fy=gy-iy,fz=gz-iz,result=[0,0,0]
 for(let c=0;c<2;c++)for(let b=0;b<2;b++)for(let a=0;a<2;a++){
  const w=(a?fx:1-fx)*(b?fy:1-fy)*(c?fz:1-fz),q=(((iz+c)*(ny+1)+iy+b)*(nx+1)+ix+a)*3
  for(let axis=0;axis<3;axis++)result[axis]+=w*u[q+axis]
 }
 return result
}

export function NaturalAggregates({frame,fidelity,cut,amplification=1}:{frame?:CoupledFrame;fidelity:Fidelity;cut:boolean;amplification?:number}){
 const invalidate=useThree(s=>s.invalidate)
 const ref=useRef<THREE.InstancedMesh>(null)
 const geometry=useMemo(()=>{
  const g=new THREE.IcosahedronGeometry(1,0),p=g.attributes.position
  // The geometry has nonindexed duplicate corners; coordinate hashing keeps
  // shared corner positions identical and prevents cracks between facets.
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),hash=Math.sin(x*127.1+y*311.7+z*74.7+87129)*43758.5453,rough=.76+(hash-Math.floor(hash))*.36;p.setXYZ(i,x*rough,y*rough,z*rough)}
  g.computeVertexNormals();return g
 },[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 const aggregates=useMemo(()=>{
  const rand=seeded(46023),items:Aggregate[]=[]
  for(let i=0;i<570;i++){
   const top=i>=430,x=.08+rand()*7.84,depth=top?0:.04+rand()*3.10,y=top?.08+rand()*(cut?3.82:7.84):cut?4:8
   const organic=depth<.30,peat=depth>.75&&depth<2.8&&Math.abs(x-4)<3.3
   const radius=(organic?.018:.018)+(rand()**2)*(organic?.045:peat?.075:.13)
   const color=new THREE.Color().setHSL(organic?.095:peat?.075:.105,.15+rand()*.17,organic?.12+rand()*.13:peat?.11+rand()*.21:.29+rand()*.20)
   items.push({x,y,depth,scale:[radius*(.6+rand()*.95),radius*(top?.3+rand()*.3:.5+rand()*.55),radius*(top?.7+rand()*.6:.14+rand()*.18)],rotation:[rand()*.65,rand()*6.28,rand()*1.5],color})
  }
  return items
 },[cut])
 useLayoutEffect(()=>{
  const mesh=ref.current;if(!mesh)return
  const object=new THREE.Object3D()
  aggregates.forEach((a,i)=>{
   const [ux,uy,uz]=displacement(frame,fidelity,a.x,a.y,a.depth)
   object.position.set(a.x-4+ux*amplification,-a.depth-uz*amplification+(a.depth===0?.006:0),a.y-4+uy*amplification+(a.depth>0?.009:0))
   object.rotation.set(...a.rotation);object.scale.set(...a.scale);object.updateMatrix();mesh.setMatrixAt(i,object.matrix)
   const grid=PRESETS[fidelity],cell=(Math.min(grid.nz-1,Math.floor(a.depth*grid.nz/3.2))*grid.ny+Math.min(grid.ny-1,Math.floor(a.y*grid.ny/8)))*grid.nx+Math.min(grid.nx-1,Math.floor(a.x*grid.nx/8))
   const color=a.color.clone(),peat=frame?.materialPeatFraction?.[cell]
   if(peat!==undefined)color.lerp(new THREE.Color('#392b1f'),Math.max(0,Math.min(1,peat))*.65)
   mesh.setColorAt(i,color)
  })
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();invalidate()
 },[aggregates,frame,fidelity,amplification,invalidate])
 return <instancedMesh ref={ref} args={[geometry,undefined,aggregates.length]} raycast={()=>null} userData={{scientificRole:'seeded surface appearance only; no resolved aggregate mechanics'}}><meshStandardMaterial roughness={1} flatShading/></instancedMesh>
}
