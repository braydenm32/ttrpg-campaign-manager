import { binFile } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import '../more.css'
import { useState } from 'react'
import { Empty, Skeleton, TagInput, VisibilityToggle } from '../components'
import { db, type Asset } from '../db'
import { formatBytes, saveFileAsAsset, useBlobUrl, useWorld } from '../hooks'
import { ShowButton, unshowableImages } from '../showing'
import { Ico } from '../icons'
import { useViewMode } from '../viewMode'
import { File, Folder } from '@phosphor-icons/react'

export default function Assets() {
  const { worldId } = useWorld()
  const stored = useLiveQuery(() => db.assets.where({ worldId }).reverse().sortBy('createdAt'), [worldId])
  const assets = stored ?? []
  const unshowable = useLiveQuery(() => unshowableImages(worldId), [worldId])
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const shown = assets.filter((a) => !q || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)))
  const total = assets.reduce((n, a) => n + a.size, 0)
  const { isGM } = useViewMode()
  if (!isGM) return <Empty>Files are a GM tool. Switch back to the GM view to use them.</Empty>
  if (!stored) return <Skeleton />

  return (
    <div className="page more-screen">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={Folder} /> Files <Help topic="assets" />
          </h1>
          <div className="muted">
            {assets.length ? `${assets.length} file${assets.length === 1 ? '' : 's'} · ${formatBytes(total)} stored on this device` : 'Pictures, maps, sounds and documents for this world.'}
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
      {assets.length > 0 && <input className="search" placeholder="Filter by name or tag…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter files" />}
      {assets.length === 0 ? (
        <Empty>Nothing uploaded yet. Handouts, portraits, maps, music, PDFs: anything you upload, here or on a page, is kept here.</Empty>
      ) : shown.length === 0 ? (
        <Empty>No file’s name or tag has “{filter.trim()}” in it.</Empty>
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
      <input value={asset.name} onChange={(e) => update({ name: e.target.value })} aria-label="File name" />
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
            <a className="button" href={url} download={asset.name} aria-label={`Download ${asset.name}`} title="Download">
              ⬇
            </a>
          )}
          <button
            className="danger"
            aria-label={`Delete ${asset.name}`}
            title="Delete (it goes to Recently deleted for a month)"
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
