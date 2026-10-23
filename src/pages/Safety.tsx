import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../cloud/client'
import { DraftText, Empty } from '../components'
import { db, type Safety, type World } from '../db'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { useViewMode } from '../viewMode'

/**
 * Safety tools: the table's lines (never in the game) and veils (off screen only), notes on other
 * tools, and an anonymous X-card. Everyone in the world can read this page; only the GM edits it.
 * The X-card goes straight to the GM's screen over Realtime, without the player's name.
 */

const blank = (): Safety => ({ lines: [], veils: [], notes: '' })

export default function SafetyPage() {
  const { world } = useWorld()
  const { isGM } = useViewMode()
  if (!world) return null
  const safety = { ...blank(), ...world.safety }
  const update = (patch: Partial<Safety>) => db.worlds.update(world.id, { safety: { ...safety, ...patch }, updatedAt: Date.now() })
  const memberOf = world.shared?.memberOf
  const empty = !safety.lines.length && !safety.veils.length && !safety.notes.trim()

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          🛡️ Safety tools <Help topic="safety" />
        </h1>
      </header>
      {memberOf && safety.xcard && <XCardButton cloudId={memberOf} />}
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
            placeholder="e.g. Harm to children"
          />
          <SafetyList
            title="🌫️ Veils"
            hint="Can happen, but off screen: we fade to black."
            items={safety.veils}
            isGM={isGM}
            onChange={(veils) => update({ veils })}
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
            ✋ X-card <Help topic="xcard" />
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
          Something you’d rather say privately? <Link to={`/w/${world.id}/questions`}>Send your GM a private question</Link>.
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
  placeholder,
}: {
  title: string
  hint: string
  items: string[]
  isGM: boolean
  onChange: (items: string[]) => void
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
              <button className="ghost small" aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
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

/** A player taps the X-card: the GM's screen hears about it at once. No name is sent. */
async function sendXCard(cloudId: string) {
  const ch = supabase.channel(channelName(cloudId))
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Couldn’t reach your GM. Tell them in person, or check your connection.')), 8000)
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED')
        ch.send({ type: 'broadcast', event: 'xcard', payload: {} }).then(() => {
          clearTimeout(t)
          resolve()
        })
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t)
        reject(new Error('Couldn’t reach your GM. Tell them in person, or check your connection.'))
      }
    })
  }).finally(() => supabase.removeChannel(ch))
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
        ✋ X-card
      </button>
      {!small && <Help topic="xcard" />}
      {state === 'sent' && <span className="small">Your GM has been told. Thank you.</span>}
      {state && state !== 'sending' && state !== 'sent' && <span className="error small">{state}</span>}
    </div>
  )
}

/** For the GM: listens for X-card taps in a synced world and shows a clear alert. */
export function XCardAlert({ world }: { world: World }) {
  const [at, setAt] = useState<number>()
  const listening = !!world.cloud?.enabled && !world.shared && !!world.safety?.xcard
  useEffect(() => {
    if (!listening) return
    const ch = supabase
      .channel(channelName(world.id))
      .on('broadcast', { event: 'xcard' }, () => setAt(Date.now()))
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [listening, world.id])
  if (!at) return null
  return (
    <div className="xcard-alert" role="alert">
      <strong>✋ Someone tapped the X-card.</strong> Change course or skip ahead; no need to ask who or why.
      <button onClick={() => setAt(undefined)}>OK</button>
    </div>
  )
}
