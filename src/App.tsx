import { useLiveQuery } from 'dexie-react-hooks'
import { HashRouter, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { db, ENTITY_LABELS, ENTITY_TYPES } from './db'
import { useWorld } from './hooks'
import { useViewMode, ViewModeProvider } from './viewMode'
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
import Assets from './pages/Assets'
import Generators from './pages/Generators'
import WorldSettings from './pages/WorldSettings'

export default function App() {
  return (
    <ViewModeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/w/:worldId" element={<WorldLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="type/:type" element={<EntityList />} />
            <Route path="e/:entityId" element={<EntityPage />} />
            <Route path="maps" element={<MapList />} />
            <Route path="maps/:mapId" element={<MapView />} />
            <Route path="maps/:mapId/draw" element={<MapBuilder />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="c/:campaignId" element={<CampaignPage />} />
            <Route path="s/:sessionId" element={<SessionPage />} />
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

function WorldLayout() {
  const { worldId, world } = useWorld()
  const { isGM, setMode } = useViewMode()
  const navigate = useNavigate()
  const campaigns = useLiveQuery(() => db.campaigns.where({ worldId }).toArray(), [worldId]) ?? []
  const counts =
    useLiveQuery(async () => {
      const all = await db.entities.where({ worldId }).toArray()
      const c: Record<string, number> = {}
      for (const e of all) if (isGM || e.visibility === 'players') c[e.type] = (c[e.type] ?? 0) + 1
      return c
    }, [worldId, isGM]) ?? {}

  if (world === undefined) return <div className="loading">Loading…</div>
  if (world === null) return <div className="loading">World not found.</div>

  return (
    <div className={`layout ${isGM ? '' : 'player-mode'}`}>
      <aside className="sidebar">
        <button className="world-name" onClick={() => navigate('/')} title="All worlds">
          ← {world.name}
        </button>
        <nav>
          <NavLink end to={`/w/${worldId}`}>🏠 Overview</NavLink>
          <NavLink to={`/w/${worldId}/maps`}>🗺️ Maps</NavLink>
          <NavLink to={`/w/${worldId}/timeline`}>⏳ Timeline</NavLink>
          <div className="nav-heading">Campaigns</div>
          {campaigns.map((c) => (
            <NavLink key={c.id} to={`/w/${worldId}/c/${c.id}`}>
              🎲 {c.name}
            </NavLink>
          ))}
          <div className="nav-heading">Codex</div>
          {ENTITY_TYPES.map((t) => (
            <NavLink key={t} to={`/w/${worldId}/type/${t}`}>
              {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].many}
              {counts[t] ? <span className="count">{counts[t]}</span> : null}
            </NavLink>
          ))}
          {isGM && (
            <>
              <div className="nav-heading">GM tools</div>
              <NavLink to={`/w/${worldId}/generators`}>🎰 Generators</NavLink>
              <NavLink to={`/w/${worldId}/assets`}>📁 Assets</NavLink>
              <NavLink to={`/w/${worldId}/settings`}>⚙️ World settings</NavLink>
            </>
          )}
        </nav>
        <div className="mode-switch">
          <span>Viewing as</span>
          <div className="segmented">
            <button className={isGM ? 'on' : ''} onClick={() => setMode('gm')}>GM</button>
            <button className={!isGM ? 'on' : ''} onClick={() => setMode('player')}>Player</button>
          </div>
        </div>
      </aside>
      <main className="content">
        {!isGM && (
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
