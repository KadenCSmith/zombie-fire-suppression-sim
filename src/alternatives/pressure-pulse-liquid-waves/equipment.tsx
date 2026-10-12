import { RoundedBox } from '@react-three/drei/core/RoundedBox.js'
import { CatmullRomCurve3, DoubleSide, Quaternion, Shape, Vector3 } from 'three'
import { FIRE_SEQUENCE_GEOMETRY as G } from '../../story/fireSequence'
import { DRILL_SECTION_STARTS, liquidAnimationFrame, pipeTruckFrame } from './animation'

type Point = [number, number, number]
const STEEL = '#8e9b98'
const PAINT = '#d9ddd2'
const PUMP = '#46615b'
const cabProfile = new Shape()
cabProfile.moveTo(.48, .61)
cabProfile.lineTo(1.53, .61)
cabProfile.lineTo(1.53, 1.01)
cabProfile.lineTo(1.36, 1.48)
cabProfile.lineTo(.57, 1.48)
cabProfile.lineTo(.48, 1.38)
cabProfile.closePath()
const sideWindow = new Shape()
sideWindow.moveTo(.65, 1.08)
sideWindow.lineTo(1.45, 1.08)
sideWindow.lineTo(1.32, 1.4)
sideWindow.lineTo(.65, 1.4)
sideWindow.closePath()
const drillFlute = new CatmullRomCurve3(Array.from({ length: 49 }, (_, i) => {
  const t = i / 48, angle = t * Math.PI * 6
  return new Vector3(Math.cos(angle) * .064, .06 + t * .34, Math.sin(angle) * .064)
}))

function Block({ at, size, color, metal = .5, rough = .5, rounded = false }: {
  at: Point; size: Point; color: string; metal?: number; rough?: number; rounded?: boolean
}) {
  const material = <meshStandardMaterial color={color} metalness={metal} roughness={rough}/>
  return rounded
    ? <RoundedBox position={at} args={size} radius={.025} smoothness={2} castShadow>{material}</RoundedBox>
    : <mesh position={at} castShadow><boxGeometry args={size}/>{material}</mesh>
}

function RoadWheel({ x, side, travel }: { x: number; side: number; travel: number }) {
  return <group position={[x, .29, side * .56]} rotation={[0, 0, -travel / .29]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.28, .28, .19, 24]}/><meshStandardMaterial color="#202320" roughness={.97}/></mesh>
    {[-.07, .07].map(z => <mesh key={z} position={[0, 0, z]}><torusGeometry args={[.225, .063, 8, 24]}/><meshStandardMaterial color="#252925" roughness={.93}/></mesh>)}
    <mesh position={[0, 0, side * .105]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.172, .172, .025, 20]}/><meshStandardMaterial color={STEEL} metalness={.8} roughness={.35}/></mesh>
    <mesh position={[0, 0, side * .128]}><torusGeometry args={[.153, .012, 6, 20]}/><meshStandardMaterial color="#c0c7c0" metalness={.8} roughness={.28}/></mesh>
    <mesh position={[0, 0, side * .14]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.067, .067, .055, 12]}/><meshStandardMaterial color="#5d6762" metalness={.75} roughness={.45}/></mesh>
    {Array.from({ length: 6 }, (_, i) => {
      const angle = i * Math.PI / 3
      return <mesh key={i} position={[Math.cos(angle) * .103, Math.sin(angle) * .103, side * .131]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.016, .016, .02, 6]}/><meshStandardMaterial color="#ced3cb" metalness={.85} roughness={.3}/>
      </mesh>
    })}
  </group>
}

