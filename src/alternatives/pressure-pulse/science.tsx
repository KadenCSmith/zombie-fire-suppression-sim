import { variants } from './index'
export function MethodScience() {
  return <section data-method-science="4.2.3"><h3>4.2.3 · Method evidence</h3>{variants.map(v=><p key={v.id}><strong>{v.number} {v.label}.</strong> {v.limitation}</p>)}</section>
}
