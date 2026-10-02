import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FIRE_SEQUENCE_GEOMETRY as G, eased, fireSequencePose, illustratedPeatCoverage } from '../story/fireSequence'

import { currentEquipmentState } from '../story/firePresentation'

type Point = [number, number, number]
type Palette = ReturnType<typeof createPalette>
const UP = new THREE.Vector3(0, 1, 0)
const BODY: Point = [-2.5, 0, -1.05]
const point = (v: THREE.Vector3): Point => [v.x, v.y, v.z]
const lerp = (a: Point, b: Point, t: number): Point => point(new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), t))
const offset = (p: Point, v: THREE.Vector3, scale: number): Point => point(new THREE.Vector3(...p).addScaledVector(v, scale))
function createPalette() {
  return {
    paint: new THREE.MeshStandardMaterial({ color: '#c99722', roughness: .53, metalness: .32 }),
    edge: new THREE.MeshStandardMaterial({ color: '#e3b441', roughness: .42, metalness: .42 }),
    darkPaint: new THREE.MeshStandardMaterial({ color: '#6b571f', roughness: .62, metalness: .4 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#171d19', roughness: .97 }),
    tread: new THREE.MeshStandardMaterial({ color: '#303930', roughness: .88, metalness: .18 }),
    steel: new THREE.MeshStandardMaterial({ color: '#707b75', roughness: .48, metalness: .82 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#c8d4cd', roughness: .18, metalness: .94 }),
    black: new THREE.MeshStandardMaterial({ color: '#202927', roughness: .62, metalness: .4 }),
    glass: new THREE.MeshStandardMaterial({ color: '#739f9b', transparent: true, opacity: .28, roughness: .13, metalness: .28, depthWrite: false, side: THREE.DoubleSide }),
    seat: new THREE.MeshStandardMaterial({ color: '#303631', roughness: .96 }),
    light: new THREE.MeshStandardMaterial({ color: '#efe9cc', emissive: '#d4bc6d', emissiveIntensity: .22, roughness: .25 }),
  }
}
/** Batch static opaque machine parts by material; glass stays separately sorted. */
function StaticBatch({children}: {children: ReactNode}) {
  const group=useRef<THREE.Group>(null)
  useLayoutEffect(()=>{
    const root=group.current;if(!root)return
    root.updateWorldMatrix(true,true)
    const inverse=root.matrixWorld.clone().invert(),parts=new Map<THREE.Material,THREE.BufferGeometry[]>(),hidden:THREE.Mesh[]=[],batches:THREE.Mesh[]=[]
    root.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||Array.isArray(object.material)||object.material.transparent)return
      const original=object.geometry,geometry=original.index?original.toNonIndexed():original.clone()
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld))
      const list=parts.get(object.material)??[];list.push(geometry);parts.set(object.material,list)
      if(object.visible){hidden.push(object);object.visible=false}
    })
    for(const [material,geometries] of parts){
      const geometry=mergeGeometries(geometries,false);geometries.forEach(value=>value.dispose())
      if(geometry){const mesh=new THREE.Mesh(geometry,material);root.add(mesh);batches.push(mesh)}
    }
    return()=>{batches.forEach(mesh=>{root.remove(mesh);mesh.geometry.dispose()});hidden.forEach(mesh=>{mesh.visible=true})}
  },[])
  return <group ref={group}>{children}</group>
}
function Box({at, size, material, rotation}: {at: Point; size: Point; material: THREE.Material; rotation?: Point}) {
  return <mesh position={at} scale={size} rotation={rotation} material={material}><boxGeometry args={[1, 1, 1]}/></mesh>
}
function Rod({a, b, radius, material, radial = 12}: {a: Point; b: Point; radius: number; material: THREE.Material; radial?: number}) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av)
  return <mesh position={av.add(bv).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize())} scale={[radius, delta.length(), radius]} material={material}><cylinderGeometry args={[1, 1, 1, radial]}/></mesh>
}
function Joint({at, axis, radius, width, m}: {at: Point; axis: THREE.Vector3; radius: number; width: number; m: Palette}) {
  return <group><Rod a={offset(at, axis, -width / 2)} b={offset(at, axis, width / 2)} radius={radius} material={m.darkPaint}/>{[-1, 1].map(sign => <group key={sign}><Rod a={offset(at, axis, sign * width / 2)} b={offset(at, axis, sign * (width / 2 + .026))} radius={radius * .88} material={m.edge}/><Rod a={offset(at, axis, sign * (width / 2 + .028))} b={offset(at, axis, sign * (width / 2 + .04))} radius={radius * .34} material={m.chrome} radial={6}/></group>)}</group>
}
function trackPoint(distance: number) {
  const half = .85, r = .205, straight = half * 2, arc = Math.PI * r, total = straight * 2 + arc * 2
  let s = ((distance % total) + total) % total
  if (s < straight) return { x: -half + s, y: r, angle: 0 }
  s -= straight
  if (s < arc) { const a = Math.PI / 2 - s / r; return { x: half + Math.cos(a) * r, y: Math.sin(a) * r, angle: a - Math.PI / 2 } }
  s -= arc
  if (s < straight) return { x: half - s, y: -r, angle: Math.PI }
  s -= straight
  const a = -Math.PI / 2 - s / r
  return { x: -half + Math.cos(a) * r, y: Math.sin(a) * r, angle: a - Math.PI / 2 }
}
function beltGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-.85, -.19); shape.lineTo(.85, -.19); shape.absarc(.85, 0, .19, -Math.PI / 2, Math.PI / 2, false); shape.lineTo(-.85, .19); shape.absarc(-.85, 0, .19, Math.PI / 2, Math.PI * 1.5, false)
  const hole = new THREE.Path()
  hole.moveTo(-.85, -.135); hole.lineTo(.85, -.135); hole.absarc(.85, 0, .135, -Math.PI / 2, Math.PI / 2, false); hole.lineTo(-.85, .135); hole.absarc(-.85, 0, .135, Math.PI / 2, Math.PI * 1.5, false)
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth: .305, bevelEnabled: false, curveSegments: 18 }); g.translate(0, 0, -.1525); return g
}
const RunningGear = memo(function RunningGear({travel, m}: {travel: number; m: Palette}) {
  const shoes = useRef<THREE.InstancedMesh>(null), ribs = useRef<THREE.InstancedMesh>(null), invalidate = useThree(s => s.invalidate)
  const belt = useMemo(beltGeometry, [])
  useEffect(() => () => belt.dispose(), [belt])
  useLayoutEffect(() => {
    const object = new THREE.Object3D(), perimeter = 3.4 + Math.PI * .41
    for (let side = 0; side < 2; side++) for (let i = 0; i < 64; i++) {
      const p = trackPoint(i / 64 * perimeter + travel), index = side * 64 + i
      object.position.set(p.x, .25 + p.y, side ? .625 : -.625); object.rotation.set(0, 0, p.angle); object.scale.set(.079, .037, .36); object.updateMatrix(); shoes.current?.setMatrixAt(index, object.matrix)
      object.position.x -= Math.sin(p.angle) * .025; object.position.y += Math.cos(p.angle) * .025; object.scale.set(.027, .015, .34); object.updateMatrix(); ribs.current?.setMatrixAt(index, object.matrix)
    }
    for (const ref of [shoes, ribs]) if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere() }
    invalidate()
  }, [travel, invalidate])
  return <group>
    <instancedMesh ref={shoes} args={[undefined, m.rubber, 128]} raycast={() => null}><boxGeometry args={[1, 1, 1]}/></instancedMesh>
    <instancedMesh ref={ribs} args={[undefined, m.tread, 128]} raycast={() => null}><boxGeometry args={[1, 1, 1]}/></instancedMesh>
    <StaticBatch>{[-.625, .625].map((z, side) => <group key={side} position={[0, .25, z]}>
      <mesh geometry={belt} material={m.rubber}/>
      {[-.83, -.45, -.15, .15, .45, .83].map((x, i) => { const r = i === 0 || i === 5 ? .17 : .125; return <group key={i}><Rod a={[x, 0, -.17]} b={[x, 0, .17]} radius={r} material={i === 5 ? m.steel : m.darkPaint}/>{[-1, 1].map(s => <group key={s}><Rod a={[x, 0, s * .173]} b={[x, 0, s * .188]} radius={r * .63} material={m.steel}/><Rod a={[x, 0, s * .189]} b={[x, 0, s * .201]} radius={.037} material={m.black} radial={6}/></group>)}</group> })}
      {Array.from({length: 12}, (_, i) => { const a = i / 12 * Math.PI * 2; return <Box key={i} at={[.83 + Math.cos(a) * .171, Math.sin(a) * .171, 0]} size={[.06, .038, .32]} rotation={[0, 0, a]} material={m.steel}/> })}
      <Box at={[0, -.005, 0]} size={[1.48, .075, .16]} material={m.black}/>
    </group>)}
    <Box at={[0, .28, 0]} size={[1.2, .2, 1.25]} material={m.black}/>
    <Box at={[0, .5, 0]} size={[1.72, .18, 1.22]} material={m.darkPaint}/>
    <mesh position={[0, .59, 0]} material={m.black}><cylinderGeometry args={[.48, .48, .12, 32]}/></mesh>
    <mesh position={[0, .66, 0]} material={m.steel}><cylinderGeometry args={[.44, .44, .035, 32]}/></mesh></StaticBatch>
  </group>
})
const CabAndBody = memo(function CabAndBody({m}: {m: Palette}) {
  const posts: Point[] = [[-.3, .8, .065], [.5, .8, .065], [-.3, .8, .71], [.5, .8, .71]]
  return <StaticBatch>
    <Box at={[-.04, .72, 0]} size={[1.68, .18, 1.25]} material={m.paint}/>
    <Box at={[-.62, .93, -.015]} size={[.47, .49, 1.12]} material={m.paint}/>
    <mesh position={[-.75, 1.0, -.015]} rotation={[Math.PI / 2, 0, 0]} material={m.paint}><cylinderGeometry args={[.28, .28, 1.12, 24, 1, false, Math.PI, Math.PI]}/></mesh>
    <Box at={[-.5, 1.2, -.24]} size={[.56, .09, .55]} material={m.edge}/>
    <Box at={[-.45, 1.24, -.3]} size={[.37, .025, .3]} material={m.black}/>
    {Array.from({length: 8}, (_, i) => <Box key={i} at={[-.76 + i * .041, 1.045, .565]} size={[.019, .205, .009]} material={m.black}/>)}
    <Rod a={[-.69, 1.21, -.41]} b={[-.69, 1.56, -.41]} radius={.024} material={m.black}/>
    <Rod a={[-.69, 1.56, -.41]} b={[-.59, 1.58, -.41]} radius={.023} material={m.black}/>
    <Box at={[.08, .79, .39]} size={[.87, .1, .73]} material={m.black}/>
    <Box at={[.04, .94, .38]} size={[.34, .17, .34]} material={m.seat}/>
    <Box at={[-.11, 1.14, .38]} size={[.08, .38, .35]} rotation={[0, 0, -.12]} material={m.seat}/>
    <Box at={[-.13, 1.36, .38]} size={[.09, .13, .25]} material={m.seat}/>
    <Box at={[.18, 1.03, .15]} size={[.22, .15, .105]} material={m.black}/>
    <Box at={[.18, 1.03, .62]} size={[.22, .15, .105]} material={m.black}/>
    <Rod a={[.19, 1.08, .18]} b={[.23, 1.24, .18]} radius={.013} material={m.black}/><Rod a={[.19, 1.08, .6]} b={[.23, 1.24, .6]} radius={.013} material={m.black}/>
    <Box at={[.42, 1.04, .4]} size={[.09, .15, .54]} material={m.black}/>
    <Box at={[.46, 1.13, .37]} size={[.025, .095, .14]} rotation={[0, 0, -.25]} material={m.glass}/>
    <Box at={[.1, 1.405, .073]} size={[.72, .76, .015]} material={m.glass}/><Box at={[.1, 1.405, .7]} size={[.72, .76, .015]} material={m.glass}/>
    <Box at={[.492, 1.41, .385]} size={[.016, .78, .6]} rotation={[0, 0, .065]} material={m.glass}/><Box at={[-.291, 1.4, .385]} size={[.014, .76, .6]} material={m.glass}/>
    {posts.map((p, i) => <Rod key={i} a={p} b={[p[0] - (p[0] > 0 ? .04 : 0), 1.825, p[2]]} radius={.025} material={m.black}/>)}
    <Box at={[.07, 1.835, .38]} size={[.92, .09, .8]} material={m.edge}/><Box at={[.07, 1.89, .38]} size={[.73, .025, .63]} material={m.darkPaint}/>
    <Rod a={[-.28, 1.13, .725]} b={[.45, 1.13, .725]} radius={.018} material={m.black}/><Rod a={[.12, .84, .725]} b={[.12, 1.78, .725]} radius={.012} material={m.black}/>
    <Rod a={[.27, 1.25, .744]} b={[.39, 1.25, .744]} radius={.016} material={m.steel}/>
    <Box at={[.16, .61, .83]} size={[.53, .045, .18]} material={m.steel}/><Box at={[.16, .44, .83]} size={[.53, .045, .18]} material={m.steel}/>
    <Rod a={[.36, 1.6, .715]} b={[.59, 1.64, .85]} radius={.016} material={m.black}/><Box at={[.59, 1.66, .86]} size={[.075, .12, .03]} material={m.chrome}/>
    <Box at={[.52, 1.79, .48]} size={[.065, .075, .16]} material={m.light}/><Box at={[.64, .8, -.49]} size={[.09, .075, .13]} material={m.light}/>
    <Box at={[.48, .91, -.25]} size={[.36, .4, .35]} material={m.darkPaint}/>
    <Rod a={[.53, .91, -.37]} b={[.53, 1.13, -.37]} radius={.13} material={m.paint}/>
  </StaticBatch>
})
function TwinLink({a, b, axis, width, separation, m}: {a: Point; b: Point; axis: THREE.Vector3; width: number; separation: number; m: Palette}) {
  const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), length = delta.length(), center = lerp(a, b, .5), y = delta.normalize()
  const x = new THREE.Vector3().crossVectors(y, axis).normalize(), matrix = new THREE.Matrix4().makeBasis(x, y, axis), quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix)
  return <group>{[-1, 1].map(sign => <mesh key={sign} position={offset(center, axis, sign * separation / 2)} quaternion={quaternion} scale={[width, length, .045]} material={m.paint}><boxGeometry args={[1, 1, 1]}/></mesh>)}{[.12, .45, .83].map(t => <Rod key={t} a={offset(lerp(a, b, t), axis, -separation / 2)} b={offset(lerp(a, b, t), axis, separation / 2)} radius={width * .28} material={m.edge}/>)}</group>
}
function HydraulicRam({a, b, barrelLength, m}: {a: Point; b: Point; barrelLength: number; m: Palette}) {
  const direction = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), length = direction.length(), barrelEnd = lerp(a, b, Math.min(.82, barrelLength / length))
  return <group><Rod a={a} b={barrelEnd} radius={.06} material={m.paint}/><Rod a={barrelEnd} b={b} radius={.029} material={m.chrome}/><Rod a={lerp(a, barrelEnd, .92)} b={barrelEnd} radius={.072} material={m.steel}/><mesh position={a} material={m.steel}><sphereGeometry args={[.074, 10, 6]}/></mesh><mesh position={b} material={m.steel}><sphereGeometry args={[.045, 10, 6]}/></mesh></group>
}
function Hoses({points, material}: {points: Point[]; material: THREE.Material}) {
  const key = points.map(p => p.join(',')).join('|')
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 40, .015, 6, false), [key])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material}/>
}
function augerFlight() {
  const vertices: number[] = [], indices: number[] = [], count = 220, inner = .045, outer = G.augerRadiusM
  for (let i = 0; i <= count; i++) { const t = i / count, a = t * Math.PI * 11, y = .13 + t * 1.89; for (const r of [inner, outer]) vertices.push(Math.cos(a) * r, y, Math.sin(a) * r) }
  for (let i = 0; i < count; i++) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g
}
function Vehicle({time, travel, openPit=false}: {time: number; travel: number; openPit?:boolean}) {
  const m = useMemo(createPalette, []), flight = useMemo(augerFlight, []), pose = fireSequencePose(time, 'gradual')
  useEffect(() => () => { Object.values(m).forEach(value => value.dispose()); flight.dispose() }, [m, flight])
  const a: Point = [BODY[0] + .53, 1.08, BODY[2] - .25], c: Point = [G.sourceX, pose.drillY + (openPit?.65:2.3), -.02]
  const delta = new THREE.Vector3(c[0] - a[0], 0, c[2] - a[2]), h = delta.length(), horizontal = delta.normalize(), axis = new THREE.Vector3(-horizontal.z, 0, horizontal.x)
  // Fixed lengths keep the attachment connected without scaling either arm segment.
  const l1 = 2.5, l2 = 2.2, dy = c[1] - a[1], reach = Math.hypot(h, dy), angle = Math.atan2(dy, h) + Math.acos(THREE.MathUtils.clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1))
  const b = point(new THREE.Vector3(...a).addScaledVector(horizontal, l1 * Math.cos(angle)).add(new THREE.Vector3(0, l1 * Math.sin(angle), 0)))
  const head: Point = [c[0], c[1] - .15, c[2]], hoseTop = offset(b, axis, .19)
  return <group position={[travel, 0, 0]} userData={{scientificRole: 'prescribed excavator with geometric arm constraints; no machine/contact dynamics'}}>
    <group position={BODY}><RunningGear travel={travel} m={m}/><CabAndBody m={m}/></group>
    <TwinLink a={a} b={b} axis={axis} width={.24} separation={.25} m={m}/><TwinLink a={b} b={c} axis={axis} width={.19} separation={.19} m={m}/>
    {[a, b, c].map((at, i) => <Joint key={i} at={at} axis={axis} radius={i === 0 ? .18 : i === 1 ? .16 : .105} width={i === 0 ? .42 : .32} m={m}/>)}
    <HydraulicRam a={offset([a[0] - .2, .8, a[2]], axis, .22)} b={offset(lerp(a, b, .64), axis, .22)} barrelLength={.86} m={m}/>
    <HydraulicRam a={offset(lerp(a, b, .66), axis, .22)} b={offset(lerp(b, c, .55), axis, .22)} barrelLength={.62} m={m}/>
    <Hoses material={m.black} points={[offset(a, axis, .18), offset(lerp(a, b, .35), axis, .21), [hoseTop[0], hoseTop[1] + .16, hoseTop[2]], offset(lerp(b, c, .6), axis, .2), [head[0] + .13, head[1] + .05, head[2] + .15], [head[0] + .09, head[1] - .13, head[2] + .06]]}/>
    <Hoses material={m.black} points={[offset(a, axis, .23), offset(lerp(a, b, .38), axis, .25), [hoseTop[0], hoseTop[1] + .22, hoseTop[2] + .065], offset(lerp(b, c, .63), axis, .24), [head[0] + .2, head[1] + .1, head[2] + .2], [head[0] + .13, head[1] - .13, head[2] + .06]]}/>
    <Box at={[c[0], c[1] - .12, c[2]]} size={[.24, .21, .24]} material={m.black}/>
    {openPit?<group position={[G.sourceX,pose.drillY,-.02]} rotation={[0,0,-.15*eased(time,29,33)]} userData={{scientificRole:'fixed-width excavation bucket; no radial cutter motion'}}>
      <Rod a={[0,.55,0]} b={[0,.16,0]} radius={.07} material={m.steel}/>
      <Box at={[0,-.02,-.18]} size={[.64,.34,.12]} material={m.steel}/>
      <Box at={[-.29,-.06,.02]} size={[.07,.30,.42]} material={m.steel}/>
      <Box at={[.29,-.06,.02]} size={[.07,.30,.42]} material={m.steel}/>
      <Box at={[0,-.19,.02]} size={[.64,.06,.42]} material={m.steel}/>
      {[-.25,-.12,.01,.14,.27].map(x=><Box key={x} at={[x,-.25,.21]} size={[.055,.11,.12]} material={m.chrome}/>)}
    </group>:<><mesh position={[G.sourceX, pose.drillY + 2.14, -.02]} material={m.paint}><cylinderGeometry args={[.12, .12, .19, 16]}/></mesh>
    <mesh position={[G.sourceX, pose.drillY + 2.015, -.02]} material={m.steel}><cylinderGeometry args={[.072, .072, .075, 12]}/></mesh>
    <group position={[G.sourceX, pose.drillY, -.02]} rotation={[0, pose.drillVisible ? time * 6.5 : 0, 0]}>
      <mesh position={[0, 1.07, 0]} material={m.steel}><cylinderGeometry args={[.041, .044, 2.12, 16]}/></mesh>
      <mesh geometry={flight}><meshStandardMaterial color="#697971" metalness={.82} roughness={.43} side={THREE.DoubleSide}/></mesh>
      <mesh position={[0, .08, 0]} rotation={[0, 0, Math.PI]} material={m.steel}><coneGeometry args={[Math.min(.085, G.augerRadiusM * .42), .16, 12]}/></mesh>
      {[0, Math.PI].map(a => <Box key={a} at={[Math.cos(a) * G.augerRadiusM * .68, .15, Math.sin(a) * G.augerRadiusM * .68]} size={[G.augerRadiusM * .55, .028, .075]} rotation={[0, -a, -.14]} material={m.chrome}/>)}
    </group></>}
  </group>
}
/** The treatment gate is presentation-only; no numerical burn fraction drives it. */
export function SequenceExcavator({time,openPit=false,connectedSupply=false}: {time: number;openPit?:boolean;connectedSupply?:boolean}) {
  if (connectedSupply) {
    const state = currentEquipmentState(time)
    return state.excavatorVisible ? <Vehicle time={time} travel={state.excavatorTravel} openPit={openPit}/> : null
  }
  if (time < 24 || time >= 40 || illustratedPeatCoverage(time) < .7) return null
  const travel = -6 * (1 - eased(time, 24, 27)) - 6 * eased(time, 36.5, 40)
  return <Vehicle time={time} travel={travel} openPit={openPit}/>
}
