import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/core/Line.js'
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js'
import { useGLTF } from '@react-three/drei/core/Gltf.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { DEFAULT_STUDY_CAGE, STUDY_FRAGMENTS, STUDY_LANDING_TIME, STUDY_PEAT, STUDY_RELEASE_TIME, STUDY_SOURCE, smoothPhase, studyAnimation, studyCageBars, studyFragmentPose, studyObjectRole, studyTime, type StudyCage, type StudyView, type StudyVersion } from './studyModel'

import { buildDebrisReplay, debrisPose, type DebrisReplay } from './studyDynamics'

export type { StudyView } from './studyModel'
export type StudySceneProps = { view: StudyView; time: number; labels: boolean; cage?: StudyCage; resetToken?: number; version?: StudyVersion; launchSpeed?: number }
const MODEL_URL = `${import.meta.env.BASE_URL}models/peat-study.glb`
type Role = ReturnType<typeof studyObjectRole>
type Batch = { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; role: Role; name: string }
type DisplayUniforms = { thermal: { value: number }; cold: { value: number }; warmth: { value: number }; sourceY: { value: number } }

/** Modify private material copies only; the loader cache and solver remain untouched. */
function displayMaterial(original: THREE.Material, role: Role, uniforms: DisplayUniforms, name: string) {
  const material = original.clone() as THREE.MeshStandardMaterial
  if (!material.isMeshStandardMaterial || role === 'natural') return material
  const base = role === 'source' ? 0.1 : role === 'peat' ? 0.3 : name.startsWith('01') ? 0.32 : name.startsWith('02') ? 0.3 : name.startsWith('03') ? 0.26 : 0.23
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uStudyThermal: uniforms.thermal, uStudyCold: uniforms.cold,
      uStudyWarmth: uniforms.warmth, uStudySourceY: uniforms.sourceY,
    })
    shader.vertexShader = 'varying vec3 vStudyWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvStudyWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = `varying vec3 vStudyWorld;
uniform float uStudyThermal;
uniform float uStudyCold;
uniform float uStudyWarmth;
uniform float uStudySourceY;
vec3 studyPalette(float v) {
  vec3 a = vec3(0.045, 0.23, 0.48);
  vec3 b = vec3(0.12, 0.56, 0.57);
  vec3 c = vec3(0.93, 0.61, 0.20);
  vec3 d = vec3(0.91, 0.17, 0.055);
  if (v < 0.38) return mix(a, b, clamp(v / 0.38, 0.0, 1.0));
  if (v < 0.72) return mix(b, c, (v - 0.38) / 0.34);
  return mix(c, d, clamp((v - 0.72) / 0.28, 0.0, 1.0));
}
` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
vec3 hotDelta = (vStudyWorld - vec3(1.4, -0.68, -0.72)) / vec3(1.7, 0.65, 1.4);
vec3 coldDelta = (vStudyWorld - vec3(-1.4, -2.19 + uStudySourceY, 0.0)) / vec3(0.85, 0.9, 0.85);
float hotZone = exp(-1.1 * dot(hotDelta, hotDelta));
float coldZone = exp(-1.1 * dot(coldDelta, coldDelta));
float zone = ${base.toFixed(2)} + 0.98 * uStudyWarmth * hotZone - 0.33 * uStudyCold * coldZone;
diffuseColor.rgb = mix(diffuseColor.rgb, studyPalette(clamp(zone, 0.0, 1.0)), uStudyThermal * 0.93);
`)
  }
  material.customProgramCacheKey = () => `study-overlay-${role}-${base}`
  return material
}

function roleForObject(object: THREE.Object3D, root: THREE.Object3D): { role: Role; name: string } {
  let current: THREE.Object3D | null = object
  while (current && current !== root) {
    const role = studyObjectRole(current.name)
    if (role !== 'natural') return { role, name: current.name }
    current = current.parent
  }
  return { role: 'natural', name: object.name }
}

