import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star } from '@phosphor-icons/react'
import { useAuthSession } from '../cloud/auth'
import { cloudErrorMessage, supabase } from '../cloud/client'
import type { Entity, Session, World } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { localDate } from '../sessions'
import { worldPath } from '../paths'
import { afterUndo, removeWithUndo, toast } from '../undo'

const sessionName = (s: { number: number; title: string }) => (!s.title.trim() || /^session \d+$/i.test(s.title.trim()) ? `Session ${s.number}` : `Session ${s.number}: ${s.title}`)

/**
 * Stars and wishes: for a few days after a game night, each player can say one thing they loved
 * (a star) and one thing they'd like more of (a wish). They're signed, not anonymous: the GM sees who
 * sent each one, under the session, in the Inbox, and the prep helper sends them to Claude only if the
 * GM ticks "Include players' feedback" (the form tells players so). Kept on the server like downtime
 * (public.session_feedback), never in the world itself.
 */

export interface Feedback {
  id: string
  userId: string
  /** The GM's id of the session it's about. */
  sessionId: string
  /** The character it's signed with, by name ('' for none). */
  character: string
  star: string
  wish: string
  createdAt: string
  updatedAt: string
}

type Row = { id: string; user_id: string; session_id: string; character: string; star: string; wish: string; created_at: string; updated_at: string }
const fromRow = (r: Row): Feedback => ({ id: r.id, userId: r.user_id, sessionId: r.session_id, character: r.character, star: r.star, wish: r.wish, createdAt: r.created_at, updatedAt: r.updated_at })

/** A player copy's id ("abc@m1234abcd") as the GM's world knows it. */
const gmId = (localId: string) => localId.replace(/@m[0-9a-f]{8}$/, '')

/** Whether the server knows about stars and wishes yet (the 2026-11-03 update). Asked once per world. */
const known = new Map<string, Promise<boolean>>()
function serverHasIt(cloudId: string) {
  let p = known.get(cloudId)
  if (!p) {
    p = Promise.resolve(supabase.from('session_feedback').select('id').eq('world_id', cloudId).limit(1)).then(
      ({ error }) => {
        // Offline, say: ask again next time rather than hiding it for good.
        if (error && !/session_feedback|schema cache|does not exist/i.test(error.message)) known.delete(cloudId)
        return !error
      },
      () => {
        known.delete(cloudId)
        return false
      },
    )
    known.set(cloudId, p)
  }
  return p
}

/**
 * Whether this world's server has the between-sessions update (stars and wishes, and players' own
 * notes on a session). Undefined while asking; false before the update, so those parts stay hidden.
 */
export function useBetweenSessions(world: World | null | undefined) {
  const { user } = useAuthSession()
  const cloudId = !world || !user ? undefined : world.shared?.memberOf ?? (!world.shared && world.cloud?.enabled ? world.id : undefined)
  const [has, setHas] = useState<{ id: string; ok: boolean }>()
  useEffect(() => {
    if (!cloudId) return
    let live = true
    serverHasIt(cloudId).then((ok) => live && setHas({ id: cloudId, ok }))
    return () => {
      live = false
    }
  }, [cloudId])
  return { cloudId, ready: !!cloudId && has?.id === cloudId && has.ok }
}

/** The GM gets every player's; a player gets only their own (the server sees to that). */
export function useFeedback(world: World | null | undefined) {
  const { cloudId, ready } = useBetweenSessions(world)
  const [list, setList] = useState<Feedback[]>()
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    if (!cloudId || !ready) return
    const { data, error } = await supabase
      .from('session_feedback')
      .select('id, user_id, session_id, character, star, wish, created_at, updated_at')
      .eq('world_id', cloudId)
      .order('created_at', { ascending: true })
    if (error) {
      setError(cloudErrorMessage(error))
      return
    }
    setError('')
    setList((data as Row[]).map(fromRow))
  }, [cloudId, ready])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])
  return { list: ready ? (list ?? []) : [], loaded: list !== undefined, ready, reload, error, cloudId }
}

