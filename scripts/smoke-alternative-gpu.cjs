// Focused native GPU regression; never bundled. Set ZOMBIE_DEV_ORIGIN to the
// existing Vite origin to exercise React development StrictMode effect replay.
// Without it, this checks the built production app and reports that distinction.
const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const mode = process.env.ZOMBIE_DEV_ORIGIN ? 'development' : 'production';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const folder = path.join(root, 'work/version21-gpu', `${stamp}-${mode}`);
fs.mkdirSync(folder, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'alternative-gpu-')));
app.getAppPath = () => root;
process.argv.push('--sequence');

const logLines = [], errors = [], frames = [];
const evidence = {
  date: new Date().toISOString(), mode, requestedDevOrigin: process.env.ZOMBIE_DEV_ORIGIN || null,
  environment: `${process.platform} ${process.arch}`, frames,
  scope: 'Native composited pixels and UI lifecycle only; no physical validation or exact-pixel golden comparison',
};
let finished = false, started = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  logLines.push(line); console.log(line);
  fs.writeFileSync(path.join(folder, 'run.log'), logLines.join('\n') + '\n');
}
function assert(value, message) { if (!value) throw new Error(message); }
function preservation() {
  const record = JSON.parse(fs.readFileSync(path.join(root, 'docs/review/version21/original-preservation.json'), 'utf8'));
  assert(record.protectedFiles.length === 57, 'Expected the complete 57-file original manifest');
  const changed = record.protectedFiles.filter(file => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, file.path))).digest('hex') !== file.sha256).map(file => file.path);
  assert(!changed.length, `Original preservation failed: ${changed.join(', ')}`);
  return { count: record.protectedFiles.length, originalCommit: record.originalCommit, passed: true };
}
function finish(code, error) {
  if (finished) return;
  finished = true; clearTimeout(timeout);
  evidence.passed = code === 0; evidence.errors = errors;
  if (error) evidence.failure = String(error.stack || error);
  fs.writeFileSync(path.join(folder, 'evidence.json'), JSON.stringify(evidence, null, 2));
  log(`${code ? 'ALTERNATIVE_GPU_FAIL' : 'ALTERNATIVE_GPU_PASS'} ${folder}${error ? ': ' + error.message : ''}`);
  app.exit(code);
}
const timeout = setTimeout(() => finish(1, new Error('Focused GPU smoke timed out')), 180000);

