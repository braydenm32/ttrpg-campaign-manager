import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { keepData, startOffline } from './appUpdate'
import { watchSystemTheme } from './theme'
import { startMove } from './move'

watchSystemTheme()

// The web app moved address; this forwards or moves worlds across before anything starts (see move.tsx).
void startMove()
  .catch(() => true)
  .then((start) => {
    if (!start) return
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    startOffline()
    keepData()
  })
