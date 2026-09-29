/** Assembles the unchanged 8-node brick operator once into compact sparse rows.
 * No precision reduction or integration approximation. Fixed DOFs are eliminated
 * symmetrically; their rows are identity. Root trusses remain in the caller. */
export class SparseBrickOperator {
 readonly starts:Int32Array;readonly columns:Int32Array;readonly values:Float64Array
 constructor(nx:number,ny:number,nz:number,fixed:Uint8Array,elements:ReadonlyArray<{dofs:Int32Array;stiffness:Float64Array}>){
  const nodeX=nx+1,nodeXY=(nx+1)*(ny+1),size=fixed.length,slots=81,assembled=new Float64Array(size*slots)
  for(const e of elements)for(let a=0;a<24;a++){
   const row=e.dofs[a];if(fixed[row])continue
   const na=Math.floor(row/3),ax=na%nodeX,ay=Math.floor(na/nodeX)%(ny+1),az=Math.floor(na/nodeXY)
   for(let b=0;b<24;b++){
    const col=e.dofs[b];if(fixed[col])continue
    const nb=Math.floor(col/3),dx=nb%nodeX-ax,dy=Math.floor(nb/nodeX)%(ny+1)-ay,dz=Math.floor(nb/nodeXY)-az
    assembled[row*slots+((dz+1)*9+(dy+1)*3+dx+1)*3+col%3]+=e.stiffness[a*24+b]
   }
  }
  this.starts=new Int32Array(size+1);let count=0
  for(let row=0;row<size;row++){this.starts[row]=count;if(fixed[row])count++;else for(let k=0;k<slots;k++)if(assembled[row*slots+k]!==0)count++}
  this.starts[size]=count;this.columns=new Int32Array(count);this.values=new Float64Array(count)
  for(let row=0;row<size;row++){
   let at=this.starts[row];if(fixed[row]){this.columns[at]=row;this.values[at]=1;continue}
   const node=Math.floor(row/3)
   for(let k=0;k<slots;k++){
    const value=assembled[row*slots+k];if(value===0)continue
    const neighbor=Math.floor(k/3),dx=neighbor%3-1,dy=Math.floor(neighbor/3)%3-1,dz=Math.floor(neighbor/9)-1
    const other=node+dx+dy*nodeX+dz*nodeXY
    if(other<0||other>=(nx+1)*(ny+1)*(nz+1))throw new Error('Sparse brick connectivity outside mesh.')
    this.columns[at]=other*3+k%3;this.values[at++]=value
   }
  }
 }
 apply(x:Float64Array,y:Float64Array){
  if(x.length!==this.starts.length-1||y.length!==x.length)throw new Error('Sparse vector mismatch.')
  for(let row=0;row<x.length;row++){let sum=0;for(let j=this.starts[row];j<this.starts[row+1];j++)sum+=this.values[j]*x[this.columns[j]];y[row]=sum}
 }
 get bytes(){return this.starts.byteLength+this.columns.byteLength+this.values.byteLength}
}
