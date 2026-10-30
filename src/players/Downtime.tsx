import { useCallback, useEffect, useState } from 'react'
import { Hourglass } from '@phosphor-icons/react'
import { useAuthSession } from '../cloud/auth'
import { cloudErrorMessage, supabase } from '../cloud/client'
import { tellPlayers } from '../cloud/sync'
import type { Entity, World } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'

/**
 * Downtime: between sessions, a player says what their character spends the time doing (research
 * the ritual, work the forge, look up an old friend). Only the GM sees it, and only that player
 * sees the GM's answer. Kept on the server like questions, never in the world itself.
 */

export interface DowntimeAction {
  id: string
  userId: string
  /** The character it's for, by name, as the player chose. */
  character: string
  body: string
  answer: string | null
  answeredAt: string | null
  createdAt: string
}

type Row = { id: string; user_id: string; character: string; body: string; answer: string | null; answered_at: string | null; created_at: string }
const fromRow = (r: Row): DowntimeAction => ({ id: r.id, userId: r.user_id, character: r.character, body: r.body, answer: r.answer, answeredAt: r.answered_at, createdAt: r.created_at })

/** The GM gets every player's; a player gets only their own (the server sees to that). */
async function listDowntime(cloudId: string) {
  const { data, error } = await supabase
    .from('downtime_actions')
    .select('id, user_id, character, body, answer, answered_at, created_at')
    .eq('world_id', cloudId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as Row[]).map(fromRow)
}

async function sendDowntime(cloudId: string, character: string, body: string) {
  const { error } = await supabase.rpc('send_downtime', { wid: cloudId, who: character, body })
  if (error) throw error
}

async function answerDowntime(cloudId: string, id: string, answer: string) {
  const a = answer.trim()
  const { error } = await supabase
    .from('downtime_actions')
    .update({ answer: a || null, answered_at: a ? new Date().toISOString() : null })
    .eq('world_id', cloudId)
    .eq('id', id)
  if (error) throw error
  await tellPlayers(cloudId)
}

async function deleteDowntime(cloudId: string, id: string) {
  const { error } = await supabase.from('downtime_actions').delete().eq('world_id', cloudId).eq('id', id)
  if (error) throw error
}

/** Downtime in a synced or joined world, refreshed every couple of minutes while open. */
export function useDowntime(world: World | null | undefined) {
  const { user } = useAuthSession()
  const cloudId = !world || !user ? undefined : world.shared?.memberOf ?? (!world.shared && world.cloud?.enabled ? world.id : undefined)
  const [list, setList] = useState<DowntimeAction[]>()
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    if (!cloudId) return
    try {
      setList(await listDowntime(cloudId))
      setError('')
    } catch (e) {
      // Before the server knows about downtime there's nothing to show; say nothing.
      const msg = cloudErrorMessage(e)
      setError(/downtime_actions/.test(msg) ? '' : msg)
      setList([])
    }
  }, [cloudId])
  useEffect(() => {
    if (!cloudId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
    const t = setInterval(() => !document.hidden && reload(), 2 * 60_000)
    const onVisible = () => !document.hidden && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cloudId, reload])
  return { list: cloudId ? (list ?? []) : [], reload, error, cloudId }
}

/** For a player, on their character tab: what you're doing until next time, and the GM's answers. */
export function PlayerDowntime({ world, mine }: { world: World; mine: Entity[] }) {
  const { list, reload, error, cloudId } = useDowntime(world)
  const [text, setText] = useState('')
  const [who, setWho] = useState(mine[0]?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  if (!world.shared?.memberOf || !cloudId) return null
  const character = mine.some((c) => c.name === who) ? who : (mine[0]?.name ?? '')
  return (
    <section className="card room-card downtime">
      <h3>
        <Ico as={Hourglass} /> Between sessions <Help topic="downtime" />
      </h3>
      <p className="muted small">What does your character do until next time? Train, research, craft, look someone up… Only your GM sees this.</p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          setBusy(true)
          setProblem('')
          try {
            await sendDowntime(cloudId, character, text.trim())
            setText('')
            await reload()
          } catch (err) {
            setProblem(cloudErrorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        {mine.length > 1 && (
          <select value={character} onChange={(e) => setWho(e.target.value)} aria-label="Which character">
            {mine.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <textarea rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. I spend the week in the temple library looking for anything on the Ninth Ward." />
        <div className="row end">
          <button className="primary" disabled={busy || !text.trim()}>
            {busy ? 'Sending…' : 'Send to my GM'}
          </button>
        </div>
        {(problem || error) && <p className="error small">{problem || error}</p>}
      </form>
      {list.length > 0 && (
        <ul className="questions">
          {list.map((d) => (
            <li key={d.id} className="question card">
              <div className="muted small">
                {d.character && `${d.character} · `}
                {new Date(d.createdAt).toLocaleDateString()}
              </div>
              <div>{d.body}</div>
              {d.answer ? (
                <div className="answer">
                  <b>Your GM:</b> {d.answer}
                </div>
              ) : (
                <div className="muted small row spread">
                  Waiting for your GM.
                  <button
                    className="link small"
                    onClick={() => {
                      if (!confirm('Take this back?')) return
                      deleteDowntime(cloudId, d.id).then(reload, (err) => setProblem(cloudErrorMessage(err)))
                    }}
                  >
                    Take it back
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** For the GM: every player's downtime, waiting ones first, each with a box to answer. */
export function GmDowntime({ world, names }: { world: World; names: (userId: string) => string }) {
  const { list, reload, error, cloudId } = useDowntime(world)
  if (!cloudId) return null
  const open = list.filter((d) => !d.answer)
  const done = list.filter((d) => d.answer)
  const card = (d: DowntimeAction) => <DowntimeItem key={d.id} cloudId={cloudId} d={d} who={names(d.userId)} onChange={reload} />
  return (
    <section className="gm-downtime">
      <h2>
        <Ico as={Hourglass} /> Downtime {open.length > 0 && <span className="count alert">{open.length}</span>} <Help topic="downtimeGm" />
      </h2>
      {error && <p className="error small">{error}</p>}
      {list.length === 0 && <p className="muted small">Nothing yet. Between sessions, players tell you here what their characters get up to.</p>}
      {open.map(card)}
      {done.length > 0 && (
        <details>
          <summary>Answered ({done.length})</summary>
          {done.map(card)}
        </details>
      )}
    </section>
  )
}

function DowntimeItem({ cloudId, d, who, onChange }: { cloudId: string; d: DowntimeAction; who: string; onChange: () => void }) {
  const [answer, setAnswer] = useState(d.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChange()
    } catch (e) {
      setError(cloudErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card question">
      <div className="row spread">
        <strong>
          {who}
          {d.character && <span className="muted"> as {d.character}</span>}
        </strong>
        <span className="muted small">{new Date(d.createdAt).toLocaleString()}</span>
      </div>
      <p>{d.body}</p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          act(() => answerDowntime(cloudId, d.id, answer))
        }}
      >
        <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={`What happens? Seen only by ${who}`} />
        <div className="row wrap">
          <button className="primary" disabled={busy || answer.trim() === (d.answer ?? '')}>
            {d.answer ? 'Update answer' : 'Send answer'}
          </button>
          <button type="button" className="ghost danger" disabled={busy} onClick={() => confirm('Delete this?') && act(() => deleteDowntime(cloudId, d.id))}>
            Delete
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
      </form>
    </div>
  )
}