/** Generic exposed machinery, with no operating values or dimensional design. */
function PumpDeck({ time }: { time: number }) {
  const pumping = liquidAnimationFrame(time)
  return <group>
    <Block at={[-.52, .56, 0]} size={[1.72, .12, 1.03]} color="#555e57"/>
    {/* Separate engine, guarded driveline and pump replace the solid equipment box. */}
    <Block at={[-.77, .92, 0]} size={[.68, .52, .62]} color={PUMP} rounded/>
    {[-.24, .24].map(z => <group key={z}>
      <Block at={[-.76, 1.2, z]} size={[.64, .1, .17]} color="#657a6c" rounded/>
      {[-.95, -.77, -.59].map(x => <MetalSegment key={x} from={[x, 1.12, z]} to={[x + .04, .9, z * 1.65]} radius={.025} color="#6b7468"/>)}
      <MetalSegment from={[-1.04, .88, z * 1.65]} to={[-.5, .88, z * 1.65]} radius={.04} color="#656e62"/>
    </group>)}
    <Block at={[-1.2, 1, 0]} size={[.16, .78, .8]} color="#38433c" rounded/>
    <Block at={[-1.29, 1.01, 0]} size={[.016, .64, .68]} color="#19221d" metal={.2}/>
    {Array.from({ length: 9 }, (_, i) => <Block key={i} at={[-1.305, .73 + i * .068, 0]} size={[.016, .018, .65]} color="#637064"/>)}
    <MetalSegment from={[-.88, 1.15, -.29]} to={[-.88, 1.63, -.29]} radius={.035} color="#72786b"/>
    <MetalSegment from={[-.88, 1.63, -.29]} to={[-1.02, 1.63, -.29]} radius={.035} color="#72786b"/>
    <Block at={[-.3, .85, 0]} size={[.26, .31, .39]} color="#5b635c" rounded/>
    <Block at={[-.04, .84, 0]} size={[.36, .28, .43]} color="#253d36" rounded/>
    <Block at={[.22, .88, 0]} size={[.36, .37, .72]} color={PUMP} rounded/>
    {[-.36, .36].map(z => <group key={z}>
      {[.1, .23, .36].map(x => <group key={x}>
        <MetalSegment from={[x, .88, z]} to={[x, .88, z * 1.22]} radius={.059}/>
        <MetalSegment from={[x, .88, z * 1.22]} to={[x, .71, z * 1.22]} radius={.026}/>
      </group>)}
      <MetalSegment from={[.07, .7, z * 1.22]} to={[.38, .7, z * 1.22]} radius={.048} color="#97684e"/>
    </group>)}
    {/* Visible outlet meets the existing world-space rigid delivery line. */}
    <MetalSegment from={[.07, .7, -.44]} to={[-1.38, .7, -.37]} radius={.042} color="#97684e"/>
    <mesh position={[.4, .79, .47]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.072, .013, 6, 16]}/><meshStandardMaterial color="#8d4835" metalness={.5} roughness={.55}/></mesh>
    {/* Low-amplitude engine motion is timestamp-driven and purely illustrative. */}
    <group position={[-.36, .88, .31]} rotation={[0, 0, pumping.flowClock * 8]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.11, .11, .035, 16]}/><meshStandardMaterial color="#646d63" metalness={.6} roughness={.45}/></mesh>
      <Block at={[0, .075, 0]} size={[.1, .018, .045]} color="#b2b9ab"/>
    </group>
    <Block at={[-1.36, 1.17, .49]} size={[.1, .21, .12]} color="#525d52" rounded/>
    <Block at={[-1.363, 1.2, .558]} size={[.07, .07, .008]} color="#172a24" metal={.15}/>
    {[-.5, .5].map(z => <group key={z}>
      <MetalSegment from={[-1.38, .65, z]} to={[-1.38, 1.12, z]} radius={.018}/>
      <MetalSegment from={[-1.38, 1.12, z]} to={[-.43, 1.12, z]} radius={.018}/>
      <MetalSegment from={[-.43, 1.12, z]} to={[-.43, .65, z]} radius={.018}/>
      <MetalSegment from={[-1.38, .89, z]} to={[-.43, .89, z]} radius={.014}/>
    </group>)}
    {[-.03, .12].map(y => <Block key={y} at={[-1.46, .39 + y, .39]} size={[.22, .04, .27]} color={STEEL}/>)}
    {/* Sections leave the rear rack individually during the drilling sequence. */}
    <Block at={[-1.25, .66, 0]} size={[.22, .07, .63]} color="#485a4b"/>
    {DRILL_SECTION_STARTS.map((start, i) => time < start && <group key={start}>
      <MetalSegment from={[-1.25, .7, -.2 + i * .2]} to={[-1.25, 1.7, -.2 + i * .2]} radius={.055}/>
      <MetalSegment from={[-1.25, 1.64, -.2 + i * .2]} to={[-1.25, 1.7, -.2 + i * .2]} radius={.069} color="#617366"/>
    </group>)}
  </group>
}

