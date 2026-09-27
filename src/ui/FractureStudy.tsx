import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BURIED_PEAT, SOIL_GRID, sampleSoil, shellPlacement, soilFrame, type SoilReplay } from './soilParticleModel'
import { STUDY_SOURCE, STUDY_RELEASE_TIME, studyAnimation } from './studyModel'

export function createSoilTexture() {
  const texture = new THREE.DataTexture(new Float32Array(SOIL_GRID.nx * SOIL_GRID.ny * 4), SOIL_GRID.nx, SOIL_GRID.ny, THREE.RGBAFormat, THREE.FloatType)
  texture.minFilter = texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
}
export function updateSoilTexture(texture: THREE.DataTexture, replay: SoilReplay, time: number) {
  const data = texture.image.data as Float32Array, f = soilFrame(replay, time)
  for (let n = 0; n < replay.count; n++) {
    for (let a = 0; a < 2; a++) data[n * 4 + a] = replay.frames[(f.first * replay.count + n) * 2 + a] * (1 - f.mix) + replay.frames[(f.second * replay.count + n) * 2 + a] * f.mix
    data[n * 4 + 2] = replay.damage[f.first * replay.count + n]
  }
  texture.needsUpdate = true
}

// Bilinear displacement interpolation at the original x/y; z is only a display
// extrusion/falloff, not another simulated dimension.
export const soilVertexFields = `
uniform sampler2D uSoilField;
vec2 soilOffset(vec3 p) {
  vec2 grid = clamp(vec2((p.x + 4.0) / 8.0 * 48.0, (p.y + 3.2) / 3.2 * 24.0), vec2(0.0), vec2(48.0,24.0));
  vec2 cell = min(floor(grid), vec2(47.0,23.0));
  vec2 f = grid - cell;
  vec2 a = texture2D(uSoilField, (cell + vec2(0.5,0.5)) / vec2(49.0,25.0)).xy;
  vec2 b = texture2D(uSoilField, (cell + vec2(1.5,0.5)) / vec2(49.0,25.0)).xy;
  vec2 c = texture2D(uSoilField, (cell + vec2(0.5,1.5)) / vec2(49.0,25.0)).xy;
  vec2 d = texture2D(uSoilField, (cell + vec2(1.5,1.5)) / vec2(49.0,25.0)).xy;
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y) * exp(-p.z*p.z/2.0);
}
`

export function BondedSoil({ replay, time }: { replay: SoilReplay; time: number }) {
  const particles = useRef<THREE.InstancedMesh>(null)
  const cracks = useMemo(() => new THREE.BufferGeometry(), [])
  const lines = useMemo(() => new Float32Array(replay.bonds.length * 6), [replay])
  const object = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    const f = soilFrame(replay, time)
    if (!particles.current) return
    for (let n = 0; n < replay.count; n++) {
      const x = replay.rest[n * 2], y = replay.rest[n * 2 + 1]
      const offset = sampleSoil(replay, x, y, time), damage = replay.damage[f.first * replay.count + n]
      object.position.set(x + offset[0], y + offset[1], 0.045 + (n % 3) * 0.006)
      // Contact particles mark the cut face. Use small grains rather than a grid
      // of whole finite volumes; deformation comes from the same nodal field.
      const visible = replay.active[n] && time >= STUDY_RELEASE_TIME && (damage > 0 || Math.hypot(...offset) > 0.005)
      object.scale.setScalar(visible ? 0.013 + damage * 0.018 : 0)
      object.rotation.set(n * 1.7, n * 0.3, n)
      object.updateMatrix(); particles.current.setMatrixAt(n, object.matrix)
      particles.current.setColorAt(n, new THREE.Color(damage > 0 ? '#b19a75' : '#76674f'))
    }
    particles.current.instanceMatrix.needsUpdate = true
    if (particles.current.instanceColor) particles.current.instanceColor.needsUpdate = true
    let cursor = 0
    for (const bond of replay.bonds) if (bond.breakTime <= f.age) {
      const ax = replay.rest[bond.a * 2], ay = replay.rest[bond.a * 2 + 1], bx = replay.rest[bond.b * 2], by = replay.rest[bond.b * 2 + 1]
      const u = sampleSoil(replay, ax, ay, time), v = sampleSoil(replay, bx, by, time)
      const mx = (ax + bx + u[0] + v[0]) / 2, my = (ay + by + u[1] + v[1]) / 2
      const nx = -(by - ay) / bond.length * 0.07, ny = (bx - ax) / bond.length * 0.07
      lines.set([mx - nx, my - ny, 0.071, mx + nx, my + ny, 0.071], cursor); cursor += 6
    }
    if (!cracks.attributes.position) cracks.setAttribute('position', new THREE.BufferAttribute(lines, 3))
    cracks.attributes.position.needsUpdate = true
    cracks.setDrawRange(0, cursor / 3)
  }, [replay, time, lines, cracks, object])
  useEffect(() => () => cracks.dispose(), [cracks])
  return <>
    <instancedMesh ref={particles} args={[undefined, undefined, replay.count]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={1} /></instancedMesh>
    <lineSegments geometry={cracks} frustumCulled={false}><lineBasicMaterial color="#211913" transparent opacity={0.85} /></lineSegments>
  </>
}

