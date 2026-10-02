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
      button('Single FEM step').click();await wait(()=>clock()>0&&!button('Single FEM step').disabled,'accepted FE step');const first=clock();if(Number(document.querySelector('.fem-shell').dataset.femAcceptedSteps)<1)throw new Error('Accepted-step performance counter missing');
      button('Run Peat Fire FEM').click();await wait(()=>clock()>first,'live solve');button('Pause Peat Fire FEM').click();await wait(()=>button('Run Peat Fire FEM'),'pause');
      const paused=clock();await new Promise(r=>setTimeout(r,250));if(clock()!==paused)throw new Error('Pause advanced accepted state');
      document.querySelector('button[aria-label="Open Toolbox"]').click();await wait(()=>document.querySelector('select[aria-label="FEM field"]'),'settings');
      select('FEM field','oxygen');document.querySelector('input[aria-label="FEM temperature grid"]').click();await new Promise(r=>setTimeout(r,100));
      if(clock()!==paused||document.querySelectorAll('.fem-grid-value').length)throw new Error('Display controls changed state or grid');
      for(const field of ['water','pressure','darcySpeed']){select('FEM field',field);await new Promise(r=>setTimeout(r,50));if(clock()!==paused)throw new Error('New field changed physical state')}
      let blob;const url=URL.createObjectURL,anchor=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=b=>{blob=b;return url.call(URL,b)};HTMLAnchorElement.prototype.click=()=>{};
      button('Export FEM recording').click();URL.createObjectURL=url;HTMLAnchorElement.prototype.click=anchor;
      const record=JSON.parse(await blob.text()),state=record.history.at(-1);
      if(record.schema!==2||state.gas.length!==4||state.water.length!==125||state.pressure.length!==125)throw new Error('Active reacting-flow export mismatch');
      for(let i=0;i<125;i++){
        const theta=1-state.water[i]/1000-state.fuel[i]/1500-(state.alphaChar[i]+state.char[i])/1300-state.ash[i]/2500;
        const moles=state.gas.reduce((sum,g,j)=>sum+g[i]/[.031998,.028014,.01801528,.02897][j],0),p=8.31446261815324*state.temperature[i]*moles/theta;
        if(Math.abs(state.pressure[i]-p)/p>1e-10)throw new Error('Rendered/exported pressure is inconsistent with species and temperature');
      }
      button('Reset FEM').click();await wait(()=>clock()===0&&!button('Single FEM step').disabled,'reset before file import');
      const files=new DataTransfer();files.items.add(new File([blob],'peat-fire-fem-recording.json',{type:'application/json'}));
      const input=document.querySelector('input[aria-label="Import FEM recording"]');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      await wait(()=>clock()===paused&&!button('Single FEM step').disabled,'exported file recording restored');
      select('FEM mesh','8');await wait(()=>clock()===0&&!button('Single FEM step').disabled,'mesh reset');
      button('Single FEM step').click();await wait(()=>clock()>0&&!button('Single FEM step').disabled,'refined step');const refined=clock();
      window.dispatchEvent(new CustomEvent('workspace-request',{detail:'comparison'}));await wait(()=>document.querySelector('.archived-workspaces'),'archive navigation');
      if(document.querySelectorAll('.archived-workspaces button').length!==4)throw new Error('Historical workspaces missing');
      window.dispatchEvent(new CustomEvent('workspace-request',{detail:'peat-fem'}));await wait(()=>clock()===refined&&!button('Single FEM step').disabled,'FEM session restored');
      button('Reset FEM').click();button('Reset FEM').click();await wait(()=>clock()===0&&!button('Single FEM step').disabled,'repeated reset');await new Promise(r=>setTimeout(r,200));if(clock()!==0)throw new Error('Stale worker result');
      button('Physical formulas ↗').click();await wait(()=>document.querySelector('.fem-formulas'),'current equation reference');
      if(document.querySelector('.formula-reference-shell'))throw new Error('Historical equations duplicated in active Finder');
      const gl=document.querySelector('.fem-viewport canvas').getContext('webgl2');if(!gl||gl.isContextLost())throw new Error('WebGL context unavailable');
      return{initialAcceptedStepS:first,pausedPhysicalS:paused,refinedStepS:refined,temperatureSamples:25,checks:'run, step, pause, field/grid identity, moisture/pressure/flux, four-gas export EOS, exported-file import, accepted-step counter, mesh reset, archive access, session restore, repeated reset, formulas, WebGL'};
    })()`);
    if(graphicsErrors.length)throw new Error(graphicsErrors.join('\n'));
    fs.mkdirSync(path.join(root,'docs/review/peat-fem'),{recursive:true});fs.writeFileSync(path.join(root,'docs/review/peat-fem/native-smoke.json'),JSON.stringify({...result,host:process.platform,date:new Date().toISOString()},null,2));
    clearTimeout(timer);console.log('PEAT_FEM_SMOKE_PASS',JSON.stringify(result));app.exit(0);
  }catch(error){console.error(error);clearTimeout(timer);app.exit(1)}});
});
require('../electron/main.cjs');
