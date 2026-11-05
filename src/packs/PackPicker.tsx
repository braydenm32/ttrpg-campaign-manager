/**
 * "Your packs" in the map builder's Place tool: the pieces of the GM's own map packs switched on
 * for this world. Only small previews are on the device at first; a piece's full picture downloads
 * the moment it's picked (or the whole pack at once, for playing offline), and is kept from then on.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type PackPiece } from '../db'
import { useWorld } from '../hooks'
import { worldPath } from '../paths'
import type { Drawing } from '../mapDrawing'
import { fileKey, loadPicture, packAssetName, registerPackPiece } from './art'
import { fetchThumbs, keepPackOnDevice, pullPacks, pullWorldPacks, worldPacks } from './store'

/** Which packs' pieces suit a map: battle pieces on battle maps, town (and battle) pieces on town maps, world pieces on world maps. */
export const scenesFor = (d: Pick<Drawing, 'scene'>) => (d.scene === 'battle' ? ['battle'] : d.scene === 'city' ? ['city', 'battle'] : ['world'])

/** A pack piece's preview, from this device. */
export function PackThumb({ piece, version = 0, px = 48 }: { piece: PackPiece; version?: number; px?: number }) {
  const file = useLiveQuery(() => db.packFiles.get(fileKey(piece.id, piece.rev, version, 'thumb')), [piece.id, piece.rev, version])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!file) return setUrl(undefined)
    const u = URL.createObjectURL(file.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url ? (
    <img src={url} alt="" style={{ width: px, height: px, objectFit: 'contain' }} />
  ) : (
    <span className="pack-thumb-empty" style={{ width: px, height: px }} aria-hidden />
  )
}

