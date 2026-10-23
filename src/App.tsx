import { useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { Help } from './help'
import { useWorld } from './hooks'
import { WorldNav } from './Sidebar'
import { ForcePlayerView, useViewMode, ViewModeProvider } from './viewMode'
import { useAuthSession } from './cloud/auth'
import { supabase } from './cloud/client'
import { leaveWorld } from './cloud/players'
import { watchPlayerCopy } from './cloud/share'
import { startSync, stopSync, syncNow, syncStore } from './cloud/sync'
import { Modal } from './components'
import SharedWorld from './pages/SharedWorld'
import JoinWorld from './pages/JoinWorld'
import { ChooseCharacterBanner } from './players/Characters'
import { PreviewAsPicker } from './players/Secrets'
import { useCharacterOwners } from './players/owners'
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
import Scratchpad from './pages/Scratchpad'
import Assets from './pages/Assets'
import Generators from './pages/Generators'
import PartyLoot from './pages/PartyLoot'
import WorldSettings from './pages/WorldSettings'
import PrintPage from './print'
import Boards from './pages/Boards'
import BoardView from './pages/BoardView'
import Sounds from './pages/Sounds'
import Questions from './pages/Questions'

export default function App() {
  return (
    <ViewModeProvider>
      <CloudBoot />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shared/:token" element={<SharedWorld />} />
          <Route path="/join/:token" element={<JoinWorld />} />
          <Route path="/w/:worldId/print/:kind/:id" element={<PrintPage />} />
          <Route path="/w/:worldId" element={<WorldLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="type/:type" element={<EntityList />} />
            <Route path="type/:type/:kind" element={<EntityList />} />
            <Route path="loot" element={<PartyLoot />} />
            <Route path="e/:entityId" element={<EntityPage />} />
            <Route path="maps" element={<MapList />} />
            <Route path="maps/:mapId" element={<MapView />} />
            <Route path="maps/:mapId/draw" element={<MapBuilder />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="threads" element={<Threads />} />
            <Route path="scratchpad" element={<Scratchpad />} />
            <Route path="c/:campaignId" element={<CampaignPage />} />
            <Route path="s/:sessionId" element={<SessionPage />} />
            <Route path="s/:sessionId/lectern" element={<Lectern />} />
            <Route path="assets" element={<Assets />} />
            <Route path="generators" element={<Generators />} />
            <Route path="settings" element={<WorldSettings />} />
            <Route path="boards" element={<Boards />} />
            <Route path="boards/:boardId" element={<BoardView />} />
            <Route path="sounds" element={<Sounds />} />
            <Route path="questions" element={<Questions />} />
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
  const { isGM, setMode, previewAs } = useViewMode()
  const shared = world?.shared
  const [shareError, setShareError] = useState('')
  const token = shared?.token
  const memberOf = shared?.memberOf
  useEffect(
    () => (token || memberOf ? watchPlayerCopy({ token, memberOf, fetchedAt: 0 }, (e) => setShareError(e.message)) : undefined),
    [token, memberOf],
  )
  const { owners } = useCharacterOwners(world)
  const myCharacters = [...owners.entries()].filter(([, o]) => o.mine).map(([id]) => id)
  const navigate = useNavigate()

  if (world === undefined) return <div className="loading">Loading…</div>
  if (world === null)
    return (
      <div className="loading">
        <p>
          {worldId.startsWith('member-')
            ? 'You’re no longer a player in this world. Ask your GM for a new invite if that’s a mistake.'
            : 'World not found.'}
        </p>
        <button onClick={() => navigate('/')}>Go to your worlds</button>
      </div>
    )

  return (
    <div className={`layout ${isGM ? '' : 'player-mode'}`}>
      <aside className="sidebar">
        <button className="world-name" onClick={() => navigate('/')} title="All worlds">
          ← {world.name}
        </button>
        <WorldNav worldId={worldId} />
        {world.cloud?.enabled && <SyncBadge />}
        {memberOf ? (
          <div className="mode-switch">
            {myCharacters.map((id) => (
              <button key={id} className="button block" onClick={() => navigate(`/w/${worldId}/e/${id}`)}>
                🛡️ My character
              </button>
            ))}
            <span>🎭 You’re a player in this world. It updates as your GM adds to it.</span>
            <button
              className="link small"
              onClick={async () => {
                if (!confirm('Leave this world? It will be removed from this device, and you’ll need a new invite to come back.')) return
                await leaveWorld(memberOf)
                navigate('/')
              }}
            >
              Leave this world
            </button>
          </div>
        ) : shared ? (
          <div className="mode-switch">
            <span>📜 Shared by your GM. Read only, updates automatically.</span>
          </div>
        ) : (
        <div className="mode-switch">
          <span>
            Viewing as <Help topic="viewingAs" />
          </span>
          <div className="segmented">
            <button className={isGM ? 'on' : ''} onClick={() => setMode('gm')}>GM</button>
            <button className={!isGM ? 'on' : ''} onClick={() => setMode('player')}>Player</button>
          </div>
          {!isGM && <PreviewAsPicker world={world} />}
        </div>
        )}
      </aside>
      <main className="content">
        {shareError && <div className="player-banner">Couldn't refresh: {shareError}</div>}
        {memberOf && <ChooseCharacterBanner world={world} />}
        {!isGM && !shared && (
          <div className="player-banner">
            {previewAs
              ? `Player view as ${previewAs.name}: what's revealed to everyone, plus what's just for ${previewAs.characterNames.join(' and ') || previewAs.name}.`
              : "Player view: you're seeing only what's been revealed to players."}
            <button onClick={() => setMode('gm')}>Back to GM view</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
