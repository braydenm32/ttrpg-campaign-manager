import { useLiveQuery } from 'dexie-react-hooks'
import { HELP } from './help'
import { useState, type ReactNode } from 'react'
import { matchPath, NavLink, useLocation } from 'react-router-dom'
import {
  Backpack,
  ChatCircleDots,
  Folder,
  Graph,
  HandPalm,
  Hourglass,
  MapTrifold,
  MusicNotes,
  Newspaper,
  Notepad,
  Play,
  PushPin,
  Spiral,
  Timer,
  UsersThree,
  DiceFive,
  Plus,
  BookOpen,
  BookBookmark,
  Books,
} from '@phosphor-icons/react'
import { db, ENTITY_LABELS, ENTITY_TYPES, type CustomType, type Entity, type EntityType } from './db'
import { treeRoots, useVisibleEntities, useWorld } from './hooks'
import { Ico, TypeIcon } from './icons'
import { nextSessions, useCampaigns, useWorldSessions } from './threads'
import { useViewMode } from './viewMode'
import { useGmQuestions } from './players/Questions'
import { useDowntime } from './players/Downtime'
import { useCharacterOwners } from './players/owners'
import { pagePath, resolveCustom, resolvePage, SECTION_WORDS, sectionType, typePath, worldPath } from './paths'

/** Longest list shown under a codex section before linking to the full list. */
const MAX_CHILDREN = 25

/**
 * The four ways into a world. World is the atlas itself (codex, maps, timeline); Prep is getting a
 * session ready; Play is running it at the table. Players get a Table mode instead of Prep and Play.
 */
export type WorldMode = 'home' | 'world' | 'prep' | 'play' | 'table'

/** Which mode a page belongs to, so the right tab lights up and the sidebar lists its neighbours. */
export function modeOf(pathname: string, isGM: boolean): WorldMode | undefined {
  const rest = pathname.replace(/^\/w\/[^/]+\/?/, '')
  const first = rest.split('/')[0]
  if (!rest) return 'home'
  if (['maps', 'type', 'e', 'p', 'timeline', 'chronicle', 'web', 'assets', ...SECTION_WORDS].includes(first)) return 'world'
  if (first === 'settings') return undefined
  if (!isGM) return 'table'
  if (first === 's' && rest.endsWith('/lectern')) return 'play'
  if (['c', 's', 'threads', 'generators', 'archivist', 'boards', 'handouts'].includes(first)) return 'prep'
  return 'play'
}

/**
 * The world's sidebar menu for one mode. Sections open up underneath as you go deeper:
 * a campaign shows its sessions, a codex section shows its pages, and locations open as a tree
 * down to wherever you are.
 */
