import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { BrowserRouter, HashRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Help, HELP } from './help'
import { useWorld } from './hooks'
import { modeOf, WorldNav, type WorldMode } from './Sidebar'
import { Ico } from './icons'
import logo from './assets/logo.svg'
import { Armchair, GlobeHemisphereWest, House, List, Play, Shield, SlidersHorizontal, UsersThree, X, Feather, type Icon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { nextSessions, useCampaigns, useWorldSessions } from './threads'
import { ForcePlayerView, useViewMode, ViewModeProvider, WorldViewMode } from './viewMode'
import { finishSignInRedirect, useAuthSession, verifyEmailLink } from './cloud/auth'
import { cloudErrorMessage, supabase } from './cloud/client'
import { leaveWorld } from './cloud/players'
import { watchPlayerCopy } from './cloud/share'
import { startSync, stopSync, syncNow, syncStore } from './cloud/sync'
import { Empty, Modal } from './components'
import { UpdateBanner } from './appUpdate'
import { MoveBanner } from './move'
import { ErrorBoundary } from './ErrorBoundary'
import { RecordingBar } from './RecordingBar'
import { SearchButton } from './search'
import SharedWorld from './pages/SharedWorld'
import JoinWorld from './pages/JoinWorld'
import { ChooseCharacterBanner } from './players/Characters'
import { ClaimRequestsBanner } from './players/ClaimRequests'
import { NewsBanner } from './players/News'
import { PreviewAsPicker } from './players/Secrets'
import { useCharacterOwners } from './players/owners'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import EntityList from './pages/EntityList'
import EntityPage from './pages/EntityPage'
import MapList from './pages/MapList'
const MapView = lazy(() => import('./pages/MapView'))
const MapBuilder = lazy(() => import('./pages/MapBuilder'))
const Timeline = lazy(() => import('./pages/Timeline'))
const Chronicle = lazy(() => import('./pages/Chronicle'))
import CampaignPage from './pages/CampaignPage'
import SessionPage from './pages/SessionPage'
const Lectern = lazy(() => import('./pages/Lectern'))
import Threads from './pages/Threads'
import Scratchpad from './pages/Scratchpad'
import Assets from './pages/Assets'
const Generators = lazy(() => import('./pages/Generators'))
const Archivist = lazy(() => import('./ai/Archivist'))
import PartyLoot from './pages/PartyLoot'
const WorldSettings = lazy(() => import('./pages/WorldSettings'))
const PrintPage = lazy(() => import('./print'))
import Boards from './pages/Boards'
const BoardView = lazy(() => import('./pages/BoardView'))
const Sounds = lazy(() => import('./pages/Sounds'))
import Questions from './pages/Questions'
const RelationWeb = lazy(() => import('./pages/RelationWeb'))
import ClocksPage from './clocks'
import SafetyPage, { XCardAlert, XCardButton } from './pages/Safety'
import { PlayersScreen, ShowingBanner, ShowingPopup } from './showing'
import { PlayerTableLink, TableHost, TableSignals } from './atTheTable'
import { NewCharacterRequestsBanner } from './players/NewCharacters'
import Handouts from './pages/Handouts'
import { ExampleDrawingNote } from './example/DrawingNote'
import { hashRouting, pagePath, setPages, tidyPath, usePathsVersion, worldPath } from './paths'

const Router = hashRouting ? HashRouter : BrowserRouter

export default function App() {
  return (
    <ErrorBoundary whole>
    <ViewModeProvider>
      <CloudBoot />
      <UpdateBanner />
      <MoveBanner />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shared/:token" element={<SharedWorld />} />
          <Route path="/join/:token" element={<JoinWorld />} />
          <Route
            path="/w/:worldId/print/:kind/:id"
            element={
              <Suspense fallback={<div className="loading">Loading…</div>}>
                <PrintPage />
              </Suspense>
            }
          />
          <Route path="/screen/:worldId" element={<ScreenRoute />} />
          <Route path="/w/:worldId" element={<WorldLayout />}>
            <Route index element={<Dashboard />} />
            <Route path=":section" element={<EntityList />} />
            <Route path="other/:kind" element={<EntityList />} />
            <Route path="type/:type" element={<EntityList />} />
            <Route path="type/:type/:kind" element={<EntityList />} />
            <Route path="loot" element={<PartyLoot />} />
            <Route path="p/:entityId" element={<EntityPage />} />
            <Route path="e/:entityId" element={<EntityPage />} />
            <Route path="maps" element={<MapList />} />
            <Route path="maps/:mapId" element={<MapView />} />
            <Route path="maps/:mapId/draw" element={<MapBuilder />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="chronicle" element={<Chronicle />} />
            <Route path="threads" element={<Threads />} />
            <Route path="scratchpad" element={<Scratchpad />} />
            <Route path="c/:campaignId" element={<CampaignPage />} />
            <Route path="s/:sessionId" element={<SessionPage />} />
            <Route path="s/:sessionId/lectern" element={<Lectern />} />
            <Route path="assets" element={<Assets />} />
            <Route path="generators" element={<Generators />} />
            <Route path="archivist" element={<Archivist />} />
            <Route path="settings" element={<WorldSettings />} />
            <Route path="boards" element={<Boards />} />
            <Route path="boards/:boardId" element={<BoardView />} />
            <Route path="sounds" element={<Sounds />} />
            <Route path="questions" element={<Questions />} />
            <Route path="web" element={<RelationWeb />} />
            <Route path="clocks" element={<ClocksPage />} />
            <Route path="safety" element={<SafetyPage />} />
            <Route path="handouts" element={<Handouts />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </Router>
    </ViewModeProvider>
    </ErrorBoundary>
  )
}

/** Starts background sync while signed in, and handles the "set a new password" step after a reset email. */
function CloudBoot() {
  const { user } = useAuthSession()
  const [recovering, setRecovering] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [linkNotice, setLinkNotice] = useState('')
  useEffect(() => {
    if (user) startSync()
    else stopSync()
  }, [user])
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_IN') finishSignInRedirect()
    })
    verifyEmailLink().then((r) => {
      if (!r) return
      if (r.error) setLinkNotice(r.error)
      else if (r.type === 'recovery') setRecovering(true)
      else if (r.type === 'signup' || r.type === 'email') setLinkNotice('Your email is confirmed and you’re signed in. Welcome to the Warded Atlas!')
      else if (r.type === 'email_change') setLinkNotice('Your email address has been updated.')
    })
    return () => data.subscription.unsubscribe()
  }, [])
  if (linkNotice && !recovering)
    return (
      <Modal title="The Warded Atlas account" onClose={() => setLinkNotice('')}>
        <div className="form">
          <p>{linkNotice}</p>
          <div className="row end">
            <button className="primary" onClick={() => setLinkNotice('')}>
              OK
            </button>
          </div>
        </div>
      </Modal>
    )
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
  const { worldId, world } = useWorld()
  // The world's page names, so links and the address can use them (see paths.ts).
  const named = useLiveQuery(async () => {
    setPages(worldId, await db.entities.where({ worldId }).toArray())
    return true
  }, [worldId])
  // An old-style or renamed address is swapped for the tidy one, without a new step in Back.
  const version = usePathsVersion()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const tidy = named && tidyPath(pathname)
    if (tidy) navigate(tidy + search, { replace: true })
  }, [named, version, pathname, search, navigate])
  if (!named) return <div className="loading">Loading…</div>
  if (world?.shared) return (
    <ForcePlayerView>
      <WorldShell />
    </ForcePlayerView>
  )
  // Keyed, so each world starts from its own remembered view and no previewed player.
  return (
    <WorldViewMode key={worldId} worldId={worldId}>
      <WorldShell />
    </WorldViewMode>
  )
}

