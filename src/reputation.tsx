import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Lock, MegaphoneSimple, SlidersHorizontal, ThumbsDown, ThumbsUp, X } from '@phosphor-icons/react'
import { db, newId, PARTY, repId, type Entity, type Reputation, type ReputationChange, type ReputationNote, type Session } from './db'
import { DraftText, Empty } from './components'
import { Help } from './help'
import { Ico, TypeIcon } from './icons'
import { PagePicker } from './PagePicker'
import { pagePath, worldPath } from './paths'
import { stripSecrets } from './Markdown'
import { isPlayed, partyOf } from './sessions'
import { useWorldSessions } from './threads'
import { toast } from './undo'
import { useVisibleEntities, useWorld } from './hooks'
import { useViewMode } from './viewMode'
import './reputation.css'

/**
 * The party's reputation: how far their name has spread (a ladder from Town to Global, renamed per
 * world), which way the talk leans (from notorious to celebrated), what particular places make of
 * them, and every change with its reason and session. Each player character has a smaller one of
 * their own. The GM moves it by hand, or approves a suggestion from the recap
 * (src/ai/worldUpdates.ts).
 *
 * It lives in its own table (db.reputation), one row for the party and one per character, so
 * nothing of it reaches players until the server knows to filter it: public.player_view (from
 * supabase/migrations/20261103000003_reputation.sql) sends the reach, the lean, the level names, and
 * only the notes and reasons the GM ticked for players. asPlayersSee below does the same for the
 * GM's player preview.
 */

export { PARTY, repId }
export const DEFAULT_LEVELS = ['Town', 'County', 'District', 'State', 'Country', 'Continent', 'Global']
export const LEAN_MIN = -3
export const LEAN_MAX = 3
const LEANS: Record<string, string> = {
  '-3': 'Notorious',
  '-2': 'Infamous',
  '-1': 'Leaning infamous',
  '0': 'Mixed',
  '1': 'Leaning famous',
  '2': 'Famous',
  '3': 'Celebrated',
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)))

export const leanLabel = (lean: number) => LEANS[String(clamp(lean, LEAN_MIN, LEAN_MAX))]

/** How far the name has spread, as a level's name ("County"), or "Not known yet". */
export function reachLabel(reach: number, levels: string[]) {
  const n = clamp(reach, 0, levels.length)
  return n ? levels[n - 1] : 'Not known yet'
}

/** The level names a world uses: its own, or Town to Global. */
export const levelsOf = (party: Reputation | undefined) => (party?.levels?.length ? party.levels : DEFAULT_LEVELS)

/** Whether there is anything to say yet. */
export const hasStanding = (r: Reputation | undefined) => !!r && (r.reach > 0 || r.lean !== 0 || r.history.length > 0 || r.notes.length > 0)

function blank(worldId: string, of: string): Reputation {
  const now = Date.now()
  return { id: repId(worldId, of), worldId, of, reach: 0, lean: 0, notes: [], history: [], createdAt: now, updatedAt: now }
}

/** Changes one row (making it first if need be). Returns the row as it was, for Undo (undefined if it's new). */
async function changeRep(worldId: string, of: string, fn: (r: Reputation) => void) {
  let before: Reputation | undefined
  await db.transaction('rw', db.reputation, async () => {
    before = await db.reputation.get(repId(worldId, of))
    const r = before ? structuredClone(before) : blank(worldId, of)
    fn(r)
    r.updatedAt = Date.now()
    await db.reputation.put(r)
  })
  return before
}

/** Puts a row back as it was before a change (or removes it, if the change made it). */
function putBack(worldId: string, of: string, before: Reputation | undefined) {
  return before ? db.reputation.put({ ...before, updatedAt: Date.now() }) : db.reputation.delete(repId(worldId, of))
}

export interface Move {
  /** Levels up (1) or down (-1). */
  reach?: number
  /** Toward fame (1) or infamy (-1). */
  lean?: number
  reason: string
  sessionId?: string
  /** Players can see why. */
  known?: boolean
}

