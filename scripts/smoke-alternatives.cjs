// Regression / performance smoke for the integrated Version21 app, never bundled.
const {app}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'alternatives-v21-')));
app.getAppPath=()=>path.resolve(__dirname,'..');process.argv.push('--sequence');
if(process.platform!=='darwin'){app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader');}
const timeout=setTimeout(()=>{console.error('ALTERNATIVES_SMOKE_TIMEOUT');app.exit(1)},180000);
app.on('browser-window-created',(_event,win)=>{
  // This fixture measures animation frames while the user's Chrome stays usable.
  // Disable only this test window's background throttling, not production prefs.
  win.webContents.setBackgroundThrottling(false);
  const errors=[];win.webContents.on('render-process-gone',(_e,details)=>{console.error(details);app.exit(1)});
  win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('sandbox_extension')){errors.push(event.message);console.error(event.message)}if(event.message.startsWith('ALT_STAGE:'))console.log(event.message)});
  win.webContents.once('did-finish-load',async()=>{
    try{
      const result=await win.webContents.executeJavaScript(`(async()=>{
        const delay=ms=>new Promise(r=>setTimeout(r,ms));
        const wait=async(fn,label)=>{for(let i=0;i<400;i++){if(fn()){console.log('ALT_STAGE: '+label);return}await delay(50)}throw new Error(label+' timed out: '+document.body.innerText.slice(-1200))};
        const button=(name,root=document)=>[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===name||b.getAttribute('aria-label')===name);
        const assert=(value,message)=>{if(!value)throw new Error(message)};
        const panels=()=>[...document.querySelectorAll('.alternative-panel')],time=p=>Number(p.dataset.time);
        const choose=(panel,id)=>{const el=panel.querySelector('select[aria-label^="Alternative "]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,id);el.dispatchEvent(new Event('change',{bubbles:true}))};
        await wait(()=>document.querySelector('.fire-sequence-shell'),'rapid sequence opening workspace');
        const rapid=[...document.querySelectorAll('.fire-mode-switch button')].find(b=>b.textContent.includes('Rapid release'));
        assert(rapid?.getAttribute('aria-pressed')==='true','Rapid source must be default');
        const NativeWorker=window.Worker,alive=new Set();window.Worker=class extends NativeWorker{constructor(...args){super(...args);alive.add(this)}terminate(){alive.delete(this);return super.terminate()}};
        button('Simulation Version').click();await wait(()=>document.querySelector('.alternative-choices'),'embedded alternatives menu');
        for(const method of ['4.2.1','4.2.2','4.2.3','4.2.4']){
          document.querySelector('[data-method="'+method+'"] [data-disclosure]').click();await delay(20);
          const menu=document.querySelector('[data-method="'+method+'"] .alternative-children');assert(menu?.querySelectorAll('.alternative-model-view').length===6,'five secondary sections plus FEM missing under '+method);
        }
        document.querySelector('[data-method="4.2.3"] [data-disclosure]').click();await delay(20);
        assert(document.querySelectorAll('[data-method="4.2.3"] .alternative-children button').length===8,'Pressure variants missing');
        document.querySelector('#simulation-version-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await delay(20);
        // Escape from a menu child collapses its flyout; a root Escape dismisses the dropdown.
        if(document.querySelector('#simulation-version-menu'))document.querySelector('#simulation-version-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        for(const [method,id] of [['4.2.1','sublimation-injection'],['4.2.2','nanoparticles'],['4.2.3','pressure-pulse'],['4.2.4','vibratory-injection']]){
          button('Simulation Version').click();await delay(20);document.querySelector('[data-parent="'+method+'"]').click();
          await wait(()=>id==='pressure-pulse'?document.querySelector('.fire-sequence-shell:not(.method-render)'):document.querySelector('[data-render-variant="'+id+'"]'),method+' opens latest render directly');
          assert(new URL(location.href).searchParams.get('alternative')===id,'Selected method missing from refresh URL');
          if(id==='vibratory-injection'){
            assert(document.querySelector('[data-vibratory-version="3"][data-treatment="vibration-only"][data-prediction="unavailable"]'),'Latest vibration-only workspace missing');
            await wait(()=>document.querySelector('.vib-scene canvas'),'original opening in private C workspace');
            assert(document.querySelectorAll('.vib-scene canvas').length===1&&alive.size===0,'Vibration render must use one Canvas and no numerical jobs');
            button('Simulation Version').click();await delay(20);document.querySelector('[data-parent="4.2.3"]').click();
            await wait(()=>document.querySelector('.fire-sequence-shell:not(.method-render)')&&alive.size===0,'C route disposal restores protected original');
          }else if(id!=='pressure-pulse'){
            await wait(()=>document.querySelector('[data-original-animation="fire-spread-and-drilling"] canvas'),'read-only original animation reused');
            assert(Number(document.querySelector('[data-original-animation]').dataset.originalContextTime)<=38,'Alternative context replayed original treatment');
            if(id!=='nanoparticles'){
              const seek=document.querySelector('input[aria-label="Method render time"]');
              for(const target of [45,75,0,75]){
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(seek,String(target));seek.dispatchEvent(new Event('input',{bubbles:true}));
                await wait(()=>Number(seek.value)===target&&document.querySelector('[data-presentation-active]')?.dataset.presentationActive===String(target>=38),'method seek '+id+' '+target);
                assert(document.querySelectorAll('[data-original-animation] canvas').length===1,'World scene must share one Canvas');
                assert(!document.querySelector('.alternative-method-diagram'),'Rejected inset still present');
              }
            }
          }
        }
        button('Simulation Version').click();await delay(20);document.querySelector('[data-parent="4.2.3"]').click();await wait(()=>document.querySelector('.fire-sequence-shell:not(.method-render)'),'original rapid render restored');
        button('Simulation Version').click();await delay(20);document.querySelector('.version-compare-link').click();
        await wait(()=>panels().length===2&&panels().every(p=>button('Start',p)&&!button('Start',p).disabled),'two independent jobs ready');
        assert(alive.size===2,'Expected exactly two live workers');
        button('Start / resume all').click();await wait(()=>panels().every(p=>time(p)>=2),'simultaneous accepted computation');
        const left=panels()[0],right=panels()[1];button('Pause',left).click();await wait(()=>left.dataset.running==='false','left pause acknowledged');
        const paused=time(left),other=time(right);await delay(250);assert(time(left)===paused&&time(right)>other,'Pausing one run changed the other');
        const oldRun=left.dataset.runId;button('Reset',left).click();await wait(()=>time(left)===0&&left.dataset.runId!==oldRun,'reset replaces one run only');
        const rightId=right.dataset.runId;button('Duplicate',right).click();await wait(()=>panels().length===3&&alive.size===3,'duplicate owns separate worker');
        assert(time(panels()[2])===0,'Duplicate copied mutable solver state');button('Remove',panels()[2]).click();await wait(()=>panels().length===2&&alive.size===2,'removed worker disposed');assert(right.dataset.runId===rightId,'Removal replaced another run');
        button('Pause all').click();
        for(const id of ['sublimation-injection','liquid-waves','pressure-only']){
          choose(right,id);await wait(()=>right.dataset.variant===id&&button('Start',right)&&!button('Start',right).disabled,id+' ready');button('Start',right).click();await wait(()=>time(right)>=.5,id+' independently runs');button('Pause',right).click();
          if(id==='pressure-only')assert(!right.querySelector('.alt-history'),'Concept acquired fabricated outcome curve');
        }
        choose(right,'vibratory-injection');await wait(()=>right.dataset.variant==='vibratory-injection'&&button('Start',right)?.disabled&&time(right)===0,'vibration prediction unavailable');
        assert(!right.querySelector('.alt-history'),'Unsupported vibration acquired fabricated outcome history');
        await wait(()=>alive.size===1,'unsupported vibration disposes its comparison worker');
        choose(right,'pressure-pulse');await wait(()=>right.textContent.includes('Protected original render'),'original is unavailable for unsupported live comparison');await wait(()=>button('Start',right)?.disabled&&time(right)===0,'original comparison execution disabled');
        choose(right,'nanoparticles');await wait(()=>right.textContent.includes('reviewed particle model'),'pending reviewed particle model rejects execution');await wait(()=>button('Start',right)?.disabled&&time(right)===0,'nanoparticles start disabled');
        choose(right,'sublimation-injection');await wait(()=>button('Start',right)&&!button('Start',right).disabled,'thermal proxy restored');button('Reset all').click();await delay(100);
        const link=document.querySelector('input[aria-label="Link physical time"]');link.click();await delay(20);button('Start / resume all').click();await wait(()=>panels().every(p=>time(p)>=3),'linked physical barriers advancing');button('Pause all').click();
        await wait(()=>Math.abs(time(left)-time(right))<1e-8,'linked accepted times agree after pause');
        const pairTime=time(left);await delay(100);assert(time(left)===pairTime&&time(right)===pairTime,'Linked pause kept advancing');
        link.click();button('Reset all').click();await delay(100);button('Start / resume all').click();await delay(2200);
        const perf=()=>{const e=document.querySelector('.alt-performance');return {panels:panels().length,p50Ms:Number(e.dataset.frameP50),p95Ms:Number(e.dataset.frameP95),samples:Number(e.dataset.frameSamples),physicalTimes:panels().map(time)}};
        await wait(()=>perf().samples===120,'two-panel frame sample');const two=perf();button('Pause all').click();button('Duplicate',panels()[0]).click();await wait(()=>panels().length===3,'third panel');button('Duplicate',panels()[1]).click();await wait(()=>panels().length===4&&alive.size===4,'four independent workers');
        button('Reset all').click();await delay(100);button('Start / resume all').click();await wait(()=>panels().every(p=>time(p)>=1),'four simultaneous computations');await delay(2200);await wait(()=>perf().samples===120,'four-panel frame sample');const four=perf();
        console.log('ALT_PERFORMANCE: '+JSON.stringify({two,four}));
        assert(four.p95Ms<50,'Four-panel presentation p95 exceeds 50 ms on this fixture: '+JSON.stringify(four));
        const began=performance.now();button('Pause all').click();await wait(()=>panels().every(p=>p.dataset.running==='false'),'four-panel pause responsive');const pauseMs=performance.now()-began;
        const beforeFailure=panels().map(p=>({id:p.dataset.panelId,time:time(p)})),failedWorker=[...alive][0];
        failedWorker.dispatchEvent(new ErrorEvent('error',{message:'Injected lifecycle failure',cancelable:true}));
        await wait(()=>panels().some(p=>p.textContent.includes('Injected lifecycle failure')),'worker failure reported');
        const failedPanel=panels().find(p=>p.textContent.includes('Injected lifecycle failure'));
        assert(time(failedPanel)===beforeFailure.find(p=>p.id===failedPanel.dataset.panelId).time&&failedPanel.querySelector('.alt-history'),'Worker crash discarded last accepted state/history');
        button('Reset',failedPanel).click();await wait(()=>time(failedPanel)===0&&button('Start',failedPanel)&&!button('Start',failedPanel).disabled&&alive.size===4,'failed worker reset independently');
        failedWorker.dispatchEvent(new ErrorEvent('error',{message:'Stale terminated worker failure',cancelable:true}));await delay(50);
        assert(!failedPanel.textContent.includes('Stale terminated worker failure'),'Stale worker error replaced current run');
        button('Fire Simulation home').click();await wait(()=>document.querySelector('.fire-sequence-shell')&&alive.size===0,'navigation disposes all live jobs and preserves rapid renderer');
        return {two,four,pauseMs,workerCleanup:true,tests:['default rapid mode','implicit render and five secondary sections under every method','selected method refresh URL','read-only original fire/drilling reuse before treatment','prominent method animation after original introduction','pressure variants','independent pause/reset','configuration-only duplicate','removal cleanup','supported new variants','vibration-only render without numerical jobs','unsupported vibration comparison rejected','original comparison unavailable','unspecified rejection','linked physical time','two/four panel performance','worker crash retains accepted state/history','reset after failure','stale terminated-worker error rejected']};
      })()`);
      assertNoErrors(errors);fs.mkdirSync(path.resolve(__dirname,'../docs/review/version21'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../docs/review/version21/live-smoke.json'),JSON.stringify({...result,date:new Date().toISOString(),environment:process.platform+' '+process.arch,scope:'software/numerical checks only; no physical validation'},null,2));
      clearTimeout(timeout);console.log('ALTERNATIVES_SMOKE_PASS '+JSON.stringify(result));app.exit(0);
    }catch(error){console.error(error);console.error(errors);clearTimeout(timeout);app.exit(1)}
  });
});
function assertNoErrors(errors){if(errors.length)throw new Error('Renderer errors: '+errors.join('\n'))}
require('../electron/main.cjs');
