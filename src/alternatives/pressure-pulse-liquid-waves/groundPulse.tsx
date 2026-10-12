import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import { liquidContactPath } from './animation'

/** Finite presentation mesh only, never a mechanics mesh or material law. */
export function fissureVertices(branch: number, opening: number, strength: number, bank: -1 | 0 | 1) {
  const positions: number[] = [], extent = Math.min(1, opening * 1.12 + .08)
  const point = (u: number, edge: number): [number, number, number] => {
    const p = liquidContactPath(branch, u * extent)
    const next = liquidContactPath(branch, Math.min(1, u * extent + .005))
    const previous = liquidContactPath(branch, Math.max(0, u * extent - .005))
    const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy) || 1
    const uneven = .8 + .2 * Math.sin(u * 23 + branch * 3)
    const gap = (.008 + opening * .037 + strength * .05) * uneven * Math.sin(Math.PI * u) ** .35
    const offset = bank === 0 ? edge * gap : bank * (gap + edge * (.045 + opening * .018))
    return [p[0] - dy / length * offset, p[1] + dx / length * offset,
      p[2] + (bank === 0 ? .005 : .02 + strength * .1 * (1 - edge) * Math.sin(Math.PI * u))]
  }
  for (let i = 0; i < 40; i++) {
    const a = point(i / 40, bank === 0 ? -1 : 0), b = point(i / 40, 1)
    const c = point((i + 1) / 40, bank === 0 ? -1 : 0), d = point((i + 1) / 40, 1)
    for (const p of [a, b, c, b, d, c]) positions.push(...p)
  }
  return positions
}

function FissureStrip({ branch, opening, strength, bank }: { branch: number; opening: number; strength: number; bank: -1 | 0 | 1 }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(fissureVertices(branch, opening, strength, bank), 3))
    g.computeVertexNormals()
    return g
  }, [branch, opening, strength, bank])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow>
    <meshStandardMaterial color={bank === 0 ? '#0b0906' : '#61503a'} roughness={1} side={DoubleSide}/>
  </mesh>
}

export function GroundFissures({ opening, strength }: { opening: number; strength: number }) {
  if (opening <= 0) return null
  return <group userData={{ scientificRole: 'Authored moving crack banks, no computed fracture, strain or displacement' }}>
    {[-3, -2, -1, 0, 1, 2, 3].map(branch => <group key={branch}>
      {([-1, 0, 1] as const).map(bank => <FissureStrip key={bank} branch={branch} opening={opening} strength={strength} bank={bank}/>)}
    </group>)}
  </group>
}