export function ConcaveCap({ replay, time }: { replay: SoilReplay; time: number }) {
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry(), vertices: number[] = [], indices: number[] = []
    const rings = 12, segments = 64, radius = 0.35
    for (let ring = 0; ring <= rings; ring++) for (let s = 0; s <= segments; s++) {
      const r = ring / rings * radius, a = s / segments * Math.PI * 2
      vertices.push(Math.cos(a) * r, 0.1 * (1 - (r / radius) ** 2), Math.sin(a) * r)
    }
    for (let ring = 0; ring < rings; ring++) for (let s = 0; s < segments; s++) {
      const a = ring * (segments + 1) + s, b = a + segments + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); result.setIndex(indices); result.computeVertexNormals(); return result
  }, [])
  useLayoutEffect(() => {
    const f = soilFrame(replay, time), flex = replay.cap[f.first] * (1 - f.mix) + replay.cap[f.second] * f.mix
    const attr = geometry.attributes.position
    for (let i = 0; i < attr.count; i++) {
      const radius2 = (attr.getX(i) ** 2 + attr.getZ(i) ** 2) / 0.35 ** 2
      attr.setY(i, 0.1 * (1 - radius2) + flex * (1 - radius2) ** 2)
    }
    attr.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere()
  }, [geometry, replay, time])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <group position={[STUDY_SOURCE[0], shellPlacement(time), 0]} visible={time >= 4.35}>
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#a6b2b7" metalness={0.75} roughness={0.32} side={THREE.DoubleSide} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.009, 8, 64]} /><meshStandardMaterial color="#67797f" metalness={0.7} roughness={0.4} /></mesh>
  </group>
}

export function DeepPeat({ replay, time }: { replay: SoilReplay; time: number }) {
  const offset = sampleSoil(replay, BURIED_PEAT.x, BURIED_PEAT.y, time)
  const fibers = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => { const shape = new THREE.Shape(); for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, r = 1 + 0.04 * Math.sin(3 * a) + 0.02 * Math.sin(7 * a); const x = Math.cos(a) * 1.2 * r, y = Math.sin(a) * 0.5 * r; if (!i) shape.moveTo(x, y); else shape.lineTo(x, y) } shape.closePath(); const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false, curveSegments: 48 }); g.translate(0, 0, -0.55); return g }, [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    for (let i = 0; i < 480; i++) {
      const a = i * 2.399963, r = Math.sqrt(((Math.sin(i * 91.73 + 3.1) * 43758.5) % 1 + 1) % 1)
      const x = Math.cos(a) * r * 1.17, y = Math.sin(a) * r * 0.47
      const burning = (x / 0.52) ** 2 + (y / 0.23) ** 2 < 1
      o.position.set(x, y, 0.065 + (i % 5) * 0.003); o.scale.set(0.008 + i % 3 * 0.003, 0.04, 0.008); o.rotation.set(0, 0, a); o.updateMatrix()
      fibers.current?.setMatrixAt(i, o.matrix); fibers.current?.setColorAt(i, new THREE.Color(burning ? i % 9 === 0 ? '#fc6b2e' : '#221f19' : i % 3 ? '#664a2d' : '#a18751'))
    }
    if (fibers.current) { fibers.current.instanceMatrix.needsUpdate = true; if (fibers.current.instanceColor) fibers.current.instanceColor.needsUpdate = true }
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <group position={[BURIED_PEAT.x + offset[0], BURIED_PEAT.y + offset[1], 0]}>
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#735335" roughness={1} /></mesh>
    <mesh position={[0, 0, 0.06]} scale={[0.55, 0.24, 0.035]}><sphereGeometry args={[1, 32, 16]} /><meshStandardMaterial color="#241b13" emissive="#792000" emissiveIntensity={0.35 * studyAnimation(time).warmth} roughness={1} /></mesh>
    <instancedMesh ref={fibers} args={[undefined, undefined, 480]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={1} /></instancedMesh>
  </group>
}
