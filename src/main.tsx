import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './phone.css'
import App from './App.tsx'
import { keepData, startOffline } from './appUpdate'
import { watchSystemTheme } from './theme'
import { startMove } from './move'
import { startPaths, upgradeHashLink } from './paths'
import { settleDbVersion } from './db'
import { watchStart } from './startNote'

watchSystemTheme()

// The web app moved address; this forwards or moves worlds across before anything starts (see move.tsx).
// Then an old "#/" link is turned into a plain address, and world names are loaded for short addresses.
async function boot() {
  // If the saved worlds can't be opened yet, the opening page says why (see startNote.ts).
  const started = watchStart()
  // Which version this device's database is: decided before anything reads it (see db.ts, version 11).
  await settleDbVersion()
  if (!(await startMove().catch(() => true))) return started()
  upgradeHashLink()
  await startPaths().catch(() => {})
  started()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  startOffline()
  keepData()
}
void boot()