function TruckBody({ time, travel }: { time: number; travel: number }) {
  return <group>
    {[-.36, .36].map(z => <Block key={z} at={[0, .36, z]} size={[2.89, .15, .12]} color="#333b36"/>)}
    {[-.99, -.37, 1.05].map(x => <group key={x}>
      <MetalSegment from={[x, .29, -.58]} to={[x, .29, .58]} radius={.06} color="#353e36"/>
      {[-1, 1].map(side => <RoadWheel key={side} x={x} side={side} travel={travel}/>)}
    </group>)}
    {[-.57, .57].map(z => <group key={z}>
      <Block at={[-.68, .61, z]} size={[1.28, .075, .22]} color="#687469" rounded/>
      {[-1.31, -.04].map(x => <Block key={x} at={[x, .4, z]} size={[.035, .35, .18]} color="#29342d"/>)}
      <Block at={[1.04, .61, z]} size={[.7, .11, .17]} color={PAINT} rounded/>
      <Block at={[.47, .49, z * .85]} size={[.36, .2, .22]} color={STEEL} rounded/>
      <Block at={[.66, .55, z * 1.05]} size={[.22, .04, .16]} color="#9aa496"/>
    </group>)}
    <mesh position={[0, 0, -.49]} castShadow><extrudeGeometry args={[cabProfile, { depth: .98, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1 }]}/><meshStandardMaterial color={PAINT} metalness={.3} roughness={.46}/></mesh>
    <mesh position={[1.458, 1.245, 0]} rotation={[0, 0, .346]}><boxGeometry args={[.018, .39, .89]}/><meshStandardMaterial color="#344c4b" metalness={.35} roughness={.2}/></mesh>
    <MetalSegment from={[1.4, 1.43, 0]} to={[1.53, 1.06, 0]} radius={.012} color="#60736c"/>
    {[-.516, .516].map(z => <group key={z}>
      <mesh position={[0, 0, z]}><shapeGeometry args={[sideWindow]}/><meshStandardMaterial color="#3b5451" metalness={.32} roughness={.2} side={DoubleSide}/></mesh>
      <MetalSegment from={[.94, 1.08, z]} to={[.94, 1.4, z]} radius={.012} color={PAINT}/>
      <Block at={[.71, 1, z]} size={[.12, .025, .018]} color="#555f55"/>
      <Block at={[.585, .9, z]} size={[.009, .31, .01]} color="#8e998c"/>
      <MetalSegment from={[1.35, 1.19, z]} to={[1.41, 1.2, z * 1.3]} radius={.012} color="#47564b"/>
      <Block at={[1.41, 1.19, z * 1.32]} size={[.06, .16, .08]} color="#3b4940" rounded/>
      <Block at={[1.44, 1.2, z * 1.32]} size={[.008, .13, .06]} color="#8a9d91" metal={.85} rough={.2}/>
      <Block at={[1.56, .73, z * .76]} size={[.035, .13, .16]} color="#e7e6cb" metal={.2} rough={.25}/>
      <Block at={[1.563, .87, z * .8]} size={[.027, .04, .11]} color="#a97a36"/>
    </group>)}
    <Block at={[1.55, .52, 0]} size={[.14, .17, 1.13]} color="#717e72" rounded/>
    <Block at={[1.555, .84, 0]} size={[.025, .26, .54]} color="#27392f"/>
    {[.75, .81, .87, .93].map(y => <Block key={y} at={[1.575, y, 0]} size={[.015, .012, .51]} color="#89988a"/>)}
    <MetalSegment from={[1.48, 1.09, -.32]} to={[1.446, 1.2, -.13]} radius={.007} color="#151f19"/>
    <MetalSegment from={[1.48, 1.09, .16]} to={[1.446, 1.2, .34]} radius={.007} color="#151f19"/>
    <Block at={[.97, 1.51, 0]} size={[.79, .055, 1.03]} color={PAINT} rounded/>
    {[-.38, .38].map(z => <mesh key={z} position={[.6, 1.57, z]}><cylinderGeometry args={[.035, .045, .065, 10]}/><meshStandardMaterial color="#bb8634" roughness={.3}/></mesh>)}
    <Block at={[-1.46, .49, 0]} size={[.09, .16, 1.09]} color="#6c786b"/>
    <PumpDeck time={time}/>
  </group>
}

function StabilizerFeet({ frame: f }: { frame: ReturnType<typeof pipeTruckFrame> }) {
  const reach = .43 + f.outriggerSpread * .43
  const padY = .34 * (1 - f.feetPlanted) + .025 * f.feetPlanted
  return <group>
    {[-1.32, .37].flatMap(x => [-1, 1].map(side => <group key={x + ':' + side}>
      <Block at={[x, .53, side * reach / 2]} size={[.13, .12, reach]} color="#536458"/>
      <Block at={[x, .59, side * reach]} size={[.12, .36, .12]} color="#293a30" rounded/>
      {[.44, .74].map(y => <Block key={y} at={[x, y, side * reach]} size={[.14, .035, .14]} color="#728578"/>)}
      <MetalSegment from={[x, .41, side * reach]} to={[x, padY + .045, side * reach]} radius={.03} color="#a8b6a6"/>
      <Block at={[x, padY, side * reach]} size={[.34, .05, .27]} color="#566a58" rounded/>
      <MetalSegment from={[x, .68, side * .38]} to={[x, .53, side * reach]} radius={.016} color="#819483"/>
    </group>))}
  </group>
}

