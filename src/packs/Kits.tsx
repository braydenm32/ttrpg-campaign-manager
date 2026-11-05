/**
 * The map builder's pickers for walls, fences and floor textures from map packs: the wall and fence
 * sets for the Walls tool, and the floor textures the Ground tool can paint with. Like pack pieces,
 * only small previews are on the device at first; a set's pictures download when it's picked.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type PackPiece } from '../db'
import { useWorld } from '../hooks'
import { Help } from '../help'
import { GROUNDS, isPackGround, type Drawing, type GroundId } from '../mapDrawing'
import { fileKey, kitPictures, loadPicture, lookOf, packAssetName, pictureFor, registerPackPiece, versionsOf } from './art'
import { loadBuiltinPack } from './builtin'
import { PackThumb } from './PackPicker'
import { fetchPackFile, worldPacks } from './store'
import { groundLabel, tilePicture } from './tiles'

/** A ground's name: one the app paints, or a pack's floor texture. */
export const groundName = (g: GroundId) => (isPackGround(g) ? groundLabel(g) : GROUNDS[g])

/** The wall and fence sets, or the floor textures, of the packs switched on for this world. */
export function useKits(use: 'tiles' | 'ground'): PackPiece[] {
  const { world } = useWorld()
  const on = worldPacks(world ?? undefined)
  const kits =
    useLiveQuery(
      () =>
        db.packPieces
          .where('packId')
          .anyOf(on)
          .filter((p) => !p.hidden && (use === 'ground' ? p.use === 'ground' : p.use === 'wall' || p.use === 'fence'))
          .toArray(),
      [on.join(), use],
    ) ?? []
  useEffect(() => void loadBuiltinPack().catch(() => {}), [])
  useEffect(() => {
    for (const k of kits) registerPackPiece(k)
  }, [kits.map((k) => `${k.id}@${k.rev}`).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  return kits
}

/** The picture a set's button shows: a straight run of wall, or the texture itself. */
const shownOf = (p: PackPiece, d: Drawing) => (p.use === 'ground' ? pictureFor(p.versions, 0, lookOf(d)) : Math.max(0, tilePicture(p.versions, 'straight', 0, lookOf(d))))

/** Downloads (or loads from the device) the pictures a set needs on this map. */
export async function loadKit(p: PackPiece, d: Drawing) {
  registerPackPiece(p)
  const got = await Promise.all(kitPictures(versionsOf(p), lookOf(d)).map((v) => loadPicture(p, p.rev, v, 'full').catch(() => false)))
  return got.some(Boolean)
}

/** A grid of wall and fence sets, or floor textures, to pick from. */
export function KitPicker({ kits, drawing, value, label, onPick }: { kits: PackPiece[]; drawing: Drawing; value?: string; label: string; onPick: (name: string) => void }) {
  const look = lookOf(drawing)
  const ids = kits.map((k) => k.id)
  const keys = new Set(useLiveQuery(() => (ids.length ? db.packFiles.where('pieceId').anyOf(ids).primaryKeys() : []), [ids.join()]) ?? [])
  const [loading, setLoading] = useState<string>()
  const [failed, setFailed] = useState('')
  useEffect(() => {
    void Promise.all(kits.map((p) => fetchPackFile(p, p.rev, shownOf(p, drawing), 'thumb').catch(() => undefined)))
  }, [kits.map((k) => `${k.id}@${k.rev}`).join(), look.mode]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!kits.length) return null
  const ready = (p: PackPiece) => kitPictures(versionsOf(p), look).every((v) => keys.has(fileKey(p.id, p.rev, v, 'full')))
  const groups = new Map<string, PackPiece[]>()
  for (const k of kits) groups.set(k.group || label, [...(groups.get(k.group || label) ?? []), k])
  const pick = async (p: PackPiece) => {
    setFailed('')
    setLoading(p.id)
    try {
      if (!(await loadKit(p, drawing))) return setFailed(`Couldn’t download ${p.label}. Are you online?`)
      onPick(packAssetName(p.id, p.rev))
    } finally {
      setLoading(undefined)
    }
  }
  return (
    <div className="pack-picker" role="group" aria-label={label}>
      {[...groups].map(([group, items]) => (
        <div key={group} className="label">
          <span>
            {group} {group === 'Floors & ground' && <Help topic="packGrounds" />}
          </span>
          <div className="stamp-grid">
            {[...items]
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((p) => {
                const name = packAssetName(p.id, p.rev)
                const has = ready(p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pack-tile${value === name ? ' on' : ''}`}
                    aria-pressed={value === name}
                    title={has ? p.label : `${p.label}: downloads when you pick it`}
                    aria-label={p.label}
                    onClick={() => void pick(p)}
                  >
                    <PackThumb piece={p} version={shownOf(p, drawing)} />
                    <span>{p.label}</span>
                    {loading === p.id ? <span className="pack-badge busy" aria-hidden /> : has ? <span className="pack-badge ok" aria-hidden /> : <span className="pack-badge get" aria-hidden />}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
      {failed && <p className="error small">{failed}</p>}
    </div>
  )
}
