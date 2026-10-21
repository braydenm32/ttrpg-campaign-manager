import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, VisibilityBadge } from '../components'
import { db, newId, type WorldMap } from '../db'
import { imageSize, saveFileAsAsset, useAssetUrl, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'

export default function MapList() {
  const { worldId } = useWorld()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const maps = useLiveQuery(() => db.maps.where({ worldId }).filter((m) => canSee(m.visibility)).sortBy('name'), [worldId, isGM]) ?? []
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const { width, height } = await imageSize(file)
      const imageId = await saveFileAsAsset(worldId, file, file.name, ['map'])
      const id = newId()
      await db.maps.add({
        id,
        worldId,
        name: file.name.replace(/\.[^.]+$/, ''),
        imageId,
        width,
        height,
        visibility: 'gm',
        createdAt: Date.now(),
      })
      navigate(`/w/${worldId}/maps/${id}`)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>🗺️ Maps</h1>
        {isGM && (
          <label className="button primary">
            {busy ? 'Uploading…' : '+ Upload map image'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
      </header>
      {maps.length === 0 ? (
        <Empty>
          {isGM
            ? 'Upload a map image (from Inkarnate, Wonderdraft, Dungeon Alchemist, a scan…) and add clickable pins and regions.'
            : 'No maps have been revealed yet.'}
        </Empty>
      ) : (
        <div className="card-grid">
          {maps.map((m) => (
            <MapCard key={m.id} map={m} worldId={worldId} />
          ))}
        </div>
      )}
    </div>
  )
}

function MapCard({ map, worldId }: { map: WorldMap; worldId: string }) {
  const url = useAssetUrl(map.imageId)
  return (
    <Link className="card map-card" to={`/w/${worldId}/maps/${map.id}`}>
      {url && <img src={url} alt="" />}
      <h3>
        {map.name} <VisibilityBadge value={map.visibility} />
      </h3>
    </Link>
  )
}