function DrillRig({ frame: f }: { frame: ReturnType<typeof pipeTruckFrame> }) {
  const pipeX = G.sourceX - .11
  return <group>
    {[-.12, .12].map(z => <group key={z}>
      <MetalSegment from={[f.position[0] + 1.23, .65, f.position[2] + .15 + z]} to={[f.rigPosition[0], f.rigPosition[1] + .15, f.rigPosition[2] + z]} radius={.058} color="#68786b"/>
      <MetalSegment from={[f.position[0] + .67, .66, f.position[2] + z]} to={[f.rigPosition[0], f.rigPosition[1] + 1.25, f.rigPosition[2] + z]} radius={.033}/>
    </group>)}
    <group position={f.rigPosition} rotation={[0, 0, f.mastAngle]}>
      {[-.14, .14].map(x => <MetalSegment key={x} from={[x, 0, -.08]} to={[x, 3.15, -.08]} radius={.035} color="#7d8c7d"/>)}
      {[0, .45, .9, 1.35, 1.8, 2.25, 2.7, 3.15].map((y, i) => <group key={y}>
        <MetalSegment from={[-.14, y, -.08]} to={[.14, y, -.08]} radius={.022} color="#68796a"/>
        {i < 7 && <MetalSegment from={[i % 2 ? -.14 : .14, y, -.08]} to={[i % 2 ? .14 : -.14, y + .45, -.08]} radius={.013} color="#68796a"/>}
      </group>)}
      <Block at={[0, 3.16, -.07]} size={[.43, .12, .24]} color="#667e6c" rounded/>
    </group>
    {f.pipeVisible && <group>
      <Block at={[pipeX, f.pipeTop + .08, .09]} size={[.29, .2, .27]} color="#586f60" rounded/>
      <MetalSegment from={[pipeX, 3.61, -.01]} to={[pipeX, f.pipeTop + .16, -.01]} radius={.012} color="#303d32"/>
      {Array.from({ length: f.sectionCount }, (_, i) => {
        const incoming = i === f.sectionCount - 1 && f.joining > 0
        const at: Point = incoming ? f.incomingPosition : [pipeX, f.pipeBottom + i, .09]
        return <group key={i} position={at} rotation={[0, incoming ? 0 : f.drillRotation, 0]}>
          <MetalSegment from={[0, 0, 0]} to={[0, 1, 0]} radius={.055}/>
          {[.035, .965].map(y => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[.069, .069, .065, 12]}/><meshStandardMaterial color="#616f6e" metalness={.8} roughness={.3}/></mesh>)}
          <Block at={[.055, .74, 0]} size={[.005, .12, .027]} color="#788f79"/>
          {i === 0 && <group>
            <mesh castShadow><tubeGeometry args={[drillFlute, 48, .012, 5, false]}/><meshStandardMaterial color="#a8b3a7" metalness={.8} roughness={.3}/></mesh>
            <mesh position={[0, .025, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.075, .065, 6]}/><meshStandardMaterial color="#718575" metalness={.8} roughness={.4}/></mesh>
          </group>}
        </group>
      })}
      {f.joining > 0 && <MetalSegment from={[pipeX, 3.61, .09]} to={[f.incomingPosition[0], f.incomingPosition[1] + 1, f.incomingPosition[2]]} radius={.009} color="#344439"/>}
      {f.drilling && Array.from({ length: 12 }, (_, i) => {
        const phase = (f.drillRotation * .2 + i / 12) % 1, angle = i * 2.4
        const radius = .12 + phase * .23
        return <mesh key={i} position={[pipeX + Math.cos(angle) * radius, .025 + Math.sin(phase * Math.PI) * .13, .09 + Math.sin(angle) * radius]} rotation={[angle, phase * 3, angle]}>
          <icosahedronGeometry args={[.018 + (i % 3) * .006, 0]}/><meshStandardMaterial color="#99876b" roughness={1}/>
        </mesh>
      })}
    </group>}
  </group>
}

/** Opaque rigid segments distinguish this supply from the original woven hose. */
function MetalSegment({ from, to, radius = .045, color = '#aab5b4' }: { from: Point; to: Point; radius?: number; color?: string }) {
  const a = new Vector3(...from), b = new Vector3(...to), delta = b.clone().sub(a)
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize())
  return <mesh position={a.add(b).multiplyScalar(.5)} quaternion={rotation} castShadow>
    <cylinderGeometry args={[radius, radius, delta.length(), 12]}/>
    <meshStandardMaterial color={color} metalness={.78} roughness={.28}/>
  </mesh>
}

/** Independently authored service truck; original water truck remains on right. */
export function PipeTruck({ time }: { time: number }) {
  const f = pipeTruckFrame(time)
  if (!f.visible) return null
  return <group userData={{ scientificRole: 'Authored opposite-side service truck and rigid pipe installation; no equipment or pressure design' }}>
    <group position={f.position} rotation={[0, f.heading, 0]}>
      <TruckBody time={time} travel={f.travel}/>
      <StabilizerFeet frame={f}/>
    </group>
    <DrillRig frame={f}/>
  </group>
}
