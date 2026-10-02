import './operations.css'
export type PhysicsWorkspace = 'sequence' | 'peat-fem' | 'comparison' | 'study' | 'simulation' | 'mechanics' | 'coupled' | 'formulas'
export const HISTORICAL_WORKSPACES: { id: PhysicsWorkspace; title: string; detail: string }[] = [
  { id: 'coupled', title: 'Historical coupled continuum', detail: 'Preserved FEA / FVM research workspace' },
  { id: 'simulation', title: 'Historical porous gas & heat', detail: 'Preserved finite-volume transport workspace' },
  { id: 'mechanics', title: 'Historical soil mechanics & tensile lab', detail: 'Preserved finite-element mechanics benchmarks' },
  { id: 'study', title: 'Historical fast demonstration', detail: 'Preserved authored loading and rupture scene' },
]
export function ModelSelector({ value, onChange }: { value: PhysicsWorkspace; onChange: (value: PhysicsWorkspace) => void }) {
  return <label className="model-selector"><span>App view</span><select aria-label="App view" value={value} onChange={e => onChange(e.target.value as PhysicsWorkspace)}>
    <option value="sequence">Peat fire · complete sequence</option>
    <option value="peat-fem">Peat Fire FEM · active baseline</option>
    <option value="formulas">Physical formulas · model reference</option>
    <option value="comparison">Version comparison · 0.8 onward</option>
    <option value="coupled">Coupled continuum · 3D research</option>
    <option value="study">Fast demonstration · assumed loading</option>
    <option value="simulation">Porous gas &amp; heat · finite volume</option>
    <option value="mechanics">Soil deformation · FEM benchmark</option>
  </select></label>
}
