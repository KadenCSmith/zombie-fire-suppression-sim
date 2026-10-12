import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ServiceVehicle } from './vehicle'
import { FILL_ROUTE, MEDIA_MOUNT, MEDIA_SCALE, TREATMENT_PARKED, TRUCK_PARKED, preparationVisuals } from './visuals'
import type { ReactNode } from 'react'

/** Newly authored integrated vehicle and rear preparation module. All vehicle
 * and plumbing poses are display-only, with no calculated pressure or flow. */
export function WaterSupply({ time, children }: { time: number; children: ReactNode }) {
  const visual = preparationVisuals(time)
  return <group userData={{ scientificRole: 'New integrated tanker, rear preparation deck, articulated loader, pump bay and reel; no performance prediction' }}>
    <group position={[TRUCK_PARKED[0] + visual.truckTravel, TRUCK_PARKED[1], TRUCK_PARKED[2]]}>
      <ServiceVehicle travel={visual.truckTravel} payout={visual.hose}/>
      <group position={[TREATMENT_PARKED[0] - TRUCK_PARKED[0] + MEDIA_MOUNT[0], MEDIA_MOUNT[1], MEDIA_MOUNT[2]]} scale={MEDIA_SCALE}>
        {children}
      </group>
    </group>
    <FillHose time={time}/>
  </group>
}

function FillHose({ time }: { time: number }) {
  const visual = preparationVisuals(time)
  const curve = useMemo(() => new THREE.CatmullRomCurve3(FILL_ROUTE.map(p => new THREE.Vector3(...p)), false, 'centripetal'), [])
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, .036, 10, false), [curve])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => { geometry.setDrawRange(0, Math.floor(visual.hose * 48) * 10 * 6) }, [geometry, visual.hose])
  return <group userData={{ scientificRole: 'Authored tanker-to-preparation hose; not a calculated source or flow measurement' }}>
    <mesh geometry={geometry} castShadow><meshStandardMaterial color="#34483e" roughness={.9}/></mesh>
    {FILL_ROUTE.filter((_, i) => i === 0 || i === FILL_ROUTE.length - 1).map((p, i) => <mesh key={i} position={p} visible={visual.hose === 1}>
      <sphereGeometry args={[.052, 12, 8]}/><meshStandardMaterial color="#a3ada2" metalness={.75} roughness={.3}/>
    </mesh>)}
  </group>
}
