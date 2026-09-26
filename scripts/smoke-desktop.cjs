// Runs only in CI against the built app. It does not ship inside release bundles.
const {app} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zombie-fire-smoke-'));
app.setPath('userData', profile);
app.getAppPath = () => root;
process.argv.push('--simulation');
// Windows/Linux hosted runners use a software GPU; macOS uses its native
// graphics backend because SwiftShader Vulkan cannot initialize on that runner.
// These flags are confined to this CI harness.
if (process.platform !== 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}
const errors = [];
const timeout = setTimeout(() => finish('Desktop smoke test timed out.'), 90000);
function finish(error) {
  clearTimeout(timeout);
  if (error) console.error(error, errors);
  else console.log('DESKTOP_SMOKE_PASS: rendered scientific workspace, live solver worker, studio switch and WebGL.');
  app.exit(error ? 1 : 0);
}
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('render-process-gone', (_e, details) => finish(`Renderer exited: ${details.reason}`));
  win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) errors.push(event.message); });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (predicate, name) => {
          for (let attempt = 0; attempt < 300; attempt++) {
            if (predicate()) return;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error('Timed out waiting for ' + name + '; screen: ' + document.body.innerText.slice(-2500));
        };
        const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.title === label || b.getAttribute('aria-label') === label);
        await waitFor(() => button('Continue to simulation'), 'scientific workspace');
        button('Continue to simulation').click();
        await waitFor(() => button('One physical solver step'), 'solver step control');
        await waitFor(() => {
          const value = document.querySelector('.metric.primary strong')?.textContent;
          return value && !value.includes('—');
        }, 'initial worker snapshot');
        button('One physical solver step').click();
        await waitFor(() => document.body.textContent.includes('0d 00h 02m'), 'worker step to 120 seconds');
        if (!document.body.textContent.includes('Ready / paused')) throw new Error('Solver did not pause cleanly');
        window.dispatchEvent(new CustomEvent('workspace-request', {detail: 'study'}));
        await waitFor(() => document.body.textContent.includes('One landscape. Four perspectives.'), 'scene studio');
        await waitFor(() => document.body.textContent.includes('Buried smoldering peat'), 'landscape asset');
        const canvas = document.querySelector('canvas');
        const gl = canvas?.getContext('webgl2');
        if (!gl || gl.isContextLost()) throw new Error('WebGL2 unavailable');
        document.querySelectorAll('.study-chapter')[2].click();
        await waitFor(() => document.body.textContent.includes('CO₂ expansion · visual tracers'), 'instant conversion at 9 seconds');
        if (Number(document.querySelector('#study-playhead').value) !== 9) throw new Error('Incorrect release time');
        if (!document.body.textContent.includes('Inverted cage · 10 cm high')) throw new Error('Default cage missing');
        document.querySelectorAll('.study-chapter')[1].click();
        await waitFor(() => document.body.textContent.includes('Dry ice · Ø 0.50 m'), 'restored solid before conversion');
        window.dispatchEvent(new CustomEvent('workspace-request', {detail: 'simulation'}));
        await waitFor(() => document.body.textContent.includes('0d 00h 02m'), 'preserved numerical run');
        return 'ok';
      })()`);
      if (result !== 'ok') throw new Error('Unexpected smoke result');
      finish();
    } catch (error) { finish(String(error)); }
  });
});
require('../electron/main.cjs');