/** An address inside a world that goes nowhere. */
function NotFound() {
  const { worldId } = useWorld()
  return (
    <div className="page">
      <Empty>
        There’s nothing at this address. <Link to={worldPath(worldId)}>Back to the world’s home</Link>
      </Empty>
    </div>
  )
}

/** The players' screen for a TV: always the player view, whoever opens it. */
function ScreenRoute() {
  const { world } = useWorld()
  if (!world) return <div className="loading">{world === null ? 'World not found.' : 'Loading…'}</div>
  return (
    <ForcePlayerView>
      <PlayersScreen world={world} />
    </ForcePlayerView>
  )
}

function SyncBadge() {
  const s = useSyncExternalStore(syncStore.subscribe, syncStore.get)
  const label = { off: '', idle: s.message ? '⚠️ Synced, with a note' : '☁️ Synced', syncing: '☁️ Syncing…', offline: '☁️ Offline, will sync later', error: '⚠️ Sync problem' }[s.status]
  if (!label) return null
  return (
    <button className="sync-badge ghost" title={s.message ?? 'Sync now'} onClick={() => syncNow()}>
      {label}
    </button>
  )
}

const MODE_LABELS: Record<WorldMode, string> = { home: 'Home', world: 'World', prep: 'Prep', play: 'Play', table: 'Table' }
const MODE_ICONS: Record<WorldMode, Icon> = { home: House, world: GlobeHemisphereWest, prep: Feather, play: Play, table: UsersThree }

