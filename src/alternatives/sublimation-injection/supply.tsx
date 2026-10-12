import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ServiceVehicle } from './vehicle'
import { FILL_ROUTE, MEDIA_MOUNT, MEDIA_SCALE, TANK_PUMP_ROUTE_LOCAL, TREATMENT_PARKED, TRUCK_PARKED, preparationVisuals } from './visuals'
import type { ReactNode } from 'react'

/** Newly authored integrated vehicle and rear preparation module. All vehicle
 * and plumbing poses are display-only, with no calculated pressure or flow. */
export function WaterSupply({ time, children }: { time: number; children: ReactNode }) {
  const visual = preparationVisuals(time)
  return <group userData={{ scientificRole: 'New integrated tanker, rear preparation deck, articulated loader, pump bay and reel; no performance prediction' }}>
    <group position={[TRUCK_PARKED[0] + visual.truckTravel, TRUCK_PARKED[1], TRUCK_PARKED[2]]}>
      <ServiceVehicle travel={visual.truckTravel} payout={visual.hose}/>
      <ServiceHose route={TANK_PUMP_ROUTE_LOCAL} progress={1}/>
      <group position={[TREATMENT_PARKED[0] - TRUCK_PARKED[0] + MEDIA_MOUNT[0], MEDIA_MOUNT[1], MEDIA_MOUNT[2]]} scale={MEDIA_SCALE}>
        {children}
      </group>
    </group>
    <ServiceHose route={FILL_ROUTE} progress={visual.hose}/>
  </group>
}

function ServiceHose({ route, progress }: { route: readonly [number, number, number][]; progress: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(route.map(p => new THREE.Vector3(...p)), false, 'centripetal'), [route])
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, .036, 10, false), [curve])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => { geometry.setDrawRange(0, Math.floor(progress * 48) * 10 * 6) }, [geometry, progress])
  return <group userData={{ scientificRole: 'Authored tank-to-pump or pump-to-preparation hose; not a calculated source or flow measurement' }}>
    <mesh geometry={geometry} castShadow><meshStandardMaterial color="#34483e" roughness={.9}/></mesh>
    {route.filter((_, i) => i === 0 || i === route.length - 1).map((p, i) => <mesh key={i} position={p} visible={progress === 1}>
      <sphereGeometry args={[.052, 12, 8]}/><meshStandardMaterial color="#a3ada2" metalness={.75} roughness={.3}/>
    </mesh>)}
  </group>
}
