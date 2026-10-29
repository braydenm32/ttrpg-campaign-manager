import { binMap } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOverlay, MapContainer, Marker, Polygon, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DraftText, Empty, VisibilityBadge, VisibilityToggle } from '../components'
import { blankEntity, db, ENTITY_LABELS, ENTITY_TYPES, newId, PICKER_TYPES, type Entity, type EntityType, type Pin, type WorldMap } from '../db'
import { useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { Markdown } from '../Markdown'
import { StatusBadge, statusIcon } from '../status'
import { SecretTextarea } from '../SecretTextarea'
import { SecretNamesWarning } from '../SecretNamesWarning'
import { useViewMode } from '../viewMode'
import { circleShape, fogOverlay, pinRevealed, playersImageId, rectShape, removeFog, renderPlayerFog } from '../fog'
import { Ico, TypeIcon } from '../icons'
import { CloudFog, DownloadSimple, Eye, HandPalm, MapPin, PencilSimple, SlidersHorizontal } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { ExportMap } from '../ExportMap'
import { toClassic } from '../mapDrawing'

type Tool = 'select' | 'pin' | 'region' | 'fog-rect' | 'fog-shape' | 'fog-circle'
const COLORS = ['#e0b354', '#d9534f', '#5bc0de', '#5cb85c', '#a678de', '#f0f0f0']

export default function MapView() {
  const { worldId } = useWorld()
  const { mapId = '' } = useParams()
  const { canSee, isGM } = useViewMode()
  const map = useLiveQuery(async () => (await db.maps.get(mapId)) ?? null, [mapId])
  // previewing as a player shows their copy of a map with secrets on it
  const url = useAssetUrl(map ? (isGM ? map.imageId : playersImageId(map)) : undefined)

  if (map === undefined) return null
  if (map === null || map.worldId !== worldId || !canSee(map.visibility)) return <Empty>Map not found.</Empty>
  if (!url) return <div className="loading">Loading map…</div>
  return <MapEditor key={map.id} map={map} url={url} />
}

function MapEditor({ map, url }: { map: WorldMap; url: string }) {
  const { worldId } = useWorld()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const entities = useVisibleEntities(worldId)
  const fog = map.fog?.on ? map.fog : undefined
  // Players never see pins under the fog (the server holds them back too).
  const pins =
    useLiveQuery(
      () => db.pins.where({ mapId: map.id }).filter((p) => canSee(p.visibility) && (isGM || pinRevealed(fog, p))).toArray(),
      [map.id, isGM, fog],
    ) ?? []
  const allMaps = useLiveQuery(() => db.maps.where({ worldId }).filter((m) => canSee(m.visibility)).sortBy('name'), [worldId, isGM]) ?? []
  const [tool, setTool] = useState<Tool>('select')
  const [draft, setDraft] = useState<[number, number][]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [fogBar, setFogBar] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportDrawing = useMemo(() => (map.drawing ? toClassic(map.drawing) : undefined), [map.drawing])
  const [fogMode, setFogMode] = useState<'reveal' | 'hide'>('reveal')
  const [fogCorner, setFogCorner] = useState<[number, number]>()
  const [fogSize, setFogSize] = useState(0.06)
  const selectedId = params.get('pin')
  const selected = pins.find((p) => p.id === selectedId)
  const select = (id?: string) => setParams(id ? { pin: id } : {}, { replace: true })
  const bounds = useMemo(() => L.latLngBounds([0, 0], [map.height, map.width]), [map.height, map.width])
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities])

  useEffect(() => {
    if (!isGM) setTool('select')
  }, [isGM])

  // Keep the players' fogged picture up to date, a moment after the GM stops changing the fog.
  // Leaving the map (or switching to the player view) before then still updates it.
  const fogShapes = fog?.shapes
  const fogPending = useRef<string>(undefined)
  const flushFog = () => {
    const id = fogPending.current
    fogPending.current = undefined
    if (id) renderPlayerFog(id).catch(() => {})
  }
  useEffect(() => {
    if (!isGM || !fog) return flushFog()
    fogPending.current = map.id
    const t = setTimeout(flushFog, 1500)
    return () => clearTimeout(t)
  }, [isGM, fog, fogShapes, map.id, map.imageId, map.playerImageId])
  useEffect(() => () => flushFog(), [])

  const addFog = (shape: ReturnType<typeof rectShape>) =>
    db.maps
      .where('id')
      .equals(map.id)
      .modify((m) => {
        m.fog = { on: true, ...m.fog, shapes: [...(m.fog?.shapes ?? []), shape] }
      })
  const fogClick = (pos: [number, number]) => {
    if (tool === 'fog-circle') addFog(circleShape(pos, Math.max(map.width, map.height) * fogSize, fogMode))
    else if (tool === 'fog-rect') {
      if (!fogCorner) return setFogCorner(pos)
      addFog(rectShape(fogCorner, pos, fogMode))
      setFogCorner(undefined)
    } else if (tool === 'fog-shape') setDraft((d) => [...d, pos])
  }
  const finishFogShape = async () => {
    if (draft.length < 3) return
    await addFog({ ...rectShape([0, 0], [0, 0], fogMode), points: draft })
    setDraft([])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft([])
        setFogCorner(undefined)
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const addPin = async (pos: [number, number]) => {
    const id = newId()
    await db.pins.add({ id, worldId, mapId: map.id, label: 'New pin', kind: 'point', position: pos, color: COLORS[0], visibility: 'gm', note: '' })
    setTool('select')
    select(id)
  }
  const finishRegion = async () => {
    if (draft.length < 3) return
    const id = newId()
    await db.pins.add({ id, worldId, mapId: map.id, label: 'New region', kind: 'region', points: draft, color: COLORS[2], visibility: 'gm', note: '' })
    setDraft([])
    setTool('select')
    select(id)
  }

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <Link to={`${worldPath(worldId)}/maps`}>← Maps</Link>
        <strong>{map.name}</strong> <VisibilityBadge value={map.visibility} /> <Help topic="mapView" />
        {isGM && (
          <div className="row">
            <div className="segmented">
              <button className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')} title="Select and move">
                <Ico as={HandPalm} /> Select
              </button>
              <button className={tool === 'pin' ? 'on' : ''} onClick={() => setTool('pin')} title="Click the map to drop a pin">
                <Ico as={MapPin} /> Pin
              </button>
              <button
                className={tool === 'region' ? 'on' : ''}
                onClick={() => {
                  setDraft([])
                  setTool('region')
                }}
                title="Click points to outline an area"
              >
                ⬠ Region
              </button>
            </div>
            {tool === 'region' && (
              <>
                <span className="muted">{draft.length} points</span>
                <button className="primary" disabled={draft.length < 3} onClick={finishRegion}>
                  Finish region
                </button>
                <button onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>
                  Undo point
                </button>
              </>
            )}
            {map.drawing && (
              <>
                <Link className="button" to={`${worldPath(worldId)}/maps/${map.id}/draw`}>
                  <Ico as={PencilSimple} /> Draw
                </Link>
                <button onClick={() => setExporting(true)} title="Download as a picture or a virtual tabletop file">
                  <Ico as={DownloadSimple} /> Export
                </button>
              </>
            )}
            <button
              className={fogBar ? 'on' : ''}
              onClick={() => {
                setFogBar((f) => !f)
                setTool('select')
                setDraft([])
              }}
            >
              <Ico as={CloudFog} /> Fog{fog ? ' (on)' : ''}
            </button>
            <button onClick={() => setShowSettings((s) => !s)}><Ico as={SlidersHorizontal} /> Map settings</button>
          </div>
        )}
      </div>
      {isGM && exporting && exportDrawing && (
        <ExportMap name={map.name} drawing={exportDrawing} width={map.width} height={map.height} onClose={() => setExporting(false)} />
      )}
      {isGM && fogBar && (
        <FogBar
          map={map}
          tool={tool}
          setTool={(t) => {
            setTool(t)
            setDraft([])
            setFogCorner(undefined)
          }}
          mode={fogMode}
          setMode={setFogMode}
          size={fogSize}
          setSize={setFogSize}
          corner={!!fogCorner}
          draft={draft.length}
          onFinish={finishFogShape}
          onUndoPoint={() => setDraft((d) => d.slice(0, -1))}
        />
      )}
      <div className="map-body">
        <MapContainer
          className={`leaflet-map tool-${tool}`}
          crs={L.CRS.Simple}
          bounds={bounds}
          maxBounds={bounds.pad(0.5)}
          minZoom={-5}
          maxZoom={4}
          zoomSnap={0.25}
          attributionControl={false}
        >
          <ImageOverlay url={url} bounds={bounds} />
          {fog && <FogLayer map={map} bounds={bounds} opacity={isGM ? 0.6 : 1} />}
          <ClickHandler
            onClick={(pos) => {
              if (tool.startsWith('fog')) fogClick(pos)
              else if (tool === 'pin') addPin(pos)
              else if (tool === 'region') setDraft((d) => [...d, pos])
              else select()
            }}
          />
          <FocusPin pin={selected} />
          <ResizeWatcher panelOpen={!!selected || showSettings} />
          {pins.map((p) => {
            const entity = p.entityId ? byId.get(p.entityId) : undefined
            const label = `${statusIcon(entity)} ${p.label || entity?.name || 'Pin'}`.trim()
            const handlers = {
              click: (ev: L.LeafletMouseEvent) => {
                if (tool !== 'select') return
                L.DomEvent.stopPropagation(ev)
                select(p.id)
              },
            }
            // a linked piece on a drawn map: the piece itself is what you click, so only its outline shows,
            // faintly for the GM and on hover for players
            if (p.pieceId && p.points)
              return (
                <Polygon
                  key={`${p.id}-${p.id === selectedId}-${p.visibility}`}
                  positions={p.points}
                  pathOptions={{
                    className: `piece-pin${p.id === selectedId ? ' on' : ''}${isGM ? ' for-gm' : ''}`,
                    color: '#ffd36b',
                    weight: 2,
                    fillColor: '#ffd36b',
                    dashArray: p.visibility === 'gm' ? '6 4' : undefined,
                  }}
                  eventHandlers={handlers}
                >
                  <Tooltip sticky>{label}</Tooltip>
                </Polygon>
              )
            if (p.kind === 'region' && p.points)
              return (
                <Polygon
                  key={p.id}
                  positions={p.points}
                  pathOptions={{
                    color: p.color,
                    weight: p.id === selectedId ? 3 : 1.5,
                    fillOpacity: p.id === selectedId ? 0.35 : 0.15,
                    dashArray: p.visibility === 'gm' ? '6 4' : undefined,
                  }}
                  eventHandlers={handlers}
                >
                  <Tooltip sticky>{label}</Tooltip>
                </Polygon>
              )
            if (!p.position) return null
            return (
              <Marker
                key={p.id}
                position={p.position}
                icon={pinIcon(p, entity, p.id === selectedId)}
                draggable={isGM && tool === 'select'}
                eventHandlers={{
                  ...handlers,
                  dragend: (ev) => {
                    const ll = (ev.target as L.Marker).getLatLng()
                    db.pins.update(p.id, { position: [ll.lat, ll.lng] })
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  {label}
                </Tooltip>
              </Marker>
            )
          })}
          {draft.length > 0 && <Polyline positions={draft} pathOptions={{ color: '#fff', dashArray: '4 4' }} />}
          {fogCorner && <Marker position={fogCorner} icon={cornerIcon} interactive={false} />}
        </MapContainer>
        {(selected || showSettings) && (
          <aside className="map-panel">
            {showSettings && isGM ? (
              <MapSettings map={map} entities={entities} onClose={() => setShowSettings(false)} onDeleted={() => navigate(`${worldPath(worldId)}/maps`)} />
            ) : selected ? (
              isGM ? (
                <PinEditor key={selected.id} pin={selected} entities={entities} maps={allMaps.filter((m) => m.id !== map.id)} onClose={() => select()} />
              ) : (
                <PinDetails pin={selected} entity={selected.entityId ? byId.get(selected.entityId) : undefined} entities={entities} maps={allMaps.filter((m) => m.id !== map.id)} onClose={() => select()} />
              )
            ) : null}
          </aside>
        )}
      </div>
    </div>
  )
}

const cornerIcon = L.divIcon({ className: '', html: '<div class="fog-corner"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })

/** The fog as the GM sees it (see-through) or as players do (solid), drawn over the map. */
function FogLayer({ map, bounds, opacity }: { map: WorldMap; bounds: L.LatLngBounds; opacity: number }) {
  const [url, setUrl] = useState<string>()
  const shapes = map.fog?.shapes
  useEffect(() => {
    let gone = false
    let made: string | undefined
    fogOverlay(map, shapes ?? []).then((blob) => {
      if (gone) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      gone = true
      // The old picture stays up until the new one is ready, then goes.
      if (made) setTimeout(() => URL.revokeObjectURL(made!), 2000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, map.width, map.height])
  if (!url) return null
  return <ImageOverlay url={url} bounds={bounds} opacity={opacity} className="fog-layer" />
}

/** The GM's fog tools: uncover or cover a box, a circle or a shape, and the big switches. */
function FogBar({
  map,
  tool,
  setTool,
  mode,
  setMode,
  size,
  setSize,
  corner,
  draft,
  onFinish,
  onUndoPoint,
}: {
  map: WorldMap
  tool: Tool
  setTool: (t: Tool) => void
  mode: 'reveal' | 'hide'
  setMode: (m: 'reveal' | 'hide') => void
  size: number
  setSize: (n: number) => void
  corner: boolean
  draft: number
  onFinish: () => void
  onUndoPoint: () => void
}) {
  const fog = map.fog
  const setFog = (patch: Partial<NonNullable<WorldMap['fog']>>) =>
    db.maps
      .where('id')
      .equals(map.id)
      .modify((m) => {
        m.fog = { on: true, shapes: [], ...m.fog, ...patch }
      })
  const all = { id: 'all', mode: 'reveal' as const, points: [[0, 0], [0, map.width], [map.height, map.width], [map.height, 0]] as [number, number][] }
  return (
    <div className="map-toolbar fog-bar">
      <strong>
        <Ico as={CloudFog} /> Fog of war <Help topic="fog" />
      </strong>
      <label className="inline-check small">
        <input type="checkbox" checked={!!fog?.on} onChange={(e) => setFog({ on: e.target.checked })} />
        Players see only what you uncover
      </label>
      {fog?.on && (
        <>
          <div className="segmented">
            <button className={mode === 'reveal' ? 'on' : ''} onClick={() => setMode('reveal')}>
              ☀️ Uncover
            </button>
            <button className={mode === 'hide' ? 'on' : ''} onClick={() => setMode('hide')}>
              <Ico as={CloudFog} /> Cover
            </button>
          </div>
          <div className="segmented">
            <button className={tool === 'fog-circle' ? 'on' : ''} onClick={() => setTool(tool === 'fog-circle' ? 'select' : 'fog-circle')} title="Click the map">
              ⬤ Circle
            </button>
            <button className={tool === 'fog-rect' ? 'on' : ''} onClick={() => setTool(tool === 'fog-rect' ? 'select' : 'fog-rect')} title="Click two corners">
              ▭ Box
            </button>
            <button className={tool === 'fog-shape' ? 'on' : ''} onClick={() => setTool(tool === 'fog-shape' ? 'select' : 'fog-shape')} title="Click points round the area">
              ⬠ Shape
            </button>
          </div>
          {tool === 'fog-circle' && (
            <label className="row small">
              Size
              <input type="range" min={0.01} max={0.25} step={0.01} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </label>
          )}
          {tool === 'fog-rect' && <span className="muted small">{corner ? 'Now click the opposite corner' : 'Click one corner'}</span>}
          {tool === 'fog-shape' && (
            <>
              <span className="muted small">{draft} points</span>
              <button className="primary" disabled={draft < 3} onClick={onFinish}>
                Finish
              </button>
              <button disabled={!draft} onClick={onUndoPoint}>
                Undo point
              </button>
            </>
          )}
          <button disabled={!fog.shapes.length} onClick={() => setFog({ shapes: fog.shapes.slice(0, -1) })}>
            ↶ Undo
          </button>
          <button onClick={() => setFog({ shapes: [...fog.shapes, { ...all, id: newId() }] })}>Uncover all</button>
          <button onClick={() => confirm('Cover the whole map again?') && setFog({ shapes: [] })}>Cover all</button>
          <button
            className="ghost small"
            onClick={async () => {
              if (!confirm('Remove the fog from this map completely? Everything you uncovered is forgotten.')) return
              setTool('select')
              await removeFog(map)
            }}
          >
            Remove fog
          </button>
          <span className="muted small">{fog.imageId && fog.renderedFrom ? '' : 'Preparing the players’ picture…'}</span>
        </>
      )}
    </div>
  )
}

function pinIcon(p: Pin, entity: Entity | undefined, active: boolean) {
  const glyph = entity ? ENTITY_LABELS[entity.type].icon : p.childMapId ? '🗺️' : '📍'
  // The colour goes into HTML, so only a plain colour code is used (a synced or imported pin could hold anything).
  const c = /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : COLORS[0]
  return L.divIcon({
    className: '',
    html: `<div class="map-pin${active ? ' active' : ''}${p.visibility === 'gm' ? ' hidden-pin' : ''}" style="--c:${c}"><span>${glyph}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 36],
  })
}

function ClickHandler({ onClick }: { onClick: (pos: [number, number]) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) })
  return null
}

/** The side panel changes the map's size; Leaflet needs telling or clicks land in the wrong place. */
function ResizeWatcher({ panelOpen }: { panelOpen: boolean }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
  }, [panelOpen, map])
  return null
}

function FocusPin({ pin }: { pin?: Pin }) {
  const map = useMap()
  const id = pin?.id
  useEffect(() => {
    if (!pin) return
    if (pin.position) map.panTo(pin.position, { animate: true })
    else if (pin.points?.length) map.fitBounds(L.latLngBounds(pin.points), { maxZoom: map.getZoom(), animate: true })
    // Only re-focus when a different pin is selected, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, map])
  return null
}

/** What a player (or the GM) sees when clicking a pin: the place, what's there, and a way in. */
function PinDetails({
  pin,
  entity,
  entities,
  maps,
  onClose,
}: {
  pin: Pin
  entity?: Entity
  entities: Entity[]
  maps: WorldMap[]
  onClose: () => void
}) {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const inside = entity ? entities.filter((e) => e.parentId === entity.id) : []
  const childMap = maps.find((m) => m.id === pin.childMapId) ?? (entity ? maps.find((m) => m.locationId === entity.id) : undefined)
  const groups = ENTITY_TYPES.map((t) => [t, inside.filter((x) => x.type === t)] as const).filter(([, xs]) => xs.length)
  return (
    <div className="pin-details">
      <header>
        <h2>{pin.label || entity?.name}</h2>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {entity?.status && <StatusBadge entity={entity} />}
      {entity?.summary && <p className="lead">{entity.summary}</p>}
      {pin.note && <Markdown text={pin.note} entities={entities} worldId={worldId} showSecrets={isGM} />}
      <div className="row wrap">
        {entity && (
          <Link className="button" to={`${pagePath(worldId, entity.id)}`}>
            Open page
          </Link>
        )}
        {childMap && (
          <Link className="button primary" to={`${worldPath(worldId)}/maps/${childMap.id}`}>
            Enter {childMap.name} →
          </Link>
        )}
      </div>
      {groups.map(([t, xs]) => (
        <section key={t}>
          <h3>
            <TypeIcon type={t} /> {ENTITY_LABELS[t].many}
          </h3>
          <ul className="entity-list">
            {xs.map((x) => (
              <li key={x.id}>
                <Link to={`${pagePath(worldId, x.id)}`}>{x.name}</Link> <VisibilityBadge value={x.visibility} />
                {x.summary && <div className="muted small">{x.summary}</div>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PinEditor({ pin, entities, maps, onClose }: { pin: Pin; entities: Entity[]; maps: WorldMap[]; onClose: () => void }) {
  const { worldId } = useWorld()
  const [preview, setPreview] = useState(false)
  const update = (patch: Partial<Pin>) => db.pins.update(pin.id, patch)
  const entity = entities.find((e) => e.id === pin.entityId)
  const [newType, setNewType] = useState<EntityType>('location')

  if (preview)
    return (
      <>
        <button className="block" onClick={() => setPreview(false)}>
          <Ico as={PencilSimple} /> Back to editing
        </button>
        <PinDetails pin={pin} entity={entity} entities={entities} maps={maps} onClose={onClose} />
      </>
    )

  return (
    <div className="form pin-editor">
      <header>
        <h2>Edit {pin.pieceId ? 'linked piece' : pin.kind === 'region' ? 'region' : 'pin'}</h2>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <label>
        Label
        <DraftText value={pin.label} onCommit={(label) => update({ label })} />
      </label>
      {pin.pieceId && <p className="muted small">A piece drawn on this map. Move, turn or remove it in the map builder.</p>}
      <div className="row">
        <VisibilityToggle value={pin.visibility} onChange={(v) => update({ visibility: v })} />
        <div className="swatches" hidden={!!pin.pieceId}>
          {COLORS.map((c) => (
            <button key={c} className={`swatch ${c === pin.color ? 'on' : ''}`} style={{ background: c }} onClick={() => update({ color: c })} aria-label={`Colour ${c}`} />
          ))}
        </div>
      </div>
      <label>
        Linked page
        <select value={pin.entityId ?? ''} onChange={(e) => update({ entityId: e.target.value || undefined })}>
          <option value="">(none)</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {ENTITY_LABELS[e.type].icon} {e.name}
            </option>
          ))}
        </select>
      </label>
      {!pin.entityId && (
        <div className="row">
          <select value={newType} onChange={(e) => setNewType(e.target.value as EntityType)}>
            {PICKER_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABELS[t].one}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              const e = blankEntity(worldId, newType, pin.label && !pin.label.startsWith('New ') ? pin.label : `New ${ENTITY_LABELS[newType].one}`)
              e.visibility = pin.visibility
              await db.entities.add(e)
              await update({ entityId: e.id, label: e.name })
            }}
          >
            + Create page
          </button>
        </div>
      )}
      {entity && (
        <Link className="small" to={`${pagePath(worldId, entity.id)}?edit=1`}>
          Edit "{entity.name}" page →
        </Link>
      )}
      <label>
        Opens map
        <select value={pin.childMapId ?? ''} onChange={(e) => update({ childMapId: e.target.value || undefined })}>
          <option value="">(none)</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note
        <SecretTextarea worldId={pin.worldId} rows={4} value={pin.note} onChange={(v) => update({ note: v })} placeholder="Shown when the pin is clicked. Markdown and [[links]] work." />
      </label>
      <SecretNamesWarning worldId={pin.worldId} texts={[pin.note]} show={pin.visibility === 'players'} />
      <div className="row spread">
        <button
          className="danger"
          onClick={async () => {
            if (!confirm('Delete this pin?')) return
            await db.pins.delete(pin.id)
            onClose()
          }}
        >
          Delete
        </button>
        <button onClick={() => setPreview(true)}><Ico as={Eye} /> Preview</button>
      </div>
    </div>
  )
}

function MapSettings({ map, entities, onClose, onDeleted }: { map: WorldMap; entities: Entity[]; onClose: () => void; onDeleted: () => void }) {
  const update = (patch: Partial<WorldMap>) => db.maps.update(map.id, patch)
  return (
    <div className="form">
      <header>
        <h2>Map settings</h2>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <label>
        Name
        <DraftText value={map.name} onCommit={(name) => update({ name })} />
      </label>
      <VisibilityToggle value={map.visibility} onChange={(v) => update({ visibility: v })} />
      <label>
        This map shows
        <select value={map.locationId ?? ''} onChange={(e) => update({ locationId: e.target.value || undefined })}>
          <option value="">(no location)</option>
          {entities
            .filter((e) => e.type === 'location')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        <small className="muted">Pins linked to that location will offer "Enter map".</small>
      </label>
      <button
        className="danger"
        onClick={async () => {
          if (!confirm(`Delete map "${map.name}" and all its pins?`)) return
          await binMap(map.id)
          onDeleted()
        }}
      >
        Delete map
      </button>
    </div>
  )
}
