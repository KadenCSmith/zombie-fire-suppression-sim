import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei/web/Html.js'
import { Line } from '@react-three/drei/core/Line.js'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { FastEventFrame, FastEventRun } from '../fastEvent'

export type Overlay = 'temperature' | 'oxygen' | 'co2' | 'pressure' | 'moisture' | 'fuel' | 'char' | 'porosity' | 'permeability' | 'effective-permeability' | 'mobility'
export type View = 'orbit' | 'top' | 'section-x' | 'section-y'
export type ProbeLocation = { xM: number; yM: number; depthM: number }
export type FastOverlay = 'pressure' | 'co2' | 'damage'

type Frame = {
  timeSeconds?: number
  grid: { nx: number; ny: number; nz: number; dxM: number; dyM: number; dzM: number }
  fields: Record<string, ArrayLike<number> | undefined>
  source?: { equivalentDiameterM?: number; remainingMassKg?: number }
}

type SceneProps = {
  scenario: any
  snapshot?: Frame | null
  overlay: Overlay
  view: View
  slice: number
  showRoots: boolean
  showFlow: boolean
  fixedScale: boolean
  illustration: number
  lockCamera?: boolean
  fastEvent?: { run: FastEventRun; frame: FastEventFrame; overlay: FastOverlay } | null
  probe?: ProbeLocation | null
  onProbe?: (probe: ProbeLocation) => void
  className?: string
}

const W = 6.096
const palette = {
  cool: new THREE.Color('#19364b'),
  mid: new THREE.Color('#2d8295'),
  warm: new THREE.Color('#e3bc70'),
  hot: new THREE.Color('#e66d4b'),
}

export const OVERLAY_INFO: Record<Overlay, { label: string; unit: string; min: number; max: number; field: string; log?: boolean }> = {
  temperature: { label: 'Temperature', unit: '°C', min: 0, max: 220, field: 'temperatureC' },
  oxygen: { label: 'Oxygen', unit: 'mole fraction', min: 0, max: 0.21, field: 'oxygenMoleFraction' },
  co2: { label: 'CO₂', unit: 'mole fraction', min: 0, max: 0.5, field: 'co2MoleFraction' },
  pressure: { label: 'Pressure above ambient', unit: 'Pa', min: -200, max: 200, field: 'pressurePa' },
  moisture: { label: 'Moisture saturation', unit: 'fraction', min: 0, max: 1, field: 'moistureSaturation' },
  fuel: { label: 'Remaining fuel', unit: 'kg/cell', min: 0, max: 1, field: 'fuelKg' },
  char: { label: 'Char', unit: 'kg/cell', min: 0, max: 0.2, field: 'charKg' },
  porosity: { label: 'Porosity', unit: 'fraction', min: 0, max: 0.7, field: 'porosity' },
  permeability: { label: 'Intrinsic permeability', unit: 'log₁₀(m²)', min: -15, max: -9, field: 'intrinsicPermeabilityM2', log: true },
  'effective-permeability': { label: 'Effective gas permeability', unit: 'log₁₀(m²)', min: -16, max: -9, field: 'effectivePermeabilityM2', log: true },
  mobility: { label: 'Effective gas diffusivity', unit: 'log₁₀(m²/s)', min: -9, max: -4, field: 'effectiveGasDiffusivityM2S', log: true },
}

function colorAt(t: number) {
  const v = THREE.MathUtils.clamp(t, 0, 1)
  if (v < 0.38) return palette.cool.clone().lerp(palette.mid, v / 0.38)
  if (v < 0.72) return palette.mid.clone().lerp(palette.warm, (v - 0.38) / 0.34)
  return palette.warm.clone().lerp(palette.hot, (v - 0.72) / 0.28)
}

function valueFor(frame: Frame, overlay: Overlay, index: number, ambientPa = 101325) {
  const info = OVERLAY_INFO[overlay]
  const raw = frame.fields[info.field]?.[index] ?? 0
  if (overlay === 'pressure') return raw - ambientPa
  return info.log ? Math.log10(Math.max(raw, 1e-30)) : raw
}

