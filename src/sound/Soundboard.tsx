import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Sound } from '../db'
import { Help } from '../help'
import { setLiveVolume, stopAll, toggle, usePlaying } from './player'
import { Ico } from '../icons'
import { MusicNotes } from '@phosphor-icons/react'
import { worldPath } from '../paths'

export const soundGroups = (sounds: Sound[]) => {
  const groups = new Map<string, Sound[]>()
  for (const s of sounds) groups.set(s.group || 'Sounds', [...(groups.get(s.group || 'Sounds') ?? []), s])
  return [...groups.entries()]
}

export function useSounds(worldId: string) {
  return useLiveQuery(() => db.sounds.where({ worldId }).sortBy('createdAt'), [worldId]) ?? []
}

/** The soundboard's buttons: tap to play, tap again to stop. Used at the Lectern and on the Soundboard page. */
export function Soundboard({ worldId, compact }: { worldId: string; compact?: boolean }) {
  const sounds = useSounds(worldId)
  const playing = usePlaying()
  const [error, setError] = useState('')
  const run = (p: Promise<unknown>) => {
    setError('')
    p.catch((e: Error) => setError(e.message || 'That sound couldn’t play.'))
  }
  const body = (
    <>
      {sounds.length === 0 && (
        <p className="muted small">
          No sounds yet. <Link to={`${worldPath(worldId)}/sounds`}>Add your own files or Syrinscape moods</Link>.
        </p>
      )}
      {soundGroups(sounds).map(([group, list]) => (
        <div key={group} className="sound-group">
          <div className="muted small">{group}</div>
          <div className="row wrap">
            {list.map((s) => {
              const on = playing.includes(s.id)
              return (
                <span key={s.id} className={`sound-button ${on ? 'on' : ''}`}>
                  <button className={on ? 'primary' : ''} title={on ? 'Stop' : s.loop ? 'Play on a loop' : 'Play'} onClick={() => run(toggle(s))}>
                    {on ? '■' : s.source === 'syrinscape' ? '🔊' : s.loop ? '🔁' : '▶'} {s.name}
                  </button>
                  {on && s.source === 'file' && (
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      defaultValue={s.volume}
                      title="Volume"
                      onChange={(e) => setLiveVolume(s.id, Number(e.target.value))}
                    />
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ))}
      {error && <p className="error small">{error}</p>}
    </>
  )
  if (!compact) return body
  return (
    <section className="card lectern-panel">
      <div className="row spread">
        <h2>
          <Ico as={MusicNotes} /> Soundboard <Help topic="soundboard" />
        </h2>
        <div className="row">
          {playing.length > 0 && (
            <button className="ghost small" onClick={() => run(stopAll())}>
              ■ Stop all
            </button>
          )}
          <Link className="small" to={`${worldPath(worldId)}/sounds`}>
            Edit
          </Link>
        </div>
      </div>
      {body}
    </section>
  )
}
