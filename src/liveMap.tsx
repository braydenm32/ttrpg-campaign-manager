import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { askForMap, hostLiveMap, onTableJoined, onWorldChanged, PATCH_MAX_CHARS, pinsForPlayers, usablePatches, useLiveMap, type MapMessage, type MapPatch } from './cloud/liveMap'
import { refreshJoinedWorldNow } from './cloud/share'
import { schedule } from './cloud/sync'
import { gmIdOf } from './cloud/table'
import { db, type Asset, type FogShape, type Showing, type World, type WorldMap } from './db'
import { fogChangedElsewhere, fogHereSince, fogKey, mapPictureIds, onFogHostChange, onPlayerFogRendered, playersCopyId, renderPlayerFog, type FogRendered } from './fog'
import { worldPath } from './paths'
import './liveMap.css'

/** The map itself (Leaflet), only loaded when a map is on screen. */
const LiveMapView = lazy(() => import('./liveMapView'))

/**
 * A map shown to players ("Show players" on a map): what players' screens draw, and the GM's side
 * that keeps it live. Players only ever get the players' copy of the picture (the fog painted on,
 * GM-only pieces left out) and the pins they may see; how it travels is in src/cloud/liveMap.ts.
 */

/** Whether something shown is a live map (from a map's own "Show players"). */
export const isLiveMap = (showing: Showing | null | undefined) => !!showing && showing.kind === 'image' && (!!showing.mapId || !!showing.live)

/**
 * The map a shown picture is of, on this device: by its id when players can see the map, else (a
 * map that is GM only, whose id players aren't sent) the map that picture belongs to. Null when this
 * device has no such map (a player's, for a map they can't see); undefined while it's being looked up.
 */
export function useShownMap(worldId: string, showing: Showing | null | undefined): WorldMap | null | undefined {
  const live = isLiveMap(showing)
  const mapId = live ? showing!.mapId : undefined
  const assetId = live ? showing!.assetId : undefined
  const key = `${mapId ?? ''}|${assetId ?? ''}`
  const found = useLiveQuery(async () => {
    let map: WorldMap | undefined
    if (mapId) map = await db.maps.get(mapId)
    else if (assetId) map = (await db.maps.where({ worldId }).toArray()).find((m) => mapPictureIds(m).includes(assetId))
    return { key, map: map ?? null }
  }, [worldId, key])
  // (A query answers with what it found last time until it has looked again: nothing of the map shown before is used.)
  if (!live) return null
  return found && found.key === key ? found.map : undefined
}

/** Whether this device keeps that map live (see fogChangedHere in src/fog.ts). */
function useHostHere(mapId: string | undefined) {
  return useSyncExternalStore(onFogHostChange, () => (mapId ? (fogHereSince(mapId) ?? 0) : 0))
}

/** A fog change seen this long after this device last touched it came from another device. */
const ELSEWHERE_AFTER = 5000

/** A picture's version: when its file last changed (how a player's app and the GM's tell which copy each has). */
const versionOf = (a: Pick<Asset, 'createdAt' | 'updatedAt'> | undefined) => a?.updatedAt ?? a?.createdAt ?? 0

// ---------- the GM's side ----------

/** How soon after the fog changes the players' copy of a shown map is remade (elsewhere it waits for the GM to pause). */
const LIVE_FOG_DELAY = 250
/** The longest side of a piece, in pixels: a bigger area is sent smaller (and so a little soft) until the synced copy arrives. */
const PIECE_MAX = 1400
/** The whole picture is sent at most this often, however many players ask. */
const WHOLE_EVERY = 2000

