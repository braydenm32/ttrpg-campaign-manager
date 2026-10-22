import { useLiveQuery } from 'dexie-react-hooks'
import { HELP } from './help'
import { useState, type ReactNode } from 'react'
import { matchPath, NavLink, useLocation } from 'react-router-dom'
import { db, ENTITY_LABELS, ENTITY_TYPES, type CustomType, type Entity, type EntityType } from './db'
import { useVisibleEntities, useWorld } from './hooks'
import { useWorldSessions } from './threads'
import { useViewMode } from './viewMode'

/** Longest list shown under a codex section before linking to the full list. */
const MAX_CHILDREN = 25

/**
 * The world's sidebar menu. Sections open up underneath as you go deeper:
 * a campaign shows its sessions, a session shows the Lectern, a codex section shows its pages,
 * and locations open as a tree down to wherever you are.
 */
export function WorldNav({ worldId }: { worldId: string }) {
  const { isGM, canSee } = useViewMode()
  const { world } = useWorld()
  const { pathname } = useLocation()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useLiveQuery(() => db.campaigns.where({ worldId }).toArray(), [worldId]) ?? []
  const maps = useLiveQuery(() => db.maps.where({ worldId }).sortBy('name'), [worldId]) ?? []
  // Sections the user opened or closed by hand; anything not listed follows where you are.
  const [manual, setManual] = useState<Record<string, boolean>>({})

  const at = (pattern: string): Record<string, string | undefined> | null =>
    matchPath({ path: `/w/:worldId/${pattern}`, end: false }, pathname)?.params ?? null
  const sessionId = at('s/:sessionId')?.sessionId
  const currentSession = sessions.find((s) => s.id === sessionId)
  const campaignId = at('c/:campaignId')?.campaignId ?? currentSession?.campaignId
  const entityId = at('e/:entityId')?.entityId
  const currentEntity = entities.find((e) => e.id === entityId)
  const type = (at('type/:type')?.type as EntityType | undefined) ?? currentEntity?.type
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

  const countOf = (t: EntityType) => entities.filter((e) => e.type === t).length
  const kind = at('type/custom/:kind')?.kind ?? (currentEntity?.type === 'custom' ? currentEntity.customType : undefined)
  const hasLoot = entities.some((e) => e.type === 'item' && e.heldBy) || !!world?.partyCoin?.length
  const openThreads = entities.filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active')).length

  /** Locations as a tree: everything at the top, and the children of each place on the way to the current page. */
  const locationTree = (parentId: string | undefined, depth: number): ReactNode => {
    const ids = new Set(entities.map((e) => e.id))
    const kids = entities.filter(
      (e) => e.type === 'location' && (parentId ? e.parentId === parentId : !e.parentId || !ids.has(e.parentId)),
    )
    if (!kids.length) return null
    return (
      <div className="nav-children">
        {kids.map((e) => {
          const hasKids = entities.some((x) => x.type === 'location' && x.parentId === e.id)
          const key = `loc:${e.id}`
          // Open on the way to the current page, and open a lone top-level place (usually the whole region).
          const auto = path.has(e.id) || (depth === 0 && kids.length === 1)
          return (
            <div key={e.id}>
              <div className="nav-row">
                {hasKids ? caret(key, auto, e.name) : <span className="nav-caret-space" />}
                <NavLink to={`/w/${worldId}/e/${e.id}`}>{e.name}</NavLink>
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
          <NavLink key={e.id} to={`/w/${worldId}/e/${e.id}`}>
            {e.name}
          </NavLink>
        ))}
        {list.length > shown.length && (
          <NavLink end to={`/w/${worldId}/type/${t}${custom ? `/${custom.id}` : ''}`} className="nav-more">
            All {list.length} {(custom ?? ENTITY_LABELS[t]).many.toLowerCase()}…
          </NavLink>
        )}
      </div>
    )
  }

  return (
    <nav>
      <NavLink end to={`/w/${worldId}`} title={HELP.overview}>🏠 Overview</NavLink>
      <div className="nav-row">
        {maps.length > 0 ? caret('maps', inMaps, 'maps') : <span className="nav-caret-space" />}
        <NavLink end to={`/w/${worldId}/maps`} title={HELP.maps}>🗺️ Maps</NavLink>
      </div>
      {open('maps', inMaps) && maps.length > 0 && (
        <div className="nav-children">
          {maps
            .filter((m) => canSee(m.visibility))
            .map((m) => (
              <NavLink key={m.id} to={`/w/${worldId}/maps/${m.id}`}>
                {m.name}
              </NavLink>
            ))}
        </div>
      )}
      <NavLink to={`/w/${worldId}/timeline`} title={HELP.timeline}>⏳ Timeline</NavLink>
      <NavLink to={`/w/${worldId}/threads`} title={isGM ? HELP.threads : HELP.leads}>
        🧵 {isGM ? 'Loose threads' : 'Leads'}
        {openThreads ? <span className="count">{openThreads}</span> : null}
      </NavLink>
      {(isGM || hasLoot) && (
        <NavLink to={`/w/${worldId}/loot`} title={HELP.loot}>🎒 Party loot</NavLink>
      )}
      {(world?.shared?.memberOf || (!world?.shared && world?.cloud?.enabled)) && (
        <NavLink to={`/w/${worldId}/scratchpad`} title={world.shared ? HELP.scratchpad : HELP.gmPlayerNotes}>📝 {world.shared ? 'Scratchpad' : 'Players’ scratchpad'}</NavLink>
      )}

      <div className="nav-heading" title={HELP.campaign}>Campaigns</div>
      {campaigns.map((c) => {
        const own = sessions.filter((s) => s.campaignId === c.id).sort((a, b) => a.number - b.number)
        const key = `camp:${c.id}`
        const auto = c.id === campaignId
        return (
          <div key={c.id}>
            <div className="nav-row">
              {own.length > 0 ? caret(key, auto, 'sessions') : <span className="nav-caret-space" />}
              <NavLink end to={`/w/${worldId}/c/${c.id}`}>🎲 {c.name}</NavLink>
            </div>
            {own.length > 0 && open(key, auto) && (
              <div className="nav-children">
                {own.map((s) => (
                  <div key={s.id}>
                    <NavLink end to={`/w/${worldId}/s/${s.id}`}>
                      #{s.number} {s.title}
                    </NavLink>
                    {isGM && s.id === sessionId && (
                      <div className="nav-children">
                        <NavLink to={`/w/${worldId}/s/${s.id}/lectern`} title={HELP.lectern}>📖 The Lectern</NavLink>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="nav-heading" title={HELP.codex}>Codex</div>
      {ENTITY_TYPES.filter((t) => t !== 'thread' && t !== 'table' && t !== 'custom').map((t) => {
        const n = countOf(t)
        const key = `type:${t}`
        const auto = t === type
        return (
          <div key={t}>
            <div className="nav-row">
              {n > 0 ? caret(key, auto, ENTITY_LABELS[t].many.toLowerCase()) : <span className="nav-caret-space" />}
              <NavLink end to={`/w/${worldId}/type/${t}`}>
                {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].many}
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
              <NavLink end to={`/w/${worldId}/type/custom/${c.id}`}>
                {c.icon} {c.many}
                {n ? <span className="count">{n}</span> : null}
              </NavLink>
            </div>
            {n > 0 && open(key, auto) && pageList('custom', c)}
          </div>
        )
      })}

      {isGM && (
        <>
          <div className="nav-heading">GM tools</div>
          <NavLink to={`/w/${worldId}/generators`} title={HELP.generators}>🎰 Generators</NavLink>
          <NavLink to={`/w/${worldId}/type/table`} title={HELP.randomTables}>🎲 Random tables</NavLink>
          <NavLink to={`/w/${worldId}/assets`} title={HELP.assets}>📁 Assets</NavLink>
          <NavLink to={`/w/${worldId}/settings`}>⚙️ World settings</NavLink>
        </>
      )}
    </nav>
  )
}