function CameraRig({ view, depth, lockCamera }: { view: View; depth: number; lockCamera?: boolean }) {
  const { camera } = useThree()
  const controls = useRef<any>(null)
  useEffect(() => {
    const target = new THREE.Vector3(0, -depth * 0.42, 0)
    const pos = view === 'top' ? [0, 11, 0.001] : view === 'section-x' ? [0, -depth * 0.38, 11] : view === 'section-y' ? [11, -depth * 0.38, 0] : [8.2, 5.6, 8.5]
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    if (controls.current) {
      controls.current.target.copy(target)
      controls.current.update()
    }
  }, [camera, depth, view])
  return <OrbitControls ref={controls} makeDefault enabled={!lockCamera} enableDamping dampingFactor={0.1} minZoom={45} maxZoom={220} minPolarAngle={0.04} maxPolarAngle={Math.PI - 0.04} />
}

function SoilBlock({ scenario, depth, illustration }: { scenario: any; depth: number; illustration: number }) {
  const half = W / 2
  const sourceLayers = Array.isArray(scenario?.soilLayers) && scenario.soilLayers.length ? scenario.soilLayers : [{ id: 'soil', thicknessM: depth }]
  let cursor = 0
  const layers: { from: number; to: number; color: string; label: string }[] = sourceLayers.map((layer: any, index: number) => {
    const from = cursor
    cursor += Number(layer.thicknessM ?? 0)
    return { from, to: Math.min(depth, cursor), color: ['#69543f', '#574c3c', '#4b453a', '#45453b'][index % 4], label: String(layer.id ?? `layer-${index + 1}`) }
  }).filter((layer: any) => layer.to - layer.from > 0.01)
  return <group>
    {layers.map((layer, i) => {
      const h = layer.to - layer.from
      const y = -(layer.from + layer.to) / 2
      return <group key={i}>
        <mesh position={[-half, y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[W, h]} />
          <meshStandardMaterial color={layer.color} roughness={1} transparent opacity={0.86} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, y, -half]}>
          <planeGeometry args={[W, h]} />
          <meshStandardMaterial color={layer.color} roughness={1} transparent opacity={0.88} side={THREE.DoubleSide} />
        </mesh>
        <Line points={[[-half, -layer.to, half], [half, -layer.to, half]]} color="#b9ad91" opacity={0.35} transparent lineWidth={1} />
        <Html position={[-half, y, half]} distanceFactor={10}><span className="scale-scene-label">{layer.label} · {layer.from.toFixed(1)}–{layer.to.toFixed(1)} m</span></Html>
      </group>
    })}
    <mesh position={[0, -depth - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[W, W]} />
      <meshStandardMaterial color="#3b3934" roughness={1} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[W, W]} />
      <meshStandardMaterial color="#477460" transparent opacity={0.42 - illustration * 0.12} roughness={1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    {[0, 1, 2, 3, 4, 5, 6].map((n) => {
      const p = -half + n * W / 6
      return <group key={n}>
        <Line points={[[p, 0.006, -half], [p, 0.006, half]]} color="#90ad8b" opacity={0.25} transparent lineWidth={1} />
        <Line points={[[-half, 0.006, p], [half, 0.006, p]]} color="#90ad8b" opacity={0.25} transparent lineWidth={1} />
      </group>
    })}
    <Line points={[[-half, 0, half], [half, 0, half], [half, -depth, half], [-half, -depth, half], [-half, 0, half]]} color="#b9c0ad" opacity={0.55} transparent lineWidth={1} />
    <Line points={[[half, 0, -half], [half, 0, half], [half, -depth, half], [half, -depth, -half]]} color="#b9c0ad" opacity={0.4} transparent lineWidth={1} />
    <Line points={[[-half, -depth, -half], [half, -depth, -half], [half, -depth, half]]} color="#b9c0ad" opacity={0.35} transparent lineWidth={1} />
  </group>
}

