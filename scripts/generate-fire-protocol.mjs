import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
try {
  const sourceHashes = {};
  for (const name of ['fireProtocol', 'model', 'source', 'thermodynamics', 'linear', 'remap']) sourceHashes[name] = createHash('sha256').update(await readFile(`src/coupled/${name}.ts`)).digest('hex');
  const { createFireProtocol } = await server.ssrLoadModule('/src/coupled/fireProtocol.ts');
  const options = JSON.parse(process.env.FIRE_OPTIONS || '{}');
  const run = createFireProtocol(options), { sim, config, scenario } = run;
  const wallLimitS = Number(process.env.WALL_LIMIT_S || 240);
  const treatmentDurationS = Number(process.env.FIRE_TREATMENT_SECONDS ?? 30);
  if (!(wallLimitS > 0 && Number.isFinite(wallLimitS))) throw new Error('Positive wall limit required.');
  if (!Number.isFinite(treatmentDurationS) || treatmentDurationS < 0 || treatmentDurationS > 3600) throw new Error('Treatment duration must be 0–3600 s.');
  const frames = [run.capture()], start = performance.now();
  let status = 'completed', stopReason = null, nextCaptureS = config.captureEveryS, treatmentStartS = null;
  const treatmentSource = { xM: 4.4, yM: 4, depthM: 1.3, initialMassKg: 4, initialTemperatureK: 194.65 };
  try {
    while (sim.time < config.durationS - 1e-8) {
      if ((performance.now() - start) / 1000 > wallLimitS) { status = 'time-budget-stopped'; stopReason = 'Offline calculation reached its wall-clock budget; remaining frames were not invented.'; break; }
      const checkpoint = sim.checkpoint();
      sim.step(Math.min(config.maxStepS, config.durationS - sim.time, nextCaptureS - sim.time));
      if (Math.abs(sim.ledger.massResidualKg) > 1e-7 || Math.abs(sim.ledger.energyResidualJ) > 1e-4) {
        sim.restore(checkpoint); throw new Error('Conservation acceptance threshold exceeded; last candidate rolled back.');
      }
      if (sim.time >= nextCaptureS - 1e-8) {
        const frame = run.capture(); frames.push(frame);
        console.log(JSON.stringify({ timeS: sim.time, ...frame.metrics, steps: sim.ledger.steps, rejectedSteps: sim.ledger.rejectedSteps, elapsedS: (performance.now() - start) / 1000 }));
        nextCaptureS += config.captureEveryS;
      }
    }
  } catch (error) { status = 'physics-stopped'; stopReason = error.message; }
  if (frames.at(-1).timeS !== sim.time) frames.push(run.capture());
  if (status === 'completed' && treatmentDurationS > 0) {
    const beforeInsertion = sim.checkpoint();
    try {
      sim.insertDryIce(treatmentSource.initialMassKg, treatmentSource.initialTemperatureK, treatmentSource);
      if (Math.abs(sim.ledger.massResidualKg) > 1e-7 || Math.abs(sim.ledger.energyResidualJ) > 1e-4) {
        sim.restore(beforeInsertion); throw new Error('Insertion conservation threshold exceeded; intervention rolled back.');
      }
      treatmentStartS = sim.time;
      frames.push({ ...run.capture(), phase: 'treatment', event: 'dry-ice-insertion' });
      const end = sim.time + treatmentDurationS;
      let captureAt = Math.min(end, sim.time + 2);
      while (sim.time < end - 1e-8) {
        if ((performance.now() - start) / 1000 > wallLimitS) { status = 'time-budget-stopped'; stopReason = 'Treatment reached offline time budget; accepted earlier frames retained.'; break; }
        const beforeStep = sim.checkpoint();
        sim.step(Math.min(0.125, end - sim.time, captureAt - sim.time));
        if (Math.abs(sim.ledger.massResidualKg) > 1e-7 || Math.abs(sim.ledger.energyResidualJ) > 1e-4) {
          sim.restore(beforeStep); throw new Error('Treatment conservation threshold exceeded; candidate rolled back.');
        }
        if (sim.time >= captureAt - 1e-8) { frames.push({ ...run.capture(), phase: 'treatment' }); captureAt = Math.min(end, captureAt + 2); }
      }
    } catch (error) { status = 'physics-stopped'; stopReason = error.message; }
    if (frames.at(-1).timeS !== sim.time) frames.push({ ...run.capture(), phase: 'treatment' });
  }
  const report = { schemaVersion: 1, kind: 'surface-ignition-protocol', generatedAt: new Date().toISOString(), sourceHashes, domain: scenario.domain,
    coordinateConvention: 'x-fastest, then y, then depth-positive-down; cell-centred SI values',
    source: treatmentSource,
    ignitionSource: { xM: scenario.source.centerXM, yM: scenario.source.centerYM, depthM: scenario.source.centerDepthM, powerW: config.ignitionPowerW },
    treatmentSource, treatmentDurationS,
    initialization: { method: sim.initializationMethod, preparedWaterRemovedKg: sim.preparedWaterRemovedKg, atlasCells: sim.atlasCells },
    config, scenario, status, stopReason, elapsedS: (performance.now() - start) / 1000,
    ignitionEndS: config.ignitionDurationS, treatmentStartS, propagationResolved: false,
    assumptions: [
      'Surface-connected peat throughout the 8 by 8 by 3.2 m domain replaces the separate buried lens; this is an assumed experiment, not a surveyed site.',
      'Cold initial state; all water retained. Moisture is kg water per kg dry peat, converted to pore saturation. No prepared hot region or dry halo.',
      'A finite external heater deposits energy into the top grid cell. This is a surrogate for surface ignition, not a resolved flame or measured ignition source.',
      'Open-air surface mass exchange uses an assumed 1 cm gas film: 1.6e-5 m2/s divided by 0.01 m = 0.0016 m/s. No wind or measured film thickness is represented.',
      'Original one-step reaction kinetics, heat conduction and gas transport retained; no fitted spread speed or fabricated growth field.',
      'A 0.5 by 0.5 by 0.32 m cell cannot resolve centimetre-scale smouldering fronts; heated/reacting cell depth is not a measured front location.',
      'Treatment imports a finite 4 kg dry-ice source at the original study coordinate, with mass/internal-energy/compression-work bookkeeping. It is not a drilling or falling-contact calculation.',
      'Mechanics, cap, drilling, liquid infiltration and fractures are absent from this protocol. Animation of those actions is illustrative.',
      'No extinction is prescribed: the source is about 1.3 m from the reacting surface cell. Treatment may leave oxidation continuing.',
      'Physical elapsed time is separate from presentation time. Successful conservation does not establish material or field validation.'
    ],
    evidence: [{ title: 'Huang and Rein (2017), downward spread of smouldering peat fire', url: 'https://doi.org/10.1071/WF16198', role: 'Establishes centimetres-per-hour/time-scale and multistep-chemistry limitations. This run does not reproduce that experiment.' }], frames };
  const output = process.env.FIRE_REPORT || 'public/fire-sequence-cache.json';
  await writeFile(output, JSON.stringify(report) + '\n');
  console.log(JSON.stringify({ output, status, stopReason, physicalTimeS: sim.time, frames: frames.length, elapsedS: report.elapsedS, massResidualKg: sim.ledger.massResidualKg, energyResidualJ: sim.ledger.energyResidualJ }));
} finally { await server.close(); }
