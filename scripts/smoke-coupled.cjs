const {app}=require('electron'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'work','coupled-validation');
fs.mkdirSync(folder,{recursive:true});app.setPath('userData',fs.mkdtempSync(path.join(folder,'profile-')));app.getAppPath=()=>root;process.argv.push('--coupled');
if(process.platform!=='darwin'){app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader')}
let stage='startup',peak=0;
const memory=setInterval(()=>{peak=Math.max(peak,app.getAppMetrics().reduce((sum,p)=>sum+p.memory.workingSetSize*1024,0))},250);
const timeout=setTimeout(()=>finish('timeout after '+stage),process.platform==='win32'?600000:180000);
function finish(error){clearInterval(memory);clearTimeout(timeout);console.log(error?'COUPLED_SMOKE_FAIL '+error:'COUPLED_SMOKE_PASS');app.exit(error?1:0)}
app.on('browser-window-created',(_,win)=>{
 win.webContents.on('render-process-gone',(_,details)=>finish('renderer '+details.reason));
 win.webContents.on('console-message',event=>{if(event.message.startsWith('COUPLED_STAGE:')){stage=event.message;console.log(stage)}});
 win.webContents.once('did-finish-load',async()=>{try{
 const results=await win.webContents.executeJavaScript(`(async()=>{
  const tick=()=>new Promise(resolve=>setTimeout(resolve,100));
  const wait=async(predicate,name)=>{for(let i=0;i<${process.platform==='win32'?5400:1400};i++){if(predicate()){console.log('COUPLED_STAGE: '+name);return}await tick()}throw new Error('Wait failed '+name+' '+document.body.innerText.slice(-2000))};
  const button=text=>[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===text);
  const select=(label,value)=>{const input=document.querySelector('select[aria-label="'+label+'"]');if(!input)throw new Error('Missing select '+label);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('change',{bubbles:true}))};
  const range=(label,value)=>{const input=document.querySelector('input[aria-label="'+label+'"]');if(!input)throw new Error('Missing input '+label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))};
  const complete=()=>document.querySelector('[role="status"]')?.textContent.includes('Calculation complete.');
  await wait(()=>button('▶  Calculate scenario'),'workspace');
  // CI explicitly chooses a bounded reference run, independent of the higher-resolution app default.
  select('Coupled fidelity','preview');await tick();range('Physical duration slider',10);button('Scientific').click();
  [...document.querySelectorAll('label')].find(label=>label.textContent.includes('Also calculate rigid-pore baseline')).querySelector('input').click();await tick();
  button('▶  Calculate scenario').click();await wait(()=>button('■  Stop calculation'),'running');await wait(complete,'result');
  if(!document.body.textContent.includes('10.00 s')||document.querySelector('[role="alert"]'))throw new Error('Run did not complete');
  select('Coupled field','pressurePa');range('Coupled replay time',1);await tick();
  if(!document.body.textContent.includes('2.00 s'))throw new Error('Replay not retained');
  window.dispatchEvent(new CustomEvent('workspace-request',{detail:'mechanics'}));await wait(()=>document.body.textContent.includes('Load. Deform. Recover.'),'mechanics');
  window.dispatchEvent(new CustomEvent('workspace-request',{detail:'coupled'}));await wait(()=>document.querySelector('select[aria-label="Coupled field"]')?.value==='pressurePa','retained controls');
  if(!document.body.textContent.includes('2.00 s'))throw new Error('Run lost across workspace');
  range('Physical duration slider',3600);await tick();
  if(!button('Export accepted states ↗').disabled||!document.querySelector('input[aria-label="Coupled replay time"]').disabled)throw new Error('Input invalidation failed');
  button('▶  Calculate scenario').click();await wait(()=>button('■  Stop calculation'),'cancel start');
  const started=performance.now();button('■  Stop calculation').click();await wait(()=>button('▶  Calculate scenario'),'cancel finish');const cancelMs=performance.now()-started;
  range('Physical duration slider',10);await tick();button('▶  Calculate scenario').click();await wait(complete,'final result');
  // Capture only our generated test Blob; no file dialog or external side effect is needed.
  let exportedBlob;const createUrl=URL.createObjectURL,anchorClick=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=function(blob){exportedBlob=blob;return createUrl.call(this,blob)};HTMLAnchorElement.prototype.click=function(){};
  button('Export accepted states ↗').click();URL.createObjectURL=createUrl;HTMLAnchorElement.prototype.click=anchorClick;
  const exported=JSON.parse(await exportedBlob.text());
  if(exported.version!==2||exported.grid.nx!==8||exported.grid.ny!==8||exported.grid.nz!==4||exported.source.centerDepthM!==1.3)throw new Error('Export contract mismatch');
  const diagnostics=document.querySelector('.coupled-diagnostics');if(!diagnostics.open)diagnostics.querySelector('summary').click();
  for(const mode of ['rigid','coupled']){
   select('Coupled comparison',mode);await tick();const run=exported.runs[mode],expected=(run.frames.at(-1).timeS/(run.solveMs/1000)).toFixed(2)+' sim s / wall s';
   const metric=[...document.querySelectorAll('.coupled-diagnostic-grid>div')].find(item=>item.textContent.includes('Measured solve throughput'))?.querySelector('strong');
   if(metric?.textContent!==expected)throw new Error('Wrong selected-model throughput');
   if(!document.body.textContent.includes('10.00 s'))throw new Error('Comparison changed physical replay time');
   if(run.status!=='complete'||run.frames[0].temperatureK.length!==256)throw new Error('Exported frames mismatch');
  }
  console.log('COUPLED_STAGE: comparison/export checked');
  const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw new Error('WebGL unavailable');
  return{cancelMs,rendering:'Demand-driven; no continuous idle FPS claim',webglRenderer:gl.getParameter(gl.RENDERER),resultText:document.body.innerText};
 })()`);
 results.peakApplicationWorkingSetBytes=peak;results.date=new Date().toISOString();
 results.notes='Electron processes on this host. CI explicitly selects Preview,10 physical seconds,Scientific view and rigid-pore comparison. Cancellation measures UI event-to-enabled control. Working sets sum processes; shared pages can be counted twice and compressed/GPU allocations are not fully attributed.';
 fs.writeFileSync(path.join(folder,'native-smoke.json'),JSON.stringify(results,null,2));await new Promise(resolve=>setTimeout(resolve,500));fs.writeFileSync(path.join(folder,'native-coupled.png'),(await win.webContents.capturePage()).toPNG());finish();
 }catch(error){finish(String(error))}});
});
require('../electron/main.cjs');
