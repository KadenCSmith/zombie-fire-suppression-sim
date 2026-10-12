import { simulateContactCooling, type ContactCoolingConfig, type ContactPatchSpec } from '../story/contactCooling'

/** New-alternative policy, independently checked against continuous filling.
 * The protected original retains its own 0.05 s defaults and cached history. */
export const ALTERNATIVE_CONTACT_STEP_S = .00625

/** External adapter over the original's existing public, deterministic API.
 * Re-evaluates from the initial condition at accepted targets; never patches or
 * copies the protected integrator, its cache, or its presentation defaults. */
export function createContactCoolingSession(overrides: Partial<ContactCoolingConfig>, patches: readonly ContactPatchSpec[]) {
  const ownedConfig = structuredClone(overrides), ownedPatches = structuredClone(patches)
  const endS = ownedConfig.endTimeS ?? 90
  let timeS = ownedConfig.startTimeS ?? 44
  let state = simulateContactCooling(timeS, 'gradual', ownedConfig, ownedPatches)
  return {
    advanceTo(targetS: number) {
      if (!Number.isFinite(targetS) || targetS < timeS || targetS > endS) throw new Error('Contact time must advance monotonically inside the observation window.')
      state = simulateContactCooling(targetS, 'gradual', ownedConfig, ownedPatches)
      timeS = targetS
      return structuredClone(state)
    },
    snapshot: () => structuredClone(state),
  }
}
