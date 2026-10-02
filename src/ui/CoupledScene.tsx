import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { Line } from '@react-three/drei/core/Line.js'
import { useGLTF } from '@react-three/drei/core/Gltf.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { CoupledFrame, Fidelity, CoupledInputs } from '../coupled/model'
import { PRESETS } from '../coupled/model'
import { OakTree } from './OakTree'
import { createSoilTexture } from './FractureStudy'
import { NaturalAggregates } from './CoupledNaturalContext'

export type CoupledField = 'temperatureK' | 'pressurePa' | 'oxygen' | 'co2' | 'iceKg' | 'damage' | 'porosity'
export const COUPLED_FIELDS: Record<CoupledField, { label: string; unit: string; range: [number, number] }> = {
  temperatureK: { label: 'Temperature', unit: 'K', range: [190, 600] }, pressurePa: { label: 'Pore pressure', unit: 'Pa absolute', range: [100000, 103000] }, oxygen: { label: 'Oxygen fraction', unit: 'mol/mol', range: [0, 0.21] }, co2: { label: 'CO₂ fraction', unit: 'mol/mol', range: [0, 0.1] }, iceKg: { label: 'Frozen water', unit: 'kg/cell', range: [0, 10] }, damage: { label: 'Diffuse fracture', unit: '1', range: [0, 1] }, porosity: { label: 'Pore fraction', unit: 'm³/m³', range: [0.35, 0.95] },
}
type CameraPose = { position: [number, number, number]; target: [number, number, number] }
type CameraLink = { pose: CameraPose; listeners: Set<(pose: CameraPose, sender: object) => void> }
const DEFAULT_CAMERA: CameraPose = { position: [6.5, 4.8, 10.5], target: [0, -0.4, 0] }
export const createCameraLink = (): CameraLink => ({ pose: { position: [...DEFAULT_CAMERA.position], target: [...DEFAULT_CAMERA.target] }, listeners: new Set() })
const CORNERS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
const FACES = [[0, 3, 7, 0, 7, 4], [1, 2, 6, 1, 6, 5], [0, 1, 5, 0, 5, 4], [2, 3, 7, 2, 7, 6], [0, 2, 1, 0, 3, 2], [4, 5, 6, 4, 6, 7]]

