// Current vibration-only integration fixture. The older smoke-vibratory-field
// fixture is retained for the historical liquid workspace, not this method.
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'vibration-only-v21-')));
app.getAppPath = () => path.resolve(__dirname, '..');
process.argv.push('--sequence');
if (process.platform !== 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}
const deadline = setTimeout(() => { console.error('VIBRATION_SMOKE_TIMEOUT'); app.exit(1); }, 180000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  const errors = [];
  win.webContents.on('console-message', event => {
    if (event.level === 'error' && !event.message.includes('sandbox_extension')) errors.push(event.message);
    if (event.message.startsWith('VIBRATION_STAGE:')) console.log(event.message);
  });
  win.webContents.on('render-process-gone', (_e, details) => { console.error(details); app.exit(1); });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(${check.toString()})()`);
      if (errors.length) throw new Error('Renderer errors: ' + errors.join('\n'));
      const output = path.resolve(__dirname, '../work/version21-vibration');
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(path.join(output, 'current-smoke.json'), JSON.stringify({ ...result,
        date: new Date().toISOString(), origin: process.env.ZOMBIE_DEV_ORIGIN || 'built dist',
        environment: process.platform + ' ' + process.arch,
        scope: 'Software scene continuity, source-free lifecycle and unavailable prediction. No mechanics or suppression validation.'
      }, null, 2));
      clearTimeout(deadline); console.log('VIBRATION_SMOKE_PASS ' + JSON.stringify(result)); app.exit(0);
    } catch (error) {
      console.error(error); console.error(errors); clearTimeout(deadline); app.exit(1);
    }
  });
});
async function check() {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (value, label) => { if (!value) throw new Error(label); };
  const wait = async (predicate, label) => {
    for (let i = 0; i < 400; i++) {
      if (predicate()) { console.log('VIBRATION_STAGE: ' + label); return; }
      await delay(25);
    }
    throw new Error(label + ' timed out: ' + document.body.innerText.slice(-1200));
  };
  const button = (label, root = document) => [...root.querySelectorAll('button')]
    .find(el => el.getAttribute('aria-label') === label || el.textContent.trim() === label);
  const click = (label, root) => { const el = button(label, root); assert(el && !el.disabled, 'Missing button: ' + label); el.click(); };
  const setRange = (label, value) => {
    const el = document.querySelector('input[aria-label="' + label + '"]'); assert(el, 'Missing range: ' + label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  await wait(() => document.querySelector('.fire-sequence-shell'), 'original rapid opening');
  assert([...document.querySelectorAll('.fire-mode-switch button')].some(el => el.textContent.includes('Rapid release') && el.getAttribute('aria-pressed') === 'true'), 'Original rapid default changed');
  const NativeWorker = window.Worker, alive = new Set();
  window.Worker = class extends NativeWorker {
    constructor(...args) { super(...args); alive.add(this); }
    terminate() { alive.delete(this); return super.terminate(); }
  };
  click('Simulation Version'); await wait(() => document.querySelector('[data-parent="4.2.4"]'), 'C navigation entry');
  document.querySelector('[data-parent="4.2.4"]').click();
  const workspace = () => document.querySelector('.vib-workspace[data-vibratory-version="3"]');
  await wait(() => workspace()?.querySelector('.vib-scene canvas'), 'vibration-only scene mounted');
  assert(workspace().dataset.treatment === 'vibration-only' && workspace().dataset.prediction === 'unavailable', 'C exposes an unsupported predictive mode');
  const canvas = workspace().querySelector('canvas');
  const displayedTime = () => Number(workspace().querySelector('.vib-play-row > span').firstChild.textContent.trim());
  const times = [0, 24, 25, 26, 33, 38, 54, 90, 0, 38];
  for (const time of times) {
    setRange('Earthquake animation time', time);
    await wait(() => displayedTime() === time, 'accepted presentation ' + time);
    assert(workspace().querySelectorAll('canvas').length === 1 && workspace().querySelector('canvas') === canvas, 'C replaced the Canvas during transition/seek');
    const scene = workspace().querySelector('.vib-scene');
    assert(scene.dataset.sceneContinuity === 'single-original-canvas' && Number(scene.dataset.originalContextTime) === Math.min(time, 33), 'Original context continuity changed');
    assert(alive.size === 0, 'Vibration-only render launched a numerical/liquid worker');
    assert(!workspace().querySelector('.vib-readouts,[aria-label="Earthquake field view"]'), 'Historical liquid field is still active');
  }
  const toggle = workspace().querySelector('.vib-shortcuts input[type="checkbox"]');
  assert(toggle, 'Vibration display toggle missing');
  setRange('Earthquake animation time', 90); await wait(() => displayedTime() === 90, 'ending before display toggle');
  toggle.click();
  await wait(() => workspace().textContent.includes('Original context · vibration off'), 'off caption matches original context');
  assert(workspace().textContent.includes('Original fire & inserted drill · vibration off'), 'Ending caption still claims illustrated fire-out when display is off');
  assert(workspace().querySelector('canvas') === canvas && alive.size === 0, 'Display toggle replaced scene or started computation');
  click('See vibration ↗'); await wait(() => toggle.checked && button('Pause earthquake animation'), 'vibration shortcut enables display and playback');
  setRange('Earthquake animation time', 38); await wait(() => displayedTime() === 38 && button('Play earthquake animation'), 'seek pauses shortcut playback');
  click('Play earthquake animation'); await wait(() => displayedTime() > 38, 'authored playback advances');
  click('Restart earthquake animation'); await wait(() => displayedTime() === 0 && button('Play earthquake animation'), 'restart stops and restores opening');
  click('Open earthquake simulation settings');
  await wait(() => document.querySelector('.cinematic-drawer[data-panel="toolbox"]'), 'vibration settings');
  const drawer = document.querySelector('.cinematic-drawer[data-panel="toolbox"]');
  assert(button('Vibration comparison unavailable', drawer)?.disabled, 'Unsupported comparison action enabled');
  assert(!drawer.querySelector('input[aria-label*="inlet" i],input[aria-label*="flow" i],input[aria-label*="inventory" i]'), 'Vibration-only settings expose liquid source');
  setRange('Earthquake camera distance', 12); click('Reset camera', drawer); click('Close side panel', drawer);
  assert(workspace().querySelector('canvas') === canvas && alive.size === 0, 'Camera control replaced Canvas or created worker');
  // Explicit original selection; the brand/home button retains selected method.
  click('Simulation Version'); await wait(() => document.querySelector('[data-parent="4.2.3"]'), 'original navigation entry');
  document.querySelector('[data-parent="4.2.3"]').click();
  await wait(() => document.querySelector('.fire-sequence-shell:not(.method-render)') && !workspace() && alive.size === 0, 'original restored with no C jobs');
  click('Simulation Version'); await wait(() => document.querySelector('.version-compare-link'), 'comparison navigation'); document.querySelector('.version-compare-link').click();
  await wait(() => document.querySelectorAll('.alternative-panel').length === 2, 'independent comparison panels');
  const panel = document.querySelectorAll('.alternative-panel')[1];
  const selection = panel.querySelector('select[aria-label^="Alternative "]');
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selection, 'vibratory-injection'); selection.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(() => panel.dataset.variant === 'vibratory-injection' && button('Start', panel)?.disabled && panel.textContent.includes('unavailable'), 'vibration prediction fails closed');
  assert(!panel.querySelector('.alt-history') && Number(panel.dataset.time) === 0, 'Unsupported vibration acquired calculated history');
  click('Simulation Version'); await wait(() => document.querySelector('[data-parent="4.2.3"]'), 'original return entry'); document.querySelector('[data-parent="4.2.3"]').click();
  await wait(() => document.querySelector('.fire-sequence-shell:not(.method-render)') && alive.size === 0, 'comparison disposal');
  return { times, oneCanvasAcrossSeeks: true, noLiquidJobs: true, predictionUnavailable: true, originalRestored: true, workerCleanup: true };
}
require('../electron/main.cjs');
