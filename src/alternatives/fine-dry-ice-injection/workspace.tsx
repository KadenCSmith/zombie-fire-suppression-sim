import { AlternativeScene } from '../../ui/AlternativeScene'
import { PARTICLE_PENDING } from './config'
export default function ParticleWorkspace({ onCompare, onDetails }: { onCompare: () => void; onDetails: () => void }) {
  return <main className="method-render" data-render-variant="nanoparticles" data-particle-model="pending">
    <header style={{ padding: '110px 4vw 16px' }}><small>4.2.2 / SOLID INERT GAS NANO PARTICLES</small><h1>Water + fine dry-ice particle injection</h1><p>{PARTICLE_PENDING}</p><button onClick={onCompare}>Comparison & status ↗</button><button onClick={onDetails}>Method details & evidence ↗</button></header>
    <div style={{ height: '60vh' }}><AlternativeScene id="nanoparticles" time={0} resetToken={0} cameraDistance={14}/></div>
  </main>
}
