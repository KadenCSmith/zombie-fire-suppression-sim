import './operations.css'
export type PhysicsWorkspace = 'study' | 'simulation' | 'mechanics' | 'coupled'
export function ModelSelector({ value, onChange }: { value: PhysicsWorkspace; onChange: (value: PhysicsWorkspace) => void }) {
  return <label className="model-selector"><span>Physics model</span><select aria-label="Physics model" value={value} onChange={e => onChange(e.target.value as PhysicsWorkspace)}>
    <option value="coupled">Coupled continuum · 3D research</option>
    <option value="study">Fast demonstration · assumed loading</option>
    <option value="simulation">Porous gas &amp; heat · finite volume</option>
    <option value="mechanics">Soil deformation · FEM benchmark</option>
  </select></label>
}