function Grass() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const blades = useMemo(() => {
    let seed = 314159
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 }
    return Array.from({ length: 320 }, () => ({ x: (rand() - 0.5) * W, z: (rand() - 0.5) * W, h: 0.04 + rand() * 0.08, a: rand() * Math.PI }))
  }, [])
  useEffect(() => {
    if (!ref.current) return
    const item = new THREE.Object3D()
    const color = new THREE.Color()
    blades.forEach((b, i) => {
      item.position.set(b.x, b.h / 2, b.z)
      item.rotation.set(0, b.a, (i % 2 ? 1 : -1) * 0.12)
      item.scale.set(1, b.h / 0.08, 1)
      item.updateMatrix()
      ref.current!.setMatrixAt(i, item.matrix)
      color.set(i % 4 === 0 ? '#a7ae69' : i % 3 === 0 ? '#75a778' : '#65986e')
      ref.current!.setColorAt(i, color)
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [blades])
  return <instancedMesh ref={ref} args={[undefined, undefined, blades.length]}>
    <coneGeometry args={[0.013, 0.08, 3]} />
    <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} transparent opacity={0.9} />
  </instancedMesh>
}

function getPeatVisual(region: any, depth: number) {
  const x = Number(region.centerXM ?? region.xM ?? W / 2) - W / 2
  const z = Number(region.centerYM ?? region.yM ?? W / 2) - W / 2
  const d = Number(region.centerDepthM ?? region.depthM ?? Math.min(1.45, depth * 0.5))
  const rx = Number(region.radiusXM ?? region.radiusM ?? (region.sizeXM ?? region.widthM ?? 2.2) / 2)
  const rz = Number(region.radiusYM ?? region.radiusM ?? (region.sizeYM ?? region.lengthM ?? 1.8) / 2)
  const ry = Number(region.radiusDepthM ?? (region.thicknessM ?? 0.84) / 2)
  return { x, z, d, rx: Number.isFinite(rx) ? rx : 1.1, rz: Number.isFinite(rz) ? rz : 0.9, ry: Number.isFinite(ry) ? ry : 0.42 }
}

function PeatAndHotspots({ scenario, depth, timeSeconds }: { scenario: any; depth: number; timeSeconds: number }) {
  const peat = Array.isArray(scenario?.peatRegions) ? scenario.peatRegions : []
  const hot = Array.isArray(scenario?.hotRegions) ? scenario.hotRegions : []
  return <group>
    {peat.map((p: any, i: number) => {
      const v = getPeatVisual(p, depth)
      const shape = p.shape ?? 'ellipsoid'
      return <mesh key={`p${i}`} position={[v.x, -v.d, v.z]} rotation={[0, Number(p.orientationRad ?? p.rotationRad ?? (p.rotationDeg ?? 0) * Math.PI / 180), 0]} scale={[v.rx, v.ry, v.rz]}>
        {shape === 'slab' || shape === 'layer' ? <boxGeometry args={[2, 2, 2]} /> : <sphereGeometry args={[1, shape === 'irregular' ? 14 : 32, 16]} />}
        <meshStandardMaterial color="#7b5546" roughness={1} transparent opacity={0.56} depthWrite={false} side={THREE.DoubleSide} flatShading={shape === 'irregular'} />
      </mesh>
    })}
    {hot.map((h: any, i: number) => {
      const x = Number(h.centerXM ?? h.xM ?? 2.3) - W / 2
      const z = Number(h.centerYM ?? h.yM ?? 3.2) - W / 2
      const d = Number(h.centerDepthM ?? h.depthM ?? 1.25)
      const rx = Number(h.radiusXM ?? h.radiusM ?? (h.sizeXM ?? 0.76) / 2)
      const rz = Number(h.radiusYM ?? h.radiusM ?? (h.sizeYM ?? 0.64) / 2)
      const ry = Number(h.radiusDepthM ?? h.radiusM ?? (h.thicknessM ?? 0.6) / 2)
      return <group key={`h${i}`} position={[x, -d, z]}>
        <mesh scale={[rx * 1.25, ry * 1.25, rz * 1.25]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshBasicMaterial color="#d47e50" transparent opacity={timeSeconds > 0 ? 0.015 : 0.09} depthWrite={false} />
        </mesh>
        <mesh scale={[rx, ry, rz]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color="#a85136" emissive="#ac452c" emissiveIntensity={timeSeconds > 0 ? 0.08 : 0.72} roughness={1} transparent opacity={timeSeconds > 0 ? 0.18 : 0.72} />
        </mesh>
        {timeSeconds <= 0 && <pointLight color="#db7950" intensity={0.32} distance={2.1} />}
      </group>
    })}
  </group>
}

function Pathways({ pathways }: { pathways: any[] }) {
  return <group>{pathways.map((path, i) => <group key={path.id ?? i} position={[Number(path.centerXM ?? W / 2) - W / 2, -Number(path.centerDepthM ?? 1.5), Number(path.centerYM ?? W / 2) - W / 2]} rotation={[0, Number(path.rotationDeg ?? 0) * Math.PI / 180, 0]}>
    <mesh><boxGeometry args={[Number(path.sizeXM ?? 0.3), Number(path.thicknessM ?? 1.5), Number(path.sizeYM ?? 0.3)]} /><meshStandardMaterial color="#6bd5cc" emissive="#317f83" emissiveIntensity={0.25} transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <Line points={[[0, -Number(path.thicknessM ?? 1.5) / 2, 0], [0, Number(path.thicknessM ?? 1.5) / 2, 0]]} color="#9ed6ce" opacity={0.8} transparent lineWidth={1.6} />
  </group>)}</group>
}

function Roots({ root, depth }: { root: any; depth: number }) {
  const lines = useMemo(() => {
    let seed = Number(root?.seed ?? 2357) >>> 0
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 }
    const amount = Number(root?.amountKgM3 ?? 1.5)
    const count = Math.min(52, Math.max(4, Math.round(10 + amount * 3)))
    const maxDepth = Math.min(depth, Number(root?.meanDepthM ?? 0.45) + Number(root?.distributionDepthM ?? 0.45) * 2)
    return Array.from({ length: count }, () => {
      const x = (rand() - 0.5) * W * 0.88
      const z = (rand() - 0.5) * W * 0.88
      const d = maxDepth * (0.35 + 0.65 * rand())
      return [[x, -0.02, z], [x + (rand() - 0.5) * 0.14, -d * 0.38, z + (rand() - 0.5) * 0.14], [x + (rand() - 0.5) * 0.35, -d, z + (rand() - 0.5) * 0.35]] as [number, number, number][]
    })
  }, [root?.seed, root?.amountKgM3, root?.meanDepthM, root?.distributionDepthM, depth])
  return <group>{lines.map((points, i) => <Line key={i} points={points} color={i % 3 === 0 ? '#987457' : '#a98b68'} lineWidth={i % 5 === 0 ? 1.8 : 1} opacity={0.75} transparent />)}</group>
}

function Source({ scenario, snapshot }: { scenario: any; snapshot?: Frame | null }) {
  const src = scenario?.source ?? {}
  const x = Number(src.centerXM ?? 3.45) - W / 2
  const z = Number(src.centerYM ?? 3.05) - W / 2
  const d = Number(src.centerDepthM ?? 1.4)
  const diameter = Number(snapshot?.source?.equivalentDiameterM ?? Math.cbrt(6 * Number(src.initialMassKg ?? 6) / (Math.PI * Number(src.densityKgM3 ?? 1560))))
  const radius = Math.max(0.001, diameter / 2)
  const heaterOn = Boolean(src.enabled) && Number(src.heatGenerationWm3 ?? 0) > 0
  return <group position={[x, -d, z]}>
    <mesh scale={radius}>
      <sphereGeometry args={[1, 36, 24]} />
      <meshPhysicalMaterial color="#b4dee4" emissive="#4f9bb0" emissiveIntensity={0.12} roughness={0.22} metalness={0.04} transparent opacity={0.87} />
    </mesh>
    <mesh scale={Math.min(0.07, radius * 0.35)}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={heaterOn ? '#f5b875' : '#688b98'} emissive={heaterOn ? '#ef883e' : '#1e6573'} emissiveIntensity={heaterOn ? 1.5 : 0.25} />
    </mesh>
    <pointLight color="#94d8ee" intensity={0.35} distance={1.1} />
  </group>
}

function FieldSlice({ scenario, snapshot, overlay, view, slice, fixedScale, onProbe }: Pick<SceneProps, 'scenario' | 'snapshot' | 'overlay' | 'view' | 'slice' | 'fixedScale' | 'onProbe'>) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const grid = snapshot?.grid
  const horizontal = view === 'top'
  const sectionY = view === 'section-y'
  const nx = grid?.nx ?? 0
  const ny = grid?.ny ?? 0
  const nz = grid?.nz ?? 0
  const n = horizontal ? nx * ny : sectionY ? ny * nz : nx * nz
  const selected = horizontal ? Math.min(nz - 1, Math.max(0, Math.round((1 - slice) * (nz - 1) / 2))) : sectionY ? Math.min(nx - 1, Math.max(0, Math.round((slice + 1) * (nx - 1) / 2))) : Math.min(ny - 1, Math.max(0, Math.round((slice + 1) * (ny - 1) / 2)))
  const info = OVERLAY_INFO[overlay]
  const extent = useMemo(() => {
    if (!snapshot || fixedScale) return [info.min, info.max]
    const a = snapshot.fields[info.field]
    if (!a || !a.length) return [info.min, info.max]
    let lo = Infinity; let hi = -Infinity
    for (let i = 0; i < a.length; i++) {
      const v = valueFor(snapshot, overlay, i, Number(scenario?.atmosphere?.pressurePa ?? 101325))
      if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    }
    return Number.isFinite(lo) && hi > lo ? [lo, hi] : [info.min, info.max]
  }, [snapshot, fixedScale, info, overlay, scenario?.atmosphere?.pressurePa])
  useEffect(() => {
    if (!ref.current || !snapshot || !grid || !n) return
    const matrix = new THREE.Object3D()
    const { dxM, dyM, dzM } = grid
    const half = W / 2
    for (let q = 0; q < n; q++) {
      let i: number; let j: number; let k: number
      if (horizontal) { i = q % nx; j = Math.floor(q / nx); k = selected }
      else if (sectionY) { j = q % ny; k = Math.floor(q / ny); i = selected }
      else { i = q % nx; k = Math.floor(q / nx); j = selected }
      const index = (k * ny + j) * nx + i
      const x = -half + (i + 0.5) * dxM
      const z = -half + (j + 0.5) * dyM
      const y = -(k + 0.5) * dzM
      matrix.position.set(x, y, z)
      matrix.rotation.set(0, 0, 0)
      matrix.scale.set(horizontal ? dxM * 0.96 : sectionY ? 0.032 : dxM * 0.96, horizontal ? 0.032 : dzM * 0.96, horizontal ? dyM * 0.96 : sectionY ? dyM * 0.96 : 0.032)
      matrix.updateMatrix()
      ref.current.setMatrixAt(q, matrix.matrix)
      const value = valueFor(snapshot, overlay, index, Number(scenario?.atmosphere?.pressurePa ?? 101325))
      const t = (value - extent[0]) / Math.max(1e-12, extent[1] - extent[0])
      ref.current.setColorAt(q, colorAt(t))
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [snapshot, grid, n, horizontal, sectionY, nx, ny, nz, selected, overlay, extent, scenario?.atmosphere?.pressurePa])
  if (!snapshot || !grid || !n) return null
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.instanceId === undefined) return
    const q = event.instanceId
    let i: number; let j: number; let k: number
    if (horizontal) { i = q % nx; j = Math.floor(q / nx); k = selected }
    else if (sectionY) { j = q % ny; k = Math.floor(q / ny); i = selected }
    else { i = q % nx; k = Math.floor(q / nx); j = selected }
    onProbe?.({ xM: (i + 0.5) * grid.dxM, yM: (j + 0.5) * grid.dyM, depthM: (k + 0.5) * grid.dzM })
    event.stopPropagation()
  }
  return <instancedMesh ref={ref} args={[undefined, undefined, n]} onClick={handleClick}>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial vertexColors transparent opacity={0.76} side={THREE.DoubleSide} depthWrite={false} />
  </instancedMesh>
}

function FlowArrows({ snapshot, view, slice }: { snapshot?: Frame | null; view: View; slice: number }) {
  const arrows = useMemo(() => {
    if (!snapshot) return []
    const fx = snapshot.fields.fluxXMps
    const fy = snapshot.fields.fluxYMps
    const fz = snapshot.fields.fluxZMps
    if (!fx || !fy || !fz) return []
    const { nx, ny, nz, dxM, dyM, dzM } = snapshot.grid
    const output: { position: [number, number, number]; direction: THREE.Vector3; magnitude: number }[] = []
    for (let k = 1; k < nz; k += Math.max(1, Math.floor(nz / 5))) for (let j = 1; j < ny; j += Math.max(1, Math.floor(ny / 5))) for (let i = 1; i < nx; i += Math.max(1, Math.floor(nx / 5))) {
      const q = (k * ny + j) * nx + i
      const v = new THREE.Vector3(fx[q] ?? 0, -(fz[q] ?? 0), fy[q] ?? 0)
      const mag = v.length()
      if (mag <= 1e-14) continue
      if (view === 'section-x' && Math.abs(j / ny * 2 - 1 - slice) > 0.18) continue
      if (view === 'section-y' && Math.abs(i / nx * 2 - 1 - slice) > 0.18) continue
      if (view === 'top' && Math.abs(1 - 2 * k / nz - slice) > 0.18) continue
      output.push({ position: [-W / 2 + (i + 0.5) * dxM, -(k + 0.5) * dzM, -W / 2 + (j + 0.5) * dyM], direction: v.normalize(), magnitude: mag })
    }
    return output.slice(0, 95)
  }, [snapshot, view, slice])
  return <group>{arrows.map((a, i) => <primitive key={i} object={new THREE.ArrowHelper(a.direction, new THREE.Vector3(...a.position), 0.13, 0x9ce6e6, 0.06, 0.04)} />)}</group>
}

function FastEventShells({ scenario, event }: { scenario: any; event: NonNullable<SceneProps['fastEvent']> }) {
  const src = scenario?.source ?? {}
  const center: [number, number, number] = [Number(src.centerXM ?? W / 2) - W / 2, -Number(src.centerDepthM ?? 1.35), Number(src.centerYM ?? W / 2) - W / 2]
  const { run, frame, overlay } = event
  const maxPressure = Math.max(1, run.assumptions.maxSupportedPressurePa - Number(scenario?.atmosphere?.pressurePa ?? 101325))
  const maxDamage = Math.max(...Array.from(frame.shellDamage), 0)
  return <group>
    <group position={center}>
      {run.shellRadiusM.map((radius, i) => {
        const value = overlay === 'pressure' ? (frame.shellPressurePa[i] - Number(scenario?.atmosphere?.pressurePa ?? 101325)) / maxPressure : overlay === 'co2' ? frame.shellCO2MoleFraction[i] : frame.shellDamage[i]
        const t = THREE.MathUtils.clamp(value, 0, 1)
        return <mesh key={i}>
          <sphereGeometry args={[Math.max(0.02, radius), 28, 16]} />
          <meshBasicMaterial color={overlay === 'damage' ? new THREE.Color('#e8ad76').lerp(new THREE.Color('#e55f48'), t) : colorAt(t)} transparent opacity={0.1 + 0.14 * t} wireframe depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      })}
    </group>
    {maxDamage > 0.02 && <group position={[center[0], 0.025, center[2]]}>{Array.from({ length: 7 }, (_, i) => {
      const angle = i * Math.PI * 2 / 7 + 0.2
      const length = Math.min(1.4, 0.3 + maxDamage * 1.1)
      return <Line key={i} points={[[0, 0, 0], [Math.cos(angle) * length, 0, Math.sin(angle) * length]]} color="#ebad83" opacity={Math.min(0.8, maxDamage * 0.9)} transparent lineWidth={1.7} />
    })}</group>}
  </group>
}

function Probe({ position }: { position?: ProbeLocation | null }) {
  if (!position) return null
  return <group position={[position.xM - W / 2, -position.depthM, position.yM - W / 2]}>
    <mesh><sphereGeometry args={[0.07, 16, 12]} /><meshBasicMaterial color="#eaf9e5" /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.11, 0.13, 24]} /><meshBasicMaterial color="#eaf9e5" side={THREE.DoubleSide} /></mesh>
    <Html position={[0, 0.18, 0]} center distanceFactor={8}><span className="probe-scene-label">SENSOR 01</span></Html>
  </group>
}

