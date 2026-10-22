import { useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { useWorld } from './hooks'
import { WorldNav } from './Sidebar'
import { ForcePlayerView, useViewMode, ViewModeProvider } from './viewMode'
import { useAuthSession } from './cloud/auth'
import { supabase } from './cloud/client'
import { watchSharedWorld } from './cloud/share'
import { startSync, stopSync, syncNow, syncStore } from './cloud/sync'
import { Modal } from './components'
import SharedWorld from './pages/SharedWorld'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import EntityList from './pages/EntityList'
import EntityPage from './pages/EntityPage'
import MapList from './pages/MapList'
import MapView from './pages/MapView'
import MapBuilder from './pages/MapBuilder'
import Timeline from './pages/Timeline'
import CampaignPage from './pages/CampaignPage'
import SessionPage from './pages/SessionPage'
import Lectern from './pages/Lectern'
import Threads from './pages/Threads'
import Assets from './pages/Assets'
import Generators from './pages/Generators'
import WorldSettings from './pages/WorldSettings'

export default function App() {
  return (
    <ViewModeProvider>
      <CloudBoot />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shared/:token" element={<SharedWorld />} />
          <Route path="/w/:worldId" element={<WorldLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="type/:type" element={<EntityList />} />
            <Route path="e/:entityId" element={<EntityPage />} />
            <Route path="maps" element={<MapList />} />
            <Route path="maps/:mapId" element={<MapView />} />
            <Route path="maps/:mapId/draw" element={<MapBuilder />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="threads" element={<Threads />} />
            <Route path="c/:campaignId" element={<CampaignPage />} />
            <Route path="s/:sessionId" element={<SessionPage />} />
            <Route path="s/:sessionId/lectern" element={<Lectern />} />
            <Route path="assets" element={<Assets />} />
            <Route path="generators" element={<Generators />} />
            <Route path="settings" element={<WorldSettings />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </HashRouter>
    </ViewModeProvider>
  )
}

/** Starts background sync while signed in, and handles the "set a new password" step after a reset email. */
function CloudBoot() {
  const { user } = useAuthSession()
  const [recovering, setRecovering] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (user) startSync()
    else stopSync()
  }, [user])
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => event === 'PASSWORD_RECOVERY' && setRecovering(true))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!recovering) return null
  return (
    <Modal title="Choose a new password" onClose={() => setRecovering(false)}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = await supabase.auth.updateUser({ password })
          if (error) setError(error.message)
          else setRecovering(false)
        }}
      >
        <label>
          New password
          <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="primary">Save password</button>
        </div>
      </form>
    </Modal>
  )
}

function WorldLayout() {
  const { world } = useWorld()
  if (world?.shared) return (
    <ForcePlayerView>
      <WorldShell />
    </ForcePlayerView>
  )
  return <WorldShell />
}

function SyncBadge() {
  const s = useSyncExternalStore(syncStore.subscribe, syncStore.get)
  const label = { off: '', idle: '☁️ Synced', syncing: '☁️ Syncing…', offline: '☁️ Offline, will sync later', error: '⚠️ Sync problem' }[s.status]
  if (!label) return null
  return (
    <button className="sync-badge ghost" title={s.message ?? 'Sync now'} onClick={() => syncNow()}>
      {label}
    </button>
  )
}

function WorldShell() {
  const { worldId, world } = useWorld()
  const { isGM, setMode } = useViewMode()
  const shared = world?.shared
  const [shareError, setShareError] = useState('')
  useEffect(() => (shared ? watchSharedWorld(shared.token, (e) => setShareError(e.message)) : undefined), [shared?.token])
  const navigate = useNavigate()

  if (world === undefined) return <div className="loading">Loading…</div>
  if (world === null) return <div className="loading">World not found.</div>

  return (
    <div className={`layout ${isGM ? '' : 'player-mode'}`}>
      <aside className="sidebar">
        <button className="world-name" onClick={() => navigate('/')} title="All worlds">
          ← {world.name}
        </button>
        <WorldNav worldId={worldId} />
        {world.cloud?.enabled && <SyncBadge />}
        {shared ? (
          <div className="mode-switch">
            <span>📜 Shared by your GM. Read only, updates automatically.</span>
          </div>
        ) : (
        <div className="mode-switch">
          <span>Viewing as</span>
          <div className="segmented">
            <button className={isGM ? 'on' : ''} onClick={() => setMode('gm')}>GM</button>
            <button className={!isGM ? 'on' : ''} onClick={() => setMode('player')}>Player</button>
          </div>
        </div>
        )}
      </aside>
      <main className="content">
        {shareError && <div className="player-banner">Couldn't refresh: {shareError}</div>}
        {!isGM && !shared && (
          <div className="player-banner">
            Player view: you're seeing only what's been revealed to players.
            <button onClick={() => setMode('gm')}>Back to GM view</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
