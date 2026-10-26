import { useEffect, useState } from 'react'
import { Help } from '../help'
import { useAuthSession } from '../cloud/auth'
import { listPlayers } from '../cloud/players'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entity, type World } from '../db'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { EyeClosed } from '@phosphor-icons/react'

export interface PlayerChoice {
  userId: string
  name: string
  /** The characters they play (ids from the server, names once looked up), for "Sam (Wren)". */
  plays: string[]
}

/** The players who have joined the GM's synced world, with the characters they play. */
export function useWorldPlayers(world: World | null | undefined, entities: Entity[]) {
  const { user } = useAuthSession()
  const [players, setPlayers] = useState<PlayerChoice[]>()
  const cloudId = world && !world.shared && world.cloud?.enabled && user ? world.id : undefined
  useEffect(() => {
    if (!cloudId) return
    let live = true
    listPlayers(cloudId)
      .then(({ members, claims }) => {
        if (!live) return
        setPlayers(
          members
            .filter((m) => m.role === 'player')
            .map((m) => ({ userId: m.userId, name: m.name, plays: claims.filter((c) => c.userId === m.userId && c.approved).map((c) => c.entityId) })),
        )
      })
      .catch(() => {
        // Offline: no player list for now.
      })
    return () => {
      live = false
    }
  }, [cloudId])
  const names = new Map(entities.map((e) => [e.id, e.name]))
  return (players ?? []).map((p) => ({ ...p, plays: p.plays.flatMap((id) => (names.has(id) ? [names.get(id)!] : [])) }))
}

export const playerLabel = (p: PlayerChoice) => (p.plays.length ? `${p.name} (${p.plays.join(', ')})` : p.name)

/** In the editor of a GM-only page: tick the players who should see it anyway. */
export function RevealToPicker({
  world,
  entities,
  value,
  onChange,
}: {
  world: World
  entities: Entity[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const players = useWorldPlayers(world, entities)
  if (!world.cloud?.enabled) return null
  const gone = value.filter((id) => !players.some((p) => p.userId === id))
  return (
    <div className="reveal-picker">
      <span className="small">
        <Ico as={EyeClosed} /> Reveal just to: <Help topic="revealTo" />
      </span>
      {players.length === 0 && <span className="muted small">No players have joined yet. Invite them from World settings.</span>}
      {players.map((p) => (
        <label key={p.userId}>
          <input
            type="checkbox"
            checked={value.includes(p.userId)}
            onChange={(e) => onChange(e.target.checked ? [...value, p.userId] : value.filter((x) => x !== p.userId))}
          />
          {playerLabel(p)}
        </label>
      ))}
      {players.length > 0 && gone.length > 0 && (
        <button type="button" className="link small" onClick={() => onChange(value.filter((id) => !gone.includes(id)))}>
          Clear {gone.length} who left
        </button>
      )}
    </div>
  )
}

/** Next to a page's title: who a GM-only page has been revealed to, or (for a player) that it's just for them. */
export function RevealedToBadge({ entity, world, entities, isGM }: { entity: Entity; world: World | null | undefined; entities: Entity[]; isGM: boolean }) {
  const players = useWorldPlayers(isGM && entity.revealedTo?.length ? world : undefined, entities)
  if (!isGM) return entity.secretForYou ? <span className="badge for-you" title="Your GM revealed this to you, not the whole table"><Ico as={EyeClosed} /> Just for you</span> : null
  if (entity.visibility !== 'gm' || !entity.revealedTo?.length) return null
  const shown = players.filter((p) => entity.revealedTo!.includes(p.userId))
  return (
    <span className="badge reveal" title="GM-only, but these players can see it">
      <Ico as={EyeClosed} /> Revealed to {shown.length ? shown.map((p) => p.name).join(', ') : `${entity.revealedTo.length} player${entity.revealedTo.length > 1 ? 's' : ''}`}
    </span>
  )
}

/** In the sidebar while previewing the player view: see it as everyone, or as one player who has joined. */
export function PreviewAsPicker({ world }: { world: World }) {
  const { previewAs, setPreviewAs } = useViewMode()
  const pcs = useLiveQuery(() => db.entities.where({ worldId: world.id }).filter((e) => e.type === 'pc').toArray(), [world.id]) ?? []
  const players = useWorldPlayers(world, pcs)
  if (!world.cloud?.enabled || !players.length) return null
  return (
    <label className="preview-as small">
      <span>
        As <Help topic="previewAs" />
      </span>
      <select
        value={previewAs?.userId ?? ''}
        onChange={(e) => {
          const p = players.find((x) => x.userId === e.target.value)
          setPreviewAs(p ? { userId: p.userId, name: p.name, characterNames: p.plays } : undefined)
        }}
      >
        <option value="">Every player</option>
        {players.map((p) => (
          <option key={p.userId} value={p.userId}>
            {playerLabel(p)}
          </option>
        ))}
      </select>
    </label>
  )
}
