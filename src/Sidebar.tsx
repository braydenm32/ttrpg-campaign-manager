import { createContext, useContext, useSyncExternalStore } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CaretLeft, Shield, SlidersHorizontal } from '@phosphor-icons/react'
import logo from './assets/logo.svg'
import type { World } from './db'
import { Help, HELP } from './help'
import { useVisibleEntities } from './hooks'
import { Ico } from './icons'
import { areaHome, areasFor, locate, PHONE_BAR, showsTab, topTabs, type AreaId, type BarItem, type LocateHelp, type NavArea, type NavFacts, type NavSpot, type NavTab, type Viewer } from './nav'
import { hasSafety, isOpenThread, openLeads, partyLoot, tickingClocks, useVisibleHandouts } from './counts'
import { EMPTY_INBOX, useGmInbox, type GmInbox } from './players/inbox'
import { useCharacterOwners } from './players/owners'
import { nextSessions, useCampaigns, useWorldSessions } from './threads'
import { useViewMode } from './viewMode'
import { isPlayed, sessionFirstTab } from './sessions'
import { usePlayingNow } from './stage'
import { pagePath, resolvePage, worldPath } from './paths'
import { formatDate } from './calendar'
import { syncNow, syncStore } from './cloud/sync'
import { leaveWorld } from './cloud/players'
import { XCardButton } from './pages/Safety'

/**
 * The world's frame: areas in the sidebar (or the bar along the bottom of a phone), the open
 * area's tabs across the top. What's in them comes from src/nav.ts; this file works out the facts
 * they depend on (is a session live, are there handouts…) and draws them.
 */

export interface Frame {
  facts: NavFacts
  /** Where the current address sits: its area and tab. */
  spot?: NavSpot
  help: LocateHelp
  /** The session in hand: being played now, else the next one. */
  inHandId?: string
  /** What's waiting on the GM from players (empty for anyone else). Screens read this copy, so counts agree. */
  inbox: GmInbox
}

/** Works out the frame for the current address and viewer. */
export function useFrame(world: World | null | undefined): Frame {
  const worldId = world?.id ?? ''
  const { isGM } = useViewMode()
  const { pathname, search } = useLocation()
  const shared = world?.shared
  const viewer: Viewer = shared?.token ? 'wiki' : isGM && !shared ? 'gm' : 'player'
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useCampaigns(worldId)
  const handouts = useVisibleHandouts(world, entities).length
  const inbox = useGmInbox(viewer === 'gm' ? world : undefined)
  const playingNow = usePlayingNow(worldId)

  // The session in hand: the one being played (started, live or recording), else the next one to play.
  const first = viewer === 'gm' ? nextSessions(campaigns, sessions, playingNow)[0] : undefined
  const inHand = first?.session
  const openId = pathname.match(/^\/w\/[^/]+\/s\/([^/]+)/)?.[1]
  const focus = sessions.find((s) => s.id === openId) ?? inHand
  const w = worldPath(worldId)
  const sessionHome = first?.underWay ? `${w}/s/${first.session.id}/lectern` : inHand && !isPlayed(inHand) ? `${w}/s/${inHand.id}?tab=prep` : `${w}/session`
  const visibleIds = new Set(entities.map((e) => e.id))

  const facts: NavFacts = {
    worldId,
    viewer,
    invited: !!shared?.memberOf,
    cloud: !shared && !!world?.cloud?.enabled,
    sessionId: focus?.id,
    campaignId: focus?.campaignId ?? campaigns[0]?.id,
    sessionHome,
    handouts,
    loot: partyLoot(entities, world).any,
    clocks: tickingClocks(entities).length,
    links: entities.some((e) => e.relations?.some((r) => visibleIds.has(r.to))),
    safety: viewer !== 'wiki' && (viewer === 'gm' || hasSafety(world)),
    inbox: inbox.total,
    questions: inbox.available,
    threads: entities.filter(isOpenThread).length,
    leads: openLeads(entities).length,
    campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
  }
  const help: LocateHelp = {
    viewer,
    pageType: (param) => entities.find((e) => e.id === resolvePage(worldId, param))?.type,
    sessionTab: (id) => {
      const s = sessions.find((x) => x.id === id)
      return s ? sessionFirstTab(s) : 'prep'
    },
  }
  return { facts, help, spot: locate(pathname, search, help), inHandId: inHand?.id, inbox }
}

const FrameContext = createContext<Frame | undefined>(undefined)
export const FrameProvider = FrameContext.Provider
/** The frame the world's shell worked out (for the More page and search). */
export const useFrameContext = () => useContext(FrameContext)
/** What's waiting on the GM, as the frame loaded it (the Desk, the Inbox and the banners all read this one copy). */
export const useInbox = () => useContext(FrameContext)?.inbox ?? EMPTY_INBOX

