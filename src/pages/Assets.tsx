import { binFile } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useState } from 'react'
import { Empty, TagInput, VisibilityToggle } from '../components'
import { db, type Asset } from '../db'
import { formatBytes, saveFileAsAsset, useBlobUrl, useWorld } from '../hooks'
import { ShowButton, unshowableImages } from '../showing'
import { Ico } from '../icons'
import { File, Folder } from '@phosphor-icons/react'

export default function Assets() {
  const { worldId } = useWorld()
  const assets = useLiveQuery(() => db.assets.where({ worldId }).reverse().sortBy('createdAt'), [worldId]) ?? []
  const unshowable = useLiveQuery(() => unshowableImages(worldId), [worldId])
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const shown = assets.filter((a) => !q || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)))
  const total = assets.reduce((n, a) => n + a.size, 0)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={Folder} /> Assets <Help topic="assets" />
          </h1>
          <div className="muted">
            {assets.length} files · {formatBytes(total)} stored on this device
          </div>
        </div>
        <label className="button primary">
          + Upload files
          <input
            type="file"
            multiple
            hidden
            onChange={async (e) => {
              for (const f of Array.from(e.target.files ?? [])) await saveFileAsAsset(worldId, f, f.name)
              e.target.value = ''
            }}
          />
        </label>
      </header>
      <input className="search" placeholder="Filter by name or tag…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {shown.length === 0 ? (
        <Empty>Handouts, portraits, maps, music, PDFs. Anything you upload is kept here.</Empty>
      ) : (
        <div className="card-grid">
          {shown.map((a) => (
            <AssetCard key={a.id} asset={a} unshowable={unshowable} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssetCard({ asset, unshowable }: { asset: Asset; unshowable?: Map<string, string | undefined> }) {
  const url = useBlobUrl(asset)
  const update = (patch: Partial<Asset>) => db.assets.update(asset.id, patch)
  const kind = asset.mime.split('/')[0]
  return (
    <div className="card asset-card">
      {url && kind === 'image' && <img src={url} alt={asset.name} />}
      {url && kind === 'audio' && <audio controls src={url} preload="none" />}
      {kind !== 'image' && kind !== 'audio' && <div className="file-icon"><Ico as={File} /></div>}
      <input value={asset.name} onChange={(e) => update({ name: e.target.value })} />
      <div className="muted small">{formatBytes(asset.size)}</div>
      <TagInput tags={asset.tags} onChange={(tags) => update({ tags })} />
      {/* A map picture players mustn't see shows their copy instead (showToPlayers swaps it). */}
      {kind === 'image' && !asset.tags.includes('fog') && unshowable && (
        <>
          <ShowButton
            worldId={asset.worldId}
            what={{ kind: 'image', title: asset.name.replace(/\.[^.]+$/, ''), assetId: asset.id }}
            disabled={unshowable.has(asset.id) && !unshowable.get(asset.id) ? 'Open the map once to make the players’ fogged copy first.' : undefined}
          />
          {unshowable.has(asset.id) && (
            <div className="muted small">
              {unshowable.get(asset.id) ? 'Your copy of a map: players are shown theirs, without the hidden parts.' : 'The full picture of a fogged map: players can’t be shown it.'}
            </div>
          )}
        </>
      )}
      <div className="row spread">
        <VisibilityToggle value={asset.visibility} onChange={(visibility) => update({ visibility })} />
        <div className="row">
          {url && (
            <a className="button" href={url} download={asset.name}>
              ⬇
            </a>
          )}
          <button
            className="danger"
            onClick={async () => {
              const usedBy = await db.maps.filter((m) => m.imageId === asset.id).count()
              if (!confirm(usedBy ? 'This file is used as a map image. Delete anyway?' : `Delete "${asset.name}"?`)) return
              await binFile(asset.id)
            }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
