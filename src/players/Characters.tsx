import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { claimCharacter, releaseCharacter, savePlayerNotes } from '../cloud/players'
import { db, type Entity, type World } from '../db'
import { useCharacterOwners } from './owners'

/** On a player character's page: who plays them, their player's notes, and claim / let go buttons. */
export function CharacterOwnerBox({ entity, world }: { entity: Entity; world: World }) {
  const { owners, memberOf, reload } = useCharacterOwners(world)
  const owner = owners.get(entity.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const iHaveOne = [...owners.values()].some((o) => o.mine)

  // Nothing to show in a world that isn't shared with players.
  if (!memberOf && !world.cloud?.enabled) return null

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="side-box owner-box">
      <h3>
        🎭 Player <Help topic="character" />
      </h3>
      {owner ? (
        <p>
          {owner.mine ? <strong>This is your character.</strong> : <>Played by <strong>{owner.name}</strong>.</>}
        </p>
      ) : (
        <p className="muted small">{memberOf ? 'Nobody has claimed this character yet.' : 'No player has claimed this character yet.'}</p>
      )}

      {memberOf && !owner && (
        <button className="primary" disabled={busy} onClick={() => run(() => claimCharacter(memberOf, entity.id))}>
          {iHaveOne ? 'Play this character too' : 'This is my character'}
        </button>
      )}

      {owner?.mine ? (
        <PlayerNotes key={entity.id} initial={owner.notes} onSave={(notes) => savePlayerNotes(memberOf!, entity.id, notes)} />
      ) : (
        owner?.notes && (
          <div className="player-notes">
            <div className="muted small">{owner.name}’s notes</div>
            <p className="pre-wrap">{owner.notes}</p>
          </div>
        )
      )}

      {owner && (owner.mine || !memberOf) && (
        <button
          className="ghost small"
          disabled={busy}
          onClick={() =>
            confirm(owner.mine ? 'Let go of this character? Your notes on them will be removed.' : `Release ${entity.name} from ${owner.name}? Their notes will be removed.`) &&
            run(() => releaseCharacter(memberOf ?? world.id, entity.id, !!memberOf))
          }
        >
          {owner.mine ? 'Let go of this character' : 'Release from this player'}
        </button>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}

function PlayerNotes({ initial, onSave }: { initial: string; onSave: (notes: string) => Promise<void> }) {
  const [text, setText] = useState(initial)
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const save = async () => {
    if (text === initial) return
    setState('saving')
    try {
      await onSave(text)
      setState('saved')
    } catch {
      setState('error')
    }
  }
  return (
    <label className="player-notes">
      <span className="small">Your notes (your GM and the table can read these)</span>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} placeholder="Backstory, goals, who you trust, what you’re hiding…" />
      <span className="muted small">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved' : state === 'error' ? 'Couldn’t save. Check your connection.' : 'Saves when you click away.'}
      </span>
    </label>
  )
}

/** In a world you've joined: a nudge to pick your character until you have one. */
export function ChooseCharacterBanner({ world }: { world: World }) {
  const { owners, memberOf } = useCharacterOwners(world)
  const pcs = useLiveQuery(() => db.entities.where({ worldId: world.id }).filter((e) => e.type === 'pc').toArray(), [world.id])
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  if (!memberOf || hidden || !pcs) return null
  if ([...owners.values()].some((o) => o.mine)) return null
  const free = pcs.filter((e) => !owners.has(e.id))

  return (
    <div className="choose-character">
      <div className="row spread">
        <strong>🎭 Which character are you playing?</strong>
        <button className="ghost small" onClick={() => setHidden(true)}>
          Later
        </button>
      </div>
      {free.length === 0 ? (
        <p className="muted small">
          {pcs.length ? 'Every character here already has a player.' : 'Your GM hasn’t revealed any player characters yet.'} Ask them to add or reveal
          yours, and it will show up here.
        </p>
      ) : (
        <div className="row wrap">
          {free.map((e) => (
            <span key={e.id} className="row">
              <button
                className="primary"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(e.id)
                  setError('')
                  try {
                    await claimCharacter(memberOf, e.id)
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setBusy('')
                  }
                }}
              >
                {busy === e.id ? 'Claiming…' : `🛡️ ${e.name}`}
              </button>
              <Link className="small" to={`/w/${world.id}/e/${e.id}`}>
                read
              </Link>
            </span>
          ))}
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