const pathOf = (to: string) => to.split('?')[0]

/** Where each area and bottom-bar item goes, and which is lit. */
export interface FrameLinks {
  areaHref: (a: NavArea) => string | undefined
  barHref: (b: BarItem) => string | undefined
}

/** The sidebar on a computer: the areas, then the world's settings, sync and who you're viewing as. */
export function AreaSidebar({ world, frame, links }: { world: World; frame: Frame; links: FrameLinks }) {
  const { facts, spot } = frame
  const areas = areasFor(facts.viewer).filter((a) => a.id === spot?.area.id || (a.tabs.some((t) => showsTab(t, facts)) && links.areaHref(a)))
  return (
    <aside className="sidebar">
      <nav className="areas" aria-label="Areas">
        {areas.map((a) => {
          const on = spot?.area.id === a.id
          const n = a.count?.(facts)
          return (
            <Link key={a.id} className={`area ${on ? 'on' : ''} ${a.id === 'rules' ? 'apart' : ''}`} aria-current={on ? 'page' : undefined} to={links.areaHref(a) ?? worldPath(facts.worldId)}>
              <Ico as={a.icon} size="1.2em" /> <span>{a.label}</span>
              {n ? <span className="count alert">{n}</span> : null}
            </Link>
          )
        })}
      </nav>
      <p className="areas-help small muted">
        How the menus work <Help topic="areas" />
      </p>
      <ShellFoot world={world} />
    </aside>
  )
}

