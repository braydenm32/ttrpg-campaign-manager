/**
 * The fog "Room" tool: click inside a room on a battle map and get the outline of exactly that room's
 * floor, ready to uncover. It floods outwards from the click across the floor and stops at walls
 * (the wall lines drawn across a room) and at doors and gates. It works from the players' copy of
 * the drawing, so a secret room is never filled until the players have found it.
 */
import { newId, type FogShape } from '../db'
import { forPlayers, simplify, type Drawing } from '../mapDrawing'
import type { Point } from './atlas'
import { loopArea, traceLoops } from './geometry'
import { buildRooms, type RoomMap } from './rooms'
import { OPENINGS } from './vtt'

/** Lines that stop you walking through, as in the tabletop export. */
const WALL_LINES = new Set(['wall', 'dwall', 'hedge'])

/** Whether a point is inside a loop (counting crossings). */
const inside = (loop: Point[], [x, y]: Point) => {
  let in_ = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i]
    const [xj, yj] = loop[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_
  }
  return in_
}

/** The floor cells reachable from the start cell, or undefined when it isn't floor or is blocked. */
function flood(floor: Float32Array, blocked: Uint8Array, mw: number, mh: number, start: number) {
  const open = (i: number) => floor[i] >= 0.5 && !blocked[i]
  if (!open(start)) return undefined
  const seen = new Uint8Array(mw * mh)
  const stack = [start]
  seen[start] = 1
  while (stack.length) {
    const i = stack.pop()!
    const x = i % mw
    for (const j of [x > 0 ? i - 1 : -1, x < mw - 1 ? i + 1 : -1, i >= mw ? i - mw : -1, i < mw * (mh - 1) ? i + mw : -1])
      if (j >= 0 && !seen[j] && open(j)) {
        seen[j] = 1
        stack.push(j)
      }
  }
  return seen
}

/** Spreads a filled area outwards by r cells, so the fog edge reaches past the drawn walls. */
function grow(seen: Uint8Array, mw: number, mh: number, r: number) {
  let cur = seen
  for (let n = 0; n < r; n++) {
    const next = cur.slice()
    for (let y = 0; y < mh; y++)
      for (let x = 0; x < mw; x++) {
        const i = y * mw + x
        if (cur[i]) continue
        if ((x > 0 && cur[i - 1]) || (x < mw - 1 && cur[i + 1]) || (y > 0 && cur[i - mw]) || (y < mh - 1 && cur[i + mw])) next[i] = 1
      }
    cur = next
  }
  return cur
}

/** Whether a door piece (or gate, or bars) stands in its opening: broken doors and arches are open gaps. */
const shuts = (asset: string, variant: number) => {
  const kind = OPENINGS[asset]?.(((variant % 8) + 8) % 8)
  return !!kind && kind !== 'gap'
}

/**
 * The fog shapes that uncover (or cover) the room at map point (lat, lng) of a W x H map, in fog
 * coordinates ([y, x] counting up from the bottom). 'secret' means the click is in a room the
 * players haven't found; 'none' that it isn't in a room.
 */
export function roomFogShapes(drawing: Drawing, W: number, H: number, [lat, lng]: [number, number], mode: FogShape['mode']): FogShape[] | 'secret' | 'none' {
  const d = forPlayers(drawing)
  const g = d.gridSize || 70
  const [x, y] = [lng, H - lat]
  const cell = (m: RoomMap) => Math.min(m.mh - 1, Math.max(0, Math.floor(y * m.ms))) * m.mw + Math.min(m.mw - 1, Math.max(0, Math.floor(x * m.ms)))
  const rooms = d.rooms?.length ? buildRooms(d, W, H, 'fog') : undefined

  const none = () => {
    // a room only the GM has looks like rock to the players, so say why nothing happened
    if (d === drawing || !drawing.rooms?.length) return 'none'
    const all = buildRooms(drawing, W, H, 'fog-gm')
    return all.floor[cell(all)] >= 0.5 ? 'secret' : 'none'
  }
  if (!rooms) return none()

  // what stands in the way: wall lines and closed doors, painted on a mask the same size as the floor
  const c = document.createElement('canvas')
  c.width = rooms.mw
  c.height = rooms.mh
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.scale(rooms.ms, rooms.ms)
  ctx.strokeStyle = ctx.fillStyle = '#000'
  ctx.lineWidth = Math.max(0.25 * g, 2 / rooms.ms)
  ctx.lineCap = 'square'
  ctx.lineJoin = 'round'
  if (!d.hidden?.includes('paths'))
    for (const s of d.shapes)
      if (s.kind === 'line' && WALL_LINES.has(s.style) && s.points.length > 1) {
        ctx.beginPath()
        s.points.forEach(([lx, ly], i) => (i ? ctx.lineTo(lx, ly) : ctx.moveTo(lx, ly)))
        ctx.stroke()
      }
  if (!d.hidden?.includes('objects'))
    for (const s of d.shapes) {
      if (s.kind !== 'asset' || !shuts(s.asset, s.variant)) continue
      // the opening, with a little to spare either side so nothing slips past the jambs
      const hw = s.size * 0.47 + 0.1 * g
      const hd = Math.max(0.3 * g, s.size * 0.15)
      ctx.save()
      ctx.translate(s.at[0], s.at[1])
      ctx.rotate(((s.turn ?? 0) * Math.PI) / 180)
      ctx.fillRect(-hw, -hd, 2 * hw, 2 * hd)
      ctx.restore()
    }
  const mask = ctx.getImageData(0, 0, rooms.mw, rooms.mh).data
  const blocked = new Uint8Array(rooms.mw * rooms.mh)
  for (let i = 0; i < blocked.length; i++) blocked[i] = mask[i * 4 + 3] > 127 ? 1 : 0

  const seen = flood(rooms.floor, blocked, rooms.mw, rooms.mh, cell(rooms))
  if (!seen) return rooms.floor[cell(rooms)] >= 0.5 ? 'none' : none()

  const grown = grow(seen, rooms.mw, rooms.mh, Math.max(1, Math.round(0.1 * g * rooms.ms)))
  const rgba = new Uint8ClampedArray(rooms.mw * rooms.mh * 4)
  for (let i = 0; i < grown.length; i++) if (grown[i]) rgba[i * 4 + 3] = 255
  const loops = traceLoops(rgba, rooms.mw, rooms.mh, rooms.ms, 2)
    .map((l) => simplify(l, 0.04 * g))
    .filter((l) => l.length > 2 && loopArea(l) > (0.25 * g) ** 2)
  if (!loops.length) return 'none'
  // Loops inside another loop are rock left standing in the room. They are put back as they were, so
  // a ring-shaped room can't uncover what is in its middle. (The tracer doesn't say which way a loop
  // runs, so nesting is counted instead: inside an odd number of loops means a hole.)
  const depth = (l: Point[]) => loops.filter((o) => o !== l && inside(o, l[0])).length
  const other = mode === 'reveal' ? 'hide' : 'reveal'
  const toFog = (l: Point[]) => l.map(([lx, ly]) => [H - ly, lx] as [number, number])
  return loops
    .map((l) => ({ l, n: depth(l) }))
    .sort((a, b) => a.n - b.n)
    .map(({ l, n }) => ({ id: newId(), mode: n % 2 ? other : mode, points: toFog(l) }))
}
