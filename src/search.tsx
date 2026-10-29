import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useGuardedNavigate } from './ai/leave'
import { db, ENTITY_LABELS, PICKER_TYPES, typeLabel, type Entity, type Session, type World, type WorldMap } from './db'
import { Help, HELP } from './help'
import { Ico, TypeIcon } from './icons'
import { BookOpen, Lock, MagnifyingGlass, MapTrifold, Plus, ArrowRight } from '@phosphor-icons/react'
import { useCreatePage } from './NewPage'
import { useVisibleEntities } from './hooks'
import { stripSecrets } from './Markdown'
import { listedEntries } from './tables'
import { plainLinks } from './text'
import { useWorldSessions } from './threads'
import { useViewMode } from './viewMode'
import { pagePath, worldPath } from './paths'

/**
 * Search everything: page names, nicknames, summaries, details, tags and the text itself, plus
 * session notes and recaps, and map names. Players search only what they can read (no secret
 * passages, no GM notes). Opened from the sidebar, or with Ctrl+K (⌘K on a Mac) anywhere in a world.
 */

export interface Hit {
  key: string
  to: string
  icon: string
  title: string
  /** A little of the text around the match. */
  snippet: string
  score: number
  /** Drawn instead of the emoji icon where there's room for a line icon. */
  node?: ReactNode
  /** A page only the GM can see. */
  gmOnly?: boolean
  /** An action (like making a new page) instead of a page to open. */
  run?: () => void
}

/** The words around the first match, for showing under a result. */
function around(text: string, q: string) {
  const flat = text.replace(/^[ \t]*:::.*$/gim, (line) => line.replace(/^[ \t]*:::[ \t]*(gm|for[^:]*)?:{0,3}/i, '').replace(/:::[ \t]*$/, '')).replace(/[#>*_`~|]+/g, ' ').replace(/\s+/g, ' ').trim()
  const i = flat.toLowerCase().indexOf(q)
  if (i < 0) return ''
  const start = Math.max(0, i - 50)
  return `${start ? '…' : ''}${flat.slice(start, i + q.length + 70)}${i + q.length + 70 < flat.length ? '…' : ''}`
}

export function searchWorld(
  query: string,
  { worldId, world, entities, sessions, maps, isGM }: { worldId: string; world?: World | null; entities: Entity[]; sessions: Session[]; maps: WorldMap[]; isGM: boolean },
): Hit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const text = (t: string | undefined) => plainLinks(isGM ? (t ?? '') : stripSecrets(t ?? ''))
  const hits: Hit[] = []
  for (const e of entities) {
    const names = [e.name, ...(isGM ? (e.aliases ?? []) : [])]
    const tags = [...e.tags, ...(isGM ? (e.gmTags ?? []) : [])]
    const fields = e.fields.filter((f) => isGM || !f.gm).map((f) => `${f.key}: ${f.value}`)
    const body = text(e.body)
    const extra = plainLinks([isGM ? e.gmNotes : '', text(e.playerBody), ...(isGM ? (e.entries ?? []) : listedEntries(e, false))].join('\n'))
    let score = 0
    let snippet = ''
    if (names.some((n) => n.toLowerCase() === q)) score = 100
    else if (names.some((n) => n.toLowerCase().startsWith(q))) score = 80
    else if (names.some((n) => n.toLowerCase().includes(q))) score = 60
    if (!score && (e.summary.toLowerCase().includes(q) || tags.some((t) => t.toLowerCase().includes(q)))) score = 40
    if (!score && fields.some((f) => f.toLowerCase().includes(q))) {
      score = 30
      snippet = fields.find((f) => f.toLowerCase().includes(q))!
    }
    if (!score && (body.toLowerCase().includes(q) || extra.toLowerCase().includes(q))) {
      score = 20
      snippet = around(body, q) || around(extra, q)
    }
    if (score)
      hits.push({ key: e.id, to: `${pagePath(worldId, e.id)}`, icon: typeLabel(e, world).icon, node: <TypeIcon type={e.type} custom={world?.customTypes?.find((c) => c.id === e.customType)} />, title: e.name, snippet: snippet || e.summary, score, gmOnly: isGM && e.visibility === 'gm' })
  }
  for (const s of sessions) {
    const title = `#${s.number} ${s.title}`
    const recap = text(s.recap)
    const notes = isGM ? text(s.notes) : ''
    const inTitle = title.toLowerCase().includes(q)
    if (inTitle || recap.toLowerCase().includes(q) || notes.toLowerCase().includes(q))
      hits.push({ key: s.id, to: `${worldPath(worldId)}/s/${s.id}`, icon: '📖', node: <Ico as={BookOpen} />, title, snippet: inTitle ? s.date : around(recap, q) || around(notes, q), score: inTitle ? 50 : 15 })
  }
  for (const m of maps)
    if (m.name.toLowerCase().includes(q)) hits.push({ key: m.id, to: `${worldPath(worldId)}/maps/${m.id}`, icon: '🗺️', node: <Ico as={MapTrifold} />, title: m.name, snippet: 'Map', score: 45 })
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 40)
}

