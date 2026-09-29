/** Exact overlap of axis-aligned cells over the same domain. Values are extensive
 * (kg, mol, J, m³), never temperatures or mole fractions. No extrapolation. */
export interface GridShape {nx:number;ny:number;nz:number}
export function conservativeRemap(values:Float64Array,from:GridShape,to:GridShape):Float64Array {
  for(const g of [from,to])if(![g.nx,g.ny,g.nz].every(n=>Number.isInteger(n)&&n>0))throw new Error('Positive integer grid required.')
  if(values.length!==from.nx*from.ny*from.nz)throw new Error('Remap grid mismatch.')
  if(from.nx===to.nx&&from.ny===to.ny&&from.nz===to.nz)return values.slice()
  const overlaps=(a:number,b:number)=>Array.from({length:b},(_,j)=>{
    const parts:{i:number;weight:number}[]=[]
    for(let i=Math.floor(j*a/b);i<Math.ceil((j+1)*a/b);i++){
      const width=Math.min((i+1)/a,(j+1)/b)-Math.max(i/a,j/b)
      if(width>0&&i<a)parts.push({i,weight:width*a})
    }
    return parts
  })
  const xs=overlaps(from.nx,to.nx),ys=overlaps(from.ny,to.ny),zs=overlaps(from.nz,to.nz),out=new Float64Array(to.nx*to.ny*to.nz)
  for(let z=0;z<to.nz;z++)for(let y=0;y<to.ny;y++)for(let x=0;x<to.nx;x++){
    let value=0
    for(const a of xs[x])for(const b of ys[y])for(const c of zs[z])value+=values[(c.i*from.ny+b.i)*from.nx+a.i]*a.weight*b.weight*c.weight
    out[(z*to.ny+y)*to.nx+x]=value
  }
  return out
}
