import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { ImageOverlay, MapContainer, Marker, Polygon, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty, VisibilityBadge, VisibilityToggle } from '../components'
import { blankEntity, db, deleteMap, ENTITY_LABELS, ENTITY_TYPES, newId, type Entity, type EntityType, type Pin, type WorldMap } from '../db'
import { useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { Markdown } from '../Markdown'
import { SecretTextarea } from '../SecretTextarea'
import { useViewMode } from '../viewMode'

type Tool = 'select' | 'pin' | 'region'
const COLORS = ['#e0b354', '#d9534f', '#5bc0de', '#5cb85c', '#a678de', '#f0f0f0']

export default function MapView() {
  const { worldId } = useWorld()
  const { mapId = '' } = useParams()
  const { canSee } = useViewMode()
  const map = useLiveQuery(() => db.maps.get(mapId), [mapId])
  const url = useAssetUrl(map?.imageId)

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
  const pins = useLiveQuery(() => db.pins.where({ mapId: map.id }).filter((p) => canSee(p.visibility)).toArray(), [map.id, isGM]) ?? []
  const allMaps = useLiveQuery(() => db.maps.where({ worldId }).filter((m) => canSee(m.visibility)).sortBy('name'), [worldId, isGM]) ?? []
  const [tool, setTool] = useState<Tool>('select')
  const [draft, setDraft] = useState<[number, number][]>([])
  const [showSettings, setShowSettings] = useState(false)
  const selectedId = params.get('pin')
  const selected = pins.find((p) => p.id === selectedId)
  const select = (id?: string) => setParams(id ? { pin: id } : {}, { replace: true })
  const bounds = useMemo(() => L.latLngBounds([0, 0], [map.height, map.width]), [map.height, map.width])
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities])

  useEffect(() => {
    if (!isGM) setTool('select')
  }, [isGM])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft([])
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
        <Link to={`/w/${worldId}/maps`}>← Maps</Link>
        <strong>{map.name}</strong> <VisibilityBadge value={map.visibility} /> <Help topic="mapView" />
        {isGM && (
          <div className="row">
            <div className="segmented">
              <button className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')} title="Select and move">
                🖐 Select
              </button>
              <button className={tool === 'pin' ? 'on' : ''} onClick={() => setTool('pin')} title="Click the map to drop a pin">
                📍 Pin
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
              <Link className="button" to={`/w/${worldId}/maps/${map.id}/draw`}>
                ✏️ Draw
              </Link>
            )}
            <button onClick={() => setShowSettings((s) => !s)}>⚙️ Map settings</button>
          </div>
        )}
      </div>
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
          <ClickHandler
            onClick={(pos) => {
              if (tool === 'pin') addPin(pos)
              else if (tool === 'region') setDraft((d) => [...d, pos])
              else select()
            }}
          />
          <FocusPin pin={selected} />
          <ResizeWatcher panelOpen={!!selected || showSettings} />
          {pins.map((p) => {
            const entity = p.entityId ? byId.get(p.entityId) : undefined
            const label = p.label || entity?.name || 'Pin'
            const handlers = {
              click: (ev: L.LeafletMouseEvent) => {
                if (tool !== 'select') return
                L.DomEvent.stopPropagation(ev)
                select(p.id)
              },
            }
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
        </MapContainer>
        {(selected || showSettings) && (
          <aside className="map-panel">
            {showSettings && isGM ? (
              <MapSettings map={map} entities={entities} onClose={() => setShowSettings(false)} onDeleted={() => navigate(`/w/${worldId}/maps`)} />
            ) : selected ? (
              isGM ? (
                <PinEditor key={selected.id} pin={selected} entities={entities} maps={allMaps.filter((m) => m.id !== map.id)} onClose={() => select()} />
              ) : (
                <PinDetails pin={selected} entity={selected.entityId ? byId.get(selected.entityId) : undefined} entities={entities} maps={allMaps} onClose={() => select()} />
              )
            ) : null}
          </aside>
        )}
      </div>
    </div>
  )
}

function pinIcon(p: Pin, entity: Entity | undefined, active: boolean) {
  const glyph = entity ? ENTITY_LABELS[entity.type].icon : p.childMapId ? '🗺️' : '📍'
  return L.divIcon({
    className: '',
    html: `<div class="map-pin${active ? ' active' : ''}${p.visibility === 'gm' ? ' hidden-pin' : ''}" style="--c:${p.color}"><span>${glyph}</span></div>`,
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
      {entity?.summary && <p className="lead">{entity.summary}</p>}
      {pin.note && <Markdown text={pin.note} entities={entities} worldId={worldId} showSecrets={isGM} />}
      <div className="row wrap">
        {entity && (
          <Link className="button" to={`/w/${worldId}/e/${entity.id}`}>
            Open page
          </Link>
        )}
        {childMap && (
          <Link className="button primary" to={`/w/${worldId}/maps/${childMap.id}`}>
            Enter {childMap.name} →
          </Link>
        )}
      </div>
      {groups.map(([t, xs]) => (
        <section key={t}>
          <h3>
            {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].many}
          </h3>
          <ul className="entity-list">
            {xs.map((x) => (
              <li key={x.id}>
                <Link to={`/w/${worldId}/e/${x.id}`}>{x.name}</Link> <VisibilityBadge value={x.visibility} />
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
          ✏️ Back to editing
        </button>
        <PinDetails pin={pin} entity={entity} entities={entities} maps={maps} onClose={onClose} />
      </>
    )

  return (
    <div className="form pin-editor">
      <header>
        <h2>Edit {pin.kind === 'region' ? 'region' : 'pin'}</h2>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <label>
        Label
        <input value={pin.label} onChange={(e) => update({ label: e.target.value })} />
      </label>
      <div className="row">
        <VisibilityToggle value={pin.visibility} onChange={(v) => update({ visibility: v })} />
        <div className="swatches">
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
            {ENTITY_TYPES.map((t) => (
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
        <Link className="small" to={`/w/${worldId}/e/${entity.id}?edit=1`}>
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
        <button onClick={() => setPreview(true)}>👁 Preview</button>
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
        <input value={map.name} onChange={(e) => update({ name: e.target.value })} />
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
          await deleteMap(map.id)
          onDeleted()
        }}
      >
        Delete map
      </button>
    </div>
  )
}
