import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal, VisibilityBadge } from '../components'
import { db, newId, type WorldMap } from '../db'
import { imageSize, saveFileAsAsset, useAssetUrl, useWorld } from '../hooks'
import { BACKGROUNDS, emptyDrawing, renderDrawing, type Background } from '../mapDrawing'
import { useViewMode } from '../viewMode'

export default function MapList() {
  const { worldId } = useWorld()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const maps = useLiveQuery(() => db.maps.where({ worldId }).filter((m) => canSee(m.visibility)).sortBy('name'), [worldId, isGM]) ?? []
  const [busy, setBusy] = useState(false)
  const [drawing, setDrawing] = useState(false)

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
        <h1>
          🗺️ Maps <Help topic="maps" />
        </h1>
        {isGM && (
          <div className="row">
          <button onClick={() => setDrawing(true)}>✏️ Draw a new map</button>
          <label className="button primary">
            {busy ? 'Uploading…' : '+ Upload map image'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          </div>
        )}
      </header>
      {maps.length === 0 ? (
        <Empty>
          {isGM
            ? 'Draw a map here, or upload one (from Inkarnate, Wonderdraft, Dungeon Alchemist, a scan…), then add clickable pins and regions.'
            : 'No maps have been revealed yet.'}
        </Empty>
      ) : (
        <div className="card-grid">
          {maps.map((m) => (
            <MapCard key={m.id} map={m} worldId={worldId} />
          ))}
        </div>
      )}
      {drawing && <NewDrawnMap worldId={worldId} onClose={() => setDrawing(false)} onCreated={(id) => navigate(`/w/${worldId}/maps/${id}/draw`)} />}
    </div>
  )
}

const SIZES = {
  region: { label: 'World or region (2400 × 1600)', w: 2400, h: 1600, bg: 'sea' as Background },
  city: { label: 'Town or city (1800 × 1200)', w: 1800, h: 1200, bg: 'grass' as Background },
  dungeon: { label: 'Dungeon or building, 5 ft squares (1400 × 1400)', w: 1400, h: 1400, bg: 'stone' as Background },
  battle: { label: 'Battle map (2100 × 1400)', w: 2100, h: 1400, bg: 'grass' as Background },
}

function NewDrawnMap({ worldId, onClose, onCreated }: { worldId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [size, setSize] = useState<keyof typeof SIZES>('region')
  const [bg, setBg] = useState<Background>('sea')
  return (
    <Modal title="Draw a new map" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const { w, h } = SIZES[size]
          const drawing = emptyDrawing(bg)
          const blob = new Blob([renderDrawing(drawing, w, h)], { type: 'image/svg+xml' })
          const imageId = await saveFileAsAsset(worldId, blob, `${name.trim() || 'Map'}.svg`, ['map', 'drawn'])
          const id = newId()
          await db.maps.add({ id, worldId, name: name.trim() || 'Untitled map', imageId, width: w, height: h, visibility: 'gm', drawing, createdAt: Date.now() })
          onCreated(id)
        }}
      >
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Sword Coast" />
        </label>
        <label>
          Kind of map
          <select
            value={size}
            onChange={(e) => {
              const k = e.target.value as keyof typeof SIZES
              setSize(k)
              setBg(SIZES[k].bg)
            }}
          >
            {Object.entries(SIZES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start with
          <select value={bg} onChange={(e) => setBg(e.target.value as Background)}>
            {Object.entries(BACKGROUNDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <div className="row end">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Start drawing</button>
        </div>
      </form>
    </Modal>
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