function SoilMotion({ amount }: { amount: number }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    group.current.children.forEach((piece, i) => {
      const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, amount))) * (0.05 + i * 0.012)
      piece.position.y = lift
      piece.position.x = (-W / 2 + (i + 0.5) * W / 8) + Math.sin(Math.PI * amount) * (i < 4 ? -0.1 : 0.1)
      piece.rotation.z = Math.sin(Math.PI * amount) * (i % 2 ? -1 : 1) * 0.045
    })
  })
  if (amount <= 0) return null
  return <group ref={group}>{Array.from({ length: 8 }, (_, i) => {
    const x = -W / 2 + (i + 0.5) * W / 8
    return <mesh key={i} position={[x, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[W / 8 - 0.025, W - 0.05]} />
      <meshStandardMaterial color={i % 2 ? '#719078' : '#6c896d'} transparent opacity={0.38} side={THREE.DoubleSide} />
    </mesh>
  })}</group>
}

function ScaleLabels({ depth }: { depth: number }) {
  return <group>
    <Html position={[-W / 2, 0.18, W / 2]} distanceFactor={9}><span className="scale-scene-label">0 m</span></Html>
    <Html position={[W / 2, 0.18, W / 2]} distanceFactor={9}><span className="scale-scene-label">6.096 m · 20 ft</span></Html>
    <Html position={[W / 2 + 0.1, -depth, W / 2]} distanceFactor={9}><span className="scale-scene-label">−{depth.toFixed(1)} m</span></Html>
    <Line points={[[-W / 2, -0.08, W / 2 + 0.18], [W / 2, -0.08, W / 2 + 0.18]]} color="#d5d4bd" lineWidth={1.5} />
  </group>
}