/** Places in the world you can jump to by name from the search box. */
const PLACES: [string, string, string, boolean][] = [
  ['Home', '', 'overview front page dashboard needs you', false],
  ['Maps', 'maps', 'map atlas', false],
  ['Timeline', 'timeline', 'history events', false],
  ['Relationships', 'web', 'web family tree who knows', false],
  ['Loose threads', 'threads', 'leads hooks', false],
  ['Clocks', 'clocks', 'countdown progress', false],
  ['Party loot', 'loot', 'treasure coin inventory items', false],
  ['Handouts', 'handouts', 'shown', false],
  ['Safety tools', 'safety', 'lines veils x-card', false],
  ['Soundboard', 'sounds', 'music ambience', true],
  ['The Archivist', 'archivist', 'ai claude ask question answer contradictions continuity check', true],
  ['Generators and random tables', 'generators', 'roll names tavern npc shop', true],
  ['Corkboards', 'boards', 'board pins strings', true],
  ['Files', 'assets', 'assets images uploads pictures', true],
  ['World settings', 'settings', 'options backup sync players invite', true],
]

/** Things to do rather than pages to open: "new npc", "clocks", "settings"… */
function commandHits(query: string, worldId: string, world: World | null | undefined, isGM: boolean, create: (type: Entity['type'], customType?: string) => void): Hit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: Hit[] = []
  const own = isGM && !world?.shared
  if (own) {
    const want = q.replace(/^(new|add|make|create)\s*/, '')
    const wantsNew = want !== q
    const types: [Entity['type'], string | undefined, string][] = [
      ...PICKER_TYPES.map((t) => [t, undefined, ENTITY_LABELS[t].one] as [Entity['type'], undefined, string]),
      ...(world?.customTypes ?? []).map((c) => ['custom', c.id, c.one] as [Entity['type'], string, string]),
    ]
    for (const [type, custom, one] of types) {
      const name = one.toLowerCase()
      if (want && !name.includes(want) && !(type === 'npc' && 'person character'.includes(want))) continue
      if (!wantsNew && !name.startsWith(q)) continue
      hits.push({ key: `new:${type}:${custom ?? ''}`, to: '', icon: '+', node: <Ico as={Plus} />, title: `New ${one}`, snippet: 'Make a new page', score: wantsNew ? 120 : 55, run: () => create(type, custom) })
    }
  }
  for (const [title, path, words, gmOnly] of PLACES) {
    if (gmOnly && !own) continue
    if (!title.toLowerCase().includes(q) && !words.includes(q)) continue
    hits.push({ key: `go:${path}`, to: `${worldPath(worldId)}${path ? `/${path}` : ''}`, icon: '→', node: <Ico as={ArrowRight} />, title, snippet: 'Go to', score: title.toLowerCase().startsWith(q) ? 90 : 35 })
  }
  return hits
}

/** Everything the search looks through, for the current viewer. */
export function useSearchable(worldId: string) {
  const { isGM, canSee } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const maps = useLiveQuery(() => db.maps.where({ worldId }).toArray(), [worldId]) ?? []
  return { entities, sessions, maps: maps.filter((m) => canSee(m.visibility)), isGM }
}

/** The search box: a pop-up with results as you type. Enter opens the first one. */
export function QuickSearch({ worldId, world, onClose }: { worldId: string; world?: World | null; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useGuardedNavigate()
  const data = useSearchable(worldId)
  const create = useCreatePage(world)
  const found = useMemo(() => searchWorld(query, { worldId, world, ...data }), [query, worldId, world, data])
  const hits = [...commandHits(query, worldId, world, data.isGM, create), ...found].sort((a, b) => b.score - a.score).slice(0, 40)
  const open = (h: Hit | undefined) => {
    if (!h) return
    onClose()
    if (h.run) h.run()
    else navigate(h.to)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal quick-search" role="dialog" aria-label="Search">
        <div className="row">
          <input
            autoFocus
            className="search"
            placeholder="Search, or type “new npc”, “clocks”…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1))
              else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
              else if (e.key === 'Enter') open(hits[active])
              else return
              e.preventDefault()
            }}
          />
          <Help topic="search" />
        </div>
        {query.trim() && (
          <ul className="search-results">
            {hits.map((h, i) => (
              <li key={h.key} className={i === active ? 'active' : ''}>
                <button className="link" onMouseEnter={() => setActive(i)} onClick={() => open(h)}>
                  <strong className="row">
                    {h.node ?? h.icon} {h.title}
                    {h.gmOnly && <span title="GM only" aria-label="GM only"><Ico as={Lock} /></span>}
                  </strong>
                  {h.snippet && <span className="muted small">{h.snippet}</span>}
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="muted">Nothing matches.</li>}
          </ul>
        )}
      </div>
    </div>
  )
}

/** The sidebar's search button, plus Ctrl+K / ⌘K to open the search from anywhere in the world. */
export function SearchButton({ worldId, world }: { worldId: string; world?: World | null }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <>
      <button className="search-button" onClick={() => setOpen(true)} aria-label="Search" title={HELP.search}>
        <Ico as={MagnifyingGlass} /> <span className="search-label">Search or jump to…</span> <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {open && <QuickSearch worldId={worldId} world={world} onClose={() => setOpen(false)} />}
    </>
  )
}
