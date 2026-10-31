import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useWorld } from './hooks'
import { AreaSidebar, AreaTabs, BottomBar, FrameProvider, frameLinks, isDeep, phoneTabIds, useFrame, WorldDate, WorldTile } from './Sidebar'
import { ToastHost } from './undo'
import type { AreaId } from './nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { ForcePlayerView, useViewMode, ViewModeProvider, WorldViewMode } from './viewMode'
import { finishSignInRedirect, useAuthSession, verifyEmailLink } from './cloud/auth'
import { startAccountKeys, stopAccountKeys } from './ai/accountKeys'
import { cloudErrorMessage, supabase } from './cloud/client'
import { watchPlayerCopy } from './cloud/share'
import { startSync, stopSync } from './cloud/sync'
import { Modal, Skeleton } from './components'
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
import SafetyPage, { XCardAlert } from './pages/Safety'
import { PlayersScreen, ShowingBanner, ShowingPopup } from './showing'
import { LiveBadge, PlayerTableLink, TableHost, TableSignals } from './atTheTable'
import { DowntimeToast } from './players/Downtime'
import { NewCharacterRequestsBanner } from './players/NewCharacters'
import Handouts from './pages/Handouts'
import More from './pages/More'
import Everything from './pages/Everything'
import SessionLanding from './pages/SessionLanding'
import { finishExampleWorld } from './example/load'
import { finishSampleWorld } from './sample'
import { WorldLoadingNote } from './WorldLoadingNote'
import { NothingHere } from './NothingHere'
import './small.css'
import { hashRouting, setPages, tidyPath, usePathsVersion } from './paths'
import { ClaudeJobChips, LeaveGuard } from './ai/LeaveGuard'
import { useGuardedNavigate } from './ai/leave'

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
              <Suspense fallback={<Skeleton />}>
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
            <Route path="more" element={<More />} />
            <Route path="everything" element={<Everything />} />
            <Route path="session" element={<SessionLanding />} />
            <Route path="*" element={<NothingHere />} />
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
  const userId = user?.id
  useEffect(() => {
    if (userId) startAccountKeys(userId)
  }, [userId])
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_IN') finishSignInRedirect()
      if (event === 'SIGNED_OUT') stopAccountKeys()
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
  if (!named) return <Skeleton />
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

/** The players' screen for a TV: always the player view, whoever opens it. */
function ScreenRoute() {
  const { world } = useWorld()
  if (!world)
    return world === null ? (
      <div className="players-screen world-bare">
        <div className="players-screen-idle" role="status">
          <h1>World not found.</h1>
          <p className="muted">This world isn’t on this device. Open the players’ screen from the GM’s own copy of the world.</p>
        </div>
      </div>
    ) : (
      <Skeleton />
    )
  return (
    <ForcePlayerView>
      <PlayersScreen world={world} />
    </ForcePlayerView>
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
    () => (token || memberOf ? watchPlayerCopy({ token, memberOf, fetchedAt: 0 }, (e) => setShareError(cloudErrorMessage(e))) : undefined),
    [token, memberOf],
  )
  // Asks first when Claude is writing on this page (see LeaveGuard).
  const navigate = useGuardedNavigate()
  const { pathname, search } = useLocation()
  const frame = useFrame(world)
  const { facts, spot } = frame
  // Each area goes back to the address you last had open in it (forgotten when you switch GM / Player view).
  const here = pathname + search
  const [memory, setMemory] = useState<{ viewer: string; paths: Partial<Record<AreaId, string>> }>({ viewer: facts.viewer, paths: {} })
  const paths = memory.viewer === facts.viewer ? memory.paths : {}
  if (spot && paths[spot.area.id] !== here) setMemory({ viewer: facts.viewer, paths: { ...paths, [spot.area.id]: here } })
  const links = frameLinks(frame, paths)
  // An example or sample world closed before its pictures and maps were all drawn carries on drawing them.
  const example = !!world?.example
  const sample = !!world?.sample
  useEffect(() => {
    if (example) void finishExampleWorld(worldId)
    if (sample) void finishSampleWorld(worldId)
  }, [example, sample, worldId])

  if (world === undefined) return <Skeleton />
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

  const ownWorld = !shared
  const phoneTabs = phoneTabIds(frame)
  const deep = isDeep(frame, pathname)

  return (
    <FrameProvider value={frame}>
    <div className={`layout app-shell viewer-${facts.viewer} ${isGM ? '' : 'player-mode'} ${phoneTabs.size > 1 ? 'with-phone-tabs' : ''} ${facts.viewer === 'wiki' ? '' : 'with-bottom-bar'}`}>
      <LeaveGuard />
      <header className="topbar">
        <WorldTile world={world} frame={frame} deep={deep} />
        <AreaTabs frame={frame} phoneTabs={phoneTabs} />
        <WorldDate world={world} />
        <WorldLoadingNote worldId={worldId} />
        <SearchButton worldId={worldId} world={world} />
        {ownWorld && world.cloud?.enabled && <LiveBadge world={world} />}
        {isGM && ownWorld && <ClaudeJobChips worldId={worldId} />}
      </header>
      <div className="layout-body">
        <AreaSidebar world={world} frame={frame} links={links} />
        <main className="content">
          {shareError && <div className="player-banner">Couldn’t refresh: {shareError}</div>}
          {isGM && !shared && <RecordingBar />}
          {memberOf && <ChooseCharacterBanner world={world} />}
          {shared && <NewsBanner world={world} />}
          {/* What the GM shows is for the table; a public wiki link never pops it up. */}
          {memberOf && <ShowingPopup world={world} />}
          {isGM && !shared && <ShowingBanner world={world} />}
          {/* The Desk lists claims and new characters itself (Needs you, Inbox). */}
          {isGM && !shared && world.cloud?.enabled && spot?.area.id !== 'desk' && <ClaimRequestsBanner world={world} />}
          {isGM && !shared && world.cloud?.enabled && spot?.area.id !== 'desk' && <NewCharacterRequestsBanner world={world} />}
          {!shared && <XCardAlert world={world} />}
          {!shared && world.cloud?.enabled && <TableHost world={world} />}
          {isGM && !shared && world.cloud?.enabled && <TableSignals world={world} />}
          {isGM && !shared && world.cloud?.enabled && <DowntimeToast world={world} />}
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
            <Suspense fallback={<Skeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomBar frame={frame} links={links} />
      <ToastHost />
    </div>
    </FrameProvider>
  )
}