/** Static geometry is transformed into world space and merged by material/role. */
export function prepareStudyBatches(root: THREE.Object3D, uniforms: DisplayUniforms): Batch[] {
  const groups = new Map<string, { geometries: THREE.BufferGeometry[]; material: THREE.Material; role: Role; name: string }>()
  const transformed = root.clone(true)
  transformed.updateMatrixWorld(true)
  transformed.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return
    const { role, name } = roleForObject(object, transformed)
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const raw = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
    raw.applyMatrix4(object.matrixWorld)
    if (!raw.attributes.normal) raw.computeVertexNormals()
    if (!raw.attributes.uv) raw.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(raw.attributes.position.count * 2), 2))
    // All required glTF standard attributes are retained. Group only compatible layouts.
    const signature = Object.entries(raw.attributes as Record<string, THREE.BufferAttribute>).map(([key, a]) => `${key}:${a.itemSize}:${a.normalized}`).sort().join('|')
    const ranges = raw.groups.length ? raw.groups : [{ start: 0, count: raw.attributes.position.count, materialIndex: 0 }]
    for (const range of ranges) {
      const material = materials[range.materialIndex ?? 0] ?? materials[0]
      const geometry = new THREE.BufferGeometry()
      for (const [key, attr] of Object.entries(raw.attributes)) {
        const attribute = attr as THREE.BufferAttribute
        const values = attribute.array.slice(range.start * attribute.itemSize, (range.start + range.count) * attribute.itemSize)
        geometry.setAttribute(key, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized))
      }
      if (object.matrixWorld.determinant() < 0) {
        const indices = Array.from({ length: geometry.attributes.position.count }, (_, i) => i)
        for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
        geometry.setIndex(indices)
      }
      // Non-indexed meshes are required consistently by mergeGeometries.
      const compatible = geometry.index ? geometry.toNonIndexed() : geometry
      if (compatible !== geometry) geometry.dispose()
      const key = `${material.uuid}|${role}|${role === 'soil' ? name.slice(0, 2) : ''}|${signature}`
      const group = groups.get(key)
      if (group) group.geometries.push(compatible)
      else groups.set(key, { geometries: [compatible], material, role, name })
    }
    raw.dispose()
  })
  return Array.from(groups.values()).map(group => {
    const geometry = mergeGeometries(group.geometries, false)
    if (!geometry) throw new Error(`Unable to prepare the study material ${group.name}`)
    group.geometries.forEach(item => item.dispose())
    geometry.computeBoundingSphere()
    return { geometry, material: displayMaterial(group.material, group.role, uniforms, group.name), role: group.role, name: group.name }
  })
}

function StudyModel({ view, time, version }: Pick<StudySceneProps, 'view' | 'time' | 'version'>) {
  const { scene } = useGLTF(MODEL_URL, false, false)
  const invalidate = useThree(state => state.invalidate)
  const uniforms = useMemo<DisplayUniforms>(() => ({ thermal: { value: 0 }, cold: { value: 0 }, warmth: { value: 1 }, sourceY: { value: 3.5 } }), [])
  const batches = useMemo(() => prepareStudyBatches(scene, uniforms), [scene, uniforms])
  const phase = studyAnimation(time, version)
  useLayoutEffect(() => {
    uniforms.thermal.value = view === 'thermal' ? 1 : 0
    uniforms.cold.value = phase.cold
    uniforms.warmth.value = phase.warmth
    uniforms.sourceY.value = phase.sourceOffsetY
    invalidate()
  }, [view, time, version, phase.cold, phase.warmth, phase.sourceOffsetY, uniforms, invalidate])
  useEffect(() => () => {
    batches.forEach(batch => { batch.geometry.dispose(); batch.material.dispose() })
  }, [batches])
  return <group dispose={null}>
    {batches.map((batch, index) => <mesh key={index} geometry={batch.geometry} material={batch.material}
      position-y={batch.role === 'source' ? phase.sourceOffsetY : 0}
      visible={batch.role !== 'source' || phase.sourceVisible}
      castShadow={batch.role !== 'soil'} receiveShadow />)}
  </group>
}

