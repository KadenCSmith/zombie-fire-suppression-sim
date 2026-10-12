import { PeatSolver } from '../peatfem/coupled'
import { PARAMETERS, VARIANTS, variant } from './registry'
import { freshPanel, type PanelConfig } from './model'
export const SESSION_KEY = 'zombie-fire-alternatives-v21'
export const SESSION_SCHEMA = 2
export function readComparison(raw: string | null): PanelConfig[] {
  const fallback = () => [freshPanel('panel-a', 'baseline'), freshPanel('panel-b', 'sublimation-injection')]
  if (!raw) return fallback()
  try {
    const saved = JSON.parse(raw)
    if (![1, 2].includes(saved.schema) || !Array.isArray(saved.panels) || !saved.panels.length) return fallback()
    const ids = new Set<string>()
    return saved.panels.slice(0, 4).map((p: Partial<PanelConfig>, i: number) => {
      const known = VARIANTS.find(v => v.id === p.variantId)
      if (!known) throw new Error('Unknown alternative')
      const next = freshPanel(typeof p.id === 'string' && p.id.length < 100 && !ids.has(p.id) ? p.id : `migrated-${i}`, known.id)
      ids.add(next.id)
      next.engine = ['contact', 'peat-fem', 'concept'].includes(p.engine ?? '') ? p.engine! : variant(known.id).defaultEngine
      next.medium = ['none', 'water', 'co2-water', 'unspecified'].includes(p.medium ?? '') ? p.medium! : next.medium
      // Persist configuration only. A restored tab never resumes a stale job or physical state.
      for (const spec of PARAMETERS) {
        const value = p.thermal?.[spec.key]
        if (typeof value === 'number' && Number.isFinite(value) && value >= spec.min && value <= spec.max) next.thermal[spec.key] = value
      }
      next.thermal.enabled = typeof p.thermal?.enabled === 'boolean' ? p.thermal.enabled : true
      if (typeof p.thermal?.seed === 'number' && Number.isInteger(p.thermal.seed)) next.thermal.seed = p.thermal.seed
      // Validate a whitelist against the solver before restoring FEM configuration.
      if(p.fem){
        const candidate={...next.fem}
        for(const key of Object.keys(candidate) as (keyof typeof candidate)[]){
          const value=p.fem[key]
          if(typeof value===typeof candidate[key])Object.assign(candidate,{[key]:value})
        }
        if([2,4,8].includes(candidate.n)&&candidate.endS<=600&&candidate.maxStepS<=5&&candidate.ignitionW<=30){
          try{new PeatSolver(candidate);next.fem=candidate}catch{/* Invalid physical data retains canonical defaults. */}
        }
      }
      return next
    })
  } catch { return fallback() }
}
export function serializeComparison(panels: PanelConfig[]) { return JSON.stringify({ schema: SESSION_SCHEMA, panels }) }
