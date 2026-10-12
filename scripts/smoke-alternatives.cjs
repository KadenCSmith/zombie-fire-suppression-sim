// Regression / performance smoke for the integrated Version21 app, never bundled.
const {app}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'alternatives-v21-')));
app.getAppPath=()=>path.resolve(__dirname,'..');process.argv.push('--sequence');
if(process.platform!=='darwin'){app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader');}
const timeout=setTimeout(()=>{console.error('ALTERNATIVES_SMOKE_TIMEOUT');app.exit(1)},180000);
app.on('browser-window-created',(_event,win)=>{
  const errors=[];win.webContents.on('render-process-gone',(_e,details)=>{console.error(details);app.exit(1)});
  win.webContents.on('console-message',event=>{if(event.level==='error'&&!event.message.includes('sandbox_extension'))errors.push(event.message);if(event.message.startsWith('ALT_STAGE:'))console.log(event.message)});
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
          await wait(()=>id==='sublimation-injection'?document.querySelector('.fire-sequence-shell:not(.method-render)'):document.querySelector('[data-render-variant="'+id+'"]'),method+' opens latest render directly');
        }
        button('Simulation Version').click();await delay(20);document.querySelector('[data-parent="4.2.1"]').click();await wait(()=>document.querySelector('.fire-sequence-shell:not(.method-render)'),'rapid render restored');
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
        for(const id of ['sublimation-injection','pressure-pulse','liquid-waves','pressure-only','vibratory-injection']){
          choose(right,id);await wait(()=>right.dataset.variant===id&&button('Start',right)&&!button('Start',right).disabled,id+' ready');button('Start',right).click();await wait(()=>time(right)>=.5,id+' independently runs');button('Pause',right).click();
          if(id==='pressure-only')assert(!right.querySelector('.alt-history'),'Concept acquired fabricated outcome curve');
        }
        choose(right,'nanoparticles');await wait(()=>right.textContent.includes('Only a heading'),'unspecified mechanism rejects execution');await wait(()=>button('Start',right)?.disabled&&time(right)===0,'nanoparticles start disabled');
        choose(right,'sublimation-injection');await wait(()=>button('Start',right)&&!button('Start',right).disabled,'thermal proxy restored');button('Reset all').click();await delay(100);
        const link=document.querySelector('input[aria-label="Link physical time"]');link.click();await delay(20);button('Start / resume all').click();await wait(()=>panels().every(p=>time(p)>=3),'linked physical barriers advancing');button('Pause all').click();
        await wait(()=>Math.abs(time(left)-time(right))<1e-8,'linked accepted times agree after pause');
        const pairTime=time(left);await delay(100);assert(time(left)===pairTime&&time(right)===pairTime,'Linked pause kept advancing');
        link.click();button('Reset all').click();await delay(100);button('Start / resume all').click();await delay(2200);
        const perf=()=>{const e=document.querySelector('.alt-performance');return {panels:panels().length,p50Ms:Number(e.dataset.frameP50),p95Ms:Number(e.dataset.frameP95),samples:Number(e.dataset.frameSamples),physicalTimes:panels().map(time)}};
        await wait(()=>perf().samples===120,'two-panel frame sample');const two=perf();button('Pause all').click();button('Duplicate',panels()[0]).click();await wait(()=>panels().length===3,'third panel');button('Duplicate',panels()[1]).click();await wait(()=>panels().length===4&&alive.size===4,'four independent workers');
        button('Reset all').click();await delay(100);button('Start / resume all').click();await wait(()=>panels().every(p=>time(p)>=1),'four simultaneous computations');await delay(2200);await wait(()=>perf().samples===120,'four-panel frame sample');const four=perf();
        assert(four.p95Ms<50,'Four-panel presentation p95 exceeds 50 ms on this fixture');
        const began=performance.now();button('Pause all').click();await wait(()=>panels().every(p=>p.dataset.running==='false'),'four-panel pause responsive');const pauseMs=performance.now()-began;
        button('Fire Simulation home').click();await wait(()=>document.querySelector('.fire-sequence-shell')&&alive.size===0,'navigation disposes all live jobs and preserves rapid renderer');
        return {two,four,pauseMs,workerCleanup:true,tests:['default rapid mode','implicit render and five secondary sections under every method','pressure variants','independent pause/reset','configuration-only duplicate','removal cleanup','all defined variants','unspecified rejection','linked physical time','two/four panel performance']};
      })()`);
      assertNoErrors(errors);fs.mkdirSync(path.resolve(__dirname,'../docs/review/version21'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../docs/review/version21/live-smoke.json'),JSON.stringify({...result,date:new Date().toISOString(),environment:process.platform+' '+process.arch,scope:'software/numerical checks only; no physical validation'},null,2));
      clearTimeout(timeout);console.log('ALTERNATIVES_SMOKE_PASS '+JSON.stringify(result));app.exit(0);
    }catch(error){console.error(error);console.error(errors);clearTimeout(timeout);app.exit(1)}
  });
});
function assertNoErrors(errors){if(errors.length)throw new Error('Renderer errors: '+errors.join('\n'))}
require('../electron/main.cjs');