const tracerVertex = `
uniform float uTime;
uniform float uCold;
uniform float uTransport;
uniform float uStart;
attribute vec4 seed;
varying float vAlpha;
void main() {
  float phase = fract(seed.x + max(0.0, uTime - uStart) * 0.13);
  float reach = uTransport * phase;
  vec3 p = mix(vec3(-1.4, -2.05, 0.22), vec3(1.5, -0.62, 0.22), reach);
  float spread = 0.1 + 0.28 * phase;
  p += vec3(sin(seed.y * 6.283 + uTime * 0.36) * spread, (seed.z - 0.5) * spread * 1.5, (seed.w - 0.5) * 0.18);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 9.0 + 14.0 * seed.z;
  vAlpha = uCold * (0.12 + 0.1 * uTransport) * sin(phase * 3.14159);
}`
const tracerFragment = `
varying float vAlpha;
void main() {
  float radius = length(gl_PointCoord - vec2(0.5));
  float softness = 1.0 - smoothstep(0.0, 0.5, radius);
  gl_FragColor = vec4(0.69, 0.9, 0.97, softness * softness * vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
function TransportTracer({ time, version }: { time: number; version: StudyVersion }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  useFrame(() => {
    if (!material.current) return
    const phase = studyAnimation(time, version), target = material.current.uniforms
    target.uTime.value = studyTime(time)
    target.uCold.value = version === 'original' ? phase.cold : phase.sourceVisible ? 0 : phase.cold * (1 - smoothPhase(time, 12, 17))
    target.uStart.value = version === 'original' ? 8 : STUDY_RELEASE_TIME
    target.uTransport.value = phase.transport
  })
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry()
    const count = 180
    const seed = new Float32Array(count * 4)
    // Independent fixed pseudo-random seeds; replay and scrubbing are deterministic.
    let rng = 89131
    for (let i = 0; i < seed.length; i++) { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; seed[i] = rng / 4294967296 }
    result.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
    result.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4))
    return result
  }, [])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCold: { value: 0 }, uTransport: { value: 0 }, uStart: { value: 9 } }), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry} frustumCulled={false} renderOrder={2}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={tracerVertex} fragmentShader={tracerFragment} transparent depthWrite={false} />
  </points>
}

const expansionVertex = `
uniform float uAge;
attribute vec4 seed;
varying float vAlpha;
void main() {
  float angle = seed.x * 6.283185;
  float vertical = seed.y * 2.0 - 1.0;
  float planar = sqrt(max(0.0, 1.0 - vertical * vertical));
  float radius = (0.25 + 1.5 * (1.0 - exp(-5.0 * uAge))) * (0.5 + 0.5 * seed.w);
  vec3 p = vec3(-1.4, -2.19, 0.15);
  p += vec3(cos(angle) * planar * radius, vertical * radius, abs(sin(angle)) * planar * radius * 0.32);
  // A rising branch makes venting legible from the surface view as well.
  if (seed.z > 0.65) {
    float rise = min(3.6, uAge * 3.0) * (0.75 + 0.25 * seed.w);
    float width = 0.2 + max(0.0, rise - 2.1) * 0.5;
    p = vec3(-1.4 + cos(angle) * width, -2.19 + rise, sin(angle) * width);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 12.0 + 21.0 * seed.w;
  vAlpha = 0.40 * exp(-0.75 * max(0.0, uAge - 0.7)) * (0.6 + 0.4 * seed.y);
}`

function GasExpansion({ time }: { time: number }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  useFrame(() => { if (material.current) material.current.uniforms.uAge.value = studyAnimation(time).releaseAge })
  const { sourceVisible } = studyAnimation(time)
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry(), seed = new Float32Array(420 * 4)
    let rng = 71237
    for (let i = 0; i < seed.length; i++) { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; seed[i] = rng / 4294967296 }
    result.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(420 * 3), 3))
    result.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4))
    return result
  }, [])
  const uniforms = useMemo(() => ({ uAge: { value: 0 } }), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry} visible={!sourceVisible} frustumCulled={false} renderOrder={3}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={expansionVertex} fragmentShader={tracerFragment} transparent depthWrite={false} />
  </points>
}

function MovingFragments({ time, replay }: { time: number; replay: DebrisReplay | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const object = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    if (!mesh.current) return
    STUDY_FRAGMENTS.forEach((seed, i) => {
      const pose = studyFragmentPose(i, time)
      object.position.set(...(replay ? debrisPose(replay, i, time) : pose.position))
      object.rotation.set(...(replay ? seed.spin : pose.rotation))
      const size = seed.surface || time >= STUDY_RELEASE_TIME ? seed.size : 0
      object.scale.set(size, size * 0.7, size * 0.85)
      object.updateMatrix()
      mesh.current!.setMatrixAt(i, object.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [time, object, replay])
  useLayoutEffect(() => {
    if (!mesh.current) return
    STUDY_FRAGMENTS.forEach((seed, i) => mesh.current!.setColorAt(i, new THREE.Color(seed.surface ? '#837a64' : i % 3 ? '#796249' : '#ab9f82')))
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [])
  return <instancedMesh ref={mesh} args={[undefined, undefined, STUDY_FRAGMENTS.length]} frustumCulled={false} castShadow receiveShadow>
    <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={0.98} />
  </instancedMesh>
}

function CraterCage({ time, cage }: { time: number; cage: StudyCage }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const bars = useMemo(() => studyCageBars(cage.heightM, cage.widthM), [cage.heightM, cage.widthM])
  useLayoutEffect(() => {
    if (!mesh.current) return
    const object = new THREE.Object3D(), start = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    bars.forEach((bar, i) => {
      start.set(...bar.start); end.set(...bar.end)
      object.position.copy(start).add(end).multiplyScalar(0.5)
      direction.copy(end).sub(start)
      object.scale.set(0.006, direction.length(), 0.006)
      object.quaternion.setFromUnitVectors(up, direction.normalize())
      object.updateMatrix(); mesh.current!.setMatrixAt(i, object.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [bars])
  const drop = 0.8 * (1 - smoothPhase(time, STUDY_LANDING_TIME, STUDY_LANDING_TIME + 0.8))
  return <group position={[STUDY_SOURCE[0], 0.035 + drop, STUDY_SOURCE[2]]} visible={cage.enabled && time >= STUDY_LANDING_TIME}>
    <instancedMesh key={bars.length} ref={mesh} args={[undefined, undefined, bars.length]} frustumCulled={false} castShadow receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color="#bbc6c8" metalness={0.72} roughness={0.35} />
    </instancedMesh>
  </group>
}

function WarmEmbers({ time }: { time: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const points = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const angle = i * 2.399963
    const radius = 0.28 + 0.9 * Math.sqrt((i + 0.5) / 24)
    return [STUDY_PEAT[0] + Math.cos(angle) * radius, STUDY_PEAT[1] + 0.14 + 0.12 * Math.sin(i * 7), 0.09 + 0.035 * Math.sin(i)]
  }), [])
  useLayoutEffect(() => {
    const object = new THREE.Object3D()
    points.forEach((point, i) => {
      object.position.set(point[0], point[1], point[2]); object.scale.set(0.015 + i % 3 * 0.006, 0.008, 0.018)
      object.updateMatrix(); ref.current?.setMatrixAt(i, object.matrix)
    })
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  }, [points])
  return <instancedMesh ref={ref} args={[undefined, undefined, points.length]}>
    <sphereGeometry args={[1, 5, 3]} />
    <meshStandardMaterial color="#60251b" emissive="#ff5821" emissiveIntensity={studyAnimation(time).warmth * 1.9} roughness={0.96} />
  </instancedMesh>
}

type LabelDescriptor = { id: string; position: [number, number, number]; text: ReactNode; tone?: 'warm' | 'cool' }
function studyLabels(view: StudyView, time: number, cage: StudyCage, version: StudyVersion): LabelDescriptor[] {
  if (view === 'root') return [
    { id: 'root', position: [1.2, 0.45, -0.4], text: 'Living trunk & roots' },
    { id: 'char', position: [0.6, -0.9, 0.35], text: 'Charred peat interface', tone: 'warm' },
  ]
  const result: LabelDescriptor[] = [
    { id: 'source', position: [-1.4, STUDY_SOURCE[1] + studyAnimation(time, version).sourceOffsetY - 0.39, 0.6], text: studyAnimation(time, version).sourceVisible ? 'Dry ice · Ø 0.50 m' : 'CO₂ expansion · visual tracers', tone: 'cool' },
    { id: 'peat', position: [1.5, -0.23, 0.1], text: 'Buried smoldering peat', tone: 'warm' },
  ]
  if (version !== 'original' && cage.enabled && time >= STUDY_LANDING_TIME) result.push({ id: 'cage', position: [-1.4, cage.heightM + 0.5, -0.15], text: `Inverted cage · ${Math.round(cage.heightM * 100)} cm high` })
  if (view !== 'top') result.push({ id: 'depth', position: [-3.25, -1.2, 0.3], text: <>2.44 m<br /><small>Borehole depth</small></> })
  return result
}

/** React owns label DOM throughout resize, error recovery and StrictMode remounts. */
function ProjectLabels({ labels, elements }: { labels: LabelDescriptor[]; elements: RefObject<Map<string, HTMLDivElement>> }) {
  const point = useMemo(() => new THREE.Vector3(), [])
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => { invalidate() }, [labels, invalidate])
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld()
    labels.forEach(label => {
      const element = elements.current.get(label.id)
      if (!element) return
      point.set(...label.position).project(camera)
      element.style.visibility = point.z < -1 || point.z > 1 ? 'hidden' : 'visible'
      element.style.transform = `translate3d(${(point.x + 1) * size.width / 2}px,${(1 - point.y) * size.height / 2}px,0) translate(-50%,-50%)`
    })
  })
  return null
}

function DepthGuide() {
  return <>
    <Line points={[[-2.85, 0, 0.13], [-2.85, -2.44, 0.13]]} color="#dbe7df" lineWidth={1} transparent opacity={0.6} />
    <Line points={[[-3, 0, 0.13], [-2.7, 0, 0.13]]} color="#dbe7df" lineWidth={1} />
    <Line points={[[-3, -2.44, 0.13], [-2.7, -2.44, 0.13]]} color="#dbe7df" lineWidth={1} />
  </>
}

function CameraRig({ view, resetToken }: Pick<StudySceneProps, 'view' | 'resetToken'>) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const transition = useRef<{ elapsed: number; position: THREE.Vector3; target: THREE.Vector3; zoom: number; toPosition: THREE.Vector3; toTarget: THREE.Vector3; toZoom: number } | null>(null)
  const initialized = useRef(false)
  useEffect(() => {
    const focus = view === 'root' ? new THREE.Vector3(1.35, -0.32, -0.6) : view === 'top' ? new THREE.Vector3(0, -0.18, -1.75) : new THREE.Vector3(0, -0.18, -0.75)
    const position = view === 'top' ? new THREE.Vector3(0, 16, -1.7) : view === 'root' ? new THREE.Vector3(3.2, 1.8, 6.8) : new THREE.Vector3(6.2, 4.4, 13.5)
    const height = view === 'root' ? 4.6 : view === 'top' ? 6.4 : 7.7
    const zoom = Math.min(size.height / height, size.width / (view === 'root' ? 5.8 : view === 'top' ? 10.4 : 11.8))
    if (!initialized.current) {
      camera.position.copy(position); camera.zoom = zoom; camera.lookAt(focus); camera.updateProjectionMatrix()
      controls.current?.target.copy(focus); controls.current?.update(); initialized.current = true
    } else transition.current = {
      elapsed: 0, position: camera.position.clone(), target: controls.current?.target.clone() ?? focus.clone(), zoom: camera.zoom,
      toPosition: position, toTarget: focus, toZoom: zoom,
    }
    invalidate()
  }, [view, resetToken, size.height, size.width, camera, invalidate])
  useFrame((_, delta) => {
    const step = transition.current
    if (!step) return
    step.elapsed = Math.min(1, step.elapsed + Math.min(delta, 0.05) / 0.85)
    const progress = step.elapsed * step.elapsed * (3 - 2 * step.elapsed)
    camera.position.lerpVectors(step.position, step.toPosition, progress)
    camera.zoom = THREE.MathUtils.lerp(step.zoom, step.toZoom, progress)
    camera.updateProjectionMatrix()
    controls.current?.target.lerpVectors(step.target, step.toTarget, progress)
    controls.current?.update()
    if (step.elapsed >= 1) transition.current = null
    else invalidate()
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minZoom={18} maxZoom={240}
    minPolarAngle={0.01} maxPolarAngle={Math.PI * 0.58} onStart={() => { transition.current = null }} />
}

function ModelReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady])
  return null
}
class SceneBoundary extends Component<{ children: ReactNode; onRetry: () => void; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() {
    if (this.state.failed) return <div className="study-scene-status" role="alert">
      <strong>The 3D study could not load.</strong><p>Check the connection and try again.</p>
      <button onClick={this.props.onRetry}>Reload the view</button>
    </div>
    return this.props.children
  }
}

export function StudyScene({ view, time, labels, cage = DEFAULT_STUDY_CAGE, resetToken = 0, version = 'dynamics', launchSpeed = 2.8 }: StudySceneProps) {
  const [retry, setRetry] = useState(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const replay = useMemo(() => version === 'dynamics' ? buildDebrisReplay(cage, launchSpeed) : null, [version, cage.enabled, cage.heightM, cage.widthM, launchSpeed])
  const labelElements = useRef(new Map<string, HTMLDivElement>())
  const descriptors = useMemo(() => labels && ready ? studyLabels(view, time, cage, version) : [], [labels, ready, view, time, cage, version])
  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => { setFailed(true); setReady(false) }, [])
  return <div className="study-scene" style={{ width: '100%', height: '100%', position: 'relative', minHeight: 300 }}>
    <SceneBoundary key={retry} onError={onError} onRetry={() => { useGLTF.clear(MODEL_URL); setReady(false); setFailed(false); setRetry(value => value + 1) }}>
      <Canvas orthographic frameloop="demand" dpr={[1, 1.65]} shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [6.2, 4.4, 13.5], near: 0.1, far: 100, zoom: 58 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#152329']} />
        <fog attach="fog" args={['#152329', 27, 60]} />
        <ambientLight intensity={0.85} color="#d5e7e1" />
        <hemisphereLight intensity={1.5} color="#dcece3" groundColor="#645340" />
        <directionalLight position={[-4, 10, 7]} intensity={3.2} color="#fff0d7" castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={0.03} shadow-bias={-0.0001} />
        <directionalLight position={[6, 3, -6]} intensity={1.4} color="#9bd6ed" />
        <Suspense fallback={null}>
          <StudyModel view={view} time={time} version={version} />
          {version !== 'original' && <><GasExpansion time={time} /><MovingFragments time={time} replay={replay} /><CraterCage time={time} cage={cage} /></>}
          <TransportTracer time={time} version={version} />
          <WarmEmbers time={time} />
          {labels && view !== 'top' && view !== 'root' && <DepthGuide />}
          <ModelReady onReady={onReady} />
        </Suspense>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.215, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} /><meshStandardMaterial color="#18282d" roughness={1} />
        </mesh>
        <CameraRig view={view} resetToken={resetToken} />
        <ProjectLabels labels={descriptors} elements={labelElements} />
      </Canvas>
    </SceneBoundary>
    {!ready && !failed && <div className="study-scene-status" role="status">Loading the peat study…</div>}
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 3 }}>
      {descriptors.map(label => <div key={label.id} ref={element => { if (element) labelElements.current.set(label.id, element); else labelElements.current.delete(label.id) }}
        style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-10000px,-10000px)' }}>
        <span className={`study-scene-label${label.tone ? ` study-scene-label--${label.tone}` : ''}`}>{label.text}</span>
      </div>)}
    </div>
  </div>
}
