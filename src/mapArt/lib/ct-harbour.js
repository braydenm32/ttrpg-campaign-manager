/* Harbour and farmland pieces for town plans, seen from directly above (view 'top'): piers, ships, fields and moored boats.
   Drawn like the battle-map buildings: a design space where the LONG side of the footprint is 100 units (scaled by s/100),
   centred on (x, y); light from the upper left, cast shadows down and to the right when st.shadows (flat fields cast none,
   the hedges and trees on them do); opaque fill first so later pieces hide what lies under them; colour mode lays
   translucent washes over the same linework, ink mode is paper and ink only. Town plans draw these small (1 ft is about
   1.4 px), so small sizes keep to clean shapes, crisp outlines and one tone of hatching, and `det` adds planks, rigging,
   furrows and clutter as the piece grows. Piers, ships and boats sit on water drawn by the map: only the timber and what is
   on it is drawn, with a soft shadow and a few ripples on the water beside it. Every piece has 8 hand-designed versions
   (variant 0-7); r() only adds hand-jitter to the strokes. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hyp = Math.hypot
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  let LX = 0.62, LY = 0.78 // direction the shade and the cast shadows run (down and to the right); a turned piece is handed its own (A.light)
  let ctx, r, st, INK, PAPER, COL, T, SH, u, det, LW, ROW
  const rr = (a, b) => a + r() * (b - a)
  const jt = (a) => (r() - 0.5) * 2 * a
  const K = (px) => px / u // screen pixels to design units
  const W = (b) => (b * LW) / u // pen weight (about b pixels at line weight 1) in design units

  function open(c, x, y, s, rg, style) {
    ctx = c; r = rg; st = style; INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint; SH = !!st.shadows
    u = s / 100; LX = A.light ? A.light[0] : 0.62; LY = A.light ? A.light[1] : 0.78
    det = s >= 200 ? 3 : s >= 105 ? 2 : s >= 50 ? 1 : 0
    LW = st.line * clamp(0.55 + s / 330, 0.8, 1.6)
    const grow = Math.max(0, s - 60)
    ROW = K(2.5 + grow * 0.017)
    ctx.save(); ctx.translate(x, y); ctx.scale(u, u); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([])
  }

  /* ---------- colour ---------- */
  const hx = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
  const mix = (a, b, t) => { const p = hx(a), q = hx(b); let s = '#'; for (let i = 0; i < 3; i++) s += Math.round(p[i] + (q[i] - p[i]) * t).toString(16).padStart(2, '0'); return s }
  const darker = (c, t) => mix(c, '#2b1f12', t)
  const lighter = (c, t) => mix(c, '#fbf3dc', t)
  const WOOD = () => mix(T.land, '#5f4026', 0.6)
  const DECK = () => mix(T.sand, '#8a6a42', 0.42) // weathered deck boards
  const TAR = () => mix(T.roof, '#3a2918', 0.5) // tarred hull timbers
  const STONE = () => mix(T.rock, '#8f9094', 0.42)
  const CANVAS = () => lighter(mix(T.sand, T.snow, 0.5), 0.25)
  const SOIL = () => mix(T.land, '#8a6a42', 0.42)
  const STRAW = () => mix(T.sand, '#c49a3a', 0.42)
  const HEDGE = () => mix(T.forestDark, T.forest, 0.35)
  const WATER_SH = 'rgba(22,38,44,.27)'
  const SHADE = 'rgba(40,30,15,.25)'

  /* ---------- paths and paint ---------- */
  function trace(pts) { for (let i = 0; i < pts.length; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]) } ctx.closePath() }
  function path(pts) { ctx.beginPath(); trace(pts) }
  function pathMulti(polys) { ctx.beginPath(); for (const pts of polys) trace(pts) }
  function fillPoly(pts, col) { path(pts); ctx.fillStyle = col; ctx.fill() }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const orient = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1] } return a >= 0 ? 1 : -1 }
  const bbox = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] } return [x0, y0, x1, y1] }
  /** Local frame at (cx, cy) turned by ang: f(u, v) maps along / across coordinates to design space. */
  const frameAt = (cx, cy, ang) => { const c = cos(ang || 0), s = sin(ang || 0); return (a, b) => [cx + a * c - b * s, cy + a * s + b * c] }
  const rotRect = (cx, cy, w, h, ang) => { const f = frameAt(cx, cy, ang); return [f(-w / 2, -h / 2), f(w / 2, -h / 2), f(w / 2, h / 2), f(-w / 2, h / 2)] }
  const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy])
  /** Translucent paint laid twice with a slight offset and a darker pooled edge (colour mode). */
  function wash(pts, col, a, multi) {
    a = a == null ? 0.55 : a
    const P = multi ? () => pathMulti(pts) : () => path(pts)
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col
    ctx.globalAlpha = a * 0.62; P(); ctx.fill(multi ? 'evenodd' : 'nonzero')
    ctx.translate(jt(0.5 / u), jt(0.5 / u)); P(); ctx.fill(multi ? 'evenodd' : 'nonzero')
    ctx.globalAlpha = a * 0.35; ctx.lineWidth = 1.2 / u; ctx.stroke()
    ctx.restore()
  }
  /** Opaque base under a footprint, then (colour mode) a hand-painted wash with a few uneven blooms. shade 0..1 darkens. */
  function paint(pts, col, shade, a) {
    if (!COL) { fillPoly(pts, PAPER); return }
    const c = darker(col, (shade || 0) * 0.3 + rr(0, 0.04))
    fillPoly(pts, mix(c, PAPER, 0.42))
    wash(pts, c, a == null ? 0.7 : a)
    if (det >= 1) bloom(pts, c)
  }
  /** The same for a ring (two loops, filled evenodd): hedges and walls that run right round a boundary. */
  function paintRing(polys, col, shade) {
    if (!COL) { pathMulti(polys); ctx.fillStyle = PAPER; ctx.fill('evenodd'); return }
    const c = darker(col, (shade || 0) * 0.3)
    pathMulti(polys); ctx.fillStyle = mix(c, PAPER, 0.42); ctx.fill('evenodd')
    wash(polys, c, 0.7, true)
  }
  /** Uneven pigment: a few soft darker and lighter patches inside the shape, as a wash dries. */
  function bloom(pts, c) {
    const [x0, y0, x1, y1] = bbox(pts), area = (x1 - x0) * (y1 - y0)
    if (area < 90) return
    const n = Math.min(5, 1 + Math.floor(area / 500))
    ctx.save(); path(pts); ctx.clip()
    for (let i = 0; i < n; i++) {
      const rad = Math.min(x1 - x0, y1 - y0) * rr(0.25, 0.6) + 2, cx = rr(x0, x1), cy = rr(y0, y1), dark = r() < 0.6
      ctx.globalAlpha = rr(0.05, 0.11); ctx.fillStyle = dark ? darker(c, 0.35) : lighter(c, 0.45)
      path(oval(cx, cy, rad * rr(0.8, 1.5), rad * rr(0.6, 1), 10, 0.12)); ctx.fill()
    }
    ctx.restore()
  }
  /** Soft bands of shade on the lower right of a round shape (colour mode). */
  function shadeBands(pts, cx, cy, rad, n) {
    if (!COL) return
    ctx.save(); path(pts); ctx.clip()
    const px = -LY, py = LX, big = rad * 3
    for (let i = 0; i < (n || 3); i++) {
      const c = -0.15 + i * 0.38, ox = cx + LX * rad * c, oy = cy + LY * rad * c
      ctx.beginPath(); ctx.moveTo(ox + px * big, oy + py * big); ctx.lineTo(ox - px * big, oy - py * big)
      ctx.lineTo(ox - px * big + LX * big, oy - py * big + LY * big); ctx.lineTo(ox + px * big + LX * big, oy + py * big + LY * big); ctx.closePath()
      ctx.fillStyle = 'rgba(48,34,18,.11)'; ctx.fill()
    }
    ctx.restore()
  }

  /* ---------- pen work ---------- */
  const SG = []
  function sg(x0, y0, x1, y1) { SG.push(x0, y0, x1, y1) }
  function flush(w, col) {
    if (!SG.length) return
    ctx.beginPath(); for (let i = 0; i < SG.length; i += 4) { ctx.moveTo(SG[i], SG[i + 1]); ctx.lineTo(SG[i + 2], SG[i + 3]) }
    ctx.lineWidth = W(w || 0.6); ctx.strokeStyle = col || INK; ctx.stroke(); SG.length = 0
  }
  /** A single hand-inked tapered stroke along a polyline. */
  function pl(pts, w, o) {
    o = o || {}
    A.inkStroke(ctx, pts, r, { w: W(w || 1.2), wob: W(o.wob == null ? 0.28 : o.wob), taper: o.taper == null ? 0.55 : o.taper, color: o.color || INK })
  }
  const ln = (a, b, w, o) => pl([a, b], w, o)
  /** Closed outline whose weight swells on edges that face down-right (the shade side) and eases off facing the light. */
  function outline(pts, w, o) {
    o = o || {}
    const n = pts.length, sgn = orient(pts)
    if (det < 2 || n > 40) {
      const hv = [], lt = []
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy) || 1
        const arr = (((dy / L) * sgn) * LX + ((-dx / L) * sgn) * LY) > 0.25 && !o.flat ? hv : lt
        arr.push(p, q)
      }
      for (const [arr, k] of [[lt, 0.82], [hv, 1.22]]) {
        if (!arr.length) continue
        ctx.beginPath(); for (let i = 0; i < arr.length; i += 2) { ctx.moveTo(arr[i][0], arr[i][1]); ctx.lineTo(arr[i + 1][0], arr[i + 1][1]) }
        ctx.lineWidth = W(w * (o.flat ? 1 : k)); ctx.strokeStyle = INK; ctx.stroke()
      }
      return
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy)
      if (L < 0.05) continue
      const ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn
      const f = clamp(nx * LX + ny * LY, -1, 1), ww = w * (o.flat ? 1 : 0.86 + 0.46 * f)
      const e = o.noext ? 0 : W(0.45) * rr(0.3, 1.4)
      A.inkStroke(ctx, [[p[0] - ux * e, p[1] - uy * e], [q[0] + ux * e, q[1] + uy * e]], r, { w: W(ww), wob: W(o.wob == null ? 0.5 : o.wob), taper: o.taper == null ? 0.38 : o.taper, color: INK })
    }
  }
  /** Smooth closed ink loop (round things, hulls) with the same lighting-weighted weight. */
  function loop(pts, w, o) {
    o = o || {}
    const n = pts.length, sgn = orient(pts), outer = [], inner = []
    if (det < 2) {
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath()
      ctx.lineWidth = W(w * (o.flat ? 1 : 0.85)); ctx.strokeStyle = INK; ctx.stroke()
      if (!o.flat) {
        ctx.beginPath(); let on = false
        for (let i = 0; i <= n; i++) {
          const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], c = pts[i % n], tx = b[0] - a[0], ty = b[1] - a[1], L = hyp(tx, ty) || 1
          const f = ((ty / L) * sgn) * LX + ((-tx / L) * sgn) * LY
          if (f > 0.35) { if (on) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); on = true } else on = false
        }
        ctx.lineWidth = W(w * 1.3); ctx.stroke()
      }
      return
    }
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], L = hyp(tx, ty) || 1
      const nx = (ty / L) * sgn, ny = (-tx / L) * sgn, f = clamp(nx * LX + ny * LY, -1, 1)
      const hw = (W(w) / 2) * (o.flat ? 1 : 0.86 + 0.46 * f) * (1 + jt(0.1))
      outer.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]); inner.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw])
    }
    ctx.beginPath(); outer.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath()
    inner.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath()
    ctx.fillStyle = INK; ctx.fill('evenodd')
  }
  /** Points of a slightly irregular ellipse. */
  function oval(cx, cy, rx, ry, n, wob, a0, a1) {
    a0 = a0 == null ? 0 : a0; a1 = a1 == null ? TAU : a1
    n = n || clamp(Math.round(Math.max(rx, ry) * u * 0.8), 12, 64)
    const full = a1 - a0 >= TAU - 0.001, out = [], ph = r() * 6, w = wob == null ? 0.006 : wob
    const m = full ? n : n + 1
    for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n, k = 1 + w * sin(a * 3 + ph) + jt(w * 0.5); out.push([cx + cos(a) * rx * k, cy + sin(a) * ry * k]) }
    return out
  }
  /** Rounded polygon: corners rounded with radius rad. */
  function rounded(pts, rad, steps) {
    const n = pts.length, out = []; steps = steps || 4
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n]
      const d0 = hyp(p1[0] - p0[0], p1[1] - p0[1]), d2 = hyp(p2[0] - p1[0], p2[1] - p1[1]), k = Math.min(rad, d0 / 2, d2 / 2)
      const a = [p1[0] + (p0[0] - p1[0]) * k / d0, p1[1] + (p0[1] - p1[1]) * k / d0], b = [p1[0] + (p2[0] - p1[0]) * k / d2, p1[1] + (p2[1] - p1[1]) * k / d2]
      for (let j = 0; j <= steps; j++) { const t = j / steps, mt = 1 - t; out.push([mt * mt * a[0] + 2 * mt * t * p1[0] + t * t * b[0], mt * mt * a[1] + 2 * mt * t * p1[1] + t * t * b[1]]) }
    }
    return out
  }
  /** Catmull-Rom through points, as a dense polyline. */
  function cr(pts, closed, sub) {
    sub = sub || 4; const n = pts.length, out = [], m = closed ? n : n - 1
    for (let i = 0; i < m; i++) {
      const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)]
      for (let q = 0; q < sub; q++) {
        const t = q / sub, t2 = t * t, t3 = t2 * t
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)])
      }
    }
    if (!closed) out.push(pts[n - 1])
    return out
  }
  /** Straight hatching across a box (no clip of its own): lines at `ang`, `gap` apart, with a little jitter. */
  function hatchBox(x0, y0, x1, y1, ang, gap, w) {
    const g = Math.max(gap, K(2.1)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hyp(x1 - x0, y1 - y0) / 2 + 1, dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx
    let cnt = 0
    for (let t = -L; t < L && cnt++ < 600; t += g * rr(0.85, 1.18)) { const ox = cx + nx * t, oy = cy + ny * t; sg(ox - dx * L, oy - dy * L, ox + dx * L + nx * jt(L * 0.03), oy + dy * L + ny * jt(L * 0.03)) }
    flush(w || 0.5)
  }
  /** Hatching inside a polygon: lines at `ang`, `gap` apart, broken here and there like pen work. */
  function hatchIn(pts, ang, gap, w, o) {
    o = o || {}
    const [x0, y0, x1, y1] = bbox(pts)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hyp(x1 - x0, y1 - y0), dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx
    ctx.save(); path(pts); ctx.clip()
    const g = Math.max(gap, K(2.1))
    for (let t = -L / 2; t < L / 2; t += g * rr(0.82, 1.22)) {
      const ox = cx + nx * t, oy = cy + ny * t
      let s0 = -L / 2 - rr(0, 3)
      while (s0 < L / 2) {
        const e = Math.min(s0 + rr(L * 0.25, L), L / 2)
        if (r() < (o.keep == null ? 0.96 : o.keep)) sg(ox + dx * s0, oy + dy * s0, ox + dx * e + nx * jt(0.25), oy + dy * e + ny * jt(0.25))
        s0 = e + rr(0.4, 1.8)
      }
    }
    flush(w || 0.5, o.color)
    ctx.restore()
  }
  function stippleIn(pts, dens, size, col) {
    const [x0, y0, x1, y1] = bbox(pts)
    const n = Math.min(900, Math.round(((x1 - x0) * (y1 - y0) * dens) / 100))
    ctx.save(); path(pts); ctx.clip(); ctx.beginPath()
    const rad = Math.max(K(0.55), size || 0.5)
    for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1); ctx.moveTo(x + rad, y); ctx.arc(x, y, rad * rr(0.6, 1.3), 0, TAU) }
    ctx.fillStyle = col || INK; ctx.fill(); ctx.restore()
  }
  const tuft = (x, y, s) => { s = s || 1; sg(x - 0.7 * s, y, x - 1.5 * s, y - 2.1 * s); sg(x, y, x + 0.1 * s, y - 2.7 * s); sg(x + 0.7 * s, y, x + 1.6 * s, y - 2 * s) }
  const post = (x, y, rad) => { ctx.beginPath(); ctx.arc(x, y, Math.max(rad || 1, K(1.1)), 0, TAU); ctx.fillStyle = INK; ctx.fill() }

  /* ---------- shadows ---------- */
  /** Shadow of one or more footprints thrown down-right by `len` units: hatching in ink, a translucent wash in colour. */
  function castShadow(polys, len, col) {
    if (!SH || len <= 0) return
    const dx = len * LX, dy = len * LY, n = Math.max(2, Math.min(7, Math.ceil(len / 2.5)))
    ctx.save(); ctx.beginPath()
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const pl0 of polys) {
      const P = orient(pl0) > 0 ? pl0 : pl0.slice().reverse()
      for (let k = 0; k <= n; k++) {
        const t = k / n
        P.forEach((p, i) => {
          const x = p[0] + dx * t, y = p[1] + dy * t
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y)
        })
        ctx.closePath()
      }
    }
    if (COL) { ctx.fillStyle = col || SHADE; ctx.fill() } else { ctx.clip(); shadowHatch(x0, y0, x1, y1) }
    ctx.restore()
  }
  /** Hatching for an ink shadow, within the current clip: lines across the light direction, broken like pen work. */
  function shadowHatch(x0, y0, x1, y1) {
    const nx = LX, ny = LY, vx = -ny, vy = nx
    let tmin = 1e9, tmax = -1e9, vmin = 1e9, vmax = -1e9
    for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const t = px * nx + py * ny, v = px * vx + py * vy; if (t < tmin) tmin = t; if (t > tmax) tmax = t; if (v < vmin) vmin = v; if (v > vmax) vmax = v }
    const g = K(2.7)
    for (let t = tmin; t < tmax; t += g * rr(0.8, 1.25)) {
      let v = vmin - rr(0, 4)
      while (v < vmax) {
        const e = Math.min(v + rr(10, 60), vmax)
        sg(t * nx + v * vx, t * ny + v * vy, (t + jt(0.7)) * nx + e * vx, (t + jt(0.7)) * ny + e * vy); v = e + rr(0.4, 1.6)
      }
    }
    flush(0.5)
  }
  /** A shadow with an explicit shape (tall thin things, rings): the polygons as given, evenodd when asked. */
  function shadowPoly(polys, col, evenodd) {
    if (!SH) return
    ctx.save(); pathMulti(polys)
    const rule = evenodd ? 'evenodd' : 'nonzero'
    if (COL) { ctx.fillStyle = col || SHADE; ctx.fill(rule) } else { ctx.clip(rule); const b = bbox([].concat(...polys)); shadowHatch(b[0], b[1], b[2], b[3]) }
    ctx.restore()
  }
  /** Shade inside a hollow shape (a hull, a box): the band along its upper-left inner edge, d units wide, thrown by the
      wall there. o.rev shades the lower-right crescent of a solid round form instead. Hatched in ink, a dark wash in colour. */
  function innerShade(pts, d, o) {
    o = o || {}
    const sgn = o.rev ? -1 : 1, sx = sgn * d * LX, sy = sgn * d * LY, [x0, y0, x1, y1] = bbox(pts)
    ctx.save(); path(pts); ctx.clip()
    ctx.beginPath(); ctx.rect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6)
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + sx, p[1] + sy) : ctx.moveTo(p[0] + sx, p[1] + sy))); ctx.closePath()
    ctx.clip('evenodd')
    if (COL) { ctx.fillStyle = o.col || 'rgba(40,30,15,.22)'; ctx.fillRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6) }
    if (!COL || o.inkToo) hatchBox(x0 - 3, y0 - 3, x1 + 3, y1 + 3, o.ang == null ? -0.75 : o.ang, o.gap || K(2.4), o.w || 0.45)
    ctx.restore()
  }
  const crescent = (pts, d, o) => innerShade(pts, d, Object.assign({ rev: true }, o || {}))

  /* ---------- water ---------- */
  /** Ripples round something afloat: short wavy dashes a little way out from its edge, in ink on both looks. */
  function ripples(pts, n, spread, maxY) {
    const m = pts.length, sp = spread || 7
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1] } cx /= m; cy /= m
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const p = pts[(r() * m) | 0], a = Math.atan2(p[1] - cy, p[0] - cx), d = rr(sp * 0.45, sp), x = p[0] + cos(a) * d, y = p[1] + sin(a) * d, l = rr(2.5, 5) * (0.7 + sp / 12)
      if (maxY != null && y > maxY) continue
      ctx.moveTo(x - l, y); ctx.quadraticCurveTo(x, y + rr(-1, 1), x + l, y + jt(0.4))
    }
    ctx.lineWidth = W(0.5); ctx.strokeStyle = COL ? mix(T.water, '#2c4a52', 0.5) : INK; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1
  }

  /* ---------- timber ---------- */
  /** A coordinate frame for boards running along unit vector d: a runs across them, b along. */
  function frame(pts, d) {
    const e = [-d[1], d[0]]
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9
    for (const p of pts) { const a = p[0] * e[0] + p[1] * e[1], b = p[0] * d[0] + p[1] * d[1]; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b }
    return { a0, a1, b0, b1, at: (a, b) => [a * e[0] + b * d[0], a * e[1] + b * d[1]] }
  }
  /** Boards running along d inside a polygon: seams between them, staggered butt joints, grain and nails when big. */
  function plankTex(pts, d, o) {
    o = o || {}
    const F = frame(pts, d), at = F.at, pw = o.pw || Math.max(ROW * 1.75, 3.4)
    ctx.save(); path(pts); ctx.clip()
    for (let a = F.a0 + pw * rr(0.4, 0.9); a < F.a1; a += pw * rr(0.94, 1.06)) {
      let b = F.b0 - rr(0, 4)
      while (b < F.b1) { const e = Math.min(b + rr(40, 90), F.b1 + 2), p = at(a + jt(0.12), b), q = at(a + jt(0.12), e); sg(p[0], p[1], q[0], q[1]); b = e + rr(0.2, 0.9) }
      if (det >= 2 && o.joints !== false) {
        for (let b2 = F.b0 + rr(4, 20); b2 < F.b1; b2 += rr(20, 38)) { const m = at(a - pw * 0.5, b2), n2 = at(a + pw * 0.5, b2); sg(m[0], m[1], n2[0], n2[1]) }
        if (det >= 3) { const g = at(a + jt(pw * 0.2), rr(F.b0, F.b1 - 8)), l = rr(4, 12); sg(g[0], g[1], g[0] + d[0] * l, g[1] + d[1] * l) }
      }
    }
    flush(o.w || 0.55)
    if (det >= 3 && o.nails !== false) {
      ctx.beginPath(); const dr = Math.max(K(0.7), 0.4)
      for (let a = F.a0 + pw * 0.5; a < F.a1; a += pw) for (let b2 = F.b0 + 6; b2 < F.b1; b2 += 28) if (r() < 0.5) { const c = at(a, b2 + jt(3)); ctx.moveTo(c[0] + dr, c[1]); ctx.arc(c[0], c[1], dr, 0, TAU) }
      ctx.fillStyle = INK; ctx.fill()
    }
    ctx.restore()
  }
  /** Courses of cobbles / stone blocks: rows with staggered joints. */
  function rowsTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, g = o.g, tw = o.tw
    ctx.save(); path(pts); ctx.clip()
    let i = 0
    for (let b = F.b1 - g * 0.4; b > F.b0 - g * 0.3; b -= g * (1 + jt(0.12)), i++) {
      let a = F.a0 - rr(0, 10)
      while (a < F.a1) { const e = Math.min(a + rr(12, 38), F.a1 + 3), p = at(a, b + jt(0.2)), q = at(e, b + jt(0.2)); sg(p[0], p[1], q[0], q[1]); a = e + rr(0.3, 1.4) }
      const off = (i % 2) * tw * 0.5 + jt(0.2)
      for (let aa = F.a0 - tw + off; aa < F.a1 + tw; aa += tw * rr(0.6, 1.6)) if (r() < 0.8) { const p = at(aa, b), q = at(aa + jt(0.3), b - g * rr(0.85, 1.05)); sg(p[0], p[1], q[0], q[1]) }
    }
    flush(o.w || 0.5)
    ctx.restore()
  }
  const E = [1, 0], S = [0, 1]
  /** Round-topped timber post or pile seen from above, standing in the water beside a deck. */
  function pile(x, y, rad, o) {
    const c = oval(x, y, rad, rad, 10); castShadow([c], rad * 1.1, o && o.col); fillPoly(c, COL ? mix(WOOD(), PAPER, 0.3) : PAPER); loop(c, 1.1)
    if (det >= 2) { sg(x - rad * 0.5, y, x + rad * 0.2, y + rad * 0.3); flush(0.4) }
  }
  /** Mooring bollard: a stout dark post with a ring. */
  function bollard(x, y, rad) {
    const c = oval(x, y, rad, rad, 10); castShadow([c], rad * 1.5)
    fillPoly(c, COL ? darker(WOOD(), 0.3) : PAPER); loop(c, 1.1)
    if (det >= 1) fillPoly(oval(x, y, rad * 0.4, rad * 0.4, 6), INK)
  }
  /** A leaning pile: its top displaced along (dx, dy), so it reads as an oval with a long shadow. */
  function leaningPile(x, y, rad, dx, dy) {
    const f = frameAt(x + dx / 2, y + dy / 2, Math.atan2(dy, dx)), L = hyp(dx, dy)
    const c = rounded([f(-L / 2 - rad, -rad), f(L / 2 + rad * 0.8, -rad * 0.8), f(L / 2 + rad * 0.8, rad * 0.8), f(-L / 2 - rad, rad)], rad, 3)
    castShadow([c], rad * 1.4, WATER_SH); fillPoly(c, COL ? mix(WOOD(), PAPER, 0.3) : PAPER); loop(c, 1.0)
    if (det >= 1) { const a = f(-L / 2 + rad * 0.5, 0), b = f(L / 2, 0); sg(a[0], a[1], b[0], b[1]); flush(0.45) }
  }
  /** A fence run: a rail with a post every few units. */
  function fenceSeg(a, b, o) {
    o = o || {}
    const L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / (o.gap || 7)))
    ln(a, b, 0.9, { taper: 0.25, wob: 0.2 })
    if (det >= 2) ln([a[0] + (b[1] - a[1]) / L * 0.9, a[1] - (b[0] - a[0]) / L * 0.9], [b[0] + (b[1] - a[1]) / L * 0.9, b[1] - (b[0] - a[0]) / L * 0.9], 0.5, { taper: 0.4, wob: 0.2 })
    for (let i = 0; i <= n; i++) post(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, o.rad || 0.9)
  }
  /** Small planked crate. */
  function crateS(cx, cy, w, h, ang) {
    const p = rotRect(cx, cy, w, h, ang)
    castShadow([p], Math.min(w, h) * 0.5); paint(p, WOOD(), 0.15)
    if (det >= 1) {
      const f = frameAt(cx, cy, ang), n = Math.max(2, Math.round(h / Math.max(K(5), 2.4)))
      for (let i = 1; i < n; i++) { const v = -h / 2 + (h * i) / n, a = f(-w / 2, v + jt(0.1)), b = f(w / 2, v + jt(0.1)); sg(a[0], a[1], b[0], b[1]) }
      flush(0.5)
      if (det >= 2) { const a = f(-w / 2 + 1, -h / 2 + 1), b = f(w / 2 - 1, h / 2 - 1); ln(a, b, 0.6, { taper: 0.4 }) }
    }
    outline(p, 1.1, { noext: true })
  }
  /** Small barrel seen from above. */
  function barrelS(cx, cy, R) {
    const c = oval(cx, cy, R, R, 12)
    castShadow([c], R * 0.9); paint(c, WOOD(), 0.25)
    if (det >= 1) { crescent(c, R * 0.6); const c2 = oval(cx, cy, R * 0.72, R * 0.72, 10); loop(c2, 0.55, { flat: true }); sg(cx - R * 0.68, cy + jt(0.2), cx + R * 0.68, cy + jt(0.2)); if (det >= 2) sg(cx + jt(0.2), cy - R * 0.68, cx + jt(0.2), cy + R * 0.68); flush(0.45) }
    loop(c, 1.1)
  }
  /** Small sack lying down, the neck towards +u of the frame. */
  function sackS(cx, cy, w, h, ang) {
    const f = frameAt(cx, cy, ang), base = oval(0, 0, w / 2, h / 2, 12, 0.08), p = base.map((q) => f(q[0] * (1 + 0.06 * (q[0] > 0 ? 1 : 0)), q[1]))
    castShadow([p], h * 0.4); paint(p, mix(T.sand, '#b09a70', 0.4), 0.15)
    if (det >= 1) { crescent(p, w * 0.22); const a = f(w * 0.3, -h * 0.3), b = f(w * 0.3, h * 0.3); ln(a, b, 0.7, { taper: 0.3 }) }
    loop(p, 1.0)
  }
  /** Coiled rope lying on a deck. */
  function coil(x, y, R) {
    ctx.beginPath(); for (let i = 0; i < 3; i++) { const q = R * (0.35 + i * 0.3); ctx.moveTo(x + q, y); ctx.arc(x + jt(0.15), y + jt(0.15), q, rr(0, 1), TAU * 0.9 + rr(0, 1)) }
    ctx.lineWidth = W(0.7); ctx.strokeStyle = INK; ctx.stroke()
  }
  /** Round haystack / rick seen from above: spiral of strokes. */
  function haystack(x, y, rad) {
    const c = oval(x, y, rad, rad)
    castShadow([c], rad * 0.6)
    paint(c, mix(T.sand, '#8a7236', 0.3), 0.2)
    shadeBands(c, x, y, rad, 3)
    if (det >= 1) { const n = Math.round(rad * 1.6 * Math.min(2.4, Math.max(0.8, u))); ctx.save(); path(c); ctx.clip(); for (let i = 0; i < n; i++) { const a = r() * TAU, q = rad * rr(0.12, 0.95), l = rr(1.5, 3.2); sg(x + cos(a) * q, y + sin(a) * q, x + cos(a + 1.3) * (q + l * 0.2) + cos(a) * l, y + sin(a + 1.3) * (q + l * 0.2) + sin(a) * l) } flush(0.5); ctx.restore() }
    if (!COL && det >= 1) crescent(c, rad * 0.45)
    loop(c, 1.3)
  }
  /** Small gable-roofed building for the farmstead: two roof planes, ridge along ax, a stack. */
  function houseS(x0, y0, x1, y1, ax, kind) {
    const sil = rect(x0, y0, x1, y1), sw = ax === 'y'
    castShadow([sil], 4)
    const col = kind === 'thatch' ? mix(T.sand, '#7b6330', 0.42) : kind === 'plank' ? WOOD() : T.roof
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
    const pN = sw ? [[x0, y0], [mx, y0], [mx, y1], [x0, y1]] : [[x0, y0], [x1, y0], [x1, my], [x0, my]]
    const pS = sw ? [[mx, y0], [x1, y0], [x1, y1], [mx, y1]] : [[x0, my], [x1, my], [x1, y1], [x0, y1]]
    paint(pN, col, 0.1); paint(pS, col, 0.75)
    const slope = sw ? 0 : PI / 2, eave = sw ? PI / 2 : 0
    if (det >= 1) {
      if (kind === 'thatch') { hatchIn(pS, slope, Math.max(K(2.4), 1.1), 0.45, { keep: 0.85 }); if (det >= 2) hatchIn(pN, slope, Math.max(K(4), 2), 0.4, { keep: 0.6 }) }
      else if (kind === 'plank') { hatchIn(pS, slope, Math.max(K(4), 2), 0.5); hatchIn(pN, slope, Math.max(K(4), 2), 0.5); hatchIn(pS, slope + 0.5, Math.max(K(3.2), 1.6), 0.4, { keep: 0.7 }) }
      else { hatchIn(pS, eave, Math.max(K(3.4), 1.6), 0.5); hatchIn(pN, eave, Math.max(K(3.4), 1.6), 0.5); if (det >= 2) hatchIn(pS, slope + 0.6, Math.max(K(3.2), 1.6), 0.4, { keep: 0.6 }) }
    }
    if (sw) ln([mx, y0], [mx, y1], 1.4, { taper: 0.3 }); else ln([x0, my], [x1, my], 1.4, { taper: 0.3 })
    outline(sil, 1.6)
    if (kind !== 'plank') { const cx = sw ? mx : x0 + (x1 - x0) * 0.2, cy = sw ? y0 + (y1 - y0) * 0.25 : my, cw = Math.max(1.6, K(2.4)); const q = rect(cx - cw / 2, cy - cw / 2, cx + cw / 2, cy + cw / 2); castShadow([q], cw * 0.8); paint(q, STONE(), 0.1); outline(q, 0.9, { noext: true, flat: true }); if (det >= 1) fillPoly(rect(cx - cw * 0.22, cy - cw * 0.22, cx + cw * 0.22, cy + cw * 0.22), INK) }
  }

  /* ---------- hulls ---------- */
  /** Half-beam stations [x, halfBeam] from stern to bow, smoothed into a dense list. */
  const dense = (ST) => cr(ST, false, 4)
  const hwAt = (D, x) => { if (x <= D[0][0]) return D[0][1]; for (let i = 1; i < D.length; i++) if (x <= D[i][0]) { const t = (x - D[i - 1][0]) / (D[i][0] - D[i - 1][0] || 1); return D[i - 1][1] + (D[i][1] - D[i - 1][1]) * t } return D[D.length - 1][1] }
  /** Closed hull polygon between xa and xb (default the whole length), inset by ins; pointed ends close at a single tip. */
  function slice(D, ins, xa, xb) {
    xa = xa == null ? -1e9 : xa; xb = xb == null ? 1e9 : xb
    const x0 = Math.max(xa, D[0][0]), x1 = Math.min(xb, D[D.length - 1][0]), xs = [x0]
    for (const p of D) if (p[0] > x0 + 0.01 && p[0] < x1 - 0.01) xs.push(p[0])
    xs.push(x1)
    const top = [], bot = []
    let px = null, pv = 0
    for (const x of xs) {
      const v = hwAt(D, x) - ins
      if (v > 0.05) {
        if (px != null && pv <= 0.05) { const xc = px + (x - px) * ((0.05 - pv) / (v - pv || 1)); top.push([xc, 0]) }
        top.push([x, -v]); bot.push([x, v])
      } else if (px != null && pv > 0.05) { const xc = px + (x - px) * ((pv - 0.05) / (pv - v || 1)); top.push([xc, 0]) }
      px = x; pv = v
    }
    return top.concat(bot.reverse())
  }
  /** The hull of a ship: tarred sides, a planked deck, shade under the windward bulwark. Returns its shapes. */
  function hull(D, o) {
    o = o || {}
    const gun = o.gun || 3.2, outer = slice(D, 0), inner = slice(D, gun)
    if (!o.noRipples) ripples(outer, det >= 1 ? 9 : 4, 8)
    castShadow([outer], o.h == null ? 3.2 : o.h, WATER_SH)
    paint(outer, o.col || TAR(), 0.25)
    paint(inner, o.deck || DECK(), 0)
    if (det >= 1) plankTex(inner, E, { pw: Math.max(K(5), 2.4), w: 0.42 })
    if (det >= 1) innerShade(inner, gun * 0.9)
    loop(inner, 0.8, { flat: true })
    if (det >= 2) loop(slice(D, gun * 0.5), 0.45, { flat: true })
    loop(outer, 1.7)
    return { outer, inner, D, gun }
  }
  /** A raised deck (fore- or aftcastle, quarterdeck) over the hull between xa and xb. */
  function castle(D, xa, xb, o) {
    o = o || {}
    const p = slice(D, o.ins == null ? 1.6 : o.ins, xa, xb)
    castShadow([p], o.h || 3.5, WATER_SH)
    paint(p, o.col || darker(DECK(), 0.12), 0.1)
    if (det >= 1) plankTex(p, E, { pw: Math.max(K(5), 2.4), w: 0.42, joints: false })
    if (det >= 1) innerShade(p, 1.4)
    outline(p, 1.3, { noext: true })
    if (det >= 2 && o.rail !== false) { const g = Math.max(K(5), 3); for (let x = xa + 2; x < xb - 1; x += g) { const hw = hwAt(D, x) - (o.ins == null ? 1.6 : o.ins) - 0.9; if (hw > 2) { post(x, -hw, 0.5); post(x, hw, 0.5) } } }
    return p
  }
  /** Mast: a round top with a long thin shadow lying across the deck. */
  function mast(x, y, rad, len) {
    len = len == null ? 16 : len
    const c = oval(x, y, rad, rad, 10)
    if (det >= 1 && len > 0) { const f = frameAt(x, y, Math.atan2(LY, LX)), w2 = rad * 0.8; shadowPoly([[f(0, -w2), f(len, -w2 * 0.6), f(len, w2 * 0.6), f(0, w2)]]) } else castShadow([c], rad * 1.2)
    fillPoly(c, COL ? mix(WOOD(), PAPER, 0.15) : PAPER); loop(c, 1.1)
    if (det >= 1) fillPoly(oval(x, y, rad * 0.42, rad * 0.42, 6), INK)
  }
  /** Yard across the hull at x with the sail furled along it. */
  function yardFurled(x, y, hl, o) {
    o = o || {}
    const f = frameAt(x, y, o.ang || 0), sw = o.sw || Math.max(2.2, K(2.4))
    const sail = rounded([f(-sw / 2, -hl), f(sw / 2, -hl), f(sw / 2, hl), f(-sw / 2, hl)], sw / 2, 3)
    ln(f(0, -hl - 3), f(0, hl + 3), 1.3, { taper: 0.15, wob: 0.15 })
    castShadow([sail], 2.5); paint(sail, CANVAS(), 0.2)
    if (det >= 1) { const g = Math.max(K(5), 3.5); for (let v = -hl + g * 0.6; v < hl - 1; v += g * rr(0.85, 1.2)) { const a = f(-sw / 2 - 0.4, v), b = f(sw / 2 + 0.4, v + jt(0.3)); sg(a[0], a[1], b[0], b[1]) } flush(0.5) }
    if (det >= 1) innerShade(sail, sw * 0.4)
    outline(sail, 0.9, { noext: true })
  }
  /** Square sail set: the yard straight across at x, the foot bellying forward (towards the bow). */
  function squareSail(x, y, hl, belly) {
    const pts = []
    const n = 14
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x + belly * Math.pow(sin(PI * t), 0.85), y - hl + 2 * hl * t]) }
    castShadow([pts], 3.5, WATER_SH); paint(pts, CANVAS(), 0.1)
    if (det >= 1) {
      ctx.save(); path(pts); ctx.clip()
      hatchIn([[x - 1, y + hl * 0.25], [x + belly + 2, y + hl * 0.25], [x + belly + 2, y + hl + 1], [x - 1, y + hl + 1]], 0.35, Math.max(K(3), 1.4), 0.42, { keep: 0.8 })
      if (det >= 2) { const g = Math.max(K(6), 3.5); for (let yy = y - hl + g; yy < y + hl - 1; yy += g * rr(0.9, 1.1)) { const t = (yy - y + hl) / (2 * hl); sg(x + 0.5, yy, x + belly * Math.pow(sin(PI * t), 0.85) - 0.3, yy + jt(0.2)) } flush(0.35) }
      ctx.restore()
    }
    outline(pts, 1.0, { noext: true })
    ln([x, y - hl - 2.5], [x, y + hl + 2.5], 1.4, { taper: 0.15, wob: 0.15 })
  }
  /** Lateen sail: a long yard slung fore-and-aft, the sail hanging to the lee side (side = -1 above, 1 below). */
  function lateen(x, y, L, side) {
    const F0 = [x + 0.5 * L, y - side * 0.04 * L], Aft = [x - 0.48 * L, y + side * 0.2 * L], C = [x - 0.2 * L, y + side * 0.5 * L]
    const quad = (a, c, b, n) => { const out = []; for (let i = 1; i <= n; i++) { const t = i / n, mt = 1 - t; out.push([mt * mt * a[0] + 2 * mt * t * c[0] + t * t * b[0], mt * mt * a[1] + 2 * mt * t * c[1] + t * t * b[1]]) } return out }
    const c1 = [(Aft[0] + C[0]) / 2 - 0.05 * L, (Aft[1] + C[1]) / 2 + side * 0.04 * L], c2 = [x + 0.16 * L, y + side * 0.56 * L]
    const pts = [F0, Aft].concat(quad(Aft, c1, C, 5), quad(C, c2, F0, 10).slice(0, -1))
    castShadow([pts], 3.5, WATER_SH); paint(pts, CANVAS(), 0.1)
    if (det >= 1) {
      ctx.save(); path(pts); ctx.clip()
      const ang = Math.atan2(Aft[1] - F0[1], Aft[0] - F0[0])
      const mid = [(F0[0] + Aft[0]) / 2, (F0[1] + Aft[1]) / 2], m1 = [Aft[0] + (C[0] - Aft[0]) * 0.5, Aft[1] + (C[1] - Aft[1]) * 0.5], m2 = [F0[0] + (C[0] - F0[0]) * 0.5, F0[1] + (C[1] - F0[1]) * 0.5], ce = [C[0] + (C[0] - mid[0]) * 0.7, C[1] + (C[1] - mid[1]) * 0.7]
      hatchIn([m1, ce, m2], ang + 1.1, Math.max(K(3), 1.4), 0.42, { keep: 0.8 })
      if (det >= 2) { const g = Math.max(K(6), 3.5), f = frameAt(F0[0], F0[1], ang), len = hyp(Aft[0] - F0[0], Aft[1] - F0[1]); for (let t = g; t < len; t += g * rr(0.9, 1.15)) { const a = f(t, 0); sg(a[0], a[1], a[0] - 0.08 * L * (t / len) + jt(0.2), y + side * 0.5 * L * (0.3 + 0.7 * t / len)) } flush(0.35) }
      ctx.restore()
    }
    outline(pts, 1.0, { noext: true })
    const d = hyp(Aft[0] - F0[0], Aft[1] - F0[1]), ux = (Aft[0] - F0[0]) / d, uy = (Aft[1] - F0[1]) / d
    ln([F0[0] - ux * 3, F0[1] - uy * 3], [Aft[0] + ux * 2, Aft[1] + uy * 2], 1.4, { taper: 0.15, wob: 0.15 })
  }
  /** Oars out from the hull at the given stations, on side -1 (above) or 1 (below), raked a little aft. */
  function oarsOf(D, xs, side, len, o) {
    o = o || {}
    for (const x of xs) {
      const hw = hwAt(D, x), a = [x, side * (hw - 1.2)], b = [x - len * (o.rake == null ? 0.28 : o.rake), side * (hw + len * 0.95)]
      const d = hyp(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, bl = o.blade || Math.max(3.5, len * 0.22)
      ln(a, [b[0] - ux * bl, b[1] - uy * bl], 1.1, { taper: 0.1, wob: 0.15 })
      const f = frameAt(b[0] - ux * bl / 2, b[1] - uy * bl / 2, Math.atan2(uy, ux)), blade = oval(0, 0, bl / 2, Math.max(0.9, bl * 0.16), 8).map((p) => f(p[0], p[1]))
      fillPoly(blade, COL ? mix(WOOD(), PAPER, 0.35) : PAPER); loop(blade, 0.8, { flat: true })
    }
  }
  /** Round shields hung along both rails between xa and xb. */
  function shields(D, xa, xb, gap, R) {
    const cols = COL ? [mix(T.roof, T.sand, 0.12), CANVAS(), mix(T.sand, '#c28a2c', 0.6), mix(T.water, '#4e6478', 0.55)] : [PAPER]
    let i = 0
    for (let x = xa; x <= xb; x += gap, i++) for (const side of [-1, 1]) {
      const hw = hwAt(D, x), c = oval(x, side * (hw - R * 0.75), R, R * 0.8, 10)
      castShadow([c], R * 0.4); fillPoly(c, cols[(i + (side > 0 ? 2 : 0)) % cols.length]); if (COL) wash(c, cols[(i + (side > 0 ? 2 : 0)) % cols.length], 0.5)
      if (det >= 1) { crescent(c, R * 0.5); fillPoly(oval(x, side * (hw - R * 0.75), R * 0.22, R * 0.22, 6), INK) }
      loop(c, 0.9)
    }
  }
  /** Shrouds and stays: thin rigging from a mast to the rails. */
  function shrouds(D, x, n, span) {
    if (det < 2) return
    for (let i = 0; i < n; i++) { const xx = x - 4 - i * span; const hw = hwAt(D, xx) - 1.5; sg(x, 0, xx, -hw); sg(x, 0, xx, hw) }
    flush(0.32)
  }
  /** Pennant streaming from a mast top. */
  function pennant(x, y, L, ang, col) {
    const ux = cos(ang), uy = sin(ang), nx = -uy, ny = ux, w0 = L * 0.13, amp = L * 0.07, top = [], bot = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, cx = x + ux * L * t + nx * amp * sin(t * 5.2), cy = y + uy * L * t + ny * amp * sin(t * 5.2), hw = w0 * (1 - 0.55 * t)
      top.push([cx + nx * hw, cy + ny * hw]); bot.push([cx - nx * hw, cy - ny * hw])
    }
    const nt = [x + ux * L * 0.78 + nx * amp * sin(0.78 * 5.2), y + uy * L * 0.78 + ny * amp * sin(0.78 * 5.2)]
    const pts = [...top, nt, ...bot.reverse()]
    if (COL) { fillPoly(pts, mix(col || darker(T.roof, 0.1), PAPER, 0.2)); wash(pts, col || darker(T.roof, 0.1), 0.6) } else fillPoly(pts, PAPER)
    if (det >= 1) { ctx.save(); path(pts); ctx.clip(); const hg = Math.max(K(1.9), 1.1); for (let q = -2; q < L; q += hg) { const ax = x + ux * q, ay = y + uy * q; sg(ax - nx * 3, ay - ny * 3, ax + nx * 3 + ux * 0.9, ay + ny * 3 + uy * 0.9) } flush(0.45); ctx.restore() }
    outline(pts, 0.8, { noext: true, flat: true, wob: 0.05 })
  }
  /** Stern rudder and tiller. */
  function rudder(D, xs) {
    const q = rect(xs - 4.5, -1.1, xs + 0.6, 1.1); castShadow([q], 1.2, WATER_SH); paint(q, darker(WOOD(), 0.2), 0.3); outline(q, 0.9, { noext: true, flat: true })
    if (det >= 1) ln([xs + 0.5, 0], [xs + 9, 1.2], 1.0, { taper: 0.3 })
  }
  function bowsprit(x, len, ang) { ln([x - 2, 0], [x + len * cos(ang || 0), len * sin(ang || 0)], 1.8, { taper: 0.5, wob: 0.1 }) }
  /** Cargo hatch: a dark grating in the middle of the deck. */
  function hatchway(x0, y0, x1, y1) {
    const q = rect(x0, y0, x1, y1); paint(q, darker(WOOD(), 0.35), 0.5)
    if (det >= 1) { const g = Math.max(K(2.6), 1.3); for (let x = x0 + g; x < x1; x += g) sg(x, y0, x, y1); for (let y = y0 + g; y < y1; y += g) sg(x0, y, x1, y); flush(0.45) }
    outline(q, 1.0, { noext: true })
  }

  /* ---------- small boats ---------- */
  const RB = [[-50, 7], [-47, 11], [-38, 14.5], [-22, 16.5], [-2, 16.5], [20, 14.5], [36, 10], [46, 4.5], [52, 0]] // rowboat, stern to bow
  const PUNT = [[-50, 13], [-46, 16], [-30, 16.5], [30, 16.5], [46, 16], [50, 13]]
  const SKIFF = [[-50, 3], [-46, 8], [-34, 13], [-10, 15.5], [16, 14.5], [36, 10], [47, 4], [51, 0]]
  /** A small open boat, length L and beam B, bow along +u of a frame turned by ang. Returns its frame and shapes. */
  function boat(cx, cy, L, B, ang, o) {
    o = o || {}
    const f = frameAt(cx, cy, ang), sx = L / 102, sy = B / 33
    const D = dense((o.st || RB).map((p) => [p[0] * sx, p[1] * sy]))
    const gun = o.gun || Math.max(1.3, B * 0.1), outerL = slice(D, 0), innerL = slice(D, gun)
    const outer = outerL.map((p) => f(p[0], p[1])), inner = innerL.map((p) => f(p[0], p[1]))
    if (!o.noRipples) ripples(outer, det >= 1 ? 5 : 2, Math.max(4, B * 0.4), o.maxY)
    castShadow([outer], o.h == null ? 2 : o.h, WATER_SH)
    paint(outer, o.col || TAR(), 0.25)
    paint(inner, o.floor || DECK(), 0)
    if (det >= 1) {
      ctx.save(); path(inner); ctx.clip(); ctx.beginPath()
      const g = Math.max(K(6), 3.2)
      for (let x = -L * 0.42; x < L * 0.44; x += g) { const hw = hwAt(D, x) - gun * 0.4; const a = f(x + jt(0.2), -hw), m = f(x + 0.6, 0), b = f(x + jt(0.2), hw); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]) }
      ctx.lineWidth = W(0.42); ctx.strokeStyle = INK; ctx.stroke()
      if (det >= 2) { ctx.beginPath(); for (const q of [-0.4, 0.4]) { let first = true; for (let x = -L * 0.45; x <= L * 0.48; x += 3) { const p = f(x, q * hwAt(D, x)); if (first) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); first = false } } ctx.lineWidth = W(0.38); ctx.stroke() }
      ctx.restore()
      innerShade(inner, gun * 1.3)
    }
    loop(inner, 0.7, { flat: true })
    const tw = o.thwarts || [-0.28, 0.1], w = Math.max(K(4.5), 2.6)
    for (const t of tw) { const x = t * L, hw = hwAt(D, x) - gun * 0.9, q = [f(x - w / 2, -hw), f(x + w / 2, -hw), f(x + w / 2, hw), f(x - w / 2, hw)]; castShadow([q], 1); paint(q, WOOD(), 0.2); outline(q, 0.8, { noext: true, flat: true }) }
    if (o.bowDeck) { const xa = L * 0.3, p = slice(D, gun * 0.9, xa, 60).map((p) => f(p[0], p[1])); castShadow([p], 1); paint(p, WOOD(), 0.15); outline(p, 0.8, { noext: true, flat: true }) }
    loop(outer, 1.3)
    return { f, D, outer, inner, L, B, gun }
  }
  /** Oars shipped inside a boat, lying along it. */
  function oarsIn(b) { const f = b.f; for (const s of [-1, 1]) { ln(f(-b.L * 0.38, s * b.B * 0.26), f(b.L * 0.34, s * b.B * 0.16), 0.9, { taper: 0.15, wob: 0.15 }); const e = oval(0, 0, Math.max(2.2, b.L * 0.06), 0.9, 8).map((p) => f(p[0] + b.L * 0.34 + 2, p[1] + s * b.B * 0.15)); fillPoly(e, COL ? mix(WOOD(), PAPER, 0.3) : PAPER); loop(e, 0.7, { flat: true }) } }
  /** Oars out over the water from a boat's frame. */
  function oarsOut(b, at, len) { const f = b.f; for (const s of [-1, 1]) { const hw = hwAt(b.D, at * b.L), a = f(at * b.L, s * (hw - 1)), e = f(at * b.L - len * 0.25, s * (hw + len)), bl = Math.max(3, len * 0.22); const d = hyp(e[0] - a[0], e[1] - a[1]), ux = (e[0] - a[0]) / d, uy = (e[1] - a[1]) / d; ln(a, [e[0] - ux * bl, e[1] - uy * bl], 1.0, { taper: 0.1, wob: 0.15 }); const g = frameAt(e[0] - ux * bl / 2, e[1] - uy * bl / 2, Math.atan2(uy, ux)), blade = oval(0, 0, bl / 2, Math.max(0.9, bl * 0.18), 8).map((p) => g(p[0], p[1])); fillPoly(blade, COL ? mix(WOOD(), PAPER, 0.35) : PAPER); loop(blade, 0.8, { flat: true }) } }
  /** A heaped fishing net in a boat. */
  function net(b, at, w, h) { const f = b.f, p = oval(0, 0, w / 2, h / 2, 12, 0.14).map((q) => f(q[0] + at * b.L, q[1])); paint(p, mix(T.sand, T.rock, 0.45), 0.2); if (det >= 1) { hatchIn(p, 0.7, Math.max(K(2.6), 1.3), 0.4); hatchIn(p, -0.8, Math.max(K(2.6), 1.3), 0.4) } loop(p, 0.9, { wob: 0.6 }) }
  /** A tarpaulin lashed over a boat. */
  function tarp(b, a0, a1) { const f = b.f, D = b.D, p = slice(D, b.gun * 0.6, a0 * b.L, a1 * b.L).map((q) => f(q[0], q[1])); castShadow([p], 1.5); paint(p, CANVAS(), 0.25); if (det >= 1) { crescent(p, b.B * 0.2); const g = Math.max(K(6), 4); for (let x = a0 * b.L + g * 0.6; x < a1 * b.L; x += g) { const hw = hwAt(D, x); const q0 = f(x, -hw), q1 = f(x + jt(0.4), hw); sg(q0[0], q0[1], q1[0], q1[1]) } flush(0.5) } outline(p, 0.9, { noext: true }) }
  /** A mooring line from a point to a bollard, slack. */
  function mooring(a, b, sag) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, sgv = (sag == null ? 1 : sag) * (r() < 0.5 ? 1 : -1); pl([a, [m[0] + nx * sgv, m[1] + ny * sgv], b], 0.6, { taper: 0.15, wob: 0.3 }) }

  /* ---------- farmland ---------- */
  /** A rectangle whose edges wander a little, as a field boundary drawn by hand. Phases are fixed per version. */
  function wobbleRect(x0, y0, x1, y1, amp, ph) {
    const pts = [], c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4], L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(3, Math.round(L / 5)), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L
      for (let k = 0; k < n; k++) { const t = k / n, e = k === 0 ? 0 : amp * (sin(t * 6.1 + ph + i * 2.3) * 0.6 + sin(t * 14.7 + ph * 1.7 + i) * 0.4) * sin(PI * t) + jt(0.25); pts.push([a[0] + (b[0] - a[0]) * t + nx * e, a[1] + (b[1] - a[1]) * t + ny * e]) }
    }
    return pts
  }
  /** Both edges of a band of width w along a polyline (closed or open), lumpy by `lump`. */
  function offsets(pts, w, lump, closed) {
    const P = A.wobble(closed ? pts.concat([pts[0]]) : pts, r, 0, Math.max(2.5, w * 1.2))
    if (closed) P.pop()
    const n = P.length, L = [], R = [], ph = r() * 6
    for (let i = 0; i < n; i++) {
      const a = P[closed ? (i + n - 1) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = hyp(dx, dy) || 1, nx = -dy / d, ny = dx / d
      const l1 = (w / 2) * (1 + lump * (sin(i * 1.7 + ph) * 0.5 + jt(0.5))), l2 = (w / 2) * (1 + lump * (sin(i * 1.3 + ph * 2) * 0.5 + jt(0.5)))
      L.push([P[i][0] + nx * l1, P[i][1] + ny * l1]); R.push([P[i][0] - nx * l2, P[i][1] - ny * l2])
    }
    return { L, R }
  }
  /** Hedgerow along a polyline (or right round it when closed): a lumpy dark band with its own small shadow. */
  function hedge(pts, w, closed) {
    w = w || 3
    const { L, R } = offsets(pts, w, 0.4, closed)
    if (closed) {
      shadowPoly([shift(L, 1.3 * LX, 1.3 * LY), shift(R, 1.3 * LX, 1.3 * LY)], SHADE, true)
      paintRing([L, R], HEDGE(), 0.2)
      if (det >= 1) { ctx.save(); pathMulti([L, R]); ctx.clip('evenodd'); const b = bbox(L); stippleIn([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], det >= 2 ? 2.2 : 1.2, K(0.6)); ctx.restore() }
      loop(L, 1.0, { wob: 0.6 }); loop(R, 0.9, { wob: 0.6, flat: true })
    } else {
      const band = L.concat(R.slice().reverse())
      castShadow([band], 1.3)
      paint(band, HEDGE(), 0.2)
      if (det >= 1) stippleIn(band, det >= 2 ? 2.2 : 1.2, K(0.6))
      loop(band, 1.0, { wob: 0.6 })
    }
  }
  /** Dry-stone wall along a polyline: a narrow grey band with the stones ticked across it. */
  function wall(pts, w, closed) {
    w = w || 2.2
    const { L, R } = offsets(pts, w, 0.18, closed)
    const polys = closed ? [L, R] : [L.concat(R.slice().reverse())]
    shadowPoly(polys.map((p) => shift(p, 1.1 * LX, 1.1 * LY)), SHADE, closed)
    if (closed) paintRing(polys, STONE(), 0.1); else paint(polys[0], STONE(), 0.1)
    if (det >= 1) {
      const g = Math.max(K(4), 2.2), n = L.length, m = closed ? n : n - 1
      let acc = 0
      for (let i = 0; i < m; i++) { const a = L[i], b = L[(i + 1) % n], c = R[i], d = R[(i + 1) % n], len = hyp(b[0] - a[0], b[1] - a[1]); for (let t = acc; t < len; t += g * rr(0.7, 1.4)) { const k = t / len; sg(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, c[0] + (d[0] - c[0]) * k + jt(0.3), c[1] + (d[1] - c[1]) * k + jt(0.3)) } acc = 0 }
      flush(0.45)
    }
    if (closed) { loop(L, 0.9, { flat: true, wob: 0.3 }); loop(R, 0.9, { flat: true, wob: 0.3 }) } else outline(polys[0], 0.9, { flat: true, noext: true, wob: 0.3 })
  }
  /** A small round tree seen from above. */
  function treeS(x, y, R) {
    const c = oval(x, y, R, R * 0.95, clamp(Math.round(R * u * 0.6), 9, 22), 0.09)
    castShadow([c], R * 0.7)
    paint(c, mix(T.forest, T.forestDark, 0.2), 0.2)
    if (det >= 1) crescent(c, R * 0.55, { col: 'rgba(30,40,15,.25)' })
    loop(c, 1.1)
    if (det >= 2 && R * u > 9) { ctx.save(); path(c); ctx.clip(); for (let i = 0; i < 4; i++) { const a = rr(0.1, 1.5), d = R * rr(0.2, 0.7), px = x + cos(a) * d, py = y + sin(a) * d, l = R * 0.25; sg(px, py, px + cos(a + 1.2) * l, py + sin(a + 1.2) * l) } flush(0.45); ctx.restore() }
    if (det >= 1 && R * u > 6) fillPoly(oval(x + R * 0.05, y + R * 0.05, Math.max(0.45, K(0.7)), Math.max(0.45, K(0.7)), 6), INK)
  }
  const PLOT = { plough: () => SOIL(), fallow: () => mix(T.grass, T.sand, 0.5), pasture: () => T.grass, stubble: () => STRAW(), crop: () => mix(T.grass, '#7d9a3c', 0.45), dirt: () => mix(T.land, T.sand, 0.5), orchard: () => mix(T.grass, T.forest, 0.2), vine: () => mix(T.grass, T.sand, 0.55) }
  /** Opaque field plot with its wash. */
  const plot = (pts, kind, shade) => paint(pts, PLOT[kind](), shade || 0)
  /** Furrows: broken parallel lines at `ang`. */
  const plough = (pts, ang, o) => { o = o || {}; hatchIn(pts, ang, o.gap || Math.max(K(3.6), 1.3), o.w || 0.5, { keep: 0.97 }) }
  /** Standing grain: fine, close hatching. */
  const crop = (pts, ang) => { if (det >= 1) hatchIn(pts, ang == null ? 1.35 : ang, Math.max(K(2.4), 0.9), 0.4, { keep: 0.9 }); else stippleIn(pts, 1.2, K(0.6)) }
  /** Stubble: short ticks and a few dots. */
  function stubble(pts, dens) {
    const [x0, y0, x1, y1] = bbox(pts), n = Math.min(700, Math.round(((x1 - x0) * (y1 - y0) * (dens || 1.6)) / 100))
    ctx.save(); path(pts); ctx.clip()
    for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1), l = rr(0.7, 1.5); sg(x, y, x + jt(0.3), y - l) }
    flush(0.45); ctx.restore()
    if (det >= 2) stippleIn(pts, 0.5, K(0.55))
  }
  /** Rough pasture: sparse stipple and grass tufts. */
  function pasture(pts, dens) {
    stippleIn(pts, det >= 1 ? 0.6 : 0.3, K(0.6))
    if (det >= 1) { const [x0, y0, x1, y1] = bbox(pts), n = Math.min(260, Math.round(((x1 - x0) * (y1 - y0) * (dens || 0.35)) / 100)); ctx.save(); path(pts); ctx.clip(); for (let i = 0; i < n; i++) tuft(rr(x0, x1), rr(y0, y1), rr(0.7, 1.1)); flush(0.45); ctx.restore() }
  }
  /** Cart track: two wheel ruts, with a pale earth band between them in colour. */
  function track(pts, w) {
    w = w || 3.2
    const { L, R } = offsets(pts, w, 0.08, false)
    if (COL) { ctx.save(); ctx.globalAlpha = 0.45; fillPoly(L.concat(R.slice().reverse()), mix(T.land, T.sand, 0.5)); ctx.restore() }
    for (const side of [L, R]) { let i = 0; while (i < side.length - 1) { const e = Math.min(side.length - 1, i + 3 + ((r() * 5) | 0)); pl(side.slice(i, e + 1), 0.6, { taper: 0.5, wob: 0.4 }); i = e + (r() < 0.3 ? 1 : 0) } }
  }
  /** Field gate: a slim barred leaf between two posts. */
  function gate(cx, cy, len, ang) {
    const f = frameAt(cx, cy, ang), p = [f(-len / 2, -0.9), f(len / 2, -0.9), f(len / 2, 0.9), f(-len / 2, 0.9)]
    castShadow([p], 1.2); paint(p, WOOD(), 0.1); outline(p, 0.8, { noext: true, flat: true })
    if (det >= 1) ln(f(-len / 2 + 1, 0.8), f(len / 2 - 1, -0.8), 0.6, { taper: 0.3 })
    post(...f(-len / 2 - 0.3, 0), 1.1); post(...f(len / 2 + 0.3, 0), 1.1)
  }
  /** A stook: sheaves leaning together, a rosette of strokes from above. */
  function stook(x, y, R) {
    const c = oval(x, y, R, R * 0.9, 9, 0.1)
    castShadow([c], R * 0.5); paint(c, STRAW(), 0.1)
    if (det >= 1) { const n = det >= 2 ? 8 : 5; for (let i = 0; i < n; i++) { const a = (TAU * i) / n + jt(0.2); sg(x + cos(a) * R * 0.15, y + sin(a) * R * 0.15, x + cos(a) * R * 0.95, y + sin(a) * R * 0.95) } flush(0.45) }
    loop(c, 0.9, { wob: 0.5 })
  }
  function boulder(x, y, rx, ry, ang) {
    const c = oval(0, 0, rx, ry, 10, 0.14).map((p) => frameAt(x, y, ang)(p[0], p[1]))
    castShadow([c], ry * 0.5); paint(c, STONE(), 0.1)
    if (det >= 1) crescent(c, rx * 0.45)
    loop(c, 1.0, { wob: 0.4 })
  }

  /* ---------- registration ---------- */
  function reg(name, label, fns) {
    A.register(name, {
      label, category: 'ct-harbour', kind: 'fixed', view: 'top', variants: fns.length,
      draw(c, x, y, s, rg, style, v) {
        open(c, x, y, s, rg, style)
        try { fns[(((v | 0) % fns.length) + fns.length) % fns.length]() } finally { SG.length = 0; ctx.restore() }
      },
    })
  }

  /* =====================================================================================================================
     PIER: the shore is along y = +50, the pier reaches out towards -y over water drawn by the map
     ===================================================================================================================== */
  /** A planked deck over water: soft shadow on the water, opaque boards across, outline. */
  function deck(pts, o) {
    o = o || {}
    if (!o.noRipples) ripples(pts, det >= 1 ? 7 : 3, 7, 46)
    castShadow([pts], o.h == null ? 3 : o.h, WATER_SH)
    paint(pts, o.col || DECK(), 0.05)
    if (det >= 1) plankTex(pts, o.d || E, { pw: o.pw || Math.max(K(5), 2.6), w: 0.5 })
    outline(pts, o.w || 1.6, { noext: true })
  }
  /** Piles along a→b, just outside a deck edge. */
  function pilesAlong(a, b, gap, rad) {
    const L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / gap))
    for (let i = 0; i <= n; i++) { const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n; if (det >= 1) pile(x, y, rad, { col: WATER_SH }); else post(x, y, rad * 0.8) }
  }
  /** Stone steps down the side of a quay inside a notch between y0 and y1, descending towards +x (sx = 1) or -x. */
  function steps(xTop, y0, y1, n, sx) {
    const tw = 1.5
    for (let i = 0; i < n; i++) {
      const xa = xTop + sx * tw * i, xb = xTop + sx * tw * (i + 1), q = rect(Math.min(xa, xb), y0, Math.max(xa, xb), y1)
      paint(q, lighter(STONE(), 0.08), 0.1 + i * 0.18)
      if (det >= 1 && i > 0) hatchIn(q, 1.57, Math.max(K(2.2), 1.1), 0.4, { keep: 0.5 + i * 0.12 })
      ln([xb, y0], [xb, y1], 0.8, { taper: 0.3, wob: 0.15 })
    }
    const notch = rect(Math.min(xTop, xTop + sx * tw * n), y0, Math.max(xTop, xTop + sx * tw * n), y1)
    if (det >= 1) innerShade(notch, 1.6)
    ln([xTop, y0], [xTop + sx * tw * n, y0], 1.0, { taper: 0.2 }); ln([xTop, y1], [xTop + sx * tw * n, y1], 1.3, { taper: 0.2 })
  }

  /** 0: straight plank jetty on posts, a pair of stout mooring posts at the end. */
  function pier0() {
    const hw = 9, p = rect(-hw, -48, hw, 50)
    deck(p)
    for (const s of [-1, 1]) pilesAlong([s * (hw + 0.9), 44], [s * (hw + 0.9), -42], 11, 1.6)
    bollard(-hw + 2.6, -44, 2.1); bollard(hw - 2.6, -44, 2.1)
    if (det >= 2) { coil(3, -20, 2.6); const lad = [[hw, 14], [hw + 3.2, 14], [hw + 3.2, 24], [hw, 24]]; outline(lad, 0.7, { noext: true, flat: true }); for (let y = 16; y < 24; y += 2) sg(hw, y, hw + 3.2, y); flush(0.5) }
  }
  /** 1: T-shaped pier: a stem out to a broad head with bollards at both ends. */
  function pier1() {
    const head = rect(-44, -50, 44, -29), stem = rect(-8, -31, 8, 50)
    ripples(head, det >= 1 ? 8 : 3, 7, 46)
    castShadow([head, stem], 3, WATER_SH)
    deck(stem, { noRipples: true, h: 0 }); deck(head, { noRipples: true, h: 0 })
    ln([-8, -29], [8, -29], 0.8, { taper: 0.3 })
    pilesAlong([-9, 45], [-9, -26], 11, 1.6); pilesAlong([9, 45], [9, -26], 11, 1.6)
    pilesAlong([-45, -27.5], [45, -27.5], 11.2, 1.6); pilesAlong([-45, -51], [45, -51], 11.2, 1.6)
    bollard(-40, -39.5, 2.1); bollard(40, -39.5, 2.1)
    if (det >= 1) { barrelS(22, -40, 3.2); barrelS(28, -34, 3) }
    if (det >= 2) coil(-24, -36, 2.4)
  }
  /** 2: L-shaped pier: the stem turns to run along the harbour, barrels and crates on the arm. */
  function pier2() {
    const stem = rect(-22, -34, -6, 50), arm = rect(-22, -50, 42, -32)
    ripples(stem.concat(arm), det >= 1 ? 9 : 4, 7, 46)
    castShadow([stem, arm], 3, WATER_SH)
    deck(stem, { noRipples: true, h: 0 }); deck(arm, { noRipples: true, h: 0 })
    ln([-21, -32], [-7, -32], 0.8, { taper: 0.3 })
    pilesAlong([-23, 45], [-23, -28], 11, 1.6); pilesAlong([-5, 45], [-5, -28], 11, 1.6)
    pilesAlong([-23, -51], [43, -51], 11, 1.6); pilesAlong([-1, -31], [43, -31], 11, 1.6)
    bollard(38, -41, 2.1); bollard(-18, -46, 1.8)
    if (det >= 1) { crateS(10, -41, 8, 7, 0.05); barrelS(22, -38, 3.2); barrelS(27, -44, 3) }
    if (det >= 2) { sackS(-2, -44, 6, 4.5, 0.4); coil(-14, -38, 2.4) }
  }
  /** 3: stone quay: cobbled top, coping blocks, bollards, mooring rings and a flight of steps down to the water. */
  function pier3() {
    const hw = 14, body = [[-hw, -50], [hw, -50], [hw, 6], [hw - 6, 6], [hw - 6, 20], [hw, 20], [hw, 50], [-hw, 50]]
    ripples(body, det >= 1 ? 8 : 3, 7, 46)
    castShadow([rect(-hw, -50, hw, 50)], 3.5, WATER_SH)
    paint(body, lighter(STONE(), 0.06), 0.05)
    if (det >= 2) rowsTex(body, S, { g: Math.max(K(7), 3.2), tw: Math.max(K(9), 4), w: 0.45 })
    else if (det >= 1) stippleIn(body, 1.3, K(0.6))
    // coping along both edges
    for (const s of [-1, 1]) { const band = rect(s < 0 ? -hw : hw - 2.6, -50, s < 0 ? -hw + 2.6 : hw, 50); paint(band, lighter(STONE(), 0.14), 0.05); ln([s < 0 ? -hw + 2.6 : hw - 2.6, -50], [s < 0 ? -hw + 2.6 : hw - 2.6, 50], 0.7, { taper: 0.1, wob: 0.2 }); if (det >= 1) { const g = Math.max(K(6), 3.4); for (let y = -48; y < 50; y += g * rr(0.8, 1.25)) sg(s < 0 ? -hw : hw - 2.6, y, s < 0 ? -hw + 2.6 : hw, y + jt(0.3)); flush(0.5) } }
    const end = rect(-hw, -50, hw, -47.4); paint(end, lighter(STONE(), 0.14), 0.05); ln([-hw, -47.4], [hw, -47.4], 0.7, { taper: 0.1 })
    steps(hw - 6, 6, 20, 4, 1)
    outline(body, 1.9, { noext: true, wob: 0.14 })
    for (const [x, y] of [[-9.5, -40], [9.5, -40], [-9.5, -12], [9.5, 30], [-9.5, 36]]) bollard(x, y, 1.7)
    if (det >= 2) { for (const y of [-26, 44]) { ctx.beginPath(); ctx.arc(hw - 1.3, y, 1.3, 0, TAU); ctx.lineWidth = W(0.8); ctx.strokeStyle = INK; ctx.stroke() } coil(0, 14, 2.6) }
  }
  /** 4: wide wharf, cargo stacked on it: crates, barrels and sacks waiting for a ship. */
  function pier4() {
    const hw = 26, p = rect(-hw, -50, hw, 50)
    deck(p, { pw: Math.max(K(5.5), 2.8) })
    for (const s of [-1, 1]) pilesAlong([s * (hw + 0.9), 45], [s * (hw + 0.9), -46], 11.5, 1.7)
    pilesAlong([-hw + 5, -51], [hw - 5, -51], 11, 1.7)
    bollard(-hw + 3.5, -42, 2); bollard(hw - 3.5, -42, 2); bollard(hw - 3.5, 20, 2); bollard(-hw + 3.5, 10, 2)
    crateS(12, -28, 10, 9, 0.08); crateS(15, -17, 8, 7, -0.25); crateS(-13, 22, 11, 9, 0.02); crateS(-3, 27, 7, 6, 0.5)
    barrelS(-13, -34, 3.6); barrelS(-6, -30, 3.3); barrelS(-11, -26, 3.1); barrelS(14, 38, 3.4)
    sackS(9, 6, 7.5, 5.2, 0.3); sackS(16, 10, 7, 5, -0.5); sackS(11, 14, 6.5, 5, 0.9)
    if (det >= 2) { coil(-16, -8, 3); coil(20, 28, 2.4); crateS(21, -26, 5, 5, 0.3) }
  }
  /** 5: pier with a timber crane: a treadwheel housing, a long jib swung out and a load hanging over the water. */
  function pier5() {
    const hw = 11, p = rect(-hw, -50, hw, 50)
    deck(p)
    for (const s of [-1, 1]) pilesAlong([s * (hw + 0.9), 45], [s * (hw + 0.9), -46], 11, 1.6)
    bollard(-hw + 2.6, -45, 2); bollard(hw - 2.6, -45, 2)
    // base frame of heavy timbers
    const base = rect(-7, -36, 7, -22)
    castShadow([base], 2.5); paint(base, darker(WOOD(), 0.15), 0.25)
    if (det >= 1) { const inn = rect(-5.4, -34.4, 5.4, -23.6); outline(inn, 0.7, { noext: true, flat: true }); ln([-5.4, -34.4], [5.4, -23.6], 0.6, { taper: 0.4 }); ln([5.4, -34.4], [-5.4, -23.6], 0.6, { taper: 0.4 }) }
    outline(base, 1.4, { noext: true })
    // the jib and its shadow, thrown far because it is high
    const tip = [-33, -37], mx = 0, my = -29
    const jf = frameAt(mx, my, Math.atan2(tip[1] - my, tip[0] - mx)), jl = hyp(tip[0] - mx, tip[1] - my)
    shadowPoly([[jf(0, -1.2), jf(jl, -0.9), jf(jl, 0.9), jf(0, 1.2)].map((q) => [q[0] + 9 * LX, q[1] + 9 * LY])], WATER_SH)
    const load = rotRect(tip[0] + 1, tip[1] + 1, 9, 7.5, 0.35)
    castShadow([load], 8, WATER_SH)
    if (det >= 1) ln(jf(1.5, -1.6), jf(jl - 1, -0.3), 0.55, { taper: 0.1, wob: 0.15 })
    ln([mx, my], tip, 2.6, { taper: 0.3, wob: 0.1 })
    if (det >= 1) { const w = rect(8.5, -27, 14.5, -23.5); castShadow([w], 2); paint(w, WOOD(), 0.2); outline(w, 0.9, { noext: true }); if (det >= 2) { sg(9.5, -27, 9.5, -23.5); sg(13.5, -27, 13.5, -23.5); flush(0.5) } }
    mast(mx, my, 2.4, 0)
    paint(load, WOOD(), 0.15)
    if (det >= 1) { const f = frameAt(tip[0] + 1, tip[1] + 1, 0.35); for (let v = -2.2; v <= 2.3; v += 2.2) { const a = f(-4.5, v), b = f(4.5, v); sg(a[0], a[1], b[0], b[1]) } flush(0.5) }
    outline(load, 1.1, { noext: true })
    ln(tip, [tip[0] + 1, tip[1] + 1], 0.8)
    crateS(-4, 16, 9, 8, -0.1); crateS(5, 26, 7, 7, 0.3); if (det >= 1) barrelS(5, 12, 3.2)
  }
  /** 6: broken pier: planks missing, the far end fallen in, piles leaning and a few boards adrift. */
  function pier6() {
    const hw = 9, pw = Math.max(K(5), 3.6), n = Math.round(84 / pw)
    const body = rect(-hw, -34, hw, 50)
    ripples(rect(-hw, -50, hw, 50), det >= 1 ? 9 : 4, 7, 46)
    // beams first (they show through the gaps), then the planks
    const beamsShadow = [rect(-hw, -40, -hw + 1.8, 50), rect(hw - 1.8, -36, hw, 50)]
    castShadow(beamsShadow, 2, WATER_SH)
    for (const b of beamsShadow) { paint(b, darker(WOOD(), 0.2), 0.3); outline(b, 0.9, { noext: true, flat: true }) }
    const missing = [3, 4, 9, 14, 15, 16, 21]
    for (let i = 0; i < n; i++) {
      if (missing.some((m) => Math.round((m * 24) / n) === i)) continue
      const y1 = 50 - i * pw, y0 = y1 - pw * 0.97
      let q
      if (i >= n - 2) q = [[-hw, y1], [-hw + 2, y0 + jt(0.6)], [-hw + 6, y0 + 1.5], [-2 + jt(1), y1 - 1], [3, y0 + 2], [hw - 3, y0 + 0.5], [hw, y1]]
      else q = [[-hw + (i % 5 === 0 ? 1.5 : 0), y1 + jt(0.1)], [hw - (i % 7 === 3 ? 2 : 0), y1 + jt(0.1)], [hw - (i % 7 === 3 ? 2 : 0), y0], [-hw + (i % 5 === 0 ? 1.5 : 0), y0]]
      castShadow([q], 2.4, WATER_SH); paint(q, DECK(), 0.05 + (i % 3) * 0.05)
      if (det >= 2 && i % 4 === 1) { sg(-hw + 2, (y0 + y1) / 2, -hw + 2 + rr(3, 8), (y0 + y1) / 2 + jt(0.3)); flush(0.4) }
      outline(q, 0.9, { noext: true, taper: 0.2 })
    }
    void body
    pilesAlong([-hw - 0.9, 44], [-hw - 0.9, -22], 11, 1.6); pilesAlong([hw + 0.9, 44], [hw + 0.9, -11], 11, 1.6)
    leaningPile(hw + 1, -24, 1.6, 3.5, 2.6); leaningPile(-hw - 1, -34, 1.6, -3, 3.2)
    pile(hw + 0.9, -36, 1.5, { col: WATER_SH }); pile(-hw - 0.9, -45, 1.5, { col: WATER_SH }); pile(hw + 1.6, -46, 1.4, { col: WATER_SH })
    // boards adrift
    for (const [x, y, a] of [[-14, -40, 0.5], [6, -42, -0.3], [16, -16, 1.2]]) { const q = rotRect(x, y, pw * 0.8, 11, a); castShadow([q], 0.8, WATER_SH); paint(q, DECK(), 0.1); outline(q, 0.8, { noext: true, flat: true }) }
    if (det >= 1) { const q = [[-hw + 0.5, -34], [-hw + 1.8, -40], [-hw + 2.4, -34]]; paint(q, darker(WOOD(), 0.2), 0.3); outline(q, 0.8, { noext: true, flat: true }) }
  }
  /** 7: floating pontoons chained end to end, a gangway from the shore and lines out to buoys. */
  function pier7() {
    const rafts = [[0, 28, 0.04], [1, 7, -0.06], [-1, -14, 0.05], [2, -36, -0.04]]
    const gw = rect(-4, 39, 4, 50)
    // buoy lines first, under everything
    const buoy = (x, y) => { const c = oval(x, y, 1.8, 1.8, 8); castShadow([c], 1, WATER_SH); fillPoly(c, COL ? mix(T.roof, PAPER, 0.3) : PAPER); loop(c, 0.9); if (det >= 1) fillPoly(oval(x, y, 0.5, 0.5, 6), INK) }
    mooring([-5, -44], [-20, -49], 1.2); mooring([9, -44], [24, -48], 1.2)
    buoy(-20, -49); buoy(24, -48)
    const polys = rafts.map(([cx, cy, a]) => rotRect(cx, cy, 16, 18, a))
    ripples([].concat(...polys), det >= 1 ? 9 : 4, 8, 46)
    polys.forEach((p, i) => { const a = rafts[i][2], c = cos(a), s = sin(a); deck(p, { noRipples: true, h: 1.5, d: [-s, c], pw: Math.max(K(5), 2.6), w: 1.4 }) })
    deck(gw, { noRipples: true, h: 1.5, w: 1.3 })
    // chains between the rafts
    for (let i = 0; i < 3; i++) { const [ax, ay, aa] = rafts[i], [bx, by, ba] = rafts[i + 1]; const fa = frameAt(ax, ay, aa), fb = frameAt(bx, by, ba); for (const s of [-5, 5]) { const p = fa(s, -9), q = fb(s, 9); ln(p, q, 1.1, { taper: 0.1, wob: 0.3 }); if (det >= 2) { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; post(m[0], m[1], 0.7) } } }
    ln([-3, 39.5], [-3, 37], 1.0, { taper: 0.1 }); ln([3, 39.5], [3, 37], 1.0, { taper: 0.1 })
    if (det >= 1) { barrelS(-3, 26, 2.8); crateS(4, -37, 6, 5, 0.2) }
    bollard(-3, 48, 1.6); bollard(3, 48, 1.6)
  }
  reg('ct-pier', 'Pier', [pier0, pier1, pier2, pier3, pier4, pier5, pier6, pier7])

  /* =====================================================================================================================
     SHIP: sailing ships seen from above, bow to +x
     ===================================================================================================================== */
  const COG = [[-50, 5], [-48, 10], [-42, 13.5], [-30, 15.5], [-10, 16], [10, 15.5], [26, 13], [38, 9], [46, 4.5], [50, 0]]
  const CARAVEL = [[-50, 4], [-47, 8.5], [-40, 11.5], [-28, 13.5], [-8, 14], [12, 13.5], [28, 11], [40, 7], [47, 3], [50, 0]]
  const GALLEON = [[-50, 7], [-48, 10.5], [-42, 13.5], [-30, 15.5], [-12, 16.5], [8, 16], [24, 14], [36, 10.5], [44, 6], [48, 2.5], [50, 0]]
  const LONG = [[-50, 0], [-47, 2.5], [-40, 5.5], [-28, 8], [-10, 9.2], [10, 9.2], [28, 8], [40, 5.5], [47, 2.5], [50, 0]]
  const GALLEY = [[-50, 0], [-47, 3], [-40, 6], [-26, 8], [-6, 9], [14, 9], [30, 8], [40, 6], [46, 3.5], [48, 2]]
  const MERCH = [[-50, 6], [-48, 10], [-42, 13.5], [-30, 15.5], [-10, 16], [10, 15.5], [26, 13], [38, 9], [46, 4.5], [50, 0]]

  /** 0: cog: one mast with the square sail furled, castles fore and aft, stern rudder. */
  function ship0() {
    const D = dense(COG)
    rudder(D, -50)
    bowsprit(48, 9, -0.1)
    hull(D, { gun: 3.4 })
    castle(D, -48, -24, { h: 4 }); castle(D, 30, 49, { h: 3.5, ins: 2 })
    hatchway(-9, -5, 3, 5)
    shrouds(D, 4, 3, 4)
    mast(4, 0, 2.6, 18)
    yardFurled(4, 0, 22)
    if (det >= 1) pennant(4, 0, 12, 0.25)
    if (det >= 1) { barrelS(-16, -6, 2.6); barrelS(-17, 5, 2.4) }
  }
  /** 1: caravel: three masts carrying lateen sails, a low aft deck. */
  function ship1() {
    const D = dense(CARAVEL)
    rudder(D, -50)
    hull(D, { gun: 3 })
    castle(D, -48, -30, { h: 3, ins: 1.8 })
    hatchway(-4, -4, 6, 4)
    shrouds(D, 16, 2, 4); shrouds(D, -10, 2, 4)
    lateen(16, 0, 40, -1); lateen(-12, 0, 32, -1); lateen(-36, 0, 22, -1)
    mast(16, 0, 2.4, 14); mast(-12, 0, 2.2, 13); mast(-36, 0, 1.9, 11)
    if (det >= 1) pennant(16, 0, 11, 0.2)
  }
  /** 2: galleon under sail: three masts, square courses and topsails bellied forward, a lateen mizzen, high stern. */
  function ship2() {
    const D = dense(GALLEON)
    rudder(D, -50)
    bowsprit(48, 12, -0.05)
    hull(D, { gun: 3.4 })
    castle(D, -48, -22, { h: 4.5 }); castle(D, -48, -36, { h: 7, ins: 2.6 }); castle(D, 32, 49, { h: 3.5, ins: 2 })
    hatchway(-6, -5, 4, 5)
    shrouds(D, 22, 3, 4); shrouds(D, -4, 3, 4)
    // spritsail under the bowsprit, courses, topsails
    squareSail(54, 0, 7, 4)
    squareSail(22, 0, 23, 13); squareSail(24, 0, 15, 8)
    squareSail(-4, 0, 26, 15); squareSail(-2, 0, 17, 9)
    lateen(-30, 0, 24, -1)
    mast(22, 0, 2.6, 18); mast(-4, 0, 2.8, 20); mast(-30, 0, 2.2, 14)
    if (det >= 1) { pennant(-4, 0, 14, 0.25); pennant(22, 0, 10, 0.3, COL ? mix(T.water, '#4e6478', 0.55) : undefined) }
  }
  /** 3: longship: double-ended, oars out, shields along the rails, a steering oar and a carved prow. */
  function ship3() {
    const D = dense(LONG)
    const xs = []; for (let x = -34; x <= 30; x += 8) xs.push(x)
    oarsOf(D, xs, -1, 22); oarsOf(D, xs, 1, 22)
    // steering oar on the starboard quarter
    ln([-40, 7], [-46, 16], 1.3, { taper: 0.2 }); const sb = oval(0, 0, 3.2, 1.1, 8).map((p) => frameAt(-47.5, 18.5, 1.0)(p[0], p[1])); fillPoly(sb, COL ? mix(WOOD(), PAPER, 0.35) : PAPER); loop(sb, 0.8, { flat: true })
    hull(D, { gun: 2.2 })
    if (det >= 1) { ln([-44, 0], [44, 0], 0.8, { taper: 0.2, wob: 0.1 }) }
    shields(D, -36, 34, 7, 2.6)
    // prow and stern posts curling up
    for (const s of [-1, 1]) { const c = oval(s * 51, 0, 2.2, 2.2, 10); castShadow([c], 2, WATER_SH); fillPoly(c, COL ? mix(WOOD(), PAPER, 0.2) : PAPER); loop(c, 1.1); if (det >= 1) { pl([[s * 52, -1.5], [s * 54.5, -1], [s * 55.5, 1.5]], 1.0, { taper: 0.4 }) } }
    mast(-2, 0, 2.2, 14)
    yardFurled(-2, 0, 14, { sw: Math.max(1.8, K(2)) })
  }
  /** 4: war galley: a ram, banks of oars, a gangway down the middle and an awning over the stern. */
  function ship4() {
    const D = dense(GALLEY)
    const outer = []; for (let x = -36; x <= 32; x += 5) outer.push(x)
    const inner = []; for (let x = -33.5; x <= 32; x += 5) inner.push(x)
    oarsOf(D, outer, -1, 19, { blade: 3.6 }); oarsOf(D, outer, 1, 19, { blade: 3.6 })
    oarsOf(D, inner, -1, 13, { blade: 3, rake: 0.2 }); oarsOf(D, inner, 1, 13, { blade: 3, rake: 0.2 })
    // the ram
    const ram = [[47, -2.2], [58, -0.8], [59, 0], [58, 0.8], [47, 2.2]]
    castShadow([ram], 2.5, WATER_SH); paint(ram, darker(STONE(), 0.3), 0.4); outline(ram, 1.1, { noext: true })
    hull(D, { gun: 2.2 })
    // gangway
    const gw = rect(-38, -1.8, 38, 1.8); paint(gw, WOOD(), 0.15); if (det >= 1) { const g = Math.max(K(4), 2.2); for (let x = -36; x < 38; x += g) sg(x, -1.8, x + jt(0.2), 1.8); flush(0.4) } outline(gw, 0.8, { noext: true, flat: true })
    // fighting platform at the bow, awning aft
    castle(D, 34, 47, { h: 3.5, ins: 1.4, rail: false })
    const aw = slice(D, 0.6, -47, -30); castShadow([aw], 4, WATER_SH); paint(aw, mix(T.roof, T.sand, 0.4), 0.15); if (det >= 1) hatchIn(aw, 0.2, Math.max(K(4), 2.4), 0.45); outline(aw, 1.1, { noext: true })
    // curled sternpost
    pl([[-50, 0], [-54, -0.5], [-56, -3], [-54.5, -5]], 1.4, { taper: 0.3 })
    for (const s of [-1, 1]) { ln([-42, s * 5], [-50, s * 10], 1.2, { taper: 0.2 }); const sb = oval(0, 0, 3, 1, 8).map((p) => frameAt(-51.5, s * 11.5, s * 0.6)(p[0], p[1])); fillPoly(sb, COL ? mix(WOOD(), PAPER, 0.35) : PAPER); loop(sb, 0.8, { flat: true }) }
    mast(-6, 0, 2.2, 14)
    yardFurled(-6, 0, 18, { ang: 1.25, sw: Math.max(1.8, K(2)) })
  }
  /** 5: small fishing boat (drawn smaller in its box): one mast, sail furled on the boom, nets heaped aft. */
  function ship5() {
    const b = boat(0, 0, 60, 20, 0, { st: SKIFF, thwarts: [-0.3, 0.12], bowDeck: true, h: 2.5 })
    const f = b.f
    rudder(b.D, -30)
    net(b, -0.22, 11, 9)
    if (det >= 1) { for (const [x, y] of [[-8, -3], [-6, 4], [-10, 5]]) { const c = oval(x, y, 1.5, 1.5, 8); fillPoly(c, COL ? mix(T.sand, PAPER, 0.3) : PAPER); loop(c, 0.7, { flat: true }) } }
    const boom = rounded([f(-10, -1.4), f(22, -1.4), f(22, 1.4), f(-10, 1.4)], 1.4, 3)
    castShadow([boom], 2); paint(boom, CANVAS(), 0.2); if (det >= 1) { for (let x = -7; x < 21; x += Math.max(K(5), 3.5)) sg(x, -1.8, x + jt(0.2), 1.8); flush(0.5) } outline(boom, 0.8, { noext: true })
    mast(4, 0, 1.8, 10)
    if (det >= 1) { mooring(f(31, 0), f(44, -6), 1); const c = oval(0, 0, 1.6, 1.6, 8).map((p) => f(p[0] + 45, p[1] - 6.5)); castShadow([c], 1, WATER_SH); fillPoly(c, COL ? mix(T.roof, PAPER, 0.3) : PAPER); loop(c, 0.9) }
  }
  /** 6: merchant ship at anchor: sails furled on two masts, a hatch of cargo, the ship's boat alongside, cable out ahead. */
  function ship6() {
    const D = dense(MERCH)
    mooring([49, -1], [60, -9], 2)
    const bc = oval(60, -9, 1.9, 1.9, 8); castShadow([bc], 1, WATER_SH); fillPoly(bc, COL ? mix(T.roof, PAPER, 0.3) : PAPER); loop(bc, 0.9)
    rudder(D, -50)
    bowsprit(48, 9, -0.08)
    hull(D, { gun: 3.2 })
    castle(D, -48, -28, { h: 3.5, ins: 1.8 })
    hatchway(-8, -5.5, 6, 5.5)
    if (det >= 1) { barrelS(14, -7, 2.6); barrelS(18, -2, 2.5); crateS(14, 6, 6, 5, 0.2) }
    shrouds(D, 20, 2, 4); shrouds(D, -16, 2, 4)
    mast(20, 0, 2.5, 16); mast(-16, 0, 2.5, 16)
    yardFurled(20, 0, 19); yardFurled(-16, 0, 21)
    // the boat lying alongside to port, painter made fast to the rail
    const b = boat(2, -24, 30, 10, 0.03, { thwarts: [-0.25, 0.15], h: 1.5 })
    oarsIn(b)
    mooring(b.f(15, 0), [18, -15.2], 0.8)
    if (det >= 1) pennant(-16, 0, 10, 0.3)
  }
  /** 7: wreck: the bow lifted and listing, the stern half awash with its ribs showing, a mast down across the water. */
  function ship7() {
    const D = dense(COG)
    // the drowned stern half: hull sides awash, deck gone, frames showing through the water
    const aft = slice(D, 0, -50, -4), aftIn = slice(D, 3, -50, -4)
    ripples(aft, det >= 1 ? 8 : 4, 8)
    castShadow([aft], 1.2, WATER_SH)
    paintRing([aft, aftIn], COL ? mix(TAR(), T.water, 0.3) : PAPER, 0.2)
    fillPoly(aftIn, COL ? mix(T.water, '#2c4a52', 0.12) : PAPER)
    ctx.save(); path(aftIn); ctx.clip()
    hatchIn(aftIn, 0.0, Math.max(K(3.4), 1.6), 0.4, { keep: 0.55, color: COL ? mix(T.water, '#2c4a52', 0.6) : INK })
    for (let x = -44; x < -4; x += Math.max(K(6), 3.4)) { const hw = hwAt(D, x) - 2; ctx.beginPath(); ctx.moveTo(x, -hw); ctx.quadraticCurveTo(x + 1, 0, x, hw); ctx.lineWidth = W(0.8); ctx.strokeStyle = INK; ctx.stroke() }
    ln([-47, 0], [-5, 0], 1.2, { taper: 0.2 })
    if (det >= 1) innerShade(aftIn, 2.2, { col: 'rgba(20,35,40,.2)' })
    ctx.restore()
    loop(aftIn, 0.8, { flat: true, wob: 0.5 })
    loop(aft, 1.2, { wob: 0.6 })
    // the break: splintered ends
    const splinter = [[-4, -15], [-1, -11], [-5, -7], [0, -3], [-3, 2], [1, 6], [-4, 10], [-1, 15]]
    // the forward half, still afloat but down by the stern
    const fwdST = COG.filter((p) => p[0] >= -10).map((p) => [p[0], p[1]])
    fwdST.unshift([-11, 16]); const Df = dense(fwdST)
    const fwd = slice(Df, 0, -6, 50)
    const fwdPts = fwd.map((p) => { const a = 0.14, c = cos(a), s = sin(a); return [20 + (p[0] - 20) * c - p[1] * s, (p[0] - 20) * s + p[1] * c] }), spl = splinter.map((p) => { const a = 0.14, c = cos(a), s = sin(a); return [20 + (p[0] - 20) * c - p[1] * s, (p[0] - 20) * s + p[1] * c] })
    const body = spl.concat(fwdPts.filter((p) => p[0] > spl[spl.length - 1][0] - 1))
    ripples(body, det >= 1 ? 6 : 3, 8)
    castShadow([body], 4, WATER_SH); paint(body, TAR(), 0.3)
    const inn = slice(Df, 3.2, 2, 50).map((p) => { const a = 0.14, c = cos(a), s = sin(a); return [20 + (p[0] - 20) * c - p[1] * s, (p[0] - 20) * s + p[1] * c] })
    paint(inn, DECK(), 0.1)
    if (det >= 1) { plankTex(inn, [cos(0.14), sin(0.14)], { pw: Math.max(K(5), 2.4), w: 0.42 }); innerShade(inn, 2.8) }
    loop(inn, 0.8, { flat: true })
    outline(body, 1.5, { noext: true, wob: 0.4 })
    // forecastle, broken mast lying across, loose timbers
    const fc = slice(Df, 2, 34, 50).map((p) => { const a = 0.14, c = cos(a), s = sin(a); return [20 + (p[0] - 20) * c - p[1] * s, (p[0] - 20) * s + p[1] * c] })
    castShadow([fc], 3, WATER_SH); paint(fc, darker(DECK(), 0.12), 0.1); outline(fc, 1.1, { noext: true })
    const mastBar = rotRect(-14, 14, 44, 2.6, -0.55); castShadow([mastBar], 1.5, WATER_SH); paint(mastBar, WOOD(), 0.2); outline(mastBar, 1.0, { noext: true })
    const stump = oval(10, -1, 2.4, 2.4, 10); fillPoly(stump, COL ? mix(WOOD(), PAPER, 0.15) : PAPER); loop(stump, 1.0); if (det >= 1) { sg(8.5, -2, 11.5, 0.5); sg(8.5, 0.5, 11.5, -2); flush(0.6) }
    for (const [x, y, a] of [[-30, -22, 0.4], [-44, 18, -0.2], [30, 22, 1.0]]) { const q = rotRect(x, y, 10, 2.2, a); castShadow([q], 0.8, WATER_SH); paint(q, DECK(), 0.1); outline(q, 0.8, { noext: true, flat: true }) }
    if (det >= 1) { const sail = oval(-24, 20, 9, 5, 12, 0.18); paint(sail, COL ? mix(T.water, CANVAS(), 0.5) : PAPER, 0, 0.5); hatchIn(sail, 0.1, Math.max(K(3), 1.5), 0.4, { keep: 0.6 }); loop(sail, 0.8, { flat: true, wob: 0.8 }) }
  }
  reg('ct-ship', 'Ship', [ship0, ship1, ship2, ship3, ship4, ship5, ship6, ship7])

  /* =====================================================================================================================
     FIELDS: a patchwork of farmland, flat on the ground (no cast shadow of its own)
     ===================================================================================================================== */
  /** Clip to the outer boundary while the plots are laid in. */
  function within(outer, fn) { ctx.save(); path(outer); ctx.clip(); fn(); ctx.restore() }
  const seam = (a, b) => ln(a, b, 0.7, { taper: 0.2, wob: 0.5 })

  /** 0: medieval strip fields: two furlongs of long narrow strips, ploughed, sown and fallow by turns, a headland between. */
  function fields0() {
    const outer = wobbleRect(-50, -40, 50, 40, 1.6, 0.4)
    within(outer, () => {
      plot(rect(-60, -50, 60, 50), 'pasture')
      // west furlong: strips running north-south
      const kinds = ['plough', 'crop', 'plough', 'fallow', 'plough', 'crop', 'stubble', 'plough']
      let x = -52
      for (let i = 0; i < 8; i++) { const w = [6.5, 6, 7, 5.5, 6.5, 6, 6.5, 6][i], p = rect(x, -50, x + w, 50); plot(p, kinds[i], (i % 3) * 0.05); if (kinds[i] === 'plough') plough(p, PI / 2 + 0.02); else if (kinds[i] === 'crop') crop(p, 1.45); else if (kinds[i] === 'stubble') stubble(p); else pasture(p, 0.2); x += w; if (i < 7) seam([x, -50], [x + jt(0.4), 50]) }
      const hx0 = x
      // east furlong: strips running east-west
      const kinds2 = ['crop', 'plough', 'plough', 'fallow', 'crop', 'plough', 'stubble', 'plough', 'crop', 'fallow', 'plough']
      let y = -50
      for (let i = 0; i < 11; i++) { const h = [7, 7.5, 6.5, 7, 7.5, 8, 7, 7.5, 7, 6.5, 8][i], p = rect(hx0 + 4, y, 60, y + h); plot(p, kinds2[i], (i % 2) * 0.06); if (kinds2[i] === 'plough') plough(p, 0.015); else if (kinds2[i] === 'crop') crop(p, -0.2); else if (kinds2[i] === 'stubble') stubble(p); else pasture(p, 0.2); y += h; if (i < 10) seam([hx0 + 4, y], [60, y + jt(0.4)]) }
      // the headland path between the furlongs
      const hd = rect(hx0, -50, hx0 + 4, 50); plot(hd, 'dirt')
      track([[hx0 + 2, -50], [hx0 + 1.7, -10], [hx0 + 2.3, 20], [hx0 + 2, 50]], 2.2)
    })
    loop(outer, 1.2, { flat: true, wob: 0.5 })
    if (det >= 1) { treeS(-50, 41, 3.4); treeS(13, -41, 3) }
  }
  /** 1: square patchwork: hedged plots of pasture, plough and crop, a few trees in the hedges, a gate between two. */
  function fields1() {
    const outer = wobbleRect(-50, -45, 50, 45, 1.8, 1.3)
    const P1 = [[-60, -55], [-18, -55], [-18, -8], [-60, -8]], P2 = [[-18, -55], [22, -55], [22, -12], [-18, -8]], P3 = [[22, -55], [60, -55], [60, 6], [22, -12]]
    const P4 = [[-60, -8], [-18, -8], [-14, 16], [-14, 55], [-60, 55]], P5 = [[-18, -8], [22, -12], [24, 16], [-14, 16]], P6 = [[-14, 16], [24, 16], [26, 55], [-14, 55]], P7 = [[22, -12], [60, 6], [60, 55], [26, 55], [24, 16]]
    within(outer, () => {
      plot(P1, 'pasture'); pasture(P1)
      plot(P2, 'plough'); plough(P2, 0.08)
      plot(P3, 'crop', 0.05); crop(P3, 1.3)
      plot(P4, 'stubble'); stubble(P4)
      plot(P5, 'fallow'); pasture(P5, 0.15); if (det >= 1) stippleIn(P5, 0.5, K(0.6))
      plot(P6, 'plough', 0.08); plough(P6, 1.5)
      plot(P7, 'pasture', 0.04); pasture(P7)
    })
    hedge([[-18, -46], [-18, -8], [-14, 16], [-14, 46]], 3); hedge([[22, -46], [22, -12], [24, 16], [26, 46]], 3)
    hedge([[-49, -8], [-18, -8]], 2.8); hedge([[-18, -8], [-4, -9.5]], 2.8); hedge([[6, -10.5], [22, -12], [49, 6]], 2.8); hedge([[-14, 16], [24, 16]], 2.8)
    hedge(outer, 3.2, true)
    gate(1, -10, 9, -0.06)
    treeS(-18, -27, 4.2); treeS(22, -32, 3.6); treeS(-14, 30, 4.6); treeS(36, 7, 3.4); treeS(-4, 16, 3.2); treeS(48, -44, 3.8)
  }
  /** 2: ploughed and fallow: two fenced fields, a gate and a track, stones rolled to the edge of the fallow. */
  function fields2() {
    const outer = wobbleRect(-50, -35, 50, 35, 1.4, 2.1)
    const PA = [[-60, -45], [-4, -45], [-4, 45], [-60, 45]], PB = [[-4, -45], [60, -45], [60, 45], [-4, 45]]
    within(outer, () => {
      plot(PA, 'plough'); plough(PA, 0.03)
      // headland furrows round the ploughed field at right angles
      if (det >= 2) { plough([[-50, -35], [-46, -35], [-46, 35], [-50, 35]], PI / 2); plough([[-8, -35], [-4, -35], [-4, 35], [-8, 35]], PI / 2) }
      plot(PB, 'fallow'); pasture(PB, 0.45); if (det >= 1) stippleIn(PB, 0.5, K(0.6))
      track([[20, 36], [19, 24], [16, 10], [8, -4], [2, -20]], 2.8)
    })
    const fo = { gap: 7 }
    fenceSeg([-50, -35], [50, -35], fo); fenceSeg([50, -35], [50, 35], fo); fenceSeg([-50, -35], [-50, 35], fo)
    fenceSeg([-50, 35], [15, 35], fo); fenceSeg([25, 35], [50, 35], fo)
    fenceSeg([-4, -35], [-4, 35], fo)
    gate(20, 35.3, 9, -0.15)
    boulder(44, -28, 2.6, 1.8, 0.3); boulder(40, -24, 1.8, 1.4, 1.1); boulder(46, 10, 2.2, 1.6, -0.4)
    if (det >= 1) treeS(-50, -36, 3.6)
  }
  /** 3: orchard: rows of small round trees in grass, a wall round it, a cart gap on the south side. */
  function fields3() {
    const outer = wobbleRect(-50, -38, 50, 38, 1.2, 3.0)
    within(outer, () => { plot(rect(-60, -50, 60, 50), 'orchard'); pasture(rect(-60, -50, 60, 50), 0.25) })
    wall(outer.slice(), 2.2, true)
    const R = 3.6
    for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) {
      const x = -42 + i * 12 + ((j % 2) * 2.5) + sin(i * 2.1 + j) * 0.8, y = -30 + j * 12 + cos(i + j * 1.7) * 0.8
      if (j === 3 && i === 4) continue
      treeS(x, y, R * (0.88 + 0.22 * Math.abs(sin(i * 3.1 + j * 1.3))))
    }
    gate(18, 38, 8, 0)
    track([[18, 38], [19, 26], [21, 14]], 2.6)
  }
  /** 4: vineyard: close rows of vines on their posts, a path up the middle, a low wall round it. */
  function fields4() {
    const outer = wobbleRect(-50, -35, 50, 35, 1.2, 4.2)
    within(outer, () => {
      plot(rect(-60, -45, 60, 45), 'vine')
      const gapY = 4.6, vineW = Math.max(K(2.2), 1.3), vineCol = COL ? mix(T.forest, T.grass, 0.3) : null
      for (let y = -29; y <= 30; y += gapY) {
        for (const [xa, xb] of [[-46, -3], [3, 46]]) {
          const band = rect(xa, y - vineW / 2, xb, y + vineW / 2)
          if (COL) { ctx.save(); ctx.globalAlpha = 0.5; fillPoly(band, vineCol); ctx.restore() }
          // the row itself: a wavy stroke, posts along it
          const pts = []; for (let x = xa; x <= xb; x += 4) pts.push([x, y + sin(x * 0.8 + y) * 0.25])
          pl(pts, 0.9, { taper: 0.1, wob: 0.35 })
          if (det >= 1) { for (let x = xa; x <= xb + 0.1; x += 8.6) post(x, y, 0.7) }
          if (det >= 2) { for (let x = xa + 1.5; x < xb; x += 2.3) { const s = (x * 7) % 2 < 1 ? -1 : 1; sg(x, y, x + 0.6, y + s * 1.1) } flush(0.4) }
        }
      }
      track([[0, -40], [0.3, -10], [-0.3, 15], [0, 40]], 3)
    })
    wall(outer.slice(), 2.0, true)
    gate(0, 35, 6, 0)
    if (det >= 1) treeS(-50, 36, 3.2)
  }
  /** 5: wheat: stooks standing in rows on the cut stubble, a strip still standing, two ricks by the gate. */
  function fields5() {
    const outer = wobbleRect(-50, -42, 50, 42, 1.6, 5.1)
    const PA = [[-60, -52], [-8, -52], [-8, 52], [-60, 52]], PB = [[-8, -52], [12, -52], [12, 52], [-8, 52]], PC = [[12, -52], [60, -52], [60, 52], [12, 52]]
    within(outer, () => {
      plot(PA, 'stubble'); stubble(PA, 1.4)
      plot(PB, 'stubble', 0.18); crop(PB, 1.42); if (det >= 2) hatchIn(PB, 1.42, Math.max(K(2.4), 0.9), 0.3, { keep: 0.4 })
      plot(PC, 'stubble', 0.04); stubble(PC, 1.4)
      seam([-8, -52], [-8, 52]); seam([12, -52], [12, 52])
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) stook(-45 + i * 8.6 + (j % 2) * 2 + sin(i + j * 2) * 0.6, -34 + j * 14 + cos(i * 2 + j) * 0.7, 2.4)
      for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) stook(20 + i * 9 + (j % 2) * 2.5 + sin(i * 3 + j) * 0.6, -32 + j * 11 + cos(i + j * 2) * 0.7, 2.4)
      track([[48, 42], [40, 30], [30, 22], [20, 20], [14, 12]], 2.8)
    })
    hedge(outer, 2.8, true)
    haystack(40, 22, 6); haystack(30, 34, 4.8)
    if (det >= 1) { treeS(-50, 0, 3.6); treeS(50, -24, 3.4) }
  }
  /** 6: upland fields walled in dry stone: rough pasture, a sheepfold, boulders and a stile. */
  function fields6() {
    const outer = wobbleRect(-50, -45, 50, 45, 1.8, 6.3)
    const PA = [[-60, -55], [-10, -55], [-10, -15], [-60, -15]], PB = [[-60, -15], [-10, -15], [-10, 10], [-60, 10]], PC = [[-60, 10], [-10, 10], [-10, 55], [-60, 55]], PD = [[-10, -55], [60, -55], [60, 10], [-10, 10]], PE = [[-10, 10], [60, 10], [60, 55], [-10, 55]]
    within(outer, () => {
      plot(PA, 'pasture'); pasture(PA, 0.5)
      plot(PB, 'plough'); plough(PB, 0.02)
      plot(PC, 'pasture', 0.06); pasture(PC, 0.5)
      plot(PD, 'fallow'); pasture(PD, 0.4); if (det >= 1) stippleIn(PD, 0.5, K(0.6))
      plot(PE, 'crop'); crop(PE, 1.35)
    })
    wall([[-10, -45], [-10, 45]]); wall([[-49, -15], [-10, -15]]); wall([[-49, 10], [-10, 10]]); wall([[-10, 10], [49, 10]])
    wall(outer.slice(), 2.4, true)
    // sheepfold with a gap
    const fold = oval(28, -22, 10, 8, 20, 0.04).filter((p, i) => i < 15 || i > 17)
    wall(fold, 2.0, false)
    boulder(-30, -36, 3, 2.2, 0.4); boulder(-36, 30, 2.4, 1.8, 1.2); boulder(44, -42, 2, 1.6, -0.5); boulder(-24, 36, 1.6, 1.3, 0.2)
    if (det >= 1) { treeS(-10, 44, 3.6); treeS(10, 10, 3.2) }
    if (det >= 2) { sg(-12.5, -30, -7.5, -30); sg(-12.5, -28, -7.5, -28); flush(0.7) }
  }
  /** 7: a farmstead in one corner: house, barn and yard behind a fence, a rick and a woodpile, fields round it. */
  function fields7() {
    const outer = wobbleRect(-50, -43, 50, 43, 1.6, 7.7)
    const yard = [[-60, 8], [-12, 8], [-12, 53], [-60, 53]], PA = [[-60, -53], [-12, -53], [-12, 8], [-60, 8]], PB = [[-12, -53], [60, -53], [60, -4], [-12, -4]], PC = [[-12, -4], [60, -4], [60, 53], [-12, 53]]
    within(outer, () => {
      plot(PA, 'pasture'); pasture(PA, 0.4)
      plot(PB, 'plough'); plough(PB, 0.04)
      plot(PC, 'crop'); crop(PC, 1.4)
      plot(yard, 'dirt'); if (det >= 1) stippleIn(yard, 0.8, K(0.6))
      track([[-12, 28], [4, 26], [20, 24], [36, 22], [52, 22]], 3)
    })
    hedge([[-12, -46], [-12, 8]], 3); hedge([[-12, -4], [49, -4]], 2.8)
    hedge(outer, 3, true)
    const fo = { gap: 6.5 }
    fenceSeg([-50, 8], [-12, 8], fo); fenceSeg([-12, 8], [-12, 22], fo); fenceSeg([-12, 34], [-12, 43], fo)
    gate(-12, 28, 10, PI / 2)
    houseS(-46, 12, -22, 23, 'x', 'thatch')
    houseS(-30, 28, -16, 42, 'y', 'plank')
    haystack(-40, 36, 4.6)
    if (det >= 1) { const wp = rect(-48, 28, -40, 32); castShadow([wp], 1.4); paint(wp, WOOD(), 0.25); for (let i = 1; i < 3; i++) ln([-48, 28 + (4 * i) / 3], [-40, 28 + (4 * i) / 3], 0.6, { taper: 0.3 }); outline(wp, 1.0, { noext: true }) }
    treeS(-47, 2, 3.8); treeS(-18, 44, 4); treeS(30, -4, 3.4)
  }
  reg('ct-fields', 'Fields', [fields0, fields1, fields2, fields3, fields4, fields5, fields6, fields7])

  /* =====================================================================================================================
     MOORED BOATS: a cluster of small boats tied up side by side, bows to -y, along a quay at +y
     ===================================================================================================================== */
  const UP = -PI / 2
  /** Boat with its stern at y = sy, moored to a bollard on the quay line. */
  function moored(cx, sy, L, B, o) {
    o = o || {}
    const a = UP + (o.tilt || 0)
    return boat(cx - (L / 2) * sin(o.tilt || 0), sy - L / 2, L, B, a, Object.assign({ maxY: 47 }, o))
  }
  const quayPosts = (xs) => { for (const x of xs) bollard(x, 48.5, 1.6) }
  const tie = (b, bx, sag) => mooring(b.f(-b.L / 2 - 0.5, 0), [bx, 47.5], sag == null ? 1 : sag)

  /** 0: three rowboats in a neat row. */
  function boats0() {
    quayPosts([-18, 0, 18])
    const b1 = moored(-18, 40, 56, 17, { thwarts: [-0.28, 0.08] }), b2 = moored(0, 38, 60, 18, { thwarts: [-0.3, 0.05, 0.3] }), b3 = moored(18, 41, 54, 16.5)
    oarsIn(b1); oarsIn(b3)
    tie(b1, -18); tie(b2, 0); tie(b3, 18)
  }
  /** 1: two boats, one with its oars still out. */
  function boats1() {
    quayPosts([-14, 14])
    const b1 = moored(-14, 36, 62, 19, { thwarts: [-0.3, 0.05, 0.32], tilt: 0.05 })
    oarsOut(b1, 0.05, 20)
    const b2 = moored(16, 42, 50, 16, { tilt: -0.04, st: SKIFF, bowDeck: true })
    oarsIn(b2)
    tie(b1, -14); tie(b2, 14)
  }
  /** 2: five skiffs packed tight, a little askew. */
  function boats2() {
    quayPosts([-32, -16, 0, 16, 32])
    const L = [48, 52, 46, 50, 47], B = [13.5, 14.5, 13, 14, 13.5], T2 = [0.06, -0.03, 0.04, -0.05, 0.02], Y = [42, 38, 43, 40, 41]
    const bs = []
    for (let i = 0; i < 5; i++) bs.push(moored(-32 + i * 16, Y[i], L[i], B[i], { st: i % 2 ? SKIFF : RB, tilt: T2[i], thwarts: [-0.26, 0.12], bowDeck: i % 2 === 1 }))
    oarsIn(bs[1]); oarsIn(bs[3])
    bs.forEach((b, i) => tie(b, -32 + i * 16))
  }
  /** 3: a punt and two rowboats. */
  function boats3() {
    quayPosts([-22, 0, 20])
    const p = moored(-22, 40, 54, 15, { st: PUNT, thwarts: [-0.35], gun: 1.6 })
    ln(p.f(-20, 2), p.f(24, 0), 1.4, { taper: 0.15, wob: 0.3 })
    const b2 = moored(0, 37, 60, 18, { thwarts: [-0.3, 0.04, 0.3] }), b3 = moored(20, 42, 52, 16, { tilt: -0.06 })
    oarsIn(b2)
    if (det >= 1) net(b3, 0.1, 9, 7)
    tie(p, -22); tie(b2, 0); tie(b3, 20)
  }
  /** 4: four boats fanned out on the tide. */
  function boats4() {
    quayPosts([-27, -9, 9, 27])
    const bs = [moored(-27, 40, 54, 16, { tilt: 0.16 }), moored(-9, 38, 58, 17.5, { tilt: 0.07, thwarts: [-0.3, 0.05, 0.3] }), moored(9, 39, 56, 17, { tilt: -0.05 }), moored(27, 42, 50, 15.5, { tilt: -0.14, st: SKIFF, bowDeck: true })]
    oarsIn(bs[1]); oarsIn(bs[2])
    if (det >= 1) { barrelS(...bs[0].f(-4, 0), 2.6); crateS(...bs[3].f(2, 0), 5.5, 5, UP - 0.14) }
    bs.forEach((b, i) => tie(b, -27 + i * 18, 1.5))
  }
  /** 5: two boats rafted together with a third outside, one under a tarpaulin. */
  function boats5() {
    quayPosts([-10, 12])
    const b1 = moored(-16, 38, 58, 17.5, { thwarts: [-0.3, 0.05] }), b2 = moored(1, 39, 56, 17, { thwarts: [-0.28, 0.1] }), b3 = moored(18, 41, 50, 15.5, { tilt: -0.03 })
    tarp(b1, -0.12, 0.42)
    oarsIn(b2)
    if (det >= 1) { sackS(...b3.f(-6, 0), 6.5, 4.5, UP + 0.4); sackS(...b3.f(2, 1), 6, 4.5, UP - 0.5) }
    tie(b1, -10); tie(b2, -10, 1.6); tie(b3, 12)
    // lines between the rafted boats
    ln(b1.f(10, 8.2), b2.f(10, -8), 0.7, { taper: 0.1 }); ln(b1.f(-18, 7.2), b2.f(-18, -7), 0.7, { taper: 0.1 })
  }
  /** 6: six small boats in a row, the quay crowded. */
  function boats6() {
    const xs = [-37, -22, -7.5, 7, 22, 36.5]
    quayPosts(xs)
    const L = [44, 46, 42, 48, 44, 40], B = [12.5, 13, 12, 13.5, 12.5, 11.5], Y = [42, 40, 43, 39, 41, 44], T3 = [0.03, -0.02, 0.05, -0.04, 0.02, -0.03]
    const bs = xs.map((x, i) => moored(x, Y[i], L[i], B[i], { st: i % 3 === 2 ? SKIFF : RB, tilt: T3[i], thwarts: [-0.25, 0.14], bowDeck: i % 3 === 2 }))
    oarsIn(bs[1]); oarsIn(bs[4])
    if (det >= 1) net(bs[3], 0.05, 8, 6)
    bs.forEach((b, i) => tie(b, xs[i]))
  }
  /** 7: a fishing skiff with its net, a rowboat loaded with barrels, a dinghy with its mast and furled sail. */
  function boats7() {
    quayPosts([-20, 0, 20])
    const b1 = moored(-20, 40, 56, 17, { st: SKIFF, bowDeck: true, thwarts: [-0.3, 0.1] })
    net(b1, -0.1, 10, 8)
    if (det >= 1) { for (const [x, y] of [[-26, 12], [-24, 17], [-28, 19]]) { const c = oval(x, y, 1.4, 1.4, 8); fillPoly(c, COL ? mix(T.sand, PAPER, 0.3) : PAPER); loop(c, 0.7, { flat: true }) } }
    const b2 = moored(0, 37, 60, 18.5, { thwarts: [-0.32, 0.3] })
    barrelS(...b2.f(-4, -3.5), 3); barrelS(...b2.f(2, 3.5), 2.8); crateS(...b2.f(9, -2), 6, 5.5, UP + 0.2)
    const b3 = moored(20, 42, 52, 16, { thwarts: [-0.3], tilt: -0.03 })
    const f = b3.f, boom = rounded([f(-14, -1.2), f(16, -1.2), f(16, 1.2), f(-14, 1.2)], 1.2, 3)
    castShadow([boom], 2); paint(boom, CANVAS(), 0.2); if (det >= 1) { for (let x = -12; x < 15; x += Math.max(K(5), 3.5)) { const a = f(x, -1.6), b = f(x + jt(0.2), 1.6); sg(a[0], a[1], b[0], b[1]) } flush(0.5) } outline(boom, 0.8, { noext: true })
    mast(...f(6, 0), 1.6, 8)
    tie(b1, -20); tie(b2, 0); tie(b3, 20)
  }
  reg('ct-boats', 'Moored boats', [boats0, boats1, boats2, boats3, boats4, boats5, boats6, boats7])
})(window.Atlas)
