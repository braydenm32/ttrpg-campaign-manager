/** Shape helpers shared by the classic world-map and battle-map renderers. */
import type { Point } from './atlas'

export const hashId = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Map size relative to the 1400 px the recipes were tuned at; widths and spacings scale with it. */
export const scaleOf = (W: number, H: number) => Math.max(W, H) / 1400

/**
 * Marching squares over the mask; returns closed loops in map coordinates. The mask's edge is carried
 * on for `pad` cells past the map and then stops, so shapes that run off the edge close up out of
 * sight instead of being cut open (which would draw a straight line across the map).
 */
export function traceLoops(data: Uint8ClampedArray, mw: number, mh: number, ms: number, pad = 2): Point[][] {
  const P = Math.max(2, Math.round(pad))
  const GW = mw + 2 * P
  const GH = mh + 2 * P
  const v = new Float32Array(GW * GH)
  for (let gy = 1; gy < GH - 1; gy++)
    for (let gx = 1; gx < GW - 1; gx++) {
      const x = Math.min(mw - 1, Math.max(0, gx - P))
      const y = Math.min(mh - 1, Math.max(0, gy - P))
      v[gy * GW + gx] = data[(y * mw + x) * 4 + 3] / 255
    }
  const T = 0.5
  const pts = new Map<number, Point>()
  const hId = (x: number, y: number) => (y * GW + x) * 2
  const vId = (x: number, y: number) => (y * GW + x) * 2 + 1
  const at = (id: number): Point => {
    let p = pts.get(id)
    if (p) return p
    const cell = id >> 1
    const x = cell % GW
    const y = (cell - x) / GW
    if (id & 1) {
      const a = v[y * GW + x]
      const b = v[(y + 1) * GW + x]
      const t = (T - a) / (b - a || 1)
      p = [x, y + t]
    } else {
      const a = v[y * GW + x]
      const b = v[y * GW + x + 1]
      const t = (T - a) / (b - a || 1)
      p = [x + t, y]
    }
    pts.set(id, p)
    return p
  }
  const segs: [number, number][] = []
  for (let cy = 0; cy < GH - 1; cy++)
    for (let cx = 0; cx < GW - 1; cx++) {
      const a = v[cy * GW + cx]
      const b = v[cy * GW + cx + 1]
      const c = v[(cy + 1) * GW + cx + 1]
      const dd = v[(cy + 1) * GW + cx]
      const k = (a >= T ? 8 : 0) | (b >= T ? 4 : 0) | (c >= T ? 2 : 0) | (dd >= T ? 1 : 0)
      if (k === 0 || k === 15) continue
      const top = hId(cx, cy)
      const bottom = hId(cx, cy + 1)
      const left = vId(cx, cy)
      const right = vId(cx + 1, cy)
      const centre = (a + b + c + dd) / 4 >= T
      switch (k) {
        case 1: case 14: segs.push([left, bottom]); break
        case 2: case 13: segs.push([bottom, right]); break
        case 3: case 12: segs.push([left, right]); break
        case 4: case 11: segs.push([top, right]); break
        case 6: case 9: segs.push([top, bottom]); break
        case 7: case 8: segs.push([left, top]); break
        case 5:
          if (centre) segs.push([left, top], [bottom, right])
          else segs.push([top, right], [left, bottom])
          break
        case 10:
          if (centre) segs.push([top, right], [left, bottom])
          else segs.push([left, top], [bottom, right])
          break
      }
    }
  const byEdge = new Map<number, number[]>()
  segs.forEach(([p, q], i) => {
    for (const e of [p, q]) {
      const l = byEdge.get(e)
      if (l) l.push(i)
      else byEdge.set(e, [i])
    }
  })
  const used = new Uint8Array(segs.length)
  const loops: Point[][] = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const ids = [segs[i][0], segs[i][1]]
    let cur = segs[i][1]
    for (;;) {
      const next = (byEdge.get(cur) ?? []).find((j) => !used[j])
      if (next === undefined) break
      used[next] = 1
      cur = segs[next][0] === cur ? segs[next][1] : segs[next][0]
      if (cur === ids[0]) break
      ids.push(cur)
    }
    if (ids.length < 4) continue
    loops.push(ids.map((id) => {
      const [gx, gy] = at(id)
      return [(gx - P + 0.5) / ms, (gy - P + 0.5) / ms] as Point
    }))
  }
  return loops
}

export function makeNoise(seed: number) {
  const h = (x: number, y: number) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const w = yf * yf * (3 - 2 * yf)
    const a = h(xi, yi)
    const b = h(xi + 1, yi)
    const c = h(xi, yi + 1)
    const e = h(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * w + (a - b - c + e) * u * w
  }
  return (x: number, y: number) => {
    let s = 0
    let amp = 1
    let f = 1
    let tot = 0
    for (let o = 0; o < 4; o++) {
      s += amp * (vn(x * f, y * f) * 2 - 1)
      tot += amp
      amp *= 0.5
      f *= 2.13
    }
    return s / tot
  }
}

/** Smooth the traced loop, resample it evenly and push it in and out with noise tied to position,
 * so the coast looks hand-drawn and an edit elsewhere doesn't redraw the whole coastline. */
export function roughen(loop: Point[], k: number, noise: (x: number, y: number) => number, { amp = 7, wavelength = 55 } = {}): Point[] {
  let p = loop
  for (let it = 0; it < 2; it++) {
    const q: Point[] = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    p = q
  }
  const step = 3 * k
  const res: Point[] = []
  let carry = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    for (let t = carry; t < d; t += step) res.push([a[0] + ((b[0] - a[0]) * t) / d, a[1] + ((b[1] - a[1]) * t) / d])
    carry = d > 0 ? (((carry - d) % step) + step) % step : carry
  }
  if (res.length < 6) return res
  const a0 = amp * k
  const wl = wavelength * k
  return res.map((pt, i) => {
    const a = res[(i - 1 + res.length) % res.length]
    const b = res[(i + 1) % res.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const off = noise(pt[0] / wl, pt[1] / wl) * a0
    return [pt[0] - (dy / len) * off, pt[1] + (dx / len) * off] as Point
  })
}

export const loopArea = (l: Point[]) => {
  let a = 0
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) a += (l[j][0] + l[i][0]) * (l[j][1] - l[i][1])
  return Math.abs(a / 2)
}

/** Catmull-Rom through the points, sampled every few px, so freehand lines come out smooth. */
export function smoothLine(points: Point[], smooth: boolean, step: number): Point[] {
  if (!smooth || points.length < 3) return points
  const out: Point[] = []
  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(points[points.length - 1])
  return out
}