/** Moves a reputation and writes the change in its history. Returns the row as it was, for Undo. */
export async function moveReputation(worldId: string, of: string, m: Move) {
  const levels = levelsOf(await db.reputation.get(repId(worldId, PARTY)))
  return changeRep(worldId, of, (r) => {
    const reach = clamp(r.reach + (m.reach ?? 0), 0, levels.length)
    const lean = clamp(r.lean + (m.lean ?? 0), LEAN_MIN, LEAN_MAX)
    r.history.push({
      id: newId(),
      at: Date.now(),
      fromReach: r.reach,
      reach,
      fromLean: r.lean,
      lean,
      reason: m.reason.trim(),
      ...(m.sessionId ? { sessionId: m.sessionId } : {}),
      ...(m.known ? { known: true } : {}),
    })
    r.reach = reach
    r.lean = lean
  })
}

/** What a change did, in a few words: "Word spread to County; talk turned toward fame (Famous)". */
export function changeText(c: Pick<ReputationChange, 'fromReach' | 'reach' | 'fromLean' | 'lean'>, levels: string[]) {
  const out: string[] = []
  if (c.reach > c.fromReach) out.push(`Word spread to ${reachLabel(c.reach, levels)}`)
  else if (c.reach < c.fromReach) out.push(c.reach > 0 ? `Faded back to ${reachLabel(c.reach, levels)}` : 'Faded from memory')
  if (c.lean > c.fromLean) out.push(`${out.length ? 'talk' : 'Talk'} turned toward fame (${leanLabel(c.lean)})`)
  else if (c.lean < c.fromLean) out.push(`${out.length ? 'talk' : 'Talk'} turned toward infamy (${leanLabel(c.lean)})`)
  return out.join('; ') || 'No change'
}

/**
 * A reputation as players get it, for the GM's player preview (player copies already arrive this
 * way from public.player_view): only a character they can see, only the notes and reasons marked
 * for players, and links only to pages and sessions they can see.
 */
export function asPlayersSee(r: Reputation, pages: Set<string>, sessions: Set<string>): Reputation | undefined {
  if (r.of !== PARTY && !pages.has(r.of)) return undefined
  return {
    ...r,
    notes: r.notes.filter((n) => n.known).map((n) => ({ ...n, place: stripSecrets(n.place), text: stripSecrets(n.text), entityId: n.entityId && pages.has(n.entityId) ? n.entityId : undefined })),
    history: r.history.filter((h) => h.known).map((h) => ({ ...h, reason: stripSecrets(h.reason), sessionId: h.sessionId && sessions.has(h.sessionId) ? h.sessionId : undefined })),
  }
}

/** Every reputation in a world the viewer may see (all of them for the GM). */
export function useReputations(worldId: string, entities: Entity[], sessions: Session[]) {
  const { isGM } = useViewMode()
  const rows = useLiveQuery(() => db.reputation.where({ worldId }).toArray(), [worldId])
  return useMemo(() => {
    if (!rows) return undefined
    if (isGM) return rows
    const pages = new Set(entities.map((e) => e.id))
    const seen = new Set(sessions.map((s) => s.id))
    return rows.flatMap((r) => asPlayersSee(r, pages, seen) ?? [])
  }, [rows, isGM, entities, sessions])
}

/** Whether a world has a reputation anyone has written down (for the wiki reader's More page). */
export function useHasReputation(worldId: string) {
  return (useLiveQuery(() => db.reputation.where({ worldId }).count(), [worldId]) ?? 0) > 0
}

/** The party's row (the oldest, should two devices each have made one before syncing). */
export const partyRep = (rows: Reputation[] | undefined) => rows?.filter((r) => r.of === PARTY).sort((a, b) => a.createdAt - b.createdAt)[0]
const repOf = (rows: Reputation[] | undefined, of: string) => rows?.find((r) => r.of === of)

/** The session a change most likely happened in: the latest one started or played, else none. */
function likelySession(sessions: Session[]) {
  return [...sessions].reverse().find((s) => s.startedAt || isPlayed(s))?.id ?? ''
}