function World(props: SceneProps) {
  const depth = Number(props.scenario?.domain?.depthM ?? 3)
  return <>
    <color attach="background" args={['#17242b']} />
    <ambientLight intensity={0.95} />
    <directionalLight position={[5, 9, 4]} intensity={2.2} color="#fff5de" />
    <directionalLight position={[-5, -1, -3]} intensity={0.8} color="#7dcbd4" />
    <CameraRig view={props.view} depth={depth} lockCamera={props.lockCamera} />
    <SoilBlock scenario={props.scenario} depth={depth} illustration={props.illustration} />
    <Grass />
    {props.showRoots && <Roots root={props.scenario?.root} depth={depth} />}
    <PeatAndHotspots scenario={props.scenario} depth={depth} timeSeconds={props.snapshot?.timeSeconds ?? 0} />
    <Pathways pathways={Array.isArray(props.scenario?.pathways) ? props.scenario.pathways : []} />
    <Source scenario={props.scenario} snapshot={props.snapshot} />
    {props.fastEvent ? <FastEventShells scenario={props.scenario} event={props.fastEvent} /> : <FieldSlice {...props} />}
    {!props.fastEvent && props.showFlow && <FlowArrows snapshot={props.snapshot} view={props.view} slice={props.slice} />}
    <Probe position={props.probe} />
    <SoilMotion amount={props.fastEvent ? Math.max(props.illustration, Math.max(...Array.from(props.fastEvent.frame.shellDamage), 0) * 0.65) : props.illustration} />
    <ScaleLabels depth={depth} />
  </>
}

export function Scene(props: SceneProps) {
  return <div className={`scene-canvas ${props.className ?? ''}`}>
    <Canvas orthographic camera={{ position: [8.2, 5.6, 8.5], zoom: 84, near: 0.1, far: 100 }} gl={{ antialias: true, preserveDrawingBuffer: true }} dpr={[1, 1.6]}>
      <World {...props} />
    </Canvas>
    <div className="scene-corner scene-corner-left">X / Y 6.096 × 6.096 m <span>·</span> Z ↓ {Number(props.scenario?.domain?.depthM ?? 3).toFixed(1)} m</div>
    <div className="scene-corner scene-corner-right">GRID {props.snapshot?.grid.nx ?? '–'} × {props.snapshot?.grid.ny ?? '–'} × {props.snapshot?.grid.nz ?? '–'}</div>
  </div>
}
