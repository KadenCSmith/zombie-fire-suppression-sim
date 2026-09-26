import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { prepareStudyBatches } from '../src/ui/StudyScene'

const assetPath = new URL('../public/models/peat-study.glb', import.meta.url)
const metadataPath = new URL('../public/models/peat-study.manifest.json', import.meta.url)

describe('portable approved study asset', () => {
  it('matches its manifest and has no external resource dependencies or baked animation', () => {
    const asset = readFileSync(assetPath)
    const manifest = JSON.parse(readFileSync(metadataPath, 'utf8'))
    expect(createHash('sha256').update(asset).digest('hex')).toBe(manifest.asset_sha256)
    expect(asset.length).toBe(manifest.bytes)
    expect(asset.toString('utf8', 0, 4)).toBe('glTF')
    const jsonLength = asset.readUInt32LE(12)
    const document = JSON.parse(asset.toString('utf8', 20, 20 + jsonLength))
    for (const resource of [...document.buffers, ...document.images]) expect(resource.uri).toBeUndefined()
    expect(document.animations ?? []).toHaveLength(0)
    expect(document.nodes.some((node: { name: string }) => node.name === manifest.source_object)).toBe(true)
  })

  it('batches all triangles at their world positions without mutating or disposing loader-owned resources', async () => {
    const asset = readFileSync(assetPath)
    const loader = new GLTFLoader()
    // Geometry and material parsing use the real loader; bitmap decoding is a browser check.
    loader.register(() => ({ name: 'headless-textures', loadTexture: async () => new THREE.Texture() }))
    const { scene } = await loader.parseAsync(asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength), '')
    scene.updateMatrixWorld(true)
    const before = new THREE.Box3().setFromObject(scene)
    let triangles = 0
    let originalDisposed = 0
    let meshCount = 0
    const originalMaterials = new Set<THREE.Material>()
    const originalTextures = new Set<THREE.Texture>()
    const originalPositions = new Map<string, number[]>()
    scene.traverse(object => {
      originalPositions.set(object.uuid, object.position.toArray())
      if (!(object instanceof THREE.Mesh)) return
      meshCount++
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
      object.geometry.addEventListener('dispose', () => originalDisposed++)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => originalMaterials.add(material))
    })
    originalMaterials.forEach(material => {
      material.addEventListener('dispose', () => originalDisposed++)
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) originalTextures.add(value) })
    })
    originalTextures.forEach(texture => texture.addEventListener('dispose', () => originalDisposed++))
    const uniforms = { thermal: { value: 0 }, cold: { value: 0 }, warmth: { value: 1 }, sourceY: { value: 0 } }
    const batches = prepareStudyBatches(scene, uniforms)
    expect(batches.length).toBeLessThan(meshCount / 10)
    expect(batches.reduce((sum, batch) => sum + batch.geometry.attributes.position.count / 3, 0)).toBe(triangles)
    const after = new THREE.Box3()
    const source = new THREE.Box3()
    for (const batch of batches) {
      batch.geometry.computeBoundingBox()
      after.union(batch.geometry.boundingBox!)
      if (batch.role === 'source') source.union(batch.geometry.boundingBox!)
      expect(originalMaterials.has(batch.material)).toBe(false)
    }
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-5)
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-5)
    expect(source.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(-1.4, -2.19, 0))).toBeLessThan(0.001)
    const diameter = source.getSize(new THREE.Vector3())
    expect(diameter.x).toBeCloseTo(0.5, 3)
    expect(diameter.y).toBeCloseTo(0.5, 3)
    expect(diameter.z).toBeCloseTo(0.5, 3)
    expect(batches.some(batch => batch.role === 'peat')).toBe(true)
    expect(batches.filter(batch => batch.role === 'soil').length).toBeGreaterThanOrEqual(4)
    scene.traverse(object => expect(object.position.toArray()).toEqual(originalPositions.get(object.uuid)))
    batches.forEach(batch => { batch.material.dispose(); batch.geometry.dispose() })
    expect(originalDisposed).toBe(0)
    // A fresh mount can prepare the same cached model after a previous viewer unmounts.
    const remount = prepareStudyBatches(scene, uniforms)
    expect(remount.length).toBe(batches.length)
    remount.forEach(batch => { batch.material.dispose(); batch.geometry.dispose() })
    expect(originalDisposed).toBe(0)
    console.info(`Study asset: ${meshCount} meshes → ${batches.length} batches; ${triangles} triangles preserved`)
  })
})
