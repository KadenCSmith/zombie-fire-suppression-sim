import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { CatmullRomCurve3, Vector3 } from 'three';
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
try {
  const sequence = await server.ssrLoadModule('/src/story/fireSequence.ts');
  const sampleHose=time=>new CatmullRomCurve3(sequence.storyHosePoints(time).map(p=>new Vector3(...p)),false,'centripetal').getSpacedPoints(180).map(p=>p.toArray());
  const { buildPeatAppearance } = await server.ssrLoadModule('/src/story/fireAppearance.ts');
  const { mask, arrival, predecessor, ...grid } = buildPeatAppearance();
  await writeFile('public/fire-appearance.json', JSON.stringify({ schemaVersion: 1, role: 'Seeded connected illustrative arrival order; not a combustion calculation', ...grid, mask: Array.from(mask), arrival: Array.from(arrival), predecessor: Array.from(predecessor) }) + '\n');
  await writeFile('public/fire-sequence-contract.json', JSON.stringify({ schemaVersion: 1, role: 'Authored geometry, wetting schedule and mechanisms; not a solved fracture/infiltration model', coordinates: '[x, vertical y, z] in metres; Blender uses [x,-z,y]', geometry: sequence.FIRE_SEQUENCE_GEOMETRY, crackPaths: sequence.STORY_CRACK_PATHS, hosePoints: sequence.STORY_HOSE_POINTS, hoseCurve:{kind:'centripetal Catmull-Rom, 181 equal arc-length samples',placed:sampleHose(72),carried:sampleHose(69),insertionFrames:Array.from({length:31},(_,i)=>({timeS:69+i/10,points:sampleHose(69+i/10)}))}, waterStartS: sequence.STORY_WATER_START, poseFrames: Array.from({length:901},(_,i)=>{const time=i/10;return {timeS:time, gradual:sequence.fireSequencePose(time,'gradual'),rapid:sequence.fireSequencePose(time,'rapid'),gradualCap:sequence.storyCapShape(time,'gradual'),rapidCap:sequence.storyCapShape(time,'rapid'),hosePoints:sequence.storyHosePoints(time),wetting:sequence.STORY_CRACK_PATHS.map((_,index)=>sequence.storyWettingProgress(time,index))}}) }) + '\n');
  await writeFile('integrations/blender-study/fire-sequence/storyboard.json', JSON.stringify({duration:sequence.FIRE_SEQUENCE_DURATION,geometry:sequence.FIRE_SEQUENCE_GEOMETRY,stages:sequence.FIRE_SEQUENCE_STAGES},null,2)+'\n');
  const contact=await server.ssrLoadModule('/src/story/contactCooling.ts');
  await writeFile('public/contact-cooling.json',JSON.stringify({schemaVersion:1,role:'Separate uncalibrated open contact calorimeter; assumed wetting; no feedback into accepted fire fields',config:contact.CONTACT_COOLING_CONFIG,modes:Object.fromEntries(['gradual','rapid'].map(mode=>[mode,Array.from({length:361},(_,i)=>contact.contactCoolingState(i/4,mode))]))})+'\n');
  console.log(`Exported ${grid.peatPixels} illustrated peat pixels on a ${grid.nx}×${grid.ny} appearance grid.`);
} finally { await server.close(); }
