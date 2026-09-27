import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cpus } from 'node:os';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
try {
  const { CoupledTransport, coupledScenario, LAB_DEFAULT_COUPLED } = await server.ssrLoadModule('/src/coupled/model.ts');
  const { conservativeRemap } = await server.ssrLoadModule('/src/coupled/remap.ts');
  const sourceHashes = {};
  for (const name of ['model', 'source', 'thermodynamics', 'linear', 'remap']) {
    sourceHashes[name] = createHash('sha256').update(await readFile(`src/coupled/${name}.ts`)).digest('hex');
  }
  const point = [4.4, 4, 1.3], durationS = 2;
  const inputs = { ...LAB_DEFAULT_COUPLED, reaction: false, mechanics: false, cap: false, roots: false };
  const probe = (sim, field) => {
    const grid = sim.scenario.domain, spacing = [sim.dx, sim.dy, sim.dz], counts = [grid.nx, grid.ny, grid.nz];
    const parts = point.map((position, axis) => {
      const coordinate = position / spacing[axis] - 0.5, low = Math.floor(coordinate), fraction = coordinate - low;
      return [{ i: Math.max(0, Math.min(counts[axis] - 1, low)), w: 1 - fraction }, { i: Math.max(0, Math.min(counts[axis] - 1, low + 1)), w: fraction }];
    });
    let value = 0;
    for (const x of parts[0]) for (const y of parts[1]) for (const z of parts[2]) value += x.w * y.w * z.w * field[(z.i * grid.ny + y.i) * grid.nx + x.i];
    return value;
  };
  const run = (fidelity, maxStepS) => {
    const scenario = coupledScenario({ ...inputs, fidelity });
    // The scenario UI permits maxStepS >= 0.1; the public step(requested)
    // API supports smaller requests for a refinement study without changing it.
    scenario.model.maxStepS = Math.max(0.1, maxStepS);
    const start = performance.now(), sim = new CoupledTransport(scenario, true), initialized = performance.now();
    const initialPressure = sim.pressure.slice(), initialTemperature = sim.temperature.slice();
    while (sim.time < durationS - 1e-9) sim.step(Math.min(maxStepS, durationS - sim.time));
    const row = { fidelity, cells: sim.n, maxStepS, actualSteps: sim.ledger.steps, setupMs: initialized - start, solveMs: performance.now() - initialized,
      remainingDryIceKg: sim.dryIce, sublimatedKg: inputs.dryIceKg - sim.dryIce, dryIceTemperatureK: sim.dryIceT,
      probePressurePa: probe(sim, sim.pressure), probeTemperatureK: probe(sim, sim.temperature),
      initialProbePressurePa: probe(sim, initialPressure), initialProbeTemperatureK: probe(sim, initialTemperature),
      massResidualKg: sim.ledger.massResidualKg, energyResidualJ: sim.ledger.energyResidualJ };
    console.log(JSON.stringify(row));
    return { row, sim, initialPressure, initialTemperature };
  };
  const reconstruct = (field, sim, reference) => {
    const volumes = Float64Array.from(field, value => value * sim.volume);
    return Float64Array.from(conservativeRemap(volumes, sim.scenario.domain, reference.scenario.domain), value => value / reference.volume);
  };
  const rms = (a, b) => Math.sqrt(a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0) / a.length);
  const compare = (run, reference) => {
    const { sim, row } = run, ref = reference.sim;
    const pressure = reconstruct(sim.pressure, sim, ref), temperature = reconstruct(sim.temperature, sim, ref);
    const initialP = reconstruct(run.initialPressure, sim, ref), initialT = reconstruct(run.initialTemperature, sim, ref);
    const delta = (last, initial) => Float64Array.from(last, (value, i) => value - initial[i]);
    return { ...row, pressureRmsErrorPa: rms(pressure, ref.pressure), temperatureRmsErrorK: rms(temperature, ref.temperature),
      initialPressureRmsErrorPa: rms(initialP, reference.initialPressure), initialTemperatureRmsErrorK: rms(initialT, reference.initialTemperature),
      pressureChangeRmsErrorPa: rms(delta(pressure, initialP), delta(ref.pressure, reference.initialPressure)),
      temperatureChangeRmsErrorK: rms(delta(temperature, initialT), delta(ref.temperature, reference.initialTemperature)),
      sublimatedDifferenceKg: row.sublimatedKg - reference.row.sublimatedKg,
      sublimatedRelativeDifferencePercent: 100 * (row.sublimatedKg - reference.row.sublimatedKg) / reference.row.sublimatedKg,
      sourceTemperatureDifferenceK: row.dryIceTemperatureK - reference.row.dryIceTemperatureK,
      probePressureDifferencePa: row.probePressurePa - reference.row.probePressurePa,
      probeTemperatureDifferenceK: row.probeTemperatureK - reference.row.probeTemperatureK };
  };
  // Fix dt across the spatial sweep; separately refine dt on a fixed mesh.
  const researchOnly = process.env.CONVERGENCE_SWEEP === 'research-temporal';
  const spatialRuns = researchOnly ? [] : ['preview', 'engineering', 'research', 'precision2560', 'precision20480'].map(fidelity => run(fidelity, 0.125));
  const timeRuns = researchOnly ? [] : [0.5, 0.25, 0.125, 0.0625].map(dt => run('precision2560', dt));
  const researchTimeRuns = [0.25, 0.125, 0.0625].map(dt => run('precision20480', dt));
  const spatial = spatialRuns.map(value => compare(value, spatialRuns.at(-1)));
  const temporal = timeRuns.map(value => compare(value, timeRuns.at(-1)));
  const researchTemporal = researchTimeRuns.map(value => compare(value, researchTimeRuns.at(-1)));
  // Preregistered diagnostic: every non-reference refinement must reduce absolute error.
  // Passing is evidence of an observed trend only, not an asymptotic order/validation claim.
  const trend = rows => Object.fromEntries(['pressureRmsErrorPa', 'temperatureRmsErrorK', 'sublimatedDifferenceKg', 'sourceTemperatureDifferenceK', 'probePressureDifferencePa'].map(key =>
    [key, rows.slice(0, -1).every((row, i) => i === 0 || Math.abs(row[key]) < Math.abs(rows[i - 1][key]))]));
  const report = { date: new Date().toISOString(), host: { cpu: cpus()[0].model, node: process.version }, sourceHashes,
    scope: 'Cold source-only finite-volume transport; mechanics and cap absent. Fixed atlas, fixed source kernel. This is not a coupled mechanics/fracture or field validation study.',
    inputs, durationS, probeM: point, probeMethod: 'Trilinear cell-center interpolation at fixed physical coordinates.',
    errorMethod: 'Volume-weighted piecewise-constant reconstruction to comparison grid; RMS over equal-volume fine cells. Finest available run is a comparator, not exact truth.',
    spatialMaxStepS: 0.125, temporalFidelity: 'precision2560', researchTemporalFidelity: 'precision20480', spatial, temporal, researchTemporal,
    strictlyDecreasingAbsoluteError: { spatial: spatial.length ? trend(spatial) : null, temporal: temporal.length ? trend(temporal) : null, researchTemporal: trend(researchTemporal) } };
  await mkdir('docs/review/unified', { recursive: true });
  await writeFile(`docs/review/unified/${researchOnly ? 'research-temporal-study' : 'convergence-study'}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ strictlyDecreasingAbsoluteError: report.strictlyDecreasingAbsoluteError }));
} finally {
  await server.close();
}
