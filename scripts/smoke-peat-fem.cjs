// Native integration fixture; no release code or external data transmission.
const {app}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const root=path.resolve(__dirname,'..');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'peat-fem-smoke-')));app.getAppPath=()=>root;process.argv.push('--peat-fem');
if(process.platform!=='darwin'){app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader');}
const timer=setTimeout(()=>{console.error('PEAT_FEM_TIMEOUT');app.exit(1)},120000);
app.on('browser-window-created',(_event,win)=>{
  // Keep the functional test isolated from clicks in the user's current app.
  // This hidden run does not qualify as a visible-render performance measure.
  win.show=()=>{};win.webContents.setBackgroundThrottling(false);
  win.webContents.on('render-process-gone',(_event,details)=>{console.error(details);app.exit(1)});
  const graphicsErrors=[];win.webContents.on('console-message',event=>{if(/Shader Error|VALIDATE_STATUS.*false|INVALID_OPERATION/.test(event.message)){graphicsErrors.push(event.message);console.error(event.message)}if(event.message.startsWith('FEM_STAGE:'))console.log(event.message)});
  win.webContents.once('did-finish-load',async()=>{try{
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const wait=async(fn,label)=>{const start=performance.now();while(performance.now()-start<30000){if(fn()){console.log('FEM_STAGE: '+label);return}await new Promise(r=>setTimeout(r,50));}throw new Error(label+' timed out '+document.body.innerText.slice(-1000)+' canvas='+document.querySelectorAll('canvas').length+' grid='+document.querySelectorAll('.fem-grid-value').length)};
      const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
      const clock=()=>Number(document.querySelector('.fem-shell')?.dataset.femTime);
      const select=(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('change',{bubbles:true}));};
      await wait(()=>button('Single FEM step')&&!button('Single FEM step').disabled,'worker ready');
      await wait(()=>document.querySelectorAll('.fem-grid-value').length===25,'temperature sample grid');
      button('Single FEM step').click();await wait(()=>clock()>0&&!button('Single FEM step').disabled,'accepted FE step');const first=clock();
      button('Run Peat Fire FEM').click();await wait(()=>clock()>first,'live solve');button('Pause Peat Fire FEM').click();await wait(()=>button('Run Peat Fire FEM'),'pause');
      const paused=clock();await new Promise(r=>setTimeout(r,250));if(clock()!==paused)throw new Error('Pause advanced accepted state');
      document.querySelector('button[aria-label="Open Toolbox"]').click();await wait(()=>document.querySelector('select[aria-label="FEM field"]'),'settings');
      select('FEM field','oxygen');document.querySelector('input[aria-label="FEM temperature grid"]').click();await new Promise(r=>setTimeout(r,100));
      if(clock()!==paused||document.querySelectorAll('.fem-grid-value').length)throw new Error('Display controls changed state or grid');
      select('FEM mesh','8');await wait(()=>clock()===0&&!button('Single FEM step').disabled,'mesh reset');
      button('Single FEM step').click();await wait(()=>clock()>0&&!button('Single FEM step').disabled,'refined step');const refined=clock();
      window.dispatchEvent(new CustomEvent('workspace-request',{detail:'comparison'}));await wait(()=>document.querySelector('.archived-workspaces'),'archive navigation');
      if(document.querySelectorAll('.archived-workspaces button').length!==4)throw new Error('Historical workspaces missing');
      window.dispatchEvent(new CustomEvent('workspace-request',{detail:'peat-fem'}));await wait(()=>clock()===refined&&!button('Single FEM step').disabled,'FEM session restored');
      button('Reset FEM').click();button('Reset FEM').click();await wait(()=>clock()===0&&!button('Single FEM step').disabled,'repeated reset');await new Promise(r=>setTimeout(r,200));if(clock()!==0)throw new Error('Stale worker result');
      button('Physical formulas ↗').click();await wait(()=>document.querySelector('.fem-formulas'),'current equation reference');
      if(document.querySelector('.formula-reference-shell'))throw new Error('Historical equations duplicated in active Finder');
      const gl=document.querySelector('.fem-viewport canvas').getContext('webgl2');if(!gl||gl.isContextLost())throw new Error('WebGL context unavailable');
      return{initialAcceptedStepS:first,pausedPhysicalS:paused,refinedStepS:refined,temperatureSamples:25,checks:'run, step, pause, field/grid identity, mesh reset, archive access, session restore, repeated reset, formulas, WebGL'};
    })()`);
    if(graphicsErrors.length)throw new Error(graphicsErrors.join('\n'));
    fs.mkdirSync(path.join(root,'docs/review/peat-fem'),{recursive:true});fs.writeFileSync(path.join(root,'docs/review/peat-fem/native-smoke.json'),JSON.stringify({...result,host:process.platform,date:new Date().toISOString()},null,2));
    clearTimeout(timer);console.log('PEAT_FEM_SMOKE_PASS',JSON.stringify(result));app.exit(0);
  }catch(error){console.error(error);clearTimeout(timer);app.exit(1)}});
});
require('../electron/main.cjs');
