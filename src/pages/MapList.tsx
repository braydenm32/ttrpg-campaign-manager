import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal, VisibilityBadge } from '../components'
import { db, newId, type WorldMap } from '../db'
import { imageSize, saveFileAsAsset, useAssetUrl, useWorld } from '../hooks'
import { BACKGROUNDS, emptyDrawing, GROUNDS, renderDrawing, type Background, type GroundId, type MapStyle, type Scene } from '../mapDrawing'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { MapTrifold, PencilSimple } from '@phosphor-icons/react'
import { worldPath } from '../paths'

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
      navigate(`${worldPath(worldId)}/maps/${id}`)
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
          <Ico as={MapTrifold} /> Maps <Help topic="maps" />
        </h1>
        {isGM && (
          <div className="row">
          <button onClick={() => setDrawing(true)}><Ico as={PencilSimple} /> Draw a new map</button>
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
      {drawing && <NewDrawnMap worldId={worldId} onClose={() => setDrawing(false)} onCreated={(id) => navigate(`${worldPath(worldId)}/maps/${id}/draw`)} />}
    </div>
  )
}

const SIZES = {
  region: { label: 'World or region (2400 × 1600)', w: 2400, h: 1600, bg: 'sea' as Background, style: 'classic' as MapStyle, scene: 'world' as Scene, ground: 'grass' as GroundId },
  city: { label: 'Town or city (1800 × 1200)', w: 1800, h: 1200, bg: 'grass' as Background, style: 'simple' as MapStyle, scene: 'world' as Scene, ground: 'grass' as GroundId },
  dungeon: { label: 'Dungeon or building, 5 ft squares (1400 × 1400)', w: 1400, h: 1400, bg: 'stone' as Background, style: 'simple' as MapStyle, scene: 'battle' as Scene, ground: 'paving' as GroundId },
  battle: { label: 'Battle map, 5 ft squares (2100 × 1400)', w: 2100, h: 1400, bg: 'grass' as Background, style: 'classic' as MapStyle, scene: 'battle' as Scene, ground: 'grass' as GroundId },
}

function NewDrawnMap({ worldId, onClose, onCreated }: { worldId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [size, setSize] = useState<keyof typeof SIZES>('region')
  const [bg, setBg] = useState<Background>('sea')
  const [style, setStyle] = useState<MapStyle>('classic')
  const [ground, setGround] = useState<GroundId>('grass')
  const scene = SIZES[size].scene
  return (
    <Modal title="Draw a new map" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const { w, h } = SIZES[size]
          const drawing = emptyDrawing(style === 'classic' && scene === 'world' && bg !== 'sea' ? 'parchment' : bg, style, scene, ground)
          let blob: Blob
          if (style === 'classic') {
            const { renderClassic, classicBlob, loadMapFonts } = await import('../mapArt/classic')
            await loadMapFonts()
            blob = await classicBlob(renderClassic(drawing, w, h))
          } else blob = new Blob([renderDrawing(drawing, w, h)], { type: 'image/svg+xml' })
          const ext = blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/webp' ? 'webp' : 'jpg'
          const imageId = await saveFileAsAsset(worldId, blob, `${name.trim() || 'Map'}.${ext}`, ['map', 'drawn'])
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
              setStyle(SIZES[k].style)
              setGround(SIZES[k].ground)
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
          <span>
            Style <Help topic="mapStyle" />
          </span>
          <select value={style} onChange={(e) => setStyle(e.target.value as MapStyle)}>
            <option value="classic">Classic fantasy map (hand-inked)</option>
            <option value="simple">Simple (flat colours)</option>
          </select>
        </label>
        <label>
          Start with
          {style === 'classic' && scene === 'battle' ? (
            <select value={ground} onChange={(e) => setGround(e.target.value as GroundId)}>
              {(Object.keys(GROUNDS) as GroundId[]).map((g) => (
                <option key={g} value={g}>
                  {GROUNDS[g]} everywhere (paint the rest)
                </option>
              ))}
            </select>
          ) : style === 'classic' ? (
            <select value={bg === 'sea' ? 'sea' : 'parchment'} onChange={(e) => setBg(e.target.value as Background)}>
              <option value="sea">Open sea (paint the land)</option>
              <option value="parchment">All land (carve out the water)</option>
            </select>
          ) : (
            <select value={bg} onChange={(e) => setBg(e.target.value as Background)}>
              {Object.entries(BACKGROUNDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
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
    <Link className="card map-card" to={`${worldPath(worldId)}/maps/${map.id}`}>
      {url && <img src={url} alt="" />}
      <h3>
        {map.name} <VisibilityBadge value={map.visibility} />
      </h3>
    </Link>
  )
}
