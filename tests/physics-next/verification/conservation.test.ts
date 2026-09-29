import { describe, expect, it } from 'vitest';
import {
  baselineCoupledBalances, evaluateConservation, type BalanceObservation, type ConservationUnit,
} from '../../../src/physics-next/verification/conservation';
import { CoupledTransport } from '../../../src/coupled/model';
import { MOLAR, co2SolidU } from '../../../src/coupled/thermodynamics';
import type { MechanicalState } from '../../../src/coupled/mechanics';
import {
  FIXTURE_EVIDENCE, NO_INSERTION_HISTORY, NO_INVENTORY_CORRECTIONS, MOLAR_KG_MOL,
  known, unknown, scalarFixture, runFixture, setTerm, deepFreeze, allNumbersFinite,
  extensiveSum, baselineSolidU, tinyInventory, recomputeInventories,
  captureAudit, coupledObservations, evaluateControlledInterval, closedScenario,
  makeTransport, makeEngine, byteImage, assertSeparateBuffers, captureTransportPhysical, captureEnginePhysical,
} from '../../fixtures/physics-next/conservationFixtures';

describe('dimensioned signed ledgers and fail-closed evidence', () => {
  for (const [unit, kind] of [['kg', 'mass'], ['mol', 'species'], ['J', 'energy'], ['J', 'work']] as const) {
    it(`closes exact signed ${kind} arithmetic in ${unit}`, () => {
      const r = runFixture(scalarFixture(unit, kind));
      expect(r.status).toBe('pass');
      expect([r.physicalResidual, r.accountedResidual, r.normalizedPhysical, r.normalizedAccounted]).toEqual([0, 0, 0, 0]);
      expect(r.claim).toBe('declared-numerical-balance-only');
    });
  }
  it('retains negative sources, inward boundary flow and decreasing storage', () => {
    const f = scalarFixture('mol', 'species');
    setTerm(f, 'storage', known(-3, 'mol')); setTerm(f, 'boundary', known(-2, 'mol')); setTerm(f, 'source', known(-5, 'mol'));
    expect(runFixture(f).physicalResidual).toBe(0); expect(runFixture(f).status).toBe('pass');
  });
  it('distinguishes an omitted transfer, explicit unknown and wrong zero', () => {
    const missing = scalarFixture(), absent = scalarFixture(), wrongZero = scalarFixture();
    missing.observation = { ...missing.observation, terms: missing.observation.terms.filter(t => t.id !== 'source') };
    setTerm(absent, 'source', unknown('Transfer was not measured', 'kg'));
    setTerm(wrongZero, 'source', known(0, 'kg'));
    expect(runFixture(missing).status).toBe('fail'); expect(runFixture(missing).physicalResidual).toBe(null);
    expect(runFixture(absent).status).toBe('unknown'); expect(runFixture(absent).physicalResidual).toBe(null);
    expect(runFixture(wrongZero).physicalResidual).toBe(5); expect(runFixture(wrongZero).status).toBe('fail');
  });
  it('does not promote a closed known subtotal when coverage is unknown', () => {
    const f = scalarFixture();
    f.observation = { ...f.observation, coverage: { state: 'unknown', reason: 'Boundary enthalpy missing', evidence: [] } };
    const r = runFixture(f);
    expect(r.knownTermSum).toBe(0); expect(r.physicalResidual).toBe(null); expect(r.status).toBe('unknown');
  });
  it('uses max(abs, relative*dimensioned reference), not their sum', () => {
    const f = scalarFixture(); setTerm(f, 'storage', known(3.1875, 'kg'));
    f.tolerance = { ...f.tolerance, absolute: 0.125, relative: 0.25, reference: 0.5 };
    const r = runFixture(f);
    expect(r.tolerance.allowedResidual).toBe(0.125); expect(r.normalizedPhysical).toBe(1.5); expect(r.status).toBe('fail');
  });
  it('retains numerical scale when kilograms are converted to moles with matching tolerances', () => {
    const mass = scalarFixture(); setTerm(mass, 'storage', known(3.125, 'kg'));
    mass.tolerance = { ...mass.tolerance, absolute: 0.25 };
    const mol = scalarFixture('mol', 'species'), kgPerMol = 0.03125;
    for (const t of mass.observation.terms) {
      if (t.quantity.state !== 'known') throw new Error('Expected known synthetic value');
      setTerm(mol, t.id, known(t.quantity.value / kgPerMol, 'mol'));
    }
    mol.tolerance = { ...mol.tolerance, absolute: 0.25 / kgPerMol, reference: 5 / kgPerMol };
    expect(runFixture(mass).normalizedPhysical).toBe(runFixture(mol).normalizedPhysical);
    expect(runFixture(mol).status).toBe('pass');
  });
  it('requires a positive allowance and rationale without inventing a unit floor', () => {
    for (const tolerance of [
      { absolute: 0, relative: 0, reference: 0 }, { absolute: -1, relative: 0, reference: 5 },
      { absolute: 0, relative: Number.MAX_VALUE, reference: 2 },
    ]) {
      const f = scalarFixture(); f.tolerance = { ...f.tolerance, ...tolerance };
      expect(runFixture(f).status).toBe('fail');
    }
    const f = scalarFixture(); f.tolerance = { ...f.tolerance, rationale: ' ' };
    expect(runFixture(f).status).toBe('fail');
  });
  it('fails dimension, evidence and manifest corruption rather than discarding it', () => {
    const wrongUnit = scalarFixture(); setTerm(wrongUnit, 'source', known(5, 'J'));
    expect(runFixture(wrongUnit).status).toBe('fail');
    const noEvidence = scalarFixture();
    setTerm(noEvidence, 'source', { state: 'known', value: 5, unit: 'kg', evidence: [] });
    expect(runFixture(noEvidence).status).toBe('fail');
    for (const extra of [{ id: 'source', quantity: known(5, 'kg') }, { id: 'extra', quantity: known(0, 'kg') }]) {
      const f = scalarFixture(); f.observation = { ...f.observation, terms: [...f.observation.terms, extra] };
      expect(runFixture(f).status).toBe('fail');
    }
  });
  it('rejects nonfinite values while returning only finite numbers or explicit null', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      const f = scalarFixture(); setTerm(f, 'source', known(value, 'kg'));
      const r = runFixture(f); expect(r.status).toBe('fail'); expect(allNumbersFinite(r)).toBe(true);
      expect(JSON.parse(JSON.stringify(r)).status).toBe('fail');
    }
  });
  it('preserves a small nonzero residual amid cancellation and labels normalization overflow', () => {
    const f = scalarFixture();
    setTerm(f, 'boundary', known(1e16, 'kg')); setTerm(f, 'source', known(1e16, 'kg')); setTerm(f, 'storage', known(1, 'kg'));
    expect(runFixture(f).physicalResidual).toBe(1); f.tolerance = { ...f.tolerance, absolute: Number.MIN_VALUE };
    const r = runFixture(f);
    expect(r.status).toBe('fail'); expect(r.normalizedPhysical).toBe(null);
    expect(r.notes.length).toBeGreaterThan(0); expect(allNumbersFinite(r)).toBe(true);
  });
  it('does not conceal known imbalance when separate correction evidence is unknown', () => {
    const f = scalarFixture(); setTerm(f, 'storage', known(4, 'kg'));
    f.observation = { ...f.observation, corrections: {
      netInput: unknown('not instrumented', 'kg'), grossAdjustment: unknown('not instrumented', 'kg'),
      rationale: 'Missing correction instrumentation is not zero.',
    } };
    const r = runFixture(f);
    expect(r.status).toBe('fail'); expect(r.physicalResidual).toBe(1);
    expect(r.accountedResidual).toBe(null); expect(r.unknowns.length).toBeGreaterThan(0);
  });
  it('enforces physical time and equal-time event/initialization semantics', () => {
    const f = scalarFixture();
    f.observation = { ...f.observation, interval: { startTimeS: 1, endTimeS: 1, kind: 'advance' } };
    expect(runFixture(f).status).toBe('fail');
    for (const kind of ['event', 'initialization'] as const) {
      f.observation = { ...f.observation, interval: { startTimeS: 1, endTimeS: 1, kind } };
      expect(runFixture(f).status).toBe('pass');
    }
    f.observation = { ...f.observation, interval: { startTimeS: 2, endTimeS: 1, kind: 'event' } };
    expect(runFixture(f).status).toBe('fail');
  });
});
describe('positivity corrections remain separately visible', () => {
  it('cannot hide numerical mole creation behind a zero corrected residual', () => {
    const f = scalarFixture('mol', 'species');
    const initial = new Float64Array([1, 1]), afterTransport = new Float64Array([-0.125, 1]), corrected = new Float64Array([0, 1]);
    const boundaryOut = 1.125, added = corrected[0] - afterTransport[0];
    setTerm(f, 'storage', known(extensiveSum(corrected) - extensiveSum(initial), 'mol'));
    setTerm(f, 'boundary', known(boundaryOut, 'mol')); setTerm(f, 'source', known(0, 'mol'));
    f.observation = { ...f.observation, corrections: {
      netInput: known(added, 'mol'), grossAdjustment: known(Math.abs(added), 'mol'),
      rationale: 'Synthetic explicit positivity intervention; not an accepted baseline timestep.',
    } };
    f.correctionLimit = { ...f.correctionLimit, maxGross: 0.25 };
    const r = runFixture(f);
    expect(r.physicalResidual).toBe(0.125); expect(r.accountedResidual).toBe(0);
    expect(r.checks.accounted).toBe(true); expect(r.checks.physical).toBe(false); expect(r.status).toBe('fail');
  });
  it('checks gross corrections even when opposing interventions sum to zero', () => {
    const f = scalarFixture();
    f.observation = { ...f.observation, corrections: {
      netInput: known(0, 'kg'), grossAdjustment: known(0.25 + 0.25, 'kg'), rationale: 'Two synthetic opposite-signed adjustments.',
    } };
    f.correctionLimit = { ...f.correctionLimit, maxGross: 0.125 };
    const r = runFixture(f);
    expect(r.physicalResidual).toBe(0); expect(r.accountedResidual).toBe(0);
    expect(r.checks.grossCorrection).toBe(false); expect(r.status).toBe('fail');
  });
  it('allows only disclosed adjustments inside all three declared budgets', () => {
    const f = scalarFixture(); setTerm(f, 'storage', known(3.0625, 'kg'));
    f.tolerance = { ...f.tolerance, absolute: 0.125 }; f.correctionLimit = { ...f.correctionLimit, maxGross: 0.0625 };
    f.observation = { ...f.observation, corrections: {
      netInput: known(0.0625, 'kg'), grossAdjustment: known(0.0625, 'kg'), rationale: 'Declared tiny synthetic correction.',
    } };
    const r = runFixture(f);
    expect(r.status).toBe('pass'); expect(r.physicalResidual).toBe(0.0625); expect(r.correction.grossAdjustment).toBe(0.0625);
  });
  it('rejects impossible net/gross disclosures and wrong correction dimensions', () => {
    for (const gross of [-1, 0.125]) {
      const f = scalarFixture();
      f.observation = { ...f.observation, corrections: {
        netInput: known(0.25, 'kg'), grossAdjustment: known(gross, 'kg'), rationale: 'Deliberately malformed disclosure.',
      } };
      expect(runFixture(f).status).toBe('fail');
    }
    const f = scalarFixture(); f.correctionLimit = { ...f.correctionLimit, unit: 'mol' };
    expect(runFixture(f).status).toBe('fail');
  });
});
describe('independent extensive inventory and work reconstruction', () => {
  it('uses explicit baseline reference constants but no production total/residual helpers', () => {
    expect(MOLAR_KG_MOL).toEqual(MOLAR);
    for (const t of [150, 194.67, 210]) expect(baselineSolidU(t)).toBe(co2SolidU(t));
    const n = recomputeInventories(tinyInventory());
    const expectedKg = 15 + 5 * 0.01801528 + 0.125 + 3 * 0.031998 + 7 * 0.0440095 + 11 * 0.0280134;
    expect(Math.abs(n.massKg - expectedKg)).toBeLessThan(1e-12); expect(n.speciesMol.slice(0, 3)).toEqual([3, 7, 11]);
    expect(Math.abs(n.speciesMol[3] - 5)).toBeLessThan(1e-12); expect(n.cellEnergyJ).toBe(12); expect(n.solidEnergyJ).toBeLessThan(0);
  });
  it('does not double-count water vapor or depend on a gas-only H2O pool', () => {
    const a = tinyInventory(), n = recomputeInventories(a); a.gasMol[3].fill(0);
    expect(recomputeInventories(a).massKg).toBe(n.massKg); expect(recomputeInventories(a).speciesMol[3]).toBe(n.speciesMol[3]);
    a.waterAllPhasesKg[0] += MOLAR_KG_MOL[3];
    expect(Math.abs(recomputeInventories(a).speciesMol[3] - n.speciesMol[3] - 1)).toBeLessThan(1e-12);
  });
  it('exposes each species separately so compensating component errors cannot cancel', () => {
    const a = tinyInventory(), before = recomputeInventories(a); a.gasMol[0][0] += 0.5; a.gasMol[1][0] -= 0.5;
    const after = recomputeInventories(a);
    expect(after.speciesMol[0] - before.speciesMol[0]).toBe(0.5); expect(after.speciesMol[1] - before.speciesMol[1]).toBe(-0.5);
  });
  it('rejects shape, nonfinite and negative inputs without clipping or mutating them', () => {
    const a = tinyInventory(); a.gasMol[0][0] = -0.125; const before = byteImage(a.gasMol[0]);
    expect(() => recomputeInventories(a)).toThrow(/Negative primary/); expect(byteImage(a.gasMol[0])).toEqual(before);
    expect(() => recomputeInventories({ ...tinyInventory(), cellEnergyJ: new Float64Array(1) })).toThrow(/sized Float64/);
    const b = tinyInventory(); b.cellEnergyJ[0] = NaN; expect(() => recomputeInventories(b)).toThrow(/Nonfinite/);
    expect(() => recomputeInventories({ ...tinyInventory(), grid: [2, 0, 1] })).toThrow(/Invalid cell grid/);
  });
  it('independently closes six balances for a controlled closed baseline interval', () => {
    const t = makeTransport(), before = captureAudit(t, NO_INSERTION_HISTORY); expect(t.step(0.125)).toBeGreaterThan(0);
    const after = captureAudit(t, NO_INSERTION_HISTORY), results = evaluateControlledInterval(before, after);
    expect(results).toHaveLength(6); expect(results.map(r => r.status)).toEqual(Array(6).fill('pass'));
    after.ledger.massResidualKg = 123; after.ledger.energyResidualJ = -456; after.ledger.speciesResidualMol.fill(789);
    expect(evaluateControlledInterval(before, after)).toEqual(results);
    const saved = byteImage(after.arrays.fuelKg); t.fuel[0] += 1; expect(byteImage(after.arrays.fuelKg)).toEqual(saved);
  });
  it('reconstructs a nonzero heater input from endpoint inventories and catches its omission', () => {
    const s = closedScenario(); s.source.enabled = true; s.source.heatGenerationWm3 = 100;
    const t = new CoupledTransport(s); t.gasGravityMS2 = 0;
    const before = captureAudit(t, NO_INSERTION_HISTORY); t.step(0.125);
    const after = captureAudit(t, NO_INSERTION_HISTORY);
    expect(after.ledger.heaterJ - before.ledger.heaterJ).toBeGreaterThan(1e-5);
    expect(evaluateControlledInterval(before, after).map(r => r.status)).toEqual(Array(6).fill('pass'));
    after.ledger.heaterJ = before.ledger.heaterJ; expect(evaluateControlledInterval(before, after)[5].status).toBe('fail');
  });
  it('reconstructs nonzero atmospheric species/mass/enthalpy transfers without trusting reported residuals', () => {
    const s = closedScenario(); s.atmosphere.topGasBoundary = 'atmospheric';
    s.soil.moistureSaturation = 0; s.atmosphere.waterVaporMoleFraction = 0;
    const t = new CoupledTransport(s); t.gasGravityMS2 = 0;
    t.gas[1][0] += 1e-4; t.resolve(); t.sealInitialState();
    const before = captureAudit(t, NO_INSERTION_HISTORY); t.step(0.001);
    const after = captureAudit(t, NO_INSERTION_HISTORY);
    expect(after.boundaryMol.some((value, i) => value !== before.boundaryMol[i])).toBe(true);
    expect(evaluateControlledInterval(before, after).map(r => r.status)).toEqual(Array(6).fill('pass'));
  });
  it('reconstructs coupled reaction consumption/production and heat as internal mass conversion', () => {
    const s = closedScenario(); s.soil.moistureSaturation = 0; s.atmosphere.waterVaporMoleFraction = 0; s.model.smolderRateS = 1e-4;
    s.hotRegions = [{ id: 'C-controlled-hot', shape: 'slab', centerXM: 0.5, centerYM: 0.5, centerDepthM: 0.5,
      sizeXM: 1, sizeYM: 1, thicknessM: 1, temperatureC: 270, fuelFraction: 1 }];
    const t = new CoupledTransport(s); t.gasGravityMS2 = 0; const before = captureAudit(t, NO_INSERTION_HISTORY);
    t.step(0.01); const after = captureAudit(t, NO_INSERTION_HISTORY);
    expect(after.sourceMol[0] - before.sourceMol[0]).toBeLessThan(0); expect(after.sourceMol[1] - before.sourceMol[1]).toBeGreaterThan(0);
    expect(after.sourceMol[3] - before.sourceMol[3]).toBeGreaterThan(0); expect(after.ledger.reactionJ - before.ledger.reactionJ).toBeGreaterThan(0);
    expect(evaluateControlledInterval(before, after).map(r => r.status)).toEqual(Array(6).fill('pass'));
  });
  it('distinguishes internal sublimation into gas CO2 from external imported total mass', () => {
    const t = makeTransport(); t.insertDryIce(0.001, 194.67, { xM: 0.5, yM: 0.5, depthM: 0.5 });
    const before = captureAudit(t, NO_INSERTION_HISTORY); t.step(0.01);
    const after = captureAudit(t, NO_INSERTION_HISTORY);
    expect(after.arrays.solidCO2Kg).toBeLessThan(before.arrays.solidCO2Kg);
    expect(after.sourceMol[1] - before.sourceMol[1]).toBeGreaterThan(0);
    expect(after.ledger.externalSolidMassInKg).toBe(before.ledger.externalSolidMassInKg);
    expect(evaluateControlledInterval(before, after).map(r => r.status)).toEqual(Array(6).fill('pass'));
  });
  it('detects a real inventory omission even when the reported residual is forged to zero', () => {
    const t = makeTransport(), before = captureAudit(t, NO_INSERTION_HISTORY);
    t.step(0.125); t.fuel[0] += 0.25; t.ledger.massResidualKg = 0;
    const result = evaluateControlledInterval(before, captureAudit(t, NO_INSERTION_HISTORY))[0];
    expect(result.status).toBe('fail'); expect(Math.abs(result.physicalResidual! - 0.25)).toBeLessThan(1e-9);
  });
  it('does not fabricate insertion history or numerical correction evidence', () => {
    const t = makeTransport(), before = captureAudit(t); t.step(0.125); const after = captureAudit(t);
    const observations = coupledObservations(before, after, null), defs = baselineCoupledBalances();
    for (const o of observations) {
      const d = defs.find(definition => definition.id === o.id)!;
      const r = evaluateConservation(d, o, { unit: d.unit, absolute: 1e-5, relative: 0, reference: 0,
        rationale: 'Unknown-evidence test only.', referenceRationale: 'No relative allowance.' },
        { unit: d.unit, maxGross: 0, rationale: 'No undisclosed corrections.' });
      expect(r.status).toBe('unknown'); expect(r.accountedResidual).toBe(null);
    }
  });
  it('accounts for imported solid energy and insertion work exactly once', () => {
    const t = makeTransport(), before = captureAudit(t, NO_INSERTION_HISTORY);
    t.insertDryIce(0.001, 194.67, { xM: 0.5, yM: 0.5, depthM: 0.5 });
    const after = captureAudit(t, NO_INSERTION_HISTORY), results = evaluateControlledInterval(before, after);
    expect(results.map(r => r.status)).toEqual(Array(6).fill('pass'));
    const thermal = results.find(r => r.id === 'coupled.thermal-energy')!;
    expect(thermal.interval.kind).toBe('event');
    expect(thermal.terms.find(t => t.id === 'external-solid-energy-in')!.value!).toBeLessThan(0);
    const insertWork = after.ledger.insertionWorkJ!; expect(insertWork).toBeGreaterThan(1e-5);
    const badObservation = coupledObservations(before, after, NO_INVENTORY_CORRECTIONS)[5];
    const bad: BalanceObservation = { ...badObservation, terms: badObservation.terms.map(term => term.id === 'pore-work-out'
      ? { id: term.id, quantity: known(after.ledger.pressureWorkJ - before.ledger.pressureWorkJ, 'J') } : term) };
    const broken = evaluateConservation(baselineCoupledBalances()[5], bad, {
      unit: 'J', absolute: 1e-5, relative: 0, reference: 0,
      rationale: 'Baseline insertion arithmetic ceiling.', referenceRationale: 'Absolute only.',
    }, { unit: 'J', maxGross: 0, rationale: 'No fixture inventory corrections.' });
    expect(broken.status).toBe('fail'); expect(Math.abs(broken.physicalResidual! + insertWork)).toBeLessThan(1e-5);
  });
  it('derives gauge work from pressure and pore-volume increments, not endpoint force-displacement', () => {
    const pressureBefore = new Float64Array([10, 10]), pressureAfter = new Float64Array([14, 6]);
    const reference = new Float64Array([10, 10]), poreBefore = new Float64Array([1, 1]), poreAfter = new Float64Array([1.5, 0.5]);
    let gaugeJ = 0, referenceJ = 0;
    for (let i = 0; i < 2; i++) {
      const dv = poreAfter[i] - poreBefore[i];
      gaugeJ += 0.5 * (pressureBefore[i] + pressureAfter[i] - 2 * reference[i]) * dv; referenceJ += reference[i] * dv;
    }
    expect(gaugeJ).toBe(2); expect(referenceJ).toBe(0); const d = baselineCoupledBalances()[6];
    const observation: BalanceObservation = {
      id: d.id, interval: { startTimeS: 0, endTimeS: 1, kind: 'advance' },
      coverage: { state: 'complete', evidence: [FIXTURE_EVIDENCE] },
      terms: [
        { id: 'elastic-energy-change', quantity: known(1.5, 'J') }, { id: 'fracture-energy-change', quantity: known(0.25, 'J') },
        { id: 'cap-energy-change', quantity: known(0.25, 'J') }, { id: 'gauge-pressure-work-in', quantity: known(gaugeJ, 'J') },
      ],
      corrections: { netInput: known(0, 'J'), grossAdjustment: known(0, 'J'), rationale: 'Exact fixture.' },
    };
    const tolerance = { unit: 'J' as ConservationUnit, absolute: 1e-5, relative: 1e-3, reference: Math.abs(gaugeJ),
      rationale: 'Existing baseline incremental fracture gate.', referenceRationale: 'Absolute incremental gauge work in J.' };
    const limit = { unit: 'J' as ConservationUnit, maxGross: 0, rationale: 'Exact fixture.' };
    expect(evaluateConservation(d, observation, tolerance, limit).status).toBe('pass');
    const doubled = { ...observation, terms: observation.terms.map(term => term.id === 'gauge-pressure-work-in'
      ? { id: term.id, quantity: known(2 * gaugeJ, 'J') } : term) };
    expect(evaluateConservation(d, doubled, tolerance, limit).status).toBe('fail');
  });
});
describe('immutability and deterministic transactional rejection', () => {
  it('leaves frozen ledger inputs unchanged and returns detached evidence arrays', () => {
    const f = scalarFixture(), before = structuredClone(f); deepFreeze(f); const r = runFixture(f);
    expect(f).toEqual(before); expect(r.status).toBe('pass');
    expect(Reflect.set(r.terms[0].evidence, 0, 'tampered return evidence')).toBe(true);
    expect(f).toEqual(before); expect(runFixture(f).evidence).not.toContain('tampered return evidence');
  });
  it('makes ordering deterministic and baseline definitions independent between calls', () => {
    const a = scalarFixture(), b = scalarFixture(); b.observation = { ...b.observation, terms: [...b.observation.terms].reverse() };
    expect(runFixture(a)).toEqual(runFixture(b)); const first = baselineCoupledBalances(), second = baselineCoupledBalances();
    expect(first).toEqual(second); expect(first[0].requiredTerms).not.toBe(second[0].requiredTerms);
    expect(Reflect.set(first[0].requiredTerms[0], 'description', 'changed')).toBe(true);
    expect(second[0].requiredTerms[0].description).not.toBe('changed');
  });
  it('detects shared/subarray buffers and permits independently owned state arrays', () => {
    const input = new Float64Array([1, 2, 3]);
    expect(() => assertSeparateBuffers([input], [input.subarray(1)])).toThrow(/shares/);
    const copy = input.slice(); expect(() => assertSeparateBuffers([input], [copy])).not.toThrow();
    expect(() => assertSeparateBuffers([], [copy, copy.subarray(1)])).toThrow(/shares/);
  });
  it('forces a transport exception after energy changes and compares all captured physical state', () => {
    const s = closedScenario(); s.source.enabled = true; s.source.heatGenerationWm3 = 100;
    const t = new CoupledTransport(s); t.gasGravityMS2 = 0;
    const before = captureTransportPhysical(t), initialEnergy = t.energy.slice(), originalResolve = t.resolve;
    const sentinel = new Error('C forced post-source transport rejection'); let calls = 0, observedEnergyChange = false;
    t.resolve = function () {
      originalResolve.call(this); calls++;
      if (calls === 1) { observedEnergyChange = this.energy.some((value, i) => value !== initialEnergy[i]); throw sentinel; }
    };
    try {
      expect(() => t.step(0.125)).toThrow(sentinel); expect(observedEnergyChange).toBe(true); expect(captureTransportPhysical(t)).toEqual(before);
    } finally { t.resolve = originalResolve; }
    const clean = new CoupledTransport(s); clean.gasGravityMS2 = 0;
    expect(t.step(0.125)).toBe(clean.step(0.125)); expect(captureTransportPhysical(t)).toEqual(captureTransportPhysical(clean));
  });
  it('forces mechanics rejection after a successful transport trial and restores a prior committed result', () => {
    const e = makeEngine(); expect(e.step(0.125)).toBeGreaterThan(0);
    const m = e.mechanics!, previous = e.mechanical, before = captureEnginePhysical(e), originalSolve = m.solve;
    const sentinel = new Error('C forced mechanics rejection'); let sawTransportAdvance = false;
    m.solve = function () {
      sawTransportAdvance = e.transport.time > before.transport.checkpoint.time;
      this.u[0] += 0.125; this.damage[0] += 0.25; this.history[0] += 1; throw sentinel;
    };
    try {
      expect(() => e.step(0.125)).toThrow(sentinel); expect(sawTransportAdvance).toBe(true);
      expect(e.mechanical).toBe(previous); expect(captureEnginePhysical(e)).toEqual(before);
    } finally { m.solve = originalSolve; }
  });
  it('forces the unchanged fracture-energy gate to reject after a converged pressure trial', () => {
    const e = makeEngine({ fracture: true, cap: true }), m = e.mechanics!;
    const before = captureEnginePhysical(e), attemptedBefore = e.couplingIterations, originalSolve = m.solve;
    m.solve = function (): MechanicalState {
      this.u[0] = 0.125; this.damage[0] = 0.25; this.history[0] = 1;
      return { u: this.u.slice(), strain: new Float64Array(6 * this.n), stress: new Float64Array(6 * this.n),
        damage: this.damage.slice(), elasticJ: 1, fractureJ: 0, residualN: 0, maxStrain: 0, iterations: 1, maxDamage: 0.25, pressureWorkJ: 0 };
    };
    try {
      expect(() => e.step(0.125)).toThrow(/Coupled fracture energy increment mismatch/);
      expect(e.couplingIterations).toBeGreaterThan(attemptedBefore); expect(captureEnginePhysical(e)).toEqual(before);
    } finally { m.solve = originalSolve; }
  });
  it('restores histories on every Picard retry and rolls back an exhausted coupling loop', () => {
    const e = makeEngine(), m = e.mechanics!, t = e.transport, before = captureEnginePhysical(e);
    const oldSolve = m.solve, oldSet = t.setPoreVolumes, oldU = byteImage(m.u), oldD = byteImage(m.damage), oldH = byteImage(m.history);
    let solves = 0, poreCalls = 0;
    m.solve = function (): MechanicalState {
      expect(byteImage(this.u)).toEqual(oldU); expect(byteImage(this.damage)).toEqual(oldD); expect(byteImage(this.history)).toEqual(oldH);
      solves++; this.u[0] = 0.125; this.damage[0] = 0.25; this.history[0] = 1;
      return { u: this.u.slice(), strain: new Float64Array(6 * this.n), stress: new Float64Array(6 * this.n),
        damage: this.damage.slice(), elasticJ: 0, fractureJ: 0, residualN: 0, maxStrain: 0, iterations: 1, maxDamage: 0.25, pressureWorkJ: 0 };
    };
    t.setPoreVolumes = function (next, previousPressure) {
      oldSet.call(this, next, previousPressure); poreCalls++;
      for (let i = 0; i < this.n; i++) this.pressure[i] += poreCalls;
    };
    try {
      expect(() => e.step(0.125)).toThrow(/did not converge/);
      expect(solves).toBe(30); expect(poreCalls).toBe(30);
      expect(captureEnginePhysical(e)).toEqual(before); expect(e.couplingIterations).toBe(30);
    } finally { m.solve = oldSolve; t.setPoreVolumes = oldSet; }
  });
  it('keeps pressure inputs unchanged and returned mechanics arrays independent of persistent histories', () => {
    const e = makeEngine(), m = e.mechanics!, pressure = new Float64Array(m.n), input = byteImage(pressure);
    const result = m.solve(pressure, false), u = byteImage(m.u), damage = byteImage(m.damage), history = byteImage(m.history);
    expect(byteImage(pressure)).toEqual(input);
    assertSeparateBuffers([pressure, m.u, m.damage, m.history], [result.u, result.strain, result.stress, result.damage]);
    result.u.fill(999); result.damage.fill(0.5); result.strain.fill(0.25); result.stress.fill(123);
    expect(byteImage(m.u)).toEqual(u); expect(byteImage(m.damage)).toEqual(damage); expect(byteImage(m.history)).toEqual(history);
  });
});
