import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { keepData, startOffline } from './appUpdate'
import { watchSystemTheme } from './theme'
import { startMove } from './move'
import { startPaths, upgradeHashLink } from './paths'

watchSystemTheme()

// The web app moved address; this forwards or moves worlds across before anything starts (see move.tsx).
// Then an old "#/" link is turned into a plain address, and world names are loaded for short addresses.
async function boot() {
  if (!(await startMove().catch(() => true))) return
  upgradeHashLink()
  await startPaths().catch(() => {})
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  startOffline()
  keepData()
}
void boot()
