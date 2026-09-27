export function dot(a: Float64Array,b: Float64Array) {let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s}
/** Reusable matrix-free Jacobi PCG. The caller supplies an SPD operator. */
export function pcg(apply:(x:Float64Array,y:Float64Array)=>void, rhs:Float64Array, diagonal:Float64Array, x:Float64Array, tolerance:number, limit=2000) {
  const r=new Float64Array(x.length),z=new Float64Array(x.length),p=new Float64Array(x.length),q=new Float64Array(x.length)
  apply(x,q);let norm=0
  for(let i=0;i<x.length;i++){r[i]=rhs[i]-q[i];p[i]=z[i]=r[i]/diagonal[i];norm=Math.max(norm,Math.abs(r[i]))}
  let rz=dot(r,z),iterations=0
  while(norm>tolerance&&iterations<limit){
    apply(p,q);const denominator=dot(p,q)
    if(!(denominator>0))throw new Error('Operator lost positive definiteness.')
    const alpha=rz/denominator;norm=0
    for(let i=0;i<x.length;i++){x[i]+=alpha*p[i];r[i]-=alpha*q[i];z[i]=r[i]/diagonal[i];norm=Math.max(norm,Math.abs(r[i]))}
    const next=dot(r,z),beta=next/rz;rz=next
    for(let i=0;i<x.length;i++)p[i]=z[i]+beta*p[i]
    iterations++
  }
  apply(x,q);norm=0;for(let i=0;i<x.length;i++)norm=Math.max(norm,Math.abs(rhs[i]-q[i]))
  if(norm>tolerance*2||!Number.isFinite(norm))throw new Error(`Linear convergence failed: ${norm}, tolerance ${tolerance}.`)
  return {iterations,residual:norm}
}