export function WorldNav({ worldId, mode }: { worldId: string; mode: WorldMode }) {
  const { isGM, canSee } = useViewMode()
  const { world } = useWorld()
  const { pathname } = useLocation()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useCampaigns(worldId)
  const maps = useLiveQuery(() => db.maps.where({ worldId }).sortBy('name'), [worldId]) ?? []
  // Sections the user opened or closed by hand; anything not listed follows where you are.
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const [allTypes, setAllTypes] = useState(false)

  const at = (pattern: string): Record<string, string | undefined> | null =>
    matchPath({ path: `/w/:worldId/${pattern}`, end: false }, pathname)?.params ?? null
  const sessionId = at('s/:sessionId')?.sessionId
  const currentSession = sessions.find((s) => s.id === sessionId)
  const campaignId = at('c/:campaignId')?.campaignId ?? currentSession?.campaignId
  const pageParam = at('p/:entityId')?.entityId ?? at('e/:entityId')?.entityId
  const entityId = pageParam && resolvePage(worldId, pageParam)
  const currentEntity = entities.find((e) => e.id === entityId)
  const section = at(':section')?.section
  const type = (at('type/:type')?.type as EntityType | undefined) ?? (section ? sectionType(section) : undefined) ?? currentEntity?.type
  const inMaps = !!at('maps')

  const byId = new Map(entities.map((e) => [e.id, e]))
  // The chain of places from the top of the tree down to the current page, kept open.
  const path = new Set<string>()
  for (let e = currentEntity; e && !path.has(e.id); e = e.parentId ? byId.get(e.parentId) : undefined) path.add(e.id)

  const open = (key: string, auto: boolean) => manual[key] ?? auto
  const toggle = (key: string, auto: boolean) => setManual((m) => ({ ...m, [key]: !(m[key] ?? auto) }))
  const caret = (key: string, auto: boolean, label: string) => (
    <button
      type="button"
      className="nav-caret"
      aria-expanded={open(key, auto)}
      title={open(key, auto) ? `Hide ${label}` : `Show ${label}`}
      onClick={() => toggle(key, auto)}
    >
      {open(key, auto) ? '▾' : '▸'}
    </button>
  )
  /** A group heading that folds its links away. */
  const group = (key: string, label: string, title: string | undefined, children: ReactNode) => (
    <>
      <button type="button" className="nav-heading" title={title} aria-expanded={open(`grp:${key}`, true)} onClick={() => toggle(`grp:${key}`, true)}>
        {label} <span aria-hidden="true">{open(`grp:${key}`, true) ? '▾' : '▸'}</span>
      </button>
      {open(`grp:${key}`, true) && children}
    </>
  )

  const countOf = (t: EntityType) => entities.filter((e) => e.type === t).length
  const kindParam = at('other/:kind')?.kind
  const kind = (kindParam && resolveCustom(worldId, kindParam)) ?? at('type/custom/:kind')?.kind ?? (currentEntity?.type === 'custom' ? currentEntity.customType : undefined)
  const hasLoot = entities.some((e) => e.type === 'item' && e.heldBy) || !!world?.partyCoin?.length
  const gmQuestions = useGmQuestions(isGM && mode === 'play' ? world : undefined)
  const downtime = useDowntime(isGM && mode === 'play' && world?.cloud?.enabled ? world : undefined)
  const waiting = gmQuestions.questions.filter((q) => !q.answer).length + downtime.list.filter((d) => !d.answer).length
  const hasLinks = entities.some((e) => e.relations?.length)
  const clockCount = entities.reduce((n, e) => n + (e.clocks ?? []).filter((c) => c.filled < c.segments).length, 0)
  const handouts = world?.handouts?.length ?? 0
  const { owners } = useCharacterOwners(isGM && mode === 'play' && world?.cloud?.enabled ? world : undefined)
  const pendingClaims = [...owners.values()].filter((o) => o.pending).length
  // Safety tools are for the table, not for wiki readers.
  const safetyLink = !world?.shared?.token && (isGM || !!world?.safety?.lines.length || !!world?.safety?.veils.length || !!world?.safety?.notes.trim() || !!world?.safety?.xcard) && (
    <NavLink to={`${worldPath(worldId)}/safety`} title={HELP.safety}><Ico as={HandPalm} /> Safety tools</NavLink>
  )
  const openThreads = entities.filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active')).length
  const next = nextSessions(campaigns, sessions)[0]?.session

  const roots = treeRoots(entities)
  /** Locations as a tree: everything at the top, and the children of each place on the way to the current page. */
  const locationTree = (parentId: string | undefined, depth: number): ReactNode => {
    const kids = entities.filter(
      (e) => e.type === 'location' && (parentId ? e.parentId === parentId && !roots.has(e.id) : roots.has(e.id)),
    )
    if (!kids.length) return null
    return (
      <div className="nav-children">
        {kids.map((e) => {
          const hasKids = entities.some((x) => x.type === 'location' && x.parentId === e.id && !roots.has(x.id))
          const key = `loc:${e.id}`
          // Open on the way to the current page, and open a lone top-level place (usually the whole region).
          const auto = path.has(e.id) || (depth === 0 && kids.length === 1)
          return (
            <div key={e.id}>
              <div className="nav-row">
                {hasKids ? caret(key, auto, e.name) : <span className="nav-caret-space" />}
                <NavLink to={`${pagePath(worldId, e.id)}`}>{e.name}</NavLink>
              </div>
              {hasKids && open(key, auto) && depth < 12 && locationTree(e.id, depth + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  const pageList = (t: EntityType, custom?: CustomType) => {
    const list = entities.filter((e) => e.type === t && (!custom || e.customType === custom.id))
    // Keep the current page in view even if the list is long.
    const shown = list.slice(0, MAX_CHILDREN)
    if (currentEntity?.type === t && !shown.includes(currentEntity)) shown.push(currentEntity)
    return (
      <div className="nav-children">
        {shown.map((e: Entity) => (
          <NavLink key={e.id} to={`${pagePath(worldId, e.id)}`}>
            {e.name}
          </NavLink>
        ))}
        {list.length > shown.length && (
          <NavLink end to={`${typePath(worldId, t, custom?.id)}`} className="nav-more">
            All {list.length} {(custom ?? ENTITY_LABELS[t]).many.toLowerCase()}…
          </NavLink>
        )}
      </div>
    )
  }

  const codex = () => {
    const builtIn = ENTITY_TYPES.filter((t) => t !== 'thread' && t !== 'table' && t !== 'custom')
    // Empty types wait behind "more types" so a young world's menu stays short. Players never see empty ones.
    const used = builtIn.filter((t) => countOf(t) > 0 || t === type)
    const shown = allTypes || (isGM && !used.length) ? builtIn : used
    const hidden = isGM ? builtIn.length - shown.length : 0
    return (
      <>
        {shown.map((t) => {
          const n = countOf(t)
          const key = `type:${t}`
          const auto = t === type
          return (
            <div key={t}>
              <div className="nav-row">
                {n > 0 ? caret(key, auto, ENTITY_LABELS[t].many.toLowerCase()) : <span className="nav-caret-space" />}
                <NavLink end to={`${typePath(worldId, t)}`}>
                  <TypeIcon type={t} /> {ENTITY_LABELS[t].many}
                  {n ? <span className="count">{n}</span> : null}
                </NavLink>
              </div>
              {n > 0 && open(key, auto) && (t === 'location' ? locationTree(undefined, 0) : pageList(t))}
            </div>
          )
        })}
        {world?.customTypes?.map((c) => {
          const n = entities.filter((e) => e.type === 'custom' && e.customType === c.id).length
          if (!n && !isGM) return null
          const key = `custom:${c.id}`
          const auto = type === 'custom' && kind === c.id
          return (
            <div key={c.id}>
              <div className="nav-row">
                {n > 0 ? caret(key, auto, c.many.toLowerCase()) : <span className="nav-caret-space" />}
                <NavLink end to={`${typePath(worldId, 'custom', c.id)}`}>
                  <TypeIcon type="custom" custom={c} /> {c.many}
                  {n ? <span className="count">{n}</span> : null}
                </NavLink>
              </div>
              {n > 0 && open(key, auto) && pageList('custom', c)}
            </div>
          )
        })}
        {(hidden > 0 || allTypes) && (
          <div className="nav-row">
            <span className="nav-caret-space" />
            <button type="button" className="nav-more-types" onClick={() => setAllTypes(!allTypes)}>
              <Ico as={Plus} /> {allTypes ? 'Hide empty types' : `${hidden} more type${hidden === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </>
    )
  }

  const campaignTree = () =>
    campaigns.map((c) => {
      const own = sessions.filter((s) => s.campaignId === c.id).sort((a, b) => a.number - b.number)
      const key = `camp:${c.id}`
      const auto = c.id === campaignId
      return (
        <div key={c.id}>
          <div className="nav-row">
            {own.length > 0 ? caret(key, auto, 'sessions') : <span className="nav-caret-space" />}
            <NavLink end to={`${worldPath(worldId)}/c/${c.id}`}>
              <Ico as={DiceFive} /> {c.name}
            </NavLink>
          </div>
          {own.length > 0 && open(key, auto) && (
            <div className="nav-children">
              {own.map((s) => (
                <div key={s.id}>
                  <NavLink end to={`${worldPath(worldId)}/s/${s.id}`}>
                    #{s.number} {s.title}
                  </NavLink>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    })

  if (mode === 'world' || mode === 'home')
    return (
      <nav>
        {group(
          'atlas',
          'Atlas',
          HELP.maps,
          <>
            <div className="nav-row">
              {maps.length > 0 ? caret('maps', inMaps, 'maps') : <span className="nav-caret-space" />}
              <NavLink end to={`${worldPath(worldId)}/maps`} title={HELP.maps}><Ico as={MapTrifold} /> Maps</NavLink>
            </div>
            {open('maps', inMaps) && maps.length > 0 && (
              <div className="nav-children">
                {maps
                  .filter((m) => canSee(m.visibility))
                  .map((m) => (
                    <NavLink key={m.id} to={`${worldPath(worldId)}/maps/${m.id}`}>
                      {m.name}
                    </NavLink>
                  ))}
              </div>
            )}
            <div className="nav-row">
              <span className="nav-caret-space" />
              <NavLink to={`${worldPath(worldId)}/timeline`} title={HELP.timeline}><Ico as={Hourglass} /> Timeline</NavLink>
            </div>
            {isGM && (
              <div className="nav-row">
                <span className="nav-caret-space" />
                <NavLink to={`${worldPath(worldId)}/chronicle`} title={HELP.chronicle}><Ico as={BookBookmark} /> The Chronicle</NavLink>
              </div>
            )}
            {(isGM || hasLinks) && (
              <div className="nav-row">
                <span className="nav-caret-space" />
                <NavLink to={`${worldPath(worldId)}/web`} title={HELP.relationWeb}><Ico as={Graph} /> Relationships</NavLink>
              </div>
            )}
          </>,
        )}
        {group('codex', 'Codex', HELP.codex, codex())}
        {isGM &&
          group(
            'files',
            'Files',
            HELP.assets,
            <div className="nav-row">
              <span className="nav-caret-space" />
              <NavLink to={`${worldPath(worldId)}/assets`} title={HELP.assets}><Ico as={Folder} /> Files</NavLink>
            </div>,
          )}
      </nav>
    )

  if (mode === 'prep')
    return (
      <nav>
        {group('campaigns', 'Campaigns', HELP.campaign, campaigns.length ? campaignTree() : <p className="small muted nav-note">Make a campaign from Home.</p>)}
        {group(
          'story',
          'Story',
          HELP.threads,
          <>
            <NavLink to={`${worldPath(worldId)}/threads`} title={HELP.threads}>
              <Ico as={Spiral} /> Loose threads
              {openThreads ? <span className="count">{openThreads}</span> : null}
            </NavLink>
            <NavLink to={`${worldPath(worldId)}/handouts`} title={HELP.handouts}><Ico as={Newspaper} /> Handouts</NavLink>
          </>,
        )}
        {group(
          'tools',
          'Tools',
          HELP.prepTools,
          <>
            <NavLink to={`${worldPath(worldId)}/archivist`} title={HELP.archivist}><Ico as={Books} /> The Archivist</NavLink>
            <NavLink to={`${worldPath(worldId)}/generators`} title={HELP.generators}><Ico as={DiceFive} /> Generators &amp; tables</NavLink>
            <NavLink to={`${worldPath(worldId)}/boards`} title={HELP.boards}><Ico as={PushPin} /> Corkboards</NavLink>
          </>,
        )}
      </nav>
    )

  if (mode === 'play')
    return (
      <nav>
        {next && (
          <NavLink className="button primary nav-run" to={`${worldPath(worldId)}/s/${next.id}/lectern`} title={HELP.lectern}>
            <Ico as={Play} weight="fill" /> Run #{next.number} {next.title}
          </NavLink>
        )}
        {group(
          'table',
          'At the table',
          HELP.atTheTable,
          <>
            {currentSession && (
              <NavLink to={`${worldPath(worldId)}/s/${currentSession.id}/lectern`} title={HELP.lectern}><Ico as={BookOpen} /> The Lectern</NavLink>
            )}
            <NavLink to={`${worldPath(worldId)}/clocks`} title={HELP.clocks}>
              <Ico as={Timer} /> Clocks
              {clockCount ? <span className="count">{clockCount}</span> : null}
            </NavLink>
            <NavLink to={`${worldPath(worldId)}/sounds`} title={HELP.soundboard}><Ico as={MusicNotes} /> Soundboard</NavLink>
            {safetyLink}
            <NavLink to={`${worldPath(worldId)}/loot`} title={HELP.loot}><Ico as={Backpack} /> Party loot</NavLink>
          </>,
        )}
        {(world?.cloud?.enabled || gmQuestions.available) &&
          group(
            'players',
            'Players',
            HELP.players,
            <>
              {world?.cloud?.enabled && (
                <NavLink to={`${worldPath(worldId)}/settings?tab=players`} title={HELP.players}>
                  <Ico as={UsersThree} /> Players
                  {pendingClaims ? <span className="count alert">{pendingClaims}</span> : null}
                </NavLink>
              )}
              {gmQuestions.available && (
                <NavLink to={`${worldPath(worldId)}/questions`} title={HELP.questionsGm}>
                  <Ico as={ChatCircleDots} /> Questions and downtime
                  {waiting ? <span className="count alert">{waiting}</span> : null}
                </NavLink>
              )}
              {world?.cloud?.enabled && (
                <NavLink to={`${worldPath(worldId)}/scratchpad`} title={HELP.gmPlayerNotes}><Ico as={Notepad} /> Players’ scratchpad</NavLink>
              )}
            </>,
          )}
      </nav>
    )

  // Players: everything for the table in one list.
  return (
    <nav>
      {group(
        'table',
        'At the table',
        undefined,
        <>
          <NavLink to={`${worldPath(worldId)}/threads`} title={HELP.leads}>
            <Ico as={Spiral} /> Leads
            {openThreads ? <span className="count">{openThreads}</span> : null}
          </NavLink>
          {handouts > 0 && <NavLink to={`${worldPath(worldId)}/handouts`} title={HELP.handouts}><Ico as={Newspaper} /> Handouts</NavLink>}
          {hasLoot && <NavLink to={`${worldPath(worldId)}/loot`} title={HELP.loot}><Ico as={Backpack} /> Party loot</NavLink>}
          {clockCount > 0 && (
            <NavLink to={`${worldPath(worldId)}/clocks`} title={HELP.clocks}>
              <Ico as={Timer} /> Clocks <span className="count">{clockCount}</span>
            </NavLink>
          )}
          {safetyLink}
          {world?.shared?.memberOf && (
            <>
              <NavLink to={`${worldPath(worldId)}/scratchpad`} title={HELP.scratchpad}><Ico as={Notepad} /> Scratchpad</NavLink>
              <NavLink to={`${worldPath(worldId)}/questions`} title={HELP.questions}><Ico as={ChatCircleDots} /> Questions for the GM</NavLink>
            </>
          )}
        </>,
      )}
      {(isGM || campaigns.length > 0) && group('campaigns', 'Campaigns', HELP.campaign, campaignTree())}
    </nav>
  )
}
