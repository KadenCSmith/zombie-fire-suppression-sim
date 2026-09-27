import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { soilVertexFields } from './FractureStudy'

type Point = [number, number, number]
type Limb = { points: Point[]; radius: number; tip: number }
const BASE: Point = [1.4, 0, -0.08]
/** Illustrative young bur oak. Depth is a scenario assumption, not a growth model.
 * Every descending root starts at the root collar or a connected lateral. */
export function oakStructure() {
  const wood: Limb[] = [{ points: [BASE, [1.43, 0.75, -0.09], [1.32, 1.4, -0.12], [1.51, 2.1, -0.14], [1.45, 3.18, -0.2]], radius: 0.19, tip: 0.015 }]
  const roots: Limb[] = []
  const tips: Point[] = []
  for (let i = 0; i < 11; i++) {
    const a = i * 2.399963, start: Point = [1.4 + Math.sin(i) * 0.07, 0.95 + i * 0.145, -0.1]
    const reach = 1.45 - i * 0.065
    const end: Point = [1.4 + Math.cos(a) * reach, 2.15 + i * 0.095, -0.15 + Math.sin(a) * reach * 0.75]
    const elbow: Point = [(start[0] + end[0]) / 2, start[1] + 0.28, (start[2] + end[2]) / 2]
    wood.push({ points: [start, elbow, end], radius: 0.074 - i * 0.003, tip: 0.01 })
    for (let j = 0; j < 5; j++) {
      const t = 0.4 + j * 0.12
      const origin = new THREE.CatmullRomCurve3([start, elbow, end].map(p => new THREE.Vector3(...p))).getPoint(t)
      const b = a + (j % 2 ? 0.9 : -0.9)
      const tip: Point = [origin.x + Math.cos(b) * 0.45, origin.y + 0.35 + j * 0.03, origin.z + Math.sin(b) * 0.38]
      wood.push({ points: [origin.toArray(), [(origin.x + tip[0]) / 2, origin.y + 0.23, (origin.z + tip[2]) / 2], tip], radius: 0.021, tip: 0.0025 })
      tips.push(tip)
    }
  }
  // Broad laterals near the aerated surface, plus roots receding into the section.
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9
    const end: Point = [1.4 + Math.cos(a) * 2.05, -0.26 - (i % 3) * 0.11, -0.08 - Math.abs(Math.sin(a)) * 1.65]
    if (i === 0 || i === 4 || i === 5) end[2] = 0.08
    const middle: Point = [1.4 + Math.cos(a) * 0.6, -0.12, end[2] * 0.45]
    roots.push({ points: [BASE, middle, end], radius: 0.12, tip: 0.012 })
    for (let j = 0; j < 4; j++) {
      const start = new THREE.CatmullRomCurve3([BASE, middle, end].map(p => new THREE.Vector3(...p))).getPoint(0.42 + j * 0.16)
      roots.push({ points: [start.toArray(), [start.x + Math.cos(a + 0.65) * 0.23, start.y - 0.12, start.z], [start.x + Math.cos(a + 0.65) * 0.47, start.y - 0.25, start.z + 0.015]], radius: 0.016, tip: 0.0015 })
    }
  }
  const deep: Point[][] = [
    [BASE, [1.7, -0.5, 0.06], [2.35, -1.06, 0.08], [2.7, -1.8, 0.08], [2.45, -2.7, 0.08]],
    [BASE, [0.85, -0.45, 0.09], [0.18, -1.02, 0.09], [-0.08, -1.8, 0.09], [0.18, -2.55, 0.08]],
    [BASE, [1.37, -0.5, -0.4], [1.13, -1.4, -0.7], [1.32, -2.65, -0.7]],
  ]
  for (const points of deep) {
    roots.push({ points, radius: 0.105, tip: 0.009 })
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
    for (let j = 0; j < 9; j++) {
      const p = curve.getPoint(0.3 + j * 0.075), side = j % 2 ? 1 : -1
      const end: Point = [p.x + side * 0.35, p.y - 0.21, p.z + 0.006]
      roots.push({ points: [p.toArray(), [p.x + side * 0.22, p.y - 0.04, p.z], end], radius: 0.022 - j * 0.0016, tip: 0.0015 })
    }
  }
  return { wood, roots, tips }
}
function taperedGeometry(limbs: Limb[]) {
  const parts = limbs.map(limb => {
    const curve = new THREE.CatmullRomCurve3(limb.points.map(p => new THREE.Vector3(...p)))
    const segments = 24, radial = 8, geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false)
    const attr = geometry.attributes.position
    for (let s = 0; s <= segments; s++) {
      const t = s / segments, center = curve.getPointAt(t), radius = limb.tip + (limb.radius - limb.tip) * (1 - t) ** 1.25
      for (let j = 0; j <= radial; j++) {
        const index = s * (radial + 1) + j
        const p = new THREE.Vector3().fromBufferAttribute(attr, index).sub(center).multiplyScalar(radius * (1 + 0.075 * Math.sin(j * 5 + s * 0.3))).add(center)
        attr.setXYZ(index, p.x, p.y, p.z)
      }
    }
    geometry.computeVertexNormals(); return geometry
  })
  const result = mergeGeometries(parts)!
  parts.forEach(g => g.dispose()); return result
}
function oakLeaf() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  const widths = [0.04, 0.15, 0.1, 0.22, 0.07, 0.25, 0.17, 0.22, 0.11]
  for (let i = 0; i < widths.length; i++) shape.quadraticCurveTo(widths[i], (i + 0.5) / 10, widths[i] * 0.72, (i + 1) / 10)
  shape.quadraticCurveTo(0.07, 1.02, 0, 1)
  for (let i = widths.length - 1; i >= 0; i--) shape.quadraticCurveTo(-widths[i], (i + 0.6) / 10, -widths[i] * 0.72, i / 10)
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape, 3)
  const p = geometry.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.08 * Math.sin(p.getY(i) * Math.PI) - p.getX(i) ** 2 * 0.5)
  geometry.computeVertexNormals(); return geometry
}
export function OakTree({ soilTexture }: { soilTexture: THREE.DataTexture }) {
  const foliage = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(() => oakStructure(), [])
  const geometry = useMemo(() => ({ wood: taperedGeometry(data.wood), roots: taperedGeometry(data.roots), leaf: oakLeaf() }), [data])
  const materials = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ color: '#766046', roughness: 0.97 })
    const root = bark.clone()
    const addBark = (material: THREE.MeshStandardMaterial, underground: boolean) => {
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vOak;\n' + (underground ? soilVertexFields : '') + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOak = position;\n' + (underground ? 'transformed.xy += soilOffset(position);' : ''))
        if (underground) shader.uniforms.uSoilField = { value: soilTexture }
        shader.fragmentShader = 'varying vec3 vOak;\n' + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat grain = sin(vOak.x*140.0 + sin(vOak.y*11.0)*1.2) * sin(vOak.z*135.0 + vOak.y*2.0);\ndiffuseColor.rgb *= 0.77 + 0.23*smoothstep(-0.5,0.8,grain);')
      }
      material.customProgramCacheKey = () => `oak-bark-${underground}`
    }
    addBark(bark, false); addBark(root, true)
    return { bark, root }
  }, [soilTexture])
  useLayoutEffect(() => {
    const object = new THREE.Object3D()
    data.tips.forEach((tip, k) => {
      for (let j = 0; j < 36; j++) {
        const i = k * 36 + j, a = i * 2.399963, r = 0.08 + 0.32 * Math.sqrt(j / 36)
        object.position.set(tip[0] + Math.cos(a) * r, tip[1] + Math.sin(j * 1.3) * 0.27, tip[2] + Math.sin(a) * r)
        object.rotation.set(Math.sin(i) * 1.3, a, Math.sin(i * 1.7) * 1.8)
        object.scale.setScalar(0.14 + (i % 7) * 0.011); object.updateMatrix()
        foliage.current?.setMatrixAt(i, object.matrix)
        foliage.current?.setColorAt(i, new THREE.Color(['#4b6a2b', '#627d36', '#799343', '#8c9950', '#536735'][i % 5]))
      }
    })
    if (foliage.current) { foliage.current.instanceMatrix.needsUpdate = true; if (foliage.current.instanceColor) foliage.current.instanceColor.needsUpdate = true }
  }, [data])
  useEffect(() => () => { Object.values(geometry).forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose()) }, [geometry, materials])
  return <group>
    <mesh geometry={geometry.wood} material={materials.bark} castShadow receiveShadow />
    <mesh geometry={geometry.roots} material={materials.root} receiveShadow />
    <instancedMesh ref={foliage} args={[geometry.leaf, undefined, data.tips.length * 36]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial roughness={0.86} side={THREE.DoubleSide} />
    </instancedMesh>
  </group>
}
