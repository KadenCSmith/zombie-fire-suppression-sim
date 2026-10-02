import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CinematicUIProvider } from './ui/CinematicUI'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><CinematicUIProvider><App /></CinematicUIProvider></React.StrictMode>,
)
