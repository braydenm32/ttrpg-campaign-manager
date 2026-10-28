import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal, VisibilityBadge } from '../components'
import { db, newId, type WorldMap } from '../db'
import { imageSize, saveFileAsAsset, useAssetUrl, useWorld } from '../hooks'
import { emptyDrawing, GROUNDS, toClassic, type Background, type GroundId, type Scene } from '../mapDrawing'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { MapTrifold, PencilSimple } from '@phosphor-icons/react'
import { worldPath } from '../paths'
import { playersImageId } from '../fog'

export default function MapList() {
  const { worldId } = useWorld()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const maps = useLiveQuery(() => db.maps.where({ worldId }).filter((m) => canSee(m.visibility)).sortBy('name'), [worldId, isGM]) ?? []
  const [busy, setBusy] = useState(false)
  const [drawing, setDrawing] = useState(false)
  useRedrawOldMaps(isGM ? maps : [])

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

/**
 * Maps drawn in the old flat-colour style are redrawn by hand, once: the drawing becomes a classic
 * one (its shapes all carry over) and the picture players see is rendered again from it.
 */
function useRedrawOldMaps(maps: WorldMap[]) {
  const done = useRef(new Set<string>())
  useEffect(() => {
    const old = maps.filter((m) => m.drawing && m.drawing.style !== 'classic' && !done.current.has(m.id))
    if (!old.length) return
    for (const m of old) done.current.add(m.id)
    ;(async () => {
      const { renderClassic, classicBlob, loadMapFonts } = await import('../mapArt/classic')
      await loadMapFonts()
      for (const m of old) {
        const drawing = toClassic(m.drawing!)
        const blob = await classicBlob(renderClassic(drawing, m.width, m.height))
        await db.transaction('rw', [db.maps, db.assets], async () => {
          await db.maps.update(m.id, { drawing })
          await db.assets.update(m.imageId, { blob, size: blob.size, mime: blob.type, updatedAt: Date.now() })
        })
      }
    })().catch((err) => console.error('Could not redraw an old map', err))
  }, [maps])
}

type Kind = 'world' | 'battle'
type Size = 'small' | 'medium' | 'large'
/** How big each kind of map starts. Battle maps are whole 5 ft squares of 70 px. */
const SIZES: Record<Scene, Record<Size, [number, number]>> = {
  world: { small: [1600, 1100], medium: [2400, 1600], large: [3600, 2400] },
  city: { small: [1800, 1200], medium: [2400, 1600], large: [3600, 2400] },
  battle: { small: [1400, 1050], medium: [2100, 1400], large: [2800, 2100] },
}
const SIZE_LABEL: Record<Size, string> = { small: 'Small', medium: 'Medium', large: 'Large' }
/** What the size means, in words a GM can picture. */
function sizeNote(scene: Scene, [w, h]: [number, number]) {
  if (scene === 'battle') return `${w / 70} × ${h / 70} squares`
  // a town map has a 5 ft square every 7 px
  if (scene === 'city') return `about ${(Math.round((w / 7) * 5 / 50) * 50).toLocaleString()} × ${(Math.round((h / 7) * 5 / 50) * 50).toLocaleString()} ft`
  return `${w} × ${h} px`
}

/** What a new map starts with: for a world map, sea, land or a town; for a battle map, rock or a ground. */
type Start = 'sea' | 'land' | 'town' | 'rock' | GroundId

function NewDrawnMap({ worldId, onClose, onCreated }: { worldId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('world')
  const [start, setStart] = useState<Start>('sea')
  const [size, setSize] = useState<Size>('medium')
  const scene: Scene = kind === 'battle' ? 'battle' : start === 'town' ? 'city' : 'world'
  const [w, h] = SIZES[scene][size]
  return (
    <Modal title="Draw a new map" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const bg: Background = start === 'sea' ? 'sea' : start === 'rock' ? 'stone' : scene === 'world' ? 'parchment' : 'grass'
          const ground: GroundId = start === 'rock' ? 'floor' : start === 'sea' || start === 'land' || start === 'town' ? 'grass' : start
          const drawing = emptyDrawing(bg, scene, ground)
          // a dungeon starts as solid rock to dig rooms out of
          if (start === 'rock') drawing.outside = 'rock'
          const { renderClassic, classicBlob, loadMapFonts } = await import('../mapArt/classic')
          await loadMapFonts()
          const blob = await classicBlob(renderClassic(drawing, w, h))
          const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
          const imageId = await saveFileAsAsset(worldId, blob, `${name.trim() || 'Map'}.${ext}`, ['map', 'drawn'])
          const id = newId()
          await db.maps.add({ id, worldId, name: name.trim() || 'Untitled map', imageId, width: w, height: h, visibility: 'gm', drawing, createdAt: Date.now() })
          onCreated(id)
        }}
      >
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'battle' ? 'e.g. The Sunken Crypt' : 'e.g. The Sword Coast'} />
        </label>
        <div className="label">
          <span>
            What are you drawing? <Help topic="newMap" />
          </span>
          <div className="map-kinds" role="radiogroup" aria-label="Kind of map">
            {(
              [
                ['world', 'World, region or city', 'Coasts, mountains, forests and towns, or a town seen from above'],
                ['battle', 'Dungeon, building or battle map', 'On 5 ft squares, for fights and exploring'],
              ] as const
            ).map(([k, title, note]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className={kind === k ? 'on' : ''}
                onClick={() => {
                  setKind(k)
                  setStart(k === 'battle' ? 'rock' : 'sea')
                }}
              >
                <strong>{title}</strong>
                <small>{note}</small>
              </button>
            ))}
          </div>
        </div>
        <label>
          Start with
          <select value={start} onChange={(e) => setStart(e.target.value as Start)}>
            {kind === 'world' ? (
              <>
                <option value="sea">Open sea (paint the land)</option>
                <option value="land">All land (carve out the water)</option>
                <option value="town">A town or city seen from above</option>
              </>
            ) : (
              <>
                <option value="rock">Solid rock (dig out a dungeon)</option>
                {(Object.keys(GROUNDS) as GroundId[]).map((g) => (
                  <option key={g} value={g}>
                    {GROUNDS[g]} everywhere (paint the rest)
                  </option>
                ))}
              </>
            )}
          </select>
        </label>
        <div className="label">
          Size
          <div className="segmented">
            {(Object.keys(SIZE_LABEL) as Size[]).map((k) => (
              <button key={k} type="button" className={size === k ? 'on' : ''} onClick={() => setSize(k)}>
                {SIZE_LABEL[k]}
              </button>
            ))}
          </div>
          <span className="muted">{sizeNote(scene, [w, h])}</span>
        </div>
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
  const { isGM } = useViewMode()
  // Previewing as a player shows the picture players get: fogged, or without the GM's secrets.
  const url = useAssetUrl(isGM ? map.imageId : map.fog?.on ? map.fog.imageId : playersImageId(map))
  return (
    <Link className="card map-card" to={`${worldPath(worldId)}/maps/${map.id}`}>
      {url && <img src={url} alt="" />}
      <h3>
        {map.name} <VisibilityBadge value={map.visibility} />
      </h3>
    </Link>
  )
}
