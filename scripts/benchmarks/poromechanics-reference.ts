import {pcg,dot} from '../../src/coupled/linear'
export interface BrickMaterial {youngsPa:number;poisson:number;densityKgM3:number;biot:number;fractureEnergyJm2:number}
export interface MechanicalState {u:Float64Array;strain:Float64Array;stress:Float64Array;damage:Float64Array;elasticJ:number;fractureJ:number;residualN:number;maxStrain:number;iterations:number;maxDamage:number;pressureWorkJ:number}
const NODES=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
/** Jacobi diagonalization of the symmetric tensor, engineering shear convention. */
export function spectral(e:ArrayLike<number>){
  const a=[e[0],e[3]/2,e[5]/2,e[3]/2,e[1],e[4]/2,e[5]/2,e[4]/2,e[2]],v=[1,0,0,0,1,0,0,0,1]
  for(let iteration=0;iteration<16;iteration++){
    let p=0,q=1;if(Math.abs(a[2])>Math.abs(a[1])){p=0;q=2}if(Math.abs(a[5])>Math.abs(a[p*3+q])){p=1;q=2}
    if(Math.abs(a[p*3+q])<1e-15)break
    const angle=0.5*Math.atan2(2*a[p*3+q],a[q*3+q]-a[p*3+p]),c=Math.cos(angle),s=Math.sin(angle)
    for(let k=0;k<3;k++){const ap=a[k*3+p],aq=a[k*3+q];a[k*3+p]=c*ap-s*aq;a[k*3+q]=s*ap+c*aq;const vp=v[k*3+p],vq=v[k*3+q];v[k*3+p]=c*vp-s*vq;v[k*3+q]=s*vp+c*vq}
    for(let k=0;k<3;k++){const ap=a[p*3+k],aq=a[q*3+k];a[p*3+k]=c*ap-s*aq;a[q*3+k]=s*ap+c*aq}
  }
  return {values:[a[0],a[4],a[8]],vectors:v}
}
export function splitElastic(e:ArrayLike<number>,m:BrickMaterial,damage:number){
  const lambda=m.youngsPa*m.poisson/((1+m.poisson)*(1-2*m.poisson)),mu=m.youngsPa/(2*(1+m.poisson)),tr=e[0]+e[1]+e[2],eig=spectral(e),g=(1-damage)**2*(1-1e-6)+1e-6
  const positive=new Float64Array(6),stress=new Float64Array(6);let plus=lambda/2*Math.max(tr,0)**2,minus=lambda/2*Math.min(tr,0)**2
  const pairs=[[0,0],[1,1],[2,2],[0,1],[1,2],[0,2]]
  for(let j=0;j<3;j++){
    const ep=Math.max(0,eig.values[j]),em=Math.min(0,eig.values[j]);plus+=mu*ep*ep;minus+=mu*em*em
    for(let k=0;k<6;k++){const [a,b]=pairs[k],p=2*mu*ep*eig.vectors[a*3+j]*eig.vectors[b*3+j];positive[k]+=p;stress[k]+=g*p+2*mu*em*eig.vectors[a*3+j]*eig.vectors[b*3+j]}
  }
  for(let k=0;k<3;k++){positive[k]+=lambda*Math.max(0,tr);stress[k]+=lambda*(g*Math.max(0,tr)+Math.min(0,tr))}
  return{stress,positive,plus,energy:g*plus+minus,maxStrain:Math.max(...eig.values.map(Math.abs))}
}
interface Element {dofs:Int32Array;material:BrickMaterial;reference:Float64Array[];sigma0:Float64Array[];stiffness:Float64Array}
export class PoroMechanics {
  readonly n:number;readonly nodeCount:number;readonly volume:number;readonly dx:number;readonly dy:number;readonly dz:number
  readonly u:Float64Array;readonly damage:Float64Array;readonly history:Float64Array;readonly fixed:Uint8Array
  readonly elements:Element[]=[];readonly B:Float64Array[]=[];readonly diagonal:Float64Array
  private preloading=false
  geostaticResidualN=0
  private roots:{a:number;b:number;direction:number[];stiffness:number}[]=[]
  constructor(readonly nx:number,readonly ny:number,readonly nz:number,readonly width:number,readonly length:number,readonly depth:number,materials:BrickMaterial[],readonly ell:number,reinforce=false){
    this.n=nx*ny*nz;this.nodeCount=(nx+1)*(ny+1)*(nz+1);this.dx=width/nx;this.dy=length/ny;this.dz=depth/nz;this.volume=this.dx*this.dy*this.dz
    if(materials.length!==this.n||materials.some(m=>m.poisson<0||m.poisson>=0.45||m.youngsPa<=0||m.fractureEnergyJm2<=0)||ell<=0)throw new Error('Invalid poromechanical material/grid.')
    this.u=new Float64Array(3*this.nodeCount);this.fixed=new Uint8Array(this.u.length);this.damage=new Float64Array(this.n);this.history=new Float64Array(this.n);this.diagonal=new Float64Array(this.u.length)
    // Lateral rollers and fixed vertical base: initialized at-rest overburden.
    for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const n=this.node(i,j,k);if(i===0||i===nx)this.fixed[n*3]=1;if(j===0||j===ny)this.fixed[n*3+1]=1;if(k===nz)this.fixed[n*3+2]=1}
    const gauss=[-1/Math.sqrt(3),1/Math.sqrt(3)]
    for(const zeta of gauss)for(const eta of gauss)for(const xi of gauss){
      const b=new Float64Array(144)
      for(let a=0;a<8;a++){const sx=NODES[a][0]?1:-1,sy=NODES[a][1]?1:-1,sz=NODES[a][2]?1:-1,gx=sx*(1+sy*eta)*(1+sz*zeta)/(4*this.dx),gy=sy*(1+sx*xi)*(1+sz*zeta)/(4*this.dy),gz=sz*(1+sx*xi)*(1+sy*eta)/(4*this.dz),c=3*a
        b[c]=gx;b[24+c+1]=gy;b[48+c+2]=gz;b[72+c]=gy;b[72+c+1]=gx;b[96+c+1]=gz;b[96+c+2]=gy;b[120+c]=gz;b[120+c+2]=gx}
      this.B.push(b)
    }
    const cache=new Map<string,Float64Array>()
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const id=(k*ny+j)*nx+i,m=materials[id],key=`${m.youngsPa}:${m.poisson}`,dofs=new Int32Array(24)
      for(let a=0;a<8;a++)for(let c=0;c<3;c++)dofs[a*3+c]=3*this.node(i+NODES[a][0],j+NODES[a][1],k+NODES[a][2])+c
      let stiffness=cache.get(key)
      if(!stiffness){stiffness=new Float64Array(576);const lambda=m.youngsPa*m.poisson/((1+m.poisson)*(1-2*m.poisson)),mu=m.youngsPa/(2*(1+m.poisson))
        for(const b of this.B)for(let a=0;a<24;a++)for(let c=0;c<24;c++){let value=0;for(let r=0;r<6;r++)for(let s=0;s<6;s++){const d=r<3&&s<3?lambda+(r===s?2*mu:0):r===s?mu:0;value+=b[r*24+a]*d*b[s*24+c]}stiffness[a*24+c]+=value*this.volume/8}cache.set(key,stiffness)}
      const reference=Array.from({length:8},()=>new Float64Array(6)),sigma0=Array.from({length:8},()=>new Float64Array(6))
      this.elements.push({dofs,material:m,reference,sigma0,stiffness})
    }
    if(reinforce){
      // Embedded axial root elements; explicit, uncalibrated EA, bonded to nearby nodes.
      const center=this.node(Math.round(nx*0.27),Math.round(ny*0.5),0)
      for(let r=0;r<8;r++){const angle=r*Math.PI/4+0.13*Math.sin(r*7),i=Math.max(1,Math.min(nx-1,Math.round(nx*(0.27+0.23*Math.cos(angle))))),j=Math.max(1,Math.min(ny-1,Math.round(ny*(0.5+0.24*Math.sin(angle))))),k=Math.max(1,Math.round(nz*(0.35+0.3*(r%3)/2))),b=this.node(i,j,k),aPos=this.position(center),bPos=this.position(b),vec=bPos.map((v,c)=>v-aPos[c]),l=Math.hypot(...vec)
        this.roots.push({a:center,b,direction:vec.map(v=>v/l),stiffness:1e8*Math.PI*0.012**2/l})}
    }
    // Resolve heterogeneous gravity with this actual FE operator and supports.
    this.preloading=true
    const preload=this.solve(new Float64Array(this.n));this.geostaticResidualN=preload.residualN
    this.elements.forEach(e=>{for(let gp=0;gp<8;gp++){const b=this.B[gp],eps=e.reference[gp];for(let r=0;r<6;r++)for(let a=0;a<24;a++)eps[r]+=b[r*24+a]*this.u[e.dofs[a]];e.sigma0[gp]=splitElastic(eps,e.material,0).stress}})
    this.u.fill(0);this.preloading=false

  }
  node(i:number,j:number,k:number){return(k*(this.ny+1)+j)*(this.nx+1)+i}
  position(n:number){return[(n%(this.nx+1))*this.dx,(Math.floor(n/(this.nx+1))%(this.ny+1))*this.dy,Math.floor(n/((this.nx+1)*(this.ny+1)))*this.dz]}
  private stiffnessScale(e:number){return Math.max(0.02,(1-this.damage[e])**2)}
  private multiply(x:Float64Array,y:Float64Array){
    y.fill(0)
    this.elements.forEach((e,id)=>{const scale=this.stiffnessScale(id);for(let a=0;a<24;a++){const ga=e.dofs[a];if(this.fixed[ga])continue;let sum=0;for(let b=0;b<24;b++)if(!this.fixed[e.dofs[b]])sum+=e.stiffness[a*24+b]*x[e.dofs[b]];y[ga]+=scale*sum}})
    for(const r of this.roots){let extension=0;for(let c=0;c<3;c++)extension+=(x[r.b*3+c]-x[r.a*3+c])*r.direction[c];for(let c=0;c<3;c++){const f=r.stiffness*extension*r.direction[c];if(!this.fixed[r.a*3+c])y[r.a*3+c]-=f;if(!this.fixed[r.b*3+c])y[r.b*3+c]+=f}}
    for(let i=0;i<y.length;i++)if(this.fixed[i])y[i]=x[i]
  }
  private state(u:Float64Array){
    const internal=new Float64Array(u.length),strain=new Float64Array(this.n*6),stress=new Float64Array(this.n*6),positive=new Float64Array(this.n)
    let elasticJ=0,maxStrain=0
    this.elements.forEach((e,id)=>{for(let gp=0;gp<8;gp++){const b=this.B[gp],eps=e.reference[gp].slice(),delta=new Float64Array(6)
      for(let r=0;r<6;r++)for(let a=0;a<24;a++)delta[r]+=b[r*24+a]*u[e.dofs[a]]
      for(let r=0;r<6;r++)eps[r]+=delta[r]
      const value=splitElastic(eps,e.material,this.damage[id]),ref=splitElastic(e.reference[gp],e.material,0)
      elasticJ+=(value.energy-ref.energy-dot(e.sigma0[gp],delta))*this.volume/8
      positive[id]+=value.plus/8;maxStrain=Math.max(maxStrain,...spectral(delta).values.map(Math.abs))
      for(let r=0;r<6;r++){strain[id*6+r]+=delta[r]/8;stress[id*6+r]+=value.stress[r]/8}
      for(let a=0;a<24;a++)for(let r=0;r<6;r++)internal[e.dofs[a]]+=b[r*24+a]*(value.stress[r]-e.sigma0[gp][r])*this.volume/8
    }})
    for(const r of this.roots){let extension=0;for(let c=0;c<3;c++)extension+=(u[r.b*3+c]-u[r.a*3+c])*r.direction[c];elasticJ+=0.5*r.stiffness*extension*extension;for(let c=0;c<3;c++){const f=r.stiffness*extension*r.direction[c];internal[r.a*3+c]-=f;internal[r.b*3+c]+=f}}
    return{internal,strain,stress,positive,elasticJ,maxStrain}
  }
  private damageSolve(lower:Float64Array){
    const neighbors=(i:number)=>{const x=i%this.nx,y=Math.floor(i/this.nx)%this.ny,z=Math.floor(i/(this.nx*this.ny));return[[x>0?i-1:-1,this.dx],[x+1<this.nx?i+1:-1,this.dx],[y>0?i-this.nx:-1,this.dy],[y+1<this.ny?i+this.nx:-1,this.dy],[z>0?i-this.nx*this.ny:-1,this.dz],[z+1<this.nz?i+this.nx*this.ny:-1,this.dz]]}
    for(let sweep=0;sweep<2000;sweep++){let change=0
      for(let i=0;i<this.n;i++){const gc=this.elements[i].material.fractureEnergyJm2;let rhs=2*this.history[i],diag=gc/this.ell+rhs
        for(const[j,h]of neighbors(i))if(j>=0){const gj=this.elements[j].material.fractureEnergyJm2,c=2*gc*gj/(gc+gj)*this.ell/(h*h);diag+=c;rhs+=c*this.damage[j]}
        const next=Math.max(lower[i],Math.min(1,rhs/diag));change=Math.max(change,Math.abs(next-this.damage[i]));this.damage[i]=next}
      if(change<1e-9)return
    }
    throw new Error('Phase-field iteration failed to converge.')
  }
  fractureEnergy(){let total=0;for(let i=0;i<this.n;i++){const gc=this.elements[i].material.fractureEnergyJm2;total+=gc*this.damage[i]**2/(2*this.ell)*this.volume
    const x=i%this.nx,y=Math.floor(i/this.nx)%this.ny,z=Math.floor(i/(this.nx*this.ny));for(const[j,h]of [[x+1<this.nx?i+1:-1,this.dx],[y+1<this.ny?i+this.nx:-1,this.dy],[z+1<this.nz?i+this.nx*this.ny:-1,this.dz]])if(j>=0){const gj=this.elements[j].material.fractureEnergyJm2;total+=gc*gj/(gc+gj)*this.ell*(this.damage[i]-this.damage[j])**2/(h*h)*this.volume}}
    return total}
  solve(pressureIncrement:Float64Array,fracture=false,topTractionPa=0):MechanicalState{
    if(pressureIncrement.length!==this.n)throw new Error('Pressure grid mismatch.')
    const oldU=this.u.slice(),oldD=this.damage.slice(),oldH=this.history.slice(),force=new Float64Array(this.u.length)
    this.elements.forEach((e,id)=>{for(const b of this.B)for(let a=0;a<24;a++)force[e.dofs[a]]+=e.material.biot*pressureIncrement[id]*(b[a]+b[24+a]+b[48+a])*this.volume/8})
    for(let j=0;j<this.ny;j++)for(let i=0;i<this.nx;i++)for(const[a,b]of[[i,j],[i+1,j],[i,j+1],[i+1,j+1]])force[3*this.node(a,b,0)+2]+=topTractionPa*this.dx*this.dy/4
    if(this.preloading)this.elements.forEach(e=>{for(let a=0;a<8;a++)force[e.dofs[3*a+2]]+=e.material.densityKgM3*9.80665*this.volume/8})
    let iterations=0,residualN=0
    try{
      for(let outer=0;outer<(fracture?40:1);outer++){
        this.diagonal.fill(0);this.elements.forEach((e,id)=>{for(let a=0;a<24;a++)this.diagonal[e.dofs[a]]+=this.stiffnessScale(id)*e.stiffness[a*24+a]})
        for(const r of this.roots)for(let c=0;c<3;c++){this.diagonal[r.a*3+c]+=r.stiffness*r.direction[c]**2;this.diagonal[r.b*3+c]+=r.stiffness*r.direction[c]**2}for(let i=0;i<this.u.length;i++)if(this.fixed[i])this.diagonal[i]=1
        for(let iter=0;iter<200;iter++){
          const state=this.state(this.u),residual=Float64Array.from(force,(f,i)=>this.fixed[i]?0:f-state.internal[i]);residualN=Math.max(...residual.map(Math.abs));iterations++
          if(residualN<1e-5)break
          const correction=new Float64Array(this.u.length);pcg((x,y)=>this.multiply(x,y),residual,this.diagonal,correction,Math.max(1e-9,residualN*1e-7))
          const potential=state.elasticJ-dot(force,this.u),u=this.u.slice(),slope=dot(residual,correction);let accepted=false
          for(let factor=1;factor>=1/65536;factor/=2){for(let i=0;i<u.length;i++)this.u[i]=u[i]+factor*correction[i];const next=this.state(this.u)
            if(next.elasticJ-dot(force,this.u)<=potential-1e-4*factor*slope+1e-10){accepted=true;break}}
          if(!accepted||iter===199)throw new Error('Mechanical equilibrium failed; last accepted state retained.')
        }
        if(!fracture)break
        const state=this.state(this.u),before=this.damage.slice();for(let i=0;i<this.n;i++)this.history[i]=Math.max(this.history[i],state.positive[i]);this.damageSolve(oldD)
        let change=0;for(let i=0;i<this.n;i++)change=Math.max(change,Math.abs(before[i]-this.damage[i]));if(change<1e-7)break;if(outer===39)throw new Error('Staggered fracture convergence failed.')
      }
      const state=this.state(this.u);residualN=0;for(let i=0;i<this.u.length;i++)if(!this.fixed[i])residualN=Math.max(residualN,Math.abs(state.internal[i]-force[i]))
      if(state.maxStrain>0.02)throw new Error('2% incremental principal strain exceeded: finite-deformation/contact discretization required.')
      if(residualN>1e-4)throw new Error(`Mechanical residual ${residualN} N exceeds acceptance.`)
      return{u:this.u.slice(),strain:state.strain,stress:state.stress,damage:this.damage.slice(),elasticJ:state.elasticJ,fractureJ:this.fractureEnergy(),residualN,maxStrain:state.maxStrain,iterations,maxDamage:Math.max(...this.damage),pressureWorkJ:dot(force,this.u)}
    }catch(error){this.u.set(oldU);this.damage.set(oldD);this.history.set(oldH);throw error}
  }
}
