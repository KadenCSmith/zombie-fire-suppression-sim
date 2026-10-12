/** HISTORICAL V2 liquid experiment. Inactive in the current vibration-only workspace; not vibration validation. */
import { Line } from '@react-three/drei/core/Line.js'
import { injectionLevels, treatmentVisual } from './visuals'

/** Requested shaking, disrupted peat, lateral injection and extinction are
 * illustrative geometry, isolated from accepted physical field snapshots. */
export function TreatmentEffects({time,depth,enabled=true,vibration=true,showFire=true}:{time:number;depth:number;enabled?:boolean;vibration?:boolean;showFire?:boolean}) {
  const pose=treatmentVisual(time,enabled,vibration)
  return <group userData={{role:'illustrative treatment, not computed mechanics or extinction'}}>
    {/* The four outlets remain visible down the advancing shaft. */}
    {pose.active&&injectionLevels(depth).flatMap((y,level)=>[-1,1].map(side=>{
      const reach=.16+.85*Math.max(.12,pose.wet),phase=(time*.95+level*.17)%1
      return <group key={`${level}:${side}`}>
        <Line points={[[.4,y,.19],[.4+side*reach*.6,y-.035,.19],[.4+side*reach,y-.10,.19]]} color="#8fe7e1" lineWidth={2.5} transparent opacity={.75}/>
        <mesh position={[.4+side*reach,y-.10,.19]} rotation={[0,0,-side*Math.PI/2]}><coneGeometry args={[.035,.10,8]}/><meshBasicMaterial color="#baf4eb"/></mesh>
        {Array.from({length:3},(_,i)=>{const f=(phase+i/3)%1;return <mesh key={i} position={[.4+side*reach*f,y-.10*f,.20]}><sphereGeometry args={[.024,6,5]}/><meshBasicMaterial color="#b8f9f0"/></mesh>})}
      </group>
    }))}
    {/* Darkening patches expand laterally at each injection depth. */}
    {pose.wet>0&&injectionLevels(depth).map((y,i)=><mesh key={i} position={[.4,y,.075]} scale={[.15+pose.wet*(1.15-i*.12),.12+pose.wet*.23,.018]}><sphereGeometry args={[1,24,12]}/><meshBasicMaterial color="#234b48" transparent opacity={.42*pose.wet} depthWrite={false}/></mesh>)}
    {/* Separate clods and opening seams make the ground disturbance legible. */}
    {pose.shake>0&&Array.from({length:32},(_,i)=>{
      const side=i%2?1:-1,band=Math.floor(i/2)%8,seed=Math.sin(i*73.17)*.5+.5
      const x=.4+side*(.30+band*.17),y=-.12-(Math.floor(i/16))*.53
      const lift=Math.abs(Math.sin(time*17+i*2.4))*.15*pose.shake
      return <mesh key={i} position={[x+Math.sin(time*29+i)*.045*pose.shake,y+lift,.10+lift*.35]} rotation={[time*.7+i,i*.7,time*.9+i]} scale={[.08+seed*.04,.06,.05]}><dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color={i%3?'#55432d':'#796447'} roughness={1}/></mesh>
    })}
    {pose.shake>0&&Array.from({length:22},(_,i)=>{
      const age=(time*.65+i/22)%1,side=i%2?1:-1
      return <mesh key={i} position={[.4+side*(.25+age*1.35),.02+age*.55,.03+Math.sin(i*3.7)*.15]} scale={[.10+age*.16,.07+age*.13,.07]}><sphereGeometry args={[1,7,5]}/><meshBasicMaterial color="#9e9277" transparent opacity={(1-age)*.16*pose.shake} depthWrite={false}/></mesh>
    })}
    {vibration&&time>=26&&Array.from({length:6},(_,i)=>{
      const side=i%2?1:-1,x=.4+side*(.35+Math.floor(i/2)*.35),w=.005+.018*pose.shake
      return <Line key={i} points={[[x,0,.025],[x-side*.08,-.18,.025],[x+side*.10,-.39,.025],[x-side*.03,-.63,.025]]} color="#130f0a" lineWidth={w*120} transparent opacity={.65*(1-pose.settled*.6)}/>
    })}
    {/* Ember tongues diminish behind the expanding authored wet front. */}
    {showFire&&pose.fire>.001&&Array.from({length:38},(_,i)=>{
      const x=-1.75+(i%10)*.44,y=-.35-Math.floor(i/10)*.30
      const flicker=.75+.25*Math.sin(time*13+i*5.2),height=(.10+.13*(.5+.5*Math.sin(i*18.2)))*pose.fire*flicker
      return <group key={i} position={[x,y,.08]} scale={[1,pose.fire,1]}>
        <mesh position={[0,height*.45,.015]} scale={[.06,height,.035]}><coneGeometry args={[1,1,7]}/><meshBasicMaterial color={i%3?'#ff6b19':'#ffb32e'} transparent opacity={pose.fire*.86}/></mesh>
        <mesh scale={[.09,.035,.026]}><sphereGeometry args={[1,8,5]}/><meshBasicMaterial color="#f9480b" transparent opacity={pose.fire*.85}/></mesh>
      </group>
    })}
  </group>
}
