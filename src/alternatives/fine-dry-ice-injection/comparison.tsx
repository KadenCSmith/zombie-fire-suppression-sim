import type { AcceptedState, PanelConfig } from '../model'
import { PARTICLE_PENDING } from './config'
export interface ParticleComparisonProps { config: PanelConfig; onChange: (config: PanelConfig) => void; state?: AcceptedState; history: readonly AcceptedState[] }
export function ParticleComparison(_props: ParticleComparisonProps) { return <div className="alt-concept"><span>PARTICLE MODEL PENDING</span><p>{PARTICLE_PENDING}</p></div> }
