import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../cloud/client'
import { joinRoom, sendOnce } from '../cloud/live'
import { DraftText, Empty, Skeleton } from '../components'
import { db, type Safety, type World } from '../db'
import { Help } from '../help'
import '../more.css'
import { useWorld } from '../hooks'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { HandPalm, Shield } from '@phosphor-icons/react'
import { worldPath } from '../paths'
import { toast } from '../undo'

/**
 * Safety tools: the table's lines (never in the game) and veils (off screen only), notes on other
 * tools, and an anonymous X-card. Everyone in the world can read this page; only the GM edits it.
 * The X-card goes straight to the GM's screen over Realtime, without the player's name.
 */

const blank = (): Safety => ({ lines: [], veils: [], notes: '' })

export default function SafetyPage() {
  const { world } = useWorld()
  const { isGM } = useViewMode()
  if (!world) return <Skeleton />
  const safety = { ...blank(), ...world.safety }
  const update = (patch: Partial<Safety>) => db.worlds.update(world.id, { safety: { ...safety, ...patch }, updatedAt: Date.now() })
  // Puts a removed line or veil back where it was, starting from what's saved now.
  const putBack = (list: 'lines' | 'veils', item: string, at: number) =>
    db.worlds
      .where('id')
      .equals(world.id)
      .modify((w) => {
        const now = { ...blank(), ...w.safety }
        if (now[list].includes(item)) return
        const next = [...now[list]]
        next.splice(Math.min(at, next.length), 0, item)
        w.safety = { ...now, [list]: next }
        w.updatedAt = Date.now()
      })
  const memberOf = world.shared?.memberOf
  const empty = !safety.lines.length && !safety.veils.length && !safety.notes.trim()
  // Lines and veils are for the people at the table, never for a public wiki link.
  if (world.shared?.token) return <Empty>Table rules are for the players at the table.</Empty>

  return (
    <div className="page more-screen">
      <header className="page-header">
        <h1>
          <Ico as={Shield} /> {isGM ? 'Safety tools' : 'Table rules'} <Help topic={isGM ? 'safety' : 'tableRules'} />
        </h1>
        {!isGM && <p className="muted">What your table agreed before playing, so the game stays fun for everyone.</p>}
      </header>
      {memberOf && safety.xcard && <XCardButton cloudId={memberOf} />}
      {!isGM && !memberOf && safety.xcard && <p className="muted small">Players who joined have an X-card button here.</p>}
      {!isGM && empty ? (
        <Empty>Your GM hasn’t written down any lines or veils yet. You can always tell them privately.</Empty>
      ) : (
        <div className="two-col">
          <SafetyList
            title="⛔ Lines"
            hint="Never in the game, not even off screen."
            items={safety.lines}
            isGM={isGM}
            onChange={(lines) => update({ lines })}
            onRemoved={(x, i) => toast(`Line “${x}” removed`, () => putBack('lines', x, i))}
            placeholder="e.g. Harm to children"
          />
          <SafetyList
            title="🌫️ Veils"
            hint="Can happen, but off screen: we fade to black."
            items={safety.veils}
            isGM={isGM}
            onChange={(veils) => update({ veils })}
            onRemoved={(x, i) => toast(`Veil “${x}” removed`, () => putBack('veils', x, i))}
            placeholder="e.g. Torture"
          />
        </div>
      )}
      {(isGM || safety.notes.trim()) && (
        <section>
          <h2>Other things we agreed</h2>
          {isGM ? (
            <DraftText
              multiline
              rows={4}
              value={safety.notes}
              onCommit={(notes) => update({ notes })}
              placeholder="e.g. Anyone can call a break. We check in after heavy scenes. Stars and wishes at the end of each session."
            />
          ) : (
            <p className="pre-wrap">{safety.notes}</p>
          )}
        </section>
      )}
      {isGM && (
        <section>
          <h2>
            <Ico as={HandPalm} /> X-card <Help topic="xcard" />
          </h2>
          <label className="inline-check">
            <input type="checkbox" checked={!!safety.xcard} onChange={(e) => update({ xcard: e.target.checked || undefined })} />
            Give players an X-card button
          </label>
          <p className="muted small">
            {world.cloud?.enabled
              ? 'When a player taps it, you get an alert on this screen straight away, without their name.'
              : 'Players need to have joined with an invite link (cloud sync on) for the button to reach you.'}
          </p>
        </section>
      )}
      {memberOf && (
        <p className="muted small">
          Something you’d rather say privately? <Link to={`${worldPath(world.id)}/questions`}>Send your GM a private question</Link>.
        </p>
      )}
    </div>
  )
}