export function PackPicker({ drawing, words, pool, onPick }: { drawing: Drawing; words: string[]; pool: string[]; onPick: (asset: string) => void }) {
  const { worldId, world } = useWorld()
  const on = worldPacks(world ?? undefined)
  const packs = useLiveQuery(() => db.packs.bulkGet(on), [on.join()])?.filter((p) => p && !p.deleted) ?? []
  const allPacks = useLiveQuery(() => db.packs.filter((p) => !p.deleted && !p.borrowed).count(), []) ?? 0
  const scenes = scenesFor(drawing)
  const pieces = useLiveQuery(() => db.packPieces.where('packId').anyOf(on).filter((p) => !p.hidden).toArray(), [on.join()]) ?? []
  const fitting = pieces.filter((p) => scenes.includes(p.scene))
  const ids = fitting.map((p) => p.id)
  const keys = new Set(useLiveQuery(() => (ids.length ? db.packFiles.where('pieceId').anyOf(ids).primaryKeys() : []), [ids.join()]) ?? [])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [failed, setFailed] = useState('')
  const [shown, setShown] = useState<string>()
  const [keeping, setKeeping] = useState<{ done: number; total: number }>()

  // fresh lists from the cloud now and then, and every piece in the library (so maps and the version picker can draw them)
  useEffect(() => void pullPacks().then(() => pullWorldPacks(on)).catch(() => {}), [on.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    for (const p of fitting) registerPackPiece(p)
    void fetchThumbs(fitting)
  }, [fitting.map((p) => `${p.id}@${p.rev}`).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const packId = shown && packs.some((p) => p!.id === shown) ? shown : (packs.find((p) => fitting.some((x) => x.packId === p!.id))?.id ?? packs[0]?.id)
  const ready = (p: PackPiece) => p.versions.every((_, v) => keys.has(fileKey(p.id, p.rev, v, 'full')))
  const matches = (p: PackPiece) => !words.length || words.every((w) => `${p.label} ${p.group}`.toLowerCase().includes(w))
  // searching looks through every pack; otherwise one pack at a time
  const list = fitting.filter((p) => (words.length ? true : p.packId === packId) && matches(p))
  const byGroup = new Map<string, PackPiece[]>()
  for (const p of list) byGroup.set(p.group || 'Pieces', [...(byGroup.get(p.group || 'Pieces') ?? []), p])
  const groups = [...byGroup]

  const pick = async (p: PackPiece) => {
    setFailed('')
    const name = packAssetName(p.id, p.rev)
    registerPackPiece(p)
    setLoading((l) => ({ ...l, [p.id]: true }))
    try {
      const got = await Promise.all(p.versions.map((_, v) => loadPicture(p, p.rev, v, 'full').catch(() => false)))
      if (got.every((ok) => !ok)) {
        setFailed(`Couldn’t download ${p.label}. Are you online?`)
        return
      }
      onPick(name)
    } finally {
      setLoading((l) => ({ ...l, [p.id]: false }))
    }
  }

  if (!on.length || !packs.length)
    return (
      <p className="muted small">
        {allPacks ? (
          <>
            Switch one of your map packs on for this world in <Link to={`${worldPath(worldId)}/settings?at=packs`}>World settings › Map pieces</Link>.
          </>
        ) : (
          <>
            Your own pictures as map pieces: make a pack in <Link to={`${worldPath(worldId)}/packs`}>Map packs</Link>, then switch it on for this world.
          </>
        )}
      </p>
    )
  if (!fitting.length)
    return (
      <p className="muted small">
        The packs on this world have no pieces for {drawing.scene === 'battle' ? 'battle maps' : drawing.scene === 'city' ? 'town maps' : 'world maps'}. Change what a piece is for in{' '}
        <Link to={`${worldPath(worldId)}/packs`}>Map packs</Link>.
      </p>
    )

  const inPack = fitting.filter((p) => p.packId === packId)
  const here = inPack.filter(ready).length
  return (
    <div className="pack-picker">
      {packs.length > 1 && !words.length && (
        <div className="pack-chips" role="group" aria-label="Pack">
          {packs.map((k) => (
            <button key={k!.id} type="button" className={k!.id === packId ? 'on' : ''} aria-pressed={k!.id === packId} onClick={() => setShown(k!.id)}>
              {k!.name}
            </button>
          ))}
        </div>
      )}
      {!list.length && <p className="muted small">Nothing called that in your packs.</p>}
      {groups.map(([group, items]) => (
        <div key={group} className="label">
          <span>{group}</span>
          <div className="stamp-grid">
            {items.map((p) => {
              const name = packAssetName(p.id, p.rev)
              const has = ready(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pack-tile${pool.includes(name) ? ' on' : ''}`}
                  aria-pressed={pool.includes(name)}
                  title={has ? p.label : `${p.label}: downloads when you pick it`}
                  aria-label={has ? p.label : `${p.label}, preview only, downloads when you pick it`}
                  onClick={() => void pick(p)}
                >
                  <PackThumb piece={p} />
                  <span>{p.label}</span>
                  {loading[p.id] ? <span className="pack-badge busy" aria-hidden /> : has ? <span className="pack-badge ok" aria-hidden /> : <span className="pack-badge get" aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {failed && <p className="error small">{failed}</p>}
      {!words.length && (
        <p className="muted small pack-foot">
          {here} of {inPack.length} on this device.{' '}
          {here < inPack.length && (
            <button
              type="button"
              className="link"
              disabled={!!keeping}
              onClick={async () => {
                if (!packId) return
                setKeeping({ done: 0, total: 1 })
                const r = await keepPackOnDevice(packId, (done, total) => setKeeping({ done, total }))
                setKeeping(undefined)
                if (r.failed) setFailed(`${r.failed} picture${r.failed === 1 ? '' : 's'} couldn’t be downloaded. Are you online?`)
              }}
            >
              {keeping ? `Downloading ${keeping.done} of ${keeping.total}…` : 'Download the whole pack'}
            </button>
          )}
        </p>
      )}
    </div>
  )
}
