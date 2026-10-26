import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Help, HELP } from './help'
import { useWorld } from './hooks'
import { modeOf, WorldNav, type WorldMode } from './Sidebar'
import { Ico } from './icons'
import logo from './assets/logo.svg'
import { GlobeHemisphereWest, House, List, Play, Shield, SlidersHorizontal, UsersThree, X, Feather, type Icon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { nextSessions, useCampaigns, useWorldSessions } from './threads'
import { ForcePlayerView, useViewMode, ViewModeProvider } from './viewMode'
import { finishSignInRedirect, useAuthSession, verifyEmailLink } from './cloud/auth'
import { cloudErrorMessage, supabase } from './cloud/client'
import { leaveWorld } from './cloud/players'
import { watchPlayerCopy } from './cloud/share'
import { startSync, stopSync, syncNow, syncStore } from './cloud/sync'
import { Modal } from './components'
import { UpdateBanner } from './appUpdate'
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
import CampaignPage from './pages/CampaignPage'
import SessionPage from './pages/SessionPage'
const Lectern = lazy(() => import('./pages/Lectern'))
import Threads from './pages/Threads'
import Scratchpad from './pages/Scratchpad'
import Assets from './pages/Assets'
const Generators = lazy(() => import('./pages/Generators'))
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
import Handouts from './pages/Handouts'

export default function App() {
  return (
    <ViewModeProvider>
      <CloudBoot />
      <UpdateBanner />
      <HashRouter>
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
            <Route path="web" element={<RelationWeb />} />
            <Route path="clocks" element={<ClocksPage />} />
            <Route path="safety" element={<SafetyPage />} />
            <Route path="handouts" element={<Handouts />} />
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
  const { world } = useWorld()
  if (world?.shared) return (
    <ForcePlayerView>
      <WorldShell />
    </ForcePlayerView>
  )
  return <WorldShell />
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
  const label = { off: '', idle: '☁️ Synced', syncing: '☁️ Syncing…', offline: '☁️ Offline, will sync later', error: '⚠️ Sync problem' }[s.status]
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
    if (m === 'home') return navigate(`/w/${worldId}`)
    if (m === mode) return
    const next = nextSessions(campaigns, sessions)[0]?.session
    const landing: Record<WorldMode, string> = {
      home: '',
      world: maps ? 'maps' : 'type/location',
      prep: campaigns[0] ? `c/${campaigns[0].id}` : 'threads',
      play: next ? `s/${next.id}/lectern` : 'clocks',
      table: 'threads',
    }
    navigate(lastPath[m] ?? `/w/${worldId}/${landing[m]}`)
  }
  const ownWorld = !shared

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
              <Ico as={MODE_ICONS[m]} /> {MODE_LABELS[m]}
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
          <Link className="button icon-button desk-only" to={`/w/${worldId}/settings`} title="World settings" aria-label="World settings">
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
              onClick={() => (m === 'home' ? navigate(`/w/${worldId}`) : setDrawerPick(m))}
            >
              <Ico as={MODE_ICONS[m]} size="1.35em" />
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <WorldNav worldId={worldId} mode={sideMode} />
        <div className="sidebar-foot">
          {ownWorld && isGM && (
            <NavLink className="nav-foot-link" to={`/w/${worldId}/settings`}>
              <Ico as={SlidersHorizontal} /> World settings
            </NavLink>
          )}
          {world.cloud?.enabled && <SyncBadge />}
        {memberOf ? (
          <div className="mode-switch">
            {myCharacters.map((id) => (
              <button key={id} className="button block" onClick={() => navigate(`/w/${worldId}/e/${id}`)}>
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
          {!isGM && <PreviewAsPicker world={world} />}
        </div>
        )}
        </div>
      </aside>
      <main className="content">
        {shareError && <div className="player-banner">Couldn’t refresh: {shareError}</div>}
        {isGM && !shared && <RecordingBar />}
        {memberOf && <ChooseCharacterBanner world={world} />}
        {shared && <NewsBanner world={world} />}
        {/* What the GM shows is for the table; a public wiki link never pops it up. */}
        {memberOf && <ShowingPopup world={world} />}
        {isGM && !shared && <ShowingBanner world={world} />}
        {isGM && !shared && world.cloud?.enabled && <ClaimRequestsBanner world={world} />}
        {!shared && <XCardAlert world={world} />}
        {!isGM && !shared && (
          <div className="player-banner">
            {previewAs
              ? `Player view as ${previewAs.name}: what's revealed to everyone, plus what's just for ${previewAs.characterNames.join(' and ') || previewAs.name}.`
              : "Player view: you're seeing only what's been revealed to players."}
            <button onClick={() => setMode('gm')}>Back to GM view</button>
          </div>
        )}
        {/* Bigger screens (maps, the Lectern, settings…) load the first time they're opened. */}
        <Suspense fallback={<div className="loading">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
      </div>
    </div>
  )
}
