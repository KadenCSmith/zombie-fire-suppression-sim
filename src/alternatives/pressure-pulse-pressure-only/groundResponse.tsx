import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import { pressureSoilPoint } from './animation'

/** Owned cutaway lips move; the original ground is never modified. */
export function pressureBankVertices(branch: number, opening: number, jolt: number, settled: number, bank: -1 | 0 | 1) {
  const vertices: number[] = []
  const point = (u: number, edge: number): [number, number, number] => {
    const p = pressureSoilPoint(branch, u)
    const a = pressureSoilPoint(branch, Math.max(0, u - .01)), b = pressureSoilPoint(branch, Math.min(1, u + .01))
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1
    const taper = Math.sin(Math.PI * u) ** .35
    const gap = (.012 + .045 * opening + .035 * jolt) * taper
    const across = bank === 0 ? edge * gap : bank * (gap + edge * (.04 + opening * .02))
    return [p[0] - dy / length * across,
      p[1] + dx / length * across + (.07 * jolt - .035 * settled) * taper,
      p[2] + (bank === 0 ? .003 : .022 + .13 * jolt * taper * (1 - edge))]
  }
  for (let i = 0; i < 32; i++) {
    const a = point(i / 32, bank === 0 ? -1 : 0), b = point(i / 32, 1)
    const c = point((i + 1) / 32, bank === 0 ? -1 : 0), d = point((i + 1) / 32, 1)
    for (const p of [a, b, c, b, d, c]) vertices.push(...p)
  }
  return vertices
}

function EarthBank({ branch, opening, jolt, settled, bank }: {
  branch: number; opening: number; jolt: number; settled: number; bank: -1 | 0 | 1
}) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pressureBankVertices(branch, opening, jolt, settled, bank), 3))
    g.computeVertexNormals()
    return g
  }, [branch, opening, jolt, settled, bank])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow>
    <meshStandardMaterial color={bank === 0 ? '#120d08' : bank === 1 ? '#766247' : '#5b4b36'} roughness={1} side={DoubleSide}/>
  </mesh>
}

export function PressureGround({ opening, jolt, settled }: { opening: number; jolt: number; settled: number }) {
  if (opening <= 0) return null
  return <group userData={{ scientificRole: 'Authored earth jolt and settling hypothesis; no computed mechanics or suppression' }}>
    {Array.from({ length: 8 }, (_, branch) => <group key={branch}>
      {([-1, 0, 1] as const).map(bank => <EarthBank key={bank} branch={branch} opening={opening} jolt={jolt} settled={settled} bank={bank}/>)}
    </group>)}
  </group>
}
