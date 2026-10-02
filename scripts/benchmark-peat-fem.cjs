// Visible production Electron benchmark. Run independently of analysis jobs.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'peat-fem-benchmark-')));app.getAppPath=()=>root;process.argv.push('--peat-fem');
const timer=setTimeout(()=>{console.error('VISIBLE_BENCHMARK_TIMEOUT');app.exit(1)},90000);
app.on('browser-window-created',(_event,win)=>{
  win.webContents.once('did-finish-load',async()=>{try{
    win.show();app.focus({steal:true});win.focus();
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const pause=ms=>new Promise(r=>setTimeout(r,ms));
      const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
      const began=performance.now();while(!button('Run Peat Fire FEM')||button('Run Peat Fire FEM').disabled){if(performance.now()-began>15000)throw new Error('Worker not ready');await pause(50)}
      const focusStart=performance.now();while(document.visibilityState!=='visible'||!document.hasFocus()){if(performance.now()-focusStart>5000)throw new Error('Visible focused window required');await pause(50)}
      const canvas=document.querySelector('.fem-viewport canvas');canvas.scrollIntoView({block:'center'});button('Run Peat Fire FEM').click();await pause(5000);
      if(document.querySelectorAll('.fem-grid-value').length!==25)throw new Error('Temperature overlay must remain enabled');
      const start=performance.now(),physicalStart=Number(document.querySelector('.fem-shell').dataset.femTime),physical=[],acceptedStart=Number(document.querySelector('.fem-shell').dataset.femAcceptedSteps);
      let frames;window.addEventListener('peat-fem-benchmark-result',e=>{frames=e.detail},{once:true});window.dispatchEvent(new Event('peat-fem-benchmark-start'));
      const rect=canvas.getBoundingClientRect();
      for(let j=0;j<30;j++){
        if(j===5||j===15){canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:j===5?30:-30,clientX:rect.x+rect.width*.5,clientY:rect.y+rect.height*.5,bubbles:true,cancelable:true}))}
        if(j===10||j===20){canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,pointerType:'mouse',button:0,buttons:1,clientX:rect.x+rect.width*.5,clientY:rect.y+rect.height*.5,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'mouse',button:0,buttons:0,clientX:rect.x+rect.width*.5,clientY:rect.y+rect.height*.5,bubbles:true}))}
        await pause(1000);physical.push({wallMs:performance.now()-start,timeS:Number(document.querySelector('.fem-shell').dataset.femTime),visible:document.visibilityState,focused:document.hasFocus(),overlay:document.querySelectorAll('.fem-grid-value').length});
      }
      window.dispatchEvent(new Event('peat-fem-benchmark-stop'));const end=performance.now();button('Pause Peat Fire FEM')?.click();
      const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {startMs:start,endMs:end,physicalStart,acceptedStart,acceptedEnd:Number(document.querySelector('.fem-shell').dataset.femAcceptedSteps),physical,frames,settings:{moistureDryRatio:.1,dryDensityKgM3:123,oxygenMassFraction:.233,ambientK:300,ambientPressurePa:101325,ignitionW:8,ignitionS:180,maxStepS:1,pace:10,chemistry:true},userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},canvasCSS:{width:rect.width,height:rect.height},renderResolution:{width:canvas.width,height:canvas.height},devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),warmupS:5,interaction:'wheel zoom at 5/15 s; probe click at 10/20 s; no physics edits',statusText:document.querySelector('[role="status"]').textContent,error:document.querySelector('.fem-error')?.textContent??null};
    })()`);
    const stamps=result.frames.map(f=>f.wallMs),dt=[stamps[0]-result.startMs,...stamps.slice(1).map((v,i)=>v-stamps[i]),result.endMs-stamps.at(-1)];
    const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
    const windows=[];for(let start=result.startMs;start+1000<=result.endMs;start+=100)windows.push(stamps.filter(t=>t>=start&&t<start+1000).length);
    const productionFiles=fs.readdirSync(path.join(root,'dist/assets')).filter(f=>/\.js$/.test(f)).sort(),hash=crypto.createHash('sha256');productionFiles.forEach(f=>{hash.update(f);hash.update(fs.readFileSync(path.join(root,'dist/assets',f)))});
    const durationS=(result.endMs-result.startMs)/1000,physicalProgressS=result.physical.at(-1).timeS-result.physicalStart;
    const report={...result,productionJsHash:hash.digest('hex'),hardware:os.cpus()[0].model,platform:process.platform,electron:process.versions.electron,date:new Date().toISOString(),mesh:{cells:[4,4,4],nodes:125,transportFields:750},summary:{durationS,frames:stamps.length,meanFPS:stamps.length/durationS,minimumRolling1sFPS:Math.min(...windows),low5pctRollingFPS:percentile(windows,.05),frameTime95Ms:percentile(dt,.95),frameTime99Ms:percentile(dt,.99),maximumFrameTimeMs:Math.max(...dt),physicalProgressS,acceptedSteps:result.acceptedEnd-result.acceptedStart,acceptedStepsPerWallS:(result.acceptedEnd-result.acceptedStart)/durationS,visibleFocusedThroughout:result.physical.every(p=>p.visible==='visible'&&p.focused),overlayThroughout:result.physical.every(p=>p.overlay===25),everyRollingWindowMet40:windows.every(v=>v>=40),solverStallSeconds:result.physical.filter((p,i)=>p.timeS===(i?result.physical[i-1].timeS:result.physicalStart)).length},method:'Actual Canvas useFrame timestamps before draw; sliding complete 1 s windows every 100 ms. CPU render-loop cadence, not independent GPU present timestamps. All finite interval windows retained; no dip exclusions. Frame-time percentiles include interval-start/end gaps.',rolling1sFPS:windows};
    report.passed=report.summary.everyRollingWindowMet40&&report.summary.visibleFocusedThroughout&&report.summary.overlayThroughout&&physicalProgressS>0&&!result.error;
    fs.writeFileSync(path.join(root,'docs/review/peat-fem/visible-fem.png'),(await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(root,'docs/review/peat-fem/visible-benchmark.json'),JSON.stringify(report,null,2)+'\n');clearTimeout(timer);console.log('VISIBLE_BENCHMARK',JSON.stringify({passed:report.passed,...report.summary}));app.exit(report.passed?0:1);
  }catch(error){console.error(error);clearTimeout(timer);app.exit(1)}});
});
require('../electron/main.cjs');