app.on('browser-window-created', (_event, win) => {
  if (started) return;
  started = true;
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('render-process-gone', (_event, details) => finish(1, new Error(JSON.stringify(details))));
  win.webContents.on('console-message', (event, legacyLevel, legacyMessage) => {
    const message = event.message || legacyMessage || '';
    const isError = event.level === 'error' || legacyLevel === 3
      || /Shader Error|INVALID_FRAMEBUFFER_OPERATION|FRAMEBUFFER_INCOMPLETE|GL_INVALID/.test(message);
    if (isError && !message.includes('sandbox_extension')) { errors.push(message); log(`RENDERER_ERROR ${message}`); }
  });
  win.webContents.once('did-finish-load', async () => {
    const evaluate = source => win.webContents.executeJavaScript(source, true);
    async function wait(source, label) {
      for (let i = 0; i < 400; i++) {
        if (await evaluate(source)) return;
        await delay(50);
      }
      throw new Error(`${label} timed out`);
    }
    async function settle() {
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
      // Allow actual shader compilation, R3F demand rendering and native capture
      // to settle. DOM readiness alone does not imply a completed GPU frame.
      await delay(650);
    }
    async function enterAndPause() {
      await evaluate(`(() => {
        const hero = document.querySelector('.cinematic-hero-scroll');
        if (!hero) throw new Error('Cinematic hero missing');
        window.scrollTo(0, hero.offsetTop + hero.offsetHeight - innerHeight);
      })()`);
      await wait("!document.querySelector('.cinematic-transport')?.hasAttribute('inert')", 'Visible cinematic controls');
      await evaluate(`(() => {
        const pause = document.querySelector('button[aria-label="Pause method render"],button[aria-label="Pause fire sequence"]');
        pause?.click();
      })()`);
      await settle();
    }
    async function route(method, id) {
      await evaluate(`(() => {
        const menu = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Simulation Version' || b.textContent.trim() === 'Simulation Version');
        if (!menu) throw new Error('Simulation Version button missing');
        if (!document.querySelector('.alternative-choices')) menu.click();
      })()`);
      await wait('!!document.querySelector(\'.alternative-choices [data-parent="' + method + '"]\')', 'Implicit method route');
      await evaluate('document.querySelector(\'.alternative-choices [data-parent="' + method + '"]\').click()');
      await wait(id === 'pressure-pulse'
        ? "!!document.querySelector('.fire-sequence-shell:not(.method-render) canvas') && !document.querySelector('.method-render')"
        : '!!document.querySelector(\'[data-render-variant="' + id + '"] canvas\')', `${id} Canvas`);
      assert(await evaluate('new URL(location.href).searchParams.get("alternative") === ' + JSON.stringify(id)), 'Implicit route did not update the selected alternative');
      await enterAndPause();
    }
    async function seek(time, original = false) {
      const label = original ? 'Fire sequence time' : 'Method render time';
      await evaluate(`(() => {
        const input = document.querySelector('input[aria-label=${JSON.stringify(label)}]');
        if (!input) throw new Error('Playback slider missing');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(time))});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      // Check React's rendered readout, not just the synchronously set input.
      await wait(`Math.abs(parseFloat(document.querySelector('.cinematic-timeline strong')?.textContent || 'NaN') - ${time}) < .05`, `Committed seek ${time}`);
      await settle();
    }
    async function capture(label, baseline) {
      const dimensions = await evaluate(`(() => {
        const canvases = [...document.querySelectorAll('.cinematic-render canvas')];
        if (canvases.length !== 1) throw new Error('Expected one shared world Canvas');
        const canvas = canvases[0], r = canvas.getBoundingClientRect();
        // Interior below captions/header and above controls. Hide DOM Html
        // annotations only during capture, so a label cannot stand in for 3D.
        const style = document.createElement('style'); style.id = 'gpu-smoke-hide-html';
        style.textContent = '.cinematic-render *:not(canvas):not(:has(canvas)){visibility:hidden!important}';
        document.head.appendChild(style);
        const x = Math.max(0, Math.ceil(r.left + r.width * .12));
        const y = Math.max(0, Math.ceil(r.top + r.height * .42));
        const right = Math.min(innerWidth, Math.floor(r.left + r.width * .88));
        const bottom = Math.min(innerHeight - 125, Math.floor(r.top + r.height * .78));
        return { crop: { x, y, width: right - x, height: bottom - y },
          drawingBuffer: { width: canvas.width, height: canvas.height },
          cssCanvas: { x: r.x, y: r.y, width: r.width, height: r.height } };
      })()`);
      let image;
      try {
        assert(dimensions.crop.width > 100 && dimensions.crop.height > 100, 'Canvas interior is not visible');
        await settle();
        image = await win.webContents.capturePage(dimensions.crop);
      } finally {
        await evaluate("document.querySelector('#gpu-smoke-hide-html')?.remove()");
      }
      assert(!image.isEmpty(), `${label}: empty native capture`);
      const bitmap = image.toBitmap({ scaleFactor: 1 });
      assert(bitmap.length > 40000 && bitmap.length % 4 === 0, `${label}: invalid native bitmap`);
      let nonblack = 0, colored = 0;
      // Maximum/channel spread are invariant to RGB versus BGR byte order.
      for (let offset = 0; offset < bitmap.length; offset += 4) {
        const high = Math.max(bitmap[offset], bitmap[offset + 1], bitmap[offset + 2]);
        const low = Math.min(bitmap[offset], bitmap[offset + 1], bitmap[offset + 2]);
        if (high > 12) nonblack++;
        if (high > 18 && high - low > 10) colored++;
      }
      const pixels = bitmap.length / 4;
      const frame = { label, ...dimensions, imageSize: image.getSize(1), pixels,
        nonblackFraction: nonblack / pixels, coloredFraction: colored / pixels,
        screenshot: `${label}.png` };
      frames.push(frame);
      fs.writeFileSync(path.join(folder, frame.screenshot), image.toPNG({ scaleFactor: 1 }));
      log(`${label}: visible=${frame.nonblackFraction.toFixed(4)} colored=${frame.coloredFraction.toFixed(4)} buffer=${dimensions.drawingBuffer.width}x${dimensions.drawingBuffer.height}`);
      assert(frame.nonblackFraction > .02 && frame.coloredFraction > .005, `${label}: scene is black/empty or lacks substantial colored world geometry`);
      if (baseline) assert(frame.nonblackFraction > baseline.nonblackFraction * .25, `${label}: scene occupancy collapsed relative to the direct render`);
      assert(!errors.length, `${label}: renderer errors: ${errors.join('; ')}`);
      return frame;
    }
    try {
      evidence.preservationBefore = preservation();
      evidence.gpuFeatures = app.getGPUFeatureStatus();
      await wait("!!document.querySelector('.fire-sequence-shell canvas')", 'Original opening Canvas');
      evidence.origin = await evaluate('location.origin');
      evidence.strictModeDevelopment = await evaluate("[...document.scripts].some(s => new URL(s.src || location.href).pathname === '/@vite/client')");
      if (mode === 'development') assert(evidence.strictModeDevelopment, 'DEV origin did not load the Vite development app; StrictMode replay is not covered');
      else log('Production pixels only: run again with ZOMBIE_DEV_ORIGIN for StrictMode replay coverage');
      assert(await evaluate("[...document.querySelectorAll('.fire-mode-switch button')].some(b => b.textContent.includes('Rapid release') && b.getAttribute('aria-pressed') === 'true')"), 'Original rapid mode is not the default');
      await enterAndPause(); await seek(38, true);
      const original = await capture('original-before');
      await route('4.2.1', 'sublimation-injection');
      await seek(68); const direct = await capture('a-68-direct');
      for (const target of [75, 86, 0, 75]) {
        await seek(target); await capture(`a-${target}-${frames.length}`, direct);
      }
      const initialSize = win.getContentSize();
      const beforeResize = frames.at(-1).drawingBuffer;
      win.setContentSize(1280, 800);
      await wait(`(() => { const c=document.querySelector('.cinematic-render canvas'); return c && (c.width!==${beforeResize.width} || c.height!==${beforeResize.height}); })()`, 'Canvas drawing buffer resized');
      await enterAndPause(); await seek(75);
      await capture('a-75-resized', direct);
      win.setContentSize(...initialSize); await settle();
      await route('4.2.3', 'pressure-pulse'); await seek(38, true);
      await capture('original-after-a', original);
      await route('4.2.1', 'sublimation-injection'); await seek(75);
      await capture('a-75-remounted', direct);
      await route('4.2.3', 'pressure-pulse'); await seek(38, true);
      await capture('original-final', original);
      assert(await evaluate("!document.querySelector('.method-render') && [...document.querySelectorAll('.fire-mode-switch button')].some(b => b.textContent.includes('Rapid release') && b.getAttribute('aria-pressed') === 'true')"), 'Original rapid route was not restored');
      evidence.preservationAfter = preservation();
      evidence.tests = ['implicit A route', 'native GPU pixels with Html excluded', '68/75/86/0/75 seeks', 'resize', 'original route restoration', 'A remount and cleanup', 'no renderer errors', '57 original identities before/after'];
      finish(0);
    } catch (error) {
      try { fs.writeFileSync(path.join(folder, 'failure-page.png'), (await win.webContents.capturePage()).toPNG()); } catch { /* Preserve the error if capture is unavailable. */ }
      finish(1, error);
    }
  });
});
require('../electron/main.cjs');