/** Cuts a box (in pixels) out of the players' copy as a JPEG small enough to send, scaled down if it has to be. */
function cutPiece(source: CanvasImageSource, width: number, height: number, px: [number, number, number, number]): Pick<MapMessage, 'box' | 'img' | 'soft'> | undefined {
  const [x0, y0, x1, y1] = px
  const w = x1 - x0
  const h = y1 - y0
  if (w < 1 || h < 1) return undefined
  let scale = Math.min(1, PIECE_MAX / Math.max(w, h))
  for (let tries = 0; tries < 8; tries++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    canvas.getContext('2d')!.drawImage(source, x0, y0, w, h, 0, 0, canvas.width, canvas.height)
    const img = canvas.toDataURL('image/jpeg', 0.8)
    if (img.length <= PATCH_MAX_CHARS)
      return { box: [x0 / width, y0 / height, x1 / width, y1 / height], img, soft: scale < 0.999 || undefined }
    scale *= 0.7
  }
  return undefined
}

/** The part of the picture that differs between two lists of fog shapes, in canvas pixels: the box round every shape added or taken away. */
function changedBox(before: FogShape[], after: FogShape[], r: Pick<FogRendered, 'canvas' | 'scale'>): [number, number, number, number] | undefined {
  const was = new Set(before.map((s) => s.id))
  const now = new Set(after.map((s) => s.id))
  const changed = [...after.filter((s) => !was.has(s.id)), ...before.filter((s) => !now.has(s.id))]
  if (!changed.length) return undefined
  const { width, height } = r.canvas
  let x0 = width
  let y0 = height
  let x1 = 0
  let y1 = 0
  for (const s of changed)
    for (const [y, x] of s.points) {
      // Map coordinates count up from the bottom; the picture counts down from the top (as in paintFog).
      const px = x * r.scale
      const py = height - y * r.scale
      x0 = Math.min(x0, px)
      x1 = Math.max(x1, px)
      y0 = Math.min(y0, py)
      y1 = Math.max(y1, py)
    }
  // A little more all round, so the soft edge of a JPEG never shows as a seam.
  const pad = 6
  const box: [number, number, number, number] = [Math.max(0, Math.floor(x0 - pad)), Math.max(0, Math.floor(y0 - pad)), Math.min(width, Math.ceil(x1 + pad)), Math.min(height, Math.ceil(y1 + pad))]
  return box[2] > box[0] && box[3] > box[1] ? box : undefined
}

/**
 * For the GM, wherever they are in their world, while a map is on players' screens. Draws nothing.
 *  - Remakes the players' copy a moment after the fog changes (the players' screen on this device,
 *    a TV say, reads that copy).
 *  - Keeps what's shown pointing at the picture players get now (fog switched on or off since).
 *  - With cloud sync on: sends joined players the piece of that copy that changed and the pins
 *    they may see, and answers a player's app that is behind with the whole picture, small.
 * Only the players' copy is ever read here, never the GM's picture.
 */
