import { PagePicker } from './PagePicker'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { db, newId, type Entity, type Relation } from './db'
import { Ico, TypeIcon } from './icons'
import { CaretDown, Graph } from '@phosphor-icons/react'
import { toast } from './undo'
import { pagePath, worldPath } from './paths'

/**
 * Relationships between pages: family, friends and foes, who serves whom. Each link is stored once,
 * on the page it was added from, and shown on both pages (read backwards on the other one).
 */

/** The common relationships, most used first: the list under the Relationship box's arrow. Any other words work too. */
export const RELATION_KINDS: { kind: string; inverse: string; family?: 'parent' | 'partner' | 'sibling' }[] = [
  { kind: 'friend of', inverse: 'friend of' },
  { kind: 'ally of', inverse: 'ally of' },
  { kind: 'enemy of', inverse: 'enemy of' },
  { kind: 'rival of', inverse: 'rival of' },
  { kind: 'lover of', inverse: 'lover of' },
  { kind: 'married to', inverse: 'married to', family: 'partner' },
  { kind: 'partner of', inverse: 'partner of', family: 'partner' },
  { kind: 'parent of', inverse: 'child of', family: 'parent' },
  { kind: 'child of', inverse: 'parent of', family: 'parent' },
  { kind: 'sibling of', inverse: 'sibling of', family: 'sibling' },
  { kind: 'mentor of', inverse: 'student of' },
  { kind: 'student of', inverse: 'mentor of' },
  { kind: 'serves', inverse: 'served by' },
  { kind: 'works for', inverse: 'employs' },
  { kind: 'member of', inverse: 'has member' },
  { kind: 'leads', inverse: 'led by' },
  { kind: 'loves', inverse: 'loved by' },
  { kind: 'hates', inverse: 'hated by' },
  { kind: 'owes', inverse: 'is owed by' },
  { kind: 'knows a secret about', inverse: 'has a secret known by' },
]

const byKind = new Map(RELATION_KINDS.map((k) => [k.kind, k]))
/** "employs" typed by hand reads back as "works for" on the other page, too. */
const byInverse = new Map(RELATION_KINDS.filter((k) => !byKind.has(k.inverse)).map((k) => [k.inverse, k.kind]))
const norm = (kind: string) => kind.trim().toLowerCase()
export const inverseOf = (kind: string) => byKind.get(norm(kind))?.inverse ?? byInverse.get(norm(kind)) ?? `${kind} (from the other side)`
export const familyOf = (kind: string) => byKind.get(norm(kind))?.family
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
                  <label className="small inline-check" title="Players can see this link and its note (when they can see both pages)">
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
                  <button
                    className="ghost small"
                    title="Remove this link"
                    aria-label={`Remove “${label} ${other.name}”`}
                    onClick={async () => {
                      await changeRelations(owner.id, (l) => l.filter((r) => r.id !== rel.id))
                      toast(`Removed “${label} ${other.name}”.`, () => changeRelations(owner.id, (l) => (l.some((r) => r.id === rel.id) ? l : [...l, rel])))
                    }}
                  >
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
  const [kind, setKind] = useState('')
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
      <RelationKindPicker
        value={kind}
        onChange={setKind}
        entities={entities}
        onChosen={(input) => input.closest('form')?.querySelector<HTMLInputElement>('.relation-who input')?.focus()}
      />
      <PagePicker entities={candidates} value={to} onPick={setTo} placeholder="Who? Type a name…" label="Who" recent className="relation-who" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="relation-note" aria-label="Note" />
      <label className="small inline-check" title="Players can see this link and its note (when they can see both pages)">
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

/**
 * The Relationship box: type anything ("sworn to", "owes a life debt to"), with matching suggestions
 * popping up as you type. The arrow lists the common ones, plus any your world already uses.
 */
function RelationKindPicker({
  value,
  onChange,
  entities,
  onChosen,
}: {
  value: string
  onChange: (kind: string) => void
  entities: Entity[]
  /** After a suggestion is picked, e.g. to move on to the "Who?" box. */
  onChosen?: (input: HTMLInputElement) => void
}) {
  // 'typing' shows what matches the words in the box; 'all' (the arrow) shows the whole list.
  const [open, setOpen] = useState<false | 'typing' | 'all'>(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const common = RELATION_KINDS.map((k) => k.kind)
  const used = new Map<string, number>()
  for (const e of entities)
    for (const r of e.relations ?? []) {
      const k = r.kind.trim()
      if (k && !byKind.has(norm(k))) used.set(k, (used.get(k) ?? 0) + 1)
    }
  const yours = [...used.keys()].sort((a, b) => used.get(b)! - used.get(a)! || a.localeCompare(b))
  const all = [...common, ...yours]
  const needle = norm(value)
  const shown =
    open === 'typing' && needle
      ? all
          .filter((k) => norm(k).includes(needle) && norm(k) !== needle)
          .sort((a, b) => Number(norm(b).startsWith(needle)) - Number(norm(a).startsWith(needle)))
          .slice(0, 10)
      : all
  const isOpen = !!open && shown.length > 0
  const choose = (kind: string, input: HTMLInputElement | null) => {
    onChange(kind)
    setOpen(false)
    setActive(-1)
    if (input) onChosen?.(input)
  }
  return (
    <div className="kind-picker">
      <input
        role="combobox"
        aria-label="Relationship"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        autoComplete="off"
        value={value}
        placeholder="Relationship, e.g. friend of"
        onFocus={() => setOpen('typing')}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen('typing')
          setActive(-1)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!isOpen) setOpen(needle ? 'typing' : 'all')
            setActive((a) => Math.max(0, Math.min(shown.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1))))
          } else if (e.key === 'Enter' && isOpen && shown[active]) {
            e.preventDefault()
            choose(shown[active], e.currentTarget)
          } else if (e.key === 'Escape' && isOpen) {
            e.preventDefault()
            setOpen(false)
          }
        }}
      />
      <button
        type="button"
        className="kind-picker-arrow"
        tabIndex={-1}
        aria-label="Show common relationships"
        title="Show common relationships"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const input = e.currentTarget.parentElement?.querySelector('input')
          if (open === 'all') setOpen(false)
          else {
            setOpen('all')
            setActive(-1)
            input?.focus()
          }
        }}
      >
        <Ico as={CaretDown} />
      </button>
      {isOpen && (
        <ul className="page-picker-list kind-picker-list" role="listbox" id={listId} aria-label="Relationships">
          {shown.map((k, i) => (
            <li key={k} className={i === active ? 'active' : ''}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(ev) => ev.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={(ev) => choose(k, ev.currentTarget.closest('.kind-picker')?.querySelector('input') ?? null)}
              >
                {k}
                {used.has(k) && <small className="muted"> · used in this world</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
