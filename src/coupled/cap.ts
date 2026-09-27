/** Axisymmetric shallow-shell Ritz model, coupled by work-conjugate quadrature.
 * w=q(1-r²/a²)²; radial v=b(r/a)(1-r²/a²). Bending + membrane strain energy
 * eliminate b. Rigid rim translation has tensile anchors and unilateral bedding.
 * This is a reduced shell, not a general triangulated shell/contact solver. */
export interface CapParameters {radiusM:number;riseM:number;thicknessM:number;youngsPa:number;poisson:number;densityKgM3:number;anchorNm:number;contactNm:number}
export const DEFAULT_CAP:CapParameters={radiusM:0.475,riseM:0.1,thicknessM:0.005,youngsPa:200e9,poisson:0.3,densityKgM3:7850,anchorNm:1e8,contactNm:1e9}
export interface CapState {rimM:number;flexM:number;gapM:number;contactN:number;anchorN:number;pressureForceN:number;energyJ:number;centerUpM:number;maxStrain:number}
interface Sample {cell:number;area:number;mode:number;nodes:number[];weights:number[]}
export class CapShell {
 readonly area:number;readonly mass:number;readonly stiffness:number;readonly radialRatio:number;readonly initialRim:number;readonly initialFlex:number
 readonly samples:Sample[]=[];readonly ring=new Map<number,number>();readonly covered:Float64Array;readonly n:number;readonly nodeCount:number
 constructor(readonly nx:number,readonly ny:number,readonly nz:number,readonly width:number,readonly length:number,readonly centerX:number,readonly centerY:number,readonly parameters:CapParameters=DEFAULT_CAP){
  const p=parameters;if(p.radiusM<=0||p.thicknessM<=0||p.youngsPa<=0||p.poisson<0||p.poisson>=0.49||p.anchorNm<=0||p.contactNm<=0)throw new Error('Invalid cap parameters.')
  if(p.riseM<0||p.riseM/p.radiusM>0.3)throw new Error('Cap rise/radius exceeds the supported shallow-shell ratio 0.3.')
  if(centerX-p.radiusM<0||centerX+p.radiusM>width||centerY-p.radiusM<0||centerY+p.radiusM>length)throw new Error('Cap footprint outside the top boundary.')
  this.n=nx*ny*nz;this.nodeCount=(nx+1)*(ny+1)*(nz+1);this.covered=new Float64Array(this.n);this.area=Math.PI*p.radiusM**2
  this.mass=this.area*p.thicknessM*p.densityKgM3 // projected-area thin-shell mass approximation
  const a=p.radiusM,curvature=2*p.riseM/a**2,D=p.youngsPa*p.thicknessM**3/(12*(1-p.poisson**2)),C=p.youngsPa*p.thicknessM/(1-p.poisson**2)
  let kqq=0,kqb=0,kbb=0
  // Midpoint radial quadrature; shell coefficients integrate smooth polynomials.
  for(let i=0;i<512;i++){const r=a*(i+0.5)/512,x=r/a,psi=(1-x*x)**2,deriv=(-4*x+4*x**3)/a,second=(-4+12*x*x)/a**2,vr=(1-3*x*x)/a,vt=(1-x*x)/a,eq=curvature*psi,w=2*Math.PI*r*a/512
    kqq+=w*(C*2*(1+p.poisson)*eq**2+D*(second**2+(deriv/r)**2+2*p.poisson*second*deriv/r));kqb+=w*C*(1+p.poisson)*eq*(vr+vt);kbb+=w*C*(vr*vr+vt*vt+2*p.poisson*vr*vt)}
  this.stiffness=kqq-kqb*kqb/kbb;this.radialRatio=-kqb/kbb
  this.initialRim=-this.mass*9.80665/(p.anchorNm+p.contactNm);this.initialFlex=-this.mass*9.80665/(3*this.stiffness)
  const interpolate=(x:number,y:number)=>{const fx=x/width*nx,fy=y/length*ny,i=Math.min(nx-1,Math.floor(fx)),j=Math.min(ny-1,Math.floor(fy)),u=fx-i,v=fy-j;return{cell:j*nx+i,nodes:[j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i,(j+1)*(nx+1)+i+1],weights:[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]}}
  // Equal-area radial integration gives exact total covered area even below grid spacing.
  const radial=24,angular=64
  for(let r=0;r<radial;r++)for(let j=0;j<angular;j++){const rho=a*Math.sqrt((r+0.5)/radial),theta=2*Math.PI*(j+0.5)/angular,s=interpolate(centerX+rho*Math.cos(theta),centerY+rho*Math.sin(theta)),area=this.area/(radial*angular),mode=(1-(rho/a)**2)**2
    this.samples.push({...s,area,mode});this.covered[s.cell]+=area}
  for(let j=0;j<angular;j++){const angle=2*Math.PI*j/angular,s=interpolate(centerX+a*Math.cos(angle),centerY+a*Math.sin(angle));for(let k=0;k<4;k++)this.ring.set(s.nodes[k],(this.ring.get(s.nodes[k])??0)+s.weights[k]/angular)}
 }
 preload(){const force=new Float64Array(this.nodeCount*3);for(const[n,w]of this.ring)force[n*3+2]=this.mass*9.80665*w;return force}
 evaluate(gauge:Float64Array,u?:Float64Array){
  const force=new Float64Array(this.nodeCount*3),volume=new Float64Array(this.n);let pressureForce=0,modalForce=0,rimUp=0
  if(u)for(const[n,w]of this.ring)rimUp-=w*u[n*3+2]
  for(const s of this.samples){const f=gauge[s.cell]*s.area;pressureForce+=f;modalForce+=f*s.mode;for(let k=0;k<4;k++)force[s.nodes[k]*3+2]+=f*s.weights[k]}
  for(const[n,w]of this.ring)force[n*3+2]-=pressureForce*w
  const p=this.parameters,load=pressureForce-this.mass*9.80665,rim=load/(load<0?p.anchorNm+p.contactNm:p.anchorNm),flex=(modalForce-this.mass*9.80665/3)/this.stiffness,dg=rim-this.initialRim,dq=flex-this.initialFlex
  for(const s of this.samples){let surfaceUp=0;if(u)for(let k=0;k<4;k++)surfaceUp-=s.weights[k]*u[s.nodes[k]*3+2];volume[s.cell]+=s.area*(dg+rimUp-surfaceUp+s.mode*dq)}
  const contactEnergy=(z:number)=>0.5*p.anchorNm*z*z+0.5*p.contactNm*Math.min(z,0)**2
  const energy=contactEnergy(rim)-contactEnergy(this.initialRim)+this.mass*9.80665*dg+0.5*this.stiffness*dq*dq
  const maxStrain=Math.abs(dq)*(2*p.riseM/p.radiusM**2+6*p.thicknessM/p.radiusM**2)+Math.abs(this.radialRatio*dq)*3/p.radiusM
  if(maxStrain>0.01||Math.abs(dq)>0.05*p.radiusM||Math.abs(dg)>0.01)throw new Error('Cap exceeded shallow-shell displacement/strain support.')
  const state:CapState={rimM:dg,flexM:dq,gapM:Math.max(0,rim),contactN:Math.max(0,-p.contactNm*Math.min(0,rim)),anchorN:p.anchorNm*rim,pressureForceN:pressureForce,energyJ:energy,centerUpM:rimUp+dg+dq,maxStrain}
  return{force,volume,state}
 }
}
