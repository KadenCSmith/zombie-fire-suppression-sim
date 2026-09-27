import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G, eased, fireSequencePose, type FireSourceMode } from '../story/fireSequence'
import { STORY_RUPTURE_GLSL, storyRupture } from '../story/fireAppearance'

const BLADE_COUNT = 30000
const random = (n: number) => { const value = Math.sin(n * 91.713 + 17.157) * 43758.5453; return value - Math.floor(value) }
function bladeGeometry() {
  const geometry = new THREE.BufferGeometry()
  // A folded, tapering ribbon gives each fine blade two lighting faces.
  const position: number[] = [], colors: number[] = [], indices: number[] = []
  for (let level = 0; level < 4; level++) {
    const y = level / 3, width = .011 * (1 - y * .94), bend = .32 * y * y
    position.push(-width, y, bend, 0, y, bend - .015 * Math.sin(y * Math.PI), width, y, bend)
    const light = .52 + .48 * y
    for (let side = 0; side < 3; side++) colors.push(light * (side === 1 ? .98 : .86), light, light * .84)
    if (level < 3) { const q = level * 3; indices.push(q, q + 3, q + 1, q + 1, q + 3, q + 4, q + 1, q + 4, q + 2, q + 2, q + 4, q + 5) }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry
}

/** Thirty thousand seeded, narrow blades in one instanced draw. Soil appearance
 * has no material inventory or mechanics; the authored displacement moves each
 * grass root with its ground position rather than leaving it suspended.
 */
export function SequenceGrass({time, mode = 'gradual'}: {time: number; mode?: FireSourceMode}) {
  const ref = useRef<THREE.InstancedMesh>(null), invalidate = useThree(state => state.invalidate)
  const geometry = useMemo(bladeGeometry, [])
  const uniforms = useMemo(() => ({ uGrassTime: {value: 0}, uGrassBurn: {value: 0}, uGrassBore: {value: 0}, uGrassPulse: {value: 0}, uGrassDamage: {value: 0} }), [])
  const material = useMemo(() => {
    const value = new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide, vertexColors: true })
    value.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `uniform float uGrassTime,uGrassBurn,uGrassBore,uGrassPulse,uGrassDamage; varying float vGrassScorch; ${STORY_RUPTURE_GLSL}\n` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 grassRoot=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
float wind=sin(uGrassTime*.65+grassRoot.x*2.4+grassRoot.z*1.7)+.35*sin(uGrassTime*1.3-grassRoot.z*4.0);
transformed.x+=.014*wind*position.y*position.y;
transformed.z+=.035*wind*position.y*position.y;
float scorchDistance=length((grassRoot.xz-vec2(1.72,-.28))*vec2(.95,1.1))+.02*sin(grassRoot.x*43.0)*sin(grassRoot.z*29.0);
float scorchRadius=.13+.38*uGrassBurn;
vGrassScorch=(1.0-smoothstep(scorchRadius*.5,scorchRadius,scorchDistance))*uGrassBurn;
transformed.y*=1.0-.91*vGrassScorch;
transformed.xz*=1.0-.4*vGrassScorch;
if(abs(grassRoot.x-${G.sourceX.toFixed(3)})<${G.boreRadiusM.toFixed(3)}&&grassRoot.z>-.42&&uGrassBore>.5)transformed*=0.0;`)
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `vec4 mvPosition=instanceMatrix*vec4(transformed,1.0);
vec3 grassWorld=(modelMatrix*mvPosition).xyz+storyRuptureOffset(grassRoot,uGrassPulse,uGrassDamage);
mvPosition=viewMatrix*vec4(grassWorld,1.0);
gl_Position=projectionMatrix*mvPosition;`)
      shader.fragmentShader = 'varying float vGrassScorch;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.042,.032,.014),vGrassScorch*.96);')
    }
    value.customProgramCacheKey = () => 'fine-story-grass-v3-ground-rupture'
    return value
  }, [uniforms])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return
    const object = new THREE.Object3D(), color = new THREE.Color()
    for (let i = 0; i < BLADE_COUNT; i++) {
      const clump = Math.floor(i / 12), angle = random(i + 400) * Math.PI * 2, radius = Math.sqrt(random(i + 80)) * .105
      const x = THREE.MathUtils.clamp(-3.92 + random(clump + 1900) * 7.84 + Math.cos(angle) * radius, -3.96, 3.96)
      const z = THREE.MathUtils.clamp(-3.93 + random(clump + 12700) * 3.89 + Math.sin(angle) * radius, -3.96, -.014)
      const height = (.1 + random(clump + 3100) * .12) * (.62 + random(i + 78) * .75)
      object.position.set(x, .006, z)
      object.rotation.set((random(i + 4) - .5) * .23, angle, (random(i + 5) - .5) * .26)
      object.scale.set(.45 + random(i + 7) * .48, height, height * (.7 + random(i + 15) * .5))
      object.updateMatrix(); mesh.setMatrixAt(i, object.matrix)
      color.setHSL(.265 + random(clump + 9000) * .068, .48 + random(i + 10) * .2, .235 + random(i + 11) * .12)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) { mesh.instanceColor.setUsage(THREE.StaticDrawUsage); mesh.instanceColor.needsUpdate = true }
    mesh.computeBoundingSphere(); invalidate()
  }, [invalidate])
  useLayoutEffect(() => {
    const rupture = storyRupture(time, mode)
    uniforms.uGrassTime.value = time; uniforms.uGrassBurn.value = eased(time, 1, 13)
    uniforms.uGrassBore.value = fireSequencePose(time, 'gradual').drillDepth > 0 ? 1 : 0
    uniforms.uGrassPulse.value = rupture.pulse; uniforms.uGrassDamage.value = rupture.damage
    invalidate()
  }, [time, mode, uniforms, invalidate])
  return <instancedMesh ref={ref} args={[geometry, material, BLADE_COUNT]} frustumCulled={false} raycast={() => null} userData={{scientificRole: 'seeded fine grass appearance, prescribed wind/scorch and shared ground displacement; no vegetation physics'}}/>
}
