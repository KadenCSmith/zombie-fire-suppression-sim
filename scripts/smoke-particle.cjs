// Coordinator integration test of actual application controls and exported
// records. This is software verification, not the D scientific review.
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'particle-v21-'));
app.setPath('userData', path.join(output, 'profile'));
app.getAppPath = () => path.resolve(__dirname, '..');
process.argv.push('--sequence');
if (process.platform !== 'darwin') { app.commandLine.appendSwitch('use-angle', 'swiftshader'); app.commandLine.appendSwitch('enable-unsafe-swiftshader'); }
const deadline = setTimeout(() => { console.error('PARTICLE_SMOKE_TIMEOUT'); app.exit(1); }, 180000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  const errors = [], downloads = [];
  win.webContents.on('console-message', e => {
    if (e.level === 'error' && !e.message.includes('sandbox_extension')) errors.push(e.message);
    if (e.message.startsWith('PARTICLE_STAGE:')) console.log(e.message);
  });
  win.webContents.on('render-process-gone', (_e, details) => { console.error(details); app.exit(1); });
  win.webContents.session.on('will-download', (_e, item) => {
    const record = { path: path.join(output, 'export-' + downloads.length + '.json'), done: false, state: '' };
    downloads.push(record); item.setSavePath(record.path);
    item.once('done', (_event, state) => { record.state = state; record.done = true; });
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(${check.toString()})()`);
      for (let n = 0; n < 200 && downloads.some(d => !d.done); n++) await new Promise(r => setTimeout(r, 25));
      if (errors.length) throw new Error('Renderer errors: ' + errors.join('\n'));
      if (downloads.length !== 2 || downloads.some(d => d.state !== 'completed')) throw new Error('Both actual exports must complete');
      const [privateRecord, sharedRecord] = downloads.map(d => JSON.parse(fs.readFileSync(d.path, 'utf8')));
      if (privateRecord.registeredId !== 'nanoparticles' || privateRecord.acceptedState?.timeS !== 30 || !privateRecord.acceptedState.particleInjection || privateRecord.history.length < 2 || privateRecord.experimentallyValidated !== false) throw new Error('Private export lost identity/state/history/status');
      if (sharedRecord.engineVersions?.particle !== 'v21.3' || !sharedRecord.units?.particleInjection || sharedRecord.panels.length !== 2 || sharedRecord.panels.some(p => !p.config.particleInjection || !p.result?.state?.particleInjection) || sharedRecord.experimentalValidation !== false) throw new Error('Shared export lost D payload/units/current records');
      const report = { ...result, date: new Date().toISOString(), exports: downloads.map(d => d.path), scope: 'Coordinator software/UI/export verification; no independent scientific validation' };
      fs.mkdirSync(path.resolve(__dirname, '../work/version21-particle'), { recursive: true });
      fs.writeFileSync(path.resolve(__dirname, '../work/version21-particle/current-smoke.json'), JSON.stringify(report, null, 2));
      clearTimeout(deadline); console.log('PARTICLE_SMOKE_PASS ' + JSON.stringify(result)); app.exit(0);
    } catch (error) { clearTimeout(deadline); console.error(error); console.error(errors); app.exit(1); }
  });
});
async function check() {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const assert = (v, label) => { if (!v) throw new Error(label); };
  const wait = async (fn, label) => { for (let n = 0; n < 400; n++) { if (fn()) { console.log('PARTICLE_STAGE: ' + label); return; } await delay(25); } throw new Error(label + ': ' + document.body.innerText.slice(-1600)); };
  const button = (name, root = document) => [...root.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === name || b.textContent.trim() === name);
  const click = (name, root) => { const b = button(name, root); assert(b && !b.disabled, 'Missing button ' + name); b.click(); };
  const select = (el, value) => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const input = (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value)); el.dispatchEvent(new Event('input', { bubbles: true })); };
  await wait(() => document.querySelector('.fire-sequence-shell'), 'original opening');
  const NativeWorker = window.Worker, alive = new Set();
  window.Worker = class extends NativeWorker { constructor(...args) { super(...args); alive.add(this); } terminate() { alive.delete(this); return super.terminate(); } };
  click('Simulation Version'); await wait(() => document.querySelector('[data-parent="4.2.2"]'), 'particle menu entry');
  document.querySelector('[data-parent="4.2.2"]').click();
  await wait(() => document.querySelector('[data-particle-model="conditional-d1"] .d-pair'), 'reviewed bounded D workspace');
  const cards = () => [...document.querySelectorAll('.d-card')];
  const stateTime = c => Number(c.querySelector('[data-physical-time]')?.dataset.physicalTime ?? -1);
  assert(cards().length === 2 && alive.size === 0, 'Private pair should own two states without shared workers');
  const [left, right] = cards(); click('Run Particle case');
  await wait(() => stateTime(left) === 30, 'particle accepted physical target');
  assert(stateTime(right) === -1, 'Particle calculation changed independent water state');
  assert(left.textContent.includes('No solid particles delivered underground in this run.'), 'Conduction reference forced underground solids');
  click('Run Water control'); await wait(() => stateTime(right) === 30, 'matched water accepted target');
  click('Export Particle case');
  const oldId = left.dataset.runId; click('Reset Particle case');
  await wait(() => stateTime(left) === -1 && left.dataset.runId !== oldId && stateTime(right) === 30, 'private reset isolates state and identity');
  select(document.querySelector('[aria-label="Particle scenario"]'), 'freezing-stop');
  await wait(() => left.textContent.includes('Inlet274K') && stateTime(right) === -1, 'freezing scenario replaced both configurations');
  click('Run Particle case');
  await wait(() => left.querySelector('[role="alert"]'), 'freezing regime rejected');
  assert(stateTime(left) === -1, 'Invalid freezing regime accepted a result');
  select(document.querySelector('[aria-label="Particle scenario"]'), 'water-only');
  await wait(() => left.textContent.includes('Matched water-only treatment') && !left.querySelector('[role="alert"]'), 'water-only scenario replaced invalid case');
  click('Run Particle case'); click('Run Water control');
  await wait(() => stateTime(left) === 30 && stateTime(right) === 30, 'zero-particle counterfactual');
  assert(left.textContent.includes('No CO₂') && right.textContent.includes('No CO₂'), 'Zero-particle control fabricated CO2');
  click('Shared comparison workspace ↗');
  const panels = () => [...document.querySelectorAll('.alternative-panel')];
  const time = p => Number(p.dataset.time);
  await wait(() => panels().length === 2, 'shared independent panels');
  for (const p of panels()) select(p.querySelector('select[aria-label^="Alternative "]'), 'nanoparticles');
  await wait(() => panels().every(p => p.dataset.variant === 'nanoparticles' && button('Start', p) && !button('Start', p).disabled) && alive.size === 2, 'two supported particle workers');
  const link = document.querySelector('[aria-label="Link physical time"]');
  assert(!link.disabled, 'Identical particle systems cannot link'); link.click(); click('Start / resume all');
  await wait(() => panels().every(p => time(p) >= 1.5), 'particle linked accepted checkpoints'); click('Pause all');
  await wait(() => panels().every(p => p.dataset.running === 'false') && time(panels()[0]) === time(panels()[1]), 'particle linked pause');
  const otherTime = time(panels()[1]), otherId = panels()[1].dataset.runId;
  const first = panels()[0], details = first.querySelector('.d-comparison details');
  details.open = true; input(first.querySelector('[aria-label="Initial warm peat specimen (K)"]'), 340);
  await wait(() => time(first) === 0 && button('Start', first) && !button('Start', first).disabled, 'particle edit invalidates its prior result');
  assert(time(panels()[1]) === otherTime && panels()[1].dataset.runId === otherId && link.disabled && !link.checked, 'Edit changed another run or left mismatched systems linked');
  click('Export records');
  click('Duplicate', first); await wait(() => panels().length === 3 && alive.size === 3, 'particle duplicate owns a new worker');
  assert(time(panels()[2]) === 0, 'Duplicate copied accepted physical state');
  click('Remove', panels()[2]); await wait(() => panels().length === 2 && alive.size === 2, 'particle removal disposes worker');
  click('Simulation Version'); await wait(() => document.querySelector('[data-parent="4.2.3"]'), 'original return entry');
  document.querySelector('[data-parent="4.2.3"]').click();
  await wait(() => document.querySelector('.fire-sequence-shell:not(.method-render)') && alive.size === 0, 'original restored and particle jobs disposed');
  return { privatePairIndependent: true, upstreamLossAccepted: true, freezingRejected: true, zeroParticleControl: true, linkedParticleWorkers: true, editInvalidatesOneRun: true, duplicateAndRemoval: true, originalRestored: true, exportCount: 2 };
}
require('../electron/main.cjs');
