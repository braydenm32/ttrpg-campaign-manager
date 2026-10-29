import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from '../help'
import { db, ENTITY_LABELS, newId, type Entity, type Session, type World, type WorldUpdate } from '../db'
import { Ico } from '../icons'
import { BookBookmark } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { applyUpdates, describe, LEDGER_NAME, namesIn, pageFinder, UPDATE_TYPES } from './worldUpdates'

const GROUPS: { title: string; kinds: WorldUpdate['kind'][] }[] = [
  { title: 'New pages', kinds: ['new'] },
  { title: 'Changes to pages', kinds: ['note', 'quest', 'status', 'item'] },
  { title: 'Relationships', kinds: ['relation'] },
  { title: 'Timeline', kinds: ['event'] },
  { title: 'Loose threads', kinds: ['thread'] },
  { title: 'Doesn’t match your notes', kinds: ['conflict'] },
]

/**
 * The changes Claude suggests to the world after a session, as a checklist. The GM ticks, edits
 * or skips each one, then applies them all at once. Nothing changes until then.
 */
export function WorldUpdatesReview({ world, session, entities }: { world: World; session: Session; entities: Entity[] }) {
  const draft = session.recapDraft!
  const [items, setItems] = useState<WorldUpdate[]>(draft.updates ?? [])
  const [editing, setEditing] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<number>()
  const find = useMemo(() => pageFinder(entities), [entities])
  const newNames = new Set(items.filter((u) => u.kind === 'new' && u.on && !u.useSameAs).map((u) => (u.kind === 'new' ? u.name.toLowerCase() : '')))
  const known = (name: string) => !!find(name) || newNames.has(name.trim().toLowerCase())

  if (!draft.updates) return null

  const save = (next: WorldUpdate[]) => {
    setItems(next)
    db.sessions
      .where('id')
      .equals(session.id)
      .modify((s) => {
        if (s.recapDraft) s.recapDraft.updates = next
      })
  }
  const change = (id: string, patch: Partial<WorldUpdate>) => save(items.map((u) => (u.id === id ? ({ ...u, ...patch } as WorldUpdate) : u)))
  const addAsNew = (name: string) =>
    save([...items, { id: newId(), on: true, kind: 'new', type: 'npc', name, summary: '', details: '' }])

  // Suggestions naming a page that doesn't exist are skipped, so they don't count.
  const ticked = items.filter((u) => u.on && namesIn(u).every((n) => !n || known(n))).length
  const apply = async () => {
    setBusy(true)
    try {
      const ledger = await applyUpdates(world, session, items)
      setResult(ledger.length)
    } finally {
      setBusy(false)
    }
  }
  const ledgerLink = <Link to={`${worldPath(world.id)}/chronicle`}>{LEDGER_NAME}</Link>

  if (draft.updatesDone || result !== undefined)
    return (
      <div className="world-updates">
        <h3><Ico as={BookBookmark} /> Keep the world up to date</h3>
        <p className="small">
          ✓ {result !== undefined ? `${result} change${result === 1 ? '' : 's'} made to the world.` : 'Changes made.'} Each one is listed in {ledgerLink}, and every
          page keeps its old version in its history.
        </p>
      </div>
    )

  return (
    <div className="world-updates">
      <h3>
        <Ico as={BookBookmark} /> Keep the world up to date <Help topic="worldUpdates" />
      </h3>
      {items.length === 0 && draft.updatesProblem !== undefined ? (
        <UnreadableUpdates text={draft.updatesProblem} />
      ) : items.length === 0 ? (
        <p className="muted small">Claude didn’t find anything in this session that your pages are missing.</p>
      ) : (
        <>
          <p className="muted small">
            Claude compared the session with your pages. Untick anything wrong, fix the wording, then add the rest. New pages start as GM only, and
            lines added to existing pages go in a “Session log” at the bottom, GM only unless you tick otherwise.
          </p>
          {GROUPS.map((g) => {
            const xs = items.filter((u) => g.kinds.includes(u.kind))
            if (!xs.length) return null
            return (
              <section key={g.title} className="update-group">
                <h4>{g.title}</h4>
                <ul className="update-list">
                  {xs.map((u) => {
                    const missing = namesIn(u).filter((n) => n && !known(n))
                    const same = u.kind === 'new' ? find(u.sameAs) : undefined
                    return (
                      <li key={u.id} className={u.on ? '' : 'off'}>
                        <label className="row">
                          <input type="checkbox" checked={u.on} onChange={(e) => change(u.id, { on: e.target.checked })} />
                          <span>{describe(u)}</span>
                        </label>
                        <div className="update-extras row wrap small">
                          {same && u.kind === 'new' && (
                            <span className="row">
                              Might be <Link to={pagePath(world.id, same.id)}>{same.name}</Link>:
                              <label className="row">
                                <input type="radio" checked={!!u.useSameAs} onChange={() => change(u.id, { useSameAs: true })} /> same page
                              </label>
                              <label className="row">
                                <input type="radio" checked={!u.useSameAs} onChange={() => change(u.id, { useSameAs: false })} /> someone new
                              </label>
                            </span>
                          )}
                          {u.kind === 'note' && (
                            <label className="row">
                              <input type="checkbox" checked={!!u.players} onChange={(e) => change(u.id, { players: e.target.checked })} /> Players can see this line
                            </label>
                          )}
                          {(u.kind === 'note' || u.kind === 'status' || u.kind === 'quest') && (
                            <label className="row">
                              <input type="checkbox" checked={!!u.timeline} onChange={(e) => change(u.id, { timeline: e.target.checked })} /> Add to timeline
                            </label>
                          )}
                          <button className="link small" onClick={() => setEditing(editing === u.id ? undefined : u.id)}>
                            {editing === u.id ? 'Done editing' : 'Edit'}
                          </button>
                        </div>
                        {missing.map((n) => (
                          <p key={n} className="warn small">
                            There’s no page called “{n}”, so this will be skipped.{' '}
                            <button className="link small" onClick={() => addAsNew(n)}>
                              Add “{n}” as a new page
                            </button>
                          </p>
                        ))}
                        {editing === u.id && <UpdateEditor update={u} onChange={(patch) => change(u.id, patch)} />}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          <div className="row wrap">
            <button className="primary" disabled={!ticked || busy} onClick={apply}>
              {busy ? 'Adding…' : `Add ${ticked} change${ticked === 1 ? '' : 's'} to the world`}
            </button>
            <button className="ghost small" onClick={() => save(items.map((u) => ({ ...u, on: !items.every((x) => x.on) })))}>
              {items.every((u) => u.on) ? 'Untick all' : 'Tick all'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** The wording of one suggestion, for fixing what Claude misheard. */
function UpdateEditor({ update: u, onChange }: { update: WorldUpdate; onChange: (patch: Partial<WorldUpdate>) => void }) {
  const field = (key: string, label: string, value: string | undefined, rows = 1) => (
    <label key={key} className="stack small">
      {label}
      {rows > 1 ? (
        <textarea rows={rows} value={value ?? ''} onChange={(e) => onChange({ [key]: e.target.value } as Partial<WorldUpdate>)} />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange({ [key]: e.target.value } as Partial<WorldUpdate>)} />
      )}
    </label>
  )
  return (
    <div className="update-editor">
      {u.kind === 'new' && (
        <>
          {field('name', 'Name', u.name)}
          <label className="stack small">
            Kind of page
            <select value={u.type} onChange={(e) => onChange({ type: e.target.value as typeof u.type })}>
              {UPDATE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t].one}
                </option>
              ))}
            </select>
          </label>
          {field('summary', 'One line', u.summary)}
          {field('details', 'What happened', u.details, 3)}
          {field('in', 'Inside (a place)', u.in)}
        </>
      )}
      {(u.kind === 'note' || u.kind === 'conflict') && (
        <>
          {field('page', 'Page', u.page)}
          {field('note', 'Line to add', u.note, 2)}
        </>
      )}
      {(u.kind === 'quest' || u.kind === 'status') && (
        <>
          {field('page', 'Page', u.page)}
          {field('note', 'What happened', u.note, 2)}
        </>
      )}
      {u.kind === 'relation' && (
        <>
          {field('from', 'From', u.from)}
          {field('relation', 'Relationship', u.relation)}
          {field('to', 'To', u.to)}
          {field('note', 'Note', u.note)}
        </>
      )}
      {u.kind === 'event' && (
        <>
          {field('name', 'Event', u.name)}
          {field('summary', 'What happened', u.summary, 2)}
          {field('where', 'Where (a place)', u.where)}
        </>
      )}
      {u.kind === 'item' && (
        <>
          {field('item', 'Item', u.item)}
          {field('to', 'Now with (a character, or “party”)', u.to)}
        </>
      )}
      {u.kind === 'thread' && (
        <>
          {u.action === 'raised' ? field('name', 'Loose thread', u.name) : field('page', 'Loose thread', u.page)}
          {field('note', 'Note', u.note, 2)}
        </>
      )}
    </div>
  )
}

/** Claude's suggested changes came back in a shape the app can't read: show them as they are rather than saying there were none. */
function UnreadableUpdates({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  if (!text.trim())
    return (
      <p className="notice small">
        Claude’s reply stopped before its list of changes to your pages (it may have run out of room), so there’s nothing to add here. Write the recap again to get
        them.
      </p>
    )
  return (
    <div className="notice small">
      <p>Claude’s list of changes to your pages didn’t come in the shape the app can read, so here it is as written. You can make the changes by hand.</p>
      <pre className="recap-stream">{text}</pre>
      <button
        className="small"
        onClick={() =>
          navigator.clipboard.writeText(text).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
