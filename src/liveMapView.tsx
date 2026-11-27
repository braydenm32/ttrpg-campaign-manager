import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { ImageOverlay, MapContainer, Marker, Polygon, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import type { LivePin, MapPatch } from './cloud/liveMap'

/**
 * A shown map, drawn: the players' picture, the pieces heard live laid over it where they belong,
 * and the pins players may see. `big` (a TV) keeps the whole map in view and can't be moved;
 * otherwise it drags and zooms like any map. Only what it's handed is drawn (see LiveMap).
 */
export default function LiveMapView({
  url,
  size,
  patches,
  pins,
  big,
  title,
}: {
  /** The players' picture, once it's on this device. */
  url?: string
  /** The map's height and width, in the units pins are placed in. */
  size: [number, number]
  patches: MapPatch[]
  pins: LivePin[]
  big?: boolean
  title: string
}) {
  const [h, w] = size
  const bounds = useMemo(() => L.latLngBounds([0, 0], [h, w]), [h, w])
  return (
    <MapContainer
      className={`leaflet-map live-map ${big ? 'big' : ''}`}
      // On a phone the box takes the map's own shape (as tall as the screen allows), so none of it is wasted.
      style={big ? undefined : { aspectRatio: `${w} / ${h}` }}
      crs={L.CRS.Simple}
      bounds={bounds}
      maxBounds={bounds.pad(0.25)}
      minZoom={-6}
      maxZoom={4}
      zoomSnap={big ? 0 : 0.25}
      zoomDelta={0.5}
      attributionControl={false}
      zoomControl={false}
      dragging={!big}
      touchZoom={!big}
      doubleClickZoom={!big}
      boxZoom={false}
      keyboard={!big}
      // The page behind scrolls with the wheel; the map zooms with its buttons, a pinch or a double tap.
      scrollWheelZoom={false}
    >
      <Fit bounds={bounds} always={!!big} />
      {/* Out of the way of names near the map's top left, and under a thumb. */}
      {!big && <ZoomControl position="bottomright" />}
      <RoomForNames pins={pins} />
      {url && <ImageOverlay url={url} bounds={bounds} alt={title} className="live-picture" />}
      {patches.map((p) => (
        <ImageOverlay
          key={p.v}
          url={p.url}
          className="live-patch"
          bounds={[
            [(1 - p.box[3]) * h, p.box[0] * w],
            [(1 - p.box[1]) * h, p.box[2] * w],
          ]}
        />
      ))}
      {pins.map((p) => {
        const label = p.label || 'Pin'
        if (p.points && (p.kind === 'region' || p.piece))
          return (
            <Polygon
              key={p.id}
              positions={p.points}
              interactive={false}
              pathOptions={p.piece ? { color: '#ffd36b', weight: 1.5, opacity: 0.5, fillOpacity: 0 } : { color: colourOf(p.color), weight: 1.5, fillOpacity: 0.15 }}
            >
              <Tooltip permanent direction="center" className={p.number ? 'pin-number' : 'pin-name'} interactive={false}>
                {p.number ? Math.round(p.number) : label}
              </Tooltip>
            </Polygon>
          )
        if (!p.position) return null
        return (
          <Marker key={p.id} position={p.position} icon={pinIcon(p)} title={label} alt={label} keyboard={false} interactive={false}>
            <Tooltip direction="top" offset={[0, -34]} permanent className="pin-name">
              {label}
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

const COLOUR = /^#[0-9a-f]{3,8}$/i
/** Only a plain colour code is used (it goes into the page as it is, and came over the wire). */
const colourOf = (c: string) => (COLOUR.test(c) ? c : '#e0b354')

/** A pin as MapView draws it: its number when the map has a key, else a dot. */
function pinIcon(p: LivePin) {
  const glyph = p.number ? `<b class="pin-no">${Math.round(p.number)}</b>` : '📍'
  return L.divIcon({ className: '', html: `<div class="map-pin" style="--c:${colourOf(p.color)}"><span>${glyph}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 36] })
}

/**
 * Names that would sit on top of one another are left out until there's room (zooming in on a
 * phone brings them back): on a whole map seen small, a heap of labels hides the map itself.
 */
function RoomForNames({ pins }: { pins: LivePin[] }) {
  const map = useMap()
  useEffect(() => {
    let frame = 0
    const tidy = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const names = [...map.getContainer().querySelectorAll<HTMLElement>('.leaflet-tooltip')]
        names.forEach((el) => el.classList.remove('crowded'))
        const kept: DOMRect[] = []
        for (const el of names) {
          const r = el.getBoundingClientRect()
          const hit = kept.some((k) => r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top)
          if (hit) el.classList.add('crowded')
          else kept.push(r)
        }
      })
    }
    tidy()
    // Once the map has settled into its box (see Fit).
    const soon = setTimeout(tidy, 400)
    map.on('zoomend moveend resize', tidy)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(soon)
      map.off('zoomend moveend resize', tidy)
    }
  }, [map, pins])
  return null
}

/** Brings the whole map into view when it opens; on a TV, again whenever the window changes size. */
function Fit({ bounds, always }: { bounds: L.LatLngBounds; always: boolean }) {
  const map = useMap()
  useEffect(() => {
    const fit = () => {
      map.invalidateSize()
      map.fitBounds(bounds, { animate: false, padding: [0, 0] })
    }
    fit()
    // The box it sits in may still be settling (a pop-up opening, a TV window being dragged out).
    const soon = setTimeout(fit, 250)
    if (!always) return () => clearTimeout(soon)
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : undefined
    watch?.observe(map.getContainer())
    return () => {
      clearTimeout(soon)
      watch?.disconnect()
    }
  }, [map, bounds, always])
  return null
}
