import './operations.css'
export type PhysicsWorkspace = 'sequence' | 'comparison' | 'study' | 'simulation' | 'mechanics' | 'coupled' | 'formulas'
export function ModelSelector({ value, onChange }: { value: PhysicsWorkspace; onChange: (value: PhysicsWorkspace) => void }) {
  return <label className="model-selector"><span>App view</span><select aria-label="App view" value={value} onChange={e => onChange(e.target.value as PhysicsWorkspace)}>
    <option value="sequence">Peat fire · complete sequence</option>
    <option value="formulas">Physical formulas · model reference</option>
    <option value="comparison">Version comparison · 0.8 onward</option>
    <option value="coupled">Coupled continuum · 3D research</option>
    <option value="study">Fast demonstration · assumed loading</option>
    <option value="simulation">Porous gas &amp; heat · finite volume</option>
    <option value="mechanics">Soil deformation · FEM benchmark</option>
  </select></label>
}
