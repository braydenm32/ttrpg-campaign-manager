import { binFile } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import '../more.css'
import { useState } from 'react'
import { Empty, Skeleton, TagInput } from '../components'
import { VisibilityControl } from '../reveal'
import { db, type Asset } from '../db'
import { BIG_FILE, formatBytes, saveFileAsAsset, useBlobUrl, useWorld } from '../hooks'
import { outOfRoom } from '../undo'
import { ShowButton, unshowableImages } from '../showing'
import { Ico } from '../icons'
import { useViewMode } from '../viewMode'
import { File, Folder } from '@phosphor-icons/react'
import { assetUses, friendlyName, keyNamed } from '../assetUses'

export default function Assets() {
  const { worldId } = useWorld()
  const stored = useLiveQuery(() => db.assets.where({ worldId }).reverse().sortBy('createdAt'), [worldId])
  const assets = stored ?? []
  const unshowable = useLiveQuery(() => unshowableImages(worldId), [worldId])
  const uses = useLiveQuery(() => assetUses(worldId), [worldId])
  const [filter, setFilter] = useState('')
  const [unused, setUnused] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const q = filter.trim().toLowerCase()
  const nameOf = (a: Asset) => friendlyName(a.name, uses?.get(a.id))
  const isUnused = (a: Asset) => !!uses && !uses.has(a.id)
  const shown = assets.filter(
    (a) => (!q || nameOf(a).toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q))) && (!unused || isUnused(a)),
  )
  const unusedCount = assets.filter(isUnused).length
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
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              setUploadNote('')
              setUploadNote(await upload(worldId, files))
            }}
          />
        </label>
      </header>
      {uploadNote && (
        <p className="error small" role="alert">
          {uploadNote}
        </p>
      )}
      {assets.length > 0 && (
        <div className="row wrap">
          <input className="search" placeholder="Filter by name or tag…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter files" />
          <label className="inline-check">
            <input type="checkbox" checked={unused} onChange={(e) => setUnused(e.target.checked)} /> Not used anywhere{uses ? ` (${unusedCount})` : ''}
          </label>
          <Help topic="unusedFiles" />
        </div>
      )}
      {assets.length === 0 ? (
        <Empty>Nothing uploaded yet. Handouts, portraits, maps, music, PDFs: anything you upload, here or on a page, is kept here.</Empty>
      ) : shown.length === 0 ? (
        <Empty>{unused && !q ? 'Every file is used somewhere.' : `No ${unused ? 'unused ' : ''}file’s name or tag has “${filter.trim()}” in it.`}</Empty>
      ) : (
        <div className="card-grid">
          {shown.map((a) => (
            <AssetCard key={a.id} asset={a} unshowable={unshowable} uses={uses?.get(a.id)} known={!!uses} />
          ))}
        </div>
      )}
    </div>
  )
}

/** "“a”", "“a” and “b”", "“a”, “b” and “c”". */
const names = (list: string[]) => {
  const q = list.map((n) => `“${n}”`)
  return q.length > 1 ? `${q.slice(0, -1).join(', ')} and ${q.at(-1)}` : q.join('')
}

/**
 * Adds the files picked, one at a time. A file over 50 MB is checked with the GM first, and one that
 * doesn't fit on this device (or fails) doesn't stop the rest. Returns what to tell the GM, if anything.
 */
async function upload(worldId: string, files: File[]) {
  const full: string[] = []
  const failed: string[] = []
  for (const f of files) {
    if (
      f.size > BIG_FILE &&
      !confirm(`“${f.name}” is ${formatBytes(f.size)}. Files over 50 MB can’t go to the cloud, so they stay on this device only, and big files fill it up quickly. Upload it anyway?`)
    )
      continue
    try {
      await saveFileAsAsset(worldId, f, f.name)
    } catch (err) {
      console.warn('Upload failed', f.name, err)
      ;(outOfRoom(err) ? full : failed).push(f.name)
    }
  }
  return [
    full.length ? `Not enough room on this device for ${names(full)}. Free some space (old recordings, big files, or Recently deleted in More), then upload ${full.length === 1 ? 'it' : 'them'} again.` : '',
    failed.length ? `Couldn’t upload ${names(failed)}. Try again.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function AssetCard({ asset, unshowable, uses, known }: { asset: Asset; unshowable?: Map<string, string | undefined>; uses?: string[]; known: boolean }) {
  const url = useBlobUrl(asset)
  const update = (patch: Partial<Asset>) => db.assets.update(asset.id, patch)
  const kind = asset.mime.split('/')[0]
  const recording = asset.tags.includes('recording')
  return (
    <div className="card asset-card">
      {url && kind === 'image' && <img src={url} alt={asset.name} loading="lazy" decoding="async" />}
      {url && kind === 'audio' && <audio controls src={url} preload="none" />}
      {kind !== 'image' && kind !== 'audio' && <div className="file-icon"><Ico as={File} /></div>}
      {/* The example's pictures are stored under internal names: they show (and are saved, once edited) as what they're for. */}
      <input value={keyNamed(asset.name) ? friendlyName(asset.name, uses) : asset.name} onChange={(e) => update({ name: e.target.value })} aria-label="File name" />
      <div className="muted small">
        {formatBytes(asset.size)}
        {known && (uses?.length ? ` · Used by ${uses.slice(0, 2).join(', ')}${uses.length > 2 ? ` and ${uses.length - 2} more` : ''}` : ' · Not used anywhere')}
      </div>
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
        <VisibilityControl
          value={asset.visibility}
          onChange={(visibility) => update({ visibility })}
          name={`“${asset.name}”`}
          compact
          see={[recording ? 'the whole recording, to listen to or download' : kind === 'image' ? 'the picture' : kind === 'audio' ? 'the sound' : 'the file']}
          warn={recording ? 'This is a recording of your session: every player gets the whole audio, everything said at the table included (asides, rules talk and GM secrets).' : undefined}
        />
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