/** The tabs of the open area, across the top (and on a phone, a row you can scroll sideways). */
export function AreaTabs({ frame, phoneTabs }: { frame: Frame; phoneTabs: Set<string> }) {
  const { facts, spot } = frame
  const { pathname, search } = useLocation()
  if (!spot) return <nav className="area-tabs" aria-label="Tabs" />
  const tabs = topTabs(spot.area, facts, spot.tab)
  const here = pathname + search
  return (
    <nav className="area-tabs" aria-label={spot.area.label}>
      {tabs.map((t) => {
        const to = t.to(facts)!
        const on = spot.tab?.id === t.id
        const n = t.count?.(facts)
        // Already there: following it again would only add the same step to Back.
        return (
          <Link
            key={t.id}
            to={to}
            replace={to === here}
            className={`${on ? 'on' : ''} ${phoneTabs.has(t.id) ? '' : 'not-phone'}`}
            aria-current={on ? 'page' : undefined}
            {...(t.external ? { target: '_blank', rel: 'noopener' } : {})}
          >
            {t.label}
            {n ? <span className={`count ${t.alert ? 'alert' : ''}`}>{n}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}

/** Which tabs show in the phone's row under the top bar: the area's, unless the bottom bar already has them. */
export function phoneTabIds(frame: Frame): Set<string> {
  const { facts, spot } = frame
  if (!spot) return new Set()
  const tabs = topTabs(spot.area, facts, spot.tab).map((t) => t.id)
  if (facts.viewer !== 'player') return new Set(tabs)
  const item = PHONE_BAR.player.find((b) => b.area === spot.area.id && (!b.tabs || (spot.tab && b.tabs.includes(spot.tab.id))))
  if (!item) return new Set()
  return new Set(item.tabs ? tabs.filter((t) => item.tabs!.includes(t)) : tabs)
}

/** The phone's bar along the bottom: five areas (players: Now, Me, Party, Leads, World) in thumb reach. */
export function BottomBar({ frame, links }: { frame: Frame; links: FrameLinks }) {
  const { facts, spot } = frame
  if (facts.viewer === 'wiki') return null
  const items = PHONE_BAR[facts.viewer]
  return (
    <nav className="bottom-bar" aria-label="Areas">
      {items.map((b) => {
        const on = !!spot && spot.area.id === b.area && (!b.tabs || (!!spot.tab && b.tabs.includes(spot.tab.id)))
        const area = areasFor(facts.viewer).find((a) => a.id === b.area)
        const n = !b.tabs ? area?.count?.(facts) : undefined
        return (
          <Link key={b.id} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} to={links.barHref(b) ?? worldPath(facts.worldId)}>
            <span className="bar-icon">
              <Ico as={b.icon} size="1.45em" weight={on ? 'fill' : 'regular'} />
              {n ? <i>{n}</i> : null}
            </span>
            {b.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * The top-left corner: the world's name (to your worlds). On a phone, deeper than a tab's own
 * page, a Back arrow comes first, and the second line says where you are.
 */
export function WorldTile({ world, frame, deep }: { world: World; frame: Frame; deep: boolean }) {
  const navigate = useNavigate()
  const { spot, facts } = frame
  const campaign = facts.campaigns?.find((c) => c.id === facts.campaignId)
  const where = spot ? [spot.area.label, spot.tab && spot.tab.label !== spot.area.label ? spot.tab.label : ''].filter(Boolean).join(' · ') : ''
  const back = () => {
    // Back within the app if there's somewhere to go back to; otherwise up to the area's start.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate((spot && areaHome(spot.area, facts)) ?? worldPath(facts.worldId))
  }
  return (
    <>
      {deep && (
        <button className="icon-button back-button phone-only" onClick={back} aria-label="Back" title="Back">
          <Ico as={CaretLeft} size="1.3em" />
        </button>
      )}
      <button className={`world-tile ${deep ? 'deep' : ''}`} onClick={() => navigate('/')} title="All your worlds">
        <img src={logo} alt="" />
        <span>
          <b>{world.name}</b>
          <small className="not-phone">{facts.viewer === 'gm' && campaign ? campaign.name : 'The Warded Atlas'}</small>
          {where && <small className="phone-only">{where}</small>}
        </span>
      </button>
    </>
  )
}

/** Today's date in the world, if it keeps a calendar. */
export function WorldDate({ world }: { world: World }) {
  const cal = world.calendar
  if (!cal?.today) return null
  return <span className="world-date">{formatDate(cal, cal.today)}</span>
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

/**
 * The foot of the sidebar: World settings, sync, and the GM / Player switch; for a player who
 * joined, their character, the X-card and leaving. On a phone the same things are on the More page.
 */
export function ShellFoot({ world, className = '' }: { world: World; className?: string }) {
  const { isGM, setMode } = useViewMode()
  const navigate = useNavigate()
  const { owners } = useCharacterOwners(world)
  const shared = world.shared
  const memberOf = shared?.memberOf
  const mine = [...owners.entries()].filter(([, o]) => o.mine).map(([id]) => id)
  return (
    <div className={`sidebar-foot ${className}`}>
      {!shared && isGM && (
        <Link className="nav-foot-link" to={`${worldPath(world.id)}/settings`}>
          <Ico as={SlidersHorizontal} /> World settings
        </Link>
      )}
      {world.cloud?.enabled && <SyncBadge />}
      {memberOf ? (
        <div className="mode-switch">
          {mine.map((id) => (
            <Link key={id} className="button block" to={pagePath(world.id, id)}>
              <Ico as={Shield} /> My character
            </Link>
          ))}
          {world.safety?.xcard && <XCardButton cloudId={memberOf} small />}
          <span>You’re a player in this world. It updates as your GM adds to it.</span>
          <button
            className="link small leave-world"
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
          <span>
            Viewing as <Help topic="viewingAs" />
          </span>
          <div className="segmented gm-switch" title={HELP.viewingAs}>
            <button className={isGM ? 'on' : ''} onClick={() => setMode('gm')}>
              GM
            </button>
            <button className={!isGM ? 'on' : ''} onClick={() => setMode('player')}>
              Player
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Remembers the last address open in each area, so going back to an area lands where you were
 * (as the old modes did). Pressing the area you're already in goes to its start.
 */
export function frameLinks(frame: Frame, memory: Partial<Record<AreaId, string>>): FrameLinks {
  const { facts, spot, inHandId } = frame
  const areaHref = (a: NavArea) => {
    const home = areaHome(a, facts)
    if (spot?.area.id === a.id) return home
    const last = memory[a.id]
    // Session goes to the session in hand, unless you were last on something of that session (or no session at all).
    if (a.id === 'session') return last && (!/\/s\/[^/?]+/.test(last) || (!!inHandId && last.includes(`/s/${inHandId}`))) ? last : home
    return last ?? home
  }
  const barHref = (b: BarItem) => {
    const area = areasFor(facts.viewer).find((a) => a.id === b.area)
    if (!area) return undefined
    if (!b.tabs) return areaHref(area)
    const tab = area.tabs.find((t) => t.id === b.tabs![0]) as NavTab
    return tab.to(facts)
  }
  return { areaHref, barHref }
}

/** Whether the address is deeper than its tab's own page (a page, a map, another session…). */
export function isDeep(frame: Frame, pathname: string) {
  const to = frame.spot?.tab?.to(frame.facts) ?? (frame.spot && areaHome(frame.spot.area, frame.facts))
  return !to || pathOf(to) !== pathname
}
