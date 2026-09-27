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
const timeout = setTimeout(() => finish('Desktop smoke test timed out.'), 150000);
function finish(error) {
  clearTimeout(timeout);
  if (error) console.error(error, errors);
  else console.log('DESKTOP_SMOKE_PASS: rendered scientific workspace, live solver worker, studio switch and WebGL.');
  app.exit(error ? 1 : 0);
}
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('render-process-gone', (_e, details) => finish(`Renderer exited: ${details.reason}`));
  win.webContents.on('console-message', event => { if (event.message.startsWith('SMOKE_STAGE:')) console.log(event.message); if (event.level === 'error' || event.level === 3) errors.push(event.message); });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (predicate, name) => {
          for (let attempt = 0; attempt < 300; attempt++) {
            if (predicate()) { console.log('SMOKE_STAGE: ' + name); return; }
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
        await waitFor(() => document.body.textContent.includes('Terrain & subsurface operations.'), 'scene studio');
        await waitFor(() => document.body.textContent.includes('Extensive buried peat · smoldering'), 'wide buried peat asset');
        const canvas = document.querySelector('canvas');
        const gl = canvas?.getContext('webgl2');
        if (!gl || gl.isContextLost()) throw new Error('WebGL2 unavailable');
        const chooseVersion = async title => {
          button('Simulation versions').click();
          await waitFor(() => document.querySelector('.version-panel'), 'version picker');
          [...document.querySelectorAll('.version-panel button')].find(b => b.textContent.includes(title)).click();
          await waitFor(() => !document.querySelector('.version-panel') && document.querySelector('.study-concept-badge')?.textContent.includes(title), 'selected version');
          await waitFor(() => document.querySelector('.study-scene-label'), 'selected landscape ready');
          if (Number(document.querySelector('#study-playhead').value) !== 0) throw new Error('Version did not reset playback');
        };
        document.querySelectorAll('.study-chapter')[2].click();
        await waitFor(() => document.body.textContent.includes('Concave cap · restrained rim') && document.body.textContent.includes('Assumed lateral gas load'), 'seated cap and gas load');
        if (Number(document.querySelector('#study-playhead').value) !== 9) throw new Error('Incorrect new release time');
        document.querySelectorAll('.study-chapter')[3].click();
        // Software-GPU CI can render below real-time. Seek through the same UI
        // change handler rather than waiting for many animation frames.
        const playhead = document.querySelector('#study-playhead');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(playhead, '20');
        playhead.dispatchEvent(new Event('input', {bubbles: true}));
        playhead.dispatchEvent(new Event('change', {bubbles: true}));
        await waitFor(() => document.body.textContent.includes('Small surface fire · staged'), 'staged surface outlet');
        document.querySelectorAll('.study-chapter')[0].click();
        await waitFor(() => Number(document.querySelector('#study-playhead').value) === 0, 'wide scene rewind');
        if (document.body.textContent.includes('Small surface fire · staged')) throw new Error('Surface fire persisted after rewind');
        if (!document.body.textContent.includes('Bur oak · irregular deep roots')) throw new Error('Irregular oak roots missing');
        await chooseVersion('0.6');
        document.querySelectorAll('.study-chapter')[2].click();
        await waitFor(() => document.body.textContent.includes('CO₂ expansion · visual tracers'), 'instant conversion at 9 seconds');
        if (Number(document.querySelector('#study-playhead').value) !== 9) throw new Error('Incorrect release time');
        if (!document.body.textContent.includes('Inverted cage · 10 cm high')) throw new Error('Default cage missing');
        document.querySelectorAll('.study-chapter')[1].click();
        await waitFor(() => document.body.textContent.includes('Dry ice · Ø 0.50 m'), 'restored solid before conversion');
        await chooseVersion('0.5');
        document.querySelectorAll('.study-chapter')[3].click();
        await waitFor(() => document.body.textContent.includes('Residual warmth'), 'original final phase');
        if (!document.body.textContent.includes('Dry ice · Ø 0.50 m') || document.body.textContent.includes('Inverted cage ·')) throw new Error('Original scene behavior changed');
        await chooseVersion('0.6');
        document.querySelectorAll('.study-chapter')[2].click();
        await waitFor(() => document.body.textContent.includes('CO₂ expansion · visual tracers'), 'earlier release');
        await chooseVersion('0.7');
        if (!document.body.textContent.includes('Calculated debris motion')) throw new Error('Latest dynamics missing');
        await chooseVersion('0.8');
        if (!document.body.textContent.includes('Cap & bonded soil')) throw new Error('Bonded soil missing');
        await chooseVersion('0.9');
        if (!document.body.textContent.includes('Ground opening & broad peat fire')) throw new Error('Wide soil version missing');
        window.dispatchEvent(new CustomEvent('workspace-request', {detail: 'simulation'}));
        await waitFor(() => document.body.textContent.includes('0d 00h 02m'), 'preserved numerical run');
        button('Simulation versions').click();
        await waitFor(() => document.querySelector('.version-panel'), 'scientific header version picker');
        [...document.querySelectorAll('.version-panel button')].find(b => b.textContent.includes('0.5')).click();
        await waitFor(() => document.querySelector('.study-concept-badge')?.textContent.includes('0.5'), 'scientific menu opens older studio');
        const chooseModel = async value => {
          const select=document.querySelector('select[aria-label="Physics model"]');
          select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
          await waitFor(()=>document.querySelector('select[aria-label="Physics model"]')?.value===value,'model '+value);
        };
        const setRange = (label,value) => {
          const input=document.querySelector('input[aria-label="'+label+'"]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));
          input.dispatchEvent(new Event('input',{bubbles:true}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
        };
        await chooseModel('mechanics');
        await waitFor(()=>button('Calculate both models'),'mechanics workbench');
        button('Calculate both models').click();
        await waitFor(()=>document.querySelector('.ops-status')?.textContent.includes('RESULTS READY'),'paired worker calculations');
        await waitFor(()=>document.querySelector('.ops-progress')?.textContent.includes('finished'),'paired worker completion');
        const stage=document.querySelector('input[aria-label="Mechanics load stage"]');
        if(stage.max!=='20') throw new Error('Paired calculation incomplete');
        setRange('Mechanics load stage',10);
        await waitFor(()=>document.querySelector('.ops-timeline output')?.textContent.includes('9.20 kPa'),'matched peak stage');
        const telemetry=document.querySelector('.ops-telemetry').textContent;
        if(!telemetry.includes('8 / 8 elements')) throw new Error('Plastic yielding was not exposed');
        const rendering=document.querySelector('select[aria-label="Rendering view"]');
        if([...rendering.options].some(o=>/temperature|gas|pressure|damage/i.test(o.textContent))) throw new Error('Unsupported mechanics field exposed');
        rendering.value='stress';rendering.dispatchEvent(new Event('change',{bubbles:true}));
        await waitFor(()=>document.querySelector('.ops-legend')?.textContent.includes('tension +'),'stress legend');
        if(Number(stage.value)!==10) throw new Error('Changing field reset the load stage');
        if(document.querySelector('.ops-telemetry').textContent!==telemetry) throw new Error('Rendering changed numerical results');
        const glMechanics=document.querySelector('canvas')?.getContext('webgl2');
        if(!glMechanics || glMechanics.isContextLost()) throw new Error('Mechanics WebGL2 unavailable');
        await chooseModel('study');
        await waitFor(()=>document.querySelector('#study-playhead'),'preserved study');
        await chooseModel('mechanics');
        await waitFor(()=>Number(document.querySelector('input[aria-label="Mechanics load stage"]')?.value)===10,'preserved mechanics stage');
        if(document.querySelector('select[aria-label="Rendering view"]').value!=='stress') throw new Error('Lost mechanics rendering view');
        setRange('Peak top traction slider',8);
        await waitFor(()=>document.querySelector('.ops-status')?.textContent.includes('AWAITING'),'physical edit invalidates trajectory');
        if(Number(document.querySelector('input[aria-label="Mechanics load stage"]').value)!==0) throw new Error('Physical edit did not restart');
        button('Reset Peak top traction').click();
        await waitFor(()=>Number(document.querySelector('input[aria-label="Peak top traction slider"]').value)===9.2,'load reset committed');
        button('Calculate both models').click();
        await waitFor(()=>document.querySelector('.ops-progress')?.textContent.includes('finished'),'repeat calculation');
        setRange('Mechanics load stage',20);
        await waitFor(()=>document.querySelector('.ops-timeline output')?.textContent.includes('20 / 20'),'stored unloading frame');
        if(document.querySelector('.ops-telemetry article:first-child dd').textContent.trim().split(' ')[0]!=='0.000') throw new Error('Elastic unloading did not recover');
        await chooseModel('simulation');
        await waitFor(()=>document.body.textContent.includes('0d 00h 02m'),'scientific run remains at 120 seconds');
        await chooseModel('mechanics');
        await waitFor(()=>document.querySelector('.ops-timeline output')?.textContent.includes('20 / 20'),'mechanics restored for visual check');
        setRange('Mechanics load stage',10);
        await waitFor(()=>document.querySelector('.ops-timeline output')?.textContent.includes('9.20 kPa'),'verified default load');
        button('Peat tensile fracture lab').click();
        await waitFor(()=>button('Calculate tensile fracture'),'peat tensile laboratory');
        button('Calculate tensile fracture').click();
        await waitFor(()=>document.querySelector('input[aria-label="Tensile load stage"]')?.max==='200','tensile calculation');
        setRange('Tensile load stage',100);
        await waitFor(()=>document.querySelector('.ops-status')?.textContent.includes('SEPARATED'),'calculated complete separation');
        if(!document.querySelector('.ops-telemetry').textContent.includes('1.0000')) throw new Error('Missing irreversible tensile damage');
        const tensileTelemetry=document.querySelector('.ops-telemetry').textContent;
        const display=document.querySelector('select[aria-label="Tensile display magnification"]');
        display.value='4';display.dispatchEvent(new Event('change',{bubbles:true}));
        await waitFor(()=>document.querySelector('select[aria-label="Tensile display magnification"]')?.value==='4','tensile visual setting');
        if(document.querySelector('.ops-telemetry').textContent!==tensileTelemetry) throw new Error('Tensile rendering mutated physics');
        const files=new DataTransfer();
        // Synthetic UI fixture only. It is never shipped or labeled as laboratory evidence.
        files.items.add(new File(['extension_mm,force_N\\n0,0\\n0.2,5\\n0.4,10'], 'synthetic-ui-check.csv', {type:'text/csv'}));
        const csv=document.querySelector('input[type="file"]');csv.files=files.files;csv.dispatchEvent(new Event('change',{bubbles:true}));
        await waitFor(()=>document.querySelector('.tensile-data')?.textContent.includes('RMSE'),'measurement comparison and units');
        if(!document.querySelector('select[aria-label="Tensile observation data use"]')) throw new Error('Missing data provenance control');
        setRange('Tensile load stage',0);
        await waitFor(()=>document.querySelector('.ops-status')?.textContent.includes('INTACT'),'tensile rewind');
        setRange('Tensile load stage',100);
        await chooseModel('study');
        await waitFor(()=>document.querySelector('#study-playhead'),'return to terrain');
        await chooseModel('mechanics');
        await waitFor(()=>Number(document.querySelector('input[aria-label="Tensile load stage"]')?.value)===100,'preserved fracture laboratory');
        if(!document.querySelector('.tensile-data').textContent.includes('RMSE')) throw new Error('Lost imported tensile observations');
        setRange('Tensile strength slider',4);
        await waitFor(()=>document.querySelector('input[aria-label="Tensile load stage"]')?.max==='0','tensile physical edit invalidates results');
        button('Reset tensile inputs').click();
        await waitFor(()=>Number(document.querySelector('input[aria-label="Tensile strength slider"]').value)===4.25,'tensile default reset');
        button('Calculate tensile fracture').click();
        await waitFor(()=>document.querySelector('input[aria-label="Tensile load stage"]')?.max==='200','restored tensile calculation');
        setRange('Tensile load stage',45);
        await waitFor(()=>document.querySelector('.ops-status')?.textContent.includes('SOFTENING'),'visible tensile opening');
        button('Back to compression comparison').click();
        await waitFor(()=>document.querySelector('.ops-timeline output')?.textContent.includes('9.20 kPa'),'compression comparison retained');
        button('Peat tensile fracture lab').click();
        await waitFor(()=>Number(document.querySelector('input[aria-label="Tensile load stage"]')?.value)===45,'tensile replay retained');
        return 'ok';
      })()`);
      if (errors.some(message => /shader error|VALIDATE_STATUS|Error creating WebGL/i.test(message))) throw new Error('Shader compilation failed: ' + errors.join('; '));
      if (result !== 'ok') throw new Error('Unexpected smoke result');
      if (process.env.SMOKE_SCREENSHOT) { await new Promise(resolve => setTimeout(resolve, 700)); const shot=await win.webContents.capturePage(); fs.writeFileSync(process.env.SMOKE_SCREENSHOT,shot.toPNG()); }
      finish();
    } catch (error) { finish(String(error)); }
  });
});
require('../electron/main.cjs');