async function sendFeedback(cloudId: string, sessionId: string, who: string, star: string, wish: string) {
  const { error } = await supabase.rpc('send_feedback', { wid: cloudId, sid: gmId(sessionId), who, star, wish })
  if (error) throw error
}

async function deleteFeedback(cloudId: string, id: string) {
  const { error } = await supabase.from('session_feedback').delete().eq('world_id', cloudId).eq('id', id)
  if (error) throw error
}

const DAY = 86_400_000
/** How long after a game night the card stays on Now. */
const DAYS_OPEN = 5

/** Whether it's still "just after" a session: within a few days of its date, or (undated) while Now is looking back at it. */
export function feedbackOpen(session: Pick<Session, 'date'>, stage: string, now = Date.now()) {
  if (!session.date) return stage === 'after'
  const played = new Date(`${session.date}T00:00`).getTime()
  return session.date <= localDate(now) && now - played < (DAYS_OPEN + 1) * DAY
}

const hiddenKey = (sessionId: string) => `atlas.starsWishes.hidden.${gmId(sessionId)}`
const isHidden = (sessionId: string) => {
  try {
    return localStorage.getItem(hiddenKey(sessionId)) === '1'
  } catch {
    return false
  }
}

/** For a player, on Now, in the days after a game: one star and one wish for last session. */
export function StarsAndWishesCard({ world, session, mine, stage }: { world: World; session: Pick<Session, 'id' | 'number' | 'title' | 'date'>; mine: Entity[]; stage: string }) {
  const { list, ready, reload, cloudId } = useFeedback(world)
  const sent = list.find((f) => f.sessionId === gmId(session.id))
  const [hidden, setHidden] = useState(() => isHidden(session.id))
  const [editing, setEditing] = useState(false)
  const [star, setStar] = useState('')
  const [wish, setWish] = useState('')
  const [who, setWho] = useState(mine[0]?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  if (!world.shared?.memberOf || !cloudId || !ready || hidden || !feedbackOpen(session, stage)) return null
  const character = mine.some((c) => c.name === who) ? who : (mine[0]?.name ?? '')
  const open = !sent || editing
  const startEditing = () => {
    setStar(sent?.star ?? '')
    setWish(sent?.wish ?? '')
    setEditing(true)
  }
  return (
    <section className="card room-card stars-wishes" aria-label="Stars and wishes">
      <h2 className="room-card-title">
        <Ico as={Star} /> Stars and wishes <Help topic="starsWishes" />
      </h2>
      {open ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!star.trim() && !wish.trim()) return
            setBusy(true)
            setProblem('')
            try {
              await sendFeedback(cloudId, session.id, character, star, wish)
              setEditing(false)
              await reload()
            } catch (err) {
              setProblem(cloudErrorMessage(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          <p className="muted small">
            About {sessionName(session)}: one thing you loved, and one thing you’d like more of. Your GM (and any co-GM) reads it, with your name, and
            may share it with Claude, an AI from Anthropic in the US, to help plan the next session.
          </p>
          {mine.length > 1 && (
            <select value={character} onChange={(e) => setWho(e.target.value)} aria-label="Which character">
              {mine.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <label>
            <span className="small">A star: what you loved</span>
            <textarea rows={2} maxLength={2000} value={star} onChange={(e) => setStar(e.target.value)} placeholder="e.g. The chase across the rooftops." />
          </label>
          <label>
            <span className="small">A wish: what you’d like more of</span>
            <textarea rows={2} maxLength={2000} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="e.g. More time with the smugglers." />
          </label>
          <div className="row end wrap">
            {!sent && (
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  try {
                    localStorage.setItem(hiddenKey(session.id), '1')
                  } catch {
                    // Private window: it just comes back next time.
                  }
                  setHidden(true)
                }}
              >
                Not this time
              </button>
            )}
            {editing && (
              <button type="button" className="ghost small" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
            <button className="primary" disabled={busy || (!star.trim() && !wish.trim())}>
              {busy ? 'Sending…' : sent ? 'Update' : 'Send to my GM'}
            </button>
          </div>
          {problem && <p className="error small">{problem}</p>}
        </form>
      ) : (
        <>
          <p className="small">Thanks, your GM has it.</p>
          <ul className="stars-wishes-sent small">
            {sent.star && (
              <li>
                <b>Star:</b> {sent.star}
              </li>
            )}
            {sent.wish && (
              <li>
                <b>Wish:</b> {sent.wish}
              </li>
            )}
          </ul>
          <div className="row wrap">
            <button className="small" onClick={startEditing}>
              Change it
            </button>
            <button
              className="link small"
              onClick={() =>
                removeWithUndo(
                  'Stars and wishes taken back.',
                  () => deleteFeedback(cloudId, sent.id).then(reload),
                  () => sendFeedback(cloudId, session.id, sent.character, sent.star, sent.wish).then(reload),
                ).catch((err) => setProblem(cloudErrorMessage(err)))
              }
            >
              Take it back
            </button>
          </div>
          {problem && <p className="error small">{problem}</p>}
        </>
      )}
    </section>
  )
}

/** For the GM, in the Inbox: what players loved and wished for, under each session, newest session first. */
export function FeedbackInInbox({ world, sessions, nameOf }: { world: World; sessions: Session[]; nameOf: (userId: string) => string }) {
  const { list: all, reload } = useFeedback(world)
  // Removed ones leave at once; the server forgets them when the Undo note goes.
  const [gone, setGone] = useState<string[]>([])
  const list = all.filter((f) => !gone.includes(f.id))
  if (!list.length) return null
  const bySession = new Map<string, Feedback[]>()
  for (const f of list) bySession.set(f.sessionId, [...(bySession.get(f.sessionId) ?? []), f])
  const order = [...bySession.keys()].sort((a, b) => (sessions.find((s) => s.id === b)?.number ?? 0) - (sessions.find((s) => s.id === a)?.number ?? 0))
  return (
    <section className="inbox-feedback">
      <h2>
        <Ico as={Star} /> Stars and wishes <Help topic="starsWishes" />
      </h2>
      {order.map((sid) => {
        const s = sessions.find((x) => x.id === sid)
        return (
          <div key={sid} className="card inbox-item" data-kind="feedback">
            <h3 className="small">{s ? <Link to={`${worldPath(world.id)}/s/${s.id}`}>{sessionName(s)}</Link> : 'A session since removed'}</h3>
            <ul className="stars-wishes-list">
              {bySession.get(sid)!.map((f) => (
                <li key={f.id} id={`item-${f.id}`}>
                  <strong>{nameOf(f.userId)}</strong>
                  {f.character && <span className="muted"> as {f.character}</span>}
                  {f.star && (
                    <div>
                      <span className="muted small">Star:</span> {f.star}
                    </div>
                  )}
                  {f.wish && (
                    <div>
                      <span className="muted small">Wish:</span> {f.wish}
                    </div>
                  )}
                  <button
                    className="link small"
                    onClick={() => {
                      setGone((g) => [...g, f.id])
                      afterUndo(
                        'Stars and wishes removed.',
                        () => deleteFeedback(world.id, f.id).then(reload, (e) => toast(`That didn’t go through: ${cloudErrorMessage(e)}`)),
                        () => setGone((g) => g.filter((x) => x !== f.id)),
                      )
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

/** For the prep helper: what the players said about the sessions given, as prompt lines. */
export function feedbackLines(list: Feedback[], sessions: Session[], nameOf: (userId: string) => string = () => 'A player') {
  return list
    .map((f) => {
      const s = sessions.find((x) => x.id === f.sessionId)
      if (!s) return ''
      const who = f.character || nameOf(f.userId)
      return [f.star && `- ${who} loved (session ${s.number}): ${f.star}`, f.wish && `- ${who} would like more of: ${f.wish}`].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n')
}