export function LiveMapHost({ world }: { world: World }) {
  const showing = isLiveMap(world.showing) && !world.spread ? world.showing! : undefined
  const showingId = showing?.id
  const shownAsset = showing?.assetId
  const cloud = !!world.cloud?.enabled
  const map = useShownMap(world.id, showing)
  const mapId = map?.id
  // Only the device that showed the map or last changed its fog keeps it live, so two GM devices
  // never make and upload the same copy at once.
  const since = useHostHere(mapId)
  const here = since > 0

  // The fog changed on another device (it came in by sync): that device keeps the map live now.
  const shapesKey = map?.fog ? `${map.fog.on ? 1 : 0}:${map.fog.shapes.map((x) => x.id).join(',')}` : ''
  const seenShapes = useRef<{ mapId?: string; key: string }>({ key: '' })
  useEffect(() => {
    const was = seenShapes.current
    seenShapes.current = { mapId, key: shapesKey }
    if (!mapId || was.mapId !== mapId || was.key === shapesKey) return
    if (here && Date.now() - since > ELSEWHERE_AFTER) fogChangedElsewhere(mapId)
  }, [mapId, shapesKey, here, since])

  // The fog changed: the players' copy is remade at once, not when the GM next pauses.
  useEffect(() => {
    if (!here || !map?.fog?.on) return
    let gone = false
    let timer: ReturnType<typeof setTimeout> | undefined
    void fogKey(map).then((key) => {
      if (gone || (map.fog?.imageId && map.fog.renderedFrom === key)) return
      timer = setTimeout(() => void renderPlayerFog(map.id).catch(() => {}), LIVE_FOG_DELAY)
    })
    return () => {
      gone = true
      clearTimeout(timer)
    }
  }, [map, here])

  // Fog switched on or off (or the first GM-only piece drawn) since it went up: what's shown follows to the picture players get now.
  const want = map ? playersCopyId(map) : undefined
  useEffect(() => {
    if (!showingId || !want || want === shownAsset) return
    void db.worlds
      .where('id')
      .equals(world.id)
      .modify((w) => {
        if (w.showing?.id !== showingId) return
        w.showing = { ...w.showing, assetId: want }
        w.handouts = (w.handouts ?? []).filter((h) => h.id === showingId || !(h.kind === 'image' && h.assetId === want)).map((h) => (h.id === showingId ? { ...h, assetId: want } : h))
      })
      .then(() => schedule(200))
  }, [world.id, showingId, shownAsset, want])

  // What the last copy made here was painted from, to know which part the next one changes.
  const last = useRef<{ mapId: string; version: number; shapes: FogShape[]; base: string }>(undefined)
  const host = useRef<ReturnType<typeof hostLiveMap>>(undefined)
  useEffect(() => {
    if (!cloud || !mapId || !here) return
    let sentWhole = 0
    let sentVersion = 0
    let waiting: ReturnType<typeof setTimeout> | undefined
    const pinsNow = async () => pinsForPlayers(await db.maps.get(mapId))
    const sendWhole = async () => {
      sentWhole = Date.now()
      const m = await db.maps.get(mapId)
      const id = m && playersCopyId(m)
      const asset = id ? await db.assets.get(id) : undefined
      if (!asset) return
      const bitmap = await createImageBitmap(asset.blob)
      try {
        const piece = cutPiece(bitmap, bitmap.width, bitmap.height, [0, 0, bitmap.width, bitmap.height])
        if (piece) await host.current?.send({ asset: asset.id, v: versionOf(asset), prev: 0, ...piece, whole: true, pins: await pinsNow() })
      } finally {
        bitmap.close()
      }
    }
    const h = hostLiveMap(world.id, async (askedFor, have) => {
      const m = await db.maps.get(mapId)
      const id = m && playersCopyId(m)
      // Another picture: they get the one shown now with the world, like anything else shown.
      if (!id || id !== askedFor) return
      const v = versionOf(await db.assets.get(id))
      if (have >= v) return void h.send({ asset: id, v, pins: await pinsNow() })
      // Behind: the whole picture, small. Several players asking at once get one answer between them.
      // (One that asked a moment before the last answer went out has it already: everyone hears each answer.)
      if (waiting || (v === sentVersion && Date.now() - sentWhole < 1500)) return
      waiting = setTimeout(() => {
        waiting = undefined
        sentVersion = v
        void sendWhole().catch(() => {})
      }, Math.max(0, sentWhole + WHOLE_EVERY - Date.now()))
    })
    host.current = h
    const stop = onPlayerFogRendered((r) => {
      if (r.mapId !== mapId) return
      // Only when the copy before this one is the very one whose shapes are remembered here (another tab may have made one since).
      const before = last.current?.mapId === mapId && last.current.base === r.base && last.current.version === r.prev ? last.current.shapes : undefined
      last.current = { mapId, version: r.version, shapes: r.shapes, base: r.base }
      // The piece is cut now, while the copy is in hand; without the shapes it was last made from (or
      // with a new map picture under it), all of it counts as changed.
      const { width, height } = r.canvas
      const box = before ? changedBox(before, r.shapes, r) : undefined
      // Nearly all of it changed: all of it is sent, so nothing heard before has to be kept under it.
      const px = box && (box[2] - box[0]) * (box[3] - box[1]) <= 0.9 * width * height ? box : undefined
      const piece = cutPiece(r.canvas, width, height, px ?? [0, 0, width, height])
      void (async () => {
        const ok = piece && (await h.send({ asset: r.imageId, v: r.version, prev: px ? r.prev : 0, ...piece, whole: !px || undefined, pins: await pinsNow() }))
        // A soft piece (or none that arrived) is put right by the copy itself, so that goes up now.
        if (!ok || piece?.soft) schedule(200)
      })()
    })
    return () => {
      stop()
      clearTimeout(waiting)
      h.close()
      host.current = undefined
    }
  }, [cloud, mapId, world.id, here])

  // A copy made elsewhere (before the map went up, or in another tab): if it's up to date, the shapes it was made from are the ones on the map.
  useEffect(() => {
    const imageId = map?.fog?.on ? map.fog.imageId : undefined
    if (!map?.fog || !imageId) return
    let gone = false
    void Promise.all([fogKey(map), db.assets.get(imageId)]).then(([key, asset]) => {
      const version = versionOf(asset)
      if (gone || map.fog?.renderedFrom !== key || (last.current?.mapId === map.id && last.current.version >= version)) return
      last.current = { mapId: map.id, version, shapes: map.fog.shapes, base: key.slice(0, key.lastIndexOf(':')) }
    })
    return () => {
      gone = true
    }
  }, [map])

  // A pin revealed, hidden, moved or renamed reaches players' screens at once too.
  const pins = useLiveQuery(async () => (cloud && here && map ? JSON.stringify(await pinsForPlayers(map)) : ''), [cloud, here, map])
  useEffect(() => {
    if (!pins || !map) return
    const t = setTimeout(async () => {
      const id = playersCopyId(map)
      if (id) void host.current?.send({ asset: id, v: versionOf(await db.assets.get(id)), pins: JSON.parse(pins) })
    }, 200)
    return () => clearTimeout(t)
    // Only when the list players would see changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins])
  return null
}

// ---------- on players' screens ----------

/** A stored picture once the browser has read it: its address, size and version. The one before stays up until the next is ready. */
function useLoadedPicture(asset: Asset | undefined) {
  const [loaded, setLoaded] = useState<{ id: string; url: string; version: number; size: [number, number] }>()
  const urls = useRef(new Set<string>())
  useEffect(() => {
    if (!asset) return
    let gone = false
    const made = urls.current
    const url = URL.createObjectURL(asset.blob)
    const drop = (u: string) => {
      URL.revokeObjectURL(u)
      made.delete(u)
    }
    made.add(url)
    const img = new Image()
    img.onload = () => {
      if (gone) return drop(url)
      setLoaded((was) => {
        // The address before is let go once the new picture has had time to take its place.
        if (was && was.url !== url) setTimeout(() => drop(was.url), 3000)
        return { id: asset.id, url, version: versionOf(asset), size: [img.naturalHeight, img.naturalWidth] }
      })
    }
    img.onerror = () => drop(url)
    img.src = url
    return () => {
      gone = true
    }
  }, [asset])
  // Leaving the screen lets them all go.
  useEffect(() => {
    const made = urls.current
    return () => made.forEach((u) => URL.revokeObjectURL(u))
  }, [])
  return asset && loaded?.id === asset.id ? loaded : undefined
}

/** The height and width of a picture given as an address (a piece sent live), once read. */
function useImageSize(url: string | undefined) {
  const [size, setSize] = useState<{ url: string; size: [number, number] }>()
  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.onload = () => setSize({ url, size: [img.naturalHeight, img.naturalWidth] })
    img.src = url
  }, [url])
  return size && size.url === url ? size.size : undefined
}

