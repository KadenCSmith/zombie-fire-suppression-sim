/** Authored treatment choreography. These values never enter the field solver.
 * Seconds, amplitudes and wetting extent are display choices, not predictions. */
const smooth=(a:number,b:number,t:number)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x)}
export function treatmentVisual(time:number,enabled=true,vibration=true) {
  const t=Number.isFinite(time)?Math.max(0,time):0
  const feed=smooth(24,31,t),active=enabled&&t>=25&&t<54
  const shake=vibration&&active?smooth(25,27,t)*(1-smooth(50,54,t)):0
  const wet=enabled?smooth(28,53,t):0
  return {feed,active,shake,wet,fire:1-wet,settled:smooth(50,57,t),
    displacementX:shake*(Math.sin(t*31)+.4*Math.sin(t*47))*.025,
    displacementY:shake*Math.sin(t*37)*.012}
}

/** Distinct visual outlets spaced along the inserted shaft, as in the sketch. */
export function injectionLevels(depth:number) {
  return [.22,.46,.70,.94].map(f=>-Math.max(0,depth)*f)
}
