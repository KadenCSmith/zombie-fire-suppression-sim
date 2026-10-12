import { MODEL_VIEWS, type PhysicsWorkspace } from './ModelSelector'
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { METHODS, VARIANTS, variant, type VariantId } from '../alternatives/registry'
import './alternatives.css'
/** Embedded in the preserved Simulation Version dropdown. Parent rows remain selectable. */
export function AlternativeChoices({ selected, onSelect, onView }: { selected: VariantId; onSelect: (id: VariantId) => void; onView: (id: VariantId, workspace: PhysicsWorkspace) => void }) {
  const [expanded, setExpanded] = useState<string|null>(null), [side, setSide] = useState('right')
  const menu = useRef<HTMLDivElement>(null), suppressFocus=useRef(false)
  const [placement,setPlacement]=useState({left:0,top:0})
  useLayoutEffect(()=>{
    if(!expanded)return
    const position=()=>{const row=menu.current?.querySelector<HTMLElement>(`[data-method="${expanded}"]`),child=row?.querySelector<HTMLElement>('.alternative-children');if(!row||!child)return;const parent=row.getBoundingClientRect(),box=child.getBoundingClientRect();setPlacement({left:Math.max(12,Math.min(window.innerWidth-box.width-12,parent.right+box.width<=window.innerWidth-12?parent.right-1:parent.left-box.width+1)),top:Math.max(12,Math.min(parent.top,window.innerHeight-box.height-12))})}
    const scrollContainer=menu.current?.parentElement
    position();window.addEventListener('resize',position);scrollContainer?.addEventListener('scroll',position,{passive:true})
    return()=>{window.removeEventListener('resize',position);scrollContainer?.removeEventListener('scroll',position)}
  },[expanded])
  function key(e: KeyboardEvent) {
    if(e.key==='ArrowRight') { e.preventDefault();e.stopPropagation();setExpanded((document.activeElement as HTMLElement)?.closest('[data-method]')?.getAttribute('data-method')??'4.2.3');requestAnimationFrame(()=>menu.current?.querySelector<HTMLButtonElement>('.alternative-children button')?.focus()) }
    if(e.key==='ArrowLeft'&&expanded) { e.preventDefault();e.stopPropagation();suppressFocus.current=true;setExpanded(null);menu.current?.querySelector<HTMLButtonElement>(`[data-parent="${expanded}"]`)?.focus() }
    if(e.key==='Escape'&&expanded) { e.preventDefault();e.stopPropagation();setExpanded(null);menu.current?.querySelector<HTMLButtonElement>(`[data-method="${expanded}"] [data-disclosure]`)?.focus() }
  }
  return <div ref={menu} className="alternative-choices" data-side={side} onKeyDown={key} role="menu" aria-label="Capstone alternatives">
    {METHODS.map(method => {
      const v=VARIANTS.find(item=>item.number===method)!,children=VARIANTS.filter(item=>item.method===method&&item.number!==method)
      return <div key={method} data-method={method} className={`alternative-group ${variant(selected).method===method?'selected':''}`} onPointerEnter={()=>{setExpanded(method);const edge=menu.current?.getBoundingClientRect().right??0;setSide(edge+440>window.innerWidth?'left':'right')}} onFocus={event=>{if(suppressFocus.current){suppressFocus.current=false;return}if(!(event.target as HTMLElement).hasAttribute('data-disclosure'))setExpanded(method)}}>
        <div className="alternative-parent-row"><button role="menuitem" data-parent={method} aria-current={selected===v.id?'true':undefined} onClick={()=>onSelect(v.id)}><small>{v.number}</small><span>{v.label}<em>{v.subtitle}</em></span></button>{<button role="menuitem" data-disclosure aria-label={`Show ${v.number} sections${children.length ? " and pressure-pulse variants" : ""}`} aria-expanded={expanded===method} onClick={()=>setExpanded(method)}>›</button>}</div>
        {expanded===method&&<div className="alternative-children" style={placement} role="menu" aria-label={`${v.number} sections and variants`}>{children.length>0&&<span className="submenu-section-label">METHOD VARIANTS</span>}{children.map(child=><button role="menuitem" key={child.id} aria-current={selected===child.id?'true':undefined} onClick={()=>onSelect(child.id)}><small>{child.number}</small><span>{child.label}<em>Descriptive draft label</em></span></button>)}<span className="submenu-section-label">MODEL / VIEW SUBSECTIONS</span>{MODEL_VIEWS.filter(view=>view.id!=='sequence').map((view,index)=><button className="alternative-model-view" role="menuitem" key={view.id} onClick={()=>onView(v.id,view.id)}><small>{String(index+2).padStart(2,'0')}</small><span>{view.title}<em>{view.detail}</em></span><b>↗</b></button>)}<button className="alternative-model-view" role="menuitem" onClick={()=>onView(v.id,'peat-fem')}><small>FEM</small><span>Peat Fire FEM<em>Preserved reacting baseline · method coupling unavailable</em></span><b>↗</b></button><p className="submenu-scope">Views are preserved reference models. The selected capstone mechanism is not automatically coupled to their solvers.</p></div>}
      </div>
    })}
    <button className="alternative-baseline" role="menuitem" onClick={()=>onSelect('baseline')}>00 · No-treatment baseline</button>
  </div>
}
