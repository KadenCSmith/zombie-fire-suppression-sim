// CI-only browser integration test; never included in release bundles.
const {app}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'version-comparison-smoke-')));
app.getAppPath=()=>path.resolve(__dirname,'..');
process.argv.push('--sequence');
if(process.platform!=='darwin'){app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('enable-unsafe-swiftshader');}
const timeout=setTimeout(()=>{console.error('COMPARISON_SMOKE_TIMEOUT');app.exit(1)},180000);
app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('render-process-gone',(_event,details)=>{console.error(details);app.exit(1)});
  win.webContents.on('console-message',event=>{if(event.message.startsWith('COMPARISON_STAGE:'))console.log(event.message)});
  win.webContents.once('did-finish-load',async()=>{
    try{
      const result=await win.webContents.executeJavaScript(`(async()=>{
        const wait=async(fn,label)=>{for(let i=0;i<1200;i++){if(fn()){console.log('COMPARISON_STAGE: '+label);return;}await new Promise(r=>setTimeout(r,100));}throw new Error(label+' timed out: '+document.body.innerText.slice(-1800));};
        const clickLabel=label=>document.querySelector('input[aria-label="'+label+'"]')?.click();
        const setRange=(label,value)=>{const el=document.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
        await wait(()=>document.querySelector('.fire-sequence-shell')&&document.querySelector('.app-chrome'),'initial workspace ready');
        window.dispatchEvent(new CustomEvent('workspace-request',{detail:'comparison'}));
        await wait(()=>document.querySelector('.comparison-shell')&&document.body.textContent.includes('ANIMATION MODE'),'comparison workspace and mode label');
        if(document.querySelectorAll('.comparison-card').length!==2)throw new Error('Expected two default selected replays');
        if(!document.body.textContent.includes('v0.10.0')||!document.body.textContent.includes('UNAVAILABLE'))throw new Error('Unavailable historical versions are not listed');
        clickLabel('Select version 0.14.0');
        await wait(()=>document.querySelectorAll('.comparison-card').length===3,'third selected replay');
        setRange('Shared comparison time',10);
        await wait(()=>document.querySelector('.comparison-timeline strong')?.textContent.includes('10.0'),'shared timeline seek');
        const before=[...document.querySelectorAll('.comparison-card')].map(card=>card.getAttribute('data-version')).join(',');
        [...document.querySelectorAll('.app-chrome-layout button')].find(button=>button.textContent==='Instrument').click();
        await wait(()=>document.body.dataset.layout==='instrument','instrument layout');
        const after=[...document.querySelectorAll('.comparison-card')].map(card=>card.getAttribute('data-version')).join(',');
        if(before!==after||!document.querySelector('.comparison-timeline strong')?.textContent.includes('10.0'))throw new Error('Layout switch lost comparison state');
        [...document.querySelectorAll('.app-chrome-layout button')].find(button=>button.textContent==='Technical').click();
        await wait(()=>document.body.dataset.layout==='technical','technical layout');
        window.dispatchEvent(new CustomEvent('workspace-request',{detail:'simulation'}));
        await wait(()=>document.querySelector('.app-chrome')?.textContent.includes('PHYSICS SIMULATION MODE'),'physics mode label');
        if(!document.querySelector('.app-chrome')?.textContent.includes('Validation status is reported separately'))throw new Error('Physics validation disclosure missing');
        return 'ok';
      })()`);
      if(result!=='ok')throw new Error('Unexpected comparison smoke result');
      clearTimeout(timeout);console.log('COMPARISON_SMOKE_PASS: catalog availability, multi-replay selection, shared scrubber, layout-state preservation, and mode labels.');app.exit(0);
    }catch(error){console.error(error);clearTimeout(timeout);app.exit(1)}
  });
});
require('../electron/main.cjs');
