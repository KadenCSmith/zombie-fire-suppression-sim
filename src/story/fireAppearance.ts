import { eased, STORY_CRACK_PATHS, CONSTRAINED_CRACK_PATHS, storyWettingProgress, constrainedWettingProgress, pointAlongStoryPath, type FireSourceMode } from './fireSequence'

/** Authored appearance only. Arrival order is not a combustion calculation. */
export const PEAT_APPEARANCE_GRID = { nx: 200, ny: 80, minX: -4, minY: -3.2, width: 8, height: 3.2, seed: 29173 } as const
export function appearanceRandom(n: number) {
  let x = (n + PEAT_APPEARANCE_GRID.seed) | 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}
function noise(x: number, y: number, scale: number) {
  const a = x * scale, b = y * scale, ix = Math.floor(a), iy = Math.floor(b)
  const sx = a - ix, sy = b - iy, u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy)
  const n = (dx: number, dy: number) => appearanceRandom((ix + dx) * 3719 + (iy + dy) * 7919)
  return (n(0, 0) * (1 - u) + n(1, 0) * u) * (1 - v) + (n(0, 1) * (1 - u) + n(1, 1) * u) * v
}
export function insideIllustratedPeat(x: number, y: number) {
  const u = (x - .5) / 3.1, v = (y + 1.65) / .68
  return Math.hypot(u, v) < 1 + .045 * Math.sin(x * 5.1 + y * 3.7) + .024 * Math.sin(x * 14.3 - y * 12.1)
}
/** A seeded weighted arrival graph makes fingers and sheltered islands while
 * requiring every newly reached pixel to have an earlier connected neighbour.
 * Sorting arrival times gives an explicit sampled area fraction for the trigger.
 */
export function buildPeatAppearance() {
  const g = PEAT_APPEARANCE_GRID, count = g.nx * g.ny
  const mask = new Uint8Array(count), cost = new Float32Array(count), distance = new Float64Array(count).fill(Infinity)
  const arrival = new Float32Array(count).fill(2), predecessor = new Int32Array(count).fill(-1)
  let source = -1, closest = Infinity, peatPixels = 0
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const id = j * g.nx + i, x = g.minX + (i + .5) * g.width / g.nx, y = g.minY + (j + .5) * g.height / g.ny
    if (!insideIllustratedPeat(x, y)) continue
    mask[id] = 1; peatPixels++
    const wetPatch = noise(x + 8, y + 4, 2.4), fine = noise(x + 8, y + 4, 7.7)
    cost[id] = .35 + 8 * wetPatch ** 3 + 2.8 * fine ** 2
    const d = Math.hypot(x - 1.6, y + 1.02)
    if (d < closest) { closest = d; source = id }
  }
  const heap: Array<[number, number]> = []
  const push = (item: [number, number]) => {
    let i = heap.length; heap.push(item)
    while (i) { const parent = (i - 1) >>> 1; if (heap[parent][0] <= item[0]) break; heap[i] = heap[parent]; i = parent }
    heap[i] = item
  }
  const pop = () => {
    const first = heap[0], last = heap.pop()!
    if (heap.length) {
      let i = 0
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++
        if (heap[c][0] >= last[0]) break
        heap[i] = heap[c]; i = c
      }
      heap[i] = last
    }
    return first
  }
  distance[source] = 0; push([0, source])
  const order: number[] = []
  while (heap.length) {
    const [d, id] = pop(); if (d !== distance[id]) continue
    order.push(id)
    const x = id % g.nx, y = Math.floor(id / g.nx)
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= g.nx || yy >= g.ny) continue
      const next = yy * g.nx + xx; if (!mask[next]) continue
      const candidate = d + (cost[id] + cost[next]) * .5 * Math.hypot(dx, dy * 1.8)
      if (candidate < distance[next]) { distance[next] = candidate; predecessor[next] = id; push([candidate, next]) }
    }
  }
  order.forEach((id, rank) => { arrival[id] = (rank + .5) / order.length })
  return { ...g, source, peatPixels, mask, arrival, predecessor }
}

/** Prescribed visual pulse. No pressure, energy or explosive yield is inferred. */
export function storyRupture(time: number, mode: FireSourceMode) {
  if (mode !== 'rapid' || time <= 55) return { pulse: 0, damage: 0 }
  const age = time - 55
  return { pulse: (1 - Math.exp(-12 * age)) * Math.exp(-1.35 * age) * 1.45, damage: eased(time, 55, 55.65) }
}
export function storyRuptureOffset(x: number, y: number, z: number, pulse: number, damage: number): [number, number, number] {
  const strength = Math.exp(-((x - .4) ** 2 / 5.8 + z * z / 5)) * Math.max(0, Math.min(1, (y + 3.2) / 3.2)) ** .65
  return [(x - .4) * (.065 * pulse + .018 * damage) * strength, (.60 * pulse + .11 * damage) * strength, Math.sign(z - .3) * (.07 * pulse + .025 * damage) * strength]
}
export const STORY_RUPTURE_GLSL = `
vec3 storyRuptureOffset(vec3 p,float pulse,float damage){
 float strength=exp(-((p.x-.4)*(p.x-.4)/5.8+p.z*p.z/5.0))*pow(clamp((p.y+3.2)/3.2,0.0,1.0),.65);
 return vec3((p.x-.4)*(.065*pulse+.018*damage),.60*pulse+.11*damage,sign(p.z-.3)*(.07*pulse+.025*damage))*strength;
}
`

/** Authored local wetting halo around the reached part of each shared path. */
export function buildStoryWettingGrid(time: number, constrained = false, mode: FireSourceMode = 'rapid') {
  const width=128,height=64,data=new Float32Array(width*height*4)
  if(time<=72||(constrained&&mode==='gradual'))return {width,height,data}
  const paths=(constrained?CONSTRAINED_CRACK_PATHS:STORY_CRACK_PATHS).map((path,branch)=>{
    const front=constrained?constrainedWettingProgress(time,branch):storyWettingProgress(time,branch)
    return {front,points:Array.from({length:18},(_,i)=>pointAlongStoryPath(path,front*i/17)),radius:constrained?.045+.055*front:.028+.12*Math.sqrt(Math.max(0,Math.min(1,(time-72-branch*.65)/18)))}
  })
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const x=-4+(i+.5)*8/width,y=-3.2+(j+.5)*3.2/height
    let wet=0
    for(const path of paths){if(path.front<=0)continue
      let nearest=Infinity
      for(let k=1;k<path.points.length;k++){
        const a=path.points[k-1],b=path.points[k],dx=b[0]-a[0],dy=b[1]-a[1],f=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy+1e-12)))
        nearest=Math.min(nearest,Math.hypot(x-a[0]-dx*f,y-a[1]-dy*f))
      }
      const radius=path.radius*(.86+.23*Math.sin(x*47+y*31)*Math.sin(x*19-y*43)),q=Math.max(0,Math.min(1,(radius-nearest)/.055))
      wet=Math.max(wet,q*q*(3-2*q))
    }
    data[(j*width+i)*4]=wet;data[(j*width+i)*4+3]=1
  }
  return {width,height,data}
}
