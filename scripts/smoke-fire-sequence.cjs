// CI-only browser integration test; never included in release bundles.
const {app}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'peat-fire-smoke-')));
app.getAppPath=()=>path.resolve(__dirname,'..');
process.argv.push('--sequence');
if(process.platform!=='darwin'){app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader');}
const timeout=setTimeout(()=>{console.error('FIRE_SMOKE_TIMEOUT');app.exit(1)},300000);
app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('render-process-gone',(_event,details)=>{console.error(details);app.exit(1)});
  win.webContents.once('did-finish-load',async()=>{
    try{
      const result=await win.webContents.executeJavaScript(`(async()=>{
        const wait=async(fn,label)=>{for(let i=0;i<1800;i++){if(fn()){console.log('FIRE_SMOKE: '+label);return;}await new Promise(r=>setTimeout(r,100));}throw new Error(label+' timed out: '+document.body.innerText.slice(-1500));};
        const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label||b.getAttribute('aria-label')===label);
        const change=(label,value)=>{const el=document.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
        await wait(()=>button('Play fire sequence')&&document.body.textContent.includes('Bundled numerical history loaded'),'default sequence and accepted cache');
        [...document.querySelectorAll('.fire-mode-switch button')].find(b=>b.textContent.includes('Gradual')).click();
        await wait(()=>[...document.querySelectorAll('.fire-mode-switch button')].some(b=>b.textContent.includes('Gradual')&&b.getAttribute('aria-pressed')==='true'),'select gradual for comparison');
        change('Fire sequence time',63);
        await wait(()=>document.querySelector('.fire-timeline-track strong')?.textContent.includes('63.0'),'story seek');
        button('Temperature').click();
        await wait(()=>document.querySelector('.fire-evidence-badge')?.textContent.includes('Accepted numerical field'),'numerical view');
        const metrics=document.querySelector('.fire-evidence-strip').textContent;
        if(!metrics.includes('Accepted experiment time')||!metrics.includes('Accepted source inventory'))throw new Error('Accepted experiment labels missing');
        if(!document.querySelector('.fire-contact-readout')?.textContent.includes('Separate assumed hot specimens'))throw new Error('Separate contact model disclosure missing');
        [...document.querySelectorAll('.fire-mode-switch button')].find(b=>b.textContent.includes('Rapid')).click();
        await wait(()=>document.querySelector('.fire-evidence-badge')?.textContent.includes('Accepted pre-treatment reference'),'rapid reference honesty');
        if(document.querySelector('.fire-evidence-strip').textContent===metrics)throw new Error('Rapid reference failed to hold pre-treatment state');
        button('Natural cutaway').click();
        await wait(()=>document.querySelector('.fire-evidence-badge')?.textContent.includes('Illustrated sequence'),'natural view');
        document.querySelector('.fire-experiment').open=true;
        button('Calculate fire experiment').click();
        await wait(()=>button('Cancel calculation'),'worker start');
        button('Cancel calculation').click();
        await wait(()=>document.body.textContent.includes('Calculation cancelled'),'worker cancellation');
        change('Fire experiment duration hours',1);
        await wait(()=>document.querySelector('input[aria-label="Fire experiment duration hours"]').value==='1','duration edit');
        change('Fire experiment ignition minutes',15);
        await wait(()=>document.querySelector('input[aria-label="Fire experiment ignition minutes"]').value==='15','ignition duration edit');
        change('Fire experiment ignition power watts',500);
        await wait(()=>document.querySelector('input[aria-label="Fire experiment ignition power watts"]').value==='500','power edit');
        await wait(()=>!button('Calculate fire experiment').disabled,'valid edited experiment');
        button('Calculate fire experiment').click();
        await wait(()=>document.body.textContent.includes('Calculation complete. The accepted history is now displayed.'),'worker completes short experiment');
        if(!document.querySelector('.fire-experiment-displayed').textContent.includes('completed'))throw new Error('Accepted result missing');
        button('Restore bundled result').click();
        await wait(()=>document.body.textContent.includes('Bundled accepted history restored'),'bundled restore');
        button('Rendered film').click();
        await wait(()=>document.querySelector('video')?.readyState>=1,'bundled video metadata');
        const video=document.querySelector('video');
        if(Math.abs(video.duration-36)>.1)throw new Error('Incomplete rendered film: '+video.duration);
        const response=await fetch(video.currentSrc,{headers:{Range:'bytes=0-31'}});
        if(response.status!==206||response.headers.get('content-range')?.startsWith('bytes 0-31/')!==true||(await response.arrayBuffer()).byteLength!==32)throw new Error('Native video byte ranges failed');
        video.currentTime=28;
        await wait(()=>!video.seeking&&Math.abs(video.currentTime-28)<.2,'film seek');
        [...document.querySelectorAll('.fire-mode-switch button')].find(b=>b.textContent.includes('Gradual')).click();
        await wait(()=>document.querySelector('video')?.currentSrc.includes('gradual')&&document.querySelector('video').readyState>=1,'both films');
        button('Interactive').click();
        await wait(()=>button('Temperature'),'return to interaction');
        change('Fire sequence time',78);
        await wait(()=>document.querySelector('.fire-contact-readout')?.textContent.includes('Water supplied 1.32 / 5 kg'),'contact water ledger advances after hose placement');
        window.dispatchEvent(new CustomEvent('workspace-request',{detail:'coupled'}));
        await wait(()=>!document.querySelector('.fire-sequence-shell'),'lab navigation');
        window.dispatchEvent(new CustomEvent('workspace-request',{detail:'sequence'}));
        await wait(()=>Number(document.querySelector('input[aria-label="Fire sequence time"]')?.value)===78,'sequence state restored');
        const gl=document.querySelector('canvas')?.getContext('webgl2');if(!gl||gl.isContextLost())throw new Error('WebGL unavailable');
        return 'ok';
      })()`);
      if(result!=='ok')throw new Error('Unexpected fire smoke result');
      clearTimeout(timeout);console.log('FIRE_SEQUENCE_SMOKE_PASS: accepted cache, event-aware fields, worker completion/cancel, both full films, native byte ranges, workspace state.');app.exit(0);
    }catch(error){console.error(error);clearTimeout(timeout);app.exit(1)}
  });
});
require('../electron/main.cjs');