const EMPTY: MapPatch[] = []

/**
 * A shown map as players see it: their copy of the picture with the pins they may see. On a phone
 * it can be dragged and pinched; `big` (the players' TV screen) keeps the whole map in view.
 * On the GM's own device (a TV window, the player preview) the picture is the players' copy as the
 * map stands now, never the GM's. On a joined player's device it's the copy the server sent, with
 * the pieces heard live laid over it until the synced copy catches up.
 */
export function LiveMap({ showing, worldId, big }: { showing: Showing; worldId: string; big?: boolean }) {
  const world = useLiveQuery(async () => (await db.worlds.get(worldId)) ?? null, [worldId])
  const memberOf = world?.shared?.memberOf
  const own = !!world && !world.shared
  const map = useShownMap(worldId, showing)
  const assetId = world === undefined || map === undefined ? undefined : own && map ? playersCopyId(map) : showing.assetId
  const asset = useLiveQuery(async () => (assetId ? ((await db.assets.get(assetId)) ?? null) : null), [assetId])
  const picture = useLoadedPicture(asset && asset.id === assetId ? asset : undefined)
  const gmAsset = memberOf && showing.assetId ? gmIdOf(showing.assetId) : undefined
  const live = useLiveMap(memberOf, gmAsset)
  const { use, at, gap } = usablePatches(live?.patches ?? EMPTY, picture?.version ?? 0)
  const ownPins = useLiveQuery(() => pinsForPlayers(map), [map])
  const pins = live?.pins ?? ownPins ?? []
  // Before the picture itself has arrived (a slow connection), the whole of it sent live will do.
  const wholeSize = useImageSize(!map && !picture ? use.find((p) => p.whole)?.url : undefined)
  const size: [number, number] | undefined = map ? [map.height, map.width] : (picture?.size ?? wholeSize)
  const isNow = world?.showing?.id === showing.id

  // Joining the GM's room (the app opening, the phone waking) and a missing piece each say which version this device has.
  const have = useRef(at)
  useEffect(() => {
    have.current = at
  }, [at])
  // Not before this device's own copy has been read (or has had a moment to be), so a copy that's already here isn't asked for.
  const [waited, setWaited] = useState<string>()
  useEffect(() => {
    const t = setTimeout(() => setWaited(showing.id), 1500)
    return () => clearTimeout(t)
  }, [showing.id])
  const ready = !!picture || waited === showing.id
  useEffect(() => {
    if (!memberOf || !gmAsset || !isNow || !ready) return
    return onTableJoined(memberOf, () => void askForMap(memberOf, gmAsset, have.current))
  }, [memberOf, gmAsset, isNow, ready])
  useEffect(() => {
    if (!memberOf || !gmAsset || !gap) return
    void askForMap(memberOf, gmAsset, have.current)
    const again = setInterval(() => void askForMap(memberOf, gmAsset, have.current), 4000)
    return () => clearInterval(again)
  }, [memberOf, gmAsset, gap])
  // A soft piece is up: once the GM's app says the cloud has changed, the sharp copy is fetched straight away.
  const soft = use.some((p) => p.soft)
  useEffect(() => {
    if (!memberOf || !soft) return
    let asked = 0
    return onWorldChanged(memberOf, () => {
      if (Date.now() - asked < 5000) return
      asked = Date.now()
      refreshJoinedWorldNow(memberOf)
    })
  }, [memberOf, soft])

  // A picture that never arrives says so, rather than "Loading" forever.
  const [slow, setSlow] = useState<string>()
  const waiting = !size || (!picture && !use.length)
  useEffect(() => {
    if (!waiting) return
    const t = setTimeout(() => setSlow(showing.id), 8000)
    return () => clearTimeout(t)
  }, [waiting, showing.id])
  if (waiting) return <p className="muted">{slow === showing.id ? 'This map hasn’t reached this device. Ask your GM to show it again.' : 'Loading the map…'}</p>
  const canOpen = !!map && (own || map.visibility === 'players')
  return (
    <div className={`live-map-wrap ${big ? 'big' : ''}`}>
      <Suspense fallback={<p className="muted">Loading the map…</p>}>
        <LiveMapView url={picture?.url} size={size} patches={use} pins={pins} big={big} title={showing.title} />
      </Suspense>
      {!big && (
        <p className="live-map-foot muted small">
          {isNow ? 'Live: it changes as your GM uncovers the map. ' : ''}Drag to move about, pinch or use + and − to zoom{pins.length > 1 ? ' in for more names' : ''}.
          {canOpen && (
            <>
              {' '}
              <Link to={`${worldPath(worldId)}/maps/${map.id}`}>Open the map</Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}
