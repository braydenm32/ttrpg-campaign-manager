/**
 * World settings › Map pieces: which of the GM's map packs this world uses, the pack pieces its
 * maps are drawn with, and (when a piece gets new pictures) whether to swap them in.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type World } from '../db'
import { Help } from '../help'
import { worldPath } from '../paths'
import { toast } from '../undo'
import { PackThumb } from './PackPicker'
import { keepOldPictures, newerPictures, packUseIn, swapInNewPictures, type PieceUse } from './swap'
import { keepPackOnDevice, setWorldPack, shareWorldPacks, worldPacks } from './store'

export function WorldPacks({ world }: { world: World }) {
  const packs = useLiveQuery(() => db.packs.filter((p) => !p.deleted && !p.borrowed).toArray(), []) ?? []
  const on = worldPacks(world)
  const borrowed = useLiveQuery(() => db.packs.bulkGet(on), [on.join()])?.filter((p) => p && p.borrowed && !p.deleted) ?? []
  const maps = useLiveQuery(() => db.maps.where({ worldId: world.id }).toArray(), [world.id])
  const [uses, setUses] = useState<PieceUse[]>([])
  const [busy, setBusy] = useState<string>()

  useEffect(() => {
    void packUseIn(world.id).then(setUses)
  }, [world.id, maps])
  // a synced world tells the cloud its packs, so co-GMs can draw with them
  useEffect(() => void shareWorldPacks(world), [world.id, world.cloud?.enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const newer = newerPictures(uses, world)
  const keepHere = async () => {
    let failed = 0
    for (const id of on) {
      setBusy(`Downloading ${packs.find((p) => p.id === id)?.name ?? 'a pack'}…`)
      failed += (await keepPackOnDevice(id)).failed
    }
    setBusy(undefined)
    toast(failed ? `${failed} picture${failed === 1 ? '' : 's'} couldn’t be downloaded. Are you online?` : 'Every piece of this world’s packs is on this device.')
  }

  return (
    <section id="settings-packs">
      <h2>
        Map pieces <Help topic="worldPacks" />
      </h2>
      {!packs.length && !borrowed.length ? (
        <p className="muted">
          Your own pictures as map pieces: make a pack in <Link to={`${worldPath(world.id)}/packs`}>Map packs</Link>, then switch it on here.
        </p>
      ) : (
        <>
          <p className="muted small">Packs switched on show under “Your packs” in the map builder’s Place tool.</p>
          <div>
            {packs.map((p) => (
              <div key={p.id} className="pack-switch">
                <label>
                  <input type="checkbox" checked={on.includes(p.id)} onChange={(e) => void setWorldPack(world, p.id, e.target.checked)} /> {p.name}
                </label>
              </div>
            ))}
            {borrowed.map((p) => (
              <div key={p!.id} className="pack-switch">
                <label>
                  <input type="checkbox" checked onChange={() => void setWorldPack(world, p!.id, false)} /> {p!.name} <span className="muted small">(a co-GM’s)</span>
                </label>
              </div>
            ))}
          </div>
          <p className="small">
            <Link to={`${worldPath(world.id)}/packs`}>Manage your packs</Link>
            {on.length > 0 && (
              <>
                {' · '}
                <button type="button" className="link" disabled={!!busy} onClick={() => void keepHere()}>
                  {busy ?? 'Keep every piece on this device (for playing offline)'}
                </button>
              </>
            )}
          </p>
        </>
      )}

      {newer.map((u) => (
        <div key={u.piece.id} className="notice">
          <p>
            <strong>{u.piece.label}</strong> has new pictures. {u.maps.length === 1 ? `${u.maps[0].name} still uses` : `${u.maps.length} maps still use`} the old ones.
          </p>
          <div className="row wrap">
            <span className="row" style={{ gap: 2 }}>
              {u.piece.versions.slice(0, 4).map((_, v) => (
                <PackThumb key={v} piece={u.piece} version={v} px={36} />
              ))}
            </span>
            <button
              type="button"
              className="primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy(`Redrawing maps with the new ${u.piece.label}…`)
                const failed = await swapInNewPictures(world, u.piece)
                setBusy(undefined)
                setUses(await packUseIn(world.id))
                toast(failed ? `${failed} map${failed === 1 ? '' : 's'} couldn’t be redrawn: the new pictures didn’t download. Try again when you’re online.` : `Maps redrawn with the new ${u.piece.label}.`)
              }}
            >
              Use the new pictures
            </button>
            <button type="button" disabled={!!busy} onClick={() => void keepOldPictures(world, u.piece.id, u.piece.rev)}>
              Keep the old ones
            </button>
          </div>
        </div>
      ))}

      {uses.length > 0 && (
        <details>
          <summary>
            Pieces this world’s maps use ({uses.length})
          </summary>
          <ul className="small">
            {uses.map((u) => (
              <li key={u.piece.id}>
                {u.piece.label}: {u.maps.map((m) => m.name).join(', ')}
                {u.piece.hidden && <span className="muted"> (hidden from the picker)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