function WorldShell() {
  const { worldId, world } = useWorld()
  const { isGM, setMode, previewAs } = useViewMode()
  const shared = world?.shared
  const [shareError, setShareError] = useState('')
  const token = shared?.token
  const memberOf = shared?.memberOf
  useEffect(
    () => (token || memberOf ? watchPlayerCopy({ token, memberOf, fetchedAt: 0 }, (e) => setShareError(cloudErrorMessage(e))) : undefined),
    [token, memberOf],
  )
  const { owners } = useCharacterOwners(world)
  const myCharacters = [...owners.entries()].filter(([, o]) => o.mine).map(([id]) => id)
  const navigate = useNavigate()
  // On a phone the menu is open only on the page it was opened on, so following a link folds it away.
  const { pathname } = useLocation()
  const [menuOpenAt, setMenuOpenAt] = useState<string>()
  const menuOpen = menuOpenAt === pathname
  // In the phone menu, the tabs only change which list shows; picking a page then goes there.
  const [drawerPick, setDrawerPick] = useState<WorldMode>()
  const mode = modeOf(pathname, isGM)
  // Settings belongs to no mode, so the sidebar keeps showing the one you came from.
  const [lastMode, setLastMode] = useState<WorldMode>('world')
  if (mode && mode !== 'home' && mode !== lastMode) setLastMode(mode)
  // Each tab goes back to the page you were last on in that mode.
  const [lastPath, setLastPath] = useState<Partial<Record<WorldMode, string>>>({})
  if (mode && lastPath[mode] !== pathname) setLastPath({ ...lastPath, [mode]: pathname })
  if (!menuOpen && drawerPick) setDrawerPick(undefined)
  const campaigns = useCampaigns(worldId)
  const sessions = useWorldSessions(worldId)
  const maps = useLiveQuery(() => db.maps.where({ worldId }).count(), [worldId]) ?? 0
  useEffect(() => {
    if (!menuOpen) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpenAt(undefined)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [menuOpen])

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

  const tabs: WorldMode[] = isGM && !shared ? ['home', 'world', 'prep', 'play'] : ['home', 'world', 'table']
  const sideMode: WorldMode = (menuOpen && drawerPick) || mode || lastMode
  const goTo = (m: WorldMode) => {
    if (m === 'home') return navigate(`${worldPath(worldId)}`)
    if (m === mode) return
    const next = nextSessions(campaigns, sessions)[0]?.session
    const landing: Record<WorldMode, string> = {
      home: '',
      world: maps ? 'maps' : 'locations',
      prep: campaigns[0] ? `c/${campaigns[0].id}` : 'threads',
      play: next ? `s/${next.id}/lectern` : 'clocks',
      table: 'threads',
    }
    navigate(lastPath[m] ?? `${worldPath(worldId)}/${landing[m]}`)
  }
  const ownWorld = !shared
  // Players' front page is the Common Room (a public wiki link keeps a plain Home).
  const room = !isGM && !shared?.token
  const label = (m: WorldMode) => (room && m === 'home' ? 'Common Room' : MODE_LABELS[m])
  const icon = (m: WorldMode) => (room && m === 'home' ? Armchair : MODE_ICONS[m])

  return (
    <div className={`layout ${isGM ? '' : 'player-mode'}`}>
      <header className="topbar">
        <button
          className="icon-button menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          title={HELP.phoneMenu}
          onClick={() => setMenuOpenAt(menuOpen ? undefined : pathname)}
        >
          <Ico as={menuOpen ? X : List} size="1.3em" />
        </button>
        <button className="world-tile" onClick={() => navigate('/')} title="All your worlds">
          <img src={logo} alt="" />
          <span>
            <b>{world.name}</b>
            <small>The Warded Atlas</small>
          </span>
        </button>
        <nav className="mode-tabs" aria-label="Modes" title={HELP.modes}>
          {tabs.map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} aria-current={mode === m ? 'page' : undefined} onClick={() => goTo(m)}>
              <Ico as={icon(m)} /> {label(m)}
            </button>
          ))}
        </nav>
        <SearchButton worldId={worldId} world={world} />
        {ownWorld && (
          <div className="segmented gm-switch" title={HELP.viewingAs}>
            <button className={isGM ? 'on' : ''} onClick={() => setMode('gm')}>GM</button>
            <button className={!isGM ? 'on' : ''} onClick={() => setMode('player')}>Player</button>
          </div>
        )}
        {ownWorld && isGM && (
          <Link className="button icon-button desk-only" to={`${worldPath(worldId)}/settings`} title="World settings" aria-label="World settings">
            <Ico as={SlidersHorizontal} size="1.2em" />
          </Link>
        )}
      </header>
      <div className={`layout-body ${mode === 'home' ? 'no-side' : ''}`}>
      {menuOpen && <button className="drawer-scrim" aria-label="Close menu" onClick={() => setMenuOpenAt(undefined)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="drawer-tabs" role="tablist">
          {tabs.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={sideMode === m}
              className={sideMode === m ? 'on' : ''}
              onClick={() => (m === 'home' ? navigate(`${worldPath(worldId)}`) : setDrawerPick(m))}
            >
              <Ico as={icon(m)} size="1.35em" />
              {label(m)}
            </button>
          ))}
        </div>
        <WorldNav worldId={worldId} mode={sideMode} />
        <div className="sidebar-foot">
          {ownWorld && isGM && (
            <NavLink className="nav-foot-link" to={`${worldPath(worldId)}/settings`}>
              <Ico as={SlidersHorizontal} /> World settings
            </NavLink>
          )}
          {world.cloud?.enabled && <SyncBadge />}
        {memberOf ? (
          <div className="mode-switch">
            {myCharacters.map((id) => (
              <button key={id} className="button block" onClick={() => navigate(`${pagePath(worldId, id)}`)}>
                <Ico as={Shield} /> My character
              </button>
            ))}
            {world.safety?.xcard && <XCardButton cloudId={memberOf} small />}
            <span>You’re a player in this world. It updates as your GM adds to it.</span>
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
            <span>A public wiki shared by the GM. Read only, updates automatically.</span>
          </div>
        ) : (
        <div className="mode-switch">
          <span className="drawer-only">
            Viewing as <Help topic="viewingAs" />
          </span>
          <div className="segmented drawer-only">
            <button className={isGM ? 'on' : ''} onClick={() => setMode('gm')}>GM</button>
            <button className={!isGM ? 'on' : ''} onClick={() => setMode('player')}>Player</button>
          </div>
        </div>
        )}
        </div>
      </aside>
      <main className="content">
        {shareError && <div className="player-banner">Couldn’t refresh: {shareError}</div>}
        {isGM && !shared && <RecordingBar />}
        {isGM && !shared && world.example && <ExampleDrawingNote worldId={worldId} />}
        {memberOf && <ChooseCharacterBanner world={world} />}
        {shared && <NewsBanner world={world} />}
        {/* What the GM shows is for the table; a public wiki link never pops it up. */}
        {memberOf && <ShowingPopup world={world} />}
        {isGM && !shared && <ShowingBanner world={world} />}
        {isGM && !shared && world.cloud?.enabled && <ClaimRequestsBanner world={world} />}
        {isGM && !shared && world.cloud?.enabled && <NewCharacterRequestsBanner world={world} />}
        {!shared && <XCardAlert world={world} />}
        {!shared && world.cloud?.enabled && <TableHost world={world} />}
        {isGM && !shared && world.cloud?.enabled && <TableSignals world={world} />}
        {memberOf && <PlayerTableLink world={world} />}
        {!isGM && !shared && (
          <div className="player-banner">
            {previewAs
              ? `Player view as ${previewAs.name}: what's revealed to everyone, plus what's just for ${previewAs.characterNames.join(' and ') || previewAs.name}.`
              : "Player view: you're seeing only what's been revealed to players."}
            <PreviewAsPicker world={world} />
            <button onClick={() => setMode('gm')}>Back to GM view</button>
          </div>
        )}
        {/* Bigger screens (maps, the Lectern, settings…) load the first time they're opened. */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="loading">Loading…</div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      </div>
    </div>
  )
}
