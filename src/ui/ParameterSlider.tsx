import { useEffect, useId, useState } from 'react'
export function ParameterSlider({ label, value, min, max, step, unit, defaultValue, note, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; defaultValue: number; note?: string; onChange: (value: number) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(String(Number(value.toPrecision(7))))
  useEffect(() => setDraft(String(Number(value.toPrecision(7)))), [value])
  const commit = () => {
    const next = Number(draft)
    if (draft.trim() && Number.isFinite(next)) { const bounded=Math.max(min,Math.min(max,next)); setDraft(String(bounded)); onChange(bounded) }
    else setDraft(String(value))
  }
  return <div className="ops-parameter">
    <div><label htmlFor={id}>{label}</label><button type="button" title={`Reset ${label}`} aria-label={`Reset ${label}`} onClick={() => onChange(defaultValue)}>↺</button></div>
    <div className="ops-parameter-inputs"><input type="range" min={min} max={max} step={step} value={value} aria-label={`${label} slider`} onChange={e => onChange(Number(e.target.value))} /><input id={id} type="number" min={min} max={max} step={step} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /><span>{unit}</span></div>
    <small>{min}–{max} {unit}{note ? ` · ${note}` : ''}</small>
  </div>
}
