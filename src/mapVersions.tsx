import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { DraftText, Modal } from './components'
import { db, newId, type MapVersion, type WorldMap } from './db'
import { Help } from './help'
import type { Drawing } from './mapDrawing'

/**
 * Saved versions of a drawn map, on this device only. The builder saves every stroke, so a stray
 * fill or erase is saved too; Undo covers the last steps in one tab, and these cover the rest: the
 * drawing as it was before each spell of drawing (every ten minutes or more apart), the last
 * UNNAMED_KEPT of them per map, plus any the GM named. Restore puts the drawing back and the pins
 * of its linked pieces with it, and the players' copy is redrawn from it like any other change.
 */

/** Unnamed versions kept per map; older ones are dropped. Named ones are kept until deleted. */
export const UNNAMED_KEPT = 10
/** A new version is kept only when the newest one is at least this old, so one evening's drawing isn't ten copies. */
const QUIET_FOR = 10 * 60_000

/** Keeps `drawing` as a version of the map, with its linked pieces' pins, and drops the oldest unnamed ones past the limit. */
export async function keepMapVersion(map: Pick<WorldMap, 'id' | 'worldId'>, drawing: Drawing, name?: string) {
  const piecePins = await db.pins.where({ mapId: map.id }).filter((p) => !!p.pieceId).toArray()
  const v: MapVersion = { id: newId(), mapId: map.id, worldId: map.worldId, at: Date.now(), drawing: structuredClone(drawing), piecePins, ...(name?.trim() ? { name: name.trim() } : {}) }
  await db.mapVersions.add(v)
  const unnamed = (await db.mapVersions.where({ mapId: map.id }).sortBy('at')).filter((x) => !x.name)
  if (unnamed.length > UNNAMED_KEPT) await db.mapVersions.bulkDelete(unnamed.slice(0, unnamed.length - UNNAMED_KEPT).map((x) => x.id))
  return v
}

/**
 * Called as the builder saves a change: keeps the drawing as it was before (`before`), unless a
 * version was kept in the last few minutes. Never stops the save if it fails (a full device, say).
 */
export async function keepBeforeChange(map: Pick<WorldMap, 'id' | 'worldId'>, before: Drawing | undefined) {
  if (!before) return
  try {
    const newest = (await db.mapVersions.where({ mapId: map.id }).sortBy('at')).at(-1)
    if (newest && Date.now() - newest.at < QUIET_FOR) return
    await keepMapVersion(map, before)
  } catch (e) {
    console.warn('Could not keep a version of the map', e)
  }
}

/** Puts back the pins of linked pieces that a version had and the map has lost since. */
export async function restorePiecePins(v: MapVersion) {
  const pieces = new Set(v.drawing.shapes.map((s) => s.id))
  const now = await db.pins.where({ mapId: v.mapId }).filter((p) => !!p.pieceId).toArray()
  const have = new Set(now.map((p) => p.pieceId))
  const back = v.piecePins.filter((p) => p.pieceId && pieces.has(p.pieceId) && !have.has(p.pieceId))
  if (back.length) await db.pins.bulkPut(back)
}

const when = (at: number) => new Date(at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** The builder's Versions window: name the drawing as it is now, and restore an earlier one. */
export function MapVersions({ map, drawing, onRestore, onClose }: { map: WorldMap; drawing: Drawing; onRestore: (v: MapVersion) => void; onClose: () => void }) {
  const versions = useLiveQuery(() => db.mapVersions.where({ mapId: map.id }).reverse().sortBy('at'), [map.id])
  const [name, setName] = useState('')
  const [kept, setKept] = useState('')
  return (
    <Modal title="Saved versions" onClose={onClose}>
      <div className="form map-versions">
        <p className="small muted">
          The map is saved as you draw. A version of it is also kept before each spell of drawing (the last {UNNAMED_KEPT}), on this device only. <Help topic="mapVersions" />
        </p>
        <form
          className="row wrap"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return
            await keepMapVersion(map, drawing, name)
            setKept(name.trim())
            setName('')
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Before the flood" aria-label="Name this version" />
          <button className="primary" disabled={!name.trim()}>
            Name this version
          </button>
        </form>
        {kept && <p className="small notice">Kept as “{kept}”. Named versions stay until you delete them.</p>}
        {!versions ? null : versions.length === 0 ? (
          <p className="muted">No earlier versions yet. One is kept the next time you change the map.</p>
        ) : (
          <ul className="entity-list map-version-list">
            {versions.map((v) => (
              <li key={v.id} className="row spread wrap">
                <span>
                  <DraftText value={v.name ?? ''} placeholder="Name this version" aria-label={`Name for the version from ${when(v.at)}`} onCommit={(n) => db.mapVersions.update(v.id, { name: n.trim() || undefined })} />
                  <span className="muted small"> {when(v.at)} · {v.drawing.shapes.length} pieces</span>
                </span>
                <span className="row">
                  <button
                    onClick={() => {
                      onRestore(v)
                      onClose()
                    }}
                  >
                    Restore
                  </button>
                  <button className="ghost" aria-label="Delete this version" title="Delete this version" onClick={() => db.mapVersions.delete(v.id)}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
