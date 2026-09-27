import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { sampleSoil, WIDE_PEAT, type SoilReplay } from './soilParticleModel'
import { soilVertexFields } from './FractureStudy'
import { smoothPhase } from './studyModel'

export const wholeSoilVertexFields = soilVertexFields.replace(' * exp(-p.z*p.z/2.0)', '')
type P = [number, number]
function clip(polygon: P[], nx: number, ny: number, limit: number): P[] {
  const result: P[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    const da = a[0] * nx + a[1] * ny - limit, db = b[0] * nx + b[1] * ny - limit
    if (da <= 1e-9) result.push(a)
    if ((da < 0) !== (db < 0)) { const t = da / (da - db); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]) }
  }
  return result
}
const seeded = (n: number) => { const x = Math.sin(n * 91.713 + 3.178) * 43758.5453; return x - Math.floor(x) }
/** Irregular display cells. Their centers sample the independent lattice; these
 * polygons are not a new mechanical discretization or predicted crack topology. */
export function soilDisplayCells() {
  const seeds: P[] = []
  for (let j = 0; j < 13; j++) for (let i = 0; i < 29; i++) {
    const n = j * 29 + i
    seeds.push([-4 + (i + 0.18 + seeded(n) * 0.64) / 29 * 8, -3.2 + (j + 0.18 + seeded(n + 731) * 0.64) / 13 * 3.2])
  }
  return seeds.map((center, index) => {
    let polygon: P[] = [[-4, -3.2], [4, -3.2], [4, 0], [-4, 0]]
    seeds.forEach((other, i) => {
      if (i === index || Math.hypot(other[0] - center[0], other[1] - center[1]) > 0.95) return
      const nx = other[0] - center[0], ny = other[1] - center[1]
      polygon = clip(polygon, nx, ny, (other[0] ** 2 + other[1] ** 2 - center[0] ** 2 - center[1] ** 2) / 2)
    })
    return { center, polygon }
  })
}
export function RupturingGround({ soilTexture, thermal }: { soilTexture: THREE.DataTexture; thermal: boolean }) {
  const cells = useMemo(soilDisplayCells, [])
  const data = useMemo(() => {
    const vertices: number[] = [], centers: number[] = []
    let centerZ = 0
    const add = (p: P, z: number, owner: number) => { vertices.push(p[0], p[1], z); centers.push(...cells[owner].center, centerZ) }
    const part = (polygon: P[], front: number, back: number, owner: number) => {
      centerZ = (front + back) / 2
      if (polygon.length < 3) return
      for (let i = 1; i < polygon.length - 1; i++) {
        for (const p of [polygon[0], polygon[i], polygon[i + 1]]) add(p, front, owner)
        for (const p of [polygon[0], polygon[i + 1], polygon[i]]) add(p, back, owner)
      }
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length]
        add(a, front, owner); add(a, back, owner); add(b, front, owner)
        add(b, front, owner); add(a, back, owner); add(b, back, owner)
      }
    }
    const extrude = (polygon: P[], front: number, back: number, owner: number) => {
      const bands = 7
      for (let band = 0; band < bands; band++) {
        const depth = front - back
        const cut = (n: number) => n === 0 ? 0 : n === bands ? 1 : (n + (seeded(owner * 17 + n) - 0.5) * 0.35) / bands
        const near = front - depth * cut(band), far = front - depth * cut(band + 1)
        part(polygon, near, far, owner)
      }
    }
    cells.forEach(({ polygon }, i) => {
      // Open cutaway borehole at the front; retain ground behind its back wall.
      extrude(clip(polygon, 1, 0, -1.775), 0.012, -4, i)
      extrude(clip(polygon, -1, 0, 1.025), 0.012, -4, i)
      const middle = clip(clip(polygon, -1, 0, 1.775), 1, 0, -1.025)
      extrude(clip(middle, 0, 1, -2.44), 0.012, -4, i)
      extrude(clip(middle, 0, -1, 2.44), -0.42, -4, i)
    })
    const rest = new Float32Array(vertices), geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(rest.slice(), 3))
    geometry.setAttribute('restPosition', new THREE.BufferAttribute(rest.slice(), 3)); geometry.setAttribute('displayCenter', new THREE.Float32BufferAttribute(centers, 3)); geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.boundingSphere!.radius += 2
    return { geometry }
  }, [cells])
  const thermalUniform = useMemo(() => ({ value: 0 }), [])
  useLayoutEffect(() => { thermalUniform.value = thermal ? 1 : 0 }, [thermalUniform, thermal])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.98, side: THREE.DoubleSide })
    m.onBeforeCompile = shader => {
      shader.uniforms.uWideThermal = thermalUniform
      shader.uniforms.uSoilField = { value: soilTexture }
      shader.vertexShader = wholeSoilVertexFields + 'attribute vec3 restPosition; attribute vec3 displayCenter; varying vec3 vEarth;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vEarth = restPosition;
vec2 uv = (vec2((displayCenter.x+4.0)/8.0*48.0,(displayCenter.y+3.2)/3.2*24.0)+0.5)/vec2(49.0,25.0);
float damage = texture2D(uSoilField,uv).b;
transformed.xy += 0.7*soilOffset(displayCenter)+0.3*soilOffset(position)-(position.xy-displayCenter.xy)*damage*0.075;
transformed.z -= (position.z-displayCenter.z)*damage*0.075;
transformed.x += damage*0.025*sin(displayCenter.z*4.0+displayCenter.x*3.0);`)
      shader.fragmentShader = 'uniform float uWideThermal; varying vec3 vEarth;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float y = vEarth.y + 0.055*sin(vEarth.x*2.2) + 0.025*sin(vEarth.z*3.0);
vec3 soil = y > -0.2 ? vec3(0.07,0.047,0.023) : y > -0.82 ? vec3(0.18,0.12,0.058) : y > -1.75 ? vec3(0.29,0.21,0.13) : vec3(0.4,0.35,0.26);
float grit = fract(sin(dot(floor(vEarth*130.0),vec3(12.9898,78.233,41.21)))*43758.5453);
float hot = exp(-pow(vEarth.x/3.4,2.0)-pow((vEarth.y+1.5)/0.7,2.0));
float cold = exp(-pow((vEarth.x+1.4)/0.9,2.0)-pow((vEarth.y+2.19)/0.7,2.0));
vec3 overlay = mix(vec3(0.05,0.28,0.52),vec3(0.96,0.22,0.04),clamp(0.28+hot*0.78-cold*0.7,0.0,1.0));
diffuseColor.rgb = mix(soil*(0.72 + 0.42*grit),overlay,uWideThermal);`)
    }
    return m
  }, [thermalUniform, soilTexture])
  useEffect(() => () => { data.geometry.dispose(); material.dispose() }, [data, material])
  return <mesh geometry={data.geometry} material={material} receiveShadow />
}

