import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { blankEntity, db, ENTITY_LABELS, type Entity, type EntityType, type Session } from './db'
import { Help } from './help'
import { nameIndex } from './links'
import { pagePath, worldPath } from './paths'

/**
 * Wanted pages: names written as [[links]] that no page answers to yet. Clicking one of these
 * links (as the GM) offers to make the page; Home lists them all so none get forgotten.
 */

/** Page types offered when making a page from a missing link, most likely first. */
export const MAKE_TYPES: EntityType[] = ['npc', 'location', 'faction', 'item', 'quest', 'shop', 'event', 'deity', 'lore']

/** Makes a GM-only page with this name and opens it for writing. */
export async function makeWantedPage(worldId: string, name: string, type: EntityType) {
  const e = blankEntity(worldId, type, name.trim())
  await db.entities.add(e)
  return e
}

export interface Wanted {
  name: string
  /** Where it's mentioned: pages and sessions, by id and name. */
  in: { kind: 'page' | 'session'; id: string; title: string }[]
}

const LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g

/** Every [[name]] in the world's pages and sessions that has no page, most mentioned first. */
export function wantedPages(entities: Entity[], sessions: Session[]): Wanted[] {
  const byName = nameIndex(entities)
  const found = new Map<string, Wanted>()
  const scan = (text: string | undefined, where: Wanted['in'][number]) => {
    for (const m of (text ?? '').matchAll(LINK)) {
      const name = m[1].trim()
      const key = name.toLowerCase()
      if (!key || byName.has(key)) continue
      const w = found.get(key) ?? { name, in: [] }
      if (!w.in.some((x) => x.id === where.id)) w.in.push(where)
      found.set(key, w)
    }
  }
  for (const e of entities) {
    if (e.template) continue
    const where = { kind: 'page' as const, id: e.id, title: e.name }
    for (const t of [e.body, e.gmNotes, e.summary, e.playerBody, ...(e.entries ?? [])]) scan(t, where)
  }
  for (const s of sessions) {
    const where = { kind: 'session' as const, id: s.id, title: `#${s.number} ${s.title}` }
    for (const t of [s.notes, s.recap, s.lectern?.sceneText]) scan(t, where)
  }
  return [...found.values()].sort((a, b) => b.in.length - a.in.length || a.name.localeCompare(b.name))
}

/** A row of page types: pick one to make the page and open it. */
export function MakePageButtons({ worldId, name, onMade }: { worldId: string; name: string; onMade?: () => void }) {
  const navigate = useNavigate()
  return (
    <span className="make-page-buttons">
      {MAKE_TYPES.map((t) => (
        <button
          key={t}
          className="ghost small"
          title={`Make “${name}” a new ${ENTITY_LABELS[t].one} page`}
          onClick={async () => {
            const e = await makeWantedPage(worldId, name, t)
            onMade?.()
            navigate(`${pagePath(worldId, e.id)}?edit=1&new=1`)
          }}
        >
          {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].one}
        </button>
      ))}
    </span>
  )
}

/** The little card that opens on a missing link: make the page now, as one of the common types. */
export function MakePagePopover({ worldId, name, left, top, onClose }: { worldId: string; name: string; left: number; top: number; onClose: () => void }) {
  return (
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div className="link-peek make-page" style={{ left, top }} role="dialog" aria-label={`Make a page for ${name}`}>
        <div>
          <div className="row spread">
            <strong>No page for “{name}” yet</strong>
            <button className="ghost small" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <p className="muted small">Make one now? It starts as GM only.</p>
          <MakePageButtons worldId={worldId} name={name} onMade={onClose} />
        </div>
      </div>
    </>
  )
}

/** Home's list of wanted pages, for the GM. */
export function WantedPages({ worldId, entities, sessions }: { worldId: string; entities: Entity[]; sessions: Session[] }) {
  const wanted = wantedPages(entities, sessions)
  const [open, setOpen] = useState<string>()
  if (!wanted.length) return null
  return (
    <section className="card wanted-pages">
      <h3>
        Wanted pages <span className="count">{wanted.length}</span> <Help topic="wantedPages" />
      </h3>
      <p className="muted small">Names you’ve linked with [[ ]] that don’t have a page yet.</p>
      <ul className="entity-list">
        {wanted.slice(0, 12).map((w) => (
          <li key={w.name}>
            <button className="link" onClick={() => setOpen(open === w.name ? undefined : w.name)} aria-expanded={open === w.name}>
              {w.name}
            </button>
            <span className="muted small">
              {' '}
              · in{' '}
              {w.in.slice(0, 3).map((x, i) => (
                <span key={x.id}>
                  {i > 0 && ', '}
                  <Link to={x.kind === 'page' ? pagePath(worldId, x.id) : `${worldPath(worldId)}/s/${x.id}`}>{x.title}</Link>
                </span>
              ))}
              {w.in.length > 3 && ` and ${w.in.length - 3} more`}
            </span>
            {open === w.name && (
              <div>
                <MakePageButtons worldId={worldId} name={w.name} />
              </div>
            )}
          </li>
        ))}
        {wanted.length > 12 && <li className="muted small">…and {wanted.length - 12} more</li>}
      </ul>
    </section>
  )
}
