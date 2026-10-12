/** Private development/visual-QA harness. Product routing is coordinator-owned. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CinematicUIProvider } from '../../ui/CinematicUI'
import VibratoryWorkspace from './workspace'
import '../../ui/fire-sequence.css'

createRoot(document.getElementById('root')!).render(<StrictMode><CinematicUIProvider><VibratoryWorkspace onCompare={()=>{location.href='/?alternative=vibratory-injection&workspace=alternatives'}} onDetails={()=>{location.href='/?alternative=vibratory-injection&workspace=alternatives'}}/></CinematicUIProvider></StrictMode>)