export function BroadPeatFire({ soilTexture, replay, time }: { soilTexture: THREE.DataTexture; replay: SoilReplay; time: number }) {
  const uniforms = useMemo(() => ({ uSoilField: { value: soilTexture }, uStory: { value: 0 } }), [soilTexture])
  const geometry = useMemo(() => { const g = new THREE.PlaneGeometry(7.5, 2.7, 100, 48); g.translate(0, -1.3, 0.045); return g }, [])
  const material = useMemo(() => new THREE.ShaderMaterial({ uniforms, side: THREE.DoubleSide,
    vertexShader: wholeSoilVertexFields + `varying vec3 vPeat; void main(){vPeat=position;vec3 p=position;p.xy+=soilOffset(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader: `varying vec3 vPeat; uniform float uStory;
float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
 vec2 p=vPeat.xy;
 float lens=length((p-vec2(${WIDE_PEAT.x.toFixed(2)},${WIDE_PEAT.y.toFixed(2)}))/vec2(3.35,0.65));
 float rise=smoothstep(4.0,16.0,uStory);
 float pathX=2.5+0.15*sin((p.y+1.5)*3.5);
 float path=abs(p.x-pathX);
 bool chimney=path<0.12 && p.y>-1.6 && p.y< -1.5+rise*1.55;
 if(lens>1.0+0.025*sin(p.x*19.0) && !chimney)discard;
 if(abs(p.x+1.4)<0.375 && p.y>-2.44)discard;
 float grain=noise(floor(p*vec2(190.0,120.0)));
 float core=length((p-vec2(-0.35,-1.5))/vec2(1.35+1.4*smoothstep(0.0,13.0,uStory),0.39));
 bool hot=core<0.92+0.06*sin(p.x*22.0) || chimney;
 vec3 base=hot?vec3(0.07,0.048,0.028):vec3(0.27,0.18,0.095);
 base*=0.55+grain*0.8;
 float embers=step(0.87,noise(floor(p*vec2(36.0,65.0))))*step(0.7,grain);
 if(hot)base+=embers*vec3(0.85,0.18,0.012)*(0.65+0.35*sin(uStory*2.0+p.x*12.0));
 gl_FragColor=vec4(base,1.0);
}` }), [uniforms])
  useLayoutEffect(() => { uniforms.uStory.value = time }, [uniforms, time])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  const outletX = 2.5 + 0.15 * Math.sin(1.5 * 3.5)
  const offset = sampleSoil(replay, outletX, 0, time)
  const flame = smoothPhase(time, 16, 19)
  return <>
    <mesh geometry={geometry} material={material} />
    <group position={[outletX + offset[0], offset[1], 0]} visible={flame > 0}>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * 0.13, flame * (0.13 + i % 3 * 0.04), -0.06 - (i % 3) * 0.07]} rotation={[0, i * 2.4, Math.sin(time * 3 + i) * 0.1]} scale={[0.1, flame * (0.28 + i % 3 * 0.1), 0.1]}>
        <coneGeometry args={[1, 1, 7]} /><meshBasicMaterial color={i % 3 ? '#ed7826' : '#ffca61'} transparent opacity={0.72} depthWrite={false} />
      </mesh>)}
      <pointLight color="#ff8a35" intensity={flame * 0.8} distance={1.2} />
    </group>
  </>
}
