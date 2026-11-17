import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, newId, type Sound } from '../db'
import { worldPath } from '../paths'
import { toast } from '../undo'
import { toggle, usePlaying } from './player'
import { listMoods, listSoundsets, useChosenSoundset, useSyrinscapeToken, type SyrinscapeMood, type SyrinscapeSoundset } from './syrinscape'

const CATEGORIES: Record<string, string> = { fantasy: 'Fantasy', 'sci-fi': 'Sci-fi', boardgame: 'Board game' }
const categoryName = (c: string) => CATEGORIES[c] ?? (c ? c[0].toUpperCase() + c.slice(1) : 'Other')

/** A mood played straight from a soundset, shaped like a soundboard button so the player can start and stop it. */
export const moodSound = (worldId: string, set: SyrinscapeSoundset, mood: SyrinscapeMood): Sound => ({
  id: `syrinscape-mood-${mood.id}`,
  worldId,
  name: mood.name,
  source: 'syrinscape',
  syrinscape: { kind: 'mood', id: mood.id },
  loop: false,
  volume: 1,
  group: set.name,
  createdAt: 0,
})

/**
 * Pick one of the soundsets in the GM's Syrinscape library and play its moods from here. Used on the
 * Soundboard page and at the Lectern. The soundset list and moods come from Syrinscape each time the
 * app opens; the last soundset picked in this world is remembered on this device.
 */
export function SyrinscapeSets({ worldId, compact }: { worldId: string; compact?: boolean }) {
  const token = useSyrinscapeToken()
  const [chosen, choose] = useChosenSoundset(worldId)
  const [sets, setSets] = useState<SyrinscapeSoundset[] | null>(null)
  const [moods, setMoods] = useState<{ uuid: string; list: SyrinscapeMood[] } | null>(null)
  const [error, setError] = useState('')
  const [moodError, setMoodError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const playing = usePlaying()
  const saved = useLiveQuery(() => db.sounds.where({ worldId }).toArray(), [worldId]) ?? []

  useEffect(() => {
    if (!token) return
    let live = true
    setError('')
    listSoundsets(refresh > 0)
      .then((list) => live && setSets(list))
      .catch((e: Error) => live && (setSets(null), setError(e.message)))
    return () => {
      live = false
    }
  }, [token, refresh])

  const uuid = chosen?.uuid
  useEffect(() => {
    if (!token || !uuid) return
    let live = true
    setMoodError('')
    listMoods(uuid)
      .then((list) => live && setMoods({ uuid, list }))
      .catch((e: Error) => live && setMoodError(e.message))
    return () => {
      live = false
    }
  }, [token, uuid, refresh])

  if (!token)
    return compact ? null : (
      <p className="small muted">Save your Syrinscape token below, and the soundsets in your Syrinscape library show up here to pick from.</p>
    )

  const list = moods && moods.uuid === uuid ? moods.list : null
  const groups = new Map<string, SyrinscapeSoundset[]>()
  for (const s of sets ?? []) groups.set(categoryName(s.category), [...(groups.get(categoryName(s.category)) ?? []), s])
  // A soundset picked earlier that's no longer in the list (removed from the library) still shows as picked.
  const missing = chosen && sets && !sets.some((s) => s.uuid === chosen.uuid)
  const run = (p: Promise<unknown>) => {
    setMoodError('')
    p.catch((e: Error) => setMoodError(e.message || 'That mood couldn’t play.'))
  }
  const savedIds = new Set(saved.filter((s) => s.syrinscape?.kind === 'mood').map((s) => s.syrinscape?.id))
  const unsaved = (list ?? []).filter((m) => !savedIds.has(m.id))

  return (
    <div className="syrinscape-sets">
      <div className="row wrap">
        <label>
          <span className="muted small">Soundset</span>{' '}
          <select
            aria-label="Syrinscape soundset"
            value={chosen?.uuid ?? ''}
            disabled={!sets}
            onChange={(e) => {
              const s = sets?.find((x) => x.uuid === e.target.value)
              choose(s ?? null)
            }}
          >
            <option value="">{sets ? (sets.length ? 'Pick a soundset…' : 'No soundsets in your library') : error ? 'Couldn’t load your soundsets' : 'Loading your soundsets…'}</option>
            {missing && <option value={chosen.uuid}>{chosen.name}</option>}
            {[...groups.entries()].map(([g, items]) => (
              <optgroup key={g} label={g}>
                {items.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {!compact && (
          <button className="ghost small" title="Ask Syrinscape again, e.g. after you add a soundset to your library" onClick={() => setRefresh((n) => n + 1)}>
            ↻ Refresh
          </button>
        )}
      </div>
      {error && (
        <p className="error small">
          {error} {compact && <Link to={`${worldPath(worldId)}/sounds`}>Open the Soundboard</Link>}
        </p>
      )}
      {chosen && !list && !moodError && <p className="muted small">Loading the moods in {chosen.name}…</p>}
      {chosen && list && (
        <div className="sound-group">
          {list.length === 0 && <p className="muted small">{chosen.name} has no moods.</p>}
          <div className="row wrap">
            {list.map((m) => {
              const s = moodSound(worldId, chosen, m)
              const on = playing.includes(s.id)
              return (
                <span key={m.id} className={`sound-button ${on ? 'on' : ''}`}>
                  <button className={on ? 'primary' : ''} title={on ? 'Stop' : 'Play in Syrinscape'} onClick={() => run(toggle(s))}>
                    {on ? '■' : '🔊'} {m.name}
                  </button>
                </span>
              )
            })}
          </div>
          {!compact && unsaved.length > 0 && (
            <p className="small">
              <button
                className="link"
                onClick={async () => {
                  const now = Date.now()
                  const rows: Sound[] = unsaved.map((m, i) => ({ ...moodSound(worldId, chosen, m), id: newId(), createdAt: now + i }))
                  await db.sounds.bulkAdd(rows)
                  toast(`Added ${rows.length} ${rows.length === 1 ? 'mood' : 'moods'} from ${chosen.name} to your buttons.`, () =>
                    db.sounds.bulkDelete(rows.map((r) => r.id)),
                  )
                }}
              >
                Keep {list.length === unsaved.length ? 'these moods' : `the other ${unsaved.length}`} as buttons
              </button>{' '}
              <span className="muted">(grouped under {chosen.name}, so they’re ready even without picking the soundset)</span>
            </p>
          )}
        </div>
      )}
      {moodError && <p className="error small">{moodError}</p>}
    </div>
  )
}
