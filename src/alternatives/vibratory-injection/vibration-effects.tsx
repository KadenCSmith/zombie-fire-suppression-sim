import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { vibrationPose } from './vibration'

const seed = (i: number) => { const n = Math.sin(i * 71.17 + 4.9) * 43758.5453; return n - Math.floor(n) }
/** Bounded soil grains and dust, not a fracture or soil-response calculation.
 * Declarative GPU resources belong to the reconciler and are disposed on unmount. */
export function VibrationEffects({ time, enabled = true }: { time: number; enabled?: boolean }) {
  const grains = useRef<THREE.InstancedMesh>(null), dust = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree(s => s.invalidate), pose = vibrationPose(time, enabled)
  useLayoutEffect(() => {
    const object = new THREE.Object3D()
    for (let i = 0; i < 48; i++) {
      const age = (pose.time * .8 + seed(i)) % 1, angle = seed(i + 70) * Math.PI * 2
      if (i < 32) {
        const reach = .25 + age * (.25 + seed(i + 40) * .55)
        object.position.set(.4 + Math.cos(angle) * reach, .025 + Math.sin(age * Math.PI) * .11 * pose.amount, -.02 + Math.sin(angle) * reach)
      } else {
        const side = i % 2 ? 1 : -1
        object.position.set(.4 + side * (.28 + seed(i + 80) * .7) + Math.sin(pose.time * 28 + i) * .025 * pose.amount, -.28 - seed(i + 10) * 1.15 + Math.sin(pose.time * 31 + i) * .025 * pose.amount, .045)
      }
      object.rotation.set(i + pose.time, i * .7, pose.time * 1.2 + i)
      object.scale.setScalar((.012 + seed(i + 30) * .018) * pose.amount)
      object.updateMatrix(); grains.current?.setMatrixAt(i, object.matrix)
    }
    for (let i = 0; i < 24; i++) {
      const age = (pose.time * .35 + seed(i + 120)) % 1, angle = seed(i + 150) * Math.PI * 2
      object.position.set(.4 + Math.cos(angle) * (.25 + age * .55), .04 + age * .55, -.02 + Math.sin(angle) * (.25 + age * .5))
      object.rotation.set(0, 0, 0); object.scale.setScalar((.035 + age * .10) * (1 - age) * pose.amount)
      object.updateMatrix(); dust.current?.setMatrixAt(i, object.matrix)
    }
    for (const ref of [grains, dust]) if (ref.current) { ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere() }
    invalidate()
  }, [pose.time, pose.amount, invalidate])
  return <group position={pose.surfacePosition} scale={pose.groundScale} rotation={[0, 0, pose.groundTilt]} userData={{ role: 'authored vibration dust and soil grains; no calculated damage or suppression' }}>
    <instancedMesh ref={grains} args={[undefined, undefined, 48]} raycast={() => null}><icosahedronGeometry args={[1, 0]}/><meshStandardMaterial color="#695237" roughness={1}/></instancedMesh>
    <instancedMesh ref={dust} args={[undefined, undefined, 24]} raycast={() => null}><icosahedronGeometry args={[1, 1]}/><meshBasicMaterial color="#b0a185" transparent opacity={.10 * pose.amount} depthWrite={false}/></instancedMesh>
  </group>
}
