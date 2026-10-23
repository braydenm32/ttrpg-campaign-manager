import { db, newId, type FogShape, type MapFog, type WorldMap } from './db'

/**
 * Fog of war. The GM uncovers parts of a map as the party explores. Players never get the clean map
 * image: the GM's device paints the fog onto a copy of the picture and that copy is what's shared,
 * so a covered room can't be found by opening the file. Pins under the fog are held back on the
 * server too (public.fog_point_revealed in supabase/migrations, which mirrors pointRevealed here).
 */

/** Largest side of the players' picture, in pixels; bigger maps are scaled down to keep uploads small. */
const PLAYER_IMAGE_MAX = 4096
/** Largest side of the GM's fog overlay. It only needs to look right on screen. */
const OVERLAY_MAX = 2048
export const FOG_COLOR = '#0d0d12'

/** Whether a point [y, x] is uncovered: the last shape that contains it decides. */
export function pointRevealed(shapes: FogShape[], [y, x]: [number, number]) {
  let revealed = false
  for (const s of shapes) if (inPolygon(s.points, y, x)) revealed = s.mode === 'reveal'
  return revealed
}

function inPolygon(pts: [number, number][], y: number, x: number) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i]
    const [yj, xj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Whether players would see a pin on a fogged map: a point pin under the fog is hidden, a region shows if any corner is uncovered. */
export function pinRevealed(fog: MapFog | undefined, pin: { position?: [number, number]; points?: [number, number][] }) {
  if (!fog?.on) return true
  if (pin.position) return pointRevealed(fog.shapes, pin.position)
  return !!pin.points?.some((p) => pointRevealed(fog.shapes, p))
}

export const rectShape = (a: [number, number], b: [number, number], mode: FogShape['mode']): FogShape => ({
  id: newId(),
  mode,
  points: [
    [a[0], a[1]],
    [a[0], b[1]],
    [b[0], b[1]],
    [b[0], a[1]],
  ],
})

export const circleShape = (c: [number, number], r: number, mode: FogShape['mode']): FogShape => ({
  id: newId(),
  mode,
  points: Array.from({ length: 28 }, (_, i) => {
    const t = (i / 28) * Math.PI * 2
    return [c[0] + Math.sin(t) * r, c[1] + Math.cos(t) * r] as [number, number]
  }),
})

/** Paints the fog onto a canvas the size of the map (scaled), black where covered. */
function paintFog(ctx: CanvasRenderingContext2D, map: WorldMap, shapes: FogShape[], scale: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = FOG_COLOR
  ctx.fillRect(0, 0, w, h)
  for (const s of shapes) {
    if (s.points.length < 3) continue
    ctx.globalCompositeOperation = s.mode === 'reveal' ? 'destination-out' : 'source-over'
    ctx.beginPath()
    s.points.forEach(([y, x], i) => {
      // Map coordinates count up from the bottom; the canvas counts down from the top.
      const px = x * scale
      const py = (map.height - y) * scale
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    })
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function canvasFor(map: WorldMap, max: number) {
  const scale = Math.min(1, max / Math.max(map.width, map.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(map.width * scale))
  canvas.height = Math.max(1, Math.round(map.height * scale))
  return { canvas, ctx: canvas.getContext('2d')!, scale }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t draw the fog'))), type, quality))

/** The GM's overlay: the fog alone, as a picture to lay over the map. */
export async function fogOverlay(map: WorldMap, shapes: FogShape[]) {
  const { canvas, ctx, scale } = canvasFor(map, OVERLAY_MAX)
  paintFog(ctx, map, shapes, scale)
  return toBlob(canvas, 'image/png')
}

function loadImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Couldn’t read the map image'))
    img.src = url
  })
}

/** What the players' picture depends on; when this changes it has to be made again. */
export async function fogKey(map: WorldMap) {
  const base = await db.assets.get(map.imageId)
  const shapes = JSON.stringify(map.fog?.shapes ?? [])
  let h = 0
  for (let i = 0; i < shapes.length; i++) h = (h * 31 + shapes.charCodeAt(i)) | 0
  return `${map.imageId}:${base?.updatedAt ?? base?.createdAt ?? 0}:${base?.size ?? 0}:${h}`
}

/**
 * Makes (or remakes) the players' copy of a fogged map: the map picture with the fog painted on.
 * Does nothing when the copy is already up to date.
 */
export async function renderPlayerFog(mapId: string) {
  const map = await db.maps.get(mapId)
  if (!map?.fog?.on) return
  const key = await fogKey(map)
  if (map.fog.renderedFrom === key && map.fog.imageId && (await db.assets.get(map.fog.imageId))) return
  const base = await db.assets.get(map.imageId)
  if (!base) return
  const img = await loadImage(base.blob)
  try {
    const { canvas, ctx, scale } = canvasFor(map, PLAYER_IMAGE_MAX)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const fog = canvasFor(map, PLAYER_IMAGE_MAX)
    paintFog(fog.ctx, map, map.fog.shapes, scale)
    ctx.drawImage(fog.canvas, 0, 0)
    const blob = await toBlob(canvas, 'image/jpeg', 0.85)
    const now = Date.now()
    const latest = await db.maps.get(mapId)
    if (!latest?.fog) return
    let imageId = latest.fog.imageId
    if (imageId && (await db.assets.get(imageId))) {
      await db.assets.update(imageId, { blob, size: blob.size, mime: 'image/jpeg', updatedAt: now })
    } else {
      imageId = newId()
      await db.assets.add({
        id: imageId,
        worldId: map.worldId,
        name: `${map.name} (players’ view).jpg`,
        mime: 'image/jpeg',
        size: blob.size,
        blob,
        tags: ['map', 'fog'],
        // Only reaches players through the map; never listed for them on its own.
        visibility: 'gm',
        createdAt: now,
        updatedAt: now,
      })
    }
    await db.maps.update(mapId, { fog: { ...latest.fog, imageId, renderedFrom: key } })
  } finally {
    URL.revokeObjectURL(img.src)
  }
}

/** Turns fog off and removes the players' copy of the picture. */
export async function removeFog(map: WorldMap) {
  if (map.fog?.imageId) await db.assets.delete(map.fog.imageId)
  await db.maps.update(map.id, { fog: undefined })
}
