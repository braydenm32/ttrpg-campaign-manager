import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty } from './components'
import { db, newId, type Clock, type Entity } from './db'
import { Help } from './help'
import { LecternPanel } from './lecternPanel'
import { useVisibleEntities, useWorld } from './hooks'
import { useViewMode } from './viewMode'
import { Ico, TypeIcon } from './icons'
import { Timer } from '@phosphor-icons/react'
import { pagePath, worldPath } from './paths'

/**
 * Progress clocks (as in Blades in the Dark): a circle cut into slices that fill as a plan, a threat
 * or a rival moves on. Clocks live on pages, usually factions or loose threads.
 */

export const CLOCK_SIZES = [4, 6, 8, 12]

async function changeClocks(entityId: string, fn: (list: Clock[]) => Clock[]) {
  await db.entities
    .where('id')
    .equals(entityId)
    .modify((x) => {
      x.clocks = fn(x.clocks ?? [])
      x.updatedAt = Date.now()
    })
}

export const setFilled = (entityId: string, clockId: string, filled: number) =>
  changeClocks(entityId, (l) => l.map((c) => (c.id === clockId ? { ...c, filled: Math.max(0, Math.min(c.segments, filled)) } : c)))

/** The clock itself. Click a slice to fill up to it (click the last filled slice to empty it). */
export function ClockFace({ clock, size = 64, onSet }: { clock: Clock; size?: number; onSet?: (filled: number) => void }) {
  const r = size / 2 - 2
  const c = size / 2
  const n = Math.max(1, clock.segments)
  const slice = (i: number) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
    const large = a1 - a0 > Math.PI ? 1 : 0
    return `M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z`
  }
  const full = clock.filled >= n
  return (
    <svg className={`clock-face ${full ? 'full' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clock.name}: ${clock.filled} of ${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          d={n === 1 ? `M${c},${c - r} A${r},${r} 0 1 1 ${c - 0.01},${c - r} Z` : slice(i)}
          className={i < clock.filled ? 'filled' : ''}
          onClick={onSet ? () => onSet(clock.filled === i + 1 ? i : i + 1) : undefined}
          style={onSet ? { cursor: 'pointer' } : undefined}
        />
      ))}
    </svg>
  )
}

function ClockRow({ clock, owner, isGM, showOwner, worldId }: { clock: Clock; owner: Entity; isGM: boolean; showOwner?: boolean; worldId: string }) {
  const onSet = isGM ? (f: number) => setFilled(owner.id, clock.id, f) : undefined
  return (
    <div className={`clock-row ${clock.filled >= clock.segments ? 'done' : ''}`}>
      <ClockFace clock={clock} onSet={onSet} />
      <div className="clock-info">
        <strong>{clock.name}</strong>
        <div className="muted small">
          {clock.filled} of {clock.segments}
          {clock.filled >= clock.segments && ' · it happens!'}
          {showOwner && (
            <>
              {' · '}
              <Link to={`${pagePath(worldId, owner.id)}`}>
                <TypeIcon type={owner.type} /> {owner.name}
              </Link>
            </>
          )}
        </div>
        {isGM && (
          <div className="row small">
            <button className="small" onClick={() => setFilled(owner.id, clock.id, clock.filled - 1)} disabled={clock.filled <= 0}>
              −
            </button>
            <button className="small" onClick={() => setFilled(owner.id, clock.id, clock.filled + 1)} disabled={clock.filled >= clock.segments}>
              +
            </button>
            <label className="inline-check" title="Players can see this clock (on pages they can see)">
              <input
                type="checkbox"
                checked={!!clock.known}
                onChange={(e) => {
                  const known = e.target.checked
                  changeClocks(owner.id, (l) => l.map((c) => (c.id === clock.id ? { ...c, known: known || undefined } : c)))
                }}
              />{' '}
              Players know
            </label>
            <button
              className="ghost small"
              title="Remove this clock"
              onClick={() => confirm(`Remove the clock “${clock.name}”?`) && changeClocks(owner.id, (l) => l.filter((c) => c.id !== clock.id))}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The Clocks box on a page. */
export function ClocksBox({ entity, isGM, worldId }: { entity: Entity; isGM: boolean; worldId: string }) {
  const [name, setName] = useState('')
  const [segments, setSegments] = useState(6)
  const [adding, setAdding] = useState(false)
  const clocks = entity.clocks ?? []
  if (!clocks.length && !isGM) return null
  if (!clocks.length && !adding)
    return (
      <button className="add-extra" onClick={() => setAdding(true)}>
        <Ico as={Timer} /> Add a clock
      </button>
    )
  return (
    <section className="clocks">
      <div className="section-header">
        <h2>
          <Ico as={Timer} /> Clocks <Help topic="clocks" />
        </h2>
        {isGM && !adding && <button onClick={() => setAdding(true)}>+ Clock</button>}
      </div>
      <div className="clock-list">
        {clocks.map((c) => (
          <ClockRow key={c.id} clock={c} owner={entity} isGM={isGM} worldId={worldId} />
        ))}
      </div>
      {isGM && adding && (
        <form
          className="row wrap"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return
            await changeClocks(entity.id, (l) => [...l, { id: newId(), name: name.trim(), segments, filled: 0 }])
            setName('')
            setAdding(false)
          }}
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="What happens when it fills? e.g. The ritual is complete" />
          <select value={segments} onChange={(e) => setSegments(Number(e.target.value))} aria-label="Slices">
            {CLOCK_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} slices
              </option>
            ))}
          </select>
          <button className="primary" disabled={!name.trim()}>
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      )}
    </section>
  )
}

/** Every clock in the world, for the Clocks page and the Lectern. */
export function useAllClocks(entities: Entity[]) {
  return entities.flatMap((e) => (e.clocks ?? []).map((clock) => ({ clock, owner: e })))
}

export function ClocksPanel({ worldId, entities }: { worldId: string; entities: Entity[] }) {
  const all = useAllClocks(entities).filter(({ clock }) => clock.filled < clock.segments)
  if (!all.length) return null
  return (
    <LecternPanel id="clocks" name="Clocks" keywords="progress countdown plan faction" title={<><Ico as={Timer} /> <Link to={`${worldPath(worldId)}/clocks`}>Clocks</Link> <Help topic="clocks" /></>}>
      <div className="clock-list compact">
        {all.map(({ clock, owner }) => (
          <ClockRow key={clock.id} clock={clock} owner={owner} isGM showOwner worldId={worldId} />
        ))}
      </div>
    </LecternPanel>
  )
}

/** The Clocks page: every ticking clock, by page. */
export default function ClocksPage() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const all = useAllClocks(entities)
  const ticking = all.filter(({ clock }) => clock.filled < clock.segments)
  const done = all.filter(({ clock }) => clock.filled >= clock.segments)
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={Timer} /> Clocks <Help topic="clocks" />
        </h1>
      </header>
      {all.length === 0 ? (
        <Empty>
          {isGM ? 'No clocks yet. Open a faction, a villain or a loose thread and add one from its Clocks box.' : 'Your GM hasn’t shared any clocks.'}
        </Empty>
      ) : (
        <>
          <div className="clock-list">
            {ticking.map(({ clock, owner }) => (
              <ClockRow key={clock.id} clock={clock} owner={owner} isGM={isGM} showOwner worldId={worldId} />
            ))}
          </div>
          {done.length > 0 && (
            <>
              <h2>Run out</h2>
              <div className="clock-list">
                {done.map(({ clock, owner }) => (
                  <ClockRow key={clock.id} clock={clock} owner={owner} isGM={isGM} showOwner worldId={worldId} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
