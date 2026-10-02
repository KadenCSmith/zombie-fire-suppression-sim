import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { Line } from '@react-three/drei/core/Line.js'
import * as THREE from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'
import { BENCHMARK_SIZE, fieldValues, type BenchmarkFrame, type MechanicsField } from '../mechanics/comparison'

export type MechanicsCamera = 'orbit' | 'front' | 'top'
export type CameraMemory = { position: number[]; target: number[]; zoom: number; preset: MechanicsCamera; comparison: boolean }
const CORNERS = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
const TRIANGLES = [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]
function Camera({ view, comparison, memory }: { view: MechanicsCamera; comparison: boolean; memory: { current: CameraMemory | undefined } }) {
  const { camera, size } = useThree()
  const ref = useRef<Controls>(null)
  useEffect(() => {
    const target = new THREE.Vector3(0,-0.4,0)
    const wide = 1
    const position = view === 'top' ? [0,6*wide,0.001] : view === 'front' ? [0,-0.2,6*wide] : [2.3,2.5,6]
    const saved = memory.current
    camera.position.fromArray(saved?.preset === view && saved.comparison === comparison ? saved.position : position)
    if (saved?.preset === view && saved.comparison === comparison) target.fromArray(saved.target)
    camera.zoom = saved?.preset === view && saved.comparison === comparison ? saved.zoom : Math.min(size.height/3.6,size.width/(comparison ? 7.5 : 4.5))
    camera.updateProjectionMatrix()
    camera.lookAt(target)
    ref.current?.target.copy(target)
    ref.current?.update()
  }, [view, comparison, camera, memory, size.height, size.width])
  return <OrbitControls ref={ref} makeDefault enableDamping={false} minZoom={30} maxZoom={300} onChange={() => {
    if (ref.current) memory.current = { position: camera.position.toArray(), target: ref.current.target.toArray(), zoom: camera.zoom, preset: view, comparison }
  }} />
}
function ElementBlock({ frame, n, field, range, amplification, mesh, x, onInspect }: {
  frame?: BenchmarkFrame; n: number; field: MechanicsField; range: [number, number]; amplification: number; mesh: boolean; x: number; onInspect: (element: number, value: number) => void
}) {
  const { widthM: w, lengthM: l, depthM: h } = BENCHMARK_SIZE
  const geometry = useMemo(() => {
    const positions: number[] = [], colors: number[] = []
    const values = frame ? fieldValues(frame, field, n) : new Float64Array(n**3)
    const low = new THREE.Color('#386b79'), high = new THREE.Color('#d6b576')
    for (let k=0; k<n; k++) for (let j=0; j<n; j++) for (let i=0; i<n; i++) {
      const element = (k*n+j)*n+i
      const t = Math.max(0, Math.min(1, (values[element]-range[0])/(range[1]-range[0] || 1)))
      const color = field === 'mesh' ? new THREE.Color(element % 2 ? '#7f8c76' : '#697762') : low.clone().lerp(high, t)
      for (const corner of TRIANGLES) {
        const [a,b,c] = CORNERS[corner], q = (((k+c)*(n+1)+j+b)*(n+1)+i+a)*3
        const u = frame?.result.displacementM
        positions.push((i+a)*w/n-w/2 + (u?.[q] ?? 0)*amplification,
          -(k+c)*h/n - (u?.[q+2] ?? 0)*amplification,
          (j+b)*l/n-l/2 + (u?.[q+1] ?? 0)*amplification)
        colors.push(color.r,color.g,color.b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions,3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors,3)); g.computeVertexNormals()
    return g
  }, [frame,n,field,range,amplification,w,l,h])
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 20), [geometry])
  const wire = useMemo(() => {
    const lines: number[] = []
    const position=geometry.getAttribute('position')
    for(let element=0;element<n**3;element++) for(let a=0;a<8;a++) for(let b=a+1;b<8;b++) {
      if(CORNERS[a].reduce((sum,v,i)=>sum+Math.abs(v-CORNERS[b][i]),0)!==1) continue
      for(const corner of [a,b]) { const index=element*36+TRIANGLES.indexOf(corner); lines.push(position.getX(index),position.getY(index),position.getZ(index)) }
    }
    const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));return result
  }, [geometry,n])
  useEffect(() => () => { geometry.dispose(); edges.dispose(); wire.dispose() }, [geometry,edges,wire])
  return <group position={[x,0,0]}>
    <mesh geometry={geometry} onClick={event => { event.stopPropagation(); const id = Math.floor((event.faceIndex ?? 0)/12); onInspect(id, frame ? fieldValues(frame,field,n)[id] : 0) }}>
      <meshStandardMaterial vertexColors roughness={0.93} metalness={0} side={THREE.DoubleSide} />
    </mesh>
    <lineSegments geometry={mesh || field === 'mesh' ? wire : edges}><lineBasicMaterial color="#ced6c5" transparent opacity={mesh || field === 'mesh' ? 0.45 : 0.25} /></lineSegments>
    <Line points={[[-w/2,-h,-l/2],[w/2,-h,-l/2],[w/2,-h,l/2],[-w/2,-h,l/2],[-w/2,-h,-l/2]]} color="#9eab93" lineWidth={1.5} />
    <Line points={[[-w/2,-h-0.18,l/2+0.2],[w/2,-h-0.18,l/2+0.2]]} color="#d7dfcd" />
    {[-1,0,1].map(t => <Line key={t} points={[[t,-h-0.23,l/2+0.2],[t,-h-0.13,l/2+0.2]]} color="#d7dfcd" />)}
  </group>
}
export function MechanicsScene({ frames, n, field, range, amplification, mesh, view, memory, onInspect }: {
  frames: Array<BenchmarkFrame | undefined>; n: number; field: MechanicsField; range: [number,number]; amplification: number; mesh: boolean; view: MechanicsCamera; memory: {current: CameraMemory | undefined}; onInspect: (element: number, value: number) => void
}) {
  return <Canvas orthographic frameloop="demand" dpr={[1,1.75]} camera={{ position: [4,3,5], zoom: 100, near: 0.1, far: 100 }} gl={{ antialias: true }}>
    <color attach="background" args={['#000000']} />
    <ambientLight intensity={1.2} /><directionalLight position={[2,5,4]} intensity={2} /><directionalLight position={[-3,1,-2]} intensity={0.6} />
    <Camera view={view} comparison={frames.length>1} memory={memory} />
    {frames.map((frame,index) => <ElementBlock key={index} frame={frame} n={n} field={field} range={range} amplification={amplification} mesh={mesh} x={frames.length>1 ? (index===0 ? -1.6 : 1.6) : 0} onInspect={onInspect} />)}
    <gridHelper args={[14,28,'#40514a','#253631']} position={[0,-1.025,0]} />
  </Canvas>
}
