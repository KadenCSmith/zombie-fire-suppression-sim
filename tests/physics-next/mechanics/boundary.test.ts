import { describe, expect, it } from 'vitest'
import { createGeometryGrid } from '../../../src/physics-next/geometry/types'
import { createGeometryPartition } from '../../../src/physics-next/geometry/interfaces'
import { voxelizeGeometry } from '../../../src/physics-next/geometry/voxelize'
import { cloneOwnedState } from '../../../src/physics-next/numerics/transaction'
import {
  MECHANICS_BOUNDARY_VERSION, MechanicalStateOwner,
  prepareContactPair, prepareMechanicsDomain, scatterContactForces,
  type MechanicalAcceptedStateV1, type MechanicalCandidate, type MechanicalGatePolicy,
} from '../../../src/physics-next/mechanics/boundary'

function prepared() {
  const grid = createGeometryGrid({ nx: 1, ny: 1, nz: 1, originM: [0, 0, 0], sizeM: [2, 1, 1] })
  const partition = createGeometryPartition(grid, [], { id: 'peat-a', role: 'soil' })
  const voxels = voxelizeGeometry(partition, { volumeToleranceM3: 0, maxDepth: 3, maxBlocks: 20000 })
  return prepareMechanicsDomain('fixture-geometry-v1', voxels, {
    arithmeticFractionTolerance: 1e-12, partitionToleranceM3: 1e-12, maximumUnresolvedVolumeM3: 0,
  })
}

function initial(): { state: MechanicalAcceptedStateV1; domain: ReturnType<typeof prepareMechanicsDomain> } {
  const domain = prepared()
  if (!domain.ok) throw new Error(JSON.stringify(domain.issues))
  const n = domain.value.cellCount
  const state: MechanicalAcceptedStateV1 = {
    format: 'zfs-mechanics-state', version: 1,
    identity: { sourceRevision: 'synthetic-fixture', geometryId: domain.value.geometryId,
      materialSetId: 'synthetic-material', materialRevision: 1, modelId: 'zero-load',
      historyLayoutId: 'synthetic-history-v1', scenarioId: 'synthetic-scene' },
    timeS: 0, acceptedStep: 0, displacementM: new Float64Array(3 * domain.value.nodeCount),
    effectiveStressPa: new Float64Array(6 * n), poreVolumeM3: Float64Array.from(domain.value.cellVolumesM3, v => 0.5 * v),
    damage: new Float64Array(n).fill(0.1), contactPressurePa: new Float64Array(n), crackApertureM: new Float64Array(n),
    referencePorePressurePa: new Float64Array(n), materialHistory: new Float64Array(6),
    contactHistory: new Float64Array(2), fractureHistory: new Float64Array(3),
    recoverableEnergyJ: 0, cumulativePressureWorkJ: 0, cumulativeExternalWorkJ: 0,
    cumulativePhysicalDissipationJ: 0, cumulativeNumericalLossJ: 0,
  }
  return { state, domain }
}

const gate: MechanicalGatePolicy = {
  forceNorm: 'linf', forceScaleN: 1, forceAbsoluteToleranceN: 1e-8,
  forceRelativeTolerance: 0, energyScaleJ: 1, energyAbsoluteToleranceJ: 1e-8,
  energyRelativeTolerance: 0, combination: 'max', boundary: 'inclusive', penetrationToleranceM: 1e-6,
}

function candidate(previous: MechanicalAcceptedStateV1, baseVersion: number): MechanicalCandidate {
  const next = cloneOwnedState(previous)
  next.timeS += 1
  next.acceptedStep += 1
  return { baseVersion, next, forceResidualN: Float64Array.of(0), forceReferenceN: 0,
    maximumPenetrationM: 0, pressureWorkJ: 0, thermalCouplingTransferJ: 0,
    externalWorkJ: 0, physicalDissipationJ: 0, numericalLossJ: 0 }
}

describe('mechanics boundary with installed D and G packages', () => {
  it('prepares an owned solid domain from real geometry voxelization', () => {
    const result = prepared()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.value.activeCellMask]).toEqual([1])
    expect(result.value.cellVolumesM3[0]).toBe(2)
    expect(result.value.occupiedVolumeM3).toBe(2)
  })

  it('commits an accepted candidate and preserves state on rejection', () => {
    const { state, domain } = initial()
    if (!domain.ok) throw new Error('expected prepared domain')
    const owner = new MechanicalStateOwner(state, domain.value)
    const accepted = owner.attempt({ enabled: true, dtS: 1, policy: gate, propose: candidate })
    expect(accepted.status).toBe('accepted')
    expect(owner.acceptedVersion).toBe(1)
    expect(owner.readAccepted().timeS).toBe(1)
    const before = owner.readAccepted()
    const rejected = owner.attempt({ enabled: true, dtS: 1, policy: gate, propose: (previous, version) => {
      const trial = candidate(previous, version)
      trial.next.damage[0] = 0
      return trial
    } })
    expect(rejected.status).toBe('rejected')
    expect(owner.acceptedVersion).toBe(1)
    expect(owner.readAccepted()).toEqual(before)
  })

  it('restores a versioned mechanical checkpoint', () => {
    const { state, domain } = initial()
    if (!domain.ok) throw new Error('expected prepared domain')
    const owner = new MechanicalStateOwner(state, domain.value)
    owner.attempt({ enabled: true, dtS: 1, policy: gate, propose: candidate })
    const restored = MechanicalStateOwner.restore(owner.checkpoint(), domain.value, state.identity)
    expect(restored.readAccepted()).toEqual(owner.readAccepted())
    expect(restored.acceptedVersion).toBe(owner.acceptedVersion)
    expect(owner.checkpoint().contract).toBe(MECHANICS_BOUNDARY_VERSION)
  })

  it('requires an explicit contact binding and scatters balanced forces', () => {
    const sample = {
      key: 'synthetic-cap-face', patchId: 'fixture-patch', ordinal: 0, pointM: [0.5, 0.5, 0.5] as const,
      normalFromAToB: [0, 0, 1] as const,
      materialA: { id: 'a-cap', role: 'cap' as const }, materialB: { id: 'z-soil', role: 'soil' as const },
      cellA: 0, cellB: 1, areaM2: 0.2,
    }
    expect(prepareContactPair(sample, null, 2).ok).toBe(false)
    const pair = prepareContactPair(sample, {
      sampleKey: sample.key, decisionId: 'synthetic-reference-area', modelId: 'supplied-traction',
      referenceAreaM2: 0.25, sideA: [{ node: 0, weight: 1 }], sideB: [{ node: 1, weight: 1 }],
    }, 2)
    expect(pair.ok).toBe(true)
    if (!pair.ok) return
    expect([...scatterContactForces(pair.value, Float64Array.of(0, 0, 20))]).toEqual([0, 0, -5, 0, 0, 5])
  })
})
