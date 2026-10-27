import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { db, ENTITY_LABELS, newId, type Entity, type Relation } from './db'
import { Ico, TypeIcon } from './icons'
import { Graph } from '@phosphor-icons/react'
import { pagePath, worldPath } from './paths'

/**
 * Relationships between pages: family, friends and foes, who serves whom. Each link is stored once,
 * on the page it was added from, and shown on both pages (read backwards on the other one).
 */

export const RELATION_KINDS: { kind: string; inverse: string; family?: 'parent' | 'partner' | 'sibling' }[] = [
  { kind: 'parent of', inverse: 'child of', family: 'parent' },
  { kind: 'child of', inverse: 'parent of', family: 'parent' },
  { kind: 'married to', inverse: 'married to', family: 'partner' },
  { kind: 'partner of', inverse: 'partner of', family: 'partner' },
  { kind: 'sibling of', inverse: 'sibling of', family: 'sibling' },
  { kind: 'friend of', inverse: 'friend of' },
  { kind: 'ally of', inverse: 'ally of' },
  { kind: 'enemy of', inverse: 'enemy of' },
  { kind: 'rival of', inverse: 'rival of' },
  { kind: 'loves', inverse: 'loved by' },
  { kind: 'serves', inverse: 'served by' },
  { kind: 'works for', inverse: 'employs' },
  { kind: 'member of', inverse: 'has member' },
  { kind: 'leads', inverse: 'led by' },
  { kind: 'mentor of', inverse: 'student of' },
  { kind: 'owes', inverse: 'is owed by' },
  { kind: 'knows a secret about', inverse: 'has a secret known by' },
]

const byKind = new Map(RELATION_KINDS.map((k) => [k.kind, k]))
export const inverseOf = (kind: string) => byKind.get(kind)?.inverse ?? `${kind} (from the other side)`
export const familyOf = (kind: string) => byKind.get(kind)?.family
/** Friendly, hostile or neither, for colouring lines. */
export function toneOf(kind: string) {
  if (/enemy|rival|hate|owes|secret/.test(kind)) return 'hostile'
  if (/friend|ally|love|married|partner|parent|child|sibling|mentor|student/.test(kind)) return 'friendly'
  return 'neutral'
}

/** Every link involving a page, read from its side: "parent of Mira", "served by the Iron Guard". */
export function linksOf(e: Entity, entities: Entity[]) {
  const byId = new Map(entities.map((x) => [x.id, x]))
  const out: { rel: Relation; owner: Entity; other: Entity; label: string }[] = []
  for (const r of e.relations ?? []) {
    const other = byId.get(r.to)
    if (other) out.push({ rel: r, owner: e, other, label: r.kind })
  }
  for (const x of entities)
    if (x.id !== e.id) for (const r of x.relations ?? []) if (r.to === e.id) out.push({ rel: r, owner: x, other: x, label: inverseOf(r.kind) })
  return out
}

async function changeRelations(entityId: string, fn: (list: Relation[]) => Relation[]) {
  await db.entities
    .where('id')
    .equals(entityId)
    .modify((x) => {
      x.relations = fn(x.relations ?? [])
      x.updatedAt = Date.now()
    })
}

/** The Relationships box on a page: links both ways, and (for the GM) adding and removing them. */
export function RelationsBox({ entity, entities, isGM, worldId }: { entity: Entity; entities: Entity[]; isGM: boolean; worldId: string }) {
  const links = linksOf(entity, entities)
  const [adding, setAdding] = useState(false)
  if (!links.length && !isGM) return null
  if (!links.length && !adding)
    return (
      <button className="add-extra" onClick={() => setAdding(true)}>
        <Ico as={Graph} /> Add a relationship
      </button>
    )
  return (
    <section className="relations">
      <div className="section-header">
        <h2>
          <Ico as={Graph} /> Relationships <Help topic="relations" />
        </h2>
        <div className="row">
          <Link className="small" to={`${worldPath(worldId)}/web?focus=${entity.id}`}>
            See the web
          </Link>
          {isGM && !adding && <button onClick={() => setAdding(true)}>+ Link</button>}
        </div>
      </div>
      {links.length > 0 && (
        <ul className="entity-list relation-list">
          {links.map(({ rel, owner, other, label }) => (
            <li key={rel.id} className={`tone-${toneOf(rel.kind)}`}>
              <span className="muted">{label}</span>{' '}
              <Link to={`${pagePath(worldId, other.id)}`}>
                <TypeIcon type={other.type} /> {other.name}
              </Link>
              {rel.note && <span className="muted small"> · {rel.note}</span>}
              {isGM && (
                <span className="row relation-tools">
                  <label className="small inline-check" title="Players can see this link (when they can see both pages)">
                    <input
                      type="checkbox"
                      checked={!!rel.known}
                      onChange={(e) => {
                        const known = e.target.checked
                        changeRelations(owner.id, (l) => l.map((r) => (r.id === rel.id ? { ...r, known: known || undefined } : r)))
                      }}
                    />{' '}
                    Players know
                  </label>
                  <button className="ghost small" title="Remove this link" onClick={() => changeRelations(owner.id, (l) => l.filter((r) => r.id !== rel.id))}>
                    ×
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {isGM && adding && <AddRelation entity={entity} entities={entities} onDone={() => setAdding(false)} />}
    </section>
  )
}

const KNOWN_KEY = 'codex.relationKnown'

function AddRelation({ entity, entities, onDone }: { entity: Entity; entities: Entity[]; onDone: () => void }) {
  const [kind, setKind] = useState('ally of')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [known, setKnown] = useState(() => {
    try {
      return localStorage.getItem(KNOWN_KEY) === '1'
    } catch {
      return false
    }
  })
  const candidates = entities.filter((x) => x.id !== entity.id && x.type !== 'table' && x.type !== 'thread')
  return (
    <form
      className="row wrap add-relation"
      onSubmit={async (ev) => {
        ev.preventDefault()
        if (!to || !kind.trim()) return
        try {
          localStorage.setItem(KNOWN_KEY, known ? '1' : '0')
        } catch {
          // Storage blocked; the default just isn't remembered.
        }
        await changeRelations(entity.id, (l) => [...l, { id: newId(), to, kind: kind.trim(), note: note.trim() || undefined, known: known || undefined }])
        setTo('')
        setNote('')
        onDone()
      }}
    >
      <span className="muted">{entity.name} is</span>
      <input list="relation-kinds" value={kind} onChange={(e) => setKind(e.target.value)} className="relation-kind" aria-label="Relationship" />
      <datalist id="relation-kinds">
        {RELATION_KINDS.map((k) => (
          <option key={k.kind} value={k.kind} />
        ))}
      </datalist>
      <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Who">
        <option value="">Who?</option>
        {candidates.map((x) => (
          <option key={x.id} value={x.id}>
            {ENTITY_LABELS[x.type].icon} {x.name}
          </option>
        ))}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <label className="small inline-check">
        <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} /> Players know
      </label>
      <button className="primary" disabled={!to || !kind.trim()}>
        Add
      </button>
      <button type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  )
}