const sessionName = (s: Session) => `#${s.number}${s.title ? ` ${s.title}` : ''}`

// ---------- small pieces ----------

/** One line: "Known as far as County · Famous". */
export function RepLine({ rep, levels }: { rep: Reputation | undefined; levels: string[] }) {
  if (!rep || (rep.reach <= 0 && rep.lean === 0)) return <span className="muted">Not known yet</span>
  return (
    <span className="rep-line-text">
      {rep.reach > 0 ? (
        <>
          Known as far as <strong>{reachLabel(rep.reach, levels)}</strong>
        </>
      ) : (
        'Hardly known yet'
      )}
      {' · '}
      <strong className={`rep-lean-word ${rep.lean > 0 ? 'fame' : rep.lean < 0 ? 'infamy' : ''}`}>{leanLabel(rep.lean)}</strong>
    </span>
  )
}

/** The ladder (lit up to how far word has spread) and the lean, from infamy to fame. */
export function RepStanding({ rep, levels }: { rep: Reputation | undefined; levels: string[] }) {
  const reach = clamp(rep?.reach ?? 0, 0, levels.length)
  const lean = clamp(rep?.lean ?? 0, LEAN_MIN, LEAN_MAX)
  return (
    <div className="rep-standing">
      <div className="rep-measure">
        <span className="muted small">Known as far as</span> <strong className="rep-reach">{reachLabel(reach, levels)}</strong>
      </div>
      <ol className="rep-ladder" aria-label={`How far word has spread: ${reach} of ${levels.length}`}>
        {levels.map((l, i) => (
          <li key={i} className={i < reach ? 'lit' : ''} aria-current={i === reach - 1 ? 'step' : undefined}>
            {l}
          </li>
        ))}
      </ol>
      <div className="rep-measure">
        <span className="muted small">What people say</span> <strong className={`rep-lean-word ${lean > 0 ? 'fame' : lean < 0 ? 'infamy' : ''}`}>{leanLabel(lean)}</strong>
      </div>
      <div className="rep-scale" role="img" aria-label={`Between infamy and fame: ${leanLabel(lean)}`}>
        <span className="small muted">Infamy</span>
        <span className="rep-dots" aria-hidden="true">
          {Array.from({ length: LEAN_MAX - LEAN_MIN + 1 }, (_, i) => i + LEAN_MIN).map((n) => (
            <span key={n} className={`rep-dot ${n === lean ? 'on' : ''} ${n < 0 ? 'infamy' : n > 0 ? 'fame' : 'mixed'}`} />
          ))}
        </span>
        <span className="small muted">Fame</span>
      </div>
    </div>
  )
}

/** The four ways the GM moves a reputation, each asking what happened. */
function RepMoves({ worldId, of, rep, levels, sessions, compact }: { worldId: string; of: string; rep: Reputation | undefined; levels: string[]; sessions: Session[]; compact?: boolean }) {
  const [move, setMove] = useState<{ reach?: number; lean?: number }>()
  const reach = rep?.reach ?? 0
  const lean = rep?.lean ?? 0
  const buttons: { label: string; icon: typeof ArrowUp; m: { reach?: number; lean?: number }; off: boolean }[] = [
    { label: 'Spread further', icon: ArrowUp, m: { reach: 1 }, off: reach >= levels.length },
    { label: 'Fade', icon: ArrowDown, m: { reach: -1 }, off: reach <= 0 },
    { label: 'Toward fame', icon: ThumbsUp, m: { lean: 1 }, off: lean >= LEAN_MAX },
    { label: 'Toward infamy', icon: ThumbsDown, m: { lean: -1 }, off: lean <= LEAN_MIN },
  ]
  return (
    <>
      <div className={`rep-moves row wrap ${compact ? 'compact' : ''}`}>
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            className={compact ? 'small' : undefined}
            disabled={b.off}
            aria-pressed={!!move && move.reach === b.m.reach && move.lean === b.m.lean}
            onClick={() => setMove(b.m)}
          >
            <Ico as={b.icon} /> {b.label}
          </button>
        ))}
      </div>
      {move && <ChangeForm key={`${move.reach}:${move.lean}`} worldId={worldId} of={of} rep={rep} levels={levels} move={move} sessions={sessions} onDone={() => setMove(undefined)} />}
    </>
  )
}

