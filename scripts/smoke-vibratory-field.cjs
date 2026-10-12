// Native integration fixture only. Run with `npx electron scripts/smoke-vibratory-field.cjs`.
// Production electron/main.cjs serves dist, or the optional ZOMBIE_DEV_ORIGIN.
// GPU/pixel fire-out and geometry checks belong to the separate visual review.
const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'vibratory-field-smoke-')));
app.getAppPath = () => path.resolve(__dirname, '..');
process.argv.push('--sequence');
if (process.platform !== 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}
const timeout = setTimeout(() => {
  console.error('VIBRATORY_FIELD_SMOKE_TIMEOUT');
  app.exit(1);
}, 240000);

app.on('browser-window-created', (_event, win) => {
  // This preference belongs only to this test window, never production settings.
  win.webContents.setBackgroundThrottling(false);
  const errors = [];
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(details);
    app.exit(1);
  });
  win.webContents.on('console-message', event => {
    if (event.level === 'error' && !event.message.includes('sandbox_extension')) errors.push(event.message);
    if (event.message.startsWith('VIB_FIELD_STAGE:')) console.log(event.message);
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(${rendererSmoke.toString()})()`);
      if (errors.length) throw new Error('Renderer errors: ' + errors.join('\n'));
      const evidenceDir = path.resolve(__dirname, '../work/version21-field');
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(path.join(evidenceDir, 'smoke-lifecycle.json'), JSON.stringify({
        ...result, date: new Date().toISOString(), environment: process.platform + ' ' + process.arch,
        origin: process.env.ZOMBIE_DEV_ORIGIN || 'production main / built dist',
        scope: 'Software lifecycle and actual worker data checks. No empirical validation or pixel fire-out assertion.'
      }, null, 2));
      clearTimeout(timeout);
      console.log('VIBRATORY_FIELD_SMOKE_PASS ' + JSON.stringify(result));
      app.exit(0);
    } catch (error) {
      console.error(error);
      if (errors.length) console.error(errors);
      clearTimeout(timeout);
      app.exit(1);
    }
  });
});

async function rendererSmoke() {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const wait = async (predicate, label, limitMs = 10000) => {
    const start = performance.now();
    while (performance.now() - start < limitMs) {
      if (predicate()) { console.log('VIB_FIELD_STAGE: ' + label); return; }
      await delay(25);
    }
    throw new Error(label + ' timed out: ' + document.body.innerText.slice(-1600));
  };
  const button = (label, root = document) => [...root.querySelectorAll('button')]
    .find(item => item.getAttribute('aria-label') === label || item.textContent.trim() === label);
  const click = (label, root = document) => {
    const item = button(label, root); assert(item && !item.disabled, 'Missing enabled button: ' + label); item.click();
  };
  const setRange = (label, value) => {
    const input = document.querySelector('input[aria-label="' + label + '"]');
    assert(input, 'Missing range: ' + label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const workspace = () => document.querySelector('.vib-workspace[data-vibratory-version="2"]');
  const status = () => workspace()?.dataset.workerStatus;
  const scene = () => workspace()?.querySelector('.vib-scene');
  const canvasCount = () => scene()?.querySelectorAll('canvas').length ?? 0;
  const chart = () => workspace()?.querySelector('[aria-label="Calculated peak temperature history"] polyline')?.getAttribute('points');
  const readout = label => {
    const row = [...(workspace()?.querySelectorAll('.vib-readouts > div') ?? [])]
      .find(item => item.querySelector('small')?.textContent === label);
    assert(row, 'Missing accepted readout: ' + label);
    return Number(row.querySelector('strong').textContent.replace(/[^\d.+-]/g, ''));
  };
  const openTools = async () => {
    if (document.querySelector('.cinematic-drawer[data-panel="toolbox"]')) return;
    click('Open earthquake simulation settings');
    await wait(() => document.querySelector('.cinematic-drawer[data-panel="toolbox"]'), 'field settings open');
  };
  const closeTools = async () => {
    const drawer = document.querySelector('.cinematic-drawer[data-panel="toolbox"]');
    if (!drawer) return;
    click('Close side panel', drawer);
    await wait(() => !document.querySelector('.cinematic-drawer.is-open'), 'field settings close');
  };
  const seek = async value => {
    setRange('Earthquake animation time', value);
    await wait(() => Number(workspace()?.querySelector('input[aria-label="Earthquake animation time"]')?.value) === value,
      'scene seek ' + value);
  };
  const enter = async () => {
    click('Simulation Version');
    await wait(() => document.querySelector('[data-parent="4.2.4"]'), 'earthquake menu choice');
    document.querySelector('[data-parent="4.2.4"]').click();
    await wait(workspace, 'private field workspace opens through shared route');
    assert(new URL(location.href).searchParams.get('alternative') === 'vibratory-injection', 'Field route refresh URL missing');
  };

  await wait(() => document.querySelector('.fire-sequence-shell'), 'protected original opening');
  const rapid = [...document.querySelectorAll('.fire-mode-switch button')].find(item => item.textContent.includes('Rapid release'));
  assert(rapid?.getAttribute('aria-pressed') === 'true', 'Original must open in rapid mode');

  // Intercept only the fixture's native Worker instances. Hold real messages to
  // exercise pending states deterministically; every state replayed below was
  // actually emitted by that exact worker, with its original jobId unchanged.
  const NativeWorker = window.Worker, records = [], alive = new Set();
  let nextPolicy = {};
  window.Worker = class TrackedWorker extends NativeWorker {
    constructor(...args) {
      super(...args);
      const record = { worker: this, messages: [], delivered: [], posted: [], policy: { ...nextPolicy }, terminated: false, replaying: false };
      nextPolicy = {}; records.push(record); alive.add(record); this.smokeRecord = record;
      this.addEventListener('message', event => {
        if (record.replaying) return;
        record.messages.push(event.data);
        if (record.policy.holdAll || (event.data.state?.timeS ?? Infinity) > (record.policy.holdAfterS ?? Infinity)) {
          event.stopImmediatePropagation(); return;
        }
        record.delivered.push(event.data);
      });
      // Suppress only explicitly injected fixture errors' browser default log.
      this.addEventListener('error', event => { if (record.injectingError) event.preventDefault(); });
    }
    postMessage(message, ...rest) {
      const record = this.smokeRecord;
      record.posted.push(message);
      if (message.settings && 'waterKg' in message.settings && 'inletK' in message.settings && 'endS' in message.settings) {
        record.field = true; record.settings = { ...message.settings }; record.jobId = message.jobId;
      }
      return super.postMessage(message, ...rest);
    }
    terminate() {
      this.smokeRecord.terminated = true; alive.delete(this.smokeRecord);
      return super.terminate();
    }
  };
  const fieldRecords = () => records.filter(record => record.field);
  const liveFields = () => [...alive].filter(record => record.field);
  const current = () => fieldRecords().at(-1);
  const accepted = record => record.delivered.filter(packet => packet.state)
    .map(packet => packet.state).filter((state, index, all) => index === 0 || state.timeS > all[index - 1].timeS + 1e-9);
  const summary = state => ({ timeS: state.timeS, deliveredKg: state.deliveredKg, remainingKg: state.remainingKg,
    maximumK: state.maximumK, reactionW: state.reactionW, reactedFuelKg: state.reactedFuelKg, oxygenKg: state.oxygenKg,
    massResidualKg: state.massResidualKg, energyResidualJ: state.energyResidualJ,
    waterSpeciesResidualKg: state.waterSpeciesResidualKg, inletEnergyJ: state.inletEnergyJ, liquidFlowWorkJ: state.liquidFlowWorkJ });
  const replay = (record, packet) => {
    assert(packet, 'No genuine worker packet available for stale delivery');
    record.replaying = true;
    try { record.worker.dispatchEvent(new MessageEvent('message', { data: packet })); }
    finally { record.replaying = false; }
  };
  const crash = (record, message) => {
    record.injectingError = true;
    try { record.worker.dispatchEvent(new ErrorEvent('error', { message, cancelable: true })); }
    finally { record.injectingError = false; }
  };
  const assertChart = history => {
    const points = (chart() || '').trim().split(/\s+/).filter(Boolean).map(pair => pair.split(',').map(Number));
    assert(points.length === history.length, 'Visible history length differs from actual accepted messages');
    points.forEach(([x, y], index) => {
      const state = history[index];
      assert(Math.abs(x - state.timeS * 4) < 1e-8, 'History time differs from accepted state');
      const expectedY = 44 - Math.min(1, Math.max(0, (state.maximumK - 280) / 300)) * 40;
      assert(Math.abs(y - expectedY) < 1e-8, 'History temperature differs from accepted state');
    });
  };
  const pending = () => !workspace()?.querySelector('.vib-readouts') && !chart();
  const recalculate = async policy => {
    await openTools(); const previous = current(); nextPolicy = policy;
    click('Recalculate field');
    await wait(() => current() !== previous && current()?.field && status() === 'calculating', 'fresh calculation starts');
    const record = current();
    await wait(() => record.messages.some(packet => packet.type === 'state' && packet.state?.timeS === 0), 'actual initial worker state available');
    return record;
  };

  await enter();
  await wait(() => current()?.field && canvasCount() === 1, 'initial original scene with actual field worker');
  assert(scene().dataset.originalIntro === 'true', 'Original introduction missing at scene zero');
  assert(workspace().querySelector('.vib-transport-head small')?.textContent === 'Original 4.2.3 fire animation', 'Original introduction scope label missing');
  const full = current();
  assert(full.settings.waterKg === .5 && full.settings.flowKgS === .025 && full.settings.inletK === 293.15 && full.settings.endS === 60,
    'Unexpected default field configuration');
  await wait(() => status() === 'complete', 'actual default 60s worker completes', 60000);
  assert(full.terminated && liveFields().length === 0, 'Completed worker was not terminated');
  const history = accepted(full), last = history.at(-1);
  assert(history.length === 61 && history[0].timeS === 0 && last.timeS === 60, 'Expected accepted 0–60s history');
  history.forEach((state, index) => {
    const count = state.grid.nx * state.grid.ny * state.grid.nz;
    for (const key of ['temperatureK', 'oxygen', 'liquidKg']) {
      const values = state.frame[key];
      assert(values?.length === count && [...values].every(Number.isFinite), 'Invalid accepted ' + key + ' field');
    }
    assert(Number.isFinite(state.maximumK) && Math.abs(state.massResidualKg) < 1e-7 && Math.abs(state.energyResidualJ) < 1e-4
      && Math.abs(state.waterSpeciesResidualKg) < 1e-7, 'Accepted field failed conservation gates at ' + state.timeS);
    if (index) assert(state.timeS > history[index - 1].timeS && state.deliveredKg >= history[index - 1].deliveredKg - 1e-12,
      'Accepted history rewound');
  });
  assert(Math.abs(last.deliveredKg - .5) < 1e-8 && last.remainingKg < 1e-8, 'Finite default source not exhausted correctly');
  assert(last.maximumK > 500 && last.reactionW > 0 && last.reactedFuelKg > 0 && last.oxygenKg > 0,
    'Default numerical field unexpectedly claims extinction or lost reacting-state metrics');

  for (const value of [24, 25]) {
    await seek(value);
    await wait(() => canvasCount() === 2, 'original/field crossfade mounted at ' + value);
    const layers = [...scene().querySelectorAll('.vib-scene-layer')];
    assert(layers.length === 2 && Math.abs(Number(layers[0].style.opacity) - (1 - (value - 24) / 2)) < 1e-8
      && Math.abs(Number(layers[1].style.opacity) - (value - 24) / 2) < 1e-8, 'Crossfade opacity mismatch');
  }
  await seek(54);
  await wait(() => canvasCount() === 1 && scene().dataset.originalIntro === 'false', 'natural treatment scene at54');
  assert(workspace().querySelector('.vib-site-key')?.textContent.includes('ILLUSTRATIVE TREATMENT'), 'Natural treatment scope missing');
  assert(workspace().querySelector('.vib-transport-head')?.textContent.includes('Treatment complete'), 'Natural final treatment stage missing');
  // DOM confirms routing/scope only; real fire-out appearance is reviewed in Chrome.
  for (const [label, units] of [['Temperature', 'Temperature · °C'], ['Oxygen', 'Oxygen · gas mole fraction'], ['Liquid change', 'Positive net liquid change · kg/cell']]) {
    click(label, workspace());
    await wait(() => button(label, workspace())?.getAttribute('aria-pressed') === 'true' && workspace().querySelector('.vib-readouts'), label + ' accepted view');
    assert(canvasCount() === 1 && scene().dataset.originalIntro === 'false' && scene().dataset.authoredEquipment === 'false',
      label + ' view retained original intro or authored equipment mode');
    const slice = workspace().querySelector('.vib-slice-label').textContent;
    assert(slice.includes('Middle-y slice · row ' + (Math.floor(last.grid.ny / 2) + 1) + '/' + last.grid.ny) && slice.includes(units),
      label + ' slice/units missing');
    assert(Number(scene().dataset.fieldTime) === 60 && readout('Physical time') === 60, 'Calculated view not using accepted60s state');
    assert(Math.abs(readout('Peak field temperature') - (last.maximumK - 273.15)) <= .051, 'Temperature readout differs from accepted state');
    assert(Math.abs(readout('Liquid delivered') - last.deliveredKg) <= .00051, 'Liquid readout differs from accepted state');
    assertChart(history);
  }
  assert(workspace().querySelector('.vib-readouts')?.textContent.includes('not a source tracer'), 'Liquid change tracer limitation missing');
  const completeChart = chart(), countBeforeToggle = fieldRecords().length;
  await openTools();
  const vibrationLabel = [...document.querySelectorAll('.vib-tools label')].find(item => item.textContent.includes('Show illustrative vibration'));
  assert(vibrationLabel?.querySelector('input')?.checked, 'Default illustrative vibration control missing');
  vibrationLabel.querySelector('input').click();
  await closeTools(); await delay(75);
  assert(fieldRecords().length === countBeforeToggle && chart() === completeChart && Number(scene().dataset.fieldTime) === 60,
    'Display vibration toggle changed the calculation or accepted history');

  // Rapid settings replacements must invalidate the prior accepted run before
  // any new messages are admitted. These pending workers emit real states, held here.
  await openTools(); nextPolicy = { holdAll: true }; setRange('Field liquid inventory', .55);
  await wait(() => current() !== full && current()?.settings?.waterKg === .55, 'first settings replacement');
  const superseded = current();
  await wait(() => superseded.messages.some(packet => packet.state), 'superseded real packet captured');
  nextPolicy = { holdAll: true }; setRange('Field liquid inventory', .6);
  await wait(() => current() !== superseded && current()?.settings?.waterKg === .6 && status() === 'calculating', 'second settings replacement');
  const pendingCancel = current();
  await wait(() => superseded.terminated && pending() && scene()?.dataset.authoredEquipment === 'false' && canvasCount() === 0,
    'settings replacement excludes old accepted field and original intro in calculated view');
  replay(full, full.messages.find(packet => packet.state?.timeS === 60));
  replay(superseded, superseded.messages.find(packet => packet.state));
  crash(superseded, 'Stale superseded worker failure'); await delay(75);
  assert(status() === 'calculating' && pending() && !workspace().querySelector('.vib-error'), 'Superseded worker repopulated current session');
  click('Cancel calculation');
  await wait(() => status() === 'cancelled' && pendingCancel.terminated && liveFields().length === 0, 'pending cancellation terminates worker');
  assert(pending(), 'Pending cancellation fabricated accepted history');

  const pendingCrash = await recalculate({ holdAll: true });
  await closeTools(); click('Play earthquake animation');
  await wait(() => button('Pause earthquake animation'), 'pending playback started');
  crash(pendingCrash, 'Injected pending field crash');
  await wait(() => status() === 'failed' && pendingCrash.terminated && button('Play earthquake animation'), 'pending crash stops playback and worker');
  assert(pending() && workspace().querySelector('.vib-error')?.textContent.includes('No accepted field state is available'),
    'Pending crash claimed an accepted state');

  const acceptedCancel = await recalculate({ holdAfterS: 1 });
  await wait(() => accepted(acceptedCancel).at(-1)?.timeS === 1 && acceptedCancel.messages.some(packet => packet.state?.timeS > 1), 'accepted history before cancellation');
  await closeTools(); await seek(24.5);
  await wait(() => readout('Physical time') === 1, 'accepted1s state displayed');
  const cancelChart = chart(); assertChart(accepted(acceptedCancel));
  await openTools(); click('Cancel calculation');
  await wait(() => status() === 'cancelled' && acceptedCancel.terminated, 'accepted-state cancellation terminates worker');
  await closeTools();
  assert(chart() === cancelChart && readout('Physical time') === 1, 'Cancellation discarded accepted state/history');
  replay(acceptedCancel, acceptedCancel.messages.find(packet => packet.state?.timeS > 1));
  crash(acceptedCancel, 'Stale cancelled worker failure'); await delay(75);
  assert(status() === 'cancelled' && chart() === cancelChart && !workspace().querySelector('.vib-error'), 'Cancelled worker changed accepted history/status');

  const acceptedCrash = await recalculate({ holdAfterS: 1 });
  await wait(() => accepted(acceptedCrash).at(-1)?.timeS === 1 && acceptedCrash.messages.some(packet => packet.state?.timeS > 1), 'accepted history before crash');
  await closeTools(); await seek(24.5); const crashChart = chart();
  click('Play earthquake animation'); await wait(() => button('Pause earthquake animation'), 'accepted playback started');
  crash(acceptedCrash, 'Injected accepted field crash');
  await wait(() => status() === 'failed' && acceptedCrash.terminated && button('Play earthquake animation'), 'accepted crash stops playback and worker');
  assert(chart() === crashChart && readout('Physical time') === 1 && workspace().querySelector('.vib-error')?.textContent.includes('Last accepted states are retained'),
    'Crash discarded accepted state/history');
  replay(acceptedCrash, acceptedCrash.messages.find(packet => packet.state?.timeS > 1)); await delay(75);
  assert(status() === 'failed' && chart() === crashChart, 'Failed worker rewrote accepted history');

  const leaving = await recalculate({ holdAfterS: 1 });
  await wait(() => accepted(leaving).at(-1)?.timeS === 1 && leaving.messages.some(packet => packet.state?.timeS > 1), 'live field before navigation');
  await closeTools(); click('Fire Simulation home');
  await wait(() => !workspace() && document.querySelector('.fire-sequence-shell') && leaving.terminated && liveFields().length === 0,
    'navigation terminates field worker and restores original route');
  replay(leaving, leaving.messages.find(packet => packet.state?.timeS > 1)); crash(leaving, 'Stale unmounted field crash'); await delay(75);
  assert(!workspace() && document.querySelector('.fire-sequence-shell') && liveFields().length === 0, 'Late unmounted worker affected original route');
  assert(fieldRecords().every(record => record.terminated), 'A field worker remains alive');

  return { defaultRun: summary(last), acceptedCheckpoints: history.length, fieldWorkersCreated: fieldRecords().length,
    fieldWorkersAlive: liveFields().length,
    checks: ['protected rapid opening', 'shared4.2.4 routing', 'actual default60s computation and accepted conservation gates',
      'original/field24–25s crossfade', 'natural54s illustrative scope (pixel fire-out checked separately)',
      'temperature/oxygen/liquid-change accepted middle-y slice labels', 'one Canvas and no original introduction in calculated views',
      'visible chart matches actual accepted messages', 'display vibration leaves accepted history unchanged',
      'rapid settings invalidate old history', 'superseded late message/error rejected', 'pending cancel/crash without fabricated state',
      'accepted cancel/crash retain history and stop playback', 'terminated late message/error rejected', 'route-away cleanup'] };
}

require('../electron/main.cjs');
