import * as THREE from 'three'
import { soilDisplayCells } from './WideSoilScene'
import { appearanceRandom } from '../story/fireAppearance'

/** One batched mesh of irregular prisms. Display fragments are not solver cells. */
export function createFireGroundGeometry() {
  const positions: number[] = [], centers: number[] = [], seeds: number[] = []
  const cells = soilDisplayCells()
  const vertex = (x: number, y: number, z: number, center: number[], seed: number) => {
    positions.push(x, y, z); centers.push(...center); seeds.push(seed)
  }
  cells.forEach(({ center, polygon }, cell) => {
    const bands = 6
    for (let band = 0; band < bands; band++) {
      const front = -4 * band / bands, back = -4 * (band + 1) / bands
      const c = [center[0], center[1], (front + back) / 2], seed = appearanceRandom(cell * 17 + band)
      const add = (p: number[], z: number) => vertex(p[0], p[1], z, c, seed)
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const p of [polygon[0], polygon[j], polygon[j + 1]]) add(p, front)
        for (const p of [polygon[0], polygon[j + 1], polygon[j]]) add(p, back)
      }
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length]
        add(a, front); add(a, back); add(b, front)
        add(b, front); add(a, back); add(b, back)
      }
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('displayCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('displaySeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.boundingSphere!.radius += 1.5
  return geometry
}
