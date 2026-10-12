import { capabilities, parameterProvenance } from './model'
export function MethodScience() {
  return <section data-method-science="4.2.4">
    <h3>4.2.4 · Vibratory drilling</h3>
    <p>The current method is vibration only. It retains the original fire-spreading and drilling animation in one continuous world. The context holds at the inserted drill; authored oscillation and dust illustrate the concept. The requested ending depicts fractures, compression/rearrangement, settling and fading embers. This is a concept illustration, not calculated soil failure or extinction.</p>
    <p>No physical vibration calculation or treatment comparison is available. Display motion does not calculate forces, strain, mechanical work, heat, oxygen transport, permeability change or suppression. No calculated extinction or re-ignition result is claimed.</p>
    <p>A supported model requires a stated physical forcing boundary, work and energy coupling, measured cyclic peat constitutive and damping behavior across moisture, density and frequency ranges, and independent response measurements. These inputs have not been supplied. No constitutive constants or favorable permeability changes are invented.</p>
    <p><a href="https://doi.org/10.1029/2002WR001302" target="_blank" rel="noreferrer">Price (2003)</a> provides measured peat deformation and hydraulic-conductivity context; it does not calibrate a vibration mechanism.</p>
    <details><summary>Presentation assumptions</summary><ul>{parameterProvenance.map(p => <li key={p.key}><strong>{p.key}</strong> · {p.default} {p.unit}. {p.basis}</li>)}</ul></details>
    <p>Unavailable: {capabilities.unavailable.join('; ')}. Experimentally validated: no.</p>
    <p>The prior liquid/contact experiment and its numerical evidence are retained as inactive historical material. They do not describe the current vibration-only method and do not validate vibration.</p>
  </section>
}
