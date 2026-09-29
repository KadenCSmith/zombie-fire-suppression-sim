import { SchemaError } from './schema';
import type {
  AcceptedState, BlockDescriptor, ControllerCheckpoint, EventMarker, FieldDescriptor,
  Float64Token, GridDescriptor, PhysicalStateManifest, Provenance, ValidationOptions,
} from './schema';
import { decodeFloat64 } from './canonical';
import { verifyBundle } from './hash';
import type { Sha256Adapter } from './hash';

export interface ReplaySelection {
  readonly state: AcceptedState;
  readonly grid: GridDescriptor;
  readonly provenance: Provenance;
  readonly controller: ControllerCheckpoint | null;
  readonly events: readonly EventMarker[];
}
export interface ReplayGap {
  readonly kind: 'prefix' | 'internal';
  readonly previousStateId: string | null;
  readonly nextStateId: string;
  readonly missingCommits: number;
  readonly missingAcceptedSteps: number;
  readonly previousTimeS: Float64Token | null;
  readonly nextTimeS: Float64Token;
}
export interface ReplayCoverage {
  readonly storedStates: number;
  readonly firstCommitIndex: number;
  readonly lastCommitIndex: number;
  readonly gaps: readonly ReplayGap[];
  readonly suffixExtent: 'unknown';
}
export type ReplayPosition =
  | { readonly kind: 'exact'; readonly states: readonly ReplaySelection[] }
  | { readonly kind: 'before-recording'; readonly next: ReplaySelection }
  | { readonly kind: 'after-recording'; readonly previous: ReplaySelection }
  | { readonly kind: 'between'; readonly previous: ReplaySelection; readonly next: ReplaySelection;
      readonly gap: ReplayGap | null };
export interface FieldInspection {
  readonly descriptor: FieldDescriptor;
  readonly grid: GridDescriptor;
  readonly block: BlockDescriptor;
  readonly bytes: Uint8Array;
}
export interface ReplayInspector {
  readonly manifestSha256: string;
  manifest(): PhysicalStateManifest;
  coverage(): ReplayCoverage;
  selectState(id: string): ReplaySelection | null;
  selectCommit(commitIndex: number): ReplaySelection | null;
  atTime(timeS: number): readonly ReplaySelection[];
  positionAtTime(timeS: number): ReplayPosition;
  readField(stateId: string, fieldId: string): FieldInspection | null;
}
export async function createReplayInspector(
  manifest: unknown, payloads: ReadonlyMap<string, Uint8Array>, adapter: Sha256Adapter,
  options: ValidationOptions = {},
): Promise<ReplayInspector> {
  const verified = await verifyBundle(manifest, payloads, adapter, options), m = verified.manifest;
  const states = m.states, times = states.map(s => decodeFloat64(s.timeS));
  const byId = new Map(states.map(s => [s.id, s])), byCommit = new Map(states.map(s => [s.commitIndex, s]));
  const grids = new Map(m.grids.map(g => [g.id, g])), provenance = new Map(m.provenance.map(p => [p.id, p]));
  const controllers = new Map(m.controllers.map(c => [c.id, c]));
  const fields = new Map(m.fieldDefinitions.map(f => [f.id, f])), blocks = new Map(m.blocks.map(b => [b.id, b]));
  const eventMap = new Map<string, EventMarker[]>();
  for (const e of m.events) { const a = eventMap.get(e.stateId) ?? []; a.push(e); eventMap.set(e.stateId, a); }
  for (const a of eventMap.values()) a.sort((x, y) => x.order - y.order);
  const gaps: ReplayGap[] = [], internal = new Map<string, ReplayGap>();
  for (let i = 0; i < states.length; i++) {
    const next = states[i], previous = i === 0 ? null : states[i - 1];
    const missing = previous === null ? next.commitIndex : next.commitIndex - previous.commitIndex - 1;
    if (missing === 0) continue;
    const gap: ReplayGap = {
      kind: previous === null ? 'prefix' : 'internal', previousStateId: previous?.id ?? null,
      nextStateId: next.id, missingCommits: missing,
      missingAcceptedSteps: next.acceptedStepIndex - (previous?.acceptedStepIndex ?? 0) -
        (next.kind === 'step' ? 1 : 0),
      previousTimeS: previous?.timeS ?? null, nextTimeS: next.timeS,
    };
    gaps.push(gap); if (previous !== null) internal.set(next.id, gap);
  }
  const clone = <T>(v: T): T => structuredClone(v);
  const selection = (s: AcceptedState): ReplaySelection => clone({
    state: s, grid: grids.get(s.gridId)!, provenance: provenance.get(s.provenanceId)!,
    controller: s.controllerId === null ? null : controllers.get(s.controllerId)!,
    events: eventMap.get(s.id) ?? [],
  });
  const checkTime = (time: number) => {
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0)
      throw new SchemaError('TIME', '$replay', 'Require a finite nonnegative physical time.');
  };
  const lowerBound = (time: number): number => {
    let lo = 0, hi = times.length;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (times[mid] < time) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  const atTime = (time: number): ReplaySelection[] => {
    checkTime(time); const out: ReplaySelection[] = [];
    for (let i = lowerBound(time); i < states.length && times[i] === time; i++) out.push(selection(states[i]));
    return out;
  };
  return Object.freeze({
    manifestSha256: m.integrity!.manifestSha256,
    manifest: () => clone(m),
    coverage: () => clone({
      storedStates: states.length, firstCommitIndex: states[0].commitIndex,
      lastCommitIndex: states[states.length - 1].commitIndex, gaps, suffixExtent: 'unknown' as const,
    }),
    selectState(id: string) {
      if (typeof id !== 'string') throw new SchemaError('ID', '$replay', 'Expected a state ID.');
      const s = byId.get(id); return s === undefined ? null : selection(s);
    },
    selectCommit(index: number) {
      if (!Number.isSafeInteger(index) || index < 0 || Object.is(index, -0))
        throw new SchemaError('INDEX', '$replay', 'Expected a nonnegative safe commit index.');
      const s = byCommit.get(index); return s === undefined ? null : selection(s);
    },
    atTime,
    positionAtTime(time: number): ReplayPosition {
      checkTime(time); const i = lowerBound(time);
      if (i < states.length && times[i] === time) return { kind: 'exact', states: atTime(time) };
      if (i === 0) return { kind: 'before-recording', next: selection(states[0]) };
      if (i === states.length) return { kind: 'after-recording', previous: selection(states[i - 1]) };
      return { kind: 'between', previous: selection(states[i - 1]), next: selection(states[i]),
        gap: clone(internal.get(states[i].id) ?? null) };
    },
    readField(stateId: string, fieldId: string): FieldInspection | null {
      if (typeof stateId !== 'string' || typeof fieldId !== 'string')
        throw new SchemaError('ID', '$replay', 'Expected state and field IDs.');
      const s = byId.get(stateId), f = fields.get(fieldId);
      if (s === undefined || f === undefined) return null;
      const ownerFields = f.owner === 'physics' ? s.fields :
        s.controllerId === null ? [] : controllers.get(s.controllerId)!.fields;
      const binding = ownerFields.find(b => b.fieldId === fieldId);
      if (binding === undefined) return null;
      return { descriptor: clone(f), grid: clone(grids.get(s.gridId)!), block: clone(blocks.get(binding.blockId)!),
        bytes: new Uint8Array(verified.payloads.get(binding.blockId)!) };
    },
  });
}
