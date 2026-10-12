import { capabilities, parameterProvenance } from './model'
export function MethodScience() {
  return <section data-method-science="4.2.4">
    <h3>4.2.4 · Vibratory drilling + continuous injection</h3>
    <p>Illustrative drill motion and blue liquid markers run together. The separate physical comparison supplies finite water continuously to three independent hot specimens. It does not calculate infiltration or predict a treated peat field.</p>
    <p>Modeled: {capabilities.modeled.join('; ')}. Experimentally validated: no. Loosening and compaction are competing hypotheses. No mechanical coupling changes permeability, oxygen or heat transfer.</p>
    <p><code>C = m cₚ; Q = (Tₚ − T𝓌)/(1/Cₚ + 1/C𝓌) × [1 − exp(−UA(1/Cₚ + 1/C𝓌) Δt)]</code>. Sensible exchange stops at 373.15 K before finite latent transfer. Water mass and vapor enthalpy remain in separate ledgers; no extra vibration energy or cooling is credited.</p>
    <p>Default supply: 0.5 kg at 0.025 kg/s from physical time 0, depleted at 20 s. Water starts at 293.15 K; each 0.5 kg specimen starts at 823.15 K. UA = 24 W/K per specimen is an assumption. Authored scene seconds have no mapping to physical contact seconds.</p>
    <details><summary>Parameter assumptions and units</summary><ul>{parameterProvenance.map(p => <li key={p.key}><strong>{p.key}</strong> · {p.default} {p.unit}. {p.basis}</li>)}</ul></details>
    <p>Unavailable: {capabilities.unavailable.join('; ')}. Lower specimen temperature cannot establish suppression, re-ignition resistance or an advantage from vibration.</p>
    <p>Reference water properties: <a href="https://iapws.org/technical-guidance/release/IAPWS-95" target="_blank" rel="noreferrer">IAPWS-95</a> and <a href="https://www.nist.gov/srd/nistir-5078" target="_blank" rel="noreferrer">NIST water/steam tables</a>. The existing constant-property approximation is retained; a full equation of state is not implemented.</p>
    <p><a href="https://doi.org/10.1029/2002WR001302" target="_blank" rel="noreferrer">Price (2003)</a> documents deformation-related hydraulic changes in peat. This is context for testing competing hypotheses, not a vibration calibration.</p>
    <p>Proposed, unperformed validation: measure mass and temperature balances first; then compare matched peat specimens with and without vibration, measuring deformation and conductivity separately. Keep calibration and validation data separate. No experimental result is claimed.</p>
    <p>Preliminary water-only cost example: <a href="https://www.ebmud.com/water/water-rates" target="_blank" rel="noreferrer">EBMUD other-use rate</a>, USD 9.07 per 100 cubic feet effective July 1, 2026. At approximately 2832 kg per unit, the default 0.5 kg supply costs about USD 0.0016 in volumetric water alone. This excludes service fees, energy, equipment and labor; no drilling-system total or operating-energy saving is available.</p>
  </section>
}
