import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { DataTexture, LinearFilter, RGBAFormat, ShaderMaterial, UnsignedByteType } from 'three'
import { insideIllustratedPeat, PEAT_APPEARANCE_GRID as GRID } from '../../story/fireAppearance'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'

/** User-requested visible extinguishing, explicitly authored rather than a
 * reaction/transport prediction. It covers only the original peat silhouette.
 * Original shaders, field snapshots and source ledgers are never mutated. */
export function WetPeat({ progress }: { progress: number }) {
  const invalidate = useThree(state => state.invalidate)
  const texture = useMemo(() => {
    const data = new Uint8Array(GRID.nx * GRID.ny * 4)
    for (let j = 0; j < GRID.ny; j++) for (let i = 0; i < GRID.nx; i++) {
      const x = GRID.minX + (i + .5) / GRID.nx * GRID.width
      const y = GRID.minY + (j + .5) / GRID.ny * GRID.height
      const n = (j * GRID.nx + i) * 4
      data[n] = insideIllustratedPeat(x, y) ? 255 : 0
      data[n + 1] = Math.min(240, Math.round(Math.hypot((x - G.sourceX) / 3.5, (y + G.sourceDepthM) / 1.5) * 255))
      data[n + 2] = Math.round((Math.sin(i * 17.13 + j * 39.7) * .5 + .5) * 255)
      data[n + 3] = 255
    }
    const value = new DataTexture(data, GRID.nx, GRID.ny, RGBAFormat, UnsignedByteType)
    value.minFilter = value.magFilter = LinearFilter; value.needsUpdate = true
    return value
  }, [])
  const material = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMask: { value: texture }, uProgress: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv; uniform sampler2D uMask; uniform float uProgress;
      void main(){
        vec3 field=texture2D(uMask,vUv).rgb;
        float covered=field.r*smoothstep(field.g-.035,field.g+.035,uProgress);
        if(uProgress<=0.0 || covered<.002) discard;
        vec3 wet=mix(vec3(.030,.023,.017),vec3(.070,.076,.062),field.b*.45);
        gl_FragColor=vec4(wet,covered);
      }`,
  }), [texture])
  useLayoutEffect(() => { material.uniforms.uProgress.value = progress; invalidate() }, [material, progress, invalidate])
  useEffect(() => () => { material.dispose(); texture.dispose() }, [material, texture])
  return <mesh position={[0, -1.6, .055]} material={material} userData={{ scientificRole: 'authored extinguishing appearance; no predicted suppression or field-state change' }}>
    <planeGeometry args={[GRID.width, GRID.height]}/>
  </mesh>
}