/** What happened, in which session, and whether players see why. */
function ChangeForm({
  worldId,
  of,
  rep,
  levels,
  move,
  sessions,
  onDone,
}: {
  worldId: string
  of: string
  rep: Reputation | undefined
  levels: string[]
  move: { reach?: number; lean?: number }
  sessions: Session[]
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [sessionId, setSessionId] = useState(() => likelySession(sessions))
  const [known, setKnown] = useState(false)
  const reach = rep?.reach ?? 0
  const lean = rep?.lean ?? 0
  const preview = changeText(
    { fromReach: reach, reach: clamp(reach + (move.reach ?? 0), 0, levels.length), fromLean: lean, lean: clamp(lean + (move.lean ?? 0), LEAN_MIN, LEAN_MAX) },
    levels,
  )
  return (
    <form
      className="card rep-change"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!reason.trim()) return
        const before = await moveReputation(worldId, of, { ...move, reason, sessionId, known })
        onDone()
        toast(`${preview}.`, () => putBack(worldId, of, before))
      }}
    >
      <p className="rep-preview">{preview}</p>
      <label className="stack">
        What happened?
        <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Saved the mayor’s daughter" />
      </label>
      <div className="row wrap rep-change-more">
        <label className="stack">
          In which session?
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">No particular session</option>
            {[...sessions].reverse().map((s) => (
              <option key={s.id} value={s.id}>
                {sessionName(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} /> Players can see why
        </label>
      </div>
      <div className="row wrap">
        <button className="primary" disabled={!reason.trim()}>
          Save
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Every change, newest first. The GM can show or hide each reason, or take a line out. */
function HistoryList({ worldId, rep, levels, sessions, isGM }: { worldId: string; rep: Reputation; levels: string[]; sessions: Session[]; isGM: boolean }) {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const list = [...rep.history].reverse()
  if (!list.length) return <p className="muted small">{isGM ? 'No changes yet. Each one you make is listed here with its reason.' : 'Nothing written down yet.'}</p>
  const edit = (fn: (h: ReputationChange[]) => ReputationChange[]) => changeRep(worldId, rep.of, (r) => (r.history = fn(r.history)))
  return (
    <ol className="rep-history">
      {list.map((h) => {
        const s = h.sessionId ? byId.get(h.sessionId) : undefined
        return (
          <li key={h.id}>
            <div>
              <strong>{changeText(h, levels)}</strong>
              {h.reason && <span className="rep-reason">: {h.reason}</span>}
            </div>
            <div className="muted small row wrap rep-history-meta">
              {s ? <Link to={`${worldPath(worldId)}/s/${s.id}`}>Session {sessionName(s)}</Link> : <span>{new Date(h.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              {isGM && (
                <>
                  <label className="inline-check" title="Players see this change either way; this shows them why">
                    <input type="checkbox" checked={!!h.known} onChange={(e) => edit((l) => l.map((x) => (x.id === h.id ? { ...x, known: e.target.checked || undefined } : x)))} /> Players can see why
                  </label>
                  <button
                    type="button"
                    className="ghost small"
                    aria-label={`Take “${h.reason || changeText(h, levels)}” out of the history`}
                    title="Take this line out of the history (the reach and lean stay as they are)"
                    onClick={async () => {
                      const before = await edit((l) => l.filter((x) => x.id !== h.id))
                      toast('Line taken out of the history.', () => putBack(worldId, rep.of, before))
                    }}
                  >
                    <Ico as={X} />
                  </button>
                </>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** How particular places see the party. GM-only unless ticked. */
function PlaceNotes({ worldId, rep, entities, isGM }: { worldId: string; rep: Reputation | undefined; entities: Entity[]; isGM: boolean }) {
  const notes = rep?.notes ?? []
  const byId = new Map(entities.map((e) => [e.id, e]))
  const edit = (fn: (n: ReputationNote[]) => ReputationNote[]) => changeRep(worldId, PARTY, (r) => (r.notes = fn(r.notes)))
  return (
    <>
      {notes.length === 0 ? (
        <p className="muted small">{isGM ? 'No notes yet. Write how a town, a court or a guild sees the party.' : 'Nothing written down yet.'}</p>
      ) : (
        <ul className="rep-notes">
          {notes.map((n) => {
            const page = n.entityId ? byId.get(n.entityId) : undefined
            return (
              <li key={n.id} className={n.known ? '' : 'gm-only'}>
                <div className="rep-note-place">
                  {page ? (
                    <Link to={pagePath(worldId, page.id)}>
                      <TypeIcon type={page.type} /> {page.name}
                    </Link>
                  ) : (
                    <strong>{n.place}</strong>
                  )}
                  {isGM && !n.known && (
                    <span className="muted small" title="GM only">
                      {' '}
                      <Ico as={Lock} /> GM only
                    </span>
                  )}
                </div>
                {isGM ? (
                  <DraftText className="rep-note-text" value={n.text} aria-label={`How ${n.place} sees the party`} onCommit={(v) => edit((l) => l.map((x) => (x.id === n.id ? { ...x, text: v } : x)))} />
                ) : (
                  <p className="rep-note-text">{n.text}</p>
                )}
                {isGM && (
                  <div className="row wrap small rep-note-tools">
                    <label className="inline-check">
                      <input type="checkbox" checked={!!n.known} onChange={(e) => edit((l) => l.map((x) => (x.id === n.id ? { ...x, known: e.target.checked || undefined } : x)))} /> Players can see this
                    </label>
                    {page && page.visibility !== 'players' && n.known && <span className="muted">Players see the name, but can’t open {page.name}’s page yet.</span>}
                    <button
                      type="button"
                      className="ghost small"
                      aria-label={`Remove the note on ${n.place}`}
                      onClick={async () => {
                        const before = await edit((l) => l.filter((x) => x.id !== n.id))
                        toast(`Note on ${n.place} removed.`, () => putBack(worldId, PARTY, before))
                      }}
                    >
                      <Ico as={X} />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {isGM && <AddNote entities={entities} onAdd={(n) => edit((l) => [...l, n])} />}
    </>
  )
}

function AddNote({ entities, onAdd }: { entities: Entity[]; onAdd: (n: ReputationNote) => unknown }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState('')
  const [entityId, setEntityId] = useState('')
  const [text, setText] = useState('')
  const [known, setKnown] = useState(false)
  const places = entities.filter((e) => ['location', 'shop', 'faction'].includes(e.type))
  if (!open)
    return (
      <button type="button" className="add-extra" onClick={() => setOpen(true)}>
        + Note on a place
      </button>
    )
  return (
    <form
      className="card rep-add-note"
      onSubmit={async (e) => {
        e.preventDefault()
        const name = place.trim() || entities.find((x) => x.id === entityId)?.name || ''
        if (!name || !text.trim()) return
        await onAdd({ id: newId(), place: name, text: text.trim(), ...(entityId ? { entityId } : {}), ...(known ? { known: true } : {}) })
        setPlace('')
        setEntityId('')
        setText('')
        setKnown(false)
        setOpen(false)
      }}
    >
      <div className="row wrap">
        <label className="stack grow">
          Place
          <input autoFocus value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Cinderford, the Ashen Court" />
        </label>
        <div className="stack grow">
          <span>Its page (if it has one)</span>
          <PagePicker
            entities={places}
            value={entityId}
            placeholder="Find a place, shop or faction…"
            onPick={(id) => {
              setEntityId(id)
              const page = entities.find((x) => x.id === id)
              if (page && !place.trim()) setPlace(page.name)
            }}
          />
        </div>
      </div>
      <label className="stack">
        How they see the party
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Owe us a debt / Wanted, dead or alive" />
      </label>
      <div className="row wrap">
        <label className="inline-check">
          <input type="checkbox" checked={known} onChange={(e) => setKnown(e.target.checked)} /> Players can see this
        </label>
        <button className="primary" disabled={!text.trim() || !(place.trim() || entityId)}>
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** The world's own names for the ladder's levels ("Village" for "Town", "Realm" for "State"…). */
function LevelsEditor({ worldId, levels, custom }: { worldId: string; levels: string[]; custom: boolean }) {
  const [draft, setDraft] = useState(levels)
  const save = async (next: string[] | undefined) => {
    const before = await changeRep(worldId, PARTY, (r) => {
      if (next) r.levels = next
      else delete r.levels
      r.reach = clamp(r.reach, 0, (next ?? DEFAULT_LEVELS).length)
    })
    toast(next ? 'Levels saved.' : 'Levels back to Town to Global.', () => putBack(worldId, PARTY, before))
  }
  const cleaned = draft.map((l) => l.trim()).filter(Boolean)
  return (
    <div className="rep-levels">
      <p className="muted small">Nearest first. Name them the way your world talks: Village, Barony, Kingdom, the Known Lands…</p>
      <ol>
        {draft.map((l, i) => (
          <li key={i} className="row">
            <input value={l} aria-label={`Level ${i + 1}`} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="ghost small" aria-label={`Remove level ${i + 1}`} disabled={draft.length <= 2} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
              <Ico as={X} />
            </button>
          </li>
        ))}
      </ol>
      <div className="row wrap">
        <button type="button" onClick={() => setDraft([...draft, ''])} disabled={draft.length >= 10}>
          + Level
        </button>
        <button type="button" className="primary" disabled={cleaned.length < 2 || cleaned.join('|') === levels.join('|')} onClick={() => save(cleaned)}>
          Save levels
        </button>
        {custom && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setDraft(DEFAULT_LEVELS)
              save(undefined)
            }}
          >
            Back to Town to Global
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- where it shows ----------

/** The Reputation screen: the party's standing, how places see them, the history, and each character. */
export default function ReputationPage() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const rows = useReputations(worldId, entities, sessions)
  const [editLevels, setEditLevels] = useState(false)
  if (!world || !rows) return null
  const party = partyRep(rows)
  const levels = levelsOf(party)
  const pcs = partyOf(entities, undefined)
  const known = pcs.filter((c) => isGM || hasStanding(repOf(rows, c.id)))

  if (!isGM && !hasStanding(party) && !known.length)
    return (
      <div className="page rep-page">
        <header className="page-header">
          <h1>
            <Ico as={MegaphoneSimple} /> Reputation <Help topic="reputation" />
          </h1>
        </header>
        <Empty>Nobody much has heard of the party yet.</Empty>
      </div>
    )

  return (
    <div className="page rep-page">
      <header className="page-header">
        <h1>
          <Ico as={MegaphoneSimple} /> Reputation <Help topic="reputation" />
        </h1>
        <p className="muted">How far the party’s name has spread, and what people make of them.</p>
      </header>

      <section className="card rep-card" aria-label="The party’s reputation">
        <RepStanding rep={party} levels={levels} />
        {isGM && <RepMoves worldId={worldId} of={PARTY} rep={party} levels={levels} sessions={sessions} />}
        {isGM && (
          <div className="rep-levels-fold">
            <button type="button" className="link small" aria-expanded={editLevels} onClick={() => setEditLevels(!editLevels)}>
              <Ico as={SlidersHorizontal} /> Edit levels
            </button>{' '}
            <Help topic="reputationLevels" />
            {editLevels && <LevelsEditor worldId={worldId} levels={levels} custom={!!party?.levels?.length} />}
          </div>
        )}
      </section>

      <section className="rep-section">
        <h2>
          How places see the party <Help topic="reputationNotes" />
        </h2>
        <PlaceNotes worldId={worldId} rep={party} entities={entities} isGM={isGM} />
      </section>

      <section className="rep-section">
        <h2>How word spread</h2>
        {party ? <HistoryList worldId={worldId} rep={party} levels={levels} sessions={sessions} isGM={isGM} /> : <p className="muted small">{isGM ? 'No changes yet. Each one you make is listed here with its reason.' : 'Nothing written down yet.'}</p>}
      </section>

      {known.length > 0 && (
        <section className="rep-section">
          <h2>
            Each character <Help topic="characterFame" />
          </h2>
          <ul className="rep-characters">
            {known.map((c) => (
              <li key={c.id}>
                <Link to={pagePath(worldId, c.id)}>
                  <TypeIcon type={c.type} /> {c.name}
                </Link>{' '}
                <span className="small">
                  <RepLine rep={repOf(rows, c.id)} levels={levels} />
                </span>
              </li>
            ))}
          </ul>
          {isGM && <p className="muted small">Change a character’s own fame on their page.</p>}
        </section>
      )}
    </div>
  )
}

/** On a character's page: their own fame in one line, the history folded away. */
export function CharacterFame({ entity, worldId }: { entity: Entity; worldId: string }) {
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const rows = useReputations(worldId, entities, sessions)
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  if (!rows || entity.template) return null
  const rep = repOf(rows, entity.id)
  const levels = levelsOf(partyRep(rows))
  if (!isGM && !hasStanding(rep)) return null
  const count = rep?.history.length ?? 0
  return (
    <section className="rep-char" aria-label={`${entity.name}’s fame`}>
      <div className="row wrap rep-char-line">
        <span className="rep-char-label">
          <Ico as={MegaphoneSimple} /> Fame <Help topic="characterFame" />
        </span>
        <span>
          <RepLine rep={rep} levels={levels} />
        </span>
        {isGM && (
          <button type="button" className="ghost small" aria-expanded={changing} onClick={() => setChanging(!changing)}>
            {changing ? 'Done' : 'Change'}
          </button>
        )}
        {count > 0 && (
          <button type="button" className="ghost small" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide history' : `History (${count})`}
          </button>
        )}
      </div>
      {isGM && changing && <RepMoves worldId={worldId} of={entity.id} rep={rep} levels={levels} sessions={sessions} compact />}
      {open && rep && <HistoryList worldId={worldId} rep={rep} levels={levels} sessions={sessions} isGM={isGM} />}
    </section>
  )
}

/** The players' Party tab: the party's reputation in a card, and the places that matter. */
export function PartyReputationCard({ worldId, entities }: { worldId: string; entities: Entity[] }) {
  const sessions = useWorldSessions(worldId)
  const rows = useReputations(worldId, entities, sessions)
  const party = partyRep(rows)
  if (!hasStanding(party)) return null
  const levels = levelsOf(party)
  const byId = new Map(entities.map((e) => [e.id, e]))
  const notes = party!.notes.slice(0, 4)
  return (
    <section className="card room-card rep-room" aria-label="The party’s reputation">
      <div className="room-card-head">
        <h2 className="room-card-title">
          <Ico as={MegaphoneSimple} /> Your reputation
        </h2>
        <Link className="room-more" to={`${worldPath(worldId)}/reputation`}>
          How word spread
        </Link>
      </div>
      <p>
        <RepLine rep={party} levels={levels} />
      </p>
      {notes.length > 0 && (
        <ul className="rep-notes compact">
          {notes.map((n) => {
            const page = n.entityId ? byId.get(n.entityId) : undefined
            return (
              <li key={n.id}>
                {page ? <Link to={pagePath(worldId, page.id)}>{page.name}</Link> : <strong>{n.place}</strong>}: {n.text}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** A character's fame in one short line on the Party tab, when they have any. */
export function useCharacterFame(worldId: string, entities: Entity[]) {
  const sessions = useWorldSessions(worldId)
  const rows = useReputations(worldId, entities, sessions)
  const levels = levelsOf(partyRep(rows))
  return (id: string) => {
    const rep = repOf(rows, id)
    return hasStanding(rep) && (rep!.reach > 0 || rep!.lean !== 0) ? <RepLine rep={rep} levels={levels} /> : null
  }
}