function SafetyList({
  title,
  hint,
  items,
  isGM,
  onChange,
  onRemoved,
  placeholder,
}: {
  title: string
  hint: string
  items: string[]
  isGM: boolean
  onChange: (items: string[]) => unknown
  onRemoved: (item: string, at: number) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  return (
    <section>
      <h2>{title}</h2>
      <p className="muted small">{hint}</p>
      {items.length === 0 && <p className="muted">None yet.</p>}
      <ul className="safety-list">
        {items.map((x, i) => (
          <li key={i}>
            {x}
            {isGM && (
              <button className="ghost small" aria-label={`Remove ${x}`} onClick={async () => (await onChange(items.filter((_, j) => j !== i)), onRemoved(x, i))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {isGM && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            onChange([...items, draft.trim()])
            setDraft('')
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
          <button disabled={!draft.trim()}>Add</button>
        </form>
      )}
    </section>
  )
}

const channelName = (cloudWorldId: string) => `safety:${cloudWorldId}`

/**
 * A player taps the X-card. The tap is kept on the server (without a name) so the GM sees it even if
 * their app was closed, and the GM's open screen hears about it at once.
 */
async function sendXCard(cloudId: string) {
  const { error } = await supabase.rpc('tap_xcard', { wid: cloudId })
  if (error) throw new Error('Couldn’t reach your GM. Tell them in person, or check your connection.')
  await sendOnce(channelName(cloudId), 'xcard', {}, 8000)
}

export function XCardButton({ cloudId, small }: { cloudId: string; small?: boolean }) {
  const [state, setState] = useState<'' | 'sending' | 'sent' | string>('')
  return (
    <div className={small ? 'xcard small' : 'xcard'}>
      <button
        className="xcard-button"
        disabled={state === 'sending' || state === 'sent'}
        title="Tell your GM, without your name, that something isn’t OK"
        onClick={async () => {
          setState('sending')
          try {
            await sendXCard(cloudId)
            setState('sent')
            setTimeout(() => setState(''), 15_000)
          } catch (e) {
            setState((e as Error).message)
          }
        }}
      >
        <Ico as={HandPalm} /> X-card
      </button>
      {!small && <Help topic="xcard" />}
      {state === 'sent' && <span className="small">Sent to your GM. They’ll see it as soon as they look at the app. Thank you.</span>}
      {state && state !== 'sending' && state !== 'sent' && <span className="error small">{state}</span>}
    </div>
  )
}

const seenKey = (worldId: string) => `codex.xcard.seen.${worldId}`

/** For the GM: listens for X-card taps in a synced world, and shows any made while the app was closed. */
export function XCardAlert({ world }: { world: World }) {
  // When the tap was made, and whether it arrived live (then no time is needed).
  const [tap, setTap] = useState<{ at: number; live: boolean }>()
  const listening = !!world.cloud?.enabled && !world.shared && !!world.safety?.xcard
  useEffect(() => {
    if (!listening) return
    // Taps kept on the server since the GM last saw one (the last day's worth).
    const check = async () => {
      let seen = 0
      try {
        seen = Number(localStorage.getItem(seenKey(world.id)) ?? 0)
      } catch {
        // Storage blocked: show anything from the last day.
      }
      const { data } = await supabase
        .from('xcard_taps')
        .select('at')
        .eq('world_id', world.id)
        .gt('at', new Date(Math.max(seen, Date.now() - 86_400_000)).toISOString())
        .order('at', { ascending: false })
        .limit(1)
      const t = data?.[0] && Date.parse(data[0].at as string)
      if (t) setTap({ at: t, live: false })
    }
    check()
    const room = joinRoom(channelName(world.id))
    room.on('xcard', () => setTap({ at: 0, live: true }))
    const onVisible = () => !document.hidden && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      room.leave()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [listening, world.id])
  if (!tap) return null
  return (
    <div className="xcard-alert" role="alert">
      <strong><Ico as={HandPalm} /> Someone tapped the X-card{tap.live ? '' : ` at ${new Date(tap.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`}.</strong>{' '}
      Change course or skip ahead; no need to ask who or why.
      <button
        onClick={() => {
          try {
            localStorage.setItem(seenKey(world.id), String(Date.now()))
          } catch {
            // Storage blocked: it may show again next time.
          }
          setTap(undefined)
        }}
      >
        OK
      </button>
    </div>
  )
}