/** A continuous visual material, separate from the cellwise scientific fields. */
function createNaturalMaterial(terrain?: CoupledInputs['terrain']) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.97, side: THREE.DoubleSide })
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec3 restPosition; attribute float peatFraction; varying vec3 vEarth; varying float vPeatFraction;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvEarth = restPosition; vPeatFraction = peatFraction;')
    shader.fragmentShader = `varying vec3 vEarth; varying float vPeatFraction;
float earthNoise(vec3 p) { return fract(sin(dot(p,vec3(12.9898,78.233,41.21)))*43758.5453); }
` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float depth = -vEarth.y + 0.038*sin(vEarth.x*1.7) + 0.028*sin(vEarth.z*2.3);
vec3 soil = depth < 0.16 ? vec3(0.071,0.045,0.023) : depth < 0.78 ? vec3(0.28,0.18,0.09) : depth < 1.95 ? vec3(0.43,0.31,0.18) : vec3(0.55,0.49,0.36);
float lens = ${terrain === 'layered' ? 'abs((-vEarth.y-1.6)/0.8)' : 'length(vec3(vEarth.x/3.5,(-vEarth.y-1.9)/0.9,vEarth.z/3.5))'};
float roughBoundary = 0.02*sin(vEarth.x*17.0)*sin(vEarth.y*23.0)+0.01*sin(vEarth.x*43.0);
float peat = vPeatFraction >= 0.0 ? smoothstep(0.05,0.85,vPeatFraction) : 1.0-smoothstep(0.985+roughBoundary,1.015+roughBoundary,lens);
soil = mix(soil,vec3(0.095,0.060,0.031),peat);
float grit = earthNoise(floor(vEarth*155.0));
float mottling = earthNoise(floor(vEarth*18.0));
soil *= 0.74+0.30*grit+0.12*mottling;
${terrain === 'rocky' ? 'if(depth>2.4) soil=mix(soil,vec3(0.34,0.33,0.29)*(0.7+0.3*grit),0.58);' : ''}
diffuseColor.rgb = soil;`)
  }
  material.customProgramCacheKey = () => `coupled-natural-${terrain ?? 'rooted-peat'}`
  return material
}

/** Only exposed faces are uploaded. Interior elements remain in the complete solver state. */
function FieldMesh({ frame, fidelity, field, cut, amplification, onProbe, kind, terrain }: { frame?: CoupledFrame; fidelity: Fidelity; field: CoupledField; cut: boolean; amplification: number; onProbe: (i: number) => void; kind: string; terrain?: CoupledInputs['terrain'] }) {
  const { nx, ny, nz } = PRESETS[fidelity]
  const invalidate = useThree(state => state.invalidate)
  const nodePeat = useMemo(() => {
    const fraction = frame?.materialPeatFraction
    if (!fraction) return undefined
    const values = new Float32Array((nx + 1) * (ny + 1) * (nz + 1)), weights = new Uint8Array(values.length)
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const value = fraction[(z * ny + y) * nx + x]
      for (const [a, b, c] of CORNERS) { const node = ((z + c) * (ny + 1) + y + b) * (nx + 1) + x + a; values[node] += value; weights[node]++ }
    }
    for (let i = 0; i < values.length; i++) values[i] /= weights[i]
    return values
  }, [frame?.materialPeatFraction, nx, ny, nz])
  const mesh = useMemo(() => {
    const positions: number[] = [], nodeIds: number[] = [], cellIds: number[] = [], faceIds: number[] = []
    const visibleY = cut ? Math.ceil(ny / 2) : ny
    for (let z = 0; z < nz; z++) for (let y = 0; y < visibleY; y++) for (let x = 0; x < nx; x++) {
      const id = (z * ny + y) * nx + x
      const exposed = [x === 0, x === nx - 1, y === 0, y === visibleY - 1, z === 0, z === nz - 1]
      for (let face = 0; face < 6; face++) if (exposed[face]) {
        faceIds.push(id, id)
        for (const corner of FACES[face]) {
          const [a, b, c] = CORNERS[corner]
          positions.push((x + a) * 8 / nx - 4, -(z + c) * 3.2 / nz, (y + b) * 8 / ny - 4)
          nodeIds.push((((z + c) * (ny + 1) + y + b) * (nx + 1) + x + a) * 3); cellIds.push(id)
        }
      }
    }
    const geometry = new THREE.BufferGeometry(), base = Float32Array.from(positions)
    geometry.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('restPosition', new THREE.BufferAttribute(base.slice(), 3))
    geometry.setAttribute('peatFraction', new THREE.BufferAttribute(new Float32Array(nodeIds.length), 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.length), 3).setUsage(THREE.DynamicDrawUsage))
    return { geometry, base, nodeIds: Uint32Array.from(nodeIds), cellIds: Uint32Array.from(cellIds), faceIds }
  }, [nx, ny, nz, cut])
  useLayoutEffect(() => {
    const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, colors = mesh.geometry.getAttribute('color') as THREE.BufferAttribute
    const range = COUPLED_FIELDS[field].range, color = new THREE.Color(), u = frame?.displacementM
    const peat = mesh.geometry.getAttribute('peatFraction') as THREE.BufferAttribute
    for (let vertex = 0; vertex < mesh.cellIds.length; vertex++) {
      const q = mesh.nodeIds[vertex], base = vertex * 3, id = mesh.cellIds[vertex]
      positions.setXYZ(vertex, mesh.base[base] + (u?.[q] ?? 0) * amplification, mesh.base[base + 1] - (u?.[q + 2] ?? 0) * amplification, mesh.base[base + 2] + (u?.[q + 1] ?? 0) * amplification)
      if (!frame) color.set(Math.floor(id / (nx * ny)) >= nz / 2 ? '#66513f' : '#667359')
      else {
        const fraction = Math.max(0, Math.min(1, (frame[field][id] - range[0]) / (range[1] - range[0])))
        color.setHSL(0.56 - 0.5 * fraction, 0.35 + 0.3 * fraction, 0.28 + 0.3 * fraction)
      }
      colors.setXYZ(vertex, color.r, color.g, color.b); peat.setX(vertex, nodePeat?.[q / 3] ?? -1)
    }
    positions.needsUpdate = true; colors.needsUpdate = true; peat.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); invalidate()
  }, [frame, field, amplification, mesh, nodePeat, nx, ny, nz, invalidate])
  const naturalMaterial = useMemo(() => createNaturalMaterial(terrain), [terrain])
  useEffect(() => () => { mesh.geometry.dispose() }, [mesh])
  useEffect(() => () => naturalMaterial.dispose(), [naturalMaterial])
  return <mesh geometry={mesh.geometry} onClick={event => { event.stopPropagation(); const id = mesh.faceIds[event.faceIndex ?? 0]; if (id !== undefined) onProbe(id) }}>{kind === 'natural' ? <primitive object={naturalMaterial} attach="material" /> : <meshStandardMaterial vertexColors roughness={0.94} side={THREE.DoubleSide} />}</mesh>
}

function Context({ frame, capEnabled, capRadius, capRise, dryIceKg }: { frame?: CoupledFrame; capEnabled: boolean; capRadius: number; capRise: number; dryIceKg: number }) {
  const rootTexture = useMemo(createSoilTexture, [])
  useEffect(() => () => rootTexture.dispose(), [rootTexture])
  const center = frame?.cap?.centerUpM ?? 0, flex = frame?.cap?.flexM ?? 0
  const capGeometry = useMemo(() => new THREE.LatheGeometry(Array.from({ length: 25 }, (_, i) => { const x = i / 24; return new THREE.Vector2(capRadius * x, capRise * (1 - x * x) + center - flex + flex * (1 - x * x) ** 2) }), 40), [capRadius, capRise, center, flex])
  useEffect(() => () => capGeometry.dispose(), [capGeometry])
  const mass = frame?.dryIceKg ?? dryIceKg
  return <>
    <group position={[-3.24, 0, 0.09]}><OakTree soilTexture={rootTexture} natural /></group>
    <Line points={[[0.4, 0.1, 0.008], [0.4, -1.3, 0.008]]} color="#bec7ba" dashed dashSize={0.06} gapSize={0.06} />
    {mass > 0 && <mesh position={[0.4, -1.3, 0.02]}><sphereGeometry args={[Math.cbrt(3 * mass / (4 * Math.PI * 1560)), 20, 14]} /><meshStandardMaterial color="#c4e6e8" roughness={0.5} /></mesh>}
    {capEnabled && <mesh position={[0.4, 0.005, 0]} geometry={capGeometry}><meshStandardMaterial color="#8c9999" metalness={0.7} roughness={0.4} side={THREE.DoubleSide} /></mesh>}
  </>
}

function ReferenceModel({ progress, onReady }: { progress: number; onReady: () => void }) {
  const { scene, animations } = useGLTF(`${import.meta.env.BASE_URL}models/dry-ice-reference-animation.glb`, false, false)
  const root = useMemo(() => scene.clone(true), [scene]), mixer = useMemo(() => new THREE.AnimationMixer(root), [root])
  const invalidate = useThree(state => state.invalidate)
  const duration = useMemo(() => Math.max(0, ...animations.map(clip => clip.duration)), [animations])
  useEffect(() => onReady(), [onReady])
  useLayoutEffect(() => {
    animations.forEach(clip => { const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play() })
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(root) }
  }, [animations, mixer, root])
  useLayoutEffect(() => {
    // Reference progress is deliberately normalized, never represented as solver-derived time.
    animations.forEach(clip => { const action = mixer.clipAction(clip); action.paused = false })
    mixer.setTime(Math.max(0, Math.min(1, progress)) * duration); invalidate()
  }, [progress, duration, mixer, animations, invalidate])
  return <primitive object={root} dispose={null} />
}
class AssetBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

function LinkedCamera({ link, resetToken }: { link: CameraLink; resetToken: number }) {
  const controls = useRef<OrbitControlsImpl>(null), applying = useRef(false), identity = useRef({})
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const apply = (pose: CameraPose, sender?: object) => {
      if (sender === identity.current || !controls.current) return
      applying.current = true; camera.position.set(...pose.position); controls.current.target.set(...pose.target); controls.current.update(); applying.current = false; invalidate()
    }
    apply(link.pose); link.listeners.add(apply)
    return () => { link.listeners.delete(apply) }
  }, [camera, invalidate, link])
  const previousReset = useRef(resetToken)
  useEffect(() => {
    if (previousReset.current === resetToken) return
    previousReset.current = resetToken; link.pose = { position: [...DEFAULT_CAMERA.position], target: [...DEFAULT_CAMERA.target] }
    link.listeners.forEach(listener => listener(link.pose, {}))
  }, [resetToken, link])
  return <OrbitControls ref={controls} makeDefault target={DEFAULT_CAMERA.target} minDistance={3} maxDistance={28} enableDamping={false} onChange={() => {
    if (applying.current || !controls.current) return
    link.pose = { position: camera.position.toArray() as [number, number, number], target: controls.current.target.toArray() as [number, number, number] }
    link.listeners.forEach(listener => listener(link.pose, identity.current))
  }} />
}
export function CoupledScene(props: { capEnabled: boolean; capRadius: number; capRise: number; dryIceKg: number; frame?: CoupledFrame; fidelity: Fidelity; field: CoupledField; cut: boolean; amplification: number; context: boolean; onProbe: (i: number) => void; kind: 'natural' | 'scientific' | 'blender'; terrain?: CoupledInputs['terrain']; referenceProgress?: number; cameraLink: CameraLink; resetToken: number }) {
  const [assetState, setAssetState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const assetReady = useCallback(() => setAssetState('ready'), []), assetFailed = useCallback(() => setAssetState('failed'), [])
  return <><Canvas dpr={[1, 1.5]} frameloop="demand" camera={{ position: DEFAULT_CAMERA.position, fov: 45, near: 0.05, far: 100 }} gl={{ antialias: true }}>
    <color attach="background" args={['#000000']} /><ambientLight intensity={1.3} /><hemisphereLight args={['#e0ecdf', '#403a2c', 1.2]} /><directionalLight position={[4, 10, 8]} intensity={2.2} />
    {props.kind !== 'blender' ? <><FieldMesh {...props} />{props.kind === 'natural' && <NaturalAggregates frame={props.frame} fidelity={props.fidelity} cut={props.cut} amplification={props.amplification} />}{props.context && <Context {...props} />}</> : <AssetBoundary onError={assetFailed}><Suspense fallback={null}><ReferenceModel progress={props.referenceProgress ?? 0} onReady={assetReady} /></Suspense></AssetBoundary>}
    <LinkedCamera link={props.cameraLink} resetToken={props.resetToken} /><gridHelper args={[16, 16, '#415a50', '#243b33']} position={[0, -3.23, 0]} />
  </Canvas>{props.kind === 'blender' && assetState !== 'ready' && <div className="coupled-asset-overlay"><div className="coupled-asset-message">{assetState === 'loading' ? 'Loading Blender reference…' : 'The Blender reference could not load.'}<small>{assetState === 'loading' ? 'Original concept geometry and animation' : 'Physics calculation and exports remain available.'}</small></div></div>}</>
}
